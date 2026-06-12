// State controller — dasturning butun holatini akkaunt bo'yicha o'qish/saqlash.
// Har bir foydalanuvchi FAQAT o'z akkauntining ma'lumotiga kiradi (req.user.account).
const db = require('../db');

// GET /api/state
exports.get = (req, res) => {
  res.json(db.getState(req.user.account));
};

// PUT /api/state
exports.put = (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ ok: false, error: "Holat obyekt ko'rinishida bo'lishi kerak" });
  }
  const updatedAt = db.setState(req.user.account, body);
  res.json({ ok: true, updatedAt });
};
