// ─────────────────────────────────────────────────────────────────────────────
// Express ilovasini yig'ish: xavfsizlik middleware'lari → marshrutlar → xato boshqaruvi.
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const { helmet, corsMw, apiLimiter } = require('./middleware/security');
const { notFound, errorHandler }      = require('./middleware/error');
const { isRunning }  = require('./services/telegram.service');
const { MAX_BODY, DEFAULT_ACCOUNT } = require('./config');
const db = require('./db');
const routes = require('./routes');

function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet);                          // xavfsiz HTTP sarlavhalari
  app.use(corsMw);                          // CORS allowlist
  app.use(express.json({ limit: MAX_BODY })); // JSON tana hajmi cheklovi

  app.use('/api', apiLimiter);              // chastota cheklovi

  // Sog'lik tekshiruvi (ochiq, maxfiy ma'lumotsiz)
  app.get('/api/health', (req, res) =>
    res.json({ ok: true, botRunning: isRunning(), ...db.info(DEFAULT_ACCOUNT) }));

  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
