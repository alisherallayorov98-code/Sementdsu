// ─────────────────────────────────────────────────────────────────────────────
// ICHKI TEKSHIRUV (self-audit) — hisob-kitob butunligini tekshiradi.
//
// Dastur pulni bir necha bo'lim orqali yuritadi (sotuv → kassa → qarz → avans).
// Har amal bir nechta ro'yxatga yozadi, ya'ni ular orasida MUVOZANAT bo'lishi
// kerak. Bu modul o'sha muvozanatni tekshiradi va buzilgan joyni ko'rsatadi.
//
// Nega kerak: xato bo'lganda uni oylar o'tib, hisobot mos kelmaganda topish
// deyarli imkonsiz. Bu tekshiruv har kuni ochib ko'riladi — buzilish o'sha
// kuniyoq ko'rinadi va zaxiradan tiklash mumkin bo'ladi.
//
// Sof funksiya: state (DataContext qiymatlari) → topilmalar ro'yxati.
// Hech narsani o'zgartirmaydi, faqat o'qiydi.
// ─────────────────────────────────────────────────────────────────────────────
// .js kengaytmasi bilan — shunda modul Vite'da ham, Node testlarida ham
// (node --test) bir xil yuklanadi.
import { nameKey } from './customerRef.js';

const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const sum = (arr, f) => (arr || []).reduce((s, x) => s + num(f(x)), 0);
const money = (n) => Math.round(num(n)).toLocaleString('ru-RU');
// Pul taqqoslashda 1 so'mdan kichik farq — yaxlitlash qoldig'i, xato emas.
const EPS = 1;

// level: 'xato' — hisob buzilgan, darhol qarash kerak
//        'ogoh' — shubhali, lekin xato bo'lmasligi mumkin
const F = (level, code, title, detail) => ({ level, code, title, detail });

