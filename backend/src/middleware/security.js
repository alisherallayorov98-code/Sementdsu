// ─────────────────────────────────────────────────────────────────────────────
// Xavfsizlik middleware'lari: HTTP sarlavhalari (helmet), CORS allowlist,
// so'rovlar chastotasi cheklovi (rate limit) — DDoS va brute-force'dan himoya.
// ─────────────────────────────────────────────────────────────────────────────
const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const { CORS_ORIGINS } = require('../config');

const corsMw = cors({
  origin: CORS_ORIGINS === '*' ? true : CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean),
  credentials: false,
});

// Umumiy API uchun: daqiqasiga 300 so'rov (bitta IP)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 300,
  standardHeaders: true, legacyHeaders: false,
  message: { ok: false, error: "Juda ko'p so'rov. Birozdan keyin urinib ko'ring." },
});

// Login uchun qattiqroq: 15 daqiqada 20 urinish (parol terib ko'rishdan himoya)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { ok: false, error: "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring." },
});

module.exports = { helmet: helmet(), corsMw, apiLimiter, loginLimiter };
