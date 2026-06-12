// ─────────────────────────────────────────────────────────────────────────────
// Chiroyli Excel hisobot generatori (exceljs).
// Ranglar, ramkalar, raqam formati, bir nechta varaq, jami qatorlar, muzlatilgan sarlavha.
// ─────────────────────────────────────────────────────────────────────────────
import ExcelJS from 'exceljs';

const MONEY = '#,##0" so\'m"';
const TONS  = '#,##0.##" tn"';

const C = {
  navy:  'FF003366',
  blue:  'FF1565C0',
  green: 'FF2E7D32',
  red:   'FFC62828',
  orange:'FFEF6C00',
  purple:'FF6A1B9A',
  grayHdr:'FFECEFF1',
  zebra: 'FFF7F9FC',
  white: 'FFFFFFFF',
  dark:  'FF222222',
};

const fmt = (n) => Number(n || 0);

// Yupqa ramka
const border = () => ({
  top:    { style: 'thin', color: { argb: 'FFD0D7DE' } },
  left:   { style: 'thin', color: { argb: 'FFD0D7DE' } },
  bottom: { style: 'thin', color: { argb: 'FFD0D7DE' } },
  right:  { style: 'thin', color: { argb: 'FFD0D7DE' } },
});

function fillRow(row, argb) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  });
}

// Jadval sarlavhasi (rangli, oq qalin matn, markazda)
function tableHeader(ws, headers, argb = C.navy) {
  const row = ws.addRow(headers);
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: C.white }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border();
  });
  return row;
}

function dataRow(ws, values, { zebra = false, formats = {} } = {}) {
  const row = ws.addRow(values);
  row.eachCell((cell, col) => {
    cell.border = border();
    cell.font = { size: 11 };
    if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.zebra } };
    if (formats[col]) cell.numFmt = formats[col];
  });
  return row;
}

