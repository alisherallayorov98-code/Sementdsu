// ─────────────────────────────────────────────────────────────────────────────
// Excel importi uchun qatorlarni tozalash — Qarzlar va Avanslar uchun umumiy.
//
// 1C oborotkasida summa manfiy ishora bilan chiqadi (-1378756000), shuning
// uchun moduli olinadi. Ismsiz yoki nol summali qator o'tkazib yuboriladi:
// ular hisobotda "egasiz" bo'lib qolardi.
//
// Bu sof funksiya — mijoz bazasiga tegmaydi. Mijozni topish/yaratish
// DataContext ichida (prepareImportRows) bajariladi, chunki u state bilan
// ishlaydi.
// ─────────────────────────────────────────────────────────────────────────────
import { parseNum } from './parseNum.js';

/**
 * @param {Array} rows — ExcelImport dan kelgan xom qatorlar
 * @returns {{ clean: Array, skipped: number }}
 */
export function cleanImportRows(rows) {
  const clean = [];
  let skipped = 0;
  (rows || []).forEach(r => {
    const customer = String(r?.customer || '').trim();
    // Math.abs — 1C oborotkasidagi manfiy ishora
    const amount = Math.abs(parseNum(r?.amount));
    if (!customer || !(amount > 0)) { skipped++; return; }
    clean.push({ customer, amount, note: r.note, date: r.date });
  });
  return { clean, skipped };
}
