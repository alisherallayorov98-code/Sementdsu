// ─────────────────────────────────────────────────────────────────────────────
// Zayavka boti — zavodga sement chiqarish buyurtmalarini gruppaga yuboradi.
//
// Oqim (tiket tizimi bilan):
//   /zayavka → ochiq tiketlar ro'yxati → tiket tanlanadi (marka/raqam auto)
//              → mashina raqami → tonna → preview → guruhga yuboradi
//              → tiket qoldig'i kamayadi
//
// Tiket yo'q bo'lsa: eski oqim (qo'lda tiket raqami + marka kiritish)
// ─────────────────────────────────────────────────────────────────────────────
const TelegramBot = require('node-telegram-bot-api');
const db = require('../db');
const { DEFAULT_ACCOUNT } = require('../config');

let bot = null;
let running = false;

const isRunning = () => running;
const getBot    = () => bot;

const todayRU = () => new Date().toLocaleDateString('ru-RU');

// Avtomatik to'ldiriladigan maydonlar
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
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), v ?? '—');
  }
  return out;
}

function getConfig(acc) {
  return db.getZayavkaConfig(acc) || {};
}

async function sendToGroup(acc, text) {
  const cfg = getConfig(acc);
  if (!cfg.groupChatId) throw new Error('Guruh chat ID sozlanmagan');
  const sent = await bot.sendMessage(cfg.groupChatId, text);
  return sent; // { message_id, chat, ... }
}

// Tiket tugmalari (ochiq tiketlar)
function ticketKeyboard(tickets) {
  const rows = tickets.map(t => {
    const remaining = (t.totalTonna || 0) - (t.usedTonna || 0);
    const label = `${t.number} — ${t.marka} — ${remaining}t qoldi`;
    return [{ text: label, callback_data: `zv_ticket:${t.id}` }];
  });
  rows.push([{ text: '✏️ Qo\'lda kiritish / Вручную', callback_data: 'zv_manual' }]);
  return { reply_markup: { inline_keyboard: rows } };
}

