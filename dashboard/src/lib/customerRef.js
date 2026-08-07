// ─────────────────────────────────────────────────────────────────────────────
// Mijoz bog'lanishi — yagona nuqta.
//
// Tarixan butun tizim mijozni ISM satri orqali bog'lagan (`r.customer === c.name`)
// va taqqoslash qat'iy edi. Natijada "Ali aka" / "ali aka" / "Ali aka " uchta
// boshqa-boshqa mijoz bo'lib ko'rinardi: qarzi, avansi va xaridi bo'linib ketardi.
// Bu ayniqsa Excel importi va Telegram bot yozuvlarida yuz berardi.
//
// Endi ikki qatlamli bog'lanish:
//   1) customerId — yozuvda bo'lsa, u ustuvor (ism o'zgarsa ham uzilmaydi)
//   2) ism — eski yozuvlar uchun, normallashtirilgan holda taqqoslanadi
//
// Yangi yozuvlar `customerId` bilan yoziladi; eski ma'lumot o'z holicha ishlaydi.
// ─────────────────────────────────────────────────────────────────────────────

// Ism kaliti: registr, ortiqcha probel va apostrof turlari farqi yo'qoladi.
// Mijoz, yetkazib beruvchi va haydovchi — hammasi ism bilan bog'lanadi,
// shuning uchun kalit umumiy.
export const nameKey = (s) => String(s ?? '')
  .trim()
  .toLowerCase()
  .replace(/[ʻʼ'`’‘]/g, "'")
  .replace(/\s+/g, ' ');

// Ikki ism bir shaxsni/tashkilotni bildiradimi?
export const sameName = (a, b) => {
  const ka = nameKey(a);
  return ka !== '' && ka === nameKey(b);
};

// Mijozga xos nomlar (mavjud kod shu nomlar bilan ishlaydi)
export const custKey  = nameKey;
export const sameCust = sameName;

// Ro'yxatni normallashtirilgan ism bo'yicha yagonalashtirish.
// `preferred` — kanonik yozuvlar (baza) birinchi kelsin: ko'rsatiladigan nom
// o'shandan olinadi, tranzaksiyalardagi turlicha yozilgan variantlar emas.
export const uniqueNames = (...lists) => {
  const byKey = new Map();
  lists.flat().forEach(n => {
    const k = nameKey(n);
    if (k && !byKey.has(k)) byKey.set(k, String(n).trim());
  });
  return [...byKey.values()];
};

// Yozuv shu mijozniki ekanligini aniqlaydi.
//   ref — mijoz obyekti ({ id, name }) yoki shunchaki ism satri.
// customerId ikkala tomonda ham bo'lsa — faqat shu bo'yicha hukm chiqariladi:
// aks holda nomi bir xil ikki mijoz bir-birining yozuvini o'ziniki deb olardi.
export const rowIsCust = (row, ref) => {
  if (!row) return false;
  const refId   = typeof ref === 'object' && ref ? ref.id : null;
  const refName = typeof ref === 'object' && ref ? ref.name : ref;
  if (refId != null && row.customerId != null) return row.customerId === refId;
  return sameCust(row.customer, refName);
};

// Mijozning yozuvlarini ajratib olish.
export const custRows = (rows, ref) => (rows || []).filter(r => rowIsCust(r, ref));

// Ism bo'yicha mijozni bazadan topish (normallashtirilgan holda).
export const findCust = (customers, name) => {
  const k = custKey(name);
  return k ? (customers || []).find(c => custKey(c.name) === k) || null : null;
};

// Yangi yozuvga qo'yiladigan mijoz maydonlari: bazadagi kanonik ism + id.
// Bazada yo'q ism bo'lsa — id'siz, faqat ism (eski xatti-harakat saqlanadi).
export const custFields = (customers, name) => {
  const c = findCust(customers, name);
  return c
    ? { customer: String(c.name).trim(), customerId: c.id }
    : { customer: String(name ?? '').trim() };
};
