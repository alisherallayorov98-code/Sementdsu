// ─────────────────────────────────────────────────────────────────────────────
// Telegram bot xizmati.
//  - Mijoz buyurtma oqimi (zakaz)
//  - Haydovchi reys oqimi (reys: rasm → manzil → narx → admin tasdiqlash)
//  - Admin inline tasdiqlash/rad etish
//  - notifySale(), notifyOrderDone(), notifyDriver()
// ─────────────────────────────────────────────────────────────────────────────
const TelegramBot = require('node-telegram-bot-api');
const db = require('../db');
const { TELEGRAM_TOKEN, TELEGRAM_BOT_USER, DEFAULT_ACCOUNT } = require('../config');

let running = false;
let bot = null;
const isRunning = () => running;

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const CH  = { naqd: '💵 Naqd', bank: '🏦 Bank', click: '📱 Click', nasiya: '⚠️ Nasiya (qarz)', avans: '🅰️ Avans' };

const BRANDS = ['450 marka', '550 marka'];
const TURLAR = ['📦 Qoplik', '🌫 Rasipnoy'];

// Yo'l haqi turlari (kichik va katta mashinalar uchun)
const SMALL_PRICES = [50000, 100000, 150000, 200000, 250000, 400000];
const LARGE_PRICES = [50000, 100000, 150000, 200000, 250000, 400000, 450000, 500000, 550000];

// ── Asosiy tugmalar ───────────────────────────────────────────────────────────
const mainKeyboard = {
  reply_markup: {
    keyboard: [[
      { text: '🛒 Sement buyurtma berish' },
      { text: '🔗 Bot bilan ulash' },
    ]],
    resize_keyboard: true,
    persistent: true,
  },
};

const driverKeyboard = {
  reply_markup: {
    keyboard: [[
      { text: '🚛 Reys boshlash' },
      { text: '📊 Hisobim' },
    ]],
    resize_keyboard: true,
    persistent: true,
  },
};

const shareKeyboard = {
  reply_markup: {
    keyboard: [[{ text: '📱 Raqamni ulashish', request_contact: true }], [{ text: '⬅️ Orqaga' }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
};

function brandKeyboard() {
  return { reply_markup: { inline_keyboard: [BRANDS.map(b => ({ text: b, callback_data: `brand:${b}` }))] } };
}
function turKeyboard() {
  return { reply_markup: { inline_keyboard: [TURLAR.map(t => ({ text: t, callback_data: `tur:${t}` }))] } };
}

function destinationKeyboard(acc) {
  const settings = db.getState(acc).app_settings || {};
  const dests = settings.driverDestinations || [];
  if (dests.length === 0) return null;
  const rows = [];
  for (let i = 0; i < dests.length; i += 2) {
    rows.push(dests.slice(i, i + 2).map(d => ({ text: d, callback_data: `drv_dest:${d}` })));
  }
  return { reply_markup: { inline_keyboard: rows } };
}

function priceKeyboard(carType) {
  const prices = carType === 'small' ? SMALL_PRICES : LARGE_PRICES;
  const rows = [];
  for (let i = 0; i < prices.length; i += 3) {
    rows.push(prices.slice(i, i + 3).map(p => ({ text: `${fmt(p)} so'm`, callback_data: `drv_price:${p}` })));
  }
  return { reply_markup: { inline_keyboard: rows } };
}

function approveKeyboard(tripId) {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Tasdiqlash', callback_data: `drv_approve:${tripId}` },
        { text: '❌ Rad etish', callback_data: `drv_reject:${tripId}` },
      ]],
    },
  };
}

function sendMenu(chatId, text) {
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...mainKeyboard });
}
function sendDriverMenu(chatId, text) {
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...driverKeyboard });
}

// Admin chatIdlarini topish (admin rolidagi xodimlar)
function getAdminChatIds(acc) {
  const workers = db.getState(acc).workers || [];
  return workers
    .filter(w => (w.role === 'admin' || w.role === 'superadmin') && w.telegramChatId)
    .map(w => w.telegramChatId);
}

// Haydovchiga balance xabari
function driverBalanceText(acc, driverId) {
  const balance = db.driverBalance(acc, driverId);
  if (balance > 0)  return `💰 Sizga *${fmt(balance)} so'm* to'lanishi kerak`;
  if (balance < 0)  return `⚠️ Avans qarzingiz: *${fmt(Math.abs(balance))} so'm*`;
  return `✅ Hisob-kitob muvozanatli`;
}

