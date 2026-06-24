// ─────────────────────────────────────────────────────────────────────────────
// Telegram bot xizmati.
//  - Persistent Reply Keyboard (doimiy pastki tugmalar)
//  - Zakaz berish oqimi: inline keyboard (marka/tur tanlovi)
//  - Raqam ulash: kontakt yuborish
//  - notifySale()     — sotuvda avtomatik xabar
//  - notifyOrderDone() — zakaz bajarilganda mijozga xabar
// ─────────────────────────────────────────────────────────────────────────────
const TelegramBot = require('node-telegram-bot-api');
const db = require('../db');
const { TELEGRAM_TOKEN, DEFAULT_ACCOUNT } = require('../config');

let running = false;
let bot = null;
const isRunning = () => running;

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const CH  = { naqd: '💵 Naqd', bank: '🏦 Bank', click: '📱 Click', nasiya: '⚠️ Nasiya (qarz)', avans: '🅰️ Avans' };

const BRANDS = ['450 marka', '550 marka'];
const TURLAR = ['📦 Qoplik', '🌫 Rasipnoy'];

// ── Doimiy pastki keyboard (Reply Keyboard) ───────────────────────────────────
const mainKeyboard = {
  reply_markup: {
    keyboard: [
      [
        { text: '🛒 Sement buyurtma berish' },
        { text: '🔗 Bot bilan ulash' },
      ],
    ],
    resize_keyboard: true,
    persistent: true,
  },
};

// Kontakt ulashish klaviaturasi (vaqtinchalik, bir marta)
const shareKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: '📱 Raqamni ulashish', request_contact: true }],
      [{ text: '⬅️ Orqaga' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
};

function brandKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        BRANDS.map(b => ({ text: b, callback_data: `brand:${b}` })),
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

function sendMenu(chatId, text) {
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...mainKeyboard });
}

