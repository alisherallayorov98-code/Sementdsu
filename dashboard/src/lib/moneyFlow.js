// ─────────────────────────────────────────────────────────────────────────────
// PUL OQIMI — kirim va chiqimni bitta qoida bo'yicha hisoblovchi modul.
//
// NEGA KERAK: bu hisob Bosh sahifa, Umumiy hisobot va Excel hisobotida uch
// marta qo'lda takrorlanardi va uchalasi HAR XIL edi — biri `auto` yozuvlarni
// tashlab ketardi (oylik va zavodga to'lov chiqimga kirmasdi), biri eski
// "Sotilgan tonna" tushumini hisobga olmasdi, uchinchisi o'tkazmani faqat
// izohga qarab aniqlardi. Natijada bir xil davr uchun uch xil raqam chiqardi
// va hech biri qoldiqqa mos kelmasdi.
//
// QOIDA (hamma joyda bir xil):
//   · o'tkazma (naqd↔bank↔click) kirim ham, chiqim ham emas — chiqariladi;
//   · `auto` yozuvlar KIRADI — ular haqiqiy pul harakati (sotuv, qarz to'lovi,
//     avans, oylik, zavodga to'lov, haydovchi to'lovi);
//   · eski "Sotilgan tonna" (soldRows) kassa yozuvi yaratmaydi, uning puli
//     qoldiq formulasiga to'g'ridan-to'g'ri qo'shiladi — shuning uchun kirimga
//     ham alohida qo'shiladi (nasiya kirmaydi: u qarz, pul emas);
//   · income*/expense* ro'yxatlari musbat saqlanadi (tur bo'yicha ajratilgan).
//
// ASOSIY INVARIANT (moneyFlow.test.js buni tekshiradi):
//   ochilish qoldiqlari + jami kirim − jami chiqim = naqd + bank + click qoldiqlari
// ─────────────────────────────────────────────────────────────────────────────
import { isTransferRow } from './transferRow.js';

const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };

export const inSum  = (rows) => (rows || []).reduce((s, r) => isTransferRow(r) ? s : s + Math.max(0,  num(r.amount)), 0);
export const outSum = (rows) => (rows || []).reduce((s, r) => isTransferRow(r) ? s : s + Math.max(0, -num(r.amount)), 0);

// Eski "Sotilgan tonna" bo'limining kanal bo'yicha tushumi
export const soldIn = (soldRows, ch) => (soldRows || [])
  .filter(r => (r.paymentChannel || 'naqd') === ch)
  .reduce((s, r) => s + num(r.tons) * num(r.pricePerTon), 0);

/**
 * Kirim/chiqim tarkibi va jamisi.
 * @param {object} d — DataContext qiymatlari (yoki shu maydonlarga ega obyekt)
 * @returns {{ incParts, expParts, totalIncome, totalExpense }}
 *   incParts/expParts — [label, value] juftliklari; ekranda ro'yxat aynan
 *   shulardan chiziladi, shuning uchun qismlarni qo'shsa jamiga TENG chiqadi.
 */
export function moneyFlow(d = {}) {
  const {
    incomeRows, expenseRows,
    bankIncomeRows, bankExpenseRows,
    clickIncomeRows, clickExpenseRows,
    cashRows, bankRows, clickRows,
    soldRows,
  } = d;

  const soldAll = soldIn(soldRows, 'naqd') + soldIn(soldRows, 'bank') + soldIn(soldRows, 'click');

  const incParts = [
    ['Naqd kirim',     inSum(incomeRows)],
    ['Bank kirim',     inSum(bankIncomeRows)],
    ['Click kirim',    inSum(clickIncomeRows)],
    ['Kassir — naqd',  inSum(cashRows)],
    ['Kassir — bank',  inSum(bankRows)],
    ['Kassir — click', inSum(clickRows)],
    ...(soldAll > 0 ? [['Sotilgan tonna (eski)', soldAll]] : []),
  ];
  const expParts = [
    ['Naqd chiqim',    inSum(expenseRows)],
    ['Bank chiqim',    inSum(bankExpenseRows)],
    ['Click chiqim',   inSum(clickExpenseRows)],
    ['Kassir — naqd',  outSum(cashRows)],
    ['Kassir — bank',  outSum(bankRows)],
    ['Kassir — click', outSum(clickRows)],
  ];

  return {
    incParts, expParts,
    totalIncome:  incParts.reduce((s, [, v]) => s + v, 0),
    totalExpense: expParts.reduce((s, [, v]) => s + v, 0),
  };
}

/** Bir kunlik kirim/chiqim — xuddi shu qoida bilan (sana "kk.oo.yyyy"). */
export function moneyFlowOnDay(d = {}, day) {
  const on = (rows) => (rows || []).filter(r => r.date === day);
  return moneyFlow({
    incomeRows:       on(d.incomeRows),
    expenseRows:      on(d.expenseRows),
    bankIncomeRows:   on(d.bankIncomeRows),
    bankExpenseRows:  on(d.bankExpenseRows),
    clickIncomeRows:  on(d.clickIncomeRows),
    clickExpenseRows: on(d.clickExpenseRows),
    cashRows:         on(d.cashRows),
    bankRows:         on(d.bankRows),
    clickRows:        on(d.clickRows),
    soldRows:         on(d.soldRows),
  });
}
