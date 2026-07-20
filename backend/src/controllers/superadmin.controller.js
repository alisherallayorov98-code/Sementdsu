// ─────────────────────────────────────────────────────────────────────────────
// SUPERADMIN CONTROLLER — sayt egasi uchun tashkilotlarni boshqarish.
// Barcha endpointlar requireSuperadmin middleware ostida (login'dan tashqari).
// ─────────────────────────────────────────────────────────────────────────────
const bcrypt = require('bcryptjs');
const db     = require('../db');
const sa     = require('../services/superadmin.service');
const { sign } = require('../services/token.service');

const SALT_ROUNDS = 10;

const sanitizeAccount = (a) =>
  String(a || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);

// Har bir bo'limning "bo'sh" holati.
// DIQQAT: holatni {} qilib qo'yish yetarli emas — frontend hydration
// `if (remote[key] !== undefined)` sharti bilan ishlaydi, ya'ni server bo'sh
// obyekt qaytarsa brauzerdagi eski nusxa qolib, keyin serverga QAYTA yoziladi
// va tozalash o'z-o'zidan bekor bo'ladi. Shuning uchun aniq bo'sh qiymat.
const EMPTY_STATE = {
  cash_rows: [], bank_rows: [], click_rows: [],
  income_rows: [], expense_rows: [],
  bank_income_rows: [], bank_expense_rows: [], bank_pending_rows: [],
  click_income_rows: [], click_expense_rows: [],
  cash_opening:   { date: '', amount: 0 },
  bank_opening:   { date: '', amount: 0 },
  click_opening:  { date: '', amount: 0 },
  cement_opening: { date: '', tons: 0 },
  sales_rows: [], sold_rows: [], recv_rows: [], sklad_rows: [],
  debt_rows: [], advance_rows: [], supplier_payments: [], salary_payments: [],
  tg_orders: [], daily_work_rows: [], driver_trips: [], tickets: [],
};
const REF_STATE = { customers: [], suppliers: [], drivers: [] };

// ── Kirish ───────────────────────────────────────────────────────────────────
// POST /api/sa/login  { name, password }
exports.login = async (req, res) => {
  const { name, password } = req.body || {};
  if (!name || !password) {
    return res.status(400).json({ ok: false, error: 'Ism va parol kiritilishi shart' });
  }
  if (!sa.isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Superadmin serverda sozlanmagan' });
  }
  const ok = await sa.verifyPassword(name, password);
  if (!ok) return res.status(401).json({ ok: false, error: "Ism yoki parol noto'g'ri" });

  // sa:true — bu tokenni tashkilot endpointlari QABUL QILMAYDI va aksincha
  const token = sign({ sub: 'superadmin', name: String(name), sa: true });
  res.json({ ok: true, token, info: sa.info() });
};

// GET /api/sa/me
exports.me = (req, res) => res.json({ ok: true, name: req.sa.name, info: sa.info() });

// ── Tashkilotlar ro'yxati ────────────────────────────────────────────────────
// GET /api/sa/accounts
exports.listAccounts = (req, res) => {
  const accounts = db.listAccounts().map(acc => {
    const state = db.getState(acc);
    const workers = Array.isArray(state.workers) ? state.workers : [];
    const count = (k) => Array.isArray(state[k]) ? state[k].length : 0;
    const debt = (state.debt_rows || [])
      .reduce((s, r) => s + Math.max(0, Number(r.amount || 0) - Number(r.paid || 0)), 0);
    return {
      account:   acc,
      disabled:  !!state.__disabled,
      updatedAt: db.getUpdatedAt(acc),
      workers:   workers.length,
      admins:    workers.filter(w => (w.role || '') === 'admin').map(w => w.name),
      customers: count('customers'),
      sales:     count('sales_rows'),
      recv:      count('recv_rows'),
      debtTotal: debt,
    };
  });
  res.json({ ok: true, accounts });
};

// ── Yangi tashkilot ochish ───────────────────────────────────────────────────
// POST /api/sa/accounts  { account, adminName, password }
exports.createAccount = async (req, res) => {
  const account   = sanitizeAccount(req.body?.account);
  const adminName = String(req.body?.adminName || '').trim();
  const password  = String(req.body?.password || '');

  if (!account)   return res.status(400).json({ ok: false, error: 'Tashkilot nomi kiritilishi shart (faqat lotin harflari, raqam, - va _)' });
  if (!adminName) return res.status(400).json({ ok: false, error: 'Admin ismi kiritilishi shart' });
  if (password.length < 6) return res.status(400).json({ ok: false, error: "Parol kamida 6 belgi bo'lishi kerak" });
  if (db.accountExists(account)) {
    return res.status(409).json({ ok: false, error: `"${account}" tashkiloti allaqachon mavjud` });
  }

  const ts = Date.now();
  const state = {
    workers: [{
      id: ts, createdAt: ts, name: adminName,
      password: await bcrypt.hash(password, SALT_ROUNDS),
      role: 'admin', salary: 0, paid: 0,
      position: 'Boshqaruvchi', phone: '', note: '',
    }],
    warehouses:   [{ id: 'main', name: 'Asosiy sklad' }],
    cement_types: ['450 Qoplik', '550 Qoplik', '450 Rasipnoy', '550 Rasipnoy'],
    ...EMPTY_STATE, ...REF_STATE,
  };
  db.setState(account, state);
  console.log(`[SA] Yangi tashkilot: ${account} (admin: ${adminName})`);
  res.json({ ok: true, account, adminName });
};

