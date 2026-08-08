// ─────────────────────────────────────────────────────────────────────────────
// Hisobot ma'lumotlarini bir joyda hisoblovchi modul (ekran + Excel uchun yagona manba).
// Sana oralig'i bo'yicha filtrlaydi (fromTs..toTs, ikkala chegara ham kiradi).
// ─────────────────────────────────────────────────────────────────────────────

// 'dd.mm.yyyy' -> timestamp
export const parseDate = (s) => {
  if (!s) return 0;
  const p = String(s).split('.');
  if (p.length !== 3) return 0;
  const [d, m, y] = p.map(Number);
  return new Date(y, m - 1, d).getTime();
};

const rowTs = (r) => parseDate(r.date) || Number(r.createdAt || r.id || 0);

const sumMoney = (rows) => rows.reduce((s, r) => s + Number(r.amount || 0), 0);
const saleSum  = (r) => Number(r.tons || 0) * Number(r.pricePerTon || 0);
// O'tkazma (kanallararo ko'chirish) kirim ham, chiqim ham emas.
const isTransfer = (r) => !!r && (r.transfer === true || String(r.desc || '').trim().startsWith('↔️'));
const inSum  = (rows) => rows.reduce((s, r) => isTransfer(r) ? s : s + Math.max(0,  Number(r.amount || 0)), 0);
const outSum = (rows) => rows.reduce((s, r) => isTransfer(r) ? s : s + Math.max(0, -Number(r.amount || 0)), 0);

