// Mijoz hisoblagichi testlari — cd dashboard && npm test
//
// customerSummaryAll() bir o'tishda barcha mijozlarni hisoblaydi (tezlik uchun).
// U customerSummary() bilan AYNAN bir xil natija berishi shart — shuning uchun
// asosiy test ikkalasini solishtiradi. Aks holda Mijozlar sahifasidagi raqamlar
// mijoz kartochkasidagidan farq qilib qolardi.
import test from 'node:test';
import assert from 'node:assert';
import { customerSummary, customerSummaryAll } from './customerSummary.js';

const NUM_KEYS = [
  'totalTon', 'totalXarid', 'totalQarz', 'totalTolandi', 'qolganQarz',
  'totalAvans', 'qolganAvans', 'balans', 'lastSaleAt', 'salesCount',
  'unlinkedIn', 'unlinkedOut',
];

// Ikkala yo'l bir xil natija beradimi?
function assertSame(data, label = '') {
  const all = customerSummaryAll(data);
  for (const c of data.customers) {
    const one = customerSummary(c, data);
    const many = all.get(c.id);
    assert.ok(many, `${label} ${c.name}: natija yo'q`);
    for (const k of NUM_KEYS) {
      assert.strictEqual(many[k], one[k], `${label} ${c.name} → ${k}`);
    }
    assert.strictEqual(many.debts.length, one.debts.length, `${label} ${c.name} → debts`);
    assert.strictEqual(many.sales.length, one.sales.length, `${label} ${c.name} → sales`);
    assert.strictEqual(many.unlinked.length, one.unlinked.length, `${label} ${c.name} → unlinked`);
  }
}

test('id bo\'yicha bog\'langan yozuvlar', () => {
  assertSame({
    customers: [{ id: 1, name: 'Ali' }, { id: 2, name: 'Vali' }],
    debtRows: [
      { id: 10, customerId: 1, customer: 'Ali', amount: 500, paid: 200, payments: [] },
      { id: 11, customerId: 2, customer: 'Vali', amount: 300, paid: 0, payments: [] },
    ],
    salesRows: [{ id: 20, customerId: 1, tons: 10, pricePerTon: 100 }],
  });
});

test('ESKI yozuvlar (customerId yo\'q) nom bo\'yicha topiladi', () => {
  assertSame({
    customers: [{ id: 1, name: 'Ali aka' }],
    debtRows: [{ id: 10, customer: '  ALI  aka ', amount: 500, paid: 0, payments: [] }],
    salesRows: [{ id: 20, customer: 'ali aka', tons: 5, pricePerTon: 200 }],
  });
});

test('id\'li va id\'siz yozuvlar ARALASH bo\'lsa ikkalasi ham qo\'shiladi', () => {
  const data = {
    customers: [{ id: 1, name: 'Ali' }],
    debtRows: [
      { id: 10, customerId: 1, customer: 'Ali', amount: 500, paid: 0, payments: [] },
      { id: 11, customer: 'ali', amount: 300, paid: 0, payments: [] },   // eski yozuv
    ],
  };
  assertSame(data);
  assert.strictEqual(customerSummaryAll(data).get(1).totalQarz, 800);
});

test('sklad chiqimi xaridga qo\'shiladi, kirimi qo\'shilmaydi', () => {
  const data = {
    customers: [{ id: 1, name: 'Ali' }],
    skladRows: [
      { id: 30, type: 'chiqim', customerId: 1, kg: -2000, pricePerKg: 500 },  // 2 tn
      { id: 31, type: 'kirim',  sourceId: 99, kg: 5000 },                     // mijozsiz
    ],
  };
  assertSame(data);
  const s = customerSummaryAll(data).get(1);
  assert.strictEqual(s.totalTon, 2);
  assert.strictEqual(s.totalXarid, 2 * 500 * 1000);
});

test('avtomatik kassa yozuvlari "bog\'lanmagan pul" ga kirmaydi', () => {
  const data = {
    customers: [{ id: 1, name: 'Ali' }],
    cashRows: [
      { id: 40, customerId: 1, amount: 100000, auto: true, sourceType: 'sale' }, // hisobga olinmaydi
      { id: 41, customerId: 1, amount: 50000 },                                  // qo'lda — olinadi
      { id: 42, customerId: 1, amount: -20000 },                                 // chiqim
    ],
  };
  assertSame(data);
  const s = customerSummaryAll(data).get(1);
  assert.strictEqual(s.unlinkedIn, 50000);
  assert.strictEqual(s.unlinkedOut, 20000);
});

