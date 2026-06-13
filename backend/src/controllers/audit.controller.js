// Audit controller — nazorat jurnali (FAQAT admin uchun).
const audit = require('../services/audit.service');

// GET /api/audit  — barcha o'zgarishlar + shubha bayroqlari
exports.list = (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 1000, 5000);
  const entries = audit.read(req.user.account, { limit });
  const suspicious = entries.filter(e => e.flags && e.flags.length);
  res.json({ ok: true, total: entries.length, suspiciousCount: suspicious.length, entries });
};
