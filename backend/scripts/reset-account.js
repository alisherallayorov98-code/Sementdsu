#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// AKKAUNT MA'LUMOTLARINI TOZALASH
//
// Ishlatish:
//   node scripts/reset-account.js <akkaunt> --keep-admin
//   node scripts/reset-account.js default --keep-admin --yes
//
// Bayroqlar:
//   --keep-admin   admin rolidagi xodimlarni saqlab qoladi (TAVSIYA ETILADI)
//   --keep-refs    mijozlar / yetkazib beruvchilar / haydovchilarni ham saqlaydi
//   --yes          tasdiqlashni so'ramaydi (skriptda ishlatish uchun)
//
// MUHIM 1 — ZAXIRA:
//   Tozalashdan oldin HAR DOIM to'liq zaxira olinadi va yo'li ekranga chiqadi.
//
// MUHIM 2 — NEGA HAR BIR BO'LIM ALOHIDA BO'SHATILADI:
//   Holatni shunchaki {} qilib qo'yish YETARLI EMAS. Frontend hydration kodi
//   shunday ishlaydi:
//       if (remote[key] !== undefined) setter(remote[key]);
//   Ya'ni server bo'sh {} qaytarsa, hech bir kalit yangilanmaydi — brauzerdagi
//   localStorage nusxasi joyida qoladi va ~1 soniyadan keyin serverga QAYTA
//   YOZILADI. Natijada tozalash o'z-o'zidan bekor bo'ladi.
//   Shuning uchun har bir bo'limga ANIQ bo'sh qiymat yoziladi.
//
// MUHIM 3 — ADMINNI SAQLASH:
//   Xodimlar butunlay o'chirilsa, auth.service.js dagi "bootstrap" qoidasi
//   tufayli tizimga BIRINCHI kirgan odam avtomatik admin bo'lib oladi.
//   Sayt ochiq domenda turgani uchun bu jiddiy xavf. --keep-admin shuni yopadi.
// ─────────────────────────────────────────────────────────────────────────────
const fs   = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_DIR = path.join(__dirname, '..', 'data', 'accounts');

const args       = process.argv.slice(2);
const account    = (args.find(a => !a.startsWith('--')) || 'default')
                     .toLowerCase().replace(/[^a-z0-9_-]/g, '');
const keepAdmin  = args.includes('--keep-admin');
const keepRefs   = args.includes('--keep-refs');
const autoYes    = args.includes('--yes');

const accDir  = path.join(DATA_DIR, account);
const dbFile  = path.join(accDir, 'db.json');
const bakDir  = path.join(accDir, 'backups');

// Har bir bo'limning "bo'sh" holati (yuqoridagi MUHIM 2 ga qarang)
const EMPTY_STATE = {
  // Pul harakati
  cash_rows: [], bank_rows: [], click_rows: [],
  income_rows: [], expense_rows: [],
  bank_income_rows: [], bank_expense_rows: [], bank_pending_rows: [],
  click_income_rows: [], click_expense_rows: [],
  // Ochilish qoldiqlari
  cash_opening:   { date: '', amount: 0 },
  bank_opening:   { date: '', amount: 0 },
  click_opening:  { date: '', amount: 0 },
  cement_opening: { date: '', tons: 0 },
  // Savdo va tovar
  sales_rows: [], sold_rows: [], recv_rows: [], sklad_rows: [],
  // Hisob-kitob
  debt_rows: [], advance_rows: [], supplier_payments: [], salary_payments: [],
  // Operatsion
  tg_orders: [], daily_work_rows: [], driver_trips: [], tickets: [],
};

// Ma'lumotnomalar — --keep-refs berilmasa bular ham tozalanadi
const REF_STATE = {
  customers: [], suppliers: [], drivers: [],
};

function fmt(n) { return Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' '); }

function countRows(state) {
  const out = [];
  for (const key of Object.keys({ ...EMPTY_STATE, ...REF_STATE, workers: [] })) {
    const v = state[key];
    if (Array.isArray(v) && v.length) out.push([key, v.length]);
  }
  return out.sort((a, b) => b[1] - a[1]);
}

async function confirm(question) {
  if (autoYes) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(r => rl.question(question, r));
  rl.close();
  return answer.trim() === 'TOZALASH';
}