// ── Tashkilot adminining parolini almashtirish ───────────────────────────────
// POST /api/sa/accounts/:acc/password  { workerName, password }
exports.setAccountPassword = async (req, res) => {
  const acc = sanitizeAccount(req.params.acc);
  if (!db.accountExists(acc)) return res.status(404).json({ ok: false, error: 'Tashkilot topilmadi' });

  const workerName = String(req.body?.workerName || '').trim();
  const password   = String(req.body?.password || '');
  if (password.length < 6) return res.status(400).json({ ok: false, error: "Parol kamida 6 belgi bo'lishi kerak" });

  const state = db.getState(acc);
  const workers = Array.isArray(state.workers) ? state.workers : [];
  const idx = workers.findIndex(w => String(w.name).toLowerCase() === workerName.toLowerCase());
  if (idx === -1) return res.status(404).json({ ok: false, error: `"${workerName}" nomli xodim topilmadi` });

  workers[idx].password = await bcrypt.hash(password, SALT_ROUNDS);
  state.workers = workers;
  db.setState(acc, state);
  console.log(`[SA] Parol almashtirildi: ${acc} / ${workerName}`);
  res.json({ ok: true });
};

// ── Tashkilotni to'xtatish / qayta yoqish ────────────────────────────────────
// POST /api/sa/accounts/:acc/status  { disabled }
// To'xtatilgan tashkilot xodimlari tizimga KIRA OLMAYDI (to'lov nazorati uchun).
exports.setStatus = (req, res) => {
  const acc = sanitizeAccount(req.params.acc);
  if (!db.accountExists(acc)) return res.status(404).json({ ok: false, error: 'Tashkilot topilmadi' });
  const disabled = !!req.body?.disabled;
  const state = db.getState(acc);
  state.__disabled = disabled;
  db.setState(acc, state);
  console.log(`[SA] ${acc} -> ${disabled ? 'TO\'XTATILDI' : 'yoqildi'}`);
  res.json({ ok: true, disabled });
};

// ── BAZANI TOZALASH (resetKey talab qilinadi) ────────────────────────────────
// POST /api/sa/accounts/:acc/wipe  { resetKey, keepAdmin, keepRefs }
exports.wipeAccount = async (req, res) => {
  const acc = sanitizeAccount(req.params.acc);
  if (!db.accountExists(acc)) return res.status(404).json({ ok: false, error: 'Tashkilot topilmadi' });

  // IKKINCHI BOSQICH: panelga kirgan bo'lish yetarli emas — alohida kalit kerak.
  // Sessiya o'g'irlansa ham bu kalitsiz ma'lumot o'chirilmaydi.
  const okKey = await sa.verifyResetKey(String(req.body?.resetKey || ''));
  if (!okKey) {
    console.warn(`[SA] ⚠️  ${acc} uchun NOTO'G'RI o'chirish kaliti kiritildi`);
    return res.status(403).json({ ok: false, error: "O'chirish kaliti noto'g'ri" });
  }

  const keepAdmin = req.body?.keepAdmin !== false; // standart: adminni saqlash
  const keepRefs  = !!req.body?.keepRefs;

  const backupFile = db.forceBackup(acc, 'WIPE-OLDIDAN');

  const state   = db.getState(acc);
  const workers = Array.isArray(state.workers) ? state.workers : [];
  const admins  = workers.filter(w => (w.role || '') === 'admin');

  const next = { ...state, ...EMPTY_STATE };
  if (!keepRefs) Object.assign(next, REF_STATE);
  // Adminni saqlamaslik xavfli: auth bootstrap olib tashlangan bo'lsa ham,
  // xodimsiz tashkilotga hech kim kira olmaydi va u "o'lik" qoladi.
  next.workers = keepAdmin ? admins.map(a => ({ ...a, paid: 0 })) : [];
  delete next.__disabled;

  db.setState(acc, next);
  console.warn(`[SA] 🗑  ${acc} TOZALANDI (zaxira: ${backupFile})`);
  res.json({
    ok: true,
    backupFile: require('path').basename(backupFile),
    keptAdmins: next.workers.map(w => w.name),
  });
};

// ── Tashkilotni butunlay o'chirish (arxivga ko'chirish) ──────────────────────
// POST /api/sa/accounts/:acc/delete  { resetKey }
exports.deleteAccount = async (req, res) => {
  const acc = sanitizeAccount(req.params.acc);
  if (!db.accountExists(acc)) return res.status(404).json({ ok: false, error: 'Tashkilot topilmadi' });

  const okKey = await sa.verifyResetKey(String(req.body?.resetKey || ''));
  if (!okKey) return res.status(403).json({ ok: false, error: "O'chirish kaliti noto'g'ri" });

  // Papka o'chirilmaydi — nomi o'zgartiriladi. Xato bo'lsa qaytarish mumkin.
  const archived = db.archiveAccount(acc);
  console.warn(`[SA] 🗑  ${acc} arxivga ko'chirildi: ${archived}`);
  res.json({ ok: true, archivedTo: require('path').basename(archived || '') });
};

// ── Superadmin parolini almashtirish ─────────────────────────────────────────
// POST /api/sa/password  { current, next }
exports.changePassword = async (req, res) => {
  const r = await sa.changePassword(String(req.body?.current || ''), String(req.body?.next || ''));
  if (!r.ok) return res.status(400).json(r);
  res.json({ ok: true });
};

// ── O'chirish kalitini almashtirish ──────────────────────────────────────────
// POST /api/sa/reset-key  { password, next }
exports.changeResetKey = async (req, res) => {
  const r = await sa.changeResetKey(String(req.body?.password || ''), String(req.body?.next || ''));
  if (!r.ok) return res.status(400).json(r);
  res.json({ ok: true });
};
