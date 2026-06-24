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

// ── Bildirishnoma (Telegram / SMS) ─────────────────────────────────────────
router.get('/tg_contacts', authenticate, notify.status);
router.post('/notify', authenticate, notify.send);
router.post('/notify_sale', authenticate, notify.notifySale);
router.post('/notify_order_done', authenticate, notify.notifyOrderDone);

module.exports = router;
