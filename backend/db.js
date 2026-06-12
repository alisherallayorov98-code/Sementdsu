// ─────────────────────────────────────────────────────────────────────────────
// Ma'lumotlar qatlami (DB)
// Butun dastur holati bitta JSON faylda saqlanadi: data/db.json
// - Atomik yozish (tmp -> rename) => fayl hech qachon yarim yozilib qolmaydi
// - Avtomatik backup (har soatda) => data/backups/ ichida
// - Fayl buzilsa, eng oxirgi backupdan tiklashga urinadi
// ─────────────────────────────────────────────────────────────────────────────
const fs   = require('fs');
const path = require('path');

const DATA_DIR   = path.join(__dirname, 'data');
const DB_FILE    = path.join(DATA_DIR, 'db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

const BACKUP_INTERVAL = 60 * 60 * 1000; // 1 soat
const MAX_BACKUPS     = 72;             // oxirgi ~3 kunlik backup

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR))   fs.mkdirSync(DATA_DIR,   { recursive: true });
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function defaultDb() {
  return { state: {}, botOrders: [], updatedAt: null };
}

let cache = null;
let lastBackup = 0;

function restoreFromBackup() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();
    for (const f of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, f), 'utf8'));
        console.warn(`[DB] Asosiy fayl buzilgan. Backupdan tiklandi: ${f}`);
        return data;
      } catch { /* keyingisini sinab ko'ramiz */ }
    }
  } catch { /* backup yo'q */ }
  return null;
}

function load() {
  if (cache) return cache;
  ensureDirs();
  try {
    if (fs.existsSync(DB_FILE)) {
      cache = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } else {
      cache = defaultDb();
    }
  } catch (err) {
    console.error('[DB] db.json o\'qishda xato:', err.message);
    cache = restoreFromBackup() || defaultDb();
  }
  // Eski/yetishmayotgan maydonlarni to'ldirish
  if (!cache.state)     cache.state = {};
  if (!cache.botOrders) cache.botOrders = [];
  return cache;
}

function cleanupBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort();
    while (files.length > MAX_BACKUPS) {
      const old = files.shift();
      fs.unlinkSync(path.join(BACKUP_DIR, old));
    }
  } catch { /* e'tiborsiz */ }
}

function maybeBackup(db) {
  const now = Date.now();
  if (now - lastBackup < BACKUP_INTERVAL) return;
  lastBackup = now;
  const stamp = new Date().toISOString().slice(0, 13).replace(/[:T]/g, '-');
  try {
    fs.writeFileSync(path.join(BACKUP_DIR, `db-${stamp}.json`), JSON.stringify(db));
    cleanupBackups();
  } catch (err) {
    console.error('[DB] Backup xatosi:', err.message);
  }
}

function persist() {
  ensureDirs();
  const db = load();
  db.updatedAt = Date.now();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE); // atomik almashtirish
  maybeBackup(db);
}

// ── Ommaviy interfeys ────────────────────────────────────────────────────────
module.exports = {
  // Frontend boshqaradigan to'liq holat
  getState() {
    return load().state || {};
  },
  setState(newState) {
    const db = load();
    db.state = newState && typeof newState === 'object' ? newState : {};
    persist();
    return db.updatedAt;
  },

  // Telegram bot navbati
  getBotOrders() {
    return load().botOrders || [];
  },
  addBotOrder(order) {
    const db = load();
    db.botOrders.push(order);
    persist();
  },
  clearBotOrders() {
    const db = load();
    db.botOrders = [];
    persist();
  },

  info() {
    const db = load();
    return { updatedAt: db.updatedAt, botOrdersPending: db.botOrders.length };
  },
};
