// ─────────────────────────────────────────────────────────────────────────────
// Telegram bot xizmati.
//  - Zakaz berish: /zakaz → ism → marka (inline) → tur (inline) → tonna → izoh
//  - Raqam ulash: /ulash → kontakt yuborish
//  - Avtomatik xabar: notifySale() — savdo qilinganda mijozga chiqadi
// ─────────────────────────────────────────────────────────────────────────────
const TelegramBot = require('node-telegram-bot-api');
const db = require('../db');
const { TELEGRAM_TOKEN, DEFAULT_ACCOUNT } = require('../config');

let running = false;
let bot = null;
const isRunning = () => running;

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const CH  = { naqd: '💵 Naqd', bank: '🏦 Bank', click: '📱 Click', nasiya: '⚠️ Nasiya (qarz)', avans: '🅰️ Avans' };

const BRANDS = ['32.5H', '42.5B-K', '42.5N', '52.5'];
const TURLAR = ['📦 Qoplik', '🌫 Rasipnoy'];

const shareKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: '📱 Raqamni ulashish', request_contact: true }],
    ],
    resize_keyboard: true, one_time_keyboard: true,
  },
};

function brandKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        BRANDS.slice(0, 2).map(b => ({ text: b, callback_data: `brand:${b}` })),
        BRANDS.slice(2).map(b => ({ text: b, callback_data: `brand:${b}` })),
        [{ text: '🔤 Boshqa (yozib kiriting)', callback_data: 'brand:other' }],
      ],
    },
  };
}

function turKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        TURLAR.map(t => ({ text: t, callback_data: `tur:${t}` })),
      ],
    },
  };
}

function start() {
  if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN.length < 10) {
    console.log('ℹ️  TELEGRAM_BOT_TOKEN kiritilmagan. Bot ishlamaydi (qolgan qism normal ishlaydi).');
    return;
  }

  bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  const states = {}; // chatId → { step, customer, brand, tur, tons, note }

  // ── /start ────────────────────────────────────────────────────────────────
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    states[chatId] = null;
    bot.sendMessage(chatId,
      '🏗 *Sement do\'koni botiga xush kelibsiz!*\n\nQuyidagi tugmalardan birini tanlang:',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📦 Sement buyurtma berish', callback_data: 'menu:zakaz' }],
            [{ text: '📱 Raqamni ulash (xabar va chek olish)', callback_data: 'menu:ulash' }],
          ],
        },
      });
  });

  // ── /ulash ────────────────────────────────────────────────────────────────
  bot.onText(/\/ulash/, (msg) => {
    bot.sendMessage(msg.chat.id,
      'Raqamingizni ulash uchun quyidagi tugmani bosing:', shareKeyboard);
  });

  // ── /zakaz ────────────────────────────────────────────────────────────────
  bot.onText(/\/zakaz/, (msg) => {
    const chatId = msg.chat.id;
    states[chatId] = { step: 'name' };
    bot.sendMessage(chatId,
      '📋 *Yangi zakaz*\n\nIsmingiz yoki korxona nomingizni yozing:',
      { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } });
  });

  // ── Kontakt ulashilganda ──────────────────────────────────────────────────
  bot.on('contact', (msg) => {
    try {
      const phone = msg.contact.phone_number;
      const name  = [msg.contact.first_name, msg.contact.last_name].filter(Boolean).join(' ');
      db.upsertTgContact(DEFAULT_ACCOUNT, { phone, chatId: msg.chat.id, name });
      bot.sendMessage(msg.chat.id,
        `✅ Rahmat, *${name}*! Raqamingiz ulandi (${phone}).\n\nEndi har bir sotuvdan keyin chek va hisobot shu yerga keladi.`,
        { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } });
    } catch (e) {
      console.error('[Telegram] contact xatosi:', e.message);
    }
  });

  // ── Inline keyboard callback ──────────────────────────────────────────────
  bot.on('callback_query', (q) => {
    const chatId = q.message.chat.id;
    const data   = q.data;
    const state  = states[chatId];
    bot.answerCallbackQuery(q.id);

    // ── Bosh menyu tugmalari ─────────────────────────────────────────────
    if (data === 'menu:zakaz') {
      states[chatId] = { step: 'name' };
      bot.sendMessage(chatId,
        '📋 *Yangi zakaz*\n\nIsmingiz yoki korxona nomingizni yozing:',
        { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } });
      return;
    }
    if (data === 'menu:ulash') {
      bot.sendMessage(chatId, 'Raqamingizni ulash uchun quyidagi tugmani bosing:', shareKeyboard);
      return;
    }

    if (!state) return;

    if (data.startsWith('brand:') && state.step === 'brand') {
      const val = data.replace('brand:', '');
      if (val === 'other') {
        state.step = 'brand_text';
        bot.sendMessage(chatId, 'Sement markasini yozing (masalan: 32.5B):');
      } else {
        state.brand = val;
        state.step  = 'tur';
        bot.sendMessage(chatId,
          `✅ Marka: *${val}*\n\nQanday holda kerak?`,
          { parse_mode: 'Markdown', ...turKeyboard() });
      }
    } else if (data.startsWith('tur:') && state.step === 'tur') {
      state.tur  = data.replace('tur:', '');
      state.step = 'tons';
      bot.sendMessage(chatId,
        `✅ Tur: *${state.tur}*\n\nNecha tonna kerak? (raqamda yozing):`,
        { parse_mode: 'Markdown' });
    }
  });

  // ── Matnli xabarlar (zakaz oqimi) ────────────────────────────────────────
  bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text   = msg.text;
    if (!text || text.startsWith('/') || msg.contact) return;

    const state = states[chatId];
    if (!state) {
      bot.sendMessage(chatId,
        '📦 Buyurtma berish: /zakaz\n📱 Raqam ulash: /ulash');
      return;
    }

    // ── Step: ism ──────────────────────────────────────────────────────────
    if (state.step === 'name') {
      state.customer = text.trim();
      state.step     = 'brand';
      bot.sendMessage(chatId,
        `👤 *${state.customer}*\n\nSement markasini tanlang:`,
        { parse_mode: 'Markdown', ...brandKeyboard() });

    // ── Step: brand qo'lda yozilgan ──────────────────────────────────────
    } else if (state.step === 'brand_text') {
      state.brand = text.trim();
      state.step  = 'tur';
      bot.sendMessage(chatId,
        `✅ Marka: *${state.brand}*\n\nQanday holda kerak?`,
        { parse_mode: 'Markdown', ...turKeyboard() });

    // ── Step: tonna ─────────────────────────────────────────────────────
    } else if (state.step === 'tons') {
      const tons = parseFloat(String(text).replace(',', '.'));
      if (isNaN(tons) || tons <= 0) {
        bot.sendMessage(chatId, "⚠️ Tonnani to'g'ri raqamda kiriting (masalan: 10 yoki 5.5):");
        return;
      }
      state.tons = tons;
      state.step = 'note';
      bot.sendMessage(chatId,
        `✅ Tonna: *${tons} tn*\n\nManzil yoki qo'shimcha izoh yozing (masalan: "Toshkent, Yunusobod 5-kv"):`,
        { parse_mode: 'Markdown' });

    // ── Step: izoh → zakaz saqlash ───────────────────────────────────────
    } else if (state.step === 'note') {
      state.note = text.trim();
      const handle = msg.from.username ? '@' + msg.from.username : (msg.from.first_name || 'telegram');
      const orderNote = [state.tur, state.note, `(${handle})`].filter(Boolean).join(' | ');

      db.addBotOrder(DEFAULT_ACCOUNT, {
        id: Date.now(), createdAt: Date.now(),
        date: new Date().toLocaleDateString('ru-RU'),
        customer: state.customer,
        tons: state.tons,
        brand: state.brand,
        tur: state.tur,
        note: orderNote,
        status: 'kutilmoqda', worker: 'Telegram Bot',
      });

      bot.sendMessage(chatId,
        `✅ *Buyurtmangiz qabul qilindi!*\n\n` +
        `👤 Mijoz: ${state.customer}\n` +
        `🏷 Marka: ${state.brand}\n` +
        `📦 Tur: ${state.tur}\n` +
        `⚖️ Tonna: ${state.tons} tn\n` +
        `📍 Izoh: ${state.note}\n\n` +
        `Tez orada siz bilan bog'lanamiz! ☎️`,
        { parse_mode: 'Markdown' });

      delete states[chatId];
    }
  });

  bot.on('polling_error', (err) => console.error('[Telegram] polling xatosi:', err.code || err.message));

  running = true;
  console.log('✅ Telegram Bot ishga tushdi! (@sementchiuzbot)');
}

