const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const BOT_ORDERS_FILE = path.join(__dirname, 'bot_orders.json');

app.use(cors());
app.use(bodyParser.json());

// ── BAZA ────────────────────────────────────────────────────────────────────
function readBotOrders() {
  try {
    if (!fs.existsSync(BOT_ORDERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(BOT_ORDERS_FILE, 'utf8'));
  } catch (err) { return []; }
}

function writeBotOrders(data) {
  fs.writeFileSync(BOT_ORDERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── API (Frontend uchun) ────────────────────────────────────────────────────
// Yangi tushgan zakazlarni olish
app.get('/api/new_bot_orders', (req, res) => {
  res.json(readBotOrders());
});

// Zakazlar frontendga o'tkazib bo'lingach, tozalash
app.post('/api/clear_bot_orders', (req, res) => {
  writeBotOrders([]);
  res.json({ success: true });
});

// ── TELEGRAM BOT ────────────────────────────────────────────────────────────
const token = process.env.TELEGRAM_BOT_TOKEN;
if (token && token.trim() !== '' && !token.includes('bu_yerga')) {
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
    if (text === '/start') return;

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
      const tons = parseFloat(text.replace(',', '.'));
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
      
      const newOrder = {
        id: Date.now(),
        createdAt: Date.now(),
        date: new Date().toLocaleDateString('ru-RU'),
        customer: state.customer,
        tons: state.tons,
        note: state.note + ` (Tel: @${msg.from.username || msg.from.first_name})`,
        status: 'kutilmoqda',
        worker: 'Telegram Bot'
      };
      
      const currentOrders = readBotOrders();
      currentOrders.push(newOrder);
      writeBotOrders(currentOrders);
      
      bot.sendMessage(chatId, `✅ Buyurtmangiz qabul qilindi!\n\n👤 Mijoz: ${state.customer}\n⚖️ Tonna: ${state.tons} tn\n📍 Izoh: ${state.note}\n\nTez orada dasturga kelib tushadi.`);
      delete userStates[chatId];
    }
  });
  
  console.log("Telegram Bot muvaffaqiyatli ishga tushdi!");
} else {
  console.log("Diqqat: .env faylida bot tokeni kiritilmagan. Bot ishga tushmadi.");
}

app.listen(PORT, () => {
  console.log(`Backend server ${PORT}-portda ishlamoqda...`);
});