function start() {
  if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN.length < 10) {
    console.log('ℹ️  TELEGRAM_BOT_TOKEN kiritilmagan. Bot ishlamaydi (qolgan qism normal ishlaydi).');
    return;
  }

  bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  const states = {}; // chatId → { step, customer, brand, tur, tons, note, workerName }

  // ── /start [linkCode] ─────────────────────────────────────────────────────
  bot.onText(/\/start(.*)/, (msg, match) => {
    const chatId   = msg.chat.id;
    const linkCode = (match[1] || '').trim();
    states[chatId] = null;

    if (linkCode) {
      const worker = db.linkWorker(DEFAULT_ACCOUNT, linkCode, chatId);
      if (worker) {
        sendMenu(chatId,
          `✅ *Sotuvchi sifatida ulandi!*\n\n👷 ${worker.name}\n\nEndi buyurtmalarni bot orqali bera olasiz.`);
        return;
      }
      const customer = db.linkCustomer(DEFAULT_ACCOUNT, linkCode, chatId);
      if (customer) {
        sendMenu(chatId,
          `✅ *Muvaffaqiyatli ulandi!*\n\n👤 ${customer.name}\n\nEndi har bir xarid haqida avtomatik xabar olasiz.`);
        return;
      }
      sendMenu(chatId, `⚠️ Havola noto'g'ri yoki muddati o'tgan. Yangi havola so'rang.`);
      return;
    }

    sendMenu(chatId,
      '🏗 *Sement do\'koni botiga xush kelibsiz!*\n\nQuyidagi tugmalardan birini tanlang:');
  });

  // ── /zakaz ────────────────────────────────────────────────────────────────
  bot.onText(/\/zakaz/, (msg) => startOrder(msg.chat.id));

  function startOrder(chatId) {
    const worker = db.getWorkerByChatId(DEFAULT_ACCOUNT, chatId);
    if (worker) {
      states[chatId] = { step: 'worker_customer', workerName: worker.name };
      bot.sendMessage(chatId,
        `📋 *Yangi zakaz* (${worker.name})\n\nMijoz ismi yoki korxona nomini yozing:`,
        { parse_mode: 'Markdown' });
    } else {
      states[chatId] = { step: 'name', chatId };
      bot.sendMessage(chatId,
        '📋 *Yangi zakaz*\n\nIsmingiz yoki korxona nomingizni yozing:',
        { parse_mode: 'Markdown' });
    }
  }

  // ── /ulash ────────────────────────────────────────────────────────────────
  bot.onText(/\/ulash/, (msg) => {
    bot.sendMessage(msg.chat.id,
      '📱 Raqamingizni ulash uchun quyidagi tugmani bosing:', shareKeyboard);
  });

  // ── Kontakt ulashilganda ──────────────────────────────────────────────────
  bot.on('contact', (msg) => {
    try {
      const tgPhone = msg.contact.phone_number;
      const name    = [msg.contact.first_name, msg.contact.last_name].filter(Boolean).join(' ');
      const chatId  = msg.chat.id;

      states[chatId] = { step: 'confirm_phone', tgPhone, name };

      bot.sendMessage(chatId,
        `✅ Rahmat, *${name}*!\n\n` +
        `Telegram raqamingiz: *${tgPhone}*\n\n` +
        `Do'konimizda siz qaysi raqam bilan yozilgansiz?\n` +
        `• Agar *xuddi shu raqam* bo'lsa — "✅ Shu raqam" tugmasini bosing\n` +
        `• Agar *boshqa (ish) raqam* bo'lsa — uni yozing (masalan: 901234567)`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Shu raqamni ulash', callback_data: `linkphone:${tgPhone}` },
            ]],
          },
        });
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

    if (data.startsWith('linkphone:')) {
      const phone = data.replace('linkphone:', '');
      const name  = state?.name || '';
      db.upsertTgContact(DEFAULT_ACCOUNT, { phone, chatId, name });
      states[chatId] = null;
      sendMenu(chatId, `✅ *Ulandi!* Raqam: ${phone}\n\nEndi har bir sotuvdan keyin xabar keladi.`);
      return;
    }

    if (!state) return;

    if (data.startsWith('brand:') && state.step === 'brand') {
      state.brand = data.replace('brand:', '');
      state.step  = 'tur';
      bot.sendMessage(chatId,
        `✅ Marka: *${state.brand}*\n\nQanday holda kerak?`,
        { parse_mode: 'Markdown', ...turKeyboard() });
    } else if (data.startsWith('tur:') && state.step === 'tur') {
      state.tur  = data.replace('tur:', '');
      state.step = 'tons';
      bot.sendMessage(chatId,
        `✅ Tur: *${state.tur}*\n\nNecha tonna kerak? (raqamda yozing):`,
        { parse_mode: 'Markdown' });
    }
  });

  // ── Matnli xabarlar ───────────────────────────────────────────────────────
  bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text   = (msg.text || '').trim();
    if (!text || text.startsWith('/') || msg.contact) return;

    // ── Doimiy tugmalar ────────────────────────────────────────────────────
    if (text === '🛒 Sement buyurtma berish') {
      states[chatId] = null;
      startOrder(chatId);
      return;
    }
    if (text === '🔗 Bot bilan ulash') {
      states[chatId] = null;
      bot.sendMessage(chatId,
        '📱 Raqamingizni ulash uchun quyidagi tugmani bosing:', shareKeyboard);
      return;
    }
    if (text === '⬅️ Orqaga') {
      states[chatId] = null;
      sendMenu(chatId, 'Asosiy menyu:');
      return;
    }

    const state = states[chatId];
    if (!state) {
      sendMenu(chatId, 'Tugmalardan birini tanlang 👇');
      return;
    }

    // ── Step: xodim rejimi — mijoz ismi ──────────────────────────────────
    if (state.step === 'worker_customer') {
      state.customer = text;
      state.step     = 'brand';
      bot.sendMessage(chatId,
        `👤 Mijoz: *${state.customer}*\n\nSement markasini tanlang:`,
        { parse_mode: 'Markdown', ...brandKeyboard() });
      return;
    }

    // ── Step: biznes raqam ────────────────────────────────────────────────
    if (state.step === 'confirm_phone') {
      const bizPhone = text.replace(/\D/g, '');
      if (bizPhone.length < 7) {
        bot.sendMessage(chatId, "⚠️ Raqam noto'g'ri. To'liq raqamni yozing (masalan: 901234567):");
        return;
      }
      db.upsertTgContact(DEFAULT_ACCOUNT, { phone: bizPhone, chatId, name: state.name });
      states[chatId] = null;
      sendMenu(chatId, `✅ *Ulandi!* Biznes raqam: ${bizPhone}\n\nEndi har bir sotuvdan keyin xabar keladi.`);
      return;
    }

    // ── Step: mijoz ismi ──────────────────────────────────────────────────
    if (state.step === 'name') {
      state.customer = text;
      state.step     = 'brand';
      bot.sendMessage(chatId,
        `👤 *${state.customer}*\n\nSement markasini tanlang:`,
        { parse_mode: 'Markdown', ...brandKeyboard() });

    // ── Step: tonna ────────────────────────────────────────────────────
    } else if (state.step === 'tons') {
      const tons = parseFloat(String(text).replace(',', '.'));
      if (isNaN(tons) || tons <= 0) {
        bot.sendMessage(chatId, "⚠️ Tonnani to'g'ri raqamda kiriting (masalan: 10 yoki 5.5):");
        return;
      }
      state.tons = tons;
      state.step = 'note';
      bot.sendMessage(chatId,
        `✅ Tonna: *${tons} tn*\n\nManzil yoki qo'shimcha izoh yozing\n_(yo'q bo'lsa — tire " - " yozing)_:`,
        { parse_mode: 'Markdown' });

    // ── Step: izoh → saqlash ──────────────────────────────────────────
    } else if (state.step === 'note') {
      state.note = text === '-' ? '' : text;
      const handle     = msg.from.username ? '@' + msg.from.username : (msg.from.first_name || 'telegram');
      const workerName = state.workerName || null;
      const orderNote  = [state.tur, state.note, workerName ? null : `(${handle})`].filter(Boolean).join(' | ');

      db.addBotOrder(DEFAULT_ACCOUNT, {
        id: Date.now(), createdAt: Date.now(),
        date: new Date().toLocaleDateString('ru-RU'),
        customer: state.customer,
        tons: state.tons,
        brand: state.brand,
        tur: state.tur,
        note: orderNote,
        status: 'kutilmoqda',
        worker: workerName || 'Telegram Bot',
        source: workerName ? 'seller' : 'customer',
        chatId: String(chatId),
      });

      const confirmText = workerName
        ? `✅ *Zakaz kiritildi!*\n\n👷 Sotuvchi: ${workerName}\n👤 Mijoz: ${state.customer}\n🏷 Marka: ${state.brand}\n📦 Tur: ${state.tur}\n⚖️ Tonna: ${state.tons} tn\n📍 Izoh: ${state.note || '—'}`
        : `✅ *Buyurtmangiz qabul qilindi!*\n\n👤 Mijoz: ${state.customer}\n🏷 Marka: ${state.brand}\n📦 Tur: ${state.tur}\n⚖️ Tonna: ${state.tons} tn\n📍 Izoh: ${state.note || '—'}\n\nTez orada siz bilan bog'lanamiz! ☎️`;

      sendMenu(chatId, confirmText);
      delete states[chatId];
    }
  });

  bot.on('polling_error', (err) => console.error('[Telegram] polling xatosi:', err.code || err.message));

  running = true;
  console.log('✅ Telegram Bot ishga tushdi! (@sementchiuzbot)');
}

