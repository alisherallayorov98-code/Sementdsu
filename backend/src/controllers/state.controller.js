// State controller — dasturning butun holatini akkaunt bo'yicha o'qish/saqlash.
// Har bir foydalanuvchi FAQAT o'z akkauntining ma'lumotiga kiradi (req.user.account).
const db    = require('../db');
const audit = require('../services/audit.service');
const { hashPassword, isHashed } = require('../services/auth.service');

// GET /api/state
exports.get = (req, res) => {
  res.json(db.getState(req.user.account));
};

// PUT /api/state
exports.put = async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ ok: false, error: "Holat obyekt ko'rinishida bo'lishi kerak" });
  }

  // Xodimlar parollari ochiq bo'lsa — hash'laymiz (Settings orqali yangi xodim qo'shilsa)
  if (Array.isArray(body.workers)) {
    for (const w of body.workers) {
      if (w.password && !isHashed(w.password)) {
        w.password = await hashPassword(w.password);
      }
    }
  }

  // Saqlashdan OLDIN eski holatni olib, o'zgarishlarni audit jurnaliga yozamiz
  const oldState = db.getState(req.user.account);
  audit.recordChanges(req.user.account, oldState, body, req.user);

  const updatedAt = db.setState(req.user.account, body);
  res.json({ ok: true, updatedAt });
};
