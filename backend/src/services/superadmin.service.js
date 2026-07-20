// ─────────────────────────────────────────────────────────────────────────────
// SUPERADMIN XIZMATI (sayt egasi uchun)
//
// Superadmin — tashkilotlardan (tenant) YUQORIDA turadigan yagona hisob.
// U tashkilot ochadi, login/parol beradi, to'lamaganini to'xtatadi va
// kerak bo'lsa bazani tozalaydi.
//
// SAQLASH JOYI: data/.superadmin.json — tashkilotlar bazasidan ALOHIDA.
// Shu sababli bitta tashkilotning ma'lumoti buzilsa yoki tozalansa ham
// superadmin hisobi zarar ko'rmaydi.
//
// IKKI BOSQICHLI HIMOYA:
//   password  — panelga kirish uchun
//   resetKey  — BAZANI O'CHIRISH uchun alohida ikkinchi parol
// Sessiya o'g'irlansa ham, resetKey bilinmasa ma'lumot o'chirib bo'lmaydi.
//
// BOSHLANG'ICH SOZLASH: birinchi ishga tushganda .env dan olinadi
//   SUPERADMIN_USER / SUPERADMIN_PASSWORD / SUPERADMIN_RESET_KEY
// Keyin panel orqali o'zgartirsa bo'ladi (fayldagi qiymat ustun turadi).
// ─────────────────────────────────────────────────────────────────────────────
const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcryptjs');
const { DATA_DIR } = require('../config');

const SALT_ROUNDS = 10;
const FILE = path.join(DATA_DIR, '.superadmin.json');

function ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* mavjud */ }
}

function readRaw() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return null; }
}

function writeRaw(rec) {
  ensureDir();
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(rec, null, 2), 'utf8');
  fs.renameSync(tmp, FILE);
  try { fs.chmodSync(FILE, 0o600); } catch { /* Windows'da qo'llab-quvvatlanmaydi */ }
}

// Fayl bo'lmasa .env dan yaratamiz. Env ham bo'lmasa — superadmin o'chiq.
function bootstrap() {
  const existing = readRaw();
  if (existing) return existing;

  const user = (process.env.SUPERADMIN_USER || '').trim();
  const pwd  = (process.env.SUPERADMIN_PASSWORD || '').trim();
  const key  = (process.env.SUPERADMIN_RESET_KEY || '').trim();
  if (!user || !pwd) return null;

  const rec = {
    name: user,
    passwordHash: bcrypt.hashSync(pwd, SALT_ROUNDS),
    // resetKey berilmasa — o'chirish imkoniyati YOPIQ bo'ladi (xavfsiz standart)
    resetKeyHash: key ? bcrypt.hashSync(key, SALT_ROUNDS) : null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  writeRaw(rec);
  console.log(`✅ Superadmin yaratildi (.env dan): ${user}`);
  if (!key) console.log('ℹ️  SUPERADMIN_RESET_KEY berilmadi — bazani o\'chirish YOPIQ.');
  return rec;
}

const isConfigured = () => !!(readRaw() || bootstrap());

async function verifyPassword(name, password) {
  const rec = readRaw() || bootstrap();
  if (!rec) return false;
  if (String(name).toLowerCase() !== String(rec.name).toLowerCase()) return false;
  return bcrypt.compare(String(password), rec.passwordHash);
}

// Bazani o'chirish uchun ikkinchi parol
async function verifyResetKey(key) {
  const rec = readRaw();
  if (!rec || !rec.resetKeyHash) return false;   // sozlanmagan bo'lsa — rad
  return bcrypt.compare(String(key), rec.resetKeyHash);
}

async function changePassword(currentPassword, nextPassword) {
  const rec = readRaw();
  if (!rec) return { ok: false, error: 'Superadmin sozlanmagan' };
  const ok = await bcrypt.compare(String(currentPassword), rec.passwordHash);
  if (!ok) return { ok: false, error: "Joriy parol noto'g'ri" };
  if (String(nextPassword).length < 8) {
    return { ok: false, error: "Yangi parol kamida 8 belgi bo'lishi kerak" };
  }
  rec.passwordHash = await bcrypt.hash(String(nextPassword), SALT_ROUNDS);
  rec.updatedAt = Date.now();
  writeRaw(rec);
  return { ok: true };
}

// Reset kalitini almashtirish — JORIY PAROL ham talab qilinadi, shunda
// o'g'irlangan sessiya bilan kalitni jimgina almashtirib bo'lmaydi.
async function changeResetKey(password, nextKey) {
  const rec = readRaw();
  if (!rec) return { ok: false, error: 'Superadmin sozlanmagan' };
  const ok = await bcrypt.compare(String(password), rec.passwordHash);
  if (!ok) return { ok: false, error: "Parol noto'g'ri" };
  if (String(nextKey).length < 8) {
    return { ok: false, error: "O'chirish kaliti kamida 8 belgi bo'lishi kerak" };
  }
  rec.resetKeyHash = await bcrypt.hash(String(nextKey), SALT_ROUNDS);
  rec.updatedAt = Date.now();
  writeRaw(rec);
  return { ok: true };
}

function info() {
  const rec = readRaw();
  if (!rec) return { configured: false };
  return {
    configured: true,
    name: rec.name,
    resetKeySet: !!rec.resetKeyHash,
    updatedAt: rec.updatedAt,
  };
}

module.exports = {
  isConfigured, verifyPassword, verifyResetKey,
  changePassword, changeResetKey, info, bootstrap,
};
