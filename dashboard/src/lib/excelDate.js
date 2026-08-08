// ─────────────────────────────────────────────────────────────────────────────
// Excel katagidagi sanani "kk.oo.yyyy" ga aylantirish.
//
// Excel sanani SERIYA RAQAMI sifatida saqlaydi: 46209 = 06.07.2026
// (0 = 1899-12-30, ya'ni 1900 yil kabisa xatosi hisobga olingan).
//
// NEGA XOM RAQAMDAN HISOBLAYMIZ:
// xlsx kutubxonasining `cellDates: true` rejimi Date obyektini vaqt zonasi
// bilan buzib qaytaradi — 46209 uchun 2026-07-05T18:59:49Z beradi, ya'ni
// to'g'ri sanadan ~5 soat kam. Natijada 06.07.2026 o'rniga 05.07.2026
// import bo'lardi (butun faylda har bir sana bir kunga surilgan).
// Shuning uchun fayl `cellDates: false` bilan o'qiladi va konvertatsiya
// shu yerda, UTC bo'yicha bajariladi — natija vaqt zonasiga bog'liq emas.
// ─────────────────────────────────────────────────────────────────────────────

const pad2 = (n) => String(n).padStart(2, '0');

// 1970-01-01 ning Excel seriyasi — shundan boshlab JS millisekundiga o'tamiz
const EPOCH_OFFSET = 25569;
const DAY_MS = 86400 * 1000;

export function excelDateToStr(v) {
  if (v === '' || v === null || v === undefined) return '';

  // Seriya raqami — asosiy holat
  if (typeof v === 'number' && isFinite(v)) {
    // 1 dan kichik qiymat — bu sana emas, kun ichidagi vaqt ulushi
    if (v < 1) return String(v);
    const d = new Date(Math.round((v - EPOCH_OFFSET) * DAY_MS));
    if (isNaN(d.getTime())) return String(v);
    // UTC metodlari: yuqoridagi hisob UTC yarim tunini beradi, mahalliy
    // metodlar bilan o'qilsa manfiy offsetli zonalarda kun orqaga surilardi.
    return `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
  }

  // Date obyekti (boshqa manbadan kelsa) — mahalliy sana sifatida o'qiladi
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${pad2(v.getDate())}.${pad2(v.getMonth() + 1)}.${v.getFullYear()}`;
  }

  // Matn: "06.07.2026", "06.07.2026 14:30", "2026-07-06" va h.k.
  const s = String(v).trim();
  if (!s) return '';

  // ISO ko'rinish → kk.oo.yyyy
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;

  // Nuqta/slash/tire bilan: kun.oy.yil (vaqt qismi tashlanadi)
  const dmy = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/);
  if (dmy) {
    let [, d, m, y] = dmy;
    // 2 xonali yil: "26" → 2026 (aks holda 1926 bo'lib ketardi)
    if (y.length === 2) y = String(2000 + Number(y));
    return `${pad2(Number(d))}.${pad2(Number(m))}.${y}`;
  }

  return s;   // tanib bo'lmadi — o'zgarishsiz qoldiramiz
}
