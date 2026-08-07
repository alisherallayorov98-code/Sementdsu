// ─────────────────────────────────────────────────────────────────────────────
// Ism kaliti — frontend dagi lib/customerRef.js: nameKey bilan AYNAN bir xil.
//
// Frontend mijozni normallashtirilgan ism bo'yicha bog'laydi (registr, ortiqcha
// probel va apostrof turlari farqi yo'qoladi). Backend esa qat'iy taqqoslardi:
// "Ali aka" va "ali aka " frontendda bitta mijoz, backendda esa topilmasdi —
// natijada Telegram xabari jimgina yuborilmay qolardi.
//
// Ikkala tomon bir xil qoidada ishlashi uchun shu funksiya ajratildi.
// O'zgartirilsa — ikkalasi birga o'zgarishi kerak.
// ─────────────────────────────────────────────────────────────────────────────
const nameKey = (s) => String(s ?? '')
  .trim()
  .toLowerCase()
  .replace(/[ʻʼ'`’‘]/g, "'")
  .replace(/\s+/g, ' ');

const sameName = (a, b) => {
  const ka = nameKey(a);
  return ka !== '' && ka === nameKey(b);
};

// Ro'yxatdan ism bo'yicha topish (mijoz, haydovchi, xodim)
const findByName = (list, name) => {
  const k = nameKey(name);
  return k ? (list || []).find(x => nameKey(x && x.name) === k) || null : null;
};

module.exports = { nameKey, sameName, findByName };
