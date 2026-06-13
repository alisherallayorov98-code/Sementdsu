// Auth controller — kirish (login) va joriy foydalanuvchi (me)
const { authenticate } = require('../services/auth.service');
const { sign }         = require('../services/token.service');
const { DEFAULT_ACCOUNT } = require('../config');

// POST /api/auth/login  { name, password }
exports.login = async (req, res) => {
  const { name, password } = req.body || {};
  if (!name || !password) {
    return res.status(400).json({ ok: false, error: 'Ism va parol kiritilishi shart' });
  }
  if (String(name).length > 100 || String(password).length > 200) {
    return res.status(400).json({ ok: false, error: "Kiritilgan ma'lumot juda uzun" });
  }

  const account = DEFAULT_ACCOUNT; // SaaS'da bu req.body.account dan olinadi
  const user = await authenticate(account, name, password);
  if (!user) return res.status(401).json({ ok: false, error: "Ism yoki parol noto'g'ri" });

  const token = sign({ sub: user.id, name: user.name, role: user.role, account });
  res.json({ ok: true, token, user });
};

// GET /api/auth/me  (himoyalangan)
exports.me = (req, res) => {
  res.json({ ok: true, user: { id: req.user.sub, name: req.user.name, role: req.user.role } });
};
