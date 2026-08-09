// ─────────────────────────────────────────────────────────────────────────────
// AVTOMATIK ARXIV — qaysi ma'lumot, qaysi ustunlar bilan chiqadi.
//
// MAQSAD: mijozning o'z kompyuterida (masalan D:\sementchi.uz) butun tarix
// yil / oy / kun bo'yicha ajratilgan Excel fayllarda yotishi. Server bilan
// nimadir bo'lsa ham, ish kompyuterda davom etadi — yo'qotish nari borsa
// bir kunlik bo'ladi.
//
// PRINSIP: hech narsa qisqartirilmaydi. Har bo'limning HAMMA ustuni chiqadi,
// summalar yaxlitlanmaydi (Excel o'zi ko'rsatadi), sana matn ko'rinishida
// "kk.oo.yyyy" — dasturdagi bilan aynan bir xil.
//
// Sof funksiya: state → qatorlar. DOM ham, fayl tizimi ham bu yerda yo'q,
// shuning uchun to'liq test qilinadi.
// ─────────────────────────────────────────────────────────────────────────────
import { isTransferRow } from './transferRow.js';

const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const str = (v) => (v === undefined || v === null) ? '' : String(v);

// "kk.oo.yyyy" → { d, m, y }; buzuq bo'lsa null
export function splitDate(s) {
  const p = String(s || '').split('.');
  if (p.length !== 3) return null;
  const d = Number(p[0]), m = Number(p[1]), y = Number(p[2]);
  if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2999)) return null;
  return { d, m, y };
}

export const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
];

const pad2 = (n) => String(n).padStart(2, '0');

// Kanal nomi — kassa yozuvi qaysi ro'yxatdan kelganini ko'rsatish uchun
const CH_LABEL = { naqd: 'Naqd', bank: 'Bank', click: 'Click', nasiya: 'Nasiya (qarz)', avans: 'Avans' };

// Avtomatik yozuv manbasi — odam o'qiy oladigan nom
const SRC_LABEL = {
  sale: 'Sotuv', sold: 'Sotuv (eski)', sklad_sale: 'Sklad sotuvi (kg)',
  debt_payment: "Qarz to'lovi", advance: 'Avans', salary: 'Oylik',
  supplier_payment: "Zavodga to'lov", driver: "Haydovchi to'lovi", recv: 'Sement olish',
};

// Kassa/bank/click qatori uchun umumiy ustunlar
const channelColumns = (chName) => [
  { header: 'Sana',        get: r => str(r.date) },
  { header: 'Vaqt',        get: r => timeOf(r.createdAt) },
  { header: 'Kanal',       get: () => chName },
  { header: 'Turi',        get: r => num(r.amount) >= 0 ? 'Kirim' : 'Chiqim' },
  { header: "Summa (so'm)", get: r => Math.abs(num(r.amount)) },
  { header: 'Mijoz',       get: r => str(r.customer) },
  { header: 'Izoh',        get: r => str(r.desc) },
  { header: 'Xarajat turi', get: r => str(r.expenseType) },
  { header: 'Xodim',       get: r => str(r.worker) },
  { header: 'Manba',       get: r => r.auto ? (SRC_LABEL[r.sourceType] || str(r.sourceType)) : "Qo'lda kiritilgan" },
  { header: "O'tkazma",    get: r => isTransferRow(r) ? 'Ha' : '' },
  { header: 'ID',          get: r => str(r.id) },
];

