// ─────────────────────────────────────────────────────────────────────────────
// Autentifikatsiya xizmati (bcrypt bilan).
// - Yangi va yangilangan parollar bcrypt hash sifatida saqlanadi ($2b$...)
// - Eski ochiq parollar birinchi muvaffaqiyatli logindan keyin avtomatik hash'lanadi
// - Bootstrap: birinchi foydalanuvchi avtomatik admin bo'ladi
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

  // Bootstrap: birinchi foydalanuvchi admin bo'ladi
  if (workers.length === 0) {
    const ts   = Date.now();
    const hash = await bcrypt.hash(String(password), SALT_ROUNDS);
    const admin = {
      id: ts, createdAt: ts, name: String(name), password: hash,
      role: 'admin', salary: 0, paid: 0, position: 'Boshqaruvchi', phone: '', note: '',
    };
    state.workers = [admin];
    db.setState(account, state);
    return { id: admin.id, name: admin.name, role: 'admin' };
  }

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
