// ─────────────────────────────────────────────────────────────────────────────
// Zayavka boti — ko'p-korxonali, tugmali menyu, invite link orqali kirish.
//
// Kirish:  t.me/BOT?start=INVITE_CODE  →  korxonaga ulanadi
// Menyu:   tugmalar (Reply Keyboard), komanda yozish shart emas
// Ko'p-korxona: har korxona o'z invite kodi bilan, bitta bot tokeni
// ─────────────────────────────────────────────────────────────────────────────
const TelegramBot = require('node-telegram-bot-api');
const db = require('../db');
const { DEFAULT_ACCOUNT, ZAYAVKA_BOT_TOKEN } = require('../config');

let bot = null;
let running = false;

const isRunning = () => running;
const getBot    = () => bot;
const todayRU   = () => new Date().toLocaleDateString('ru-RU');

// ── Yordamchi funksiyalar ───────────────────────────────────────────────────

function extractFields(template) {
  const seen = new Set(); const fields = [];
  for (const m of (template || '').matchAll(/\{(\w+)\}/g)) {
    if (!seen.has(m[1])) { seen.add(m[1]); fields.push(m[1]); }
  }
  return fields.filter(f => f !== 'number');
}

function renderTemplate(template, values, counter) {
  let out = template;
  out = out.replace(/\{number\}/g, String(counter));
  for (const [k, v] of Object.entries(values))
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), v ?? '—');
  return out;
}

const AUTO_VALUES = { sana: todayRU, date: todayRU };

function getConfig(acc) { return db.getZayavkaConfig(acc) || {}; }

async function sendToGroup(acc, text) {
  const cfg = getConfig(acc);
  if (!cfg.groupChatId) throw new Error('Guruh chat ID sozlanmagan');
  return await bot.sendMessage(cfg.groupChatId, text);
}

// ── Tugmalar (Reply Keyboard — doimiy pastda turadi) ───────────────────────

