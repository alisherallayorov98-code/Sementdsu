// Excel import qatorlarini tozalash testlari — cd dashboard && npm test
//
// Qarzlar va Avanslar importi shu funksiyadan o'tadi. Xatosi to'g'ridan-to'g'ri
// pulga tegadi: bir marta 420 qatorli fayl butunlay o'tkazib yuborilgan edi
// (manfiy summa `amount <= 0` filtriga tushib ketgani uchun).
import test from 'node:test';
import assert from 'node:assert';
import { cleanImportRows } from './importRows.js';

test('oddiy qatorlar o\'tadi', () => {
  const { clean, skipped } = cleanImportRows([
    { customer: 'Ali aka', amount: 500000, note: 'izoh', date: '06.07.2026' },
  ]);
  assert.strictEqual(skipped, 0);
  assert.deepStrictEqual(clean, [{ customer: 'Ali aka', amount: 500000, note: 'izoh', date: '06.07.2026' }]);
});

test('MANFIY summa qabul qilinadi (1C oborotkasi) — moduli olinadi', () => {
  // Aynan shu holat 420 qatorli faylni butunlay yo'qotgan edi
  const { clean, skipped } = cleanImportRows([
    { customer: 'Тошкентдан ер', amount: -1378756000 },
    { customer: 'Сохиб жура', amount: -869181100 },
  ]);
  assert.strictEqual(skipped, 0);
  assert.strictEqual(clean.length, 2);
  assert.strictEqual(clean[0].amount, 1378756000);
  assert.strictEqual(clean[1].amount, 869181100);
});

test('probelli va vergulli summa to\'g\'ri o\'qiladi', () => {
  const { clean } = cleanImportRows([
    { customer: 'A', amount: '1 378 756' },
    { customer: 'B', amount: '12,5' },
    { customer: 'C', amount: '1 378 756,50' },
  ]);
  assert.strictEqual(clean[0].amount, 1378756);
  assert.strictEqual(clean[1].amount, 12.5);
  assert.strictEqual(clean[2].amount, 1378756.5, 'vergul o\'chirilmasligi kerak');
});

test('ismsiz qator o\'tkazib yuboriladi', () => {
  const { clean, skipped } = cleanImportRows([
    { customer: '',    amount: 500000 },
    { customer: '   ', amount: 500000 },
    { customer: 'Ali', amount: 500000 },
  ]);
  assert.strictEqual(clean.length, 1);
  assert.strictEqual(skipped, 2);
});

test('nol va yaroqsiz summa o\'tkazib yuboriladi', () => {
  const { clean, skipped } = cleanImportRows([
    { customer: 'A', amount: 0 },
    { customer: 'B', amount: '' },
    { customer: 'C', amount: 'salom' },
    { customer: 'D', amount: null },
    { customer: 'E', amount: 100 },
  ]);
  assert.strictEqual(clean.length, 1);
  assert.strictEqual(clean[0].customer, 'E');
  assert.strictEqual(skipped, 4);
});

test('ism atrofidagi probel olib tashlanadi', () => {
  const { clean } = cleanImportRows([{ customer: '  Ali aka  ', amount: 100 }]);
  assert.strictEqual(clean[0].customer, 'Ali aka');
});

test('bo\'sh va yaroqsiz kirish xato bermaydi', () => {
  assert.deepStrictEqual(cleanImportRows([]), { clean: [], skipped: 0 });
  assert.deepStrictEqual(cleanImportRows(null), { clean: [], skipped: 0 });
  assert.deepStrictEqual(cleanImportRows(undefined), { clean: [], skipped: 0 });
  const r = cleanImportRows([null, undefined, {}]);
  assert.strictEqual(r.clean.length, 0);
  assert.strictEqual(r.skipped, 3);
});

test('izoh va sana o\'zgarishsiz o\'tadi', () => {
  const { clean } = cleanImportRows([{ customer: 'A', amount: 100, note: 'test', date: '01.08.2026' }]);
  assert.strictEqual(clean[0].note, 'test');
  assert.strictEqual(clean[0].date, '01.08.2026');
});
