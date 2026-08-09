// Avtomatik arxiv testlari — cd dashboard && npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { planArchive, isArchiveDue, RECENT_DAYS } from './archiveRun.js';
import {
  allDays, daySheets, monthSheets, yearSheets, registrySheets,
  splitDate, monthFolder, dayFile, monthFile, yearFile,
} from './archiveData.js';

const TS = (y, m, d) => new Date(y, m - 1, d).getTime();

// ── planArchive ─────────────────────────────────────────────────────────────

test('fayli yo‘q kunlar yoziladi', () => {
  const p = planArchive(['01.01.2025', '02.01.2025'], new Set(), TS(2026, 8, 9));
  assert.deepEqual(p.days, ['01.01.2025', '02.01.2025']);
  assert.deepEqual(p.months, ['2025-1']);
  assert.deepEqual(p.years, [2025]);
});

test('fayli BOR eski kun qayta yozilmaydi (tezlik uchun)', () => {
  const days = ['01.01.2025', '02.01.2025'];
  const p = planArchive(days, new Set(days), TS(2026, 8, 9));
  assert.deepEqual(p.days, []);
  assert.deepEqual(p.months, []);
});

test('oxirgi 7 kun fayli bor bo‘lsa ham QAYTA yoziladi', () => {
  // Kassir kechagi xatoni tuzatishi mumkin — yaqin o'tmish doim yangilanadi
  const now = TS(2026, 8, 9);
  const days = ['01.01.2025', '05.08.2026', '09.08.2026'];
  const p = planArchive(days, new Set(days), now);
  assert.deepEqual(p.days, ['05.08.2026', '09.08.2026']);
  assert.deepEqual(p.years, [2026]);
});

test('RECENT_DAYS chegarasi', () => {
  const now = TS(2026, 8, 9);
  const inside  = '03.08.2026';  // 6 kun oldin
  const outside = '01.08.2026';  // 8 kun oldin
  const p = planArchive([inside, outside], new Set([inside, outside]), now);
  assert.ok(p.days.includes(inside));
  assert.ok(!p.days.includes(outside));
  assert.equal(RECENT_DAYS, 7);
});

test('buzuq sanali kun oy/yil ro‘yxatini buzmaydi', () => {
  const p = planArchive(['xato-sana', '09.08.2026'], new Set(), TS(2026, 8, 9));
  assert.deepEqual(p.months, ['2026-8']);
  assert.deepEqual(p.years, [2026]);
});

// ── isArchiveDue ────────────────────────────────────────────────────────────

test('hech qachon olinmagan bo‘lsa — darhol kerak', () => {
  assert.equal(isArchiveDue('daily', null), true);
  assert.equal(isArchiveDue('weekly', null), true);
});

test('kunlik: bugun olingan bo‘lsa kerak emas, ertaga kerak', () => {
  const now = TS(2026, 8, 9) + 9 * 3600000;      // 09-avgust 09:00
  assert.equal(isArchiveDue('daily', TS(2026, 8, 9) + 3600000, now), false);
  assert.equal(isArchiveDue('daily', TS(2026, 8, 8) + 3600000, now), true);
});

test('haftalik: 7 kundan keyin', () => {
  const now = TS(2026, 8, 9);
  assert.equal(isArchiveDue('weekly', now - 6 * 86400000, now), false);
  assert.equal(isArchiveDue('weekly', now - 8 * 86400000, now), true);
});

test('oylik: oy almashganda', () => {
  const now = TS(2026, 8, 1);
  assert.equal(isArchiveDue('monthly', TS(2026, 8, 1) - 3600000, now), true);   // 31-iyul
  assert.equal(isArchiveDue('monthly', TS(2026, 8, 1) + 3600000, now), false);  // shu oy
});

// ── archiveData ─────────────────────────────────────────────────────────────