const MAIN_MENU = {
  reply_markup: {
    keyboard: [
      [{ text: '📋 Yangi zayavka' }],
      [{ text: '📦 Tiketlar' }, { text: '🗑 Bekor qilish' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  },
};

function removeKeyboard() {
  return { reply_markup: { remove_keyboard: true } };
}

// Maydon uchun inline keyboard (tez tugmalar)
function fieldInlineKb(fieldKey, options, skipable) {
  if (!options?.length) return skipable ? { reply_markup: { inline_keyboard: [[{ text: "⏭ O'tkazish", callback_data: 'zv_skip' }]] } } : null;
  const rows = [];
  for (let i = 0; i < options.length; i += 3)
    rows.push(options.slice(i, i + 3).map(o => ({ text: o, callback_data: `zv_opt:${fieldKey}:${encodeURIComponent(o)}` })));
  if (skipable) rows.push([{ text: "⏭ O'tkazish", callback_data: 'zv_skip' }]);
  return { reply_markup: { inline_keyboard: rows } };
}

function confirmKb() {
  return { reply_markup: { inline_keyboard: [[
    { text: '✅ Yuborish', callback_data: 'zv_confirm' },
    { text: '🔄 Qayta',   callback_data: 'zv_restart' },
  ]] } };
}

function ticketKb(tickets) {
  const rows = tickets.map(t => {
    const rem = (t.totalTonna || 0) - (t.usedTonna || 0);
    return [{ text: `${t.number} — ${t.marka} — ${rem}t`, callback_data: `zv_ticket:${t.id}` }];
  });
  rows.push([{ text: '✏️ Qo\'lda kiritish', callback_data: 'zv_manual' }]);
  return { reply_markup: { inline_keyboard: rows } };
}

function cancelListKb(log) {
  const rows = log.map(z => {
    const mashina = z.values?.mashina || z.values?.car || '';
    const tonna   = z.values?.tonna || z.values?.ton || '';
    return [{ text: `#${z.id} — ${z.date} — ${mashina} — ${tonna}t`, callback_data: `zv_cancel_pick:${z.id}` }];
  });
  return { reply_markup: { inline_keyboard: rows } };
}

// ── Asosiy menyu ko'rsatish ─────────────────────────────────────────────────

function showMenu(chatId, intro = '') {
  bot.sendMessage(chatId, (intro ? intro + '\n\n' : '') + '📋 *Asosiy menyu:*', { parse_mode: 'Markdown', ...MAIN_MENU });
}

// ── start() ─────────────────────────────────────────────────────────────────

function start(acc = DEFAULT_ACCOUNT) {
  const token = ZAYAVKA_BOT_TOKEN || getConfig(acc).botToken || '';
  if (!token || token.length < 10) {
    console.log('ℹ️  Zayavka bot token yo\'q. Bot ishlamaydi.');
    return null;
  }
  try { bot = new TelegramBot(token, { polling: true }); }
  catch (e) { console.error('[ZayavkaBot] Ulanish xatosi:', e.message); return null; }

  // sessionId → { accountId, step, fields, values, ticketId, ... }
  const sessions = {};

  function getSession(chatId) { return sessions[String(chatId)]; }
  function setSession(chatId, data) { sessions[String(chatId)] = data; }
  function clearSession(chatId) { delete sessions[String(chatId)]; }

  // Foydalanuvchining akkauntini aniqlash
  function getUserAccount(chatId) {
    return db.getZvUserAccount(chatId);
  }

  // ── /start — invite link orqali kirish ─────────────────────────────────
  bot.onText(/\/start(.*)/, (msg, match) => {
    const chatId = msg.chat.id;
    const code   = (match[1] || '').trim();

    if (code) {
      const foundAcc = db.findAccountByInviteCode(code);
      if (!foundAcc) {
        bot.sendMessage(chatId, '❌ Noto\'g\'ri havola. Admindan yangi havola so\'rang.', removeKeyboard());
        return;
      }
      db.linkZvUser(chatId, foundAcc);
      const cfg = getConfig(foundAcc);
      const name = cfg.companyName || foundAcc;
      showMenu(chatId, `✅ *${name}* tizimiga ulandi!`);
      return;
    }

    // Kodsiz /start
    const userAcc = getUserAccount(chatId);
    if (userAcc) {
      showMenu(chatId);
    } else {
      bot.sendMessage(chatId,
        '👋 Salom!\n\nBotdan foydalanish uchun admindan *invite havolani* oling va oching.',
        { parse_mode: 'Markdown', ...removeKeyboard() });
    }
  });

  // /chatid — admin uchun (guruh ID aniqlash)
  bot.onText(/\/chatid/, (msg) => {
    bot.sendMessage(msg.chat.id, `ℹ️ Chat ID: \`${msg.chat.id}\` (${msg.chat.type})`, { parse_mode: 'Markdown' });
  });

  // ── Tugma bosish (Reply Keyboard) ──────────────────────────────────────
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text   = (msg.text || '').trim();
    if (!text || text.startsWith('/')) return;

    const userAcc = getUserAccount(chatId);
    if (!userAcc) {
      bot.sendMessage(chatId, '👋 Kirish uchun admindan invite havolasini oling.');
      return;
    }

    const cfg = getConfig(userAcc);

    // Zayavka to'ldirish jarayonida matn kiritilgan
    const sess = getSession(chatId);
    if (sess?.step === 'fields') {
      handleFieldInput(chatId, userAcc, text);
      return;
    }

    // Tugma bosish
    switch (text) {
      case '📋 Yangi zayavka':
        startZayavka(chatId, userAcc);
        break;
      case '📦 Tiketlar':
        showTickets(chatId, userAcc);
        break;
      case '🗑 Bekor qilish':
        showCancelList(chatId, userAcc);
        break;
      default:
        showMenu(chatId);
    }
  });

  // ── Zayavka boshlash ────────────────────────────────────────────────────
  function startZayavka(chatId, userAcc) {
    const openTickets = db.getOpenTickets(userAcc);
    setSession(chatId, { step: 'ticket_select', accountId: userAcc });

    if (openTickets.length === 0) {
      bot.sendMessage(chatId, '⚠️ Ochiq tiket yo\'q, qo\'lda kiritamiz.', removeKeyboard());
      beginFieldCollection(chatId, userAcc, {});
      return;
    }

    bot.sendMessage(chatId,
      `📋 *Tiket tanlang* (${openTickets.length} ta ochiq):`,
      { parse_mode: 'Markdown', ...ticketKb(openTickets) });
  }

  // ── Maydonlarni to'ldirish ──────────────────────────────────────────────
  function beginFieldCollection(chatId, userAcc, prefilledValues) {
    const cfg       = getConfig(userAcc);
    const template  = cfg.template || '';
    const allFields = extractFields(template);

    if (!allFields.length) {
      bot.sendMessage(chatId, '⚠️ Shablon sozlanmagan. Adminga murojaat qiling.', MAIN_MENU);
      return;
    }

    const autoVals = {};
    for (const [k, fn] of Object.entries(AUTO_VALUES)) autoVals[k] = fn();
    for (const f of (cfg.autoFields || [])) if (!autoVals[f]) autoVals[f] = (cfg.fieldDefaults || {})[f] || '';

    const filled    = new Set([...Object.keys(autoVals), ...Object.keys(prefilledValues)]);
    const askFields = allFields.filter(f => !filled.has(f));
    const values    = { ...autoVals, ...prefilledValues };
    for (const f of allFields) if (!values[f] && (cfg.fieldDefaults || {})[f]) values[f] = cfg.fieldDefaults[f];

    const sess = getSession(chatId) || {};
    setSession(chatId, { ...sess, step: 'fields', accountId: userAcc, allFields, askFields, values, fieldStep: 0 });

    askNextField(chatId, userAcc);
  }

  function askNextField(chatId, userAcc) {
    const sess = getSession(chatId);
    if (!sess || sess.step !== 'fields') return;
    const cfg = getConfig(userAcc);

    if (sess.fieldStep >= sess.askFields.length) {
      showPreview(chatId, userAcc);
      return;
    }

    const field    = sess.askFields[sess.fieldStep];
    const label    = (cfg.fieldLabels || {})[field] || field;
    const options  = (cfg.fieldOptions || {})[field] || [];
    const optional = (cfg.optionalFields || []).includes(field);
    const n = sess.fieldStep + 1, total = sess.askFields.length;

    // Tonna so'ralganda qoldig'ini ko'rsatish
    let extra = '';
    if ((field === 'tonna' || field === 'ton') && sess.ticketId) {
      const t = db.getOpenTickets(userAcc).find(t => t.id === sess.ticketId);
      if (t) extra = `\n📦 ${t.number} — qoldi: *${(t.totalTonna||0)-(t.usedTonna||0)} t*`;
    }

    const text = `*[${n}/${total}] ${label}*${extra}`;
    const kb   = fieldInlineKb(field, options, optional);
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...(kb || {}) });
  }

  function handleFieldInput(chatId, userAcc, value) {
    const sess = getSession(chatId);
    if (!sess || sess.step !== 'fields' || sess.fieldStep >= sess.askFields.length) return;
    const field = sess.askFields[sess.fieldStep];
    sess.values[field] = value;
    sess.fieldStep++;
    setSession(chatId, sess);
    askNextField(chatId, userAcc);
  }

  function showPreview(chatId, userAcc) {
    const sess    = getSession(chatId);
    const cfg     = getConfig(userAcc);
    const counter = db.nextZayavkaCounter(userAcc);
    const text    = renderTemplate(cfg.template || '', sess.values, counter);
    sess._counter = counter;
    setSession(chatId, sess);

    let extra = '';
    if (sess.ticketId) {
      const t = db.getOpenTickets(userAcc).find(t => t.id === sess.ticketId);
      if (t) {
        const sent = Number(sess.values.tonna || sess.values.ton || 0);
        extra = `\n\n📦 Yuborilgandan keyin qoladi: *${(t.totalTonna||0)-(t.usedTonna||0)-sent} t*`;
      }
    }

    bot.sendMessage(chatId,
      `👀 *Ko'rinish:*\n\n${text}${extra}\n\n──────────────\nYuborilsinmi?`,
      { parse_mode: 'Markdown', ...confirmKb() });
  }

  // ── Tiketlar ro'yxati ───────────────────────────────────────────────────
  function showTickets(chatId, userAcc) {
    const open = db.getOpenTickets(userAcc);
    if (!open.length) { bot.sendMessage(chatId, '📭 Ochiq tiket yo\'q.', MAIN_MENU); return; }
    const lines = open.map(t => {
      const rem = (t.totalTonna||0)-(t.usedTonna||0);
      const p   = t.totalTonna ? Math.round((t.usedTonna||0)/t.totalTonna*100) : 0;
      return `• *${t.number}* — ${t.marka}\n  Qoldi: *${rem}t* (${100-p}%)`;
    });
    bot.sendMessage(chatId, `📦 *Ochiq tiketlar:*\n\n${lines.join('\n\n')}`, { parse_mode: 'Markdown', ...MAIN_MENU });
  }

  // ── Bekor qilish ro'yxati ───────────────────────────────────────────────
  function showCancelList(chatId, userAcc) {
    const log = db.getZayavkaLog(userAcc, 10).filter(z => !z.cancelled);
    if (!log.length) { bot.sendMessage(chatId, '📭 Bekor qilish mumkin bo\'lgan zayavka yo\'q.', MAIN_MENU); return; }
    bot.sendMessage(chatId, '🗑 *Qaysi zayavkani bekor qilasiz?*', { parse_mode: 'Markdown', ...cancelListKb(log) });
  }

  function showCancelConfirm(chatId, userAcc, zayavkaId) {
    const log = db.getZayavkaLog(userAcc, 100);
    const z   = log.find(x => x.id === zayavkaId);
    if (!z)          { bot.sendMessage(chatId, '❌ Topilmadi.', MAIN_MENU); return; }
    if (z.cancelled) { bot.sendMessage(chatId, '⚠️ Allaqachon bekor qilingan.', MAIN_MENU); return; }
    bot.sendMessage(chatId,
      `🗑 *#${z.id} ni bekor qilasizmi?*\n\n${z.text}`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
        { text: '✅ Ha, bekor', callback_data: `zv_cancel_confirm:${zayavkaId}` },
        { text: '❌ Yo\'q',    callback_data: 'zv_cancel_no' },
      ]] } });
  }

  // ── Callback (inline tugmalar) ──────────────────────────────────────────
  bot.on('callback_query', async (q) => {
    const chatId  = q.message.chat.id;
    const data    = q.data;
    const userAcc = getUserAccount(chatId);
    bot.answerCallbackQuery(q.id).catch(() => {});
    bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: q.message.message_id }).catch(() => {});

    if (!userAcc && !data.startsWith('zv_cancel')) {
      bot.sendMessage(chatId, '👋 Kirish uchun invite havolasini oling.');
      return;
    }

    // Tiket tanlash
    if (data.startsWith('zv_ticket:')) {
      const ticketId = data.replace('zv_ticket:', '');
      const ticket   = db.getOpenTickets(userAcc).find(t => t.id === ticketId);
      if (!ticket) { bot.sendMessage(chatId, '❌ Tiket topilmadi.', MAIN_MENU); return; }
      const rem = (ticket.totalTonna||0)-(ticket.usedTonna||0);
      setSession(chatId, { ...(getSession(chatId)||{}), ticketId });
      bot.sendMessage(chatId, `✅ *${ticket.number}* — ${ticket.marka}\nQoldi: *${rem} t*`, { parse_mode: 'Markdown' });
      setTimeout(() => beginFieldCollection(chatId, userAcc, { tiket: ticket.number, marka: ticket.marka }), 300);
      return;
    }

    // Qo'lda kiritish
    if (data === 'zv_manual') {
      setSession(chatId, { ...(getSession(chatId)||{}), ticketId: null });
      beginFieldCollection(chatId, userAcc, {});
      return;
    }

    // Tez tugma
    if (data.startsWith('zv_opt:')) {
      const parts = data.split(':');
      const field = parts[1];
      const value = decodeURIComponent(parts.slice(2).join(':'));
      const sess  = getSession(chatId);
      if (sess?.step === 'fields' && sess.askFields[sess.fieldStep] === field) handleFieldInput(chatId, userAcc, value);
      return;
    }

    // O'tkazib yuborish
    if (data === 'zv_skip') {
      const sess = getSession(chatId);
      if (sess?.step === 'fields') { sess.fieldStep++; setSession(chatId, sess); askNextField(chatId, userAcc); }
      return;
    }

    // Tasdiqlash
    if (data === 'zv_confirm') {
      const sess = getSession(chatId);
      if (!sess) return;
      try {
        const cfg     = getConfig(userAcc);
        const counter = sess._counter ?? db.nextZayavkaCounter(userAcc);
        const text    = renderTemplate(cfg.template || '', sess.values, counter);
        const sent    = await sendToGroup(userAcc, text);

        let ticketMsg = '';
        if (sess.ticketId) {
          const tonna   = Number(sess.values.tonna || sess.values.ton || 0);
          const updated = db.useTicketTonna(userAcc, sess.ticketId, tonna);
          if (updated) ticketMsg = `\n📦 *${updated.number}* qoldi: *${(updated.totalTonna||0)-(updated.usedTonna||0)} t*`;
        }

        db.saveZayavka(userAcc, {
          id: counter, date: todayRU(), text, values: sess.values,
          ticketId: sess.ticketId || null,
          groupChatId: cfg.groupChatId, groupMessageId: sent?.message_id || null,
        });

        clearSession(chatId);
        showMenu(chatId, `✅ *Zayavka #${counter} yuborildi!*${ticketMsg}`);
      } catch (e) {
        bot.sendMessage(chatId, `❌ Xato: ${e.message}`, MAIN_MENU);
      }
      return;
    }

    // Qayta boshlash
    if (data === 'zv_restart') {
      clearSession(chatId);
      startZayavka(chatId, userAcc);
      return;
    }

    // Bekor — tanlash
    if (data.startsWith('zv_cancel_pick:')) {
      showCancelConfirm(chatId, userAcc, Number(data.replace('zv_cancel_pick:', '')));
      return;
    }

    // Bekor — tasdiqlash
    if (data.startsWith('zv_cancel_confirm:')) {
      const zayavkaId = Number(data.replace('zv_cancel_confirm:', ''));
      try {
        const cancelled = db.cancelZayavka(userAcc, zayavkaId);
        if (!cancelled) { bot.sendMessage(chatId, '❌ Topilmadi yoki allaqachon bekor.', MAIN_MENU); return; }

        let deleteMsg = '';
        if (cancelled.groupChatId && cancelled.groupMessageId) {
          try {
            await bot.deleteMessage(cancelled.groupChatId, cancelled.groupMessageId);
            deleteMsg = '\n🗑 Guruhdan o\'chirildi.';
          } catch (e) {
            const hint = e?.response?.body?.description || e.message || '';
            deleteMsg = hint.includes('not enough rights')
              ? '\n⚠️ Guruhdan o\'chirib bo\'lmadi: botni admin qiling.'
              : '\n⚠️ Guruhdan o\'chirib bo\'lmadi.';
          }
        }

        let ticketMsg = '';
        if (cancelled.ticketId) {
          const tonna   = Number(cancelled.values?.tonna || cancelled.values?.ton || 0);
          const updated = db.restoreTicketTonna(userAcc, cancelled.ticketId, tonna);
          if (updated) ticketMsg = `\n📦 *${updated.number}* qoldi: *${(updated.totalTonna||0)-(updated.usedTonna||0)} t*`;
        }

        showMenu(chatId, `✅ *#${zayavkaId} bekor qilindi!*${deleteMsg}${ticketMsg}`);
      } catch (e) {
        bot.sendMessage(chatId, `❌ Xato: ${e.message}`, MAIN_MENU);
      }
      return;
    }

    if (data === 'zv_cancel_no') {
      showMenu(chatId);
      return;
    }
  });

  bot.on('polling_error', (e) => console.error('[ZayavkaBot] polling:', e.code || e.message));

  running = true;
  console.log('✅ Zayavka Bot ishga tushdi!');
  return bot;
}

function stop() {
  if (bot) { try { bot.stopPolling(); } catch { /* ignore */ } }
  bot = null; running = false;
}

module.exports = { start, stop, isRunning, getBot };
