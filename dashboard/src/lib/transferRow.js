// ─────────────────────────────────────────────────────────────────────────────
// Kanallararo o'tkazma (naqd ↔ bank ↔ click) yozuvini aniqlash.
//
// O'tkazma KIRIM ham, CHIQIM ham emas — bu shunchaki o'z pulingni bir kanaldan
// ikkinchisiga ko'chirish. Har qanday kirim/chiqim yig'indisidan chiqarib
// tashlanishi shart, aks holda ikkala raqam ham sun'iy shishadi.
//
// Yangi yozuvlarda `transfer: true` bayrog'i va `transferId` juftlik kaliti bor.
// Eski yozuvlarda faqat izoh boshidagi "↔️" belgisi qolgan — shuning uchun
// ikkalasi ham tekshiriladi.
//
// Bu funksiya ilgari 6 joyda 4 xil ko'rinishda takrorlangan edi: uch sahifa
// faqat izohni tekshirar, ikkitasi bayroqni ham. Natijada izohi tahrirlangan
// o'tkazma bir sahifada kirim bo'lib qo'shilib, boshqasida qo'shilmasdi —
// bir xil kunning raqamlari ikki joyda har xil chiqardi.
// ─────────────────────────────────────────────────────────────────────────────
export const isTransferRow = (r) =>
  !!r && (r.transfer === true || String(r.desc || '').trim().startsWith('↔️'));

export default isTransferRow;