function timeOf(ts) {
  const t = Number(ts);
  if (!isFinite(t) || t < 1e10) return '';
  const d = new Date(t);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// BO'LIMLAR. Har biri Excel'da alohida varaq bo'ladi.
//   key     — ichki nom
//   sheet   — varaq nomi (Excel cheklovi: 31 belgi, : \ / ? * [ ] yo'q)
//   rows    — state dan qatorlarni oladi
//   date    — qatorning sanasi (guruhlash uchun)
//   columns — ustunlar
//   period  — false bo'lsa davrga bog'liq emas (reyestr: mijozlar, xodimlar)
// ─────────────────────────────────────────────────────────────────────────────
export const SECTIONS = [
  {
    key: 'kassa', sheet: 'Kassa (naqd)',
    rows: d => d.cashRows || [], date: r => r.date,
    columns: channelColumns('Naqd'),
  },
  {
    key: 'bank', sheet: 'Bank',
    rows: d => d.bankRows || [], date: r => r.date,
    columns: channelColumns('Bank'),
  },
  {
    key: 'click', sheet: 'Click',
    rows: d => d.clickRows || [], date: r => r.date,
    columns: channelColumns('Click'),
  },
  {
    key: 'sotuv', sheet: 'Sotuv',
    rows: d => d.salesRows || [], date: r => r.date,
    columns: [
      { header: 'Sana',          get: r => str(r.date) },
      { header: 'Vaqt',          get: r => timeOf(r.createdAt) },
      { header: 'Mijoz',         get: r => str(r.customer) },
      { header: 'Tonna',         get: r => num(r.tons) },
      { header: "Narx (1 tn)",   get: r => num(r.pricePerTon) },
      { header: "Jami (so'm)",   get: r => num(r.tons) * num(r.pricePerTon) },
      { header: "To'lov turi",   get: r => CH_LABEL[r.paymentChannel] || str(r.paymentChannel) },
      { header: 'Avansdan',      get: r => num(r.advanceUsed) },
      { header: 'Mashina',       get: r => str(r.vehicleNo) },
      { header: 'Sklad',         get: r => str(r.warehouseId) },
      { header: 'Izoh',          get: r => str(r.note) },
      { header: 'Xodim',         get: r => str(r.worker) },
      { header: 'ID',            get: r => str(r.id) },
    ],
  },
  {
    key: 'sotuv_eski', sheet: 'Sotuv (eski bolim)',
    rows: d => d.soldRows || [], date: r => r.date,
    columns: [
      { header: 'Sana',        get: r => str(r.date) },
      { header: 'Mijoz',       get: r => str(r.customer) },
      { header: 'Tonna',       get: r => num(r.tons) },
      { header: "Narx (1 tn)", get: r => num(r.pricePerTon) },
      { header: "Jami (so'm)", get: r => num(r.tons) * num(r.pricePerTon) },
      { header: "To'lov turi", get: r => CH_LABEL[r.paymentChannel] || str(r.paymentChannel) },
      { header: 'Izoh',        get: r => str(r.izoh) },
      { header: 'Xodim',       get: r => str(r.worker) },
      { header: 'ID',          get: r => str(r.id) },
    ],
  },
  {
    key: 'olingan', sheet: 'Olingan tonna',
    rows: d => d.recvRows || [], date: r => r.date,
    columns: [
      { header: 'Sana',          get: r => str(r.date) },
      { header: 'Zavod / manba', get: r => str(r.source) },
      { header: 'Marka',         get: r => str(r.brand) },
      { header: 'Tur',           get: r => str(r.cementType) },
      { header: 'Mashina',       get: r => str(r.vehicleNo) },
      { header: 'Zavod vaqti',   get: r => str(r.factoryTime) },
      { header: 'Tonna',         get: r => num(r.tons) },
      { header: "Narx (1 tn)",   get: r => num(r.pricePerTon) },
      { header: "Jami (so'm)",   get: r => num(r.tons) * num(r.pricePerTon) },
      { header: 'Karta',         get: r => str(r.cardName) },
      { header: 'Holati',        get: r => r.pending ? 'TASDIQLANMAGAN' : 'Tasdiqlangan' },
      { header: 'Sklad',         get: r => str(r.warehouseId) },
      { header: 'Izoh',          get: r => str(r.izoh) },
      { header: 'Xodim',         get: r => str(r.worker) },
      { header: 'ID',            get: r => str(r.id) },
    ],
  },
  {
    key: 'qarz', sheet: 'Qarzlar',
    rows: d => d.debtRows || [], date: r => r.date,
    columns: [
      { header: 'Sana',           get: r => str(r.date) },
      { header: 'Mijoz',          get: r => str(r.customer) },
      { header: "Qarz (so'm)",    get: r => num(r.amount) },
      { header: "To'langan",      get: r => num(r.paid) },
      { header: 'Qoldiq',         get: r => Math.max(0, num(r.amount) - num(r.paid)) },
      { header: "To'lovlar soni", get: r => (r.payments || []).length },
      { header: 'Izoh',           get: r => str(r.note) },
      { header: 'Manba',          get: r => r.auto ? (SRC_LABEL[r.sourceType] || str(r.sourceType)) : "Qo'lda kiritilgan" },
      { header: 'Xodim',          get: r => str(r.worker) },
      { header: 'ID',             get: r => str(r.id) },
    ],
  },
  {
    // Qarz to'lovlari qator ichida (payments) yotadi — ular ALOHIDA varaqqa
    // yoyiladi, aks holda to'lov tarixi Excel'da umuman ko'rinmasdi.
    key: 'qarz_tolov', sheet: 'Qarz tolovlari',
    rows: d => (d.debtRows || []).flatMap(r =>
      (r.payments || []).map(p => ({ ...p, _debtId: r.id, _customer: r.customer, _debtNote: r.note }))),
    date: r => r.date,
    columns: [
      { header: 'Sana',        get: r => str(r.date) },
      { header: 'Mijoz',       get: r => str(r._customer) },
      { header: "Summa (so'm)", get: r => num(r.amount) },
      { header: 'Kanal',       get: r => CH_LABEL[r.channel] || str(r.channel) },
      { header: 'Izoh',        get: r => str(r.note) },
      { header: 'Qaysi qarz',  get: r => str(r._debtNote) },
      { header: 'Xodim',       get: r => str(r.worker) },
      { header: 'Qarz ID',     get: r => str(r._debtId) },
      { header: "To'lov ID",   get: r => str(r.id) },
    ],
  },
  {
    key: 'avans', sheet: 'Avanslar',
    rows: d => d.advanceRows || [], date: r => r.date,
    columns: [
      { header: 'Sana',          get: r => str(r.date) },
      { header: 'Mijoz',         get: r => str(r.customer) },
      { header: "Avans (so'm)",  get: r => num(r.amount) },
      { header: 'Ishlatildi',    get: r => num(r.used) },
      { header: 'Qolgan',        get: r => Math.max(0, num(r.amount) - num(r.used)) },
      { header: 'Sarflar soni',  get: r => (r.usages || []).length },
      { header: 'Izoh',          get: r => str(r.note) },
      { header: 'Xodim',         get: r => str(r.worker) },
      { header: 'ID',            get: r => str(r.id) },
    ],
  },
  {
    key: 'avans_sarf', sheet: 'Avans sarflari',
    rows: d => (d.advanceRows || []).flatMap(r =>
      (r.usages || []).map(u => ({ ...u, _advId: r.id, _customer: r.customer }))),
    date: r => r.date,
    columns: [
      { header: 'Sana',        get: r => str(r.date) },
      { header: 'Mijoz',       get: r => str(r._customer) },
      { header: "Summa (so'm)", get: r => num(r.amount) },
      { header: 'Izoh',        get: r => str(r.note) },
      { header: 'Sotuv ID',    get: r => str(r.saleId) },
      { header: 'Avans ID',    get: r => str(r._advId) },
    ],
  },
  {
    key: 'sklad', sheet: 'Sklad (chakana kg)',
    rows: d => d.skladRows || [], date: r => r.date,
    columns: [
      { header: 'Sana',        get: r => str(r.date) },
      { header: 'Turi',        get: r => r.type === 'kirim' ? 'Kirim' : 'Sotuv' },
      { header: 'Kilogramm',   get: r => num(r.kg) },
      { header: 'Sement turi', get: r => str(r.cementType) },
      { header: 'Mijoz',       get: r => str(r.customer) },
      { header: 'Narx (1 kg)', get: r => num(r.pricePerKg) },
      { header: "Summa (so'm)", get: r => num(r.amount) },
      { header: "To'lov turi", get: r => CH_LABEL[r.channel] || str(r.channel) },
      { header: 'Izoh',        get: r => str(r.note || r.desc) },
      { header: 'Xodim',       get: r => str(r.worker) },
      { header: 'ID',          get: r => str(r.id) },
    ],
  },
  {
    key: 'zavod_tolov', sheet: 'Zavodga tolov',
    rows: d => d.supplierPayments || [], date: r => r.date,
    columns: [
      { header: 'Sana',         get: r => str(r.date) },
      { header: 'Zavod / manba', get: r => str(r.supplier) },
      { header: "Summa (so'm)", get: r => num(r.amount) },
      { header: 'Kanal',        get: r => CH_LABEL[r.channel] || str(r.channel) },
      { header: 'Izoh',         get: r => str(r.note) },
      { header: 'Xodim',        get: r => str(r.worker) },
      { header: 'ID',           get: r => str(r.id) },
    ],
  },
  {
    key: 'oylik', sheet: 'Oylik tolovlari',
    rows: d => (d.salaryPayments || []).map(p => ({
      ...p, _worker: (d.workers || []).find(w => w.id === p.workerId)?.name || '',
    })),
    date: r => r.date,
    columns: [
      { header: 'Sana',        get: r => str(r.date) },
      { header: 'Xodim',       get: r => str(r._worker) },
      { header: "Summa (so'm)", get: r => num(r.amount) },
      { header: 'Kanal',       get: r => CH_LABEL[r.channel] || str(r.channel) },
      { header: 'Izoh',        get: r => str(r.note) },
      { header: 'Kim to\'ladi', get: r => str(r.paidBy) },
      { header: 'ID',          get: r => str(r.id) },
    ],
  },
  {
    key: 'haydovchi', sheet: 'Haydovchi qatnovlari',
    rows: d => (d.driverTrips || []).map(t => ({
      ...t, _driver: (d.drivers || []).find(x => x.id === t.driverId)?.name || '',
    })),
    date: r => r.date,
    columns: [
      { header: 'Sana',         get: r => str(r.date) },
      { header: 'Haydovchi',    get: r => str(r._driver) },
      { header: 'Turi',         get: r => r.isPayment ? "To'lov (avans)" : 'Reys' },
      { header: 'Yo\'nalish',   get: r => str(r.destination) },
      { header: "Summa (so'm)", get: r => num(r.price) },
      { header: 'Kanal',        get: r => CH_LABEL[r.channel] || str(r.channel) },
      { header: 'Izoh',         get: r => str(r.note) },
      { header: 'ID',           get: r => str(r.id) },
    ],
  },
  {
    key: 'zakaz', sheet: 'Telegram zakazlar',
    rows: d => d.tgOrders || [], date: r => r.date,
    columns: [
      { header: 'Sana',   get: r => str(r.date) },
      { header: 'Mijoz',  get: r => str(r.customer) },
      { header: 'Tonna',  get: r => num(r.tons) },
      { header: 'Holati', get: r => str(r.status) },
      { header: 'Izoh',   get: r => str(r.note) },
      { header: 'Xodim',  get: r => str(r.worker) },
      { header: 'ID',     get: r => str(r.id) },
    ],
  },
  {
    key: 'kunlik_ish', sheet: 'Kunlik ish',
    rows: d => d.dailyWorkRows || [], date: r => r.date,
    columns: [
      { header: 'Sana',  get: r => str(r.date) },
      { header: 'Izoh',  get: r => str(r.desc || r.note) },
      { header: 'Xodim', get: r => str(r.worker) },
      { header: 'ID',    get: r => str(r.id) },
    ],
  },

  // ── Davrga bog'liq bo'lmagan reyestrlar (00-UMUMIY papkasiga) ────────────
  {
    key: 'mijozlar', sheet: 'Mijozlar', period: false,
    rows: d => d.customers || [],
    columns: [
      { header: 'Mijoz',        get: r => str(r.name) },
      { header: 'Telefon',      get: r => str(r.phone) },
      { header: 'Manzil',       get: r => str(r.address) },
      { header: 'Izoh',         get: r => str(r.note) },
      { header: 'Nazoratda',    get: r => r.monitored ? 'Ha' : '' },
      { header: 'Telegram',     get: r => r.telegramChatId ? 'Ulangan' : '' },
      { header: 'Bot kodi',     get: r => str(r.linkCode) },
      { header: 'Qo\'shilgan',  get: r => str(r.date || '') },
      { header: 'ID',           get: r => str(r.id) },
    ],
  },
  {
    key: 'xodimlar', sheet: 'Xodimlar', period: false,
    rows: d => d.workers || [],
    columns: [
      { header: 'Xodim',        get: r => str(r.name) },
      { header: 'Lavozim',      get: r => str(r.position) },
      { header: 'Telefon',      get: r => str(r.phone) },
      { header: "Oylik (so'm)", get: r => num(r.salary) },
      { header: "Jami to'langan", get: r => num(r.paid) },
      { header: 'Rol',          get: r => str(r.role) },
      { header: 'Izoh',         get: r => str(r.note) },
      { header: 'ID',           get: r => str(r.id) },
    ],
  },
  {
    key: 'haydovchilar', sheet: 'Haydovchilar', period: false,
    rows: d => d.drivers || [],
    columns: [
      { header: 'Haydovchi', get: r => str(r.name) },
      { header: 'Mashina',   get: r => str(r.carNumber) },
      { header: 'Telefon',   get: r => str(r.phone) },
      { header: 'Telegram',  get: r => r.telegramChatId ? 'Ulangan' : '' },
      { header: 'ID',        get: r => str(r.id) },
    ],
  },
  {
    key: 'zavodlar', sheet: 'Zavodlar (manbalar)', period: false,
    rows: d => d.suppliers || [],
    columns: [
      { header: 'Nomi',    get: r => str(r.name) },
      { header: 'Telefon', get: r => str(r.phone) },
      { header: 'Manzil',  get: r => str(r.address) },
      { header: 'Izoh',    get: r => str(r.note) },
      { header: 'ID',      get: r => str(r.id) },
    ],
  },
  {
    key: 'tiketlar', sheet: 'Tiketlar', period: false,
    rows: d => d.tickets || [],
    columns: [
      { header: 'Raqami',       get: r => str(r.number) },
      { header: 'Marka',        get: r => str(r.marka) },
      { header: 'Jami tonna',   get: r => num(r.totalTonna) },
      { header: 'Ishlatilgan',  get: r => num(r.usedTonna) },
      { header: 'Qolgan',       get: r => num(r.totalTonna) - num(r.usedTonna) },
      { header: 'Holati',       get: r => str(r.status) },
      { header: 'ID',           get: r => str(r.id) },
    ],
  },
];

export const PERIOD_SECTIONS = SECTIONS.filter(s => s.period !== false);
export const REGISTRY_SECTIONS = SECTIONS.filter(s => s.period === false);

// ─────────────────────────────────────────────────────────────────────────────
// Sana bo'yicha guruhlash
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ma'lumotdagi HAMMA kunni topadi (qaysi kunda biror yozuv bo'lgan).
 * @returns {string[]} "kk.oo.yyyy" ro'yxati, eskidan yangiga
 */
