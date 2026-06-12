// ─────────────────────────────────────────────────────────────────────────────
// Autentifikatsiya xizmati.
// Foydalanuvchilar akkauntning state.workers ro'yxatida saqlanadi.
// - Agar xodimlar bo'lmasa (yangi akkaunt): birinchi kirgan kishi avtomatik ADMIN
//   bo'ladi (bootstrap) va serverda yaratiladi.
// - Aks holda: ism + parol tekshiriladi.
// Eslatma: parollar hozircha state ichida ochiq saqlanadi (admin ularni Sozlamalarda
// ko'radi/tahrirlaydi). Validatsiya server tomonda, kirish JWT bilan himoyalangan.
// To'liq SaaS uchun keyingi qadam — parollarni hash qilish (bcrypt) va ko'rinishni olib tashlash.
// ─────────────────────────────────────────────────────────────────────────────
const db = require('../db');

function authenticate(account, name, password) {
  const state   = db.getState(account);
  const workers = Array.isArray(state.workers) ? state.workers : [];

  // Bootstrap: birinchi foydalanuvchi admin bo'ladi
  if (workers.length === 0) {
    const ts = Date.now();
    const admin = {
      id: ts, createdAt: ts, name: String(name), password: String(password),
      role: 'admin', salary: 0, paid: 0, position: 'Boshqaruvchi', phone: '', note: '',
    };
    state.workers = [admin];
    db.setState(account, state);
    return { id: admin.id, name: admin.name, role: 'admin' };
  }

  const w = workers.find(x =>
    String(x.name).toLowerCase() === String(name).toLowerCase() &&
    String(x.password) === String(password)
  );
  if (!w) return null;
  return { id: w.id, name: w.name, role: w.role || 'sotuvchi' };
}

module.exports = { authenticate };
