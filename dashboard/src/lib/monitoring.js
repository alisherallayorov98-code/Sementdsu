// ─────────────────────────────────────────────────────────────────────────────
// Mijoz faolligini nazorat qilish — "jim qolgan" mijozlarni aniqlash.
//
// Mantiq: korxona ko'p do'konlarga yuk tarqatadi. Doimiy mijoz odatda har necha
// kunda yangi yuk oladi. Agar belgilangan muddat ichida (masalan 2 hafta) yangi
// xarid bo'lmasa — bu xavf signali: mijoz boshqa yerdan olmoqda yoki pulni
// "uxlatmoqda". Shunday mijozni rahbar darrov ko'rishi va aniqlashi kerak.
//
// MUHIM: hamma mijoz emas, faqat NAZORATGA belgilangan (monitored:true) mijozlar
// tekshiriladi. Bir martalik mijozlar bekorga anomaliyaga tushmaydi.
//
// Muddat (threshold): global standart (appSettings.monitorDays, default 14 kun).
// Har bir mijozga alohida muddat (customer.monitorDays) ham qo'yish mumkin.
// ─────────────────────────────────────────────────────────────────────────────

const DAY = 86400000;

export const STATUS = {
  ok:      { key: 'ok',      label: 'Faol',           color: '#2e7d32', bg: '#e8f5e9', icon: '✓'  },
  warning: { key: 'warning', label: 'Yaqinlashmoqda', color: '#ef6c00', bg: '#fff3e0', icon: '⏳' },
  alert:   { key: 'alert',   label: 'JIM QOLDI',      color: '#c62828', bg: '#ffebee', icon: '⚠️' },
  never:   { key: 'never',   label: "Xarid yo'q",     color: '#6a1b9a', bg: '#f3e5f5', icon: '❓' },
};

// Mijoz uchun amaldagi muddatni aniqlash (alohida bo'lmasa — global)
export function effectiveDays(customer, globalDays) {
  const own = Number(customer?.monitorDays);
  if (own > 0) return own;
  const g = Number(globalDays);
  return g > 0 ? g : 14;
}

// Mijozning faollik holatini hisoblash.
// summary — customerSummary() natijasi (lastSaleAt kerak).
export function activityStatus(summary, customer, globalDays, now = Date.now()) {
  const threshold  = effectiveDays(customer, globalDays);
  const lastSaleAt = Number(summary?.lastSaleAt || 0);

  // Hech qachon xarid qilmagan (yoki sana noto'g'ri)
  if (!lastSaleAt || lastSaleAt < 1e10) {
    return { status: STATUS.never, daysSince: null, threshold, lastSaleAt: 0 };
  }

  const daysSince = Math.floor((now - lastSaleAt) / DAY);
  let status;
  if      (daysSince >= threshold)              status = STATUS.alert;   // muddat o'tdi
  else if (daysSince >= threshold * 0.75)       status = STATUS.warning; // yaqinlashmoqda
  else                                          status = STATUS.ok;      // faol
  return { status, daysSince, threshold, lastSaleAt };
}

// E'tibor talab qiladigan holatlar (dashboard/ogohlantirish uchun)
export function needsAttention(statusKey) {
  return statusKey === 'alert' || statusKey === 'never';
}
