// ─────────────────────────────────────────────────────────────────────────────
// Express ilovasini yig'ish: xavfsizlik middleware'lari → marshrutlar → xato boshqaruvi.
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const { helmet, corsMw, apiLimiter } = require('./middleware/security');
const { notFound, errorHandler }      = require('./middleware/error');
const tg             = require('./services/telegram.service');
const { isRunning }  = tg;
const { MAX_BODY, DEFAULT_ACCOUNT } = require('./config');
const db = require('./db');
const routes = require('./routes');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);               // nginx reverse proxy orqasi

  app.use(helmet);                          // xavfsiz HTTP sarlavhalari
  app.use(corsMw);                          // CORS allowlist
  app.use(express.json({ limit: MAX_BODY })); // JSON tana hajmi cheklovi

  app.use('/api', apiLimiter);              // chastota cheklovi

  // Sog'lik tekshiruvi (ochiq, maxfiy ma'lumotsiz).
  // botRunning uchun health() ishlatiladi: isRunning() bot ishga tushganini
  // bildiradi, lekin Telegram bilan aloqa uzilgan bo'lsa ham true qaytaradi —
  // ya'ni nazorat qilayotgan odam botni sog'lom deb o'ylab yurishi mumkin.
  app.get('/api/health', (req, res) => {
    const h = tg.health ? tg.health() : { running: isRunning(), healthy: isRunning() };
    res.json({
      ok: true,
      botRunning: h.healthy,
      botErrors: h.errorCount || 0,
      ...db.info(DEFAULT_ACCOUNT),
    });
  });

  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
