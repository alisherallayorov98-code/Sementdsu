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

export function buildReport(data, fromTs, toTs) {
  const inRange = (r) => { const t = rowTs(r); return t >= fromTs && t <= toTs; };

  // ── Savdo (yangi Sotish + eski Sotilgan tonna) ────────────────────────────
  const salesAll = [...(data.salesRows || []), ...(data.soldRows || [])].filter(inRange);
  const salesTotalTons = salesAll.reduce((s, r) => s + Number(r.tons || 0), 0);
  const salesTotalSum  = salesAll.reduce((s, r) => s + saleSum(r), 0);
  const ch = (c) => salesAll.filter(r => (r.paymentChannel || 'naqd') === c).reduce((s, r) => s + saleSum(r), 0);
  const salesByChannel = { naqd: ch('naqd'), bank: ch('bank'), click: ch('click'), nasiya: ch('nasiya') };

  // ── Olingan sement (xarid) ────────────────────────────────────────────────
  const recv = (data.recvRows || []).filter(inRange);
  const recvTons = recv.reduce((s, r) => s + Number(r.tons || 0), 0);
  const recvCost = recv.reduce((s, r) => s + Number(r.tons || 0) * Number(r.pricePerTon || 0), 0);

  // ── Pul harakati (qo'lda kirim/chiqim yozuvlari) ──────────────────────────
  const finance = {
    naqdIn:  sumMoney((data.incomeRows || []).filter(inRange)),
    naqdOut: sumMoney((data.expenseRows || []).filter(inRange)),
    bankIn:  sumMoney((data.bankIncomeRows || []).filter(inRange)),
    bankOut: sumMoney((data.bankExpenseRows || []).filter(inRange)),
    clickIn: sumMoney((data.clickIncomeRows || []).filter(inRange)),
    clickOut:sumMoney((data.clickExpenseRows || []).filter(inRange)),
  };

  // ── Davr top mijozlari (savdo bo'yicha) ───────────────────────────────────
  const byCust = {};
  salesAll.forEach(r => {
    const k = r.customer || '—';
    if (!byCust[k]) byCust[k] = { name: k, tons: 0, sum: 0, count: 0 };
    byCust[k].tons += Number(r.tons || 0);
    byCust[k].sum  += saleSum(r);
    byCust[k].count += 1;
  });
  const topCustomers = Object.values(byCust).sort((a, b) => b.sum - a.sum);

  // ── Qarzlar (davrda yaratilgan) ───────────────────────────────────────────
  const debtsInPeriod = (data.debtRows || []).filter(inRange);

  // ── Hozirgi holat (snapshot — davrga bog'liq emas) ────────────────────────
  const snapshot = {
    cash:    Number(data.totalCashBalance || 0),
    bank:    Number(data.bankNetBalance || 0),
    click:   Number(data.clickNetBalance || 0),
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
    // davr sof pul oqimi (qo'lda kirim/chiqim + naqd/bank/click savdo tushumi)
    periodNetCash: (finance.naqdIn - finance.naqdOut) + (finance.bankIn - finance.bankOut) + (finance.clickIn - finance.clickOut)
                   + salesByChannel.naqd + salesByChannel.bank + salesByChannel.click,
  };
}
