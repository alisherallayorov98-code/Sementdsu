// ─────────────────────────────────────────────────────────────────────────────
// Sement Biznes Boshqaruvi — Backend
//
// Vazifasi:
//   1) Dasturning BUTUN holatini serverda saqlaydi (data/db.json) — shu tufayli
//      ma'lumot bitta brauzerga bog'liq emas, ko'p qurilmada bir xil va backupli.
//   2) Telegram botini boshqaradi (token faqat shu yerda, .env faylida).
//      Botga tushgan zakazlar navbatga yoziladi, frontend ularni o'qib oladi.
// ─────────────────────────────────────────────────────────────────────────────
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const TelegramBot  = require('node-telegram-bot-api');
require('dotenv').config();

const db = require('./db');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '25mb' })); // holat kattalashishi mumkin

// ── Holat (state) API ────────────────────────────────────────────────────────
// Frontend ishga tushganda butun holatni shu yerdan oladi.
app.get('/api/state', (req, res) => {
  res.json(db.getState());
});

// Frontend har bir o'zgarishdan keyin butun holatni shu yerga saqlaydi.
app.put('/api/state', (req, res) => {
  try {
    const updatedAt = db.setState(req.body);
    res.json({ ok: true, updatedAt });
  } catch (err) {
    console.error('[API] state saqlashda xato:', err.message);
    res.status(500).json({ ok: false, error: 'Saqlab bo\'lmadi' });
  }
});

// ── Telegram bot navbati ─────────────────────────────────────────────────────
// Frontend yangi tushgan zakazlarni shu yerdan o'qiydi.
app.get('/api/new_bot_orders', (req, res) => {
  res.json(db.getBotOrders());
});

// Zakazlar frontendga o'tkazib bo'lingach, navbatni tozalaydi.
app.post('/api/clear_bot_orders', (req, res) => {
  db.clearBotOrders();
  res.json({ success: true });
});

// ── Holat / sog'lik ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ ok: true, botRunning: BOT_RUNNING, ...db.info() });
});

// ── TELEGRAM BOT ─────────────────────────────────────────────────────────────
let BOT_RUNNING = false;
const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();

if (token && !token.includes('bu_yerga')) {
  const bot = new TelegramBot(token, { polling: true });
  const userStates = {};

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    userStates[chatId] = { step: 1 };
    bot.sendMessage(chatId, "Assalomu alaykum! Sement buyurtma berish uchun Ismingiz yoki Korxona nomini yozing:");
  });

  bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text || text === '/start') return;

    const state = userStates[chatId];
    if (!state) {
      bot.sendMessage(chatId, "Iltimos, avval /start buyrug'ini yuboring.");
      return;
    }

    if (state.step === 1) {
      state.customer = text;
      state.step = 2;
      bot.sendMessage(chatId, "Yaxshi! Endi necha tonna kerakligini raqamda yozing (masalan: 10 yoki 5.5):");
    }
    else if (state.step === 2) {
      const tons = parseFloat(String(text).replace(',', '.'));
      if (isNaN(tons)) {
        bot.sendMessage(chatId, "Iltimos, tonnani to'g'ri raqamda kiriting!");
        return;
      }
      state.tons = tons;
      state.step = 3;
      bot.sendMessage(chatId, "Manzilni yoki qo'shimcha izohni yozing:");
    }
    else if (state.step === 3) {
      state.note = text;

      const handle = msg.from.username ? '@' + msg.from.username : (msg.from.first_name || 'mijoz');
      const newOrder = {
        id: Date.now(),
        createdAt: Date.now(),
        date: new Date().toLocaleDateString('ru-RU'),
        customer: state.customer,
        tons: state.tons,
        note: `${state.note} (Tel: ${handle})`,
        status: 'kutilmoqda',
        worker: 'Telegram Bot',
      };

      db.addBotOrder(newOrder);

      bot.sendMessage(chatId, `✅ Buyurtmangiz qabul qilindi!\n\n👤 Mijoz: ${state.customer}\n⚖️ Tonna: ${state.tons} tn\n📍 Izoh: ${state.note}\n\nTez orada dasturga kelib tushadi.`);
      delete userStates[chatId];
    }
  });

  bot.on('polling_error', (err) => {
    console.error('[Telegram] polling xatosi:', err.code || err.message);
  });

  BOT_RUNNING = true;
  console.log('✅ Telegram Bot muvaffaqiyatli ishga tushdi!');
} else {
  console.log('ℹ️  Diqqat: .env faylida TELEGRAM_BOT_TOKEN kiritilmagan. Bot ishlamaydi (dasturning qolgan qismi normal ishlaydi).');
}

app.listen(PORT, () => {
  console.log(`🚀 Backend server ${PORT}-portda ishlamoqda...`);
  console.log(`   Holat fayli: backend/data/db.json`);
});
