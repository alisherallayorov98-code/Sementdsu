#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN TIKLASH — akkauntga admin xodim qo'shish yoki parolini tiklash.
//
// Ishlatish:
//   node scripts/create-admin.js                      -> akkauntlar ro'yxati
//   node scripts/create-admin.js <akkaunt> <ism> <parol>
//
// Misol:
//   node scripts/create-admin.js sement Sardor 1234
//
// "Birinchi kirgan admin bo'ladi" qoidasi xavfsizlik uchun olib tashlangan.
// Shu sababli xodimsiz qolgan akkauntga kirish uchun shu skript ishlatiladi.
// Mavjud ismli xodim bo'lsa — paroli yangilanadi; bo'lmasa — admin yaratiladi.
// ─────────────────────────────────────────────────────────────────────────────
const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcryptjs');
// .env dan DEFAULT_ACCOUNT ni o'qish uchun (dastur qaysi akkauntga ulanishini bilish)
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch { /* dotenv ixtiyoriy */ }

const ACCOUNTS_DIR = path.join(__dirname, '..', 'data', 'accounts');
const SALT_ROUNDS  = 10;
// Dastur login paytida shu akkauntga ulanadi (frontend account yubormaydi)
const APP_ACCOUNT  = process.env.DEFAULT_ACCOUNT || 'sement';

const args    = process.argv.slice(2);
const account = args[0];
const name    = args[1];
const password = args[2];

function listAccounts() {
  if (!fs.existsSync(ACCOUNTS_DIR)) { console.log('Akkauntlar papkasi yo\'q:', ACCOUNTS_DIR); return; }
  const accs = fs.readdirSync(ACCOUNTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(ACCOUNTS_DIR, d.name, 'db.json')));
  console.log(`\n  Dastur login paytida "${APP_ACCOUNT}" akkauntiga ulanadi (◀ shu muhim).\n`);
  console.log(`  Mavjud akkauntlar (${accs.length}):\n`);
  let appAccExists = false;
  for (const d of accs) {
    if (d.name === APP_ACCOUNT) appAccExists = true;
    try {
      const db = JSON.parse(fs.readFileSync(path.join(ACCOUNTS_DIR, d.name, 'db.json'), 'utf8'));
      const workers = (db.state && Array.isArray(db.state.workers)) ? db.state.workers : [];
      const admins = workers.filter(w => (w.role || '') === 'admin').map(w => w.name);
      const mark = d.name === APP_ACCOUNT ? ' ◀ DASTUR SHUNGA ULANADI' : '';
      console.log(`    ${d.name.padEnd(20)} xodim: ${String(workers.length).padStart(3)}  admin: ${(admins.join(', ') || '(yo\'q)').padEnd(20)}${mark}`);
    } catch { console.log(`    ${d.name}  (db.json o'qilmadi)`); }
  }
  if (!appAccExists) {
    console.log(`\n  ⚠️  "${APP_ACCOUNT}" akkaunti YO'Q — shuning uchun kira olmayapsiz.`);
    console.log(`     Ma'lumotingiz boshqa akkauntда bo'lsa (masalan "default"), uni ko'chirish kerak,`);
    console.log(`     yoki quyidagi buyruq bilan "${APP_ACCOUNT}" ga yangi admin oching.`);
  }
  console.log(`\n  Kirish uchun (tavsiya — dastur ulanадиган akkauntga):`);
  console.log(`     node scripts/create-admin.js ${APP_ACCOUNT} Sardor <parol>\n`);
}

async function run() {
  if (!account || !name || !password) { listAccounts(); return; }

  const dbFile = path.join(ACCOUNTS_DIR, account, 'db.json');
  let db;
  if (fs.existsSync(dbFile)) {
    db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  } else {
    // Akkaunt yo'q — yangi yaratamiz
    fs.mkdirSync(path.join(ACCOUNTS_DIR, account), { recursive: true });
    db = { state: {}, botOrders: [], tgContacts: [], pendingDriverTrips: [], zayavkaLog: [], zayavkaCounter: 0, updatedAt: null };
    console.log(`\n  Yangi akkaunt yaratildi: ${account}`);
  }

  db.state = db.state || {};
  const workers = Array.isArray(db.state.workers) ? db.state.workers : [];
  const hash = await bcrypt.hash(String(password), SALT_ROUNDS);

  const idx = workers.findIndex(w => String(w.name).toLowerCase() === String(name).toLowerCase());
  if (idx !== -1) {
    workers[idx].password = hash;
    workers[idx].role = 'admin';
    console.log(`\n  ✅ "${name}" paroli yangilandi va admin qilib belgilandi.`);
  } else {
    const ts = Date.now();
    workers.push({
      id: ts, createdAt: ts, name: String(name), password: hash,
      role: 'admin', salary: 0, paid: 0, position: 'Boshqaruvchi', phone: '', note: '',
    });
    console.log(`\n  ✅ Yangi admin qo'shildi: "${name}"`);
  }
  db.state.workers = workers;
  // Sozlamalar bo'lmasa — standart
  if (!db.state.warehouses)   db.state.warehouses   = [{ id: 'main', name: 'Asosiy sklad' }];
  if (!db.state.cement_types) db.state.cement_types = ['450 Qoplik', '550 Qoplik', '450 Rasipnoy', '550 Rasipnoy'];
  db.updatedAt = Date.now();

  const tmp = dbFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, dbFile);

  console.log(`     Akkaunt : ${account}`);
  console.log(`     Login   : ${name}`);
  console.log(`     Parol   : ${password}`);
  console.log(`\n  Endi tizimga shu login/parol bilan kiring.\n`);
}

run().catch(e => { console.error('Xato:', e.message); process.exit(1); });
