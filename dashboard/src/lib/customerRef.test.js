// Mijoz bog'lanishi testlari — cd dashboard && npm test
//
// Bu modul butun dasturning bog'lanish yuragi: qarz, avans, sotuv, kassa
// yozuvi — hammasi shu qoidalar bo'yicha mijozga biriktiriladi. Xatosi
// yozuvni noto'g'ri mijozga ulaydi yoki umuman yo'qotadi.
import test from 'node:test';
import assert from 'node:assert';
import {
  nameKey, sameName, custKey, sameCust,
  rowIsCust, custRows, findCust, custFields, uniqueNames,
} from './customerRef.js';

// ── Ism kaliti ───────────────────────────────────────────────────────────────

test('nameKey registr va ortiqcha probelni yo\'qotadi', () => {
  assert.strictEqual(nameKey('  ALI  aka '), 'ali aka');
  assert.strictEqual(nameKey('Ali\taka'), 'ali aka');
  assert.strictEqual(nameKey('ALI AKA'), 'ali aka');
});

test('nameKey turli apostroflarni bir xillashtiradi', () => {
  // O'zbek matnida bu belgilar aralash ishlatiladi — bir xil ism bo'lib
  // qolishi kerak, aks holda mijoz ikkiga bo'linadi.
  const forms = ["G'ani aka", 'G‘ani aka', 'G’ani aka', 'Gʻani aka', 'Gʼani aka', 'G`ani aka'];
  const keys = forms.map(nameKey);
  assert.strictEqual(new Set(keys).size, 1, `bir xil bo'lishi kerak: ${keys.join(' | ')}`);
});

test('nameKey bo\'sh qiymatlarga bo\'sh satr beradi', () => {
  for (const v of ['', '   ', null, undefined]) assert.strictEqual(nameKey(v), '');
});

test('sameName bo\'sh ismlarni TENG deb hisoblamaydi', () => {
  // Muhim: ikkala tomon bo'sh bo'lsa ham "bir xil mijoz" degani emas —
  // aks holda mijozsiz yozuvlar bir-biriga yopishib ketardi.
  assert.strictEqual(sameName('', ''), false);
  assert.strictEqual(sameName(null, undefined), false);
  assert.strictEqual(sameName('Ali', ''), false);
});

test('sameName normallashtirilgan taqqoslash qiladi', () => {
  assert.ok(sameName('Ali aka', '  ALI  aka '));
  assert.ok(!sameName('Ali aka', 'Vali aka'));
});

test('custKey/sameCust — nameKey/sameName bilan bir xil (eski nomlar)', () => {
  assert.strictEqual(custKey, nameKey);
  assert.strictEqual(sameCust, sameName);
});

// ── Yozuvni mijozga bog'lash ─────────────────────────────────────────────────

test('ikkala tomonda customerId bo\'lsa FAQAT id taqqoslanadi', () => {
  const cust = { id: 5, name: 'Ali' };
  // Nomi bir xil, lekin id boshqa — bu boshqa mijozning yozuvi
  assert.strictEqual(rowIsCust({ customerId: 9, customer: 'Ali' }, cust), false);
  assert.strictEqual(rowIsCust({ customerId: 5, customer: 'Boshqa nom' }, cust), true);
});

test('yozuvda customerId yo\'q bo\'lsa nom bo\'yicha bog\'lanadi (eski yozuvlar)', () => {
  const cust = { id: 5, name: 'Ali aka' };
  assert.ok(rowIsCust({ customer: '  ALI  aka ' }, cust));
  assert.ok(!rowIsCust({ customer: 'Vali' }, cust));
});

test('ref satr bo\'lsa nom bo\'yicha bog\'lanadi', () => {
  assert.ok(rowIsCust({ customerId: 9, customer: 'Ali' }, 'ali'));
  assert.ok(!rowIsCust({ customer: 'Vali' }, 'ali'));
});

test('rowIsCust bo\'sh yozuvda xato bermaydi', () => {
  assert.strictEqual(rowIsCust(null, { id: 1, name: 'A' }), false);
  assert.strictEqual(rowIsCust(undefined, 'A'), false);
  assert.strictEqual(rowIsCust({}, { id: 1, name: 'A' }), false);
});

test('custRows faqat shu mijozning yozuvlarini beradi', () => {
  const rows = [
    { id: 1, customerId: 5, amount: 100 },
    { id: 2, customerId: 9, amount: 200 },
    { id: 3, customer: 'ali', amount: 300 },       // eski, nom bo'yicha
    { id: 4, customer: 'vali', amount: 400 },
  ];
  const got = custRows(rows, { id: 5, name: 'Ali' });
  assert.deepStrictEqual(got.map(r => r.id), [1, 3]);
});

test('custRows bo\'sh ro\'yxatda ishlaydi', () => {
  assert.deepStrictEqual(custRows(null, { id: 1, name: 'A' }), []);
  assert.deepStrictEqual(custRows([], 'A'), []);
});

// ── Bazadan topish va yangi yozuvga maydon berish ────────────────────────────

test('findCust normallashtirilgan ism bo\'yicha topadi', () => {
  const customers = [{ id: 1, name: 'Ali aka' }, { id: 2, name: 'Vali' }];
  assert.strictEqual(findCust(customers, '  ALI  aka ')?.id, 1);
  assert.strictEqual(findCust(customers, 'yo\'q odam'), null);
  assert.strictEqual(findCust(customers, ''), null);
  assert.strictEqual(findCust(null, 'Ali'), null);
});

test('custFields bazadagi KANONIK nomni va id ni beradi', () => {
  const customers = [{ id: 7, name: 'Ali aka' }];
  // Foydalanuvchi boshqacha yozgan bo'lsa ham, yozuvga bazadagi nom tushadi —
  // shunda butun tizim bo'ylab bir xil yoziladi.
  assert.deepStrictEqual(custFields(customers, ' ali AKA '), { customer: 'Ali aka', customerId: 7 });
});

test('custFields bazada yo\'q ism uchun id bermaydi', () => {
  const r = custFields([{ id: 7, name: 'Ali' }], 'Yangi odam');
  assert.deepStrictEqual(r, { customer: 'Yangi odam' });
  assert.strictEqual('customerId' in r, false, 'id maydoni umuman bo\'lmasligi kerak');
});

test('custFields bo\'sh ismni bo\'sh qoldiradi', () => {
  assert.deepStrictEqual(custFields([], ''), { customer: '' });
  assert.deepStrictEqual(custFields([], null), { customer: '' });
});

// ── Ro'yxatni yagonalashtirish ───────────────────────────────────────────────

test('uniqueNames takrorlarni olib tashlaydi, BIRINCHI yozilishini saqlaydi', () => {
  const got = uniqueNames(['Kizilkum Sement'], ['kizilkum sement', 'Boshqa zavod'], ['  KIZILKUM  SEMENT  ']);
  assert.deepStrictEqual(got, ['Kizilkum Sement', 'Boshqa zavod']);
});

test('uniqueNames bo\'sh qiymatlarni tashlab ketadi', () => {
  assert.deepStrictEqual(uniqueNames(['A', '', null, undefined, '  ']), ['A']);
});
