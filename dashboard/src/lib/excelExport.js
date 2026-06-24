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

// ── Mijoz Akt Sverka — ko'p varaqli ─────────────────────────────────────────
export function exportAktSverka(customerName, { sales, debts, summary }) {
  const wb = XLSX.utils.book_new();
  const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
  const fmtT = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };

  // 1-varaq: Umumiy ma'lumot
  const infoAoa = [
    [`AKT-SVERKA: ${customerName}`],
    [`Sana: ${new Date().toLocaleDateString('ru-RU')}`],
    [],
    ['Ko\'rsatkich', 'Qiymat'],
    ['Jami xarid (so\'m)', summary.totalXarid],
    ['Jami tonna', summary.totalTon],
    ['Jami qarz', summary.qolganQarz],
    ['Jami avans', summary.qolganAvans],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(infoAoa);
  wsInfo['!cols'] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Umumiy');

  // 2-varaq: Xaridlar
  const salesAoa = [
    [`Xaridlar: ${customerName}`],
    [],
    ['Sana', 'Tonna', 'Narx (1tn)', 'Jami summa', 'To\'lov turi', 'Izoh'],
    ...sales.map(r => [
      r.date,
      Number(r.tons || 0),
      Number(r.pricePerTon || 0),
      Number(r.tons || 0) * Number(r.pricePerTon || 0),
      r.paymentChannel || '',
      r.note || '',
    ]),
    [],
    ['JAMI', sales.reduce((s,r)=>s+Number(r.tons||0),0), '', sales.reduce((s,r)=>s+Number(r.tons||0)*Number(r.pricePerTon||0),0), '', ''],
  ];
  const wsSales = XLSX.utils.aoa_to_sheet(salesAoa);
  wsSales['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsSales, 'Xaridlar');

  // 3-varaq: Qarzlar
  const debtsAoa = [
    [`Qarzlar: ${customerName}`],
    [],
    ['Sana', 'Qarz summasi', 'To\'landi', 'Qoldiq', 'Izoh'],
    ...debts.map(r => [
      r.date,
      Number(r.amount || 0),
      Number(r.paid || 0),
      Math.max(0, Number(r.amount || 0) - Number(r.paid || 0)),
      r.note || '',
    ]),
    [],
    ['JAMI', debts.reduce((s,r)=>s+Number(r.amount||0),0), debts.reduce((s,r)=>s+Number(r.paid||0),0), debts.reduce((s,r)=>s+Math.max(0,Number(r.amount||0)-Number(r.paid||0)),0), ''],
  ];
  const wsDebts = XLSX.utils.aoa_to_sheet(debtsAoa);
  wsDebts['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsDebts, 'Qarzlar');

  XLSX.writeFile(wb, `AktSverka_${customerName}_${todayStamp()}.xlsx`);
}
