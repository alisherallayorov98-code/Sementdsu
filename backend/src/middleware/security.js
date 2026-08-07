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

// Umumiy API uchun cheklov — bitta IP bo'yicha.
// DIQQAT: bir ofisdagi hamma xodim bitta tashqi IP (NAT) ortidan keladi va
// har biri doimiy so'rov yuboradi:
//   · holatni saqlash — har o'zgarishda (debounce 800ms), faol ishda ~30/daq
//   · telegram zakazlar navbati — har 5 soniyada = 12/daq
//   · telegram kontaktlari — har 30 soniyada = 2/daq
// Ya'ni 5 xodim faol ishlaganda ~220/daq — eski 300 chegarasiga tegib ketardi.
// Chegaraga urilganda saqlash so'rovi 429 bilan qaytadi va yozuv serverga
// bormay qoladi. Shuning uchun zaxira bilan 1200 qo'yildi (login cheklovi
// qattiqligicha qoladi — parol terib ko'rishdan himoya o'sha yerda).
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 1200,
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
