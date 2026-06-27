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

// ── Global: zayavka bot foydalanuvchilari (chatId → accountId) ──────────────
// Barcha akkauntlar uchun umumiy (bot tokeni bitta)
const ZV_USERS_FILE = path.join(DATA_DIR, 'zayavka_users.json');
let _zvUsers = null;
function loadZvUsers() {
  if (_zvUsers) return _zvUsers;
  try { _zvUsers = fs.existsSync(ZV_USERS_FILE) ? JSON.parse(fs.readFileSync(ZV_USERS_FILE, 'utf8')) : {}; }
  catch { _zvUsers = {}; }
  return _zvUsers;
}
function saveZvUsers() {
  fs.writeFileSync(ZV_USERS_FILE, JSON.stringify(_zvUsers || {}, null, 2));
}

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
const emptyDb   = () => ({ state: {}, botOrders: [], tgContacts: [], pendingDriverTrips: [], zayavkaConfig: null, zayavkaLog: [], zayavkaCounter: 0, updatedAt: null });

// Telefonni solishtirish uchun normallashtirish — faqat oxirgi 9 raqam (UZ)
const normPhone = (p) => String(p || '').replace(/\D/g, '').slice(-9);

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
  if (!db.state)               db.state = {};
  if (!db.botOrders)           db.botOrders = [];
  if (!db.tgContacts)          db.tgContacts = [];
  if (!db.pendingDriverTrips)  db.pendingDriverTrips = [];
  if (!db.zayavkaLog)          db.zayavkaLog = [];
  if (db.zayavkaCounter == null) db.zayavkaCounter = 0;
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

  // ── Telegram kontaktlari (telefon → chatId) ─────────────────────────────
  getTgContacts(acc)   { return load(acc).tgContacts || []; },
  // Upsert: telefon bo'yicha yangilaydi yoki qo'shadi
  upsertTgContact(acc, { phone, chatId, name }) {
    const db = load(acc);
    const np = normPhone(phone);
    const i = db.tgContacts.findIndex(c => normPhone(c.phone) === np && np);
    const rec = { phone: String(phone || ''), chatId, name: name || '', at: Date.now() };
    if (i !== -1) db.tgContacts[i] = { ...db.tgContacts[i], ...rec };
    else db.tgContacts.push(rec);
    persist(acc);
    return rec;
  },
  // Joylashuvni chatId bo'yicha saqlash (bot 📍 location yuborganda)
  upsertTgLocation(acc, chatId, lat, lon) {
    const db = load(acc);
    let c = db.tgContacts.find(x => x.chatId === chatId);
    if (c) { c.lat = lat; c.lon = lon; c.at = Date.now(); }
    else { db.tgContacts.push({ phone: '', chatId, lat, lon, at: Date.now() }); }
    persist(acc);
  },
  // Telefon bo'yicha chatId topish
  findChatId(acc, phone) {
    const np = normPhone(phone);
    if (!np) return null;
    const c = (load(acc).tgContacts || []).find(x => normPhone(x.phone) === np);
    return c ? c.chatId : null;
  },
  normPhone,
  // Deep link orqali mijozni chatId ga ulash
  linkCustomer(acc, linkCode, chatId) {
    const db    = load(acc);
    const custs = db.state.customers || [];
    const idx   = custs.findIndex(c => c.linkCode === linkCode);
    if (idx === -1) return null;
    custs[idx] = { ...custs[idx], telegramChatId: String(chatId) };
    db.state.customers = custs;
    persist(acc);
    return custs[idx];
  },
  // Deep link orqali xodimni chatId ga ulash
  linkWorker(acc, linkCode, chatId) {
    const db      = load(acc);
    const workers = db.state.workers || [];
    const idx     = workers.findIndex(w => w.linkCode === linkCode);
    if (idx === -1) return null;
    workers[idx] = { ...workers[idx], telegramChatId: String(chatId) };
    db.state.workers = workers;
    persist(acc);
    return workers[idx];
  },
  // chatId bo'yicha xodimni topish
  getWorkerByChatId(acc, chatId) {
    const workers = (load(acc).state.workers || []);
    return workers.find(w => w.telegramChatId === String(chatId)) || null;
  },
  info(acc)            { const db = load(acc); return { updatedAt: db.updatedAt, botOrdersPending: db.botOrders.length }; },

  // ── Haydovchi pending reyslari ───────────────────────────────────────────
  getPendingDriverTrips(acc)       { return load(acc).pendingDriverTrips || []; },
  addPendingDriverTrip(acc, trip)  { const db = load(acc); db.pendingDriverTrips.push(trip); persist(acc); },
  updatePendingDriverTrip(acc, id, fields) {
    const db = load(acc);
    const i = db.pendingDriverTrips.findIndex(t => t.id === id);
    if (i !== -1) db.pendingDriverTrips[i] = { ...db.pendingDriverTrips[i], ...fields };
    persist(acc);
  },
  removePendingDriverTrip(acc, id) {
    const db = load(acc); db.pendingDriverTrips = db.pendingDriverTrips.filter(t => t.id !== id); persist(acc);
  },

  // ── Haydovchi bot orqali ulanishi (deep link) ────────────────────────────
  linkDriver(acc, driverId, chatId) {
    const db = load(acc);
    const drivers = db.state.drivers || [];
    const idx = drivers.findIndex(d => String(d.id) === String(driverId));
    if (idx === -1) return null;
    drivers[idx] = { ...drivers[idx], telegramChatId: String(chatId) };
    db.state.drivers = drivers;
    persist(acc);
    return drivers[idx];
  },
  getDriverByChatId(acc, chatId) {
    const drivers = (load(acc).state.drivers || []);
    return drivers.find(d => d.telegramChatId === String(chatId)) || null;
  },

  // ── Reys tasdiqlash: pending → state.driver_trips ────────────────────────
  approveDriverTrip(acc, tripId) {
    const db = load(acc);
    const trip = (db.pendingDriverTrips || []).find(t => t.id === tripId);
    if (!trip) return null;
    const driverTrips = db.state.driver_trips || [];
    const newTrip = {
      id: trip.id, createdAt: trip.createdAt,
      driverId: trip.driverId, date: trip.date,
      destination: trip.destination, price: trip.price,
      isPayment: false, note: trip.note || '',
      photoFileId: trip.photoFileId || null, fromBot: true,
    };
    db.state.driver_trips = [...driverTrips, newTrip];
    db.pendingDriverTrips = db.pendingDriverTrips.filter(t => t.id !== tripId);
    persist(acc);
    return { trip: newTrip, driver: (db.state.drivers || []).find(d => d.id === trip.driverId) };
  },
  // Haydovchi balansi (state dan hisoblash)
  driverBalance(acc, driverId) {
    const trips = ((load(acc).state.driver_trips || [])).filter(t => t.driverId === driverId);
    const earned = trips.filter(t => !t.isPayment).reduce((s, t) => s + Number(t.price || 0), 0);
    const paid   = trips.filter(t =>  t.isPayment).reduce((s, t) => s + Number(t.price || 0), 0);
    return earned - paid;
  },

  // ── Zayavka bot foydalanuvchi boshqaruvi (global, ko'p-akkaunt) ─────────────
  // Invite code orqali akkaunt topish (barcha akkauntlar ichidan)
  findAccountByInviteCode(code) {
    if (!code) return null;
    try {
      const accs = fs.readdirSync(ACCOUNTS_DIR);
      for (const acc of accs) {
        const cfg = this.getZayavkaConfig(acc);
        if (cfg?.inviteCode && cfg.inviteCode === code) return acc;
      }
    } catch { /* ignore */ }
    return null;
  },
  // ChatId ni akkauntga ulash
  linkZvUser(chatId, accountId) {
    const u = loadZvUsers();
    u[String(chatId)] = accountId;
    _zvUsers = u;
    saveZvUsers();
  },
  // ChatId ning akkauntini topish
  getZvUserAccount(chatId) {
    return loadZvUsers()[String(chatId)] || null;
  },
  // Akkauntdagi barcha ulangan foydalanuvchilar
  getZvUsersForAccount(accountId) {
    const u = loadZvUsers();
    return Object.entries(u).filter(([, acc]) => acc === accountId).map(([chatId]) => chatId);
  },
  // Foydalanuvchini olib tashlash
  unlinkZvUser(chatId) {
    const u = loadZvUsers();
    delete u[String(chatId)];
    _zvUsers = u;
    saveZvUsers();
  },

  // ── Tiket qoldig'ini kamaytirish (bot tomonidan chaqiriladi) ────────────────
  useTicketTonna(acc, ticketId, tonna) {
    const db = load(acc);
    const tickets = db.state.tickets || [];
    const idx = tickets.findIndex(t => t.id === ticketId);
    if (idx === -1) return null;
    tickets[idx] = { ...tickets[idx], usedTonna: (tickets[idx].usedTonna || 0) + Number(tonna) };
    db.state.tickets = tickets;
    persist(acc);
    return tickets[idx];
  },
  getOpenTickets(acc) {
    return (load(acc).state.tickets || []).filter(t => t.status === 'open');
  },

  // ── Zayavka bot konfiguratsiyasi ─────────────────────────────────────────
  getZayavkaConfig(acc)      { return load(acc).zayavkaConfig || null; },
  setZayavkaConfig(acc, cfg) {
    const db = load(acc);
    db.zayavkaConfig = cfg;
    persist(acc);
  },
  // Tartib raqam (har zayavkada oshib boradi)
  nextZayavkaCounter(acc) {
    const db = load(acc);
    db.zayavkaCounter = (db.zayavkaCounter || 0) + 1;
    persist(acc);
    return db.zayavkaCounter;
  },
  // Yuborilgan zayavkalar tarixi
  saveZayavka(acc, record) {
    const db = load(acc);
    if (!db.zayavkaLog) db.zayavkaLog = [];
    db.zayavkaLog.push({ ...record, sentAt: Date.now(), cancelled: false });
    if (db.zayavkaLog.length > 500) db.zayavkaLog = db.zayavkaLog.slice(-500);
    persist(acc);
  },
  getZayavkaLog(acc, limit = 50) {
    const log = load(acc).zayavkaLog || [];
    return log.slice(-limit).reverse();
  },
  // Zayavkani bekor qilish — guruhdan o'chirish uchun ma'lumot qaytaradi
  cancelZayavka(acc, zayavkaId) {
    const db = load(acc);
    const log = db.zayavkaLog || [];
    const idx = log.findIndex(z => z.id === zayavkaId);
    if (idx === -1) return null;
    if (log[idx].cancelled) return null; // allaqachon bekor
    log[idx] = { ...log[idx], cancelled: true, cancelledAt: Date.now() };
    persist(acc);
    return log[idx];
  },
  // Tiket qoldig'ini tiklash (bekor qilinganda teskari yo'nalishda)
  restoreTicketTonna(acc, ticketId, tonna) {
    const db = load(acc);
    const tickets = db.state.tickets || [];
    const idx = tickets.findIndex(t => t.id === ticketId);
    if (idx === -1) return null;
    const restored = Math.max(0, (tickets[idx].usedTonna || 0) - Number(tonna));
    tickets[idx] = { ...tickets[idx], usedTonna: restored };
    db.state.tickets = tickets;
    persist(acc);
    return tickets[idx];
  },
};
