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
  if (user?.disabled) {
    return res.status(403).json({
      ok: false,
      error: "Tashkilot vaqtincha to'xtatilgan. Xizmat ko'rsatuvchi bilan bog'laning.",
    });
  }
  if (!user) return res.status(401).json({ ok: false, error: "Ism yoki parol noto'g'ri" });

  const token = sign({ sub: user.id, name: user.name, role: user.role, account });
  res.json({ ok: true, token, user });
};

// POST /api/auth/signup — YOPILGAN.
//
// Ilgari bu endpoint butunlay ochiq edi: internetdagi istalgan odam cheksiz
// tashkilot ochib, serverni to'ldirib tashlashi mumkin edi. SaaS modelida
// tashkilotni faqat sayt egasi (superadmin) ochadi va login/parolni o'zi beradi.
exports.signup = async (req, res) => {
  res.status(403).json({
    ok: false,
    error: "O'zini-o'zi ro'yxatdan o'tkazish yopiq. Tashkilot ochish uchun xizmat ko'rsatuvchiga murojaat qiling.",
  });
};

// GET /api/auth/me  (himoyalangan)
exports.me = (req, res) => {
  res.json({ ok: true, user: { id: req.user.sub, name: req.user.name, role: req.user.role } });
};
