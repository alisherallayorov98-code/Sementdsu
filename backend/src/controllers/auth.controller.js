// Auth controller — kirish (login), ro'yxatdan o'tish (signup), joriy foydalanuvchi (me)
const { authenticate } = require('../services/auth.service');
const { sign }         = require('../services/token.service');
const { DEFAULT_ACCOUNT } = require('../config');
const db = require('../db');

// Akkaunt (tashkilot) identifikatorini xavfsiz tozalash
const sanitizeAccount = (a) =>
  String(a || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);

// POST /api/auth/login  { name, password, account? }
exports.login = async (req, res) => {
  const { name, password } = req.body || {};
  if (!name || !password) {
    return res.status(400).json({ ok: false, error: 'Ism va parol kiritilishi shart' });
  }
  if (String(name).length > 100 || String(password).length > 200) {
    return res.status(400).json({ ok: false, error: "Kiritilgan ma'lumot juda uzun" });
  }

  // Ko'p-akkauntli (SaaS): account body'dan; bo'sh bo'lsa — standart (lokal/LAN)
  const account = sanitizeAccount(req.body.account) || DEFAULT_ACCOUNT;
  const user = await authenticate(account, name, password);
  if (!user) return res.status(401).json({ ok: false, error: "Ism yoki parol noto'g'ri" });

  const token = sign({ sub: user.id, name: user.name, role: user.role, account });
  res.json({ ok: true, token, user });
};

// POST /api/auth/signup  { account, name, password }  — yangi tashkilot ochish.
// Faqat akkaunt hali bo'sh bo'lsa (xodimlar yo'q) ishlaydi; birinchi foydalanuvchi admin.
exports.signup = async (req, res) => {
  const { name, password } = req.body || {};
  // Bitta korxona rejimi: tashkilot kiritilmasa — standart (DEFAULT_ACCOUNT)
  const account = sanitizeAccount(req.body.account) || DEFAULT_ACCOUNT;
  if (!name || !password)    return res.status(400).json({ ok: false, error: 'Ism va parol kiritilishi shart' });
  if (String(password).length < 4) return res.status(400).json({ ok: false, error: 'Parol kamida 4 belgi bo\'lsin' });

  const state = db.getState(account);
  if (Array.isArray(state.workers) && state.workers.length > 0) {
    return res.status(409).json({ ok: false, error: 'Bu tashkilot allaqachon mavjud. Kirishdan foydalaning.' });
  }

  // authenticate bo'sh akkauntda birinchi foydalanuvchini admin qilib yaratadi (bootstrap)
  const user = await authenticate(account, name, password);
  if (!user) return res.status(500).json({ ok: false, error: 'Tashkilot yaratilmadi' });

  const token = sign({ sub: user.id, name: user.name, role: user.role, account });
  res.json({ ok: true, token, user });
};

// GET /api/auth/me  (himoyalangan)
exports.me = (req, res) => {
  res.json({ ok: true, user: { id: req.user.sub, name: req.user.name, role: req.user.role } });
};
