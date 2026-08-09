// Sanani ommaviy to'g'rilash mantiqi — DataContext.fixRowDates bilan bir xil.
// (Kontekst React'ga bog'liq, shuning uchun bu yerda o'sha sof qoida
// tekshiriladi: faqat mos sanali qator o'zgaradi, ichki ro'yxatlar tegilmaydi.)
import test from 'node:test';
import assert from 'node:assert/strict';

const swap = (rows, from, to) => rows.map(r => r.date === from ? { ...r, date: to } : r);

test('faqat mos sanali qator o\u2018zgaradi', () => {
  const rows = [
    { id: 1, date: '06.07.2026', amount: 100 },
    { id: 2, date: '07.07.2026', amount: 200 },
    { id: 3, date: '06.07.2026', amount: 300 },
  ];
  const out = swap(rows, '06.07.2026', '06.08.2026');
  assert.deepEqual(out.map(r => r.date), ['06.08.2026', '07.07.2026', '06.08.2026']);
});

test('to\u2018lovlar o\u2018z sanasida qoladi', () => {
  // Qarz sanasi o'zgaradi, lekin to'lov haqiqatan boshqa kunda bo'lgan
  const rows = [{
    id: 1, date: '06.07.2026', amount: 1000, paid: 400,
    payments: [{ id: 9, date: '20.07.2026', amount: 400 }],
  }];
  const out = swap(rows, '06.07.2026', '06.08.2026');
  assert.equal(out[0].date, '06.08.2026');
  assert.equal(out[0].payments[0].date, '20.07.2026');
  assert.equal(out[0].paid, 400);
});

test('summalar va id lar tegilmaydi', () => {
  const rows = [{ id: 7, customerId: 3, date: '06.07.2026', amount: 5000, note: 'Import' }];
  const out = swap(rows, '06.07.2026', '06.08.2026');
  assert.equal(out[0].id, 7);
  assert.equal(out[0].customerId, 3);
  assert.equal(out[0].amount, 5000);
  assert.equal(out[0].note, 'Import');
});

test('mos sana yo\u2018q bo\u2018lsa ro\u2018yxat o\u2018zgarmaydi', () => {
  const rows = [{ id: 1, date: '01.01.2026' }];
  assert.deepEqual(swap(rows, '06.07.2026', '06.08.2026'), rows);
});