// Pending tripni tasdiqlash (ham bot, ham API dan chaqiriladi)
async function doApproveTrip(acc, tripId, adminChatId) {
  const result = db.approveDriverTrip(acc, tripId);
  if (!result) {
    if (adminChatId) await bot.sendMessage(adminChatId, '⚠️ Reys topilmadi (allaqachon tasdiqlangan bo\'lishi mumkin).', { parse_mode: 'Markdown' });
    return false;
  }
  const { trip, driver } = result;
  // Admin'ga tasdiqlash tasdiqnomasi
  if (adminChatId) {
    await bot.sendMessage(adminChatId,
      `✅ *Reys tasdiqlandi!*\n👤 ${driver?.name || '?'} — 📍 ${trip.destination} — 💰 ${fmt(trip.price)} so'm`,
      { parse_mode: 'Markdown' });
  }
  // Haydovchiga xabar
  if (driver?.telegramChatId) {
    const balText = driverBalanceText(acc, trip.driverId);
    await bot.sendMessage(driver.telegramChatId,
      `✅ *Reysiz tasdiqlandi!*\n\n📍 Manzil: *${trip.destination}*\n💰 Yo'l haqi: *${fmt(trip.price)} so'm*\n\n${balText}`,
      { parse_mode: 'Markdown', ...driverKeyboard });
  }
  return true;
}

async function doRejectTrip(acc, tripId, adminChatId, reason) {
  const pending = db.getPendingDriverTrips(acc);
  const trip = pending.find(t => t.id === tripId);
  if (!trip) {
    if (adminChatId) await bot.sendMessage(adminChatId, '⚠️ Reys topilmadi.', { parse_mode: 'Markdown' });
    return false;
  }
  db.removePendingDriverTrip(acc, tripId);
  if (adminChatId) {
    await bot.sendMessage(adminChatId,
      `❌ *Reys rad etildi.*\n👤 ${trip.driverName} — 📍 ${trip.destination}`,
      { parse_mode: 'Markdown' });
  }
  const driver = (db.getState(acc).drivers || []).find(d => d.id === trip.driverId);
  if (driver?.telegramChatId) {
    await bot.sendMessage(driver.telegramChatId,
      `❌ *Reysiz rad etildi.*\n\n📍 ${trip.destination} — 💰 ${fmt(trip.price)} so'm\n\n${reason ? 'Sabab: ' + reason : 'Admin bilan bog\'laning.'}`,
      { parse_mode: 'Markdown', ...driverKeyboard });
  }
  return true;
}

