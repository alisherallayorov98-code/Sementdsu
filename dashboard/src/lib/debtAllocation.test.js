// Qarz to'lovini taqsimlash testlari — cd dashboard && npm test
//
// Bu Kassir "Kirim" oqimining yuragi: kassir mijozdan pul olganda summa
// qaysi qarzlarga qanday taqsimlanishini shu funksiya hal qiladi. Xatosi
// to'g'ridan-to'g'ri pulga tegadi, shuning uchun chetki holatlar qoplangan.
import test from 'node:test';
import assert from 'node:assert';
import { planDebtPayment, remainingOf } from './debtAllocation.js';

// Qulaylik uchun: id = createdAt (eski qarz kichik raqam bilan)
const d = (id, amount, paid = 0) => ({ id, createdAt: id, amount, paid });

test('bitta qarzga to\'liq to\'lov', () => {
  const r = planDebtPayment([d(1, 500000)], 500000);
  assert.strictEqual(r.applied, 500000);
  assert.strictEqual(r.leftover, 0);
  assert.deepStrictEqual(r.plan, { 1: 500000 });
});

test('qisman to\'lov', () => {
  const r = planDebtPayment([d(1, 500000)], 200000);
  assert.strictEqual(r.applied, 200000);
  assert.strictEqual(r.leftover, 0);
  assert.deepStrictEqual(r.plan, { 1: 200000 });
});

test('ENG ESKI qarzdan boshlab taqsimlanadi', () => {
  // Ro'yxat ataylab teskari tartibda berilgan
  const r = planDebtPayment([d(3, 300000), d(1, 100000), d(2, 200000)], 250000);
  assert.deepStrictEqual(r.plan, { 1: 100000, 2: 150000 }, 'avval 1-qarz, keyin 2-qarz');
  assert.strictEqual(r.applied, 250000);
});

test('qarzdan ortiq summa — ortig\'i leftover (avansga ketadi)', () => {
  const r = planDebtPayment([d(1, 100000), d(2, 200000)], 500000);
  assert.strictEqual(r.applied, 300000, 'faqat qarz qadar');
  assert.strictEqual(r.leftover, 200000, 'ortig\'i avansga');
});

test('qarz yo\'q — hammasi leftover', () => {
  const r = planDebtPayment([], 400000);
  assert.strictEqual(r.applied, 0);
  assert.strictEqual(r.leftover, 400000);
});

test('to\'liq to\'langan qarz o\'tkazib yuboriladi', () => {
  const r = planDebtPayment([d(1, 100000, 100000), d(2, 200000)], 150000);
  assert.deepStrictEqual(r.plan, { 2: 150000 }, '1-qarz allaqachon yopilgan');
});

test('qisman to\'langan qarzda faqat QOLGANI to\'lanadi', () => {
  const r = planDebtPayment([d(1, 500000, 400000)], 300000);
  assert.deepStrictEqual(r.plan, { 1: 100000 }, 'qolgani 100 000 edi');
  assert.strictEqual(r.leftover, 200000);
});

test('manfiy va nol summa hech narsa qilmaydi', () => {
  for (const amt of [0, -5000, NaN, null, undefined, '']) {
    const r = planDebtPayment([d(1, 100000)], amt);
    assert.strictEqual(r.applied, 0, `summa=${amt}`);
    assert.deepStrictEqual(r.plan, {});
  }
});

test('yaxlitlash qoldig\'i avansga tushmaydi', () => {
  // 0.001 so'mlik qoldiq "ortiqcha to'lov" bo'lib avans yaratmasligi kerak
  const r = planDebtPayment([d(1, 100000)], 100000.001);
  assert.strictEqual(r.leftover, 0);
});

test('pul yo\'qolmaydi: applied + leftover = kelgan summa', () => {
  const cases = [
    [[d(1, 100000), d(2, 250000)], 500000],
    [[d(1, 100000), d(2, 250000)], 300000],
    [[d(1, 100000, 50000)], 40000],
    [[], 75000],
  ];
  for (const [debts, amt] of cases) {
    const r = planDebtPayment(debts, amt);
    assert.strictEqual(r.applied + r.leftover, amt, `summa=${amt}`);
  }
});

test('rejadagi summalar qarz qoldiqlaridan oshmaydi', () => {
  const debts = [d(1, 100000), d(2, 250000, 200000)];
  const r = planDebtPayment(debts, 1000000);
  for (const row of debts) {
    const pay = r.plan[row.id] || 0;
    assert.ok(pay <= remainingOf(row) + 1e-9, `qarz ${row.id}: ${pay} > ${remainingOf(row)}`);
  }
});
