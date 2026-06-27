// ─────────────────────────────────────────────────────────────────────────────
// Markaziy sozlamalar. JWT siri .env'da bo'lmasa — avtomatik yaratiladi va
// data/.jwt_secret faylida saqlanadi (serverni qayta ishga tushirsa ham tokenlar
// yaroqli qoladi). Hech qachon git'ga tushmaydi (.gitignore: backend/data).
// ─────────────────────────────────────────────────────────────────────────────
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) return process.env.JWT_SECRET;
  const f = path.join(DATA_DIR, '.jwt_secret');
  try { if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim(); } catch { /* ignore */ }
  const secret = crypto.randomBytes(48).toString('hex');
  try { fs.writeFileSync(f, secret, { mode: 0o600 }); } catch { /* ignore */ }
  return secret;
}

module.exports = {
  PORT:            process.env.PORT || 5000,
  NODE_ENV:        process.env.NODE_ENV || 'development',
  JWT_SECRET:      loadJwtSecret(),
  JWT_EXPIRES:     process.env.JWT_EXPIRES || '12h',
  // Vergul bilan ajratilgan ruxsat etilgan manzillar yoki '*' (barchasi)
  CORS_ORIGINS:    process.env.CORS_ORIGINS || '*',
  TELEGRAM_TOKEN:      (process.env.TELEGRAM_BOT_TOKEN || '').trim(),
  TELEGRAM_BOT_USER:  (process.env.TELEGRAM_BOT_USERNAME || 'sementchiuzbot').trim(),
  ZAYAVKA_BOT_TOKEN:  (process.env.ZAYAVKA_BOT_TOKEN || '').trim(),
  // ── SMS (Eskiz.uz) ──────────────────────────────────────────────────────
  // Eskiz hisobidan: email + parol. Sender (from) tasdiqlangan nom yoki '4546'.
  ESKIZ_EMAIL:    (process.env.ESKIZ_EMAIL || '').trim(),
  ESKIZ_PASSWORD: (process.env.ESKIZ_PASSWORD || '').trim(),
  ESKIZ_FROM:     (process.env.ESKIZ_FROM || '4546').trim(),
  ESKIZ_BASE:     (process.env.ESKIZ_BASE || 'https://notify.eskiz.uz/api').trim(),
  DATA_DIR,
  // Bitta korxona (single-tenant): hamma shu bazaga ulanadi. Server env bilan
  // o'zgartirsa bo'ladi (DEFAULT_ACCOUNT=...). Ilova ma'lumotlari shu nomdagi
  // data/accounts/<nom>/db.json da saqlanadi.
  DEFAULT_ACCOUNT: process.env.DEFAULT_ACCOUNT || 'sement',
  MAX_BODY:        '25mb',
};
