// ─────────────────────────────────────────────────────────────────────────────
// Autentifikatsiya xizmati (bcrypt bilan).
// - Yangi va yangilangan parollar bcrypt hash sifatida saqlanadi ($2b$...)
// - Eski ochiq parollar birinchi muvaffaqiyatli logindan keyin avtomatik hash'lanadi
// - Tashkilotni FAQAT superadmin ochadi (bootstrap olib tashlangan)
// ─────────────────────────────────────────────────────────────────────────────
const bcrypt = require('bcryptjs');
const db = require('../db');

const SALT_ROUNDS = 10;

function isHashed(pwd) {
  return typeof pwd === 'string' && pwd.startsWith('$2');
}

async function authenticate(account, name, password) {
  const state   = db.getState(account);
  const workers = Array.isArray(state.workers) ? state.workers : [];

  // ── XAVFSIZLIK: "birinchi kirgan admin bo'ladi" qoidasi OLIB TASHLANDI ──
  // Ilgari xodimlar bo'sh bo'lsa, kirishga urinayotgan ISTALGAN odam o'zi
  // yozgan ism/parol bilan admin bo'lib olardi. SaaS'da bu ikki tomonlama xavf:
  //   1) mavjud bo'lmagan tashkilot nomini topgan odam uni egallab olardi;
  //   2) baza tozalangandan keyin sayt egasiz qolib, birinchi kirgan odamniki
  //      bo'lib ketardi.
  // Endi tashkilotni FAQAT superadmin ochadi va login/parolni o'zi beradi.
  if (workers.length === 0) return null;

  // To'xtatilgan tashkilot (masalan to'lov qilinmagan) — kirish yopiq
  if (state.__disabled) return { disabled: true };

  const w = workers.find(x => String(x.name).toLowerCase() === String(name).toLowerCase());
  if (!w) return null;

  let match = false;
  if (isHashed(w.password)) {
    // Yangi usul: bcrypt solishtirish
    match = await bcrypt.compare(String(password), w.password);
  } else {
    // Eski ochiq parol — to'g'ridan-to'g'ri solishtirish
    match = String(w.password) === String(password);
    if (match) {
      // Avtomatik upgrade: ochiq parolni hash'laymiz
      const hash = await bcrypt.hash(String(password), SALT_ROUNDS);
      const idx = state.workers.findIndex(x => x.id === w.id);
      if (idx !== -1) {
        state.workers[idx].password = hash;
        db.setState(account, state);
      }
    }
  }

  if (!match) return null;
  return { id: w.id, name: w.name, role: w.role || 'sotuvchi', warehouseId: w.warehouseId || null };
}

// Yangi xodim yaratishda yoki parol yangilanganda hash qilish uchun
async function hashPassword(plainPassword) {
  return bcrypt.hash(String(plainPassword), SALT_ROUNDS);
}

module.exports = { authenticate, hashPassword, isHashed };
