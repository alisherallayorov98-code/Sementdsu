// ─────────────────────────────────────────────────────────────────────────────
// Bitta mijoz bo'yicha barcha ma'lumotni yig'uvchi yagona hisoblagich.
// Ham yangi "Sotish" (salesRows), ham eski "Sotilgan tonna" (soldRows) hisobga olinadi.
// Mijozlar nom (customer) orqali bog'lanadi.
// ─────────────────────────────────────────────────────────────────────────────
export function customerSummary(name, data) {
  const {
    salesRows = [], soldRows = [], debtRows = [],
    advanceRows = [], tgOrders = [],
  } = data || {};

  const sales  = [...salesRows, ...soldRows].filter(r => r.customer === name);
  const debts  = debtRows.filter(r => r.customer === name);
  const advs   = advanceRows.filter(r => r.customer === name);
  const orders = tgOrders.filter(o => o.customer === name);

  const totalTon     = sales.reduce((s, r) => s + Number(r.tons || 0), 0);
  const totalXarid   = sales.reduce((s, r) => s + Number(r.tons || 0) * Number(r.pricePerTon || 0), 0);
  const totalQarz    = debts.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalTolandi = debts.reduce((s, r) => s + Number(r.paid || 0), 0);
  const qolganQarz   = Math.max(0, totalQarz - totalTolandi);
  const totalAvans   = advs.reduce((s, r) => s + Number(r.amount || 0), 0);
  const usedAvans    = advs.reduce((s, r) => s + Number(r.used || 0), 0);
  const qolganAvans  = Math.max(0, totalAvans - usedAvans);

  return {
    sales, debts, advs, orders,
    totalTon, totalXarid,
    totalQarz, totalTolandi, qolganQarz,
    totalAvans, qolganAvans,
    salesCount: sales.length,
  };
}