export function buildReport(data, fromTs, toTs) {
  const inRange = (r) => { const t = rowTs(r); return t >= fromTs && t <= toTs; };

  // ── Savdo (yangi Sotish + eski Sotilgan tonna) ────────────────────────────
  const salesAll = [...(data.salesRows || []), ...(data.soldRows || [])].filter(inRange);
  const salesTotalTons = salesAll.reduce((s, r) => s + Number(r.tons || 0), 0);
  const salesTotalSum  = salesAll.reduce((s, r) => s + saleSum(r), 0);
  const ch = (c) => salesAll.filter(r => (r.paymentChannel || 'naqd') === c).reduce((s, r) => s + saleSum(r), 0);
  const salesByChannel = { naqd: ch('naqd'), bank: ch('bank'), click: ch('click'), nasiya: ch('nasiya') };

  // ── Olingan sement (xarid) ────────────────────────────────────────────────
  // Tasdiqlanmagan (pending) yuk hisobotga kirmaydi — sement qoldig'i va
  // zavod qarzi ham uni hisobga olmaydi, aks holda hisobot ular bilan mos
  // kelmasdi.
  const recv = (data.recvRows || []).filter(r => !r.pending && inRange(r));
  const recvTons = recv.reduce((s, r) => s + Number(r.tons || 0), 0);
  const recvCost = recv.reduce((s, r) => s + Number(r.tons || 0) * Number(r.pricePerTon || 0), 0);

  // ── Pul harakati ──────────────────────────────────────────────────────────
  // Ilgari bu yerda FAQAT eski income*/expense* ro'yxatlari hisoblanardi.
  // Pul kiritish Kassirga birlashtirilgandan keyin ular deyarli bo'sh qoladi:
  // Excel hisobotidagi "Naqd kirim" har doim 0 chiqib, xuddi shu hisobotdagi
  // "davr sof pul oqimi" bilan mos kelmasdi. Endi Kassir kanal yozuvlari
  // (cash/bank/click) va eski soldRows tushumi ham qo'shiladi — Bosh sahifa
  // bilan bir xil qoida (o'tkazma chiqarib tashlanadi, auto yozuvlar kiradi).
  const rCash  = (data.cashRows  || []).filter(inRange);
  const rBank  = (data.bankRows  || []).filter(inRange);
  const rClick = (data.clickRows || []).filter(inRange);
  const soldCh = (c) => (data.soldRows || [])
    .filter(r => inRange(r) && (r.paymentChannel || 'naqd') === c)
    .reduce((s, r) => s + saleSum(r), 0);
  const finance = {
    naqdIn:  sumMoney((data.incomeRows || []).filter(inRange))       + inSum(rCash)  + soldCh('naqd'),
    naqdOut: sumMoney((data.expenseRows || []).filter(inRange))      + outSum(rCash),
    bankIn:  sumMoney((data.bankIncomeRows || []).filter(inRange))   + inSum(rBank)  + soldCh('bank'),
    bankOut: sumMoney((data.bankExpenseRows || []).filter(inRange))  + outSum(rBank),
    clickIn: sumMoney((data.clickIncomeRows || []).filter(inRange))  + inSum(rClick) + soldCh('click'),
    clickOut:sumMoney((data.clickExpenseRows || []).filter(inRange)) + outSum(rClick),
  };

  // ── Kassa qatorlari oqimi (sotuv/qarz/avans/oylik auto + qo'lda tahrir) ────
  // cashRows/bankRows/clickRows summasi ishorali (sotuv +, oylik −).
  const channelFlow = (rows) => sumMoney((rows || []).filter(inRange));
  const cashRowsFlow  = channelFlow(data.cashRows);
  const bankRowsFlow  = channelFlow(data.bankRows);
  const clickRowsFlow = channelFlow(data.clickRows);
  // Eski "Sotilgan tonna" (soldRows) auto-yozuv yaratmaydi — alohida qo'shamiz
  const soldFlow = (data.soldRows || [])
    .filter(r => inRange(r) && ['naqd', 'bank', 'click'].includes(r.paymentChannel || 'naqd'))
    .reduce((s, r) => s + saleSum(r), 0);

  // ── Davr top mijozlari (savdo bo'yicha) ───────────────────────────────────
  // Kalit customerId (bo'lmasa normallashtirilgan nom) — xom nom ishlatilsa
  // bitta mijoz ("Ali aka" / "ali  aka") ro'yxatda ikki qator bo'lib chiqardi.
  const custKeyOf = (r) => r.customerId != null
    ? `#${r.customerId}`
    : String(r.customer || '—').trim().toLowerCase().replace(/[ʻʼ'`’‘]/g, "'").replace(/\s+/g, ' ');
  const byCust = {};
  salesAll.forEach(r => {
    const k = custKeyOf(r);
    if (!byCust[k]) byCust[k] = { name: r.customer || '—', tons: 0, sum: 0, count: 0 };
    byCust[k].tons += Number(r.tons || 0);
    byCust[k].sum  += saleSum(r);
    byCust[k].count += 1;
  });
  const topCustomers = Object.values(byCust).sort((a, b) => b.sum - a.sum);

  // ── Qarzlar (davrda yaratilgan) ───────────────────────────────────────────
  const debtsInPeriod = (data.debtRows || []).filter(inRange);

  // ── Hozirgi holat (snapshot — davrga bog'liq emas) ────────────────────────
  // To'liq balanslar (auto-yozuvlar bilan) — Dashboard kartalari bilan bir xil.
  const snapshot = {
    cash:    Number(data.totalCashBalance || 0),
    bank:    Number(data.totalBankBalance ?? data.bankNetBalance ?? 0),
    click:   Number(data.totalClickBalance ?? data.clickNetBalance ?? 0),
    cement:  Number(data.totalCementBalance || 0),
    debts:   Number(data.totalDebts || 0),
    advances:Number(data.totalAdvances || 0),
  };
  snapshot.totalMoney = snapshot.cash + snapshot.bank + snapshot.click;

  return {
    sales: { rows: salesAll, totalTons: salesTotalTons, totalSum: salesTotalSum, byChannel: salesByChannel },
    recv:  { rows: recv, totalTons: recvTons, totalCost: recvCost },
    finance,
    topCustomers,
    debtsInPeriod,
    snapshot,
    // davr sof pul oqimi = kassa qatorlari oqimi (sotuv/qarz/avans/oylik auto)
    //   + qo'lda kirim/chiqim + eski soldRows tushumi
    periodNetCash: cashRowsFlow + bankRowsFlow + clickRowsFlow
                   + (finance.naqdIn - finance.naqdOut)
                   + (finance.bankIn - finance.bankOut)
                   + (finance.clickIn - finance.clickOut)
                   + soldFlow,
  };
}
