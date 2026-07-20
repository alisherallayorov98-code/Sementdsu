// ─────────────────────────────────────────────────────────────────────────────
// Autentifikatsiya va avtorizatsiya middleware'lari.
//   authenticate — har bir himoyalangan so'rovda yaroqli JWT talab qiladi.
//   authorize(...roles) — faqat ko'rsatilgan rollar uchun ruxsat (RBAC).
// ─────────────────────────────────────────────────────────────────────────────
const { verify } = require('../services/token.service');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return res.status(401).json({ ok: false, error: 'Avtorizatsiya talab qilinadi' });
  try {
    req.user = verify(token);          // { sub, name, role, account }
    next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Token yaroqsiz yoki muddati tugagan' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'Avtorizatsiya talab qilinadi' });
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, error: 'Bu amal uchun ruxsatingiz yo\'q' });
    }
    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Superadmin (sayt egasi) uchun. Oddiy tashkilot tokeni bu yerdan O'TMAYDI:
// token ichida `sa: true` da'vosi bo'lishi shart. Ya'ni tashkilot admini
// o'z tokeni bilan superadmin endpointlariga kira olmaydi.
// ─────────────────────────────────────────────────────────────────────────────
function requireSuperadmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return res.status(401).json({ ok: false, error: 'Avtorizatsiya talab qilinadi' });
  try {
    const payload = verify(token);
    if (payload.sa !== true) {
      return res.status(403).json({ ok: false, error: 'Bu bo\'limga faqat superadmin kira oladi' });
    }
    req.sa = payload;
    next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Token yaroqsiz yoki muddati tugagan' });
  }
}

module.exports = { authenticate, authorize, requireSuperadmin };
