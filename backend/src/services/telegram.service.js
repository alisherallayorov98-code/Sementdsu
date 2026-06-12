// ─────────────────────────────────────────────────────────────────────────────
// Telegram bot xizmati. Token faqat .env'da (TELEGRAM_BOT_TOKEN).
// Botga tushgan zakazlar 'default' akkaunt navbatiga yoziladi, frontend o'qib oladi.
// ─────────────────────────────────────────────────────────────────────────────
const TelegramBot = require('node-telegram-bot-api');
const db = require('../db');
const { TELEGRAM_TOKEN, DEFAULT_ACCOUNT } = require('../config');

let running = false;
const isRunning = () => running;

function start() {
  if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN.includes('bu_yerga')) {
    console.log('ℹ️  TELEGRAM_BOT_TOKEN kiritilmagan. Bot ishlamaydi (qolgan qism normal ishlaydi).');
    return;
  }

  const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  const userStates = {};

  bot.onText(/\/start/, (msg) => {
    userStates[msg.chat.id] = { step: 1 };
    bot.sendMessage(msg.chat.id, 'Assalomu alaykum! Sement buyurtma berish uchun Ismingiz yoki Korxona nomini yozing:');
  });

  bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text || text === '/start') return;

    const state = userStates[chatId];
    if (!state) { bot.sendMessage(chatId, "Iltimos, avval /start buyrug'ini yuboring."); return; }

    if (state.step === 1) {
      state.customer = text; state.step = 2;
      bot.sendMessage(chatId, 'Yaxshi! Endi necha tonna kerakligini raqamda yozing (masalan: 10 yoki 5.5):');
    } else if (state.step === 2) {
      const tons = parseFloat(String(text).replace(',', '.'));
      if (isNaN(tons)) { bot.sendMessage(chatId, "Iltimos, tonnani to'g'ri raqamda kiriting!"); return; }
      state.tons = tons; state.step = 3;
      bot.sendMessage(chatId, "Manzilni yoki qo'shimcha izohni yozing:");
    } else if (state.step === 3) {
      state.note = text;
      const handle = msg.from.username ? '@' + msg.from.username : (msg.from.first_name || 'mijoz');
      db.addBotOrder(DEFAULT_ACCOUNT, {
        id: Date.now(), createdAt: Date.now(),
        date: new Date().toLocaleDateString('ru-RU'),
        customer: state.customer, tons: state.tons,
        note: `${state.note} (Tel: ${handle})`,
        status: 'kutilmoqda', worker: 'Telegram Bot',
      });
      bot.sendMessage(chatId, `✅ Buyurtmangiz qabul qilindi!\n\n👤 Mijoz: ${state.customer}\n⚖️ Tonna: ${state.tons} tn\n📍 Izoh: ${state.note}\n\nTez orada dasturga kelib tushadi.`);
      delete userStates[chatId];
    }
  });

  bot.on('polling_error', (err) => console.error('[Telegram] polling xatosi:', err.code || err.message));

  running = true;
  console.log('✅ Telegram Bot ishga tushdi!');
}

module.exports = { start, isRunning };
