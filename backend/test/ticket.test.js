// Tiket qoldig'i himoyasi — cd backend && npm test
//
// Zayavka bot tiketdan tonna sarflaydi. Qoldiqdan ortiq so'ralganda yozuv
// AMALGA OSHMASLIGI kerak: aks holda qoldiq manfiyga tushib, tiket nazorati
// ma'nosini yo'qotardi.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// db moduli DATA_DIR ni config dan oladi — testni izolyatsiya qilish uchun
// vaqtinchalik papkada ishlaymiz.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sement-test-'));
process.env.DATA_DIR = tmp;

const db = require('../src/db');
const ACC = 'test-akkaunt';

function setTickets(tickets) {
  db.setState(ACC, { tickets });
}

test('qoldiq yetarli bo\'lsa tonna sarflanadi', () => {
  setTickets([{ id: 't1', number: 'TK-1', totalTonna: 100, usedTonna: 0, status: 'open' }]);
  const r = db.useTicketTonna(ACC, 't1', 30);
  assert.ok(r, 'sarflash amalga oshishi kerak');
  assert.strictEqual(r.usedTonna, 30);
});

test('qoldiqdan ORTIQ so\'ralsa rad etiladi va qoldiq o\'zgarmaydi', () => {
  setTickets([{ id: 't1', number: 'TK-1', totalTonna: 100, usedTonna: 90, status: 'open' }]);
  const r = db.useTicketTonna(ACC, 't1', 50);
  assert.strictEqual(r, null, 'rad etilishi kerak');
  const after = db.getState(ACC).tickets[0];
  assert.strictEqual(after.usedTonna, 90, 'qoldiq tegilmasligi kerak');
});

test('aynan qoldiqcha so\'ralsa ruxsat beriladi', () => {
  setTickets([{ id: 't1', number: 'TK-1', totalTonna: 100, usedTonna: 90, status: 'open' }]);
  const r = db.useTicketTonna(ACC, 't1', 10);
  assert.ok(r);
  assert.strictEqual(r.usedTonna, 100);
});

test('manfiy yoki nol tonna rad etiladi', () => {
  setTickets([{ id: 't1', number: 'TK-1', totalTonna: 100, usedTonna: 0, status: 'open' }]);
  assert.strictEqual(db.useTicketTonna(ACC, 't1', -5), null);
  assert.strictEqual(db.useTicketTonna(ACC, 't1', 0), null);
  assert.strictEqual(db.getState(ACC).tickets[0].usedTonna, 0);
});

test('mavjud bo\'lmagan tiket null qaytaradi', () => {
  setTickets([{ id: 't1', number: 'TK-1', totalTonna: 100, usedTonna: 0, status: 'open' }]);
  assert.strictEqual(db.useTicketTonna(ACC, 'yoq', 10), null);
});

test('qaytarish (restore) qoldiqni manfiyga tushirmaydi', () => {
  setTickets([{ id: 't1', number: 'TK-1', totalTonna: 100, usedTonna: 20, status: 'open' }]);
  const r = db.restoreTicketTonna(ACC, 't1', 50);   // 20 dan ko'p qaytarish
  assert.strictEqual(r.usedTonna, 0, 'nolda to\'xtashi kerak');
});

test.after(() => {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
});
