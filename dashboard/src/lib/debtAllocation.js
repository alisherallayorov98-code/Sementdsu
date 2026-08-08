// ─────────────────────────────────────────────────────────────────────────────
// Qarz to'lovini taqsimlash — pul oqimining eng nozik joyi.
//
// Kassir mijozdan pul olganda summa uning qarzlariga ESKISIDAN boshlab
// taqsimlanadi; qarzdan ortib qolgani avans sifatida yoziladi.
//
// Mantiq shu yerda sof funksiya sifatida turadi: uni testlash mumkin va
// hisob-kitobning to'g'riligi kod o'zgarganda ham kafolatlanadi.
// (Ilgari u payCustomerDebt ichida, React state bilan aralashib yotardi.)
// ─────────────────────────────────────────────────────────────────────────────

const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };

// Qarz qatorining qolgan (to'lanmagan) qismi
export const remainingOf = (r) => Math.max(0, num(r.amount) - num(r.paid));

// Avans qatorining qolgan (ishlatilmagan) qismi
export const advanceRemainingOf = (r) => Math.max(0, num(r.amount) - num(r.used));

/**
 * Umumiy taqsimlash: summani ENG ESKI qatordan boshlab bo'lib beradi.
 * Qarz to'lovi ham, avans sarfi ham shu qoidada ishlaydi — farqi faqat
 * "qolgan qism" qanday hisoblanishida (paid yoki used).
 *
 * @param {Array} rows
 * @param {number} amount
 * @param {function} remainFn — qatorning qolgan qismini qaytaruvchi
 * @returns {{ plan: Object, applied: number, leftover: number }}
 */
export function planAllocation(rows, amount, remainFn) {
  const total = num(amount);
  if (!(total > 0)) return { plan: {}, applied: 0, leftover: 0 };

  const plan = {};
  let left = total;
  let applied = 0;

  (rows || [])
    .filter(r => r && remainFn(r) > 0)
    // Eng eski qatordan boshlaymiz. createdAt bo'lmasa id (u ham vaqt belgisi).
    .sort((a, b) => (num(a.createdAt) || num(a.id)) - (num(b.createdAt) || num(b.id)))
    .forEach(r => {
      if (left <= 0) return;
      const use = Math.min(remainFn(r), left);
      if (use <= 0) return;
      plan[r.id] = use;
      left -= use;
      applied += use;
    });

  // Yaxlitlash qoldig'i (0.0001 kabi) ortiqcha deb hisoblanmasin
  return { plan, applied, leftover: left < 0.005 ? 0 : left };
}

// Sotuvda avansdan yechish rejasi — eng eski avansdan boshlab.
export function planAdvanceSpend(advances, amount) {
  return planAllocation(advances, amount, advanceRemainingOf);
}

/**
 * @param {Array} debts   — mijozning qarz qatorlari
 * @param {number} amount — kelgan summa
 * @returns {{ plan: Object, applied: number, leftover: number }}
 *   plan     — { [qarz id]: shu qarzga ketgan summa }
 *   applied  — jami qarzga ketgan
 *   leftover — ortib qolgan (avansga yoziladi)
 */
export function planDebtPayment(debts, amount) {
  return planAllocation(debts, amount, remainingOf);
}
