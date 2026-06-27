// Barcha API yo'llarini yig'uvchi router
const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { loginLimiter }   = require('../middleware/security');
const auth      = require('../controllers/auth.controller');
const state     = require('../controllers/state.controller');
const botOrders = require('../controllers/botOrders.controller');
const auditCtrl = require('../controllers/audit.controller');
const notify    = require('../controllers/notify.controller');
const system    = require('../controllers/system.controller');
const debtReminder = require('../services/debtReminder.service');
const db        = require('../db');
const { DEFAULT_ACCOUNT } = require('../config');

const router = express.Router();

// ── Auth (ochiq) ──────────────────────────────────────────────────────────
router.post('/auth/login', loginLimiter, auth.login);
router.post('/auth/signup', loginLimiter, auth.signup);
router.get('/auth/me', authenticate, auth.me);

// ── Holat (himoyalangan) ──────────────────────────────────────────────────
router.get('/state', authenticate, state.get);
router.put('/state', authenticate, state.put);

// ── Telegram navbati (himoyalangan) ───────────────────────────────────────
router.get('/new_bot_orders', authenticate, botOrders.list);
router.post('/clear_bot_orders', authenticate, botOrders.clear);

// ── Audit / Nazorat jurnali (FAQAT admin) ─────────────────────────────────
router.get('/audit', authenticate, authorize('admin'), auditCtrl.list);

// ── Server holati / resurslar (FAQAT admin) ───────────────────────────────
router.get('/system', authenticate, authorize('admin'), system.status);

// ── Qarz eslatma — qo'lda ishga tushirish (FAQAT admin) ──────────────────
router.post('/send_debt_reminders', authenticate, authorize('admin'), async (req, res) => {
  try {
    const tg = require('../services/telegram.service');
    if (!tg.isRunning()) return res.status(503).json({ ok: false, error: 'Telegram bot ishlamayapti' });
    const bot = tg.getBot();
    const result = await debtReminder.sendDebtReminders(bot, req.user.account);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Bildirishnoma (Telegram / SMS) ─────────────────────────────────────────
router.get('/tg_contacts', authenticate, notify.status);
router.post('/notify', authenticate, notify.send);
router.post('/notify_sale', authenticate, notify.notifySale);
router.post('/notify_order_done', authenticate, notify.notifyOrderDone);

// ── Haydovchi pending reyslari ─────────────────────────────────────────────
// GET /driver_trips/pending — kutilayotgan reyslari ro'yxati
router.get('/driver_trips/pending', authenticate, (req, res) => {
  const acc = req.user.account;
  const trips = db.getPendingDriverTrips(acc);
  res.json({ ok: true, trips });
});

// POST /driver_trips/approve/:id — reysni tasdiqlash
router.post('/driver_trips/approve/:id', authenticate, async (req, res) => {
  const acc    = req.user.account;
  const tripId = Number(req.params.id);
  try {
    const tg = require('../services/telegram.service');
    if (tg.isRunning()) {
      const ok = await tg.doApproveTrip(acc, tripId, null);
      res.json({ ok });
    } else {
      // Bot ishlamasa ham state ga qo'shish
      const result = db.approveDriverTrip(acc, tripId);
      res.json({ ok: !!result });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /driver_trips/reject/:id — reysni rad etish
router.post('/driver_trips/reject/:id', authenticate, async (req, res) => {
  const acc    = req.user.account;
  const tripId = Number(req.params.id);
  const { reason = '' } = req.body || {};
  try {
    const tg = require('../services/telegram.service');
    if (tg.isRunning()) {
      const ok = await tg.doRejectTrip(acc, tripId, null, reason);
      res.json({ ok });
    } else {
      db.removePendingDriverTrip(acc, tripId);
      res.json({ ok: true });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /driver_trips/photo_url/:fileId — Telegram rasm URL
router.get('/driver_trips/photo_url/:fileId', authenticate, async (req, res) => {
  try {
    const tg  = require('../services/telegram.service');
    const url = await tg.getPhotoUrl(req.params.fileId);
    res.json({ ok: !!url, url: url || null });
  } catch (e) {
    res.json({ ok: false, url: null });
  }
});

// ── Zayavka bot konfiguratsiyasi ───────────────────────────────────────────
// GET /zayavka_config — konfiguratsiyani olish
router.get('/zayavka_config', authenticate, authorize('admin'), (req, res) => {
  const cfg = db.getZayavkaConfig(req.user.account) || {};
  // botToken ni response dan olib tashlaymiz (xavfsizlik)
  const { botToken: _, ...safe } = cfg;
  res.json({ ok: true, config: { ...safe, hasToken: !!(cfg.botToken) } });
});

// PUT /zayavka_config — konfiguratsiyani saqlash
router.put('/zayavka_config', authenticate, authorize('admin'), (req, res) => {
  const acc = req.user.account;
  const old = db.getZayavkaConfig(acc) || {};
  const body = req.body || {};
  // Token berilmagan bo'lsa yoki '***' bo'lsa — eskisini saqlaymiz
  const botToken = (body.botToken && body.botToken !== '***')
    ? body.botToken.trim()
    : old.botToken;
  const cfg = {
    botToken,
    groupChatId:    body.groupChatId    ?? old.groupChatId,
    template:       body.template       ?? old.template,
    fieldLabels:    body.fieldLabels    ?? old.fieldLabels    ?? {},
    fieldOptions:   body.fieldOptions   ?? old.fieldOptions   ?? {},
    optionalFields: body.optionalFields ?? old.optionalFields ?? [],
    fieldDefaults:  body.fieldDefaults  ?? old.fieldDefaults  ?? {},
    autoFields:     body.autoFields     ?? old.autoFields     ?? ['sana'],
  };
  db.setZayavkaConfig(acc, cfg);

  // Bot ni restart qilish (token yoki config o'zgardi)
  const zbSvc = require('../services/zayavkaBot.service');
  zbSvc.stop();
  setTimeout(() => zbSvc.start(acc), 500);

  res.json({ ok: true });
});

// GET /zayavka_log — oxirgi zayavkalar tarixi
router.get('/zayavka_log', authenticate, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  res.json({ ok: true, log: db.getZayavkaLog(req.user.account, limit) });
});

module.exports = router;
