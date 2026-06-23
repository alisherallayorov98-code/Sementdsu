// ─────────────────────────────────────────────────────────────────────────────
// reset-data.js — bazani toza holatga keltirish (bir martalik maintenance).
//
// O'CHIRADI : barcha biznes yozuvlari (kassa, bank, click, kirim, chiqim,
//             sotuv, qarz, avans, mijoz, haydovchi, oylik, kunlik ish, zakaz...)
//             + ochilish qoldiqlari 0 ga tushiriladi.
// SAQLAYDI  : xodimlar/login (workers), ilova sozlamalari (app_settings),
//             omborlar (warehouses), telegram kontaktlari (tgContacts).
//
// XAVFSIZLIK: o'zgartirishdan oldin db.json ning zaxirasini oladi.
//             --apply BO'LMASA hech narsa o'zgarmaydi (faqat ko'rsatadi).
//
// Ishlatish (backend papkasida):
//   node scripts/reset-data.js                  → akkauntlar va yozuvlar sonini ko'rsatadi
//   node scripts/reset-data.js <akkaunt> --apply → o'sha akkauntni tozalaydi (zaxira bilan)
//   node scripts/reset-data.js --all --apply     → barcha akkauntlarni tozalaydi
//
// Tozalashdan keyin:  pm2 restart sement-api   (kesh yangilanishi uchun!)
// ─────────────────────────────────────────────────────────────────────────────
const fs   = require('fs');
const path = require('path');

const DATA_DIR     = path.join(__dirname, '..', 'data');
const ACCOUNTS_DIR = path.join(DATA_DIR, 'accounts');

// Saqlanadigan maydonlar (login/sozlama/struktura)
const KEEP_OPENINGS = ['cash_opening', 'bank_opening', 'click_opening', 'cement_opening'];
// Tozalanadigan (bo'shatiladigan) massiv maydonlar — barcha biznes yozuvlari
const ARRAY_KEYS = [
  'cash_rows', 'bank_rows', 'click_rows', 'income_rows', 'expense_rows',
  'sold_rows', 'recv_rows', 'debt_rows', 'advance_rows', 'sales_rows',
  'bank_income_rows', 'bank_expense_rows', 'click_income_rows', 'click_expense_rows',
  'salary_payments', 'tg_orders', 'daily_work_rows', 'customers', 'drivers', 'driver_trips',
];

const listAccounts = () => !fs.existsSync(ACCOUNTS_DIR) ? [] :
  fs.readdirSync(ACCOUNTS_DIR).filter(d => fs.existsSync(path.join(ACCOUNTS_DIR, d, 'db.json')));

const totalRecords = (st) => ARRAY_KEYS.reduce((s, k) => s + (Array.isArray(st[k]) ? st[k].length : 0), 0);
const dbFile = (acc) => path.join(ACCOUNTS_DIR, acc, 'db.json');

const args   = process.argv.slice(2);
const apply  = args.includes('--apply');
const all    = args.includes('--all');
const named  = args.filter(a => !a.startsWith('--'));
const targets = all ? listAccounts() : named;

// Argument yo'q — faqat ko'rsatish
if (!targets.length) {
  const accounts = listAccounts();
  if (!accounts.length) { console.log('Akkaunt topilmadi.'); process.exit(0); }
  console.log('\nAkkauntlar:\n');
  for (const acc of accounts) {
    const db = JSON.parse(fs.readFileSync(dbFile(acc), 'utf8'));
    const st = db.state || {};
    console.log(`  • ${acc}: ${totalRecords(st)} ta yozuv, ${(st.workers || []).length} ta login`);
  }
  console.log('\nTozalash:  node scripts/reset-data.js <akkaunt> --apply');
  console.log('Misol:     node scripts/reset-data.js default --apply');
  console.log('Barchasi:  node scripts/reset-data.js --all --apply\n');
  process.exit(0);
}

for (const acc of targets) {
  const file = dbFile(acc);
  if (!fs.existsSync(file)) { console.log(`SKIP: "${acc}" topilmadi`); continue; }

  const raw = fs.readFileSync(file, 'utf8');
  const db  = JSON.parse(raw);
  const st  = db.state || {};

  console.log(`\n[${acc}] OLDIN: ${totalRecords(st)} ta yozuv, ${(st.workers || []).length} ta login saqlanadi`);

  if (!apply) { console.log('  (--apply yo\'q — o\'zgartirilmadi)'); continue; }

  // 1) Zaxira
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bak = file + '.before-reset-' + stamp;
  fs.writeFileSync(bak, raw, 'utf8');
  console.log('  Zaxira olindi: ' + path.basename(bak));

  // 2) Massivlarni bo'shatish
  for (const k of ARRAY_KEYS) st[k] = [];
  // 3) Ochilish qoldiqlarini 0 ga
  for (const k of KEEP_OPENINGS) {
    if (st[k] && typeof st[k] === 'object') {
      if ('amount' in st[k]) st[k] = { ...st[k], amount: 0 };
      if ('tons'   in st[k]) st[k] = { ...st[k], tons: 0 };
    }
  }
  // 4) DB darajasidagi navbat (test zakazlari)
  db.botOrders = [];
  db.state = st;
  db.updatedAt = Date.now();

  // 5) Atomik yozish
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, file);

  console.log(`[${acc}] KEYIN: ${totalRecords(st)} ta yozuv — ✅ TOZALANDI (login: ${(st.workers || []).length})`);
}

if (apply) console.log('\n⚠️  Endi kesh yangilanishi uchun:  pm2 restart sement-api\n');
