// Pul oqimi testlari — cd dashboard && npm test
//
// Eng muhimi ASOSIY INVARIANT: ochilish + kirim − chiqim = qoldiqlar.
// Bu tenglama buzilsa, dasturdagi hech bir hisobot bir-biriga mos kelmaydi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { moneyFlow, moneyFlowOnDay, inSum, outSum, soldIn } from './moneyFlow.js';

// DataContext dagi qoldiq formulalarining aynan nusxasi (solishtirish uchun)
const balances = (d) => {
  const sumAll = (rows) => (rows || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const sold = (ch) => soldIn(d.soldRows, ch);
  const cash = Number(d.cashOpening?.amount || 0) + sumAll(d.cashRows)
    + sumAll(d.incomeRows) - sumAll(d.expenseRows) + sold('naqd');
  const bank = Number(d.bankOpening?.amount || 0) + sumAll(d.bankRows)
    + sumAll(d.bankIncomeRows) - sumAll(d.bankExpenseRows) + sold('bank');
  const click = Number(d.clickOpening?.amount || 0) + sumAll(d.clickRows)
    + sumAll(d.clickIncomeRows) - sumAll(d.clickExpenseRows) + sold('click');
  return { cash, bank, click, total: cash + bank + click };
};

const openingSum = (d) =>
  Number(d.cashOpening?.amount || 0) + Number(d.bankOpening?.amount || 0) + Number(d.clickOpening?.amount || 0);

function assertInvariant(d, label = '') {
  const f = moneyFlow(d);
  const b = balances(d);
  const left = openingSum(d) + f.totalIncome - f.totalExpense;
  assert.ok(
    Math.abs(left - b.total) < 0.001,
    `${label}: ochilish+kirim-chiqim = ${left}, qoldiqlar = ${b.total}`
  );
}

test('bo‘sh holatda ham invariant bajariladi', () => {
  assertInvariant({});
});

test('faqat ochilish qoldiqlari', () => {
  assertInvariant({
    cashOpening: { amount: 1000 }, bankOpening: { amount: 2000 }, clickOpening: { amount: 500 },
  }, 'ochilish');
});

test('Kassir kirim va chiqimi — invariant', () => {
  const d = {
    cashOpening: { amount: 100000 },
    cashRows: [
      { id: 1, amount:  500000, desc: 'Sotuv', auto: true, sourceType: 'sale' },
      { id: 2, amount: -200000, desc: 'Oylik', auto: true, sourceType: 'salary' },
      { id: 3, amount:   50000, desc: "Qo'lda kirim" },
      { id: 4, amount:  -30000, desc: 'Taksi' },
    ],
  };
  assertInvariant(d, 'kassir');
  const f = moneyFlow(d);
  // auto yozuvlar HAM kiradi: oylik chiqimga tushishi shart
  assert.equal(f.totalIncome, 550000);
  assert.equal(f.totalExpense, 230000);
});

test('o‘tkazma kirim ham, chiqim ham emas', () => {
  const d = {
    cashRows:  [{ id: 1, amount:  300000, desc: '↔️ Bank→Naqd', transfer: true, transferId: 't1' }],
    bankRows:  [{ id: 2, amount: -300000, desc: '↔️ Bank→Naqd', transfer: true, transferId: 't1' }],
  };
  const f = moneyFlow(d);
  assert.equal(f.totalIncome, 0);
  assert.equal(f.totalExpense, 0);
  assertInvariant(d, "o'tkazma");
});

test('izohi TAHRIRLANGAN o‘tkazma ham chiqarib tashlanadi', () => {
  // Aynan shu holat ilgari raqamni shishirardi: bayroq bor, izoh o'zgargan.
  const d = {
    cashRows: [{ id: 1, amount: 300000, desc: 'Bankdan olindi', transfer: true, transferId: 't1' }],
    bankRows: [{ id: 2, amount: -300000, desc: 'Naqdga berildi', transfer: true, transferId: 't1' }],
  };
  const f = moneyFlow(d);
  assert.equal(f.totalIncome, 0);
  assert.equal(f.totalExpense, 0);
});

test('eski "Sotilgan tonna" tushumi kirimga qo‘shiladi (nasiya — yo‘q)', () => {
  const d = {
    soldRows: [
      { id: 1, tons: 10, pricePerTon: 100000, paymentChannel: 'naqd'   },
      { id: 2, tons:  5, pricePerTon: 100000, paymentChannel: 'bank'   },
      { id: 3, tons: 20, pricePerTon: 100000, paymentChannel: 'nasiya' }, // qarz, pul emas
    ],
  };
  const f = moneyFlow(d);
  assert.equal(f.totalIncome, 1500000);
  assertInvariant(d, 'eski sotuv');
});

test('qismlar yig‘indisi jamiga TENG (ekranda ro‘yxat shundan chiziladi)', () => {
  const d = {
    incomeRows:  [{ id: 1, amount: 1000 }],
    expenseRows: [{ id: 2, amount: 300 }],
    cashRows:    [{ id: 3, amount: 5000 }, { id: 4, amount: -700 }],
    bankRows:    [{ id: 5, amount: 2000 }],
    clickRows:   [{ id: 6, amount: -400 }],
    soldRows:    [{ id: 7, tons: 1, pricePerTon: 900, paymentChannel: 'naqd' }],
  };
  const f = moneyFlow(d);
  assert.equal(f.incParts.reduce((s, [, v]) => s + v, 0), f.totalIncome);
  assert.equal(f.expParts.reduce((s, [, v]) => s + v, 0), f.totalExpense);
  // Kassir bank/click kirimlari ro'yxatda BOR (ilgari jamiga kirar, lekin
  // ro'yxatda ko'rinmasdi — qo'shib ko'rilganda mos kelmasdi)
  assert.ok(f.incParts.some(([l]) => l === 'Kassir — bank'));
  assert.ok(f.expParts.some(([l]) => l === 'Kassir — click'));
  assertInvariant(d, 'qismlar');
});

test('aralash real holat — invariant', () => {
  const d = {
    cashOpening: { amount: 1_500_000 }, bankOpening: { amount: 8_000_000 }, clickOpening: { amount: 250_000 },
    cashRows: [
      { id: 1,  amount:  4_500_000, auto: true, sourceType: 'sale' },
      { id: 2,  amount:  1_200_000, auto: true, sourceType: 'debt_payment' },
      { id: 3,  amount:    800_000, auto: true, sourceType: 'advance' },
      { id: 4,  amount: -3_000_000, auto: true, sourceType: 'salary' },
      { id: 5,  amount: -2_000_000, auto: true, sourceType: 'supplier_payment' },
      { id: 6,  amount:   -450_000, auto: true, sourceType: 'driver' },
      { id: 7,  amount:   -120_000, desc: 'Moyka' },
      { id: 8,  amount:  1_000_000, desc: '↔️ Bank→Naqd', transfer: true, transferId: 'tr1' },
    ],
    bankRows: [
      { id: 9,  amount: -1_000_000, desc: '↔️ Bank→Naqd', transfer: true, transferId: 'tr1' },
      { id: 10, amount:  6_000_000, auto: true, sourceType: 'sale' },
    ],
    clickRows: [{ id: 11, amount: 300_000, auto: true, sourceType: 'sklad_sale' }],
    incomeRows:  [{ id: 12, amount: 70_000 }],
    expenseRows: [{ id: 13, amount: 25_000 }],
    bankIncomeRows:  [{ id: 14, amount: 900_000 }],
    bankExpenseRows: [{ id: 15, amount: 400_000 }],
    soldRows: [
      { id: 16, tons: 12, pricePerTon: 850_000, paymentChannel: 'naqd' },
      { id: 17, tons:  8, pricePerTon: 850_000, paymentChannel: 'nasiya' },
    ],
  };
  assertInvariant(d, 'real holat');
});

test('bir kunlik hisob ham xuddi shu qoida bilan', () => {
  const d = {
    cashRows: [
      { id: 1, date: '07.08.2026', amount:  100000 },
      { id: 2, date: '07.08.2026', amount:  -40000 },
      { id: 3, date: '06.08.2026', amount:  999999 },  // boshqa kun
      { id: 4, date: '07.08.2026', amount:  500000, desc: '↔️ o\'tkazma', transfer: true },
    ],
    soldRows: [{ id: 5, date: '07.08.2026', tons: 1, pricePerTon: 7000, paymentChannel: 'naqd' }],
  };
  const f = moneyFlowOnDay(d, '07.08.2026');
  assert.equal(f.totalIncome, 107000);   // 100000 + 7000, o'tkazmasiz
  assert.equal(f.totalExpense, 40000);
});

test('inSum/outSum yaroqsiz qiymatga yiqilmaydi', () => {
  const rows = [{ amount: 'abc' }, { amount: null }, { amount: undefined }, {}, { amount: '5000' }];
  assert.equal(inSum(rows), 5000);
  assert.equal(outSum(rows), 0);
});
