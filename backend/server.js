// ─────────────────────────────────────────────────────────────────────────────
// Sement Biznes Boshqaruvi — Backend (kirish nuqtasi)
//
// Xavfsiz, qatlamli arxitektura:
//   src/config       — sozlamalar, JWT siri
//   src/middleware   — auth (JWT/RBAC), xavfsizlik (helmet, rate-limit, CORS), xato
//   src/controllers  — so'rovlarni boshqarish
//   src/routes       — API yo'llari
//   src/services     — auth, token, telegram, db (ko'p-akkauntli)
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();

const cron           = require('node-cron');
const createApp      = require('./src/app');
const telegram       = require('./src/services/telegram.service');
const debtReminder   = require('./src/services/debtReminder.service');
const db             = require('./src/db');
const { PORT, NODE_ENV, DEFAULT_ACCOUNT } = require('./src/config');

const app = createApp();
const bot = telegram.start();
if (bot) debtReminder.start(bot);

// ── 6 oydan eski reys rasmlari o'chiriladi (lekin yozuv qoladi) ────────────
cron.schedule('0 3 * * *', () => {
  try {
    const SIX_MONTHS = 6 * 30 * 24 * 60 * 60 * 1000;
    const cutoff     = Date.now() - SIX_MONTHS;
    const state      = db.getState(DEFAULT_ACCOUNT);
    const trips      = state.driver_trips || [];
    let changed      = false;
    trips.forEach(t => {
      if (t.photoFileId && t.createdAt && t.createdAt < cutoff) {
        t.photoFileId = null;
        changed = true;
      }
    });
    if (changed) {
      state.driver_trips = trips;
      db.setState(DEFAULT_ACCOUNT, state);
      console.log('[Cron] Eski reys rasmlari o\'chirildi.');
    }
  } catch (e) { console.error('[Cron] rasm tozalash xatosi:', e.message); }
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Backend ${PORT}-portda ishlamoqda  (${NODE_ENV})`);
  console.log('   Ma\'lumotlar: backend/data/accounts/<akkaunt>/db.json');
  console.log('   Himoya: JWT auth, helmet, rate-limit, CORS allowlist');
});

// Tutib bo'lmagan xatolarda ham server qulamasin
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err?.message || err));
process.on('uncaughtException',  (err) => console.error('[uncaughtException]', err?.message || err));

// Toza to'xtatish
const shutdown = () => { console.log('\nServer to\'xtatilmoqda...'); server.close(() => process.exit(0)); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