const sample = {
  cashRows: [
    { id: 1, date: '09.08.2026', amount: 500000, desc: 'Sotuv', auto: true, sourceType: 'sale', worker: 'Ali' },
    { id: 2, date: '09.08.2026', amount: -200000, desc: 'Oylik', auto: true, sourceType: 'salary' },
    { id: 3, date: '05.07.2026', amount: 100000, desc: "Qo'lda" },
  ],
  salesRows: [{ id: 10, date: '09.08.2026', customer: 'Akmal', tons: 5, pricePerTon: 900000, paymentChannel: 'naqd' }],
  debtRows: [{
    id: 20, date: '05.07.2026', customer: 'Vali', amount: 1000000, paid: 400000,
    payments: [{ id: 21, date: '09.08.2026', amount: 400000, channel: 'naqd', note: "To'lov" }],
  }],
  customers: [{ id: 100, name: 'Akmal', phone: '+998901234567' }],
  workers:   [{ id: 200, name: 'Ali', salary: 3000000, paid: 0 }],
};

test('allDays — yozuv bo‘lgan kunlar, eskidan yangiga', () => {
  assert.deepEqual(allDays(sample), ['05.07.2026', '09.08.2026']);
});

test('daySheets faqat o‘sha kunning yozuvlarini oladi', () => {
  const sheets = daySheets(sample, '09.08.2026');
  const kassa = sheets.find(s => s.sheet === 'Kassa (naqd)');
  assert.equal(kassa.rows.length, 2);            // 05.07 dagi qator kirmaydi
  assert.ok(sheets.find(s => s.sheet === 'Sotuv'));
  // Qarz to'lovi qator ichidan yoyilgan — o'z varag'ida chiqadi
  const pay = sheets.find(s => s.sheet === 'Qarz tolovlari');
  assert.equal(pay.rows.length, 1);
  assert.equal(pay.rows[0]._customer, 'Vali');
});

test('bo‘sh kun uchun varaq yasalmaydi', () => {
  assert.deepEqual(daySheets(sample, '01.01.2020'), []);
});

test('monthSheets / yearSheets butun davrni oladi', () => {
  assert.equal(monthSheets(sample, 2026, 7).find(s => s.sheet === 'Kassa (naqd)').rows.length, 1);
  assert.equal(yearSheets(sample, 2026).find(s => s.sheet === 'Kassa (naqd)').rows.length, 3);
});

test('reyestrlar davrga bog‘liq emas', () => {
  const reg = registrySheets(sample);
  assert.ok(reg.find(s => s.sheet === 'Mijozlar'));
  assert.ok(reg.find(s => s.sheet === 'Xodimlar'));
  // Kassa reyestr emas — u davrga tegishli
  assert.ok(!reg.find(s => s.sheet === 'Kassa (naqd)'));
});

test('kassa ustunlari to‘liq: kirim/chiqim ajratilgan, manba ko‘rinadi', () => {
  const kassa = daySheets(sample, '09.08.2026').find(s => s.sheet === 'Kassa (naqd)');
  const get = (row, header) => kassa.columns.find(c => c.header === header).get(row);
  assert.equal(get(kassa.rows[0], 'Turi'), 'Kirim');
  assert.equal(get(kassa.rows[1], 'Turi'), 'Chiqim');
  assert.equal(get(kassa.rows[1], "Summa (so'm)"), 200000);  // manfiy emas, moduli
  assert.equal(get(kassa.rows[1], 'Manba'), 'Oylik');
});

// ── nomlar ──────────────────────────────────────────────────────────────────

test('papka va fayl nomlari', () => {
  assert.equal(monthFolder(4), '04-Aprel');
  assert.equal(monthFolder(12), '12-Dekabr');
  assert.equal(dayFile('09.08.2026'), '09.08.2026.xlsx');
  assert.equal(monthFile(2026, 8), '2026-08-OYLIK.xlsx');
  assert.equal(yearFile(2026), '2026-YILLIK.xlsx');
});

test('splitDate buzuq sanani rad etadi', () => {
  assert.deepEqual(splitDate('09.08.2026'), { d: 9, m: 8, y: 2026 });
  assert.equal(splitDate('23.06.26'), null);      // 2 xonali yil
  assert.equal(splitDate('2026-08-09'), null);
  assert.equal(splitDate(''), null);
  assert.equal(splitDate(undefined), null);
});
