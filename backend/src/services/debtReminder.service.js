// Qarz eslatma xizmati — har dushanba soat 09:00 da qarzdor mijozlarga
// Telegram orqali avtomatik xabar yuboradi.
// Faqat telegramChatId ulangan va qolgan qarzi > 0 bo'lgan mijozlarga.
const cron = require('node-cron');
const db   = require('../db');

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');

// Barcha akkauntlar uchun qarzdorlarni topib xabar yuboradi
async function sendDebtReminders(bot, accountId = 'default') {
  const state = db.getState(accountId);
  const debtRows = state.debt_rows || [];
  const customers = state.customers || [];

  // Mijoz bo'yicha qoldiq qarz hisoblash
  const debtByCustomer = {};
  for (const r of debtRows) {
    const rem = Math.max(0, Number(r.amount || 0) - Number(r.paid || 0));
    if (rem <= 0) continue;
    debtByCustomer[r.customer] = (debtByCustomer[r.customer] || 0) + rem;
  }

  let sent = 0, skipped = 0;
  for (const [customerName, remaining] of Object.entries(debtByCustomer)) {
    const cust = customers.find(c => c.name === customerName);
    const chatId = cust?.telegramChatId
      || db.findChatId(accountId, cust?.phone || '');

    if (!chatId) { skipped++; continue; }

    const msg =
      `📢 Eslatma!\n\n` +
      `Hurmatli *${customerName}*,\n` +
      `Sizning qoldiq qarzingiz: *${fmt(remaining)} so'm*\n\n` +
      `Iltimos, imkon bo'lsa to'lovni amalga oshiring.\n` +
      `Savollar uchun bizga murojaat qiling. Rahmat! 🙏`;

    try {
      await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
      sent++;
      // Botni spam bosimidan himoya qilish uchun qisqa pauza
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`[DebtReminder] ${customerName} ga yuborilmadi (chatId=${chatId}):`, err.message);
    }
  }

  console.log(`[DebtReminder] Yuborildi: ${sent}, Telegram ulanmagan: ${skipped}, Jami qarzdor: ${Object.keys(debtByCustomer).length}`);
  return { sent, skipped, total: Object.keys(debtByCustomer).length };
}

// Cron jadvalini boshlash
// Har dushanba soat 09:00 (Toshkent vaqti = UTC+5 → UTC 04:00)
function start(bot) {
  // '0 4 * * 1' = UTC 04:00, dushanba (Toshkent 09:00)
  cron.schedule('0 4 * * 1', () => {
    console.log('[DebtReminder] Haftalik eslatma yuborilmoqda...');
    sendDebtReminders(bot).catch(e => console.error('[DebtReminder] Xato:', e.message));
  }, { timezone: 'UTC' });

  console.log('[DebtReminder] Jadval faollashtirildi: har dushanba 09:00 (Toshkent)');
}

module.exports = { start, sendDebtReminders };
