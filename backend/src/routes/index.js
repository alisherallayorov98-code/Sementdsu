// Barcha API yo'llarini yig'uvchi router
const express = require('express');
const { authenticate }   = require('../middleware/auth');
const { loginLimiter }   = require('../middleware/security');
const auth      = require('../controllers/auth.controller');
const state     = require('../controllers/state.controller');
const botOrders = require('../controllers/botOrders.controller');

const router = express.Router();

// ── Auth (ochiq) ──────────────────────────────────────────────────────────
router.post('/auth/login', loginLimiter, auth.login);
router.get('/auth/me', authenticate, auth.me);

// ── Holat (himoyalangan) ──────────────────────────────────────────────────
router.get('/state', authenticate, state.get);
router.put('/state', authenticate, state.put);

// ── Telegram navbati (himoyalangan) ───────────────────────────────────────
router.get('/new_bot_orders', authenticate, botOrders.list);
router.post('/clear_bot_orders', authenticate, botOrders.clear);

module.exports = router;
