import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceChain, derivedRows, editHint, rowFields } from './rowSource.js';

// Tipik holat: zavoddan yuk kelgan → mijozga nasiyaga sotilgan → qarz yozilgan.
// Mijoz kartochkasida QARZ ko'rinadi, lekin xato sotuvda bo'ladi.
const recv = { id: 1, date: '09.08.2026', source: 'DAVR-SU', tons: 45, pricePerTon: 550000 };
const sale = { id: 2, date: '09.08.2026', customer: 'Qarshi 5791', tons: 45, pricePerTon: 550000, paymentChannel: 'nasiya', recvId: 1 };
const debt = { id: 3, date: '09.08.2026', customer: 'Qarshi 5791', amount: 24750000, paid: 0, auto: true, sourceType: 'sale', sourceId: 2 };
const data = { recvRows: [recv], salesRows: [sale], debtRows: [debt], soldRows: [], skladRows: [], advanceRows: [], cashRows: [], bankRows: [], clickRows: [] };

test('qarzdan sotuvga, sotuvdan yukka — zanjir to‘liq quriladi', () => {
  const chain = sourceChain('debt', debt, data);
  assert.deepEqual(chain.map(c => c.kind), ['debt', 'sale', 'recv']);
  assert.equal(chain[1].row.id, 2);
  assert.equal(chain[2].row.id, 1);
});

test('qo‘lda kiritilgan qarzning manbasi yo‘q', () => {
  const manual = { id: 9, customer: 'X', amount: 100, paid: 0 };
  const chain = sourceChain('debt', manual, { ...data, debtRows: [manual] });
  assert.equal(chain.length, 1);
});

test('sotuvdan kelib chiqqan qarz topiladi (tuzatishdan oldin nima o‘zgarishi)', () => {
  const out = derivedRows('sale', sale, data);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'debt');
  assert.equal(out[0].row.id, 3);
});

test('avansning qayerga ishlatilgani ko‘rinadi', () => {
  const adv = { id: 5, customer: 'Qarshi 5791', amount: 22825000, used: 22825000,
                usages: [{ id: 6, saleId: 2, date: '09.08.2026', amount: 22825000 }] };
  const out = derivedRows('advance', adv, { ...data, advanceRows: [adv] });
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'sale');
  assert.equal(out[0].row.id, 2);
});

test('o‘chirilgan sotuvga ishlatilgan avans "topilmadi" deb belgilanadi', () => {
  const adv = { id: 5, customer: 'X', amount: 100, used: 100,
                usages: [{ id: 6, saleId: 999, date: '01.01.2026', amount: 100 }] };
  const out = derivedRows('advance', adv, data);
  assert.equal(out[0].row, null);
  assert.match(out[0].note, /topilmadi/);
});

test('avtomatik yozuvni qo‘lda tahrirlamaslik haqida ogohlantiriladi', () => {
  assert.match(editHint('debt', debt), /AVTOMATIK/);
  assert.equal(editHint('sale', sale), null);
});

test('yozuv maydonlarida sana va kim kiritgani bo‘ladi', () => {
  const labels = rowFields('sale', { ...sale, worker: 'Sardor' }).map(f => f.label);
  assert.ok(labels.includes('Sana'));
  assert.ok(labels.includes('Kim kiritdi'));
  assert.ok(labels.includes('Mijoz'));
});
