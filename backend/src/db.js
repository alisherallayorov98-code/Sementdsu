// ─────────────────────────────────────────────────────────────────────────────
// Ma'lumotlar qatlami (DB) — ko'p-akkauntli (SaaS-tayyor).
// Har bir akkaunt (tenant) o'z izolyatsiyalangan papkasida:
//   data/accounts/<accountId>/db.json   (+ backups/)
// - Atomik yozish (tmp -> rename), soatlik avtomatik backup, buzilsa tiklanish.
// - Eski bitta-faylli baza (data/db.json) 'default' akkauntga ko'chiriladi.
// ─────────────────────────────────────────────────────────────────────────────
const fs   = require('fs');
const path = require('path');
const { DATA_DIR } = require('./config');

const ACCOUNTS_DIR    = path.join(DATA_DIR, 'accounts');
const BACKUP_INTERVAL = 60 * 60 * 1000;
const MAX_BACKUPS     = 72;

const ensure = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };
ensure(ACCOUNTS_DIR);

// Bir martalik migratsiya: eski data/db.json -> accounts/default/db.json
(function migrateLegacy() {
  const old = path.join(DATA_DIR, 'db.json');
  const defFile = path.join(ACCOUNTS_DIR, 'default', 'db.json');
  if (fs.existsSync(old) && !fs.existsSync(defFile)) {
    try {
      ensure(path.join(ACCOUNTS_DIR, 'default'));
      fs.copyFileSync(old, defFile);
      fs.renameSync(old, old + '.migrated');
      console.log('[DB] Eski baza "default" akkauntga ko\'chirildi.');
    } catch (e) { console.error('[DB] Migratsiya xatosi:', e.message); }
  }
})();

const cache      = {}; // accountId -> db
const lastBackup = {};

const accDir    = (acc) => path.join(ACCOUNTS_DIR, sanitize(acc));
const dbFile    = (acc) => path.join(accDir(acc), 'db.json');
const backupDir = (acc) => path.join(accDir(acc), 'backups');
const emptyDb   = () => ({ state: {}, botOrders: [], updatedAt: null });

// accountId'ni yo'l hujumlaridan tozalash
function sanitize(acc) {
  return String(acc || 'default').replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
}

function restore(acc) {
  try {
    const files = fs.readdirSync(backupDir(acc)).filter(f => f.endsWith('.json')).sort().reverse();
    for (const f of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(backupDir(acc), f), 'utf8'));
        console.warn(`[DB:${acc}] Asosiy fayl buzilgan. Backupdan tiklandi: ${f}`);
        return data;
      } catch { /* keyingisi */ }
    }
  } catch { /* backup yo'q */ }
  return null;
}

function load(acc) {
  acc = sanitize(acc);
  if (cache[acc]) return cache[acc];
  ensure(accDir(acc));
  let db;
  try {
    db = fs.existsSync(dbFile(acc)) ? JSON.parse(fs.readFileSync(dbFile(acc), 'utf8')) : emptyDb();
  } catch (e) {
    console.error(`[DB:${acc}] o'qish xatosi:`, e.message);
    db = restore(acc) || emptyDb();
  }
  if (!db.state)     db.state = {};
  if (!db.botOrders) db.botOrders = [];
  cache[acc] = db;
  return db;
}

function cleanupBackups(acc) {
  try {
    const files = fs.readdirSync(backupDir(acc)).filter(f => f.endsWith('.json')).sort();
    while (files.length > MAX_BACKUPS) fs.unlinkSync(path.join(backupDir(acc), files.shift()));
  } catch { /* ignore */ }
}

function maybeBackup(acc, db) {
  const now = Date.now();
  if (now - (lastBackup[acc] || 0) < BACKUP_INTERVAL) return;
  lastBackup[acc] = now;
  ensure(backupDir(acc));
  const stamp = new Date().toISOString().slice(0, 13).replace(/[:T]/g, '-');
  try {
    fs.writeFileSync(path.join(backupDir(acc), `db-${stamp}.json`), JSON.stringify(db));
    cleanupBackups(acc);
  } catch (e) { console.error(`[DB:${acc}] backup xatosi:`, e.message); }
}

function persist(acc) {
  acc = sanitize(acc);
  ensure(accDir(acc));
  const db = load(acc);
  db.updatedAt = Date.now();
  const tmp = dbFile(acc) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, dbFile(acc)); // atomik
  maybeBackup(acc, db);
}

module.exports = {
  getState(acc)        { return load(acc).state || {}; },
  setState(acc, state) {
    const db = load(acc);
    db.state = state && typeof state === 'object' && !Array.isArray(state) ? state : {};
    persist(acc);
    return db.updatedAt;
  },
  getBotOrders(acc)    { return load(acc).botOrders || []; },
  addBotOrder(acc, o)  { const db = load(acc); db.botOrders.push(o); persist(acc); },
  clearBotOrders(acc)  { const db = load(acc); db.botOrders = []; persist(acc); },
  info(acc)            { const db = load(acc); return { updatedAt: db.updatedAt, botOrdersPending: db.botOrders.length }; },
};