// ── Tashqaridan xabar yuborish ────────────────────────────────────────────────
async function sendMessage(chatId, text) {
  if (!running || !bot) throw new Error('Telegram bot ishlamayapti.');
  if (!chatId) throw new Error('chatId yo\'q.');
  await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  return true;
}

// ── Savdo xabari ─────────────────────────────────────────────────────────────
async function notifySale(acc, { chatId: directChatId, phone, customer, tons, pricePerTon, paymentChannel, note, totalDebt, date }) {
  if (!running || !bot) return { ok: false, error: 'Bot ishlamayapti' };
  const chatId = directChatId || db.findChatId(acc, phone);
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

// ── Zakaz bajarildi xabari ────────────────────────────────────────────────────
async function notifyOrderDone(chatId, { customer, tons, brand, tur, note }) {
  if (!running || !bot) return { ok: false, error: 'Bot ishlamayapti' };
  if (!chatId) return { ok: false, error: 'chatId yo\'q' };

  const lines = [
    `✅ *Zakazingiz bajarildi!*`,
    ``,
    `👤 Mijoz: *${customer}*`,
    `🏷 Marka: ${brand || '—'}`,
    `📦 Tur: ${tur || '—'}`,
    `⚖️ Tonna: *${tons} tn*`,
  ];
  if (note) lines.push(`📝 Izoh: ${note}`);
  lines.push(`\nRahmat! 🙏`);

  try {
    await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { start, isRunning, sendMessage, notifySale, notifyOrderDone };