export function allDays(data) {
  const set = new Set();
  for (const s of PERIOD_SECTIONS) {
    for (const r of s.rows(data)) {
      const dt = s.date(r);
      if (splitDate(dt)) set.add(dt);
    }
  }
  return [...set].sort((a, b) => {
    const A = splitDate(a), B = splitDate(b);
    return (A.y - B.y) || (A.m - B.m) || (A.d - B.d);
  });
}

/** Bitta kunning barcha bo'limlari: [{ sheet, columns, rows }] */
export function daySheets(data, day) {
  return sheetsFor(data, r => r === day);
}

/** Bir oyning barcha bo'limlari (oy = 1..12) */
export function monthSheets(data, year, month) {
  return sheetsFor(data, dt => { const p = splitDate(dt); return p && p.y === year && p.m === month; });
}

/** Bir yilning barcha bo'limlari */
export function yearSheets(data, year) {
  return sheetsFor(data, dt => { const p = splitDate(dt); return p && p.y === year; });
}

/** Davrga bog'liq bo'lmagan reyestrlar */
export function registrySheets(data) {
  return REGISTRY_SECTIONS.map(s => ({
    sheet: s.sheet,
    columns: s.columns,
    rows: s.rows(data),
  })).filter(x => x.rows.length > 0);
}

function sheetsFor(data, matchDate) {
  const out = [];
  for (const s of PERIOD_SECTIONS) {
    const rows = s.rows(data).filter(r => matchDate(s.date(r)));
    if (rows.length) out.push({ sheet: s.sheet, columns: s.columns, rows });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fayl va papka nomlari
// ─────────────────────────────────────────────────────────────────────────────
export const yearFolder  = (y) => String(y);
export const monthFolder = (m) => `${pad2(m)}-${MONTH_NAMES[m - 1]}`;
export const dayFile     = (day) => `${day}.xlsx`;                       // 09.08.2026.xlsx
export const monthFile   = (y, m) => `${y}-${pad2(m)}-OYLIK.xlsx`;
export const yearFile    = (y) => `${y}-YILLIK.xlsx`;
export const REGISTRY_FOLDER = '00-UMUMIY';
