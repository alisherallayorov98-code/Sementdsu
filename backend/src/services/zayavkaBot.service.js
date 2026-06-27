// ─────────────────────────────────────────────────────────────────────────────
// Zayavka boti — zavodga sement chiqarish buyurtmalarini gruppaga yuboradi.
//
// Oqim:
//   /zayavka → shablon maydonlarini ketma-ket so'raydi → preview → guruhga yuboradi
//
// autoFields: sana kabi maydonlar so'ralmaydi, avtomatik to'ldiriladi.
// Bilingual: savollar O'zbek/Rus tilida, chiqish esa shablon tilidadir (Rus).
// ─────────────────────────────────────────────────────────────────────────────
const TelegramBot = require('node-telegram-bot-api');
const db = require('../db');
const { DEFAULT_ACCOUNT } = require('../config');

let bot = null;
let running = false;

const isRunning = () => running;
const getBot    = () => bot;

// Bugungi sanani RU formatida (DD.MM.YYYY) qaytaradi
const todayRU = () => new Date().toLocaleDateString('ru-RU');

// Avtomatik qiymatlar (field nomi → funksiya)
const AUTO_VALUES = {
  sana: todayRU,
  date: todayRU,
};

// Shablon dan {field} maydonlarini tartibda ajratib olish
function extractFields(template) {
  const seen = new Set();
  const fields = [];
  for (const m of (template || '').matchAll(/\{(\w+)\}/g)) {
    if (!seen.has(m[1])) { seen.add(m[1]); fields.push(m[1]); }
  }
  return fields.filter(f => f !== 'number');
}

// Shablon ga qiymatlarni qo'yish
function renderTemplate(template, values, counter) {
  let out = template;
  out = out.replace(/\{number\}/g, String(counter));
  for (const [k, v] of Object.entries(values)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), v || '—');
  }
  return out;
}

function getConfig(acc) {
  return db.getZayavkaConfig(acc) || {};
}

async function sendToGroup(acc, text) {
  const cfg = getConfig(acc);
  if (!cfg.groupChatId) throw new Error('Guruh chat ID sozlanmagan');
  await bot.sendMessage(cfg.groupChatId, text);
}

// Maydon uchun inline keyboard
function fieldKeyboard(fieldKey, options, skipable) {
  if (!options || options.length === 0) return skipable ? skipKeyboard() : null;
  const rows = [];
  for (let i = 0; i < options.length; i += 3) {
    rows.push(options.slice(i, i + 3).map(o => ({ text: o, callback_data: `zv_opt:${fieldKey}:${encodeURIComponent(o)}` })));
  }
  if (skipable) rows.push([{ text: "⏭ O'tkazib / Пропустить", callback_data: `zv_skip:${fieldKey}` }]);
  return { reply_markup: { inline_keyboard: rows } };
}

function skipKeyboard() {
  return { reply_markup: { inline_keyboard: [[{ text: "⏭ O'tkazib / Пропустить", callback_data: 'zv_skip_any' }]] } };
}

function confirmKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Yuborish / Отправить', callback_data: 'zv_confirm' },
        { text: '🔄 Qayta / Заново',       callback_data: 'zv_restart' },
      ]],
    },
  };
}