test('boshqa mijozning yozuvi aralashmaydi', () => {
  const data = {
    customers: [{ id: 1, name: 'Ali' }, { id: 2, name: 'Vali' }],
    debtRows: [
      { id: 10, customerId: 1, amount: 500, paid: 0, payments: [] },
      { id: 11, customerId: 2, amount: 700, paid: 0, payments: [] },
    ],
  };
  assertSame(data);
  const all = customerSummaryAll(data);
  assert.strictEqual(all.get(1).totalQarz, 500);
  assert.strictEqual(all.get(2).totalQarz, 700);
});

test('nomi bir xil, id har xil ikki mijoz aralashmaydi', () => {
  const data = {
    customers: [{ id: 1, name: 'Ali' }, { id: 2, name: 'Ali' }],
    debtRows: [{ id: 10, customerId: 2, customer: 'Ali', amount: 900, paid: 0, payments: [] }],
  };
  const all = customerSummaryAll(data);
  assert.strictEqual(all.get(1).totalQarz, 0, '1-mijozga tegishli emas');
  assert.strictEqual(all.get(2).totalQarz, 900);
});

test('yozuvsiz mijoz nol qiymatlar bilan qaytadi', () => {
  const data = { customers: [{ id: 1, name: 'Yangi' }] };
  assertSame(data);
  const s = customerSummaryAll(data).get(1);
  assert.strictEqual(s.totalQarz, 0);
  assert.strictEqual(s.balans, 0);
  assert.deepStrictEqual(s.sales, []);
});

test('balans = qoldiq avans − qolgan qarz', () => {
  const data = {
    customers: [{ id: 1, name: 'Ali' }],
    debtRows:    [{ id: 10, customerId: 1, amount: 500, paid: 100, payments: [] }],
    advanceRows: [{ id: 20, customerId: 1, amount: 300, used: 50, usages: [] }],
  };
  assertSame(data);
  const s = customerSummaryAll(data).get(1);
  assert.strictEqual(s.qolganQarz, 400);
  assert.strictEqual(s.qolganAvans, 250);
  assert.strictEqual(s.balans, -150);
});

test('katta hajmda ikkala yo\'l bir xil natija beradi', () => {
  // Realga yaqin: 60 mijoz, aralash id/nom, turli ro'yxatlar
  const N = 60;
  const customers = Array.from({ length: N }, (_, i) => ({ id: i + 1, name: `Mijoz ${i + 1}` }));
  const mk = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  const pickId = (i) => (i % 3 === 0 ? undefined : (i % N) + 1);      // uchdan biri id'siz
  const pickNm = (i) => `Mijoz ${(i % N) + 1}`;
  const data = {
    customers,
    debtRows:    mk(200, i => ({ id: i, customerId: pickId(i), customer: pickNm(i), amount: 1000 + i, paid: i % 7, payments: [] })),
    salesRows:   mk(150, i => ({ id: i, customerId: pickId(i), customer: pickNm(i), tons: 1 + (i % 5), pricePerTon: 1000 })),
    soldRows:    mk(80,  i => ({ id: i, customerId: pickId(i), customer: pickNm(i), tons: 2, pricePerTon: 900 })),
    advanceRows: mk(50,  i => ({ id: i, customerId: pickId(i), customer: pickNm(i), amount: 500, used: i % 3, usages: [] })),
    skladRows:   mk(70,  i => ({ id: i, type: i % 2 ? 'chiqim' : 'kirim', customerId: pickId(i), customer: pickNm(i), kg: -1000, pricePerKg: 400 })),
    cashRows:    mk(120, i => ({ id: i, customerId: pickId(i), customer: pickNm(i), amount: i % 2 ? 5000 : -3000, auto: i % 5 === 0 })),
    tgOrders:    mk(40,  i => ({ id: i, customerId: pickId(i), customer: pickNm(i), tons: 3 })),
  };
  assertSame(data, 'katta hajm');
});
