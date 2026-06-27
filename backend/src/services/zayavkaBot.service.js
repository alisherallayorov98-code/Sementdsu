// ─────────────────────────────────────────────────────────────────────────────
// Zayavka boti — zavodga sement chiqarish buyurtmalarini gruppaga yuboradi.
//
// Oqim:
//   /zayavka → shablon maydonlarini ketma-ket so'raydi → preview → guruhga yuboradi
//
// Shablon: admin kiritadi, {field} placeholder'lar maydonlarni belgilaydi.
// Tez tugmalar: admin har maydon uchun variantlar belgilaydi.
// ─────────────────────────────────────────────────────────────────────────────
const TelegramBot = require('node-telegram-bot-api');
const db = require('../db');
const { DEFAULT_ACCOUNT } = require('../config');

let bot = null;
let running = false;

const isRunning = () => running;
const getBot    = () => bot;

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');

// Shablon dan {field} maydonlarini tartibda ajratib olish
function extractFields(template) {
  const seen = new Set();
  const fields = [];
  for (const m of (template || '').matchAll(/\{(\w+)\}/g)) {
    if (!seen.has(m[1])) { seen.add(m[1]); fields.push(m[1]); }
  }
  return fields.filter(f => f !== 'number'); // {number} auto
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

// Konfiguratsiyani olish
function getConfig(acc) {
  return db.getZayavkaConfig(acc) || {};
}

// Guruhga zayavka yuborish
async function sendToGroup(acc, text) {
  const cfg = getConfig(acc);
  if (!cfg.groupChatId) throw new Error('Guruh chat ID sozlanmagan');
  await bot.sendMessage(cfg.groupChatId, text, { parse_mode: 'Markdown' });
}

// Maydon uchun inline keyboard (options bo'lsa)
function fieldKeyboard(fieldKey, options, skipable) {
  if (!options || options.length === 0) return skipable ? skipKeyboard() : null;
  const rows = [];
  for (let i = 0; i < options.length; i += 3) {
    rows.push(options.slice(i, i + 3).map(o => ({ text: o, callback_data: `zv_opt:${fieldKey}:${o}` })));
  }
  if (skipable) rows.push([{ text: "⏭ O'tkazib yuborish", callback_data: `zv_skip:${fieldKey}` }]);
  return { reply_markup: { inline_keyboard: rows } };
}

function skipKeyboard() {
  return { reply_markup: { inline_keyboard: [[{ text: "⏭ O'tkazib yuborish", callback_data: 'zv_skip_any' }]] } };
}

function confirmKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Guruhga yuborish', callback_data: 'zv_confirm' },
        { text: '✏️ Qayta boshlash',   callback_data: 'zv_restart' },
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

  const states = {}; // chatId → { fields, values, step, currentField }

  function startZayavka(chatId) {
    const c = getConfig(acc);
    const template = c.template || '';
    const fields   = extractFields(template);
    if (fields.length === 0) {
      bot.sendMessage(chatId, '⚠️ Shablon sozlanmagan. Admin panelda zayavka shablonini kiriting.');
      return;
    }
    const today = new Date().toLocaleDateString('ru-RU');
    const defaults = Object.assign({ sana: today }, c.fieldDefaults || {});
    states[chatId] = { fields, values: Object.assign({}, defaults), step: 0 };
    askField(chatId);
  }

  function askField(chatId) {
    const st = states[chatId];
    if (!st) return;
    const c = getConfig(acc);

    // Tugagan bo'lsa — preview
    if (st.step >= st.fields.length) {
      showPreview(chatId);
      return;
    }

    const field    = st.fields[st.step];
    const label    = (c.fieldLabels || {})[field] || field;
    const options  = (c.fieldOptions || {})[field] || [];
    const defVal   = st.values[field];
    const optional = (c.optionalFields || []).includes(field);

    let text = `*${label}*`;
    if (defVal) text += `\n_Oldingi: ${defVal}_ (Enter yuborsa qabul qilinadi)`;
    if (options.length) text += '\n\nQuyidagilardan tanlang yoki o\'zingiz yozing:';

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
    const counter = db.nextZayavkaCounter(acc);
    const rendered = renderTemplate(c.template || '', st.values, counter);
    st._counter = counter;

    bot.sendMessage(chatId,
      `👀 *Ko'rinish:*\n\n${rendered}\n\n─────────────────\nTasdiqlaysizmi?`,
      { parse_mode: 'Markdown', ...confirmKeyboard() });
  }

  function setValue(chatId, value) {
    const st = states[chatId];
    if (!st || st.step >= st.fields.length) return;
    const field = st.fields[st.step];
    st.values[field] = value;
    st.step++;
    askField(chatId);
  }

  // /start
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
      '📋 *Zayavka boti*\n\n/zayavka — yangi zayavka yuborish\n/chatid — bu chatning ID sini bilish',
      { parse_mode: 'Markdown' });
  });

  // /zayavka
  bot.onText(/\/zayavka/, (msg) => startZayavka(msg.chat.id));

  // /chatid — guruh ID sini bilish (admin uchun)
  bot.onText(/\/chatid/, (msg) => {
    const chatId = msg.chat.id;
    const type   = msg.chat.type;
    bot.sendMessage(chatId,
      `ℹ️ *Chat ID:* \`${chatId}\`\n*Tur:* ${type}`,
      { parse_mode: 'Markdown' });
  });

  // Callback (tez tugmalar va tasdiqlash)
  bot.on('callback_query', async (q) => {
    const chatId = q.message.chat.id;
    const data   = q.data;
    bot.answerCallbackQuery(q.id).catch(() => {});
    bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: q.message.message_id }).catch(() => {});

    if (data.startsWith('zv_opt:')) {
      const [, field, value] = data.split(':');
      const st = states[chatId];
      if (st && st.fields[st.step] === field) setValue(chatId, value);
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
        bot.sendMessage(chatId, `✅ *Zayavka #${counter} yuborildi!*`, { parse_mode: 'Markdown' });
        delete states[chatId];
      } catch (e) {
        bot.sendMessage(chatId, `❌ Xato: ${e.message}`);
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
    if (!st || st.step >= st.fields.length) {
      bot.sendMessage(chatId, '/zayavka — yangi zayavka boshlash');
      return;
    }

    const field  = st.fields[st.step];
    const defVal = st.values[field];

    // Bo'sh Enter yoki '.' → default qiymat
    if ((text === '.' || text === '-') && defVal) {
      setValue(chatId, defVal);
    } else {
      setValue(chatId, text);
    }
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

// Frontend dan xabar yuborish (test uchun)
async function sendTestMessage(acc, chatId, text) {
  if (!running || !bot) throw new Error('Zayavka bot ishlamayapti');
  await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

module.exports = { start, stop, isRunning, getBot, sendTestMessage };
