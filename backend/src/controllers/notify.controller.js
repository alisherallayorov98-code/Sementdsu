// ─────────────────────────────────────────────────────────────────────────────
// Bildirishnoma controller — mijozga Telegram va/yoki SMS yuborish.
// ─────────────────────────────────────────────────────────────────────────────
const db = require('../db');
const tg = require('../services/telegram.service');
const sms = require('../services/sms.service');

// GET /api/tg_contacts — ulangan raqamlar + kanal holati (frontend ko'rsatadi)
exports.status = (req, res) => {
  const acc = req.user.account;
  res.json({
    ok: true,
    contacts: db.getTgContacts(acc),     // [{ phone, chatId, name, at }]
    botRunning: tg.isRunning(),
    smsConfigured: sms.isConfigured(),
  });
};

// POST /api/notify  { phone, chatId, text, channels: ['telegram','sms'] }
exports.send = async (req, res) => {
  const acc = req.user.account;
  const { phone = '', text = '', channels = [] } = req.body || {};
  let { chatId = null } = req.body || {};

  if (!text.trim()) return res.status(400).json({ ok: false, error: 'Xabar matni bo\'sh' });
  if (text.length > 1000) return res.status(400).json({ ok: false, error: 'Xabar matni juda uzun (1000 belgidan oshmasin)' });
  if (!Array.isArray(channels) || channels.length === 0) {
    return res.status(400).json({ ok: false, error: 'Kanal tanlanmagan' });
  }

  const result = {};

  // ── Telegram ──────────────────────────────────────────────────────────────
  if (channels.includes('telegram')) {
    try {
      if (!chatId) chatId = db.findChatId(acc, phone);
      if (!chatId) throw new Error('Mijoz Telegram raqamini ulamagan');
      await tg.sendMessage(chatId, text);
      result.telegram = { ok: true };
    } catch (e) {
      result.telegram = { ok: false, error: e.message };
    }
  }

  // ── SMS ─────────────────────────────────────────────────────────────────────
  if (channels.includes('sms')) {
    try {
      if (!phone) throw new Error('Telefon raqami yo\'q');
      const r = await sms.sendSms(phone, text);
      result.sms = { ok: true, id: r.id };
    } catch (e) {
      result.sms = { ok: false, error: e.message };
    }
  }

  const anyOk = Object.values(result).some(r => r.ok);
  res.json({ ok: anyOk, result });
};

// POST /api/notify_sale — savdo qilinganda mijozga avtomatik xabar
exports.notifySale = async (req, res) => {
  const acc = req.user.account;
  const data = req.body || {};
  try {
    const result = await tg.notifySale(acc, data);
    res.json(result);
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
};

// POST /api/notify_order_done — zakaz bajarilganda mijozga xabar
// { chatId, customer, tons, brand, tur, note }
exports.notifyOrderDone = async (req, res) => {
  const { chatId, customer, tons, brand, tur, note } = req.body || {};
  try {
    const result = await tg.notifyOrderDone(chatId, { customer, tons, brand, tur, note });
    res.json(result);
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
};
