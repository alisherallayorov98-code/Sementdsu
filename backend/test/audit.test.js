// Audit nazorat qoidalari — cd backend && npm test
//
// Eng muhim qoida: PUL CHIQIMI yoki TONNA o'tgan kun bilan kiritilsa, yozuv
// eng yuqori darajada ("critical") belgilanadi. Bu qoida buzilsa, kunlik
// hisobot yopilgandan keyin qo'shilgan yozuv e'tibordan chetda qolib ketadi.
const test = require('node:test');
const assert = require('node:assert');
const { analyze } = require('../src/services/audit.service');

// N kun oldingi sanani 'kk.oo.yyyy' ko'rinishida beradi
const daysAgo = (n) => {
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};
const ev = (o) => ({ ts: Date.now(), action: 'create', coll: 'sales_rows', amount: 1000, changes: null, ...o });
const sev = (flags, type) => (flags.find(f => f.type === type) || {}).severity;

test('sotuv 5 kun oldingi sana bilan kiritilsa — eng yuqori daraja', () => {
  const f = analyze(ev({ coll: 'sales_rows', recordDate: daysAgo(5) }));
  assert.strictEqual(sev(f, 'backdate-value'), 'critical');
});

test('naqd chiqim (manfiy summa) 4 kun orqaga — eng yuqori daraja', () => {
  const f = analyze(ev({ coll: 'cash_rows', amount: -500000, recordDate: daysAgo(4) }));
  assert.strictEqual(sev(f, 'backdate-value'), 'critical');
});

test('olingan tonna 3 kun orqaga — eng yuqori daraja', () => {
  const f = analyze(ev({ coll: 'recv_rows', recordDate: daysAgo(3) }));
  assert.strictEqual(sev(f, 'backdate-value'), 'critical');
});

test('kechagi yuk odatiy — bayroq umuman qo\'yilmaydi', () => {
  assert.deepStrictEqual(analyze(ev({ coll: 'recv_rows', recordDate: daysAgo(1) })), []);
  assert.deepStrictEqual(analyze(ev({ coll: 'recv_rows', recordDate: daysAgo(0) })), []);
});

test('2 kun orqaga — ogohlantiriladi, lekin eng yuqori daraja emas', () => {
  const f = analyze(ev({ coll: 'sales_rows', recordDate: daysAgo(2) }));
  assert.strictEqual(sev(f, 'backdate-value'), 'high');
});

test('pul/tonnaga aloqasi yo\'q yozuv orqaga sana bilan — pastroq daraja', () => {
  const f = analyze(ev({ coll: 'customers', amount: 0, recordDate: daysAgo(5) }));
  assert.strictEqual(sev(f, 'backdate'), 'medium');
  assert.strictEqual(sev(f, 'backdate-value'), undefined);
});

test('sotuv sanasi ORQAGA surilsa — eng yuqori daraja', () => {
  const f = analyze(ev({
    action: 'update', coll: 'sales_rows', recordDate: daysAgo(10),
    changes: [{ field: 'date', from: daysAgo(1), to: daysAgo(10) }],
  }));
  assert.strictEqual(sev(f, 'date-moved-back'), 'critical');
});

test('sana oldinga surilsa — ogohlantirish qoladi, daraja pastroq', () => {
  const f = analyze(ev({
    action: 'update', coll: 'sales_rows', recordDate: daysAgo(1),
    changes: [{ field: 'date', from: daysAgo(10), to: daysAgo(1) }],
  }));
  assert.strictEqual(sev(f, 'date-changed'), 'high');
  assert.strictEqual(sev(f, 'date-moved-back'), undefined);
});

test('mijoz sanasi orqaga surilsa — pul emas, shuning uchun critical emas', () => {
  const f = analyze(ev({
    action: 'update', coll: 'customers', amount: 0, recordDate: daysAgo(10),
    changes: [{ field: 'date', from: daysAgo(1), to: daysAgo(10) }],
  }));
  assert.strictEqual(sev(f, 'date-moved-back'), 'high');
});