export function auditState(state = {}) {
  const {
    debtRows = [], advanceRows = [], salesRows = [], soldRows = [],
    cashRows = [], bankRows = [], clickRows = [],
    incomeRows = [], expenseRows = [],
    bankIncomeRows = [], bankExpenseRows = [],
    clickIncomeRows = [], clickExpenseRows = [],
    workers = [], salaryPayments = [], customers = [],
    skladRows = [], recvRows = [], supplierPayments = [], driverTrips = [],
    totalCashBalance = 0, totalBankBalance = 0, totalClickBalance = 0,
    totalSkladKg = 0, cementBalanceByType = {},
  } = state;

  const out = [];

  // ── 1. Qarz: paid = to'lovlar yig'indisi ─────────────────────────────────
  // Bu ikkalasi har doim birga o'zgaradi (payDebt, payCustomerDebt). Farq
  // bo'lsa — birlashtirish yoki qo'lda tahrir hisobni buzgan.
  const debtMismatch = debtRows.filter(r => {
    const p = sum(r.payments, x => x.amount);
    return Math.abs(p - num(r.paid)) > EPS;
  });
  if (debtMismatch.length) {
    out.push(F('xato', 'debt-paid-mismatch',
      `${debtMismatch.length} ta qarzda "to'langan" summa to'lovlar ro'yxatiga mos emas`,
      debtMismatch.slice(0, 5).map(r =>
        `${r.customer || '—'}: yozilgan ${money(r.paid)}, to'lovlar yig'indisi ${money(sum(r.payments, x => x.amount))}`
      )));
  }

  // ── 2. Qarzdan ortiq to'lov ──────────────────────────────────────────────
  // Qoldiq Math.max(0,…) bilan hisoblanadi, ya'ni ortiqcha summa hech qaysi
  // bo'limda ko'rinmay "yo'qoladi".
  const overpaid = debtRows.filter(r => num(r.paid) - num(r.amount) > EPS);
  if (overpaid.length) {
    out.push(F('xato', 'debt-overpaid',
      `${overpaid.length} ta qarzga summasidan ORTIQ to'lov qayd etilgan`,
      overpaid.slice(0, 5).map(r =>
        `${r.customer || '—'}: qarz ${money(r.amount)}, to'langan ${money(r.paid)} (ortiqcha ${money(num(r.paid) - num(r.amount))})`
      )));
  }

  // ── 3. Avans: used = sarflar yig'indisi, va avansdan ortiq sarf ───────────
  const advMismatch = advanceRows.filter(r =>
    Math.abs(sum(r.usages, x => x.amount) - num(r.used)) > EPS);
  if (advMismatch.length) {
    out.push(F('xato', 'advance-used-mismatch',
      `${advMismatch.length} ta avansda "ishlatilgan" summa sarflar ro'yxatiga mos emas`,
      advMismatch.slice(0, 5).map(r =>
        `${r.customer || '—'}: yozilgan ${money(r.used)}, sarflar ${money(sum(r.usages, x => x.amount))}`)));
  }
  const advOver = advanceRows.filter(r => num(r.used) - num(r.amount) > EPS);
  if (advOver.length) {
    out.push(F('xato', 'advance-overused',
      `${advOver.length} ta avansda summasidan ORTIQ sarf`,
      advOver.slice(0, 5).map(r => `${r.customer || '—'}: avans ${money(r.amount)}, sarflangan ${money(r.used)}`)));
  }

  // ── 4. Xodim oyligi: paid = to'lovlar yig'indisi ─────────────────────────
  const paidByWorker = new Map();
  salaryPayments.forEach(p => {
    if (p && p.workerId !== undefined)
      paidByWorker.set(p.workerId, (paidByWorker.get(p.workerId) || 0) + num(p.amount));
  });
  const wMismatch = workers.filter(w =>
    Math.abs((paidByWorker.get(w.id) || 0) - num(w.paid)) > EPS);
  if (wMismatch.length) {
    out.push(F('xato', 'worker-paid-mismatch',
      `${wMismatch.length} ta xodimda "to'langan oylik" to'lovlar ro'yxatiga mos emas`,
      wMismatch.slice(0, 5).map(w =>
        `${w.name}: yozilgan ${money(w.paid)}, to'lovlar ${money(paidByWorker.get(w.id) || 0)}`)));
  }

  // ── 5. Takrorlangan id ───────────────────────────────────────────────────
  // Bir xil id'li ikki yozuv — bittasini o'chirsa ikkalasi ham o'chadi.
  const dupSets = [
    ['Qarzlar', debtRows], ['Avanslar', advanceRows], ['Sotuvlar', salesRows],
    ['Eski sotuvlar', soldRows], ['Naqd kassa', cashRows], ['Bank', bankRows],
    ['Click', clickRows], ['Kirim', incomeRows], ['Chiqim', expenseRows],
    ['Mijozlar', customers], ['Sklad', skladRows], ['Olingan tonna', recvRows],
    ['Oylik to\'lovlari', salaryPayments],
  ];
  const dupDetail = [];
  for (const [label, rows] of dupSets) {
    const seen = new Set(), dup = new Set();
    (rows || []).forEach(r => { if (r && r.id !== undefined) { if (seen.has(r.id)) dup.add(r.id); else seen.add(r.id); } });
    if (dup.size) dupDetail.push(`${label}: ${dup.size} ta (${[...dup].slice(0, 3).join(', ')})`);
  }
  if (dupDetail.length) {
    out.push(F('xato', 'duplicate-id', 'Takrorlangan id topildi (bittasini o\'chirsa ikkalasi o\'chadi)', dupDetail));
  }

  // ── 6. Manfiy summalar ───────────────────────────────────────────────────
  const negChecks = [
    ['Qarz', debtRows.filter(r => num(r.amount) < 0)],
    ['Avans', advanceRows.filter(r => num(r.amount) < 0)],
    ['Sotuv (tonna)', salesRows.filter(r => num(r.tons) < 0)],
    ['Eski sotuv (tonna)', soldRows.filter(r => num(r.tons) < 0)],
    ['Olingan tonna', recvRows.filter(r => num(r.tons) < 0)],
  ];
  const negDetail = negChecks.filter(([, rows]) => rows.length)
    .map(([label, rows]) => `${label}: ${rows.length} ta`);
  if (negDetail.length) {
    out.push(F('xato', 'negative-amount', 'Manfiy summa/tonna topildi (hisobotni teskari buzadi)', negDetail));
  }

  // ── 7. Yetim avtomatik yozuvlar ──────────────────────────────────────────
  // auto yozuv o'z manbasi bilan birga o'chishi kerak. Manba yo'q bo'lsa —
  // kassada egasiz pul qolgan.
  const saleIds  = new Set(salesRows.map(r => r.id));
  const soldIds  = new Set(soldRows.map(r => r.id));
  const skladIds = new Set(skladRows.map(r => r.id));
  // Qolgan turlar ham tekshiriladi. Ilgari ular `return false` bilan
  // o'tkazib yuborilardi — ya'ni o'chirilgan oylik/zavod to'lovi/haydovchi
  // avansi/avansdan qolgan kassa yozuvi kassada egasiz turib, qoldiqni
  // buzsa ham tekshiruv "toza" deb ko'rsatardi.
  const salaryIds = new Set(salaryPayments.map(p => `${p.workerId}_s${p.id}`));
  const supIds    = new Set(supplierPayments.map(p => p.id));
  const driverIds = new Set(driverTrips.filter(t => t.isPayment).map(t => t.id));
  const advIds    = new Set(advanceRows.map(r => r.id));
  const orphan = [...cashRows, ...bankRows, ...clickRows, ...debtRows].filter(r => {
    if (!r || !r.auto) return false;
    if (r.sourceType === 'sale')             return !saleIds.has(r.sourceId);
    if (r.sourceType === 'sold')             return !soldIds.has(r.sourceId);
    if (r.sourceType === 'sklad_sale')       return !skladIds.has(r.sourceId);
    if (r.sourceType === 'salary')           return !salaryIds.has(r.sourceId);
    if (r.sourceType === 'supplier_payment') return !supIds.has(r.sourceId);
    if (r.sourceType === 'driver')           return !driverIds.has(r.sourceId);
    if (r.sourceType === 'advance')          return !advIds.has(r.sourceId);
    // debt_payment sourceId ikki xil formatda ("<qarzId>_p<ts>" va
    // "<mijoz>_pc<ts>") — u 1-tekshiruv (paid = to'lovlar yig'indisi)
    // orqali allaqachon nazorat qilinadi.
    return false;
  });
  if (orphan.length) {
    out.push(F('xato', 'orphan-auto-row',
      `${orphan.length} ta avtomatik yozuvning manbasi yo'q (sotuv o'chirilgan, yozuv qolgan)`,
      orphan.slice(0, 5).map(r => `${r.desc || r.note || r.sourceType}: ${money(r.amount)}`)));
  }

  // ── 8. Manfiy qoldiqlar ──────────────────────────────────────────────────
  const negBal = [];
  if (num(totalCashBalance)  < -EPS) negBal.push(`Naqd kassa: ${money(totalCashBalance)}`);
  if (num(totalBankBalance)  < -EPS) negBal.push(`Bank: ${money(totalBankBalance)}`);
  if (num(totalClickBalance) < -EPS) negBal.push(`Click: ${money(totalClickBalance)}`);
  if (num(totalSkladKg)      < -0.001) negBal.push(`Sklad (chakana): ${num(totalSkladKg).toFixed(1)} kg`);
  if (negBal.length) {
    out.push(F('ogoh', 'negative-balance',
      'Qoldiq manfiy — boshlang\'ich qoldiq kiritilmagan yoki chiqim ortiqcha yozilgan', negBal));
  }
  const negCement = Object.entries(cementBalanceByType || {})
    .filter(([, v]) => num(v) < -0.001)
    .map(([k, v]) => `${k}: ${num(v).toFixed(2)} tn`);
  if (negCement.length) {
    out.push(F('ogoh', 'negative-cement',
      'Sement qoldig\'i manfiy — olingandan ko\'p sotilgan ko\'rinadi', negCement));
  }

  // ── 9. Mijozlar bazasida yo'q nomlar ─────────────────────────────────────
  // Qarz/avans mijozga NOMI orqali ham bog'lanadi. Bazada yo'q nom — qidiruvda
  // va kartochkalarda to'liq ko'rinmaydi.
  const known = new Set(customers.map(c => nameKey(c.name)));
  const unknown = new Map();
  [...debtRows, ...advanceRows].forEach(r => {
    const k = nameKey(r.customer);
    if (k && !known.has(k)) unknown.set(k, r.customer);
  });
  if (unknown.size) {
    out.push(F('ogoh', 'unknown-customer',
      `${unknown.size} ta mijoz qarz/avansda bor, lekin mijozlar bazasida yo'q`,
      [...unknown.values()].slice(0, 8)));
  }

  // ── 10. Yetkazib beruvchiga ortiqcha to'lov ──────────────────────────────
  const recvBySup = new Map(), paidBySup = new Map();
  recvRows.filter(r => !r.pending).forEach(r => {
    const k = nameKey(r.source);
    if (k) recvBySup.set(k, (recvBySup.get(k) || 0) + num(r.tons) * num(r.pricePerTon));
  });
  supplierPayments.forEach(p => {
    const k = nameKey(p.supplier);
    if (k) paidBySup.set(k, (paidBySup.get(k) || 0) + num(p.amount));
  });
  const supOver = [...paidBySup.entries()]
    .filter(([k, paid]) => paid - (recvBySup.get(k) || 0) > EPS)
    .map(([k, paid]) => `${k}: olingan ${money(recvBySup.get(k) || 0)}, to'langan ${money(paid)}`);
  if (supOver.length) {
    out.push(F('ogoh', 'supplier-overpaid',
      'Yetkazib beruvchiga olingan yukdan ortiq to\'langan (oldindan to\'lov bo\'lishi mumkin)',
      supOver.slice(0, 5)));
  }

  // ── 11. Mijozlar bazasida takrorlangan nom ───────────────────────────────
  // Yangi yozuv har doim BIRINCHI topilgan mijozga bog'lanadi, ya'ni
  // ikkinchisi hech qachon savdo ko'rmaydi va kartochkasi bo'sh turadi.
  // Import orqali bunday dublikat paydo bo'lishi mumkin.
  const custByKey = new Map();
  customers.forEach(c => {
    const k = nameKey(c.name);
    if (!k) return;
    custByKey.set(k, (custByKey.get(k) || 0) + 1);
  });
  const dupCust = [...custByKey.entries()].filter(([, n]) => n > 1);
  if (dupCust.length) {
    out.push(F('ogoh', 'duplicate-customer',
      `${dupCust.length} ta mijoz nomi bazada TAKRORLANGAN`,
      dupCust.slice(0, 8).map(([k, n]) => `${k} — ${n} ta yozuv`)));
  }

  // ── 12. Yukdan chiqarilgan sement kelganidan oshmasligi kerak ────────────
  // Har bir yuk (recvRow) ikki yo'l bilan sarflanadi: taqsimlashda mijozga
  // sotuv (salesRows.recvId) va chakana skladga o'tkazma (skladRows.sourceId).
  // Ikkalasining yig'indisi yuk tonnasidan oshsa — sement YO'QDAN paydo
  // bo'lgan: qoldiq Math.max(0,…) ostida nolda ushlanib, farq hech qaysi
  // hisobotda ko'rinmaydi.
  const soldByRecv = new Map();
  salesRows.forEach(s => {
    if (s && s.recvId != null) soldByRecv.set(s.recvId, (soldByRecv.get(s.recvId) || 0) + num(s.tons));
  });
  const skladByRecv = new Map();
  skladRows.forEach(r => {
    if (r && r.type === 'kirim' && r.sourceId != null)
      skladByRecv.set(r.sourceId, (skladByRecv.get(r.sourceId) || 0) + num(r.kg) / 1000);
  });
  const overUsed = recvRows.filter(r => {
    const used = (soldByRecv.get(r.id) || 0) + (skladByRecv.get(r.id) || 0);
    return used - num(r.tons) > 0.001;
  });
  if (overUsed.length) {
    out.push(F('xato', 'recv-over-used',
      `${overUsed.length} ta yukdan kelganidan KO'PROQ sement chiqarilgan`,
      overUsed.slice(0, 5).map(r => {
        const sold = soldByRecv.get(r.id) || 0, skl = skladByRecv.get(r.id) || 0;
        return `${r.source || '—'} ${r.vehicleNo || ''}: kelgan ${num(r.tons).toFixed(2)} tn, chiqarilgan ${(sold + skl).toFixed(2)} tn (sotuv ${sold.toFixed(2)} + sklad ${skl.toFixed(2)})`;
      })));
  }

  // Tasdiqlanmagan (pending) yukdan sotuv qilingan bo'lsa — tartib buzilgan:
  // yuk hali qabul qilinmagan, lekin undan sotuv bor.
  const pendingWithSale = recvRows.filter(r => r.pending && (soldByRecv.get(r.id) || 0) > 0);
  if (pendingWithSale.length) {
    out.push(F('ogoh', 'pending-recv-sold',
      `${pendingWithSale.length} ta TASDIQLANMAGAN yukdan sotuv qilingan`,
      pendingWithSale.slice(0, 5).map(r => `${r.source || '—'} ${r.vehicleNo || ''}: ${num(r.tons).toFixed(2)} tn`)));
  }

  // ── 13. Kanallararo o'tkazma muvozanati ──────────────────────────────────
  // O'tkazma ikkita yozuv yaratadi: manbadan chiqim (−X) va maqsadga kirim
  // (+X). Ikkalasi bitta transferId bilan bog'lanadi va yig'indisi 0 bo'lishi
  // shart. Nolga teng bo'lmasa — bir tomoni tahrirlangan yoki o'chirilgan,
  // ya'ni umumiy kassada pul yo'qdan paydo bo'lgan yoki yo'qolgan.
  const trById = new Map();
  [...cashRows, ...bankRows, ...clickRows].forEach(r => {
    if (!r || !r.transferId) return;
    const g = trById.get(r.transferId) || { sum: 0, n: 0, desc: r.desc };
    g.sum += num(r.amount); g.n += 1;
    trById.set(r.transferId, g);
  });
  const trBad = [...trById.entries()]
    .filter(([, g]) => g.n !== 2 || Math.abs(g.sum) > EPS)
    .map(([id, g]) => g.n !== 2
      ? `${g.desc || id}: juftlikning ${g.n} tomoni bor (2 bo'lishi kerak)`
      : `${g.desc || id}: farq ${money(g.sum)} so'm`);
  if (trBad.length) {
    out.push(F('xato', 'transfer-unbalanced',
      "Kanallararo o'tkazmada muvozanat buzilgan (pul yo'qdan paydo bo'lgan yoki yo'qolgan)",
      trBad.slice(0, 5)));
  }

  // ── 14. Buzuq sana ───────────────────────────────────────────────────────
  // Sana "kk.oo.yyyy" satri sifatida saqlanadi va filtr shu formatga tayanadi.
  // Format buzilgan yozuv HECH QAYSI kunlik/oylik hisobotga to'g'ri tushmaydi,
  // lekin ro'yxatda ko'rinib turadi — ya'ni jami summalar mos kelmay qoladi.
  const badDate = [];
  const dateSets = [
    ['Qarzlar', debtRows], ['Avanslar', advanceRows], ['Sotuvlar', salesRows],
    ['Eski sotuvlar', soldRows], ['Naqd kassa', cashRows], ['Bank', bankRows],
    ['Click', clickRows], ['Kirim', incomeRows], ['Chiqim', expenseRows],
    ['Olingan tonna', recvRows], ['Sklad', skladRows],
    ['Bank kirim', bankIncomeRows], ['Bank chiqim', bankExpenseRows],
    ['Click kirim', clickIncomeRows], ['Click chiqim', clickExpenseRows],
  ];
  for (const [label, rows] of dateSets) {
    const bad = (rows || []).filter(r => {
      if (!r || r.date === undefined || r.date === '') return false;
      const p = String(r.date).split('.');
      if (p.length !== 3) return true;
      const [d, m, y] = p.map(Number);
      // Yil 4 xonali bo'lishi shart: "23.06.26" → 1926 yil bo'lib ketardi
      return !(d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2999);
    });
    if (bad.length) badDate.push(`${label}: ${bad.length} ta (${bad.slice(0, 2).map(r => r.date).join(', ')})`);
  }
  if (badDate.length) {
    out.push(F('xato', 'bad-date',
      'Sanasi noto\'g\'ri yozuvlar — ular kunlik/oylik hisobotlarga tushmaydi', badDate));
  }

  // ── 15. Bank/Click sahifasidagi qoldiq to'liq balansga mos keladimi ──────
  // bankNetBalance faqat Kirim/Chiqim Bank sahifasi yozuvlarini oladi,
  // totalBankBalance esa avtomatik yozuvlarni ham. Farq bo'lishi normal —
  // bu tekshiruv emas, ma'lumot uchun quyida "xulosa" da beriladi.

  return out;
}

// Qisqa xulosa — sahifada yuqorida ko'rsatish uchun
export function auditSummary(findings) {
  const xato = findings.filter(f => f.level === 'xato').length;
  const ogoh = findings.filter(f => f.level === 'ogoh').length;
  return { xato, ogoh, toza: xato === 0 && ogoh === 0 };
}
