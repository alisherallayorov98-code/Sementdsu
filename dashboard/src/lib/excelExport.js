// ─────────────────────────────────────────────────────────────────────────────
// Excel'ga hisobot chiqarish — barcha bo'limlar uchun yagona vosita.
//   columns: [{ key, header }]   rows: [{ ...obj }]
//   exportToExcel({ filename, sheetName, columns, rows, title })
// Ustun kengligi avtomatik, sarlavha qatori (ixtiyoriy) qalin emas — oddiy klassik.
// ─────────────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx';

const todayStamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
};

export function exportToExcel({ filename, sheetName = 'Hisobot', columns, rows, title }) {
  if (!rows || rows.length === 0) {
    alert("Eksport qilish uchun ma'lumot yo'q.");
    return;
  }

  const headers = columns.map(c => c.header);
  const aoa = [];

  // Ixtiyoriy sarlavha qatori
  if (title) {
    aoa.push([title]);
    aoa.push([]); // bo'sh qator
  }
  aoa.push(headers);

  rows.forEach(r => {
    aoa.push(columns.map(c => {
      const v = typeof c.value === 'function' ? c.value(r) : r[c.key];
      return v === undefined || v === null ? '' : v;
    }));
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Ustun kengligini sarlavha/qiymatga moslash
  ws['!cols'] = columns.map((c, i) => {
    let max = String(c.header).length;
    rows.forEach(r => {
      const v = typeof c.value === 'function' ? c.value(r) : r[c.key];
      const len = String(v ?? '').length;
      if (len > max) max = len;
    });
    return { wch: Math.min(Math.max(max + 2, 10), 45) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const name = (filename || 'hisobot').replace(/\.xlsx$/i, '');
  XLSX.writeFile(wb, `${name}_${todayStamp()}.xlsx`);
}
