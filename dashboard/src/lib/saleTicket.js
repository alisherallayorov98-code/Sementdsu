// ─────────────────────────────────────────────────────────────────────────────
// "Bu yuk qaysi TIKETdan chiqqan" — bitta sotuv/qarz qatorining tiket raqami.
//
// Bitta mijozga bir kunda 5 xil tiketdan yuk borishi mumkin. Akt sverkada
// faqat sana va tonna ko'rinsa, ertaga "bu qaysi shartnomadagi yuk edi?"
// degan savolga javob topib bo'lmaydi — shuning uchun tiket har bir qatorda
// ko'rsatiladi.
//
// Tiket qayerda yotishi mumkin:
//   · qatorning o'zida        → row.contractNo
//   · zavod faylining kartasi → row.cardName ("A26010163 (7)")
//   · qarz/kassa qatorida     → u kelib chiqqan sotuvda (sourceId orqali)
//
// React yo'q: sof mantiq, testlanadi. saleTime.js dagi factoryTimeOf bilan
// bir xil qoidada ishlaydi.
// ─────────────────────────────────────────────────────────────────────────────

// Kengaytma (.js) ataylab yozilgan: bu fayl node:test orqali ham ishga
// tushiriladi va Node ESM kengaytmasiz import'ni topa olmaydi.
import { ticketFromCard } from './birjaRecon.js';

// Bitta qatorning o'zidan tiketni olish (bog'langan sotuvga qaramasdan)
const ownTicket = (row) =>
  String(row?.contractNo || '').trim() || ticketFromCard(row?.cardName);

export function ticketOf(row, sales = []) {
  if (!row) return '';
  const own = ownTicket(row);
  if (own) return own;
  // Qarz/kassa qatorida tiket yo'q — sotuvdan olinadi. Bu tuzatishdan oldin
  // yaratilgan qarzlarda contractNo umuman yozilmagan bo'lishi mumkin.
  if (row.sourceType === 'sale') {
    const src = sales.find(x => x.id === row.sourceId);
    if (src) return ownTicket(src);
  }
  return '';
}
