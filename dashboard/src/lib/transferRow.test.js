import test from 'node:test';
import assert from 'node:assert/strict';
import { isTransferRow } from './transferRow.js';

test('yangi o\'tkazma bayroq bilan tanilади', () => {
  assert.equal(isTransferRow({ transfer: true, desc: 'Bank→Naqd' }), true);
});

test('eski o\'tkazma izohdagi belgi bilan taniladi', () => {
  assert.equal(isTransferRow({ desc: '↔️ 🏦→💵 Bank→Naqd' }), true);
});

test('izoh oldida probel bo\'lsa ham taniladi', () => {
  assert.equal(isTransferRow({ desc: '  ↔️ Naqd→Bank' }), true);
});

test('izohi tahrirlangan o\'tkazma baribir o\'tkazma bo\'lib qoladi', () => {
  // Aynan shu holat ikki sahifada har xil raqam berardi: Kassir jurnali
  // bayroqni ko'rib chiqarib tashlar, Bosh sahifa esa izohga qarab kirim
  // sifatida qo'shardi.
  assert.equal(isTransferRow({ transfer: true, desc: 'Bankdan olindi' }), true);
});

test('oddiy kirim/chiqim o\'tkazma emas', () => {
  assert.equal(isTransferRow({ desc: 'Sement puli' }), false);
  assert.equal(isTransferRow({ desc: '' }), false);
  assert.equal(isTransferRow({}), false);
});

test('izoh o\'rtasida ↔️ bo\'lsa o\'tkazma emas', () => {
  assert.equal(isTransferRow({ desc: 'Kelishuv ↔️ bo\'yicha' }), false);
});

test('null/undefined xavfsiz', () => {
  assert.equal(isTransferRow(null), false);
  assert.equal(isTransferRow(undefined), false);
});
