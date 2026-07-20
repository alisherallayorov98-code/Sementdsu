// ─────────────────────────────────────────────────────────────────────────────
// Bitta mijoz bo'yicha barcha ma'lumotni yig'uvchi yagona hisoblagich.
// Ham yangi "Sotish" (salesRows), ham eski "Sotilgan tonna" (soldRows) hisobga olinadi.
// Mijozlar nom (customer) orqali bog'lanadi.
// ─────────────────────────────────────────────────────────────────────────────
export function customerSummary(name, data) {
  const {
    salesRows = [], soldRows = [], debtRows = [],
    advanceRows = [], tgOrders = [], skladRows = [],
  } = data || {};

  // Chakana (sklad, kg) sotuvlarini ham ulgurji ko'rinishga keltiramiz.
  // Ilgari bular umuman hisobga olinmagan edi: faqat skladdan oladigan mijozning
  // xaridi 0 ko'rinardi va nazoratda "Xarid yo'q" deb noto'g'ri belgilanardi.
  const skladSales = skladRows
    .filter(r => r.type === 'chiqim' && r.customer === name)
    .map(r => {
      const kg = Math.abs(Number(r.kg || 0));
      return {
        ...r,
        tons: kg / 1000,
        pricePerTon: Number(r.pricePerKg || 0) * 1000,
        paymentChannel: r.channel,
        _sklad: true,
      };
    });

  const sales  = [...salesRows, ...soldRows].filter(r => r.customer === name).concat(skladSales);
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

  // Oxirgi xarid vaqti (createdAt yoki id timestamp bo'yicha)
  const lastSaleAt = sales.reduce((mx, r) => Math.max(mx, Number(r.createdAt || r.id || 0)), 0);

  return {
    sales, debts, advs, orders,
    totalTon, totalXarid,
    totalQarz, totalTolandi, qolganQarz,
    totalAvans, qolganAvans,
    lastSaleAt,
    salesCount: sales.length,
  };
}
