// Sana oralig'i filtri testlari — cd dashboard && npm test
//
// Har bir hisobot va ro'yxat shu filtrga tayanadi. Xatosi yozuvni hisobotdan
// yashiradi (yoki begonasini qo'shadi) — summalar mos kelmay qoladi va sababini
// topish qiyin bo'ladi.
import test from 'node:test';
import assert from 'node:assert';
import { parseRu, isEmptyRange, inRange, filterByRange, todayISO, daysAgoISO } from './dateRange.js';

const R = (from, to) => ({ from, to });

test('parseRu "kk.oo.yyyy" ni o\'qiydi', () => {
  const t = parseRu('06.07.2026');
  const d = new Date(t);
  assert.strictEqual(d.getFullYear(), 2026);
  assert.strictEqual(d.getMonth(), 6);   // iyul
  assert.strictEqual(d.getDate(), 6);
});

test('parseRu buzuq qiymatga NaN beradi', () => {
  for (const v of ['', null, undefined, '46209', '2026-07-06', 'salom', '6.7']) {
    assert.ok(Number.isNaN(parseRu(v)), `${v} uchun NaN kutilgan`);
  }
});

test('bo\'sh oraliq — filtr o\'chiq', () => {
  assert.ok(isEmptyRange(null));
  assert.ok(isEmptyRange({}));
  assert.ok(isEmptyRange(R('', '')));
  assert.ok(!isEmptyRange(R('2026-07-01', '')));
});

test('oraliq CHEGARALARI ham kiradi (dan va gacha)', () => {
  const range = R('2026-07-01', '2026-07-31');
  assert.ok(inRange('01.07.2026', range), 'boshlanish kuni kirishi kerak');
  assert.ok(inRange('31.07.2026', range), 'tugash kuni kirishi kerak');
  assert.ok(inRange('15.07.2026', range));
});

test('oraliqdan tashqaridagi sana chiqarib tashlanadi', () => {
  const range = R('2026-07-01', '2026-07-31');
  assert.ok(!inRange('30.06.2026', range));
  assert.ok(!inRange('01.08.2026', range));
});

test('faqat "dan" yoki faqat "gacha" berilganda', () => {
  assert.ok(inRange('15.07.2026', R('2026-07-01', '')));
  assert.ok(!inRange('15.06.2026', R('2026-07-01', '')));
  assert.ok(inRange('15.07.2026', R('', '2026-07-31')));
  assert.ok(!inRange('15.08.2026', R('', '2026-07-31')));
});

test('sanasi BUZUQ yozuv yashirilmaydi', () => {
  // Ataylab shunday: yozuvni ko'rsatmaslikdan ko'ra ko'rsatgan yaxshi —
  // aks holda u hech qaysi hisobotda ko'rinmay, jimgina yo'qolardi.
  // (Tekshiruv sahifasi bunday sanalarni alohida ro'yxatlaydi.)
  const range = R('2026-07-01', '2026-07-31');
  assert.ok(inRange('46209', range));
  assert.ok(inRange('', range));
  assert.ok(inRange(undefined, range));
});

test('filterByRange bo\'sh oraliqda ro\'yxatni O\'ZGARTIRMAYDI', () => {
  const rows = [{ date: '01.01.2020' }, { date: '31.12.2030' }];
  assert.strictEqual(filterByRange(rows, R('', '')), rows, 'aynan o\'sha massiv qaytishi kerak');
});

test('filterByRange sanaga qarab filtrlaydi', () => {
  const rows = [
    { id: 1, date: '30.06.2026' },
    { id: 2, date: '01.07.2026' },
    { id: 3, date: '15.07.2026' },
    { id: 4, date: '01.08.2026' },
  ];
  const got = filterByRange(rows, R('2026-07-01', '2026-07-31'));
  assert.deepStrictEqual(got.map(r => r.id), [2, 3]);
});

test('filterByRange boshqa maydondan sana olishi mumkin', () => {
  const rows = [{ id: 1, sana: '15.07.2026' }, { id: 2, sana: '15.08.2026' }];
  const got = filterByRange(rows, R('2026-07-01', '2026-07-31'), r => r.sana);
  assert.deepStrictEqual(got.map(r => r.id), [1]);
});

test('bir kunlik oraliq (dan = gacha) o\'sha kunni beradi', () => {
  const rows = [{ id: 1, date: '15.07.2026' }, { id: 2, date: '16.07.2026' }];
  const got = filterByRange(rows, R('2026-07-15', '2026-07-15'));
  assert.deepStrictEqual(got.map(r => r.id), [1]);
});

test('todayISO va daysAgoISO "yyyy-oo-kk" formatida', () => {
  assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(daysAgoISO(30), /^\d{4}-\d{2}-\d{2}$/);
  // 30 kun oldingi sana bugundan kichik bo'lishi kerak
  assert.ok(daysAgoISO(30) < todayISO());
  assert.strictEqual(daysAgoISO(0), todayISO());
});

test('oy chegarasida daysAgoISO to\'g\'ri ishlaydi', () => {
  // 1-avgustdan 1 kun oldin = 31-iyul (oy va yil ham to'g'ri surilishi kerak)
  const iso = daysAgoISO(0);
  assert.match(iso, /^\d{4}-\d{2}-\d{2}$/);
  const back = daysAgoISO(400);          // bir yildan ko'p
  assert.ok(Number(back.slice(0, 4)) < Number(iso.slice(0, 4)) + 1);
});