// ── Tashqaridan xabar yuborish ──────────────────────────────────────────────
async function sendMessage(chatId, text) {
  if (!running || !bot) throw new Error('Telegram bot ishlamayapti.');
  if (!chatId) throw new Error('chatId yo\'q (mijoz raqamini ulamagan).');
  await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  return true;
}

// ── Savdo xabari — har sotuvda avtomatik ──────────────────────────────────
async function notifySale(acc, { phone, customer, tons, pricePerTon, paymentChannel, note, totalDebt, date }) {
  if (!running || !bot) return { ok: false, error: 'Bot ishlamayapti' };
  const chatId = db.findChatId(acc, phone);
  if (!chatId) return { ok: false, error: 'chatId yo\'q' };

  const sum = Number(tons || 0) * Number(pricePerTon || 0);
  const lines = [
    `🧾 *Sotuv hujjati*`,
    `📅 Sana: ${date || new Date().toLocaleDateString('ru-RU')}`,
    ``,
    `👤 Mijoz: *${customer}*`,
    `⚖️ Miqdor: *${tons} tonna*`,
    `💰 Narx: ${fmt(pricePerTon)} so'm/tn`,
    `💵 Jami: *${fmt(sum)} so'm*`,
    `🏦 To'lov: ${CH[paymentChannel] || paymentChannel}`,
  ];
  if (note) lines.push(`📝 Izoh: ${note}`);
  if (totalDebt > 0) {
    lines.push(``);
    lines.push(`─────────────────`);
    lines.push(`⚠️ *Qolgan umumiy qarz: ${fmt(totalDebt)} so'm*`);
  } else if (totalDebt === 0) {
    lines.push(``);
    lines.push(`✅ *Qarz yo'q*`);
  }

  try {
    await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { start, isRunning, sendMessage, notifySale };
