// ─────────────────────────────────────────────────────────────────────────────
// Telegram bot xizmati. Token faqat .env'da (TELEGRAM_BOT_TOKEN).
//  - Botga tushgan zakazlar 'default' akkaunt navbatiga yoziladi (frontend o'qiydi).
//  - Mijoz raqamini ulashi: bot foydalanuvchidan kontakt so'raydi → telefon↔chatId
//    bog'lanadi (db.tgContacts). Shu orqali kompyuterdan mijozga xabar yuboramiz.
//  - sendMessage(chatId, text) — tashqaridan (notify controller) chaqiriladi.
// Eslatma: Telegram bot faqat botni START qilgan odamga yoza oladi.
// ─────────────────────────────────────────────────────────────────────────────
const TelegramBot = require('node-telegram-bot-api');
const db = require('../db');
const { TELEGRAM_TOKEN, DEFAULT_ACCOUNT } = require('../config');

let running = false;
let bot = null;
const isRunning = () => running;

const shareKeyboard = {
  reply_markup: {
    keyboard: [[{ text: '📱 Raqamni ulashish', request_contact: true }]],
    resize_keyboard: true, one_time_keyboard: true,
  },
};

function start() {
  if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN.includes('bu_yerga')) {
    console.log('ℹ️  TELEGRAM_BOT_TOKEN kiritilmagan. Bot ishlamaydi (qolgan qism normal ishlaydi).');
    return;
  }

  bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  const userStates = {};

  bot.onText(/\/start/, (msg) => {
    userStates[msg.chat.id] = { step: 1 };
    bot.sendMessage(msg.chat.id,
      'Assalomu alaykum! 👋\n\nXabarlar (chek, qarz eslatmasi) olib turish uchun raqamingizni ulang — pastdagi "📱 Raqamni ulashish" tugmasini bosing.\n\nBuyurtma berish uchun esa Ismingiz yoki Korxona nomini yozing:',
      shareKeyboard);
  });

  // Raqam ulash uchun alohida buyruq
  bot.onText(/\/ulash/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Raqamingizni ulash uchun tugmani bosing:', shareKeyboard);
  });

  // Kontakt ulashilganda — telefon↔chatId bog'lash
  bot.on('contact', (msg) => {
    try {
      const phone = msg.contact.phone_number;
      const name  = [msg.contact.first_name, msg.contact.last_name].filter(Boolean).join(' ');
      db.upsertTgContact(DEFAULT_ACCOUNT, { phone, chatId: msg.chat.id, name });
      bot.sendMessage(msg.chat.id,
        `✅ Rahmat! Raqamingiz ulandi (${phone}).\nEndi do'kondan sizga chek va eslatmalar shu yerga keladi.`,
        { reply_markup: { remove_keyboard: true } });
    } catch (e) {
      console.error('[Telegram] contact xatosi:', e.message);
    }
  });

  bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text || text.startsWith('/') || msg.contact) return;

    const state = userStates[chatId];
    if (!state) { bot.sendMessage(chatId, "Buyurtma berish uchun /start, raqam ulash uchun /ulash buyrug'ini yuboring."); return; }

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

// Tashqaridan xabar yuborish (notify controller)
async function sendMessage(chatId, text) {
  if (!running || !bot) throw new Error('Telegram bot ishlamayapti (token kiritilmagan).');
  if (!chatId) throw new Error('chatId yo\'q (mijoz raqamini ulamagan).');
  await bot.sendMessage(chatId, text);
  return true;
}

module.exports = { start, isRunning, sendMessage };
