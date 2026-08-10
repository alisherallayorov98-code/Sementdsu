// Zavod markasi → sement turi. Ishga tushirish: cd dashboard && npm test
//
// Bu mantiq buzilsa yuk noto'g'ri turga tushadi va sklad qoldig'i tur bo'yicha
// yolg'on ko'rsatadi — shuning uchun har bir zavod markasi test bilan qoplangan.
import test from 'node:test';
import assert from 'node:assert';
import { brandKey, guessType, resolveType, withBrandType, brandRows } from './cementBrand.js';

const TYPES = ['450 Qoplik', '550 Qoplik', '450 Rasipnoy', '550 Rasipnoy', 'Sulfatsement'];

test('marka kaliti: probel, chiziqcha va registr farq qilmaydi', () => {
  assert.strictEqual(brandKey('32.5H 包装-меш'), brandKey('32.5h包装меш'));
  assert.strictEqual(brandKey('  42.5B-K散装-рос '), brandKey('42.5BK散装рос'));
  assert.strictEqual(brandKey(''), '');
  assert.strictEqual(brandKey(null), '');
});

test('zavod markalari to\'g\'ri turga taxmin qilinadi', () => {
  assert.strictEqual(guessType('42.5B-K包装-меш', TYPES), '550 Qoplik');
  assert.strictEqual(guessType('42.5B-K散装-рос', TYPES), '550 Rasipnoy');
  assert.strictEqual(guessType('32.5H包装-меш',   TYPES), '450 Qoplik');
  assert.strictEqual(guessType('32.5H散装-рос',   TYPES), '450 Rasipnoy');
  assert.strictEqual(guessType('32.5HCC抗硫散装сул-рос', TYPES), 'Sulfatsement');
});

test('sulfat qoplik/rasipnoyga bo\'lingan bo\'lsa aniqrog\'i tanlanadi', () => {
  const t = [...TYPES, 'Sulfatsement Rasipnoy'];
  assert.strictEqual(guessType('32.5HCC抗硫散装сул-рос', t), 'Sulfatsement Rasipnoy');
});

test('tanib bo\'lmagan marka bo\'sh qaytaradi (yangi tur o\'ylab topilmaydi)', () => {
  assert.strictEqual(guessType('ALLAQANDAY MARKA', TYPES), '');
  assert.strictEqual(guessType('', TYPES), '');
  assert.strictEqual(guessType('32.5H包装-меш', []), '');
});

test('jadvaldagi biriktirish taxmindan ustun', () => {
  const map = { [brandKey('32.5H包装-меш')]: '550 Qoplik' };
  assert.deepStrictEqual(resolveType('32.5H 包装 - меш', map, TYPES), { type: '550 Qoplik', source: 'map' });
});

test('jadvalsiz marka taxmin bilan keladi', () => {
  assert.deepStrictEqual(resolveType('42.5B-K包装-меш', {}, TYPES), { type: '550 Qoplik', source: 'guess' });
});

test('o\'chirilgan turga biriktirilgan marka taxminga qaytadi', () => {
  const map = { [brandKey('42.5B-K包装-меш')]: 'YO\'Q TUR' };
  assert.deepStrictEqual(resolveType('42.5B-K包装-меш', map, TYPES), { type: '550 Qoplik', source: 'guess' });
});

test('markasi yo\'q yuk uchun hech narsa aniqlanmaydi', () => {
  assert.deepStrictEqual(resolveType('', {}, TYPES), { type: '', source: '' });
});

test('jadvalga yozish va o\'chirish', () => {
  const m1 = withBrandType({}, '32.5H包装-меш', '450 Qoplik');
  assert.strictEqual(m1[brandKey('32.5H包装-меш')], '450 Qoplik');
  const m2 = withBrandType(m1, '32.5H 包装 меш', '');   // bo'sh — o'chiradi
  assert.strictEqual(Object.keys(m2).length, 0);
  assert.strictEqual(Object.keys(m1).length, 1);        // asl jadval o'zgarmaydi
  assert.deepStrictEqual(withBrandType({}, '', '450 Qoplik'), {});
});

test('markalar ro\'yxati: takrorlanmaydi, biriktirilmagani birinchi', () => {
  const recv = [
    { brand: '32.5H包装-меш' }, { brand: '32.5H 包装-меш' }, { brand: '32.5H包装-меш' },
    { brand: 'NOMA\'LUM' },
    { brand: '' }, {},
  ];
  const map = { [brandKey('32.5H包装-меш')]: '450 Qoplik' };
  const rows = brandRows(recv, map, TYPES);
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].brand, 'NOMA\'LUM');       // biriktirilmagan — birinchi
  assert.strictEqual(rows[0].type, '');
  assert.strictEqual(rows[1].count, 3);                 // uch xil yozuv — bitta marka
  assert.strictEqual(rows[1].source, 'map');
});

test('jadvalda bor, lekin yuki kelmagan marka ham ro\'yxatda', () => {
  const rows = brandRows([], { 'a1': '450 Qoplik' }, TYPES);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].count, 0);
});
