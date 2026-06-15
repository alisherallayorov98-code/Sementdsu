// State controller — dasturning butun holatini akkaunt bo'yicha o'qish/saqlash.
// Har bir foydalanuvchi FAQAT o'z akkauntining ma'lumotiga kiradi (req.user.account).
const db    = require('../db');
const audit = require('../services/audit.service');
const { hashPassword, isHashed } = require('../services/auth.service');

// Faqat ADMIN o'zgartira oladigan bo'limlar (rol ko'tarish, parol almashtirish,
// ochilish qoldig'ini yashirin o'zgartirishning oldini oladi).
const ADMIN_ONLY_KEYS = [
  'workers', 'app_settings', 'warehouses',
  'cash_opening', 'bank_opening', 'click_opening', 'cement_opening',
];

// Parol-hashlarni clientga umuman yubormaymiz
function stripPasswords(state) {
  if (!state || !Array.isArray(state.workers)) return state;
  return { ...state, workers: state.workers.map(({ password, ...w }) => w) };
}

// GET /api/state
exports.get = (req, res) => {
  res.json(stripPasswords(db.getState(req.user.account)));
};

// PUT /api/state
exports.put = async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ ok: false, error: "Holat obyekt ko'rinishida bo'lishi kerak" });
  }

  const oldState   = db.getState(req.user.account);
  const oldWorkers = Array.isArray(oldState.workers) ? oldState.workers : [];

  if (req.user.role !== 'admin') {
    // ── XAVFSIZLIK: admin bo'lmaganlar config/xodim/ochilish bo'limlariga tegolmaydi.
    // Ular serverdagi eski qiymatda qoladi (savdo/kassa/qarz esa yoziladi).
    for (const k of ADMIN_ONLY_KEYS) {
      if (oldState[k] !== undefined) body[k] = oldState[k];
      else delete body[k];
    }
  } else if (Array.isArray(body.workers)) {
    // ── ADMIN: parollarni boshqarish.
    // GET parolni olib tashlagani uchun kelgan workers'da parol bo'lmaydi —
    // eski hashni saqlaymiz. Yangi ochiq parol kelsa — hash qilamiz.
    const oldById = new Map(oldWorkers.map(w => [w.id, w]));
    for (const w of body.workers) {
      if (!w.password) {
        const prev = oldById.get(w.id);
        if (prev && prev.password) w.password = prev.password;
      } else if (!isHashed(w.password)) {
        w.password = await hashPassword(w.password);
      }
    }
  }

  // Saqlashdan OLDIN eski holatni olib, o'zgarishlarni audit jurnaliga yozamiz
  audit.recordChanges(req.user.account, oldState, body, req.user);

  const updatedAt = db.setState(req.user.account, body);
  res.json({ ok: true, updatedAt });
};