(async () => {
  if (!fs.existsSync(dbFile)) {
    console.error(`\n❌ Akkaunt topilmadi: ${account}`);
    console.error(`   Kutilgan fayl: ${dbFile}`);
    if (fs.existsSync(DATA_DIR)) {
      console.error(`\n   Mavjud akkauntlar: ${fs.readdirSync(DATA_DIR).join(', ') || '(yo\'q)'}`);
    }
    process.exit(1);
  }

  const db    = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  const state = db.state || {};

  // ── 1. Hozir nima bor ────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(58)}`);
  console.log(`  AKKAUNT: ${account}`);
  console.log(`${'═'.repeat(58)}\n`);

  const rows = countRows(state);
  if (!rows.length) {
    console.log('  Baza allaqachon bo\'sh.\n');
  } else {
    console.log('  Hozirgi ma\'lumotlar:\n');
    for (const [key, n] of rows) console.log(`    ${key.padEnd(22)} ${String(n).padStart(6)} qator`);
  }

  const workers = Array.isArray(state.workers) ? state.workers : [];
  const admins  = workers.filter(w => (w.role || '') === 'admin');
  console.log(`\n  Xodimlar: ${workers.length} ta (shundan admin: ${admins.length})`);
  if (admins.length) console.log(`    Adminlar: ${admins.map(a => a.name).join(', ')}`);

  // ── 2. Nima bo'lishini tushuntirish ──────────────────────────────────────
  console.log(`\n${'─'.repeat(58)}`);
  console.log('  BAJARILADIGAN AMAL:\n');
  console.log('    O\'chadi : barcha savdo, kassa, qarz, avans, sklad, reys,');
  console.log('              oylik to\'lovlari, zakaz va tiketlar');
  console.log(`    ${keepRefs ? 'Qoladi  ' : 'O\'chadi '}: mijozlar, yetkazib beruvchilar, haydovchilar`);
  console.log(`    ${keepAdmin ? 'Qoladi  ' : 'O\'CHADI '}: xodimlar va parollar`);
  console.log('    Qoladi  : sozlamalar, sement turlari, skladlar, tariflar');

  if (!keepAdmin) {
    console.log(`\n  ⚠️  DIQQAT: --keep-admin berilmadi!`);
    console.log('     Xodimlar butunlay o\'chsa, tizimga BIRINCHI kirgan odam');
    console.log('     avtomatik admin bo\'lib oladi (auth.service.js bootstrap).');
    console.log('     Ochiq domenda bu jiddiy xavf. --keep-admin qo\'shish tavsiya etiladi.');
  }
  console.log(`${'─'.repeat(58)}\n`);

  // ── 3. Tasdiqlash ────────────────────────────────────────────────────────
  const ok = await confirm('  Davom etish uchun TOZALASH deb yozing: ');
  if (!ok) { console.log('\n  Bekor qilindi. Hech narsa o\'zgarmadi.\n'); process.exit(0); }

  // ── 4. ZAXIRA (tozalashdan oldin, majburiy) ──────────────────────────────
  fs.mkdirSync(bakDir, { recursive: true });
  const stamp   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bakFile = path.join(bakDir, `db-RESET-OLDIDAN-${stamp}.json`);
  fs.writeFileSync(bakFile, JSON.stringify(db, null, 2), 'utf8');
  console.log(`\n  ✅ Zaxira olindi:\n     ${bakFile}`);
  console.log(`     Hajmi: ${fmt(fs.statSync(bakFile).size)} bayt`);

  // ── 5. Tozalash ──────────────────────────────────────────────────────────
  const newState = { ...state, ...EMPTY_STATE };
  if (!keepRefs) Object.assign(newState, REF_STATE);

  if (keepAdmin) {
    // Adminlarni to'liq (parol bilan) saqlaymiz, qolgan xodimlarni o'chiramiz
    newState.workers = admins.map(a => ({ ...a, paid: 0 }));
  } else {
    newState.workers = [];
  }

  db.state             = newState;
  db.botOrders         = [];
  db.tgContacts        = [];
  db.pendingDriverTrips = [];
  db.zayavkaLog        = [];
  db.zayavkaCounter    = 0;
  db.updatedAt         = Date.now();

  const tmp = dbFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, dbFile); // atomik almashtirish

  // ── 6. Natija ────────────────────────────────────────────────────────────
  console.log(`\n  ✅ Tozalandi.\n`);
  const left = countRows(db.state);
  if (left.length) {
    console.log('  Saqlanib qolgani:');
    for (const [key, n] of left) console.log(`    ${key.padEnd(22)} ${String(n).padStart(6)} qator`);
  } else {
    console.log('  Baza butunlay bo\'sh.');
  }

  console.log(`\n${'─'.repeat(58)}`);
  console.log('  KEYINGI QADAMLAR:\n');
  console.log('    1) Backendni qayta ishga tushiring:   pm2 restart sement-api');
  console.log('    2) Ilova ochiq brauzerlarda Ctrl+Shift+R bosing');
  console.log('       (lokal kesh serverdagi bo\'sh holat bilan almashadi)');
  console.log('\n  Xato bo\'lsa zaxiradan tiklash:');
  console.log(`    cp "${bakFile}" "${dbFile}" && pm2 restart sement-api`);
  console.log(`${'─'.repeat(58)}\n`);
})();
