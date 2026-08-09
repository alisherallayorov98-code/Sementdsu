// ─────────────────────────────────────────────────────────────────────────────
// Arxiv uchun Excel fayl yasash — ko'p varaqli.
//
// Har bo'lim alohida varaq bo'ladi (pastdagi yorliqlardan o'tiladi).
// Birinchi varaq — "Xulosa": qaysi bo'limda nechta yozuv va qancha summa.
// Shunda faylni ochgan odam nima borligini darrov ko'radi.
//
// Bu yerda faqat baytlar yasaladi (Blob) — diskka yozish archiveWriter.js da.
// ─────────────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx';

// Excel varaq nomi cheklovlari: 31 belgi, : \ / ? * [ ] taqiqlangan
const safeSheetName = (name) => String(name).replace(/[:\\/?*[\]]/g, '-').slice(0, 31);

const cellValue = (col, row) => {
  const v = typeof col.get === 'function' ? col.get(row) : row[col.key];
  return (v === undefined || v === null) ? '' : v;
};

function sheetToAoa({ columns, rows }) {
  const aoa = [columns.map(c => c.header)];
  for (const r of rows) aoa.push(columns.map(c => cellValue(c, r)));
  return aoa;
}

function colWidths({ columns, rows }) {
  return columns.map(c => {
    let max = String(c.header).length;
    // Kenglikni butun ustundan emas, birinchi 200 qatordan chamalaymiz —
    // 50 000 qatorli varaqda har katakni o'lchash faylni sekinlashtiradi.
    const sample = rows.length > 200 ? rows.slice(0, 200) : rows;
    for (const r of sample) {
      const len = String(cellValue(c, r) ?? '').length;
      if (len > max) max = len;
    }
    return { wch: Math.min(Math.max(max + 2, 9), 45) };
  });
}

/**
 * Ko'p varaqli Excel yasaydi.
 * @param {Array} sheets — [{ sheet, columns, rows }]
 * @param {object} opts  — { title } xulosa varag'i sarlavhasi
 * @returns {Blob|null}  — bo'sh bo'lsa null
 */
export function buildWorkbook(sheets, { title = '' } = {}) {
  const list = (sheets || []).filter(s => s && s.rows && s.rows.length);
  if (!list.length) return null;

  const wb = XLSX.utils.book_new();

  // ── Xulosa varag'i ────────────────────────────────────────────────────────
  const summary = [
    [title || 'ARXIV'],
    [`Yaratildi: ${new Date().toLocaleString('ru-RU')}`],
    [],
    ["Bo'lim", 'Yozuvlar soni', "Jami summa (so'm)"],
  ];
  for (const s of list) {
    // "Summa" so'zi bor birinchi ustunni topamiz — xulosa uchun yetarli
    const moneyCol = s.columns.find(c => /summa|jami|qarz|avans/i.test(c.header));
    const total = moneyCol
      ? s.rows.reduce((acc, r) => {
          const v = Number(cellValue(moneyCol, r));
          return acc + (isFinite(v) ? v : 0);
        }, 0)
      : '';
    summary.push([s.sheet, s.rows.length, total]);
  }
  const wsSum = XLSX.utils.aoa_to_sheet(summary);
  wsSum['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSum, 'XULOSA');

  // ── Bo'lim varaqlari ──────────────────────────────────────────────────────
  const used = new Set(['XULOSA']);
  for (const s of list) {
    let name = safeSheetName(s.sheet);
    // Nomi takrorlanib qolsa Excel faylni ochmaydi — raqam qo'shamiz
    let n = 2;
    while (used.has(name)) name = safeSheetName(`${s.sheet} ${n++}`);
    used.add(name);

    const ws = XLSX.utils.aoa_to_sheet(sheetToAoa(s));
    ws['!cols'] = colWidths(s);
    // Sarlavha qatorini muzlatamiz — uzun ro'yxatda ustun nomi ko'rinib turadi
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
