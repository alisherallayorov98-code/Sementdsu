// Qarzlarni guruhlash testlari — cd dashboard && npm test
//
// Qarzlar sahifasi mijozning bir necha qarz qatorini bitta qatorga yig'adi.
// Xato bo'lsa qoldiq noto'g'ri ko'rinadi va eslatma noto'g'ri odamga ketadi.
import test from 'node:test';
import assert from 'node:assert';
import { groupDebts, statusOf, groupKeyOf, remainingOf } from './debtGrouping.js';

const byKey = (groups) => Object.fromEntries(groups.map(g => [g.key, g]));

test('bir mijozning qatorlari bitta guruhga yig\'iladi', () => {
  const g = groupDebts([
    { id: 1, customer: 'Ali aka', amount: 100, paid: 0 },
    { id: 2, customer: 'Ali aka', amount: 200, paid: 50 },
  ]);
  assert.strictEqual(g.length, 1);
  assert.strictEqual(g[0].totalAmount, 300);
  assert.strictEqual(g[0].totalPaid, 50);
  assert.strictEqual(g[0].remaining, 250);
});

test('ism boshqacha yozilgan bo\'lsa ham bitta guruh (registr/probel)', () => {
  const g = groupDebts([
    { id: 1, customer: 'Ali aka',   amount: 100, paid: 0 },
    { id: 2, customer: '  ALI  aka ', amount: 200, paid: 0 },
  ]);
  assert.strictEqual(g.length, 1, 'ikki qator bo\'lib chiqmasligi kerak');
  assert.strictEqual(g[0].totalAmount, 300);
});

test('customerId bo\'lsa u ustuvor — nomi bir xil boshqa mijoz aralashmaydi', () => {
  const g = groupDebts([
    { id: 1, customerId: 11, customer: 'Ali', amount: 100, paid: 0 },
    { id: 2, customerId: 22, customer: 'Ali', amount: 200, paid: 0 },
  ]);
  assert.strictEqual(g.length, 2, 'id bo\'yicha ajralishi kerak');
});

test('ORTIQCHA to\'lov boshqa qarzning qoldig\'ini niqoblamaydi', () => {
  // 1-qarz 100, unga 150 to'langan (xato ma'lumot). 2-qarz 100, to'lanmagan.
  // Oddiy ayirma: 200 − 150 = 50 (NOTO'G'RI). To'g'risi: 0 + 100 = 100.
  const g = groupDebts([
    { id: 1, customer: 'Ali', amount: 100, paid: 150 },
    { id: 2, customer: 'Ali', amount: 100, paid: 0 },
  ]);
  assert.strictEqual(g[0].remaining, 100);
});

test('to\'lov holati: to\'liq / qisman / to\'lanmagan', () => {
  const full    = groupDebts([{ id: 1, customer: 'A', amount: 100, paid: 100 }])[0];
  const partial = groupDebts([{ id: 1, customer: 'B', amount: 100, paid: 40 }])[0];
  const none    = groupDebts([{ id: 1, customer: 'C', amount: 100, paid: 0 }])[0];
  assert.strictEqual(statusOf(full), 'full');
  assert.strictEqual(statusOf(partial), 'partial');
  assert.strictEqual(statusOf(none), 'none');
});

test('oxirgi to\'lov SANA bo\'yicha aniqlanadi (id emas)', () => {
  // id tartibi teskari: eski to'lovda katta id (eski yozuvlarda shunday bo'lgan)
  const g = groupDebts([{
    id: 1, customer: 'Ali', amount: 1000, paid: 300,
    payments: [
      { id: 999, date: '01.06.2026', amount: 100 },
      { id: 5,   date: '20.07.2026', amount: 200 },
    ],
  }]);
  assert.strictEqual(g[0].lastPaymentStr, '20.07.2026');
});

test('sanasi buzuq to\'lovda id bo\'yicha tartiblanadi', () => {
  const g = groupDebts([{
    id: 1, customer: 'Ali', amount: 1000, paid: 300,
    payments: [
      { id: 5,  date: '46209', amount: 100 },
      { id: 90, date: 'yaroqsiz', amount: 200 },
    ],
  }]);
  assert.strictEqual(g[0].lastPaymentAt, 90);
});

test('to\'lovsiz guruhda oxirgi to\'lov "—"', () => {
  const g = groupDebts([{ id: 1, customer: 'Ali', amount: 100, paid: 0 }]);
  assert.strictEqual(g[0].lastPaymentStr, '—');
  assert.strictEqual(g[0].lastPaymentAt, null);
});

test('qarz yoshi eng eski TO\'LANMAGAN qator bo\'yicha', () => {
  const g = groupDebts([
    { id: 1000, createdAt: 1000, customer: 'Ali', amount: 100, paid: 100 }, // yopilgan
    { id: 5000, createdAt: 5000, customer: 'Ali', amount: 200, paid: 0 },   // ochiq
  ]);
  assert.strictEqual(g[0].oldestUnpaidAt, 5000, 'yopilgan qarz yoshga ta\'sir qilmaydi');
});

test('hamma qarz yopilgan bo\'lsa yosh yo\'q', () => {
  const g = groupDebts([{ id: 1, createdAt: 1, customer: 'Ali', amount: 100, paid: 100 }]);
  assert.strictEqual(g[0].oldestUnpaidAt, null);
  assert.strictEqual(g[0].remaining, 0);
});

test('guruh kaliti va bo\'sh ism', () => {
  assert.strictEqual(groupKeyOf({ customerId: 7, customer: 'Ali' }), '#7');
  assert.strictEqual(groupKeyOf({ customer: '  ALI  aka ' }), 'ali aka');
  // Ismsiz qator guruhga tushmaydi (kalit bo'sh)
  assert.strictEqual(groupDebts([{ id: 1, customer: '', amount: 100 }]).length, 0);
});

test('remainingOf manfiy bermaydi', () => {
  assert.strictEqual(remainingOf({ amount: 100, paid: 150 }), 0);
  assert.strictEqual(remainingOf({ amount: 100, paid: 40 }), 60);
  assert.strictEqual(remainingOf({ amount: 'yaroqsiz', paid: null }), 0);
});

test('guruh qoldiqlari yig\'indisi umumiy qarzga teng', () => {
  const rows = [
    { id: 1, customer: 'A', amount: 100, paid: 30 },
    { id: 2, customer: 'B', amount: 200, paid: 0 },
    { id: 3, customer: 'A', amount: 50,  paid: 50 },
  ];
  const expected = rows.reduce((s, r) => s + remainingOf(r), 0);
  const actual = groupDebts(rows).reduce((s, g) => s + g.remaining, 0);
  assert.strictEqual(actual, expected, 'sahifadagi summa umumiy hisobotga mos kelishi kerak');
  const m = byKey(groupDebts(rows));
  assert.strictEqual(m['a'].remaining, 70);
});