function totalRow(ws, values, formats = {}) {
  const row = ws.addRow(values);
  row.eachCell((cell, col) => {
    cell.font = { bold: true, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF59D' } };
    cell.border = border();
    if (formats[col]) cell.numFmt = formats[col];
  });
  return row;
}

// ── Xulosa varaqidagi bo'lim sarlavhasi va label/qiymat qatorlari ───────────
function sectionTitle(ws, text, argb) {
  ws.mergeCells(`A${ws.rowCount + 1}:B${ws.rowCount + 1}`);
  const row = ws.lastRow;
  row.height = 20;
  const cell = row.getCell(1);
  cell.value = text;
  cell.font = { bold: true, color: { argb: C.white }, size: 12 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
}

function kv(ws, label, value, { numFmt = MONEY, color, bold } = {}) {
  const row = ws.addRow([label, value]);
  const a = row.getCell(1), b = row.getCell(2);
  a.font = { size: 11, color: { argb: C.dark } };
  a.alignment = { indent: 1 };
  b.numFmt = numFmt;
  b.alignment = { horizontal: 'right' };
  b.font = { size: 11, bold: !!bold, color: { argb: color || C.dark } };
  a.border = border(); b.border = border();
}

export async function generateReportExcel(report, meta) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sement Biznes Boshqaruvi';
  wb.created = new Date();

  // ═══ 1) XULOSA ═══════════════════════════════════════════════════════════
  const ws = wb.addWorksheet('Xulosa', { properties: { defaultRowHeight: 16 } });
  ws.columns = [{ width: 42 }, { width: 24 }];

  ws.mergeCells('A1:B1');
  const t = ws.getCell('A1');
  t.value = meta.appName || 'SEMENT — MOLIYAVIY HISOBOT';
  t.font = { bold: true, size: 16, color: { argb: C.white } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } };
  t.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:B2');
  const p = ws.getCell('A2');
  p.value = `Davr: ${meta.fromLabel} — ${meta.toLabel}`;
  p.font = { bold: true, size: 12, color: { argb: C.navy } };
  p.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
  p.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 20;

  ws.mergeCells('A3:B3');
  const info = ws.getCell('A3');
  info.value = `Tayyorlandi: ${meta.generatedAt}${meta.worker ? '  •  Xodim: ' + meta.worker : ''}`;
  info.font = { italic: true, size: 10, color: { argb: 'FF777777' } };
  info.alignment = { horizontal: 'center' };
  ws.addRow([]);

  // Davr savdosi
  sectionTitle(ws, 'DAVR SAVDOSI', C.blue);
  kv(ws, 'Jami sotilgan tonna', fmt(report.sales.totalTons), { numFmt: TONS, bold: true, color: C.blue });
  kv(ws, 'Jami savdo summasi', fmt(report.sales.totalSum), { bold: true, color: C.green });
  kv(ws, '  — Naqd', fmt(report.sales.byChannel.naqd));
  kv(ws, '  — Bank', fmt(report.sales.byChannel.bank));
  kv(ws, '  — Click', fmt(report.sales.byChannel.click));
  kv(ws, '  — Nasiya (qarz)', fmt(report.sales.byChannel.nasiya), { color: C.red });
  ws.addRow([]);

  // Sement harakati
  sectionTitle(ws, 'SEMENT HARAKATI (DAVR)', C.orange);
  kv(ws, 'Olingan sement', fmt(report.recv.totalTons), { numFmt: TONS });
  kv(ws, 'Olingan sement summasi (xarid)', fmt(report.recv.totalCost), { color: C.red });
  kv(ws, 'Sotilgan sement', fmt(report.sales.totalTons), { numFmt: TONS });
  ws.addRow([]);

  // Pul harakati
  sectionTitle(ws, 'PUL HARAKATI (DAVR, qo\'lda yozuvlar)', C.green);
  kv(ws, 'Naqd kirim', fmt(report.finance.naqdIn), { color: C.green });
  kv(ws, 'Naqd chiqim', fmt(report.finance.naqdOut), { color: C.red });
  kv(ws, 'Bank kirim', fmt(report.finance.bankIn), { color: C.green });
  kv(ws, 'Bank chiqim', fmt(report.finance.bankOut), { color: C.red });
  kv(ws, 'Click kirim', fmt(report.finance.clickIn), { color: C.green });
  kv(ws, 'Click chiqim', fmt(report.finance.clickOut), { color: C.red });
  kv(ws, 'Davr sof pul oqimi', fmt(report.periodNetCash), { bold: true, color: report.periodNetCash >= 0 ? C.green : C.red });
  ws.addRow([]);

  // Hozirgi holat
  sectionTitle(ws, 'HOZIRGI HOLAT (joriy qoldiqlar)', C.navy);
  kv(ws, 'Naqd kassa qoldig\'i', fmt(report.snapshot.cash), { bold: true });
  kv(ws, 'Bank qoldig\'i', fmt(report.snapshot.bank), { bold: true });
  kv(ws, 'Click qoldig\'i', fmt(report.snapshot.click), { bold: true });
  kv(ws, 'Jami mavjud pul', fmt(report.snapshot.totalMoney), { bold: true, color: C.blue });
  kv(ws, 'Sement qoldig\'i', fmt(report.snapshot.cement), { numFmt: TONS, bold: true, color: C.orange });
  kv(ws, 'Mijozlar bizga qarzi', fmt(report.snapshot.debts), { bold: true, color: C.green });
  kv(ws, 'Biz olgan avanslar', fmt(report.snapshot.advances), { bold: true, color: C.red });

  ws.views = [{ state: 'frozen', ySplit: 3 }];

  // ═══ 2) SAVDOLAR ═════════════════════════════════════════════════════════
  const s = wb.addWorksheet('Savdolar');
  s.columns = [{ width: 12 }, { width: 26 }, { width: 14 }, { width: 12 }, { width: 16 }, { width: 18 }, { width: 24 }, { width: 16 }];
  tableHeader(s, ['Sana', 'Mijoz', 'To\'lov turi', 'Tonna', 'Narx/tn', 'Summa', 'Izoh', 'Xodim'], C.blue);
  const sFormats = { 4: TONS, 5: MONEY, 6: MONEY };
  report.sales.rows
    .slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .forEach((r, i) => dataRow(s, [
      r.date || '', r.customer || '', (r.paymentChannel || 'naqd'),
      fmt(r.tons), fmt(r.pricePerTon), fmt(Number(r.tons || 0) * Number(r.pricePerTon || 0)),
      r.note || r.izoh || '', r.worker || '',
    ], { zebra: i % 2 === 1, formats: sFormats }));
  totalRow(s, ['JAMI', '', '', fmt(report.sales.totalTons), '', fmt(report.sales.totalSum), '', ''], sFormats);
  s.views = [{ state: 'frozen', ySplit: 1 }];

  // ═══ 3) PUL HARAKATI ═════════════════════════════════════════════════════
  const f = wb.addWorksheet('Pul harakati');
  f.columns = [{ width: 12 }, { width: 12 }, { width: 12 }, { width: 18 }, { width: 30 }, { width: 16 }];
  tableHeader(f, ['Sana', 'Hisob', 'Yo\'nalish', 'Summa', 'Izoh', 'Xodim'], C.green);
  const finRows = [];
  const push = (arr, hisob, yon) => (arr || []).forEach(r => finRows.push({ ...r, _h: hisob, _y: yon }));
  push(meta.raw.incomeRows?.filter(meta.inRange), 'Naqd', 'Kirim');
  push(meta.raw.expenseRows?.filter(meta.inRange), 'Naqd', 'Chiqim');
  push(meta.raw.bankIncomeRows?.filter(meta.inRange), 'Bank', 'Kirim');
  push(meta.raw.bankExpenseRows?.filter(meta.inRange), 'Bank', 'Chiqim');
  push(meta.raw.clickIncomeRows?.filter(meta.inRange), 'Click', 'Kirim');
  push(meta.raw.clickExpenseRows?.filter(meta.inRange), 'Click', 'Chiqim');
  finRows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .forEach((r, i) => {
      const row = dataRow(f, [r.date || '', r._h, r._y, fmt(r.amount), r.desc || '', r.worker || ''], { zebra: i % 2 === 1, formats: { 4: MONEY } });
      row.getCell(3).font = { size: 11, color: { argb: r._y === 'Kirim' ? C.green : C.red }, bold: true };
    });
  if (finRows.length === 0) f.addRow(['(davr ichida yozuv yo\'q)']);
  f.views = [{ state: 'frozen', ySplit: 1 }];

  // ═══ 4) QARZLAR (davrda) ═════════════════════════════════════════════════
  const d = wb.addWorksheet('Qarzlar');
  d.columns = [{ width: 12 }, { width: 26 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 28 }];
  tableHeader(d, ['Sana', 'Mijoz', 'Qarz', 'To\'landi', 'Qoldiq', 'Izoh'], C.red);
  const dFormats = { 3: MONEY, 4: MONEY, 5: MONEY };
  let dQ = 0, dT = 0, dL = 0;
  report.debtsInPeriod
    .slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .forEach((r, i) => {
      const left = Math.max(0, Number(r.amount || 0) - Number(r.paid || 0));
      dQ += Number(r.amount || 0); dT += Number(r.paid || 0); dL += left;
      dataRow(d, [r.date || '', r.customer || '', fmt(r.amount), fmt(r.paid), fmt(left), r.note || ''], { zebra: i % 2 === 1, formats: dFormats });
    });
  totalRow(d, ['JAMI', '', fmt(dQ), fmt(dT), fmt(dL), ''], dFormats);
  d.views = [{ state: 'frozen', ySplit: 1 }];

  // ═══ 5) TOP MIJOZLAR ═════════════════════════════════════════════════════
  const c = wb.addWorksheet('Top mijozlar');
  c.columns = [{ width: 6 }, { width: 30 }, { width: 12 }, { width: 14 }, { width: 18 }];
  tableHeader(c, ['#', 'Mijoz', 'Savdolar', 'Tonna', 'Summa'], C.purple);
  report.topCustomers.forEach((x, i) => dataRow(c, [i + 1, x.name, x.count, fmt(x.tons), fmt(x.sum)], { zebra: i % 2 === 1, formats: { 4: TONS, 5: MONEY } }));
  c.views = [{ state: 'frozen', ySplit: 1 }];

  // ── Yuklab olish ──────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = meta.fileName || 'sement-hisobot.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}