function start() {
  if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN.length < 10) {
    console.log('ℹ️  TELEGRAM_BOT_TOKEN kiritilmagan. Bot ishlamaydi (qolgan qism normal ishlaydi).');
    return;
  }

  bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  const states = {}; // chatId → state object

  // ── /start [linkCode] ─────────────────────────────────────────────────────
  bot.onText(/\/start(.*)/, (msg, match) => {
    const chatId   = msg.chat.id;
    const linkCode = (match[1] || '').trim();
    states[chatId] = null;

    // Haydovchi deep link: driver_DRIVERID
    if (linkCode.startsWith('driver_')) {
      const driverId = Number(linkCode.replace('driver_', ''));
      if (driverId) {
        const driver = db.linkDriver(DEFAULT_ACCOUNT, driverId, chatId);
        if (driver) {
          sendDriverMenu(chatId,
            `✅ *Haydovchi sifatida ulandi!*\n\n🚚 ${driver.name}\n🔢 ${driver.carNumber || '—'}\n\nReys boshlash uchun tugmani bosing!`);
          return;
        }
      }
      sendMenu(chatId, `⚠️ Havola noto'g'ri. Admin bilan bog'laning.`);
      return;
    }

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

    // Haydovchi bo'lsa — haydovchi menyusi
    const driver = db.getDriverByChatId(DEFAULT_ACCOUNT, chatId);
    if (driver) {
      sendDriverMenu(chatId, `🚚 *Xush kelibsiz, ${driver.name}!*\n\nReys boshlash yoki hisobingizni ko'rish uchun tugmalardan foydalaning.`);
      return;
    }

    sendMenu(chatId,
      '🏗 *Sement do\'koni botiga xush kelibsiz!*\n\nQuyidagi tugmalardan birini tanlang:');
  });

  // ── /zakaz ────────────────────────────────────────────────────────────────
  bot.onText(/\/zakaz/, (msg) => startOrder(msg.chat.id));
  // ── /reys ─────────────────────────────────────────────────────────────────
  bot.onText(/\/reys/, (msg) => startReys(msg.chat.id));

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

  function startReys(chatId) {
    const driver = db.getDriverByChatId(DEFAULT_ACCOUNT, chatId);
    if (!driver) {
      bot.sendMessage(chatId,
        '⚠️ Siz haydovchi sifatida ulanmagansiz.\n\nAdmin sizga maxsus havola berishi kerak.',
        { parse_mode: 'Markdown' });
      return;
    }
    states[chatId] = {
      type: 'driver_reys', step: 'photo',
      driverId: driver.id, driverName: driver.name,
      carNumber: driver.carNumber || '', carType: driver.carType || 'large',
    };
    bot.sendMessage(chatId,
      `🚛 *Yangi reys*\n\n📸 *Yuk xatini rasmga oling va yuboring:*`,
      { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } });
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
        `✅ Rahmat, *${name}*!\n\nTelegram raqamingiz: *${tgPhone}*\n\n` +
        `Do'konimizda siz qaysi raqam bilan yozilgansiz?\n` +
        `• Agar *xuddi shu raqam* bo'lsa — "✅ Shu raqam" tugmasini bosing\n` +
        `• Agar *boshqa (ish) raqam* bo'lsa — uni yozing (masalan: 901234567)`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '✅ Shu raqamni ulash', callback_data: `linkphone:${tgPhone}` }]] },
        });
    } catch (e) { console.error('[Telegram] contact xatosi:', e.message); }
  });

  // ── Rasm (photo) qabul qilish ─────────────────────────────────────────────
  bot.on('message', (msg) => {
    if (!msg.photo) return;
    const chatId = msg.chat.id;
    const state  = states[chatId];
    if (!state || state.type !== 'driver_reys' || state.step !== 'photo') return;

    // Eng yaxshi sifatli rasmni olamiz (oxirgisi — kattaroq)
    const photo = msg.photo[msg.photo.length - 1];
    state.photoFileId = photo.file_id;
    state.step = 'manzil';

    const destKb = destinationKeyboard(DEFAULT_ACCOUNT);
    if (destKb) {
      bot.sendMessage(chatId,
        `✅ *Rasm qabul qilindi!*\n\nManzilni tanlang:`,
        { parse_mode: 'Markdown', ...destKb });
    } else {
      // Manzillar yo'q — qo'lda kiritish
      state.step = 'manzil_text';
      bot.sendMessage(chatId,
        `✅ *Rasm qabul qilindi!*\n\nManzilni yozing (masalan: Oqqo'rg'on, Toshkent, Chirchiq):`,
        { parse_mode: 'Markdown' });
    }
  });

  // ── Inline keyboard callback ──────────────────────────────────────────────
  bot.on('callback_query', async (q) => {
    const chatId = q.message.chat.id;
    const data   = q.data;
    const state  = states[chatId];
    bot.answerCallbackQuery(q.id).catch(() => {});

    // Raqam ulash
    if (data.startsWith('linkphone:')) {
      const phone = data.replace('linkphone:', '');
      const name  = state?.name || '';
      db.upsertTgContact(DEFAULT_ACCOUNT, { phone, chatId, name });
      states[chatId] = null;
      sendMenu(chatId, `✅ *Ulandi!* Raqam: ${phone}\n\nEndi har bir sotuvdan keyin xabar keladi.`);
      return;
    }

    // Haydovchi reys — manzil tanlash
    if (data.startsWith('drv_dest:') && state?.type === 'driver_reys' && state.step === 'manzil') {
      const dest = data.replace('drv_dest:', '');
      state.destination = dest;
      state.step = 'price';
      bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: q.message.message_id }).catch(() => {});
      bot.sendMessage(chatId,
        `✅ *Manzil:* ${dest}\n\nYo'l haqi turini tanlang:`,
        { parse_mode: 'Markdown', ...priceKeyboard(state.carType) });
      return;
    }

    // Haydovchi reys — narx tanlash
    if (data.startsWith('drv_price:') && state?.type === 'driver_reys' && state.step === 'price') {
      const price = Number(data.replace('drv_price:', ''));
      state.price = price;
      bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: q.message.message_id }).catch(() => {});

      // Pending trip yaratish
      const tripId = Date.now();
      const today  = new Date().toLocaleDateString('ru-RU');
      const trip   = {
        id: tripId, createdAt: tripId, chatId: String(chatId),
        driverId: state.driverId, driverName: state.driverName,
        carNumber: state.carNumber, date: today,
        destination: state.destination, price,
        photoFileId: state.photoFileId, status: 'pending',
      };
      db.addPendingDriverTrip(DEFAULT_ACCOUNT, trip);
      states[chatId] = null;

      // Haydovchiga tasdiqlash xabari
      sendDriverMenu(chatId,
        `✅ *Ma'lumotlar yuborildi!*\n\n🚛 *${state.driverName}*\n📍 Manzil: ${state.destination}\n💰 Yo'l haqi: ${fmt(price)} so'm\n\nAdmin tasdiqlasin. Natija haqida xabar olasiz.`);

      // Adminga xabar + tasdiqlash tugmasi
      const adminIds = getAdminChatIds(DEFAULT_ACCOUNT);
      for (const adminChatId of adminIds) {
        try {
          // Avval rasmni yuboring
          await bot.sendPhoto(adminChatId, state.photoFileId, {
            caption: `🚛 *Yangi reys so'rovi*\n\n👤 Haydovchi: *${state.driverName}*\n🔢 Mashina: ${state.carNumber || '—'}\n📍 Manzil: *${state.destination}*\n💰 Yo'l haqi: *${fmt(price)} so'm*\n📅 Sana: ${today}`,
            parse_mode: 'Markdown',
            ...approveKeyboard(tripId),
          });
        } catch (e) { console.error('[Telegram] admin xabari xatosi:', e.message); }
      }
      return;
    }

    // Admin — reys tasdiqlash
    if (data.startsWith('drv_approve:')) {
      const tripId = Number(data.replace('drv_approve:', ''));
      try {
        await doApproveTrip(DEFAULT_ACCOUNT, tripId, chatId);
        // Tugmani o'chirish
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: q.message.message_id }).catch(() => {});
      } catch (e) { console.error('[Telegram] approve xatosi:', e.message); }
      return;
    }

    // Admin — reys rad etish
    if (data.startsWith('drv_reject:')) {
      const tripId = Number(data.replace('drv_reject:', ''));
      try {
        await doRejectTrip(DEFAULT_ACCOUNT, tripId, chatId, '');
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: q.message.message_id }).catch(() => {});
      } catch (e) { console.error('[Telegram] reject xatosi:', e.message); }
      return;
    }

    // Zakaz — sement markasi
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
    if (!text || text.startsWith('/') || msg.contact || msg.photo) return;

    // Doimiy tugmalar
    if (text === '🛒 Sement buyurtma berish') { states[chatId] = null; startOrder(chatId); return; }
    if (text === '🔗 Bot bilan ulash') {
      states[chatId] = null;
      bot.sendMessage(chatId, '📱 Raqamingizni ulash uchun quyidagi tugmani bosing:', shareKeyboard);
      return;
    }
    if (text === '⬅️ Orqaga') { states[chatId] = null; sendMenu(chatId, 'Asosiy menyu:'); return; }

    // Haydovchi tugmalari
    if (text === '🚛 Reys boshlash') { states[chatId] = null; startReys(chatId); return; }
    if (text === '📊 Hisobim') {
      const driver = db.getDriverByChatId(DEFAULT_ACCOUNT, chatId);
      if (!driver) { bot.sendMessage(chatId, '⚠️ Siz haydovchi sifatida ulanmagansiz.'); return; }
      const balance = db.driverBalance(DEFAULT_ACCOUNT, driver.id);
      const allTrips = (db.getState(DEFAULT_ACCOUNT).driver_trips || []).filter(t => t.driverId === driver.id);
      const earned = allTrips.filter(t => !t.isPayment).reduce((s, t) => s + Number(t.price || 0), 0);
      const paid   = allTrips.filter(t =>  t.isPayment).reduce((s, t) => s + Number(t.price || 0), 0);
      const pending = (db.getPendingDriverTrips(DEFAULT_ACCOUNT) || []).filter(t => t.driverId === driver.id && t.status === 'pending').length;
      const balanceMsg = balance > 0
        ? `💰 Sizga *${fmt(balance)} so'm* to'lanishi kerak`
        : balance < 0
          ? `⚠️ Avans qarzingiz: *${fmt(Math.abs(balance))} so'm*`
          : `✅ Hisob muvozanatli`;
      sendDriverMenu(chatId,
        `📊 *${driver.name} — Hisobingiz*\n\n` +
        `🚛 Jami ishladi: *${fmt(earned)} so'm* (${allTrips.filter(t => !t.isPayment).length} reys)\n` +
        `💸 Avans olindi: *${fmt(paid)} so'm*\n` +
        `${pending > 0 ? `⏳ Tasdiqlash kutilmoqda: *${pending} ta reys*\n` : ''}` +
        `─────────────────\n${balanceMsg}`);
      return;
    }

    const state = states[chatId];

    // Haydovchi reys — qo'lda manzil kiritish
    if (state?.type === 'driver_reys' && state.step === 'manzil_text') {
      state.destination = text;
      state.step = 'price';
      bot.sendMessage(chatId,
        `✅ *Manzil:* ${text}\n\nYo'l haqi turini tanlang:`,
        { parse_mode: 'Markdown', ...priceKeyboard(state.carType) });
      return;
    }

    if (!state) { sendMenu(chatId, 'Tugmalardan birini tanlang 👇'); return; }

    // Zakaz oqimi
    if (state.step === 'worker_customer') {
      state.customer = text; state.step = 'brand';
      bot.sendMessage(chatId, `👤 Mijoz: *${state.customer}*\n\nSement markasini tanlang:`, { parse_mode: 'Markdown', ...brandKeyboard() });
      return;
    }
    if (state.step === 'confirm_phone') {
      const bizPhone = text.replace(/\D/g, '');
      if (bizPhone.length < 7) { bot.sendMessage(chatId, "⚠️ Raqam noto'g'ri. To'liq raqamni yozing:"); return; }
      db.upsertTgContact(DEFAULT_ACCOUNT, { phone: bizPhone, chatId, name: state.name });
      states[chatId] = null;
      sendMenu(chatId, `✅ *Ulandi!* Biznes raqam: ${bizPhone}\n\nEndi har bir sotuvdan keyin xabar keladi.`);
      return;
    }
    if (state.step === 'name') {
      state.customer = text; state.step = 'brand';
      bot.sendMessage(chatId, `👤 *${state.customer}*\n\nSement markasini tanlang:`, { parse_mode: 'Markdown', ...brandKeyboard() });
    } else if (state.step === 'tons') {
      const tons = parseFloat(String(text).replace(',', '.'));
      if (isNaN(tons) || tons <= 0) { bot.sendMessage(chatId, "⚠️ Tonnani to'g'ri raqamda kiriting:"); return; }
      state.tons = tons; state.step = 'note';
      bot.sendMessage(chatId,
        `✅ Tonna: *${tons} tn*\n\nManzil yoki qo'shimcha izoh yozing\n_(yo'q bo'lsa — tire " - " yozing)_:`,
        { parse_mode: 'Markdown' });
    } else if (state.step === 'note') {
      state.note = text === '-' ? '' : text;
      const handle     = msg.from.username ? '@' + msg.from.username : (msg.from.first_name || 'telegram');
      const workerName = state.workerName || null;
      const orderNote  = [state.tur, state.note, workerName ? null : `(${handle})`].filter(Boolean).join(' | ');
      db.addBotOrder(DEFAULT_ACCOUNT, {
        id: Date.now(), createdAt: Date.now(),
        date: new Date().toLocaleDateString('ru-RU'),
        customer: state.customer, tons: state.tons,
        brand: state.brand, tur: state.tur, note: orderNote,
        status: 'kutilmoqda', worker: workerName || 'Telegram Bot',
        source: workerName ? 'seller' : 'customer', chatId: String(chatId),
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
  console.log(`✅ Telegram Bot ishga tushdi! (@${TELEGRAM_BOT_USER})`);
  return bot;
}

// ── Tashqaridan chaqiriladigan funksiyalar ────────────────────────────────────
async function sendMessage(chatId, text) {
  if (!running || !bot) throw new Error('Telegram bot ishlamayapti.');
  if (!chatId) throw new Error('chatId yo\'q.');
  await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  return true;
}

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
    lines.push(``, `─────────────────`, `⚠️ *Qolgan umumiy qarz: ${fmt(totalDebt)} so'm*`);
  } else if (totalDebt === 0) {
    lines.push(``, `✅ *Qarz yo'q*`);
  }
  try {
    await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function notifyOrderDone(chatId, { customer, tons, brand, tur, note }) {
  if (!running || !bot) return { ok: false, error: 'Bot ishlamayapti' };
  if (!chatId) return { ok: false, error: 'chatId yo\'q' };
  const lines = [
    `✅ *Zakazingiz bajarildi!*`, ``,
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

// Haydovchiga to'g'ridan-to'g'ri xabar (avans berilib yoki boshqacha)
async function notifyDriver(chatId, text) {
  if (!running || !bot) return { ok: false, error: 'Bot ishlamayapti' };
  if (!chatId) return { ok: false, error: 'chatId yo\'q' };
  try {
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

// Rasm URL (6 oylik cleanup uchun admin ko'rishi) — file_id → URL
async function getPhotoUrl(fileId) {
  if (!running || !bot || !fileId) return null;
  try { return await bot.getFileLink(fileId); } catch { return null; }
}

const getBot = () => bot;
module.exports = { start, isRunning, getBot, sendMessage, notifySale, notifyOrderDone, notifyDriver, getPhotoUrl, doApproveTrip, doRejectTrip };
