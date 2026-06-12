// Bot orders controller — Telegram botiga tushgan yangi zakazlar navbati.
const db = require('../db');

// GET /api/new_bot_orders
exports.list = (req, res) => {
  res.json(db.getBotOrders(req.user.account));
};

// POST /api/clear_bot_orders
exports.clear = (req, res) => {
  db.clearBotOrders(req.user.account);
  res.json({ success: true });
};
