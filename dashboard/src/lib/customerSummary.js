// ─────────────────────────────────────────────────────────────────────────────
// Bitta mijoz bo'yicha barcha ma'lumotni yig'uvchi yagona hisoblagich.
// Ham yangi "Sotish" (salesRows), ham eski "Sotilgan tonna" (soldRows) hisobga olinadi.
// Mijoz customerId (bo'lsa) yoki normallashtirilgan nom orqali bog'lanadi —
// qarang: lib/customerRef.js.
//
// `arg` — mijoz obyekti ({ id, name }) yoki ism satri. Ism berilsa, mijozlar
// bazasidan obyekt topiladi — shunda qidiruv id bo'yicha ketadi.
// ─────────────────────────────────────────────────────────────────────────────
// .js kengaytmasi bilan — modul Vite'da ham, Node testlarida ham yuklanadi
import { custRows, rowIsCust, findCust, nameKey } from './customerRef.js';

export function customerSummary(arg, data) {
  const {
    salesRows = [], soldRows = [], debtRows = [],
    advanceRows = [], tgOrders = [], skladRows = [],
    cashRows = [], bankRows = [], clickRows = [],
    bankIncomeRows = [], bankExpenseRows = [], customers = [],
  } = data || {};

  // Chaqiruvchilarning ko'pi faqat ism biladi (sotuv qatoridan, chekdan...).
  // Bazadan obyektni shu yerda topamiz — shunda har bir chaqiruv joyini
  // alohida o'zgartirmasdan id bo'yicha bog'lanish ishlaydi.
  const ref = (typeof arg === 'object' && arg) ? arg : (findCust(customers, arg) || arg);

  // Chakana (sklad, kg) sotuvlarini ham ulgurji ko'rinishga keltiramiz.
  // Ilgari bular umuman hisobga olinmagan edi: faqat skladdan oladigan mijozning
  // xaridi 0 ko'rinardi va nazoratda "Xarid yo'q" deb noto'g'ri belgilanardi.
  const skladSales = custRows(skladRows, ref)
    .filter(r => r.type === 'chiqim')
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

  const sales  = custRows([...salesRows, ...soldRows], ref).concat(skladSales);
  const debts  = custRows(debtRows, ref);
  const advs   = custRows(advanceRows, ref);
  const orders = custRows(tgOrders, ref);

  const totalTon     = sales.reduce((s, r) => s + Number(r.tons || 0), 0);
  const totalXarid   = sales.reduce((s, r) => s + Number(r.tons || 0) * Number(r.pricePerTon || 0), 0);
  const totalQarz    = debts.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalTolandi = debts.reduce((s, r) => s + Number(r.paid || 0), 0);
  // Qoldiq HAR QATOR bo'yicha hisoblanadi — dasturning qolgan hamma joyi
  // (totalDebts, advanceBalanceOf, Kassir, Bosh sahifa) aynan shunday qiladi.
  // Ilgari bu yerda jami bo'yicha `max(0, jamiQarz - jamiTo'lov)` edi: bitta
  // qarz ORTIQCHA to'langan bo'lsa (payDebt buni tasdiq bilan ruxsat beradi),
  // ortiqcha summa boshqa qarzni yashirib, mijoz kartochkasi va akt sverka
  // Kassirdagidan KAM qarz ko'rsatardi.
  const qolganQarz   = debts.reduce((s, r) => s + Math.max(0, Number(r.amount || 0) - Number(r.paid || 0)), 0);
  const ortiqchaTolov = debts.reduce((s, r) => s + Math.max(0, Number(r.paid || 0) - Number(r.amount || 0)), 0);
  const totalAvans   = advs.reduce((s, r) => s + Number(r.amount || 0), 0);
  const qolganAvans  = advs.reduce((s, r) => s + Math.max(0, Number(r.amount || 0) - Number(r.used || 0)), 0);

  // Sof balans — bitta raqamda mijozning holati (MoySklad uslubida):
  //   manfiy  = mijoz bizga qarzdor
  //   musbat  = mijozning bizda oldindan to'langan puli bor
  // DIQQAT: bu faqat KO'RSATISH uchun. Qarz va avans bazada har doim musbat
  // saqlanadi — manfiy summa filtrlar va hisob-kitoblarni buzadi.
  const balans = qolganAvans - qolganQarz;

  // ── BOG'LANMAGAN (osilib qolgan) pul harakatlari ─────────────────────────
  // Mijozga biriktirilgan, lekin sotuv/qarz/avansga ULANMAGAN kassa yozuvlari.
  // Manba: Kassir kirim (mijozsiz kiritilib keyin tahrirda mijoz qo'shilgan),
  // Bank kirim/chiqim sahifasi (mijoz "ixtiyoriy" tanlangan) va h.k.
  // Bular auto EMAS (auto'lar allaqachon qarz/avans/sotuv orqali ko'rinadi).
  // Shu pullar hech qaysi bo'limda ko'rinmay "yo'qolib" ketardi — endi mijoz
  // kartochkasida ro'yxatlanadi, shunda har raqamning izini topish mumkin.
  const unlinked = [
    ...cashRows.map(r => ({ ...r, _ch: 'naqd' })),
    ...bankRows.map(r => ({ ...r, _ch: 'bank' })),
    ...clickRows.map(r => ({ ...r, _ch: 'click' })),
    ...bankIncomeRows.map(r => ({ ...r, _ch: 'bank', amount: Math.abs(Number(r.amount || 0)) })),
    ...bankExpenseRows.map(r => ({ ...r, _ch: 'bank', amount: -Math.abs(Number(r.amount || 0)) })),
  ].filter(r => !r.auto && rowIsCust(r, ref));
  const unlinkedIn  = unlinked.filter(r => Number(r.amount) > 0).reduce((s, r) => s + Number(r.amount), 0);
  const unlinkedOut = unlinked.filter(r => Number(r.amount) < 0).reduce((s, r) => s - Number(r.amount), 0);

  // Oxirgi xarid vaqti (createdAt yoki id timestamp bo'yicha)
  const lastSaleAt = sales.reduce((mx, r) => Math.max(mx, Number(r.createdAt || r.id || 0)), 0);

  return {
    sales, debts, advs, orders,
    totalTon, totalXarid,
    totalQarz, totalTolandi, qolganQarz, ortiqchaTolov,
    totalAvans, qolganAvans, balans,
    lastSaleAt,
    salesCount: sales.length,
    unlinked, unlinkedIn, unlinkedOut,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BARCHA MIJOZLAR uchun bir o'tishda hisoblash.
//
// customerSummary() bitta mijoz uchun har chaqiruvda BARCHA ro'yxatlarni
// boshidan oxirigacha aylanadi. Mijozlar sahifasi uni har mijoz uchun ikki
// marta chaqirardi (ro'yxat + umumiy statistika): 420 mijozda bu ~750 ms
// bo'lib, har harf yozilganda sahifa qotib qolardi.
//
// Bu yerda har ro'yxat FAQAT BIR MARTA aylanib, yozuvlar mijoz kaliti bo'yicha
// guruhlanadi — keyin har mijoz o'z guruhini oladi. Natija customerSummary
// bilan bir xil (testlar shuni tekshiradi), lekin vaqt O(N·M) emas O(N+M).
//
// Kalit: yozuvda customerId bo'lsa "#id", bo'lmasa normallashtirilgan ism.
// Mijoz ikkala kalitdan ham yozuv oladi — eski (id'siz) yozuvlar nom bo'yicha
// topilishi kerak, bu rowIsCust() qoidasi bilan bir xil.
// ─────────────────────────────────────────────────────────────────────────────
const rowKey = (r) => (r && r.customerId != null) ? `#${r.customerId}` : nameKey(r && r.customer);

function groupByCustomer(rows, mapFn) {
  const m = new Map();
  for (const r of (rows || [])) {
    const k = rowKey(r);
    if (!k) continue;
    const v = mapFn ? mapFn(r) : r;
    if (v === null) continue;
    const arr = m.get(k);
    if (arr) arr.push(v); else m.set(k, [v]);
  }
  return m;
}

// Mijozning ikkala kalitiga tegishli yozuvlarni birlashtirish
const pick = (map, idKey, nmKey) => {
  const a = map.get(idKey);
  const b = idKey === nmKey ? null : map.get(nmKey);
  if (a && b) return [...a, ...b];
  return a || b || [];
};

export function customerSummaryAll(data) {
  const {
    salesRows = [], soldRows = [], debtRows = [],
    advanceRows = [], tgOrders = [], skladRows = [],
    cashRows = [], bankRows = [], clickRows = [],
    bankIncomeRows = [], bankExpenseRows = [], customers = [],
  } = data || {};

  const gSales = groupByCustomer([...salesRows, ...soldRows]);
  const gDebts = groupByCustomer(debtRows);
  const gAdvs  = groupByCustomer(advanceRows);
  const gOrd   = groupByCustomer(tgOrders);
  const gSklad = groupByCustomer(skladRows, r => {
    if (r.type !== 'chiqim') return null;
    const kg = Math.abs(Number(r.kg || 0));
    return { ...r, tons: kg / 1000, pricePerTon: Number(r.pricePerKg || 0) * 1000, paymentChannel: r.channel, _sklad: true };
  });
  const gUnlinked = groupByCustomer([
    ...cashRows.map(r => ({ ...r, _ch: 'naqd' })),
    ...bankRows.map(r => ({ ...r, _ch: 'bank' })),
    ...clickRows.map(r => ({ ...r, _ch: 'click' })),
    ...bankIncomeRows.map(r => ({ ...r, _ch: 'bank', amount: Math.abs(Number(r.amount || 0)) })),
    ...bankExpenseRows.map(r => ({ ...r, _ch: 'bank', amount: -Math.abs(Number(r.amount || 0)) })),
  ], r => (r.auto ? null : r));

  const out = new Map();
  for (const c of customers) {
    const idKey = c.id != null ? `#${c.id}` : nameKey(c.name);
    const nmKey = nameKey(c.name);

    const sales  = [...pick(gSales, idKey, nmKey), ...pick(gSklad, idKey, nmKey)];
    const debts  = pick(gDebts, idKey, nmKey);
    const advs   = pick(gAdvs,  idKey, nmKey);
    const orders = pick(gOrd,   idKey, nmKey);
    const unlinked = pick(gUnlinked, idKey, nmKey);

    const totalTon     = sales.reduce((s, r) => s + Number(r.tons || 0), 0);
    const totalXarid   = sales.reduce((s, r) => s + Number(r.tons || 0) * Number(r.pricePerTon || 0), 0);
    const totalQarz    = debts.reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalTolandi = debts.reduce((s, r) => s + Number(r.paid || 0), 0);
    // customerSummary bilan bir xil qoida (yuqoridagi izohga qarang)
    const qolganQarz   = debts.reduce((s, r) => s + Math.max(0, Number(r.amount || 0) - Number(r.paid || 0)), 0);
    const ortiqchaTolov = debts.reduce((s, r) => s + Math.max(0, Number(r.paid || 0) - Number(r.amount || 0)), 0);
    const totalAvans   = advs.reduce((s, r) => s + Number(r.amount || 0), 0);
    const qolganAvans  = advs.reduce((s, r) => s + Math.max(0, Number(r.amount || 0) - Number(r.used || 0)), 0);
    const unlinkedIn   = unlinked.reduce((s, r) => Number(r.amount) > 0 ? s + Number(r.amount) : s, 0);
    const unlinkedOut  = unlinked.reduce((s, r) => Number(r.amount) < 0 ? s - Number(r.amount) : s, 0);
    const lastSaleAt   = sales.reduce((mx, r) => Math.max(mx, Number(r.createdAt || r.id || 0)), 0);

    out.set(c.id, {
      sales, debts, advs, orders,
      totalTon, totalXarid,
      totalQarz, totalTolandi, qolganQarz, ortiqchaTolov,
      totalAvans, qolganAvans, balans: qolganAvans - qolganQarz,
      lastSaleAt,
      salesCount: sales.length,
      unlinked, unlinkedIn, unlinkedOut,
    });
  }
  return out;
}
