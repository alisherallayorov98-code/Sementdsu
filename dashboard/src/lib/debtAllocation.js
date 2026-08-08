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

/**
 * @param {Array} debts   — mijozning qarz qatorlari
 * @param {number} amount — kelgan summa
 * @returns {{ plan: Object, applied: number, leftover: number }}
 *   plan     — { [qarz id]: shu qarzga ketgan summa }
 *   applied  — jami qarzga ketgan
 *   leftover — ortib qolgan (avansga yoziladi)
 */
export function planDebtPayment(debts, amount) {
  const total = num(amount);
  if (!(total > 0)) return { plan: {}, applied: 0, leftover: 0 };

  const plan = {};
  let left = total;
  let applied = 0;

  (debts || [])
    .filter(r => r && remainingOf(r) > 0)
    // Eng eski qarzdan boshlaymiz. createdAt bo'lmasa id (u ham vaqt belgisi).
    .sort((a, b) => (num(a.createdAt) || num(a.id)) - (num(b.createdAt) || num(b.id)))
    .forEach(r => {
      if (left <= 0) return;
      const pay = Math.min(remainingOf(r), left);
      if (pay <= 0) return;
      plan[r.id] = pay;
      left -= pay;
      applied += pay;
    });

  // Yaxlitlash qoldig'i (0.0001 kabi) avansga tushib ketmasin
  const leftover = left < 0.005 ? 0 : left;
  return { plan, applied, leftover };
}
