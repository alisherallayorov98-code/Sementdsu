// ─────────────────────────────────────────────────────────────────────────────
// Qarzlarni mijoz bo'yicha guruhlash — Qarzlar sahifasining asosi.
//
// Bir mijozning bir necha qarz qatori bo'ladi (har sotuv alohida qator).
// Sahifa ularni bitta qatorga yig'ib ko'rsatadi: jami qarz, to'langan, qoldiq,
// qarz yoshi va oxirgi to'lov sanasi.
//
// Nozik joylar (ikkalasi ham xatoga olib kelgan):
//   · Guruh kaliti — normallashtirilgan ism yoki customerId. Xom nom
//     ishlatilsa "Ali aka" va "ali aka " ikki qator bo'lib chiqadi.
//   · Qoldiq HAR QATOR bo'yicha Math.max(0,…) bilan hisoblanadi. Guruh
//     darajasidagi oddiy ayirma ortiqcha to'lovni niqoblab, sahifadagi
//     summa umumiy hisobotdan farq qilardi.
// ─────────────────────────────────────────────────────────────────────────────
import { custKey } from './customerRef.js';
import { parseRu } from './dateRange.js';

const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };

export const groupKeyOf = (r) =>
  (r && r.customerId != null) ? `#${r.customerId}` : custKey(r && r.customer);

// Qarz qatorining to'lanmagan qismi
export const remainingOf = (r) => Math.max(0, num(r.amount) - num(r.paid));

// To'lovni tartiblash o'lchovi: sana bo'yicha, sanasi buzuq bo'lsa id bo'yicha.
// (Eski yozuvlarda id vaqt belgisi emas edi — faqat id bilan saralash
// "Oxirgi to'lov" ustunida tasodifiy sanani ko'rsatardi.)
export const paymentRank = (p) => {
  const t = parseRu(p && p.date);
  return Number.isNaN(t) ? num(p && p.id) : t;
};

export function groupDebts(rows) {
  const map = new Map();

  (rows || []).forEach(r => {
    if (!r) return;
    const key = groupKeyOf(r);
    if (!key) return;
    let g = map.get(key);
    if (!g) {
      g = { key, customer: r.customer, rows: [], totalAmount: 0, totalPaid: 0, allPayments: [] };
      map.set(key, g);
    }
    g.rows.push(r);
    g.totalAmount += num(r.amount);
    g.totalPaid   += num(r.paid);
    (r.payments || []).forEach(p => g.allPayments.push({ ...p, _debtNote: r.note || '' }));
  });

  for (const g of map.values()) {
    g.remaining = g.rows.reduce((s, r) => s + remainingOf(r), 0);

    const last = g.allPayments.reduce((best, p) => {
      if (!best) return p;
      const d = paymentRank(p) - paymentRank(best);
      if (d > 0) return p;
      if (d === 0 && num(p.id) > num(best.id)) return p;
      return best;
    }, null);
    g.lastPaymentAt  = last ? paymentRank(last) : null;
    g.lastPaymentStr = (last && last.date) || '—';

    // Qarz yoshi — eng eski TO'LANMAGAN qator bo'yicha
    const unpaid = g.rows.filter(r => remainingOf(r) > 0);
    g.oldestUnpaidAt = unpaid.length
      ? unpaid.reduce((mn, r) => Math.min(mn, num(r.createdAt) || num(r.id) || Date.now()), Date.now())
      : null;
  }

  return [...map.values()];
}

// To'lov holati: to'liq to'langan / qisman / to'lanmagan
export const statusOf = (g) => g.remaining <= 0 ? 'full' : g.totalPaid > 0 ? 'partial' : 'none';
