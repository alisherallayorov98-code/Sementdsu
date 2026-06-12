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

const createApp = require('./src/app');
const telegram  = require('./src/services/telegram.service');
const { PORT, NODE_ENV } = require('./src/config');

const app = createApp();
telegram.start();

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
