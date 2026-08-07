// Son parseri testlari — cd dashboard && npm test
//
// Bu funksiya Excel importi va barcha summa maydonlari orqali o'tadi:
// bitta xato butun hisobotni buzadi, shuning uchun chetki holatlar qoplangan.
import test from 'node:test';
import assert from 'node:assert';
import { parseNum } from './parseNum.js';

test('oddiy sonlar', () => {
  assert.strictEqual(parseNum(1500000), 1500000);
  assert.strictEqual(parseNum('1500000'), 1500000);
  assert.strictEqual(parseNum(' 250 '), 250);
});

test("minglar probel bilan ajratilgan bo'lsa to'g'ri o'qiladi", () => {
  assert.strictEqual(parseNum('12 500 000'), 12500000);
});

test('uzilmas probel (U+00A0) ham olib tashlanadi', () => {
  // Excel va veb-saytlardan nusxa olinganda aynan shu belgi tushadi
  assert.strictEqual(parseNum('12 500 000'), 12500000);
});

test("kasr VERGUL bilan yozilgan bo'lsa to'g'ri o'qiladi", () => {
  assert.strictEqual(parseNum('12,5'), 12.5);
  // Eng muhimi: vergul O'CHIRILMAYDI, aks holda summa 10 barobar oshardi
  assert.strictEqual(parseNum('1 378 756,50'), 1378756.5);
});

test('manfiy son ishorasini saqlaydi (1C oborotkasi)', () => {
  assert.strictEqual(parseNum('-1378756000'), -1378756000);
});

test("bo'sh va yaroqsiz qiymat 0 beradi", () => {
  assert.strictEqual(parseNum(''), 0);
  assert.strictEqual(parseNum(null), 0);
  assert.strictEqual(parseNum(undefined), 0);
  assert.strictEqual(parseNum('salom'), 0);
  assert.strictEqual(parseNum(NaN), 0);
  assert.strictEqual(parseNum(Infinity), 0);
});