// Maydon uchun inline keyboard
function fieldKeyboard(fieldKey, options, skipable) {
  if (!options || options.length === 0) return skipable ? skipKeyboard() : null;
  const rows = [];
  for (let i = 0; i < options.length; i += 3) {
    rows.push(options.slice(i, i + 3).map(o => ({
      text: o,
      callback_data: `zv_opt:${fieldKey}:${encodeURIComponent(o)}`,
    })));
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

  // chatId → { allFields, askFields, values, step, ticketId? }
  const states = {};

  // Auto qiymatlarni to'ldirish
  function buildAutoValues(c) {
    const auto = {};
    for (const [k, fn] of Object.entries(AUTO_VALUES)) auto[k] = fn();
    for (const f of (c.autoFields || [])) {
      if (!auto[f]) auto[f] = (c.fieldDefaults || {})[f] || '';
    }
    return auto;
  }

  // Tiket tanlanganidan so'ng yoki qo'lda oqimni boshlash
  function beginFieldCollection(chatId, prefilledValues = {}) {
    const c = getConfig(acc);
    const template  = c.template || '';
    const allFields = extractFields(template);

    if (allFields.length === 0) {
      bot.sendMessage(chatId, '⚠️ Shablon sozlanmagan. Admin panelda Settings → Zayavka Bot ni sozlang.');
      return;
    }

    const autoVals = buildAutoValues(c);
    // Avtomatik va tiket orqali to'ldirilgan maydonlarni so'ramaymiz
    const filledFields = new Set([...Object.keys(autoVals), ...Object.keys(prefilledValues)]);
    const askFields = allFields.filter(f => !filledFields.has(f));

    const values = { ...autoVals, ...prefilledValues };
    for (const f of allFields) {
      if (!values[f] && (c.fieldDefaults || {})[f]) values[f] = c.fieldDefaults[f];
    }

    states[chatId] = { ...states[chatId], allFields, askFields, values, step: 0 };

    if (askFields.length === 0) {
      showPreview(chatId);
    } else {
      askField(chatId);
    }
  }

  function startZayavka(chatId) {
    const openTickets = db.getOpenTickets(acc);
    states[chatId] = { ticketId: null };

    if (openTickets.length === 0) {
      // Tiket yo'q — qo'lda kiritish
      bot.sendMessage(chatId,
        '📋 *Zayavka / Заявка*\n\n⚠️ Ochiq tiket yo\'q. Qo\'lda kiritamiz.',
        { parse_mode: 'Markdown' });
      setTimeout(() => beginFieldCollection(chatId), 200);
      return;
    }

    bot.sendMessage(chatId,
      `📋 *Zayavka / Заявка*\n\nTiket tanlang / Выберите тикет (${openTickets.length} ta ochiq):`,
      { parse_mode: 'Markdown', ...ticketKeyboard(openTickets) });
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
    if (options.length) text += '\n\nQuyidagilardan tanlang yoki yozing / Выберите или напишите:';
    else text += '\n\nYozing / Напишите:';

    // Tonna so'ralganda — tiket qoldig'ini ko'rsatamiz
    if ((field === 'tonna' || field === 'ton') && st.ticketId) {
      const openTickets = db.getOpenTickets(acc);
      const ticket = openTickets.find(t => t.id === st.ticketId);
      if (ticket) {
        const remaining = (ticket.totalTonna || 0) - (ticket.usedTonna || 0);
        text += `\n\n📦 *${ticket.number}* — qoldi: *${remaining} t*`;
      }
    }

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

    // Preview uchun counter incrementi — confirm da ishlatilinadi
    const counter  = db.nextZayavkaCounter(acc);
    const rendered = renderTemplate(c.template || '', st.values, counter);
    st._counter = counter;

    // Tiket qoldig'ini ko'rsatamiz
    let extra = '';
    if (st.ticketId) {
      const openTickets = db.getOpenTickets(acc);
      const ticket = openTickets.find(t => t.id === st.ticketId);
      if (ticket) {
        const sent      = Number(st.values.tonna || st.values.ton || 0);
        const remaining = (ticket.totalTonna || 0) - (ticket.usedTonna || 0) - sent;
        extra = `\n\n📦 Yuborilgandan keyin qoladi: *${remaining} t*`;
      }
    }

    bot.sendMessage(chatId,
      `👀 *Ko'rinish / Предпросмотр:*\n\n${rendered}${extra}\n\n─────────────────\nTasdiqlaysizmi? / Подтверждаете?`,
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

  // ── Bot hodisalari ──────────────────────────────────────────────────────────

  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
      '📋 *Zayavka Bot*\n\n/zayavka — yangi zayavka\n/bekor — zayavkani bekor qilish\n/tiketlar — ochiq tiketlar qoldig\'i\n/chatid — chat ID ni bilish',
      { parse_mode: 'Markdown' });
  });

  bot.onText(/\/zayavka/, (msg) => startZayavka(msg.chat.id));

  // /tiketlar — ochiq tiketlar ro'yxatini ko'rish
  bot.onText(/\/tiketlar/, (msg) => {
    const openTickets = db.getOpenTickets(acc);
    if (openTickets.length === 0) {
      bot.sendMessage(msg.chat.id, '📭 Hozir ochiq tiket yo\'q.');
      return;
    }
    const lines = openTickets.map(t => {
      const remaining = (t.totalTonna || 0) - (t.usedTonna || 0);
      const pct = t.totalTonna ? Math.round((t.usedTonna || 0) / t.totalTonna * 100) : 0;
      return `• *${t.number}* — ${t.marka}\n  Jami: ${t.totalTonna}t | Ishlatildi: ${t.usedTonna || 0}t | Qoldi: *${remaining}t* (${pct}%)`;
    });
    bot.sendMessage(msg.chat.id,
      `📋 *Ochiq tiketlar (${openTickets.length} ta):*\n\n${lines.join('\n\n')}`,
      { parse_mode: 'Markdown' });
  });

  bot.onText(/\/chatid/, (msg) => {
    bot.sendMessage(msg.chat.id,
      `ℹ️ *Chat ID:* \`${msg.chat.id}\`\nTur: ${msg.chat.type}`,
      { parse_mode: 'Markdown' });
  });

  // /bekor [raqam] — zayavkani bekor qilish va guruhdan o'chirish
  bot.onText(/\/bekor(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const arg    = (match[1] || '').trim();

    if (arg) {
      // /bekor 47 — to'g'ridan-to'g'ri raqam bilan
      const num = Number(arg);
      if (!num) { bot.sendMessage(chatId, '❌ Noto\'g\'ri raqam. /bekor 47 ko\'rinishida yozing.'); return; }
      showCancelConfirm(chatId, num);
    } else {
      // /bekor — oxirgi zayavkalar ro'yxatini ko'rsatish
      const log = db.getZayavkaLog(acc, 10).filter(z => !z.cancelled);
      if (log.length === 0) {
        bot.sendMessage(chatId, '📭 Bekor qilish mumkin bo\'lgan zayavka yo\'q.');
        return;
      }
      const rows = log.map(z => {
        const mashina = z.values?.mashina || z.values?.car || '';
        const tonna   = z.values?.tonna   || z.values?.ton || '';
        const label   = `#${z.id} — ${z.date} — ${mashina} — ${tonna}t`;
        return [{ text: label, callback_data: `zv_cancel_pick:${z.id}` }];
      });
      bot.sendMessage(chatId,
        '🗑 *Qaysi zayavkani bekor qilasiz?*\n_Oxirgi 10 ta (bekor qilinmaganlar):_',
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } });
    }
  });

  function showCancelConfirm(chatId, zayavkaId) {
    const log = db.getZayavkaLog(acc, 100);
    const z   = log.find(x => x.id === zayavkaId);
    if (!z) { bot.sendMessage(chatId, `❌ #${zayavkaId} raqamli zayavka topilmadi.`); return; }
    if (z.cancelled) { bot.sendMessage(chatId, `⚠️ #${zayavkaId} allaqachon bekor qilingan.`); return; }

    bot.sendMessage(chatId,
      `🗑 *#${z.id} zayavkani bekor qilasizmi?*\n\n${z.text}\n\n_Guruhdan ochiriladi${z.ticketId ? ' va tiket qoldighi tiklanadi.' : '.'}_`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[
          { text: '✅ Ha, bekor qilish', callback_data: `zv_cancel_confirm:${zayavkaId}` },
          { text: '❌ Yo\'q',             callback_data: 'zv_cancel_no' },
        ]]},
      });
  }

  // Callback (tiket tanlash, tez tugmalar, tasdiqlash)
  bot.on('callback_query', async (q) => {
    const chatId = q.message.chat.id;
    const data   = q.data;
    bot.answerCallbackQuery(q.id).catch(() => {});
    bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: q.message.message_id }).catch(() => {});

    // Bekor qilish — ro'yxatdan tanlash
    if (data.startsWith('zv_cancel_pick:')) {
      const zayavkaId = Number(data.replace('zv_cancel_pick:', ''));
      showCancelConfirm(chatId, zayavkaId);
      return;
    }

    // Bekor qilish — tasdiqlash
    if (data.startsWith('zv_cancel_confirm:')) {
      const zayavkaId = Number(data.replace('zv_cancel_confirm:', ''));
      try {
        const cancelled = db.cancelZayavka(acc, zayavkaId);
        if (!cancelled) {
          bot.sendMessage(chatId, '❌ Zayavka topilmadi yoki allaqachon bekor qilingan.');
          return;
        }

        // Guruhdan xabarni o'chirish
        let deleteMsg = '';
        if (cancelled.groupChatId && cancelled.groupMessageId) {
          try {
            await bot.deleteMessage(cancelled.groupChatId, cancelled.groupMessageId);
            deleteMsg = '\n🗑 Guruhdan o\'chirildi.';
          } catch (delErr) {
            // Bot guruhda "Delete messages" huquqiga ega admin bo'lishi kerak.
            // Admin bo'lsa — istalgan vaqtda o'chiriladi (vaqt cheklov yo'q).
            const hint = delErr?.response?.body?.description || delErr.message || '';
            if (hint.includes('not enough rights') || hint.includes('MESSAGE_DELETE_FORBIDDEN')) {
              deleteMsg = '\n⚠️ O\'chirib bo\'lmadi: botni guruhda "Xabarlarni o\'chirish" huquqi bilan admin qiling.';
            } else if (hint.includes('message to delete not found')) {
              deleteMsg = '\n⚠️ Xabar allaqachon o\'chirilgan.';
            } else {
              deleteMsg = `\n⚠️ O\'chirib bo\'lmadi: ${hint}`;
            }
          }
        } else {
          deleteMsg = '\n⚠️ Xabar ID saqlanmagan (eski zayavka bo\'lishi mumkin).';
        }

        // Tiket qoldig'ini tiklash
        let ticketMsg = '';
        if (cancelled.ticketId) {
          const tonna   = Number(cancelled.values?.tonna || cancelled.values?.ton || 0);
          const updated = db.restoreTicketTonna(acc, cancelled.ticketId, tonna);
          if (updated) {
            const remaining = (updated.totalTonna || 0) - (updated.usedTonna || 0);
            ticketMsg = `\n📦 *${updated.number}* qoldi: *${remaining} t* (${tonna}t tiklandi)`;
          }
        }

        bot.sendMessage(chatId,
          `✅ *#${zayavkaId} zayavka bekor qilindi!*${deleteMsg}${ticketMsg}`,
          { parse_mode: 'Markdown' });
      } catch (e) {
        bot.sendMessage(chatId, `❌ Xato: ${e.message}`);
      }
      return;
    }

    // Bekor qilishdan voz kechish
    if (data === 'zv_cancel_no') {
      bot.sendMessage(chatId, '↩️ Bekor qilish to\'xtatildi.');
      return;
    }

    // Tiket tanlash
    if (data.startsWith('zv_ticket:')) {
      const ticketId    = data.replace('zv_ticket:', '');
      const openTickets = db.getOpenTickets(acc);
      const ticket      = openTickets.find(t => t.id === ticketId);
      if (!ticket) {
        bot.sendMessage(chatId, '❌ Tiket topilmadi yoki yopilgan. /zayavka — qayta boshlash.');
        delete states[chatId];
        return;
      }
      const remaining = (ticket.totalTonna || 0) - (ticket.usedTonna || 0);
      states[chatId] = { ticketId };
      bot.sendMessage(chatId,
        `✅ *${ticket.number}* — ${ticket.marka}\nQoldi: *${remaining} t*`,
        { parse_mode: 'Markdown' });
      setTimeout(() => beginFieldCollection(chatId, { tiket: ticket.number, marka: ticket.marka }), 300);
      return;
    }

    // Qo'lda kiritish (tiket tanlash o'rniga)
    if (data === 'zv_manual') {
      states[chatId] = { ticketId: null };
      bot.sendMessage(chatId, '✏️ Qo\'lda kiritish / Ручной ввод');
      setTimeout(() => beginFieldCollection(chatId), 300);
      return;
    }

    // Tez tugmalar
    if (data.startsWith('zv_opt:')) {
      const parts = data.split(':');
      const field = parts[1];
      const value = decodeURIComponent(parts.slice(2).join(':'));
      const st = states[chatId];
      if (st && st.askFields && st.askFields[st.step] === field) setValue(chatId, value);
      return;
    }

    // O'tkazib yuborish
    if (data === 'zv_skip_any' || data.startsWith('zv_skip:')) {
      const st = states[chatId];
      if (st) { st.step++; askField(chatId); }
      return;
    }

    // Tasdiqlash — guruhga yuborish
    if (data === 'zv_confirm') {
      const st = states[chatId];
      if (!st) return;
      try {
        const c       = getConfig(acc);
        const counter = st._counter ?? db.nextZayavkaCounter(acc);
        const text    = renderTemplate(c.template || '', st.values, counter);

        const sent = await sendToGroup(acc, text);

        // Tiket qoldig'ini kamaytirish
        let ticketMsg = '';
        let ticketId  = st.ticketId || null;
        if (ticketId) {
          const tonna = Number(st.values.tonna || st.values.ton || 0);
          const updated = db.useTicketTonna(acc, ticketId, tonna);
          if (updated) {
            const remaining = (updated.totalTonna || 0) - (updated.usedTonna || 0);
            ticketMsg = `\n📦 *${updated.number}* qoldi: *${remaining} t*`;
          }
        }

        db.saveZayavka(acc, {
          id:             counter,
          date:           todayRU(),
          text,
          values:         st.values,
          ticketId,
          groupChatId:    c.groupChatId,
          groupMessageId: sent?.message_id || null,
        });

        bot.sendMessage(chatId,
          `✅ *Zayavka #${counter} yuborildi!*${ticketMsg}\n\n_Bekor qilish: /bekor_`,
          { parse_mode: 'Markdown' });
        delete states[chatId];
      } catch (e) {
        bot.sendMessage(chatId, `❌ Xato / Ошибка: ${e.message}`);
      }
      return;
    }

    // Qayta boshlash
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
    if (!st || !st.askFields || st.step >= st.askFields.length) {
      bot.sendMessage(chatId, '/zayavka — yangi zayavka boshlash / начать заявку');
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
