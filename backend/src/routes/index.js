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

// ── Bot username (haydovchi/mijoz ssilkasi uchun) ─────────────────────────
router.get('/bot_info', authenticate, (req, res) => {
  const { TELEGRAM_BOT_USER } = require('../config');
  res.json({ botUsername: TELEGRAM_BOT_USER });
});

// ── Mijozga sotuv xabari ──────────────────────────────────────────────────
// POST /notify_customer_sale — sklad (kg) yoki ulgurji (tonna) sotilganda
router.post('/notify_customer_sale', authenticate, async (req, res) => {
  try {
    const acc = req.user.account;
    const { customerName, kg, cementType, pricePerKg, channel, totalDebt, tons, pricePerTon } = req.body;
    if (!customerName) return res.json({ ok: false, error: 'customerName kerak' });

    const state     = db.getState(acc);
    const customers = state.customers || [];
    const customer  = customers.find(c => c.name.trim().toLowerCase() === String(customerName).trim().toLowerCase());

    if (!customer)                return res.json({ ok: false, error: 'Mijoz topilmadi' });
    if (!customer.telegramChatId) return res.json({ ok: false, error: 'Mijoz Telegram ga ulanmagan' });

    const fmt    = n => Number(n).toLocaleString('ru-RU').replace(/,/g, ' ');
    const chStr  = { naqd: '💵 Naqd pul', bank: '🏦 Bank ko\'chirmasi', click: '📱 Click/Payme', nasiya: '⚠️ Nasiyaga' }[channel] || '';

    // Tons (ulgurji) yoki kg (sklad) formatini aniqlash
    let quantityStr, total, priceStr;
    if (tons) {
      const fmtTn = n => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };
      quantityStr = `${fmtTn(tons)} tonna`;
      total       = Number(tons) * Number(pricePerTon || 0);
      priceStr    = `${fmt(pricePerTon)} so'm/tn`;
    } else {
      quantityStr = `${fmt(kg)} kg`;
      total       = Number(kg) * Number(pricePerKg || 0);
      priceStr    = `${fmt(pricePerKg)} so'm/kg`;
    }

    const lines = [
      `🧾 *Xarid tasdiqlandi!*`,
      ``,
      `📦 ${quantityStr}${cementType ? ` — ${cementType}` : ''}`,
      `💰 Narx: *${fmt(total)} so'm* (${priceStr})`,
      `💳 To'lov: ${chStr}`,
    ];
    if (Number(totalDebt) > 0) {
      lines.push(``, `📊 *Hisob holati:*`, `  • Jami qarzingiz: *${fmt(totalDebt)} so'm*`);
    } else {
      lines.push(``, `✅ Qarzingiz yo'q`);
    }

    const tg = require('../services/telegram.service');
    if (!tg.isRunning()) return res.json({ ok: false, error: 'Bot ishlamayapti' });
    await tg.getBot().sendMessage(customer.telegramChatId, lines.join('\n'), { parse_mode: 'Markdown' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Mijozga to'lov qabul qilindi xabari ───────────────────────────────────
// POST /notify_customer_payment — kassir kirim qilganda mijozga Telegram xabar
router.post('/notify_customer_payment', authenticate, async (req, res) => {
  try {
    const acc = req.user.account;
    const { customerName, amount, channel, totalDebt } = req.body;
    if (!customerName || !amount) return res.json({ ok: false, error: 'customerName va amount kerak' });

    const state     = db.getState(acc);
    const customers = state.customers || [];
    const customer  = customers.find(c => c.name.trim().toLowerCase() === String(customerName).trim().toLowerCase());

    if (!customer)                return res.json({ ok: false, error: 'Mijoz topilmadi' });
    if (!customer.telegramChatId) return res.json({ ok: false, error: 'Mijoz Telegram ga ulanmagan' });

    const fmt   = n => Number(n).toLocaleString('ru-RU').replace(/,/g, ' ');
    const chStr = { naqd: '💵 Naqd pul', bank: '🏦 Bank ko\'chirmasi', click: '📱 Click/Payme' }[channel] || '';
    const debt  = Number(totalDebt);

    const lines = [
      `💳 *To'lovingiz qabul qilindi!*`,
      ``,
      `📥 Miqdor: *${fmt(amount)} so'm* ${chStr}`,
      ``,
      debt > 0
        ? `📊 Qolgan qarzingiz: *${fmt(debt)} so'm*`
        : `✅ Qarzingiz yo'q, rahmat!`,
    ];

    const tg = require('../services/telegram.service');
    if (!tg.isRunning()) return res.json({ ok: false, error: 'Bot ishlamayapti' });
    await tg.getBot().sendMessage(customer.telegramChatId, lines.join('\n'), { parse_mode: 'Markdown' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Haydovchiga to'lov xabari ─────────────────────────────────────────────
// POST /driver_payment_notify — kassir haydovchiga pul berganda Telegram xabar
router.post('/driver_payment_notify', authenticate, async (req, res) => {
  try {
    const acc        = req.user.account;
    const { driverName, amount, channel } = req.body;
    if (!driverName || !amount) return res.json({ ok: false, error: 'driverName va amount kerak' });

    const state   = db.getState(acc);
    const drivers = state.drivers || [];
    const trips   = state.driver_trips || [];
    const driver  = drivers.find(d => d.name.trim().toLowerCase() === String(driverName).trim().toLowerCase());

    if (!driver) return res.json({ ok: false, error: 'Haydovchi topilmadi' });
    if (!driver.telegramChatId) return res.json({ ok: false, error: 'Haydovchi Telegram ga ulanmagan' });

    // Balans hisoblash
    const driverTrips = trips.filter(t => t.driverId === driver.id);
    const earned = driverTrips.filter(t => !t.isPayment).reduce((s, t) => s + Number(t.price || 0), 0);

    // To'lovlar: driver_trips (isPayment) + kassir chiqim yozuvlari (cashRows/bankRows/clickRows)
    const tripPaid = driverTrips.filter(t => t.isPayment).reduce((s, t) => s + Number(t.price || 0), 0);
    const driverNameLc = driver.name.trim().toLowerCase();
    const kassiPaid = ['cashRows', 'bankRows', 'clickRows'].reduce((sum, key) => {
      const rows = state[key] || [];
      return sum + rows
        .filter(r => Number(r.amount) < 0 && (r.customer || '').trim().toLowerCase() === driverNameLc)
        .reduce((s, r) => s + Math.abs(Number(r.amount)), 0);
    }, 0);
    // amount — hozir berilgan to'lov, state hali saqlanmagan bo'lishi mumkin
    const paid    = tripPaid + kassiPaid + Number(amount);
    const balance = earned - paid;

    const fmt = (n) => Number(n).toLocaleString('ru-RU').replace(/,/g, ' ');
    const chStr = { naqd: '💵 Naqd pul', bank: '🏦 Bank ko\'chirmasi', click: '📱 Click/Payme' }[channel] || '';

    const text = [
      `💰 *To'lov qabul qilindi!*`,
      ``,
      `📥 Miqdor: *${fmt(amount)} so'm* ${chStr}`,
      ``,
      `📊 *Hisob holati:*`,
      `  • Jami ishladi: ${fmt(earned)} so'm`,
      `  • Jami to'landi: ${fmt(paid)} so'm`,
      balance > 0
        ? `  • 💸 Sizga qarz: *${fmt(balance)} so'm*`
        : balance < 0
          ? `  • ⚠️ Kompaniyaga qarzingiz: *${fmt(Math.abs(balance))} so'm*`
          : `  • ✅ Hisob-kitob tengdir`,
    ].join('\n');

    const tg = require('../services/telegram.service');
    if (!tg.isRunning()) return res.json({ ok: false, error: 'Bot ishlamayapti' });
    const bot = tg.getBot();
    await bot.sendMessage(driver.telegramChatId, text, { parse_mode: 'Markdown' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

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
  const acc = req.user.account;
  const cfg = db.getZayavkaConfig(acc) || {};
  // inviteCode avtomatik yaratish (birinchi marta)
  if (!cfg.inviteCode) {
    const crypto = require('crypto');
    cfg.inviteCode = crypto.randomBytes(8).toString('hex');
    db.setZayavkaConfig(acc, cfg);
  }
  const { botToken: _, ...safe } = cfg;
  res.json({ ok: true, config: { ...safe, hasToken: !!(cfg.botToken) } });
});

// PUT /zayavka_config — konfiguratsiyani saqlash
router.put('/zayavka_config', authenticate, authorize('admin'), (req, res) => {
  const acc = req.user.account;
  const old = db.getZayavkaConfig(acc) || {};
  const body = req.body || {};
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
    autoFields:     body.autoFields      ?? old.autoFields      ?? ['sana'],
    companyName:    body.companyName     ?? old.companyName     ?? '',
    inviteCode:     old.inviteCode       ?? '',   // o'zgartirilmaydi (regenerate orqali)
  };
  db.setZayavkaConfig(acc, cfg);

  const zbSvc = require('../services/zayavkaBot.service');
  zbSvc.stop();
  setTimeout(() => zbSvc.start(acc), 500);

  res.json({ ok: true });
});

// POST /zayavka_config/regenerate_invite — yangi invite code yaratish
router.post('/zayavka_config/regenerate_invite', authenticate, authorize('admin'), (req, res) => {
  const acc    = req.user.account;
  const crypto = require('crypto');
  const old    = db.getZayavkaConfig(acc) || {};
  const newCode = crypto.randomBytes(8).toString('hex');
  db.setZayavkaConfig(acc, { ...old, inviteCode: newCode });
  // Eski foydalanuvchilarni o'chirish (ixtiyoriy)
  if (req.body?.revokeUsers) {
    const users = db.getZvUsersForAccount(acc);
    users.forEach(chatId => db.unlinkZvUser(chatId));
  }
  res.json({ ok: true, inviteCode: newCode });
});

// GET /zayavka_log — oxirgi zayavkalar tarixi
router.get('/zayavka_log', authenticate, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  res.json({ ok: true, log: db.getZayavkaLog(req.user.account, limit) });
});

module.exports = router;