function start(acc = DEFAULT_ACCOUNT) {
  const cfg = getConfig(acc);
  if (!cfg.botToken || cfg.botToken.length < 10) {
    console.log('ℹ️  Zayavka bot token yo\'q. Bot ishlamaydi.');
    return null;
  }

  try {
    bot = new TelegramBot(cfg.botToken, { polling: true });
  } catch (e) {
    console.error('[ZayavkaBot] Ulanish xatosi:', e.message);
    return null;
  }

  const states = {}; // chatId → { allFields, askFields, values, step }

  function buildAutoValues(c) {
    const auto = {};
    // AUTO_VALUES dan avtomatik qiymatlar
    for (const [k, fn] of Object.entries(AUTO_VALUES)) {
      auto[k] = fn();
    }
    // Admin belgilagan autoFields ham
    const adminAuto = c.autoFields || [];
    for (const f of adminAuto) {
      if (!auto[f]) auto[f] = (c.fieldDefaults || {})[f] || '';
    }
    return auto;
  }

  function startZayavka(chatId) {
    const c = getConfig(acc);
    const template = c.template || '';
    const allFields = extractFields(template);

    if (allFields.length === 0) {
      bot.sendMessage(chatId,
        '⚠️ Shablon sozlanmagan.\n\nAdmin panelda Settings → Zayavka Bot ni sozlang.');
      return;
    }

    const autoVals = buildAutoValues(c);
    // Faqat avtomatik bo'lmagan maydonlar so'raladi
    const askFields = allFields.filter(f => !(f in autoVals));

    // Dastlabki qiymatlar: auto qiymatlar + admin default'lar
    const values = { ...autoVals };
    for (const f of allFields) {
      if (!values[f] && (c.fieldDefaults || {})[f]) values[f] = c.fieldDefaults[f];
    }

    states[chatId] = { allFields, askFields, values, step: 0 };

    if (askFields.length === 0) {
      showPreview(chatId);
    } else {
      bot.sendMessage(chatId, '📋 *Zayavka / Заявка*\n\nMaydonlarni to\'ldiring / Заполните поля:', { parse_mode: 'Markdown' });
      setTimeout(() => askField(chatId), 200);
    }
  }

  function askField(chatId) {
    const st = states[chatId];
    if (!st) return;
    const c = getConfig(acc);

    if (st.step >= st.askFields.length) {
      showPreview(chatId);
      return;
    }

    const field    = st.askFields[st.step];
    const label    = (c.fieldLabels || {})[field] || field;
    const options  = (c.fieldOptions || {})[field] || [];
    const optional = (c.optionalFields || []).includes(field);
    const stepNum  = st.step + 1;
    const total    = st.askFields.length;

    let text = `*[${stepNum}/${total}] ${label}*`;
    if (options.length) text += '\n\nQuyidagilardan tanlang / Выберите или напишите:';
    else text += '\n\nYozing / Напишите:';

    const kb = fieldKeyboard(field, options, optional);
    if (kb) {
      bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...kb });
    } else {
      bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    }
  }

  function showPreview(chatId) {
    const st = states[chatId];
    const c  = getConfig(acc);
    const counter  = db.nextZayavkaCounter(acc);
    const rendered = renderTemplate(c.template || '', st.values, counter);
    st._counter = counter;

    bot.sendMessage(chatId,
      `👀 *Ko'rinish / Предпросмотр:*\n\n${rendered}\n\n─────────────────\nTasdiqlaysizmi? / Подтверждаете?`,
      { parse_mode: 'Markdown', ...confirmKeyboard() });
  }

  function setValue(chatId, value) {
    const st = states[chatId];
    if (!st || st.step >= st.askFields.length) return;
    const field = st.askFields[st.step];
    st.values[field] = value;
    st.step++;
    askField(chatId);
  }

  // /start
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
      '📋 *Zayavka Bot*\n\n/zayavka — yangi zayavka / новая заявка\n/chatid — chat ID ni bilish',
      { parse_mode: 'Markdown' });
  });

  // /zayavka
  bot.onText(/\/zayavka/, (msg) => startZayavka(msg.chat.id));

  // /chatid — guruh ID sini bilish (admin uchun)
  bot.onText(/\/chatid/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
      `ℹ️ *Chat ID:* \`${chatId}\`\nTur / Тип: ${msg.chat.type}`,
      { parse_mode: 'Markdown' });
  });

  // Callback (tez tugmalar va tasdiqlash)
  bot.on('callback_query', async (q) => {
    const chatId = q.message.chat.id;
    const data   = q.data;
    bot.answerCallbackQuery(q.id).catch(() => {});
    bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: q.message.message_id }).catch(() => {});

    if (data.startsWith('zv_opt:')) {
      const parts = data.split(':');
      const field = parts[1];
      const value = decodeURIComponent(parts.slice(2).join(':'));
      const st = states[chatId];
      if (st && st.askFields[st.step] === field) setValue(chatId, value);
      return;
    }
    if (data === 'zv_skip_any' || data.startsWith('zv_skip:')) {
      const st = states[chatId];
      if (st) { st.step++; askField(chatId); }
      return;
    }
    if (data === 'zv_confirm') {
      const st = states[chatId];
      if (!st) return;
      try {
        const c       = getConfig(acc);
        const counter = st._counter ?? db.nextZayavkaCounter(acc);
        const text    = renderTemplate(c.template || '', st.values, counter);
        await sendToGroup(acc, text);
        db.saveZayavka(acc, { id: counter, date: new Date().toLocaleDateString('ru-RU'), text, values: st.values });
        bot.sendMessage(chatId,
          `✅ *Zayavka #${counter} yuborildi! / Заявка #${counter} отправлена!*`,
          { parse_mode: 'Markdown' });
        delete states[chatId];
      } catch (e) {
        bot.sendMessage(chatId, `❌ Xato / Ошибка: ${e.message}`);
      }
      return;
    }
    if (data === 'zv_restart') {
      delete states[chatId];
      startZayavka(chatId);
      return;
    }
  });

  // Matn xabarlar — maydon qiymati
  bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text   = (msg.text || '').trim();
    if (!text || text.startsWith('/')) return;

    const st = states[chatId];
    if (!st || st.step >= st.askFields.length) {
      bot.sendMessage(chatId, '/zayavka — yangi zayavka boshlash / начать новую заявку');
      return;
    }

    setValue(chatId, text);
  });

  bot.on('polling_error', (e) => console.error('[ZayavkaBot] polling xatosi:', e.code || e.message));

  running = true;
  console.log('✅ Zayavka Bot ishga tushdi!');
  return bot;
}

function stop() {
  if (bot) { try { bot.stopPolling(); } catch { /* ignore */ } }
  bot = null; running = false;
}

async function sendTestMessage(acc, chatId, text) {
  if (!running || !bot) throw new Error('Zayavka bot ishlamayapti');
  await bot.sendMessage(chatId, text);
}

module.exports = { start, stop, isRunning, getBot, sendTestMessage };
