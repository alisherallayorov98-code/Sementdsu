import test from 'node:test';
import assert from 'node:assert/strict';
import { takenAt, ftClock, factoryTimeOf } from './saleTime.js';

test('zavod vaqtidan soat:daqiqa ajratiladi', () => {
  assert.equal(ftClock('2026-08-09 14:35:12'), '14:35');
  assert.equal(ftClock('2026-08-09 9:05'), '09:05');
  assert.equal(ftClock(''), '');
  assert.equal(ftClock('sana yo\'q'), '');
});

test('olingan tonnadan sotilgan yuk — zavoddan chiqqan vaqt', () => {
  const r = { date: '09.08.2026', factoryTime: '2026-08-09 14:35:12', createdAt: Date.now() };
  const t = takenAt(r);
  assert.equal(t.time, '14:35');
  assert.equal(t.factory, true);
});

test('kassirdan sotilgan — yozuv kiritilgan vaqt', () => {
  const ts = new Date(2026, 7, 9, 16, 42, 0).getTime();
  const t = takenAt({ date: '09.08.2026', createdAt: ts });
  assert.equal(t.time, '16:42');
  assert.equal(t.factory, false);
});

test('bir xonali soat/daqiqa nolga to\'ldiriladi', () => {
  const ts = new Date(2026, 7, 9, 7, 5, 0).getTime();
  assert.equal(takenAt({ createdAt: ts }).time, '07:05');
});

test('timestamp bo\'lmagan eski yozuvda vaqt ko\'rsatilmaydi', () => {
  // Aks holda 1970-yil soati chiqib, mijozga soxta vaqt ko'rinardi.
  assert.equal(takenAt({ date: '01.01.2026', id: 12 }), null);
  assert.equal(takenAt({ date: '01.01.2026' }), null);
  assert.equal(takenAt(null), null);
});

test('eski qarz qatorida factoryTime yo\'q — sotuvdan olinadi', () => {
  const sales = [{ id: 7, factoryTime: '2026-08-09 14:35:12' }];
  const debt  = { sourceType: 'sale', sourceId: 7, createdAt: Date.now() };
  assert.equal(factoryTimeOf(debt, sales), '2026-08-09 14:35:12');
  const t = takenAt(debt, sales);
  assert.equal(t.time, '14:35');
  assert.equal(t.factory, true);
});

test('bog\'lanmagan qatorda sotuv qidirilmaydi', () => {
  const sales = [{ id: 7, factoryTime: '2026-08-09 14:35:12' }];
  assert.equal(factoryTimeOf({ sourceType: 'recv', sourceId: 7 }, sales), '');
});
