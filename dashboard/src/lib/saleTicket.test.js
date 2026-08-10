import test from 'node:test';
import assert from 'node:assert/strict';
import { ticketOf } from './saleTicket.js';

test('tiket qatorning o‘zidan olinadi', () => {
  assert.equal(ticketOf({ contractNo: 'A26010163' }), 'A26010163');
  assert.equal(ticketOf({ contractNo: '  A26010163 ' }), 'A26010163');
});

test('contractNo bo‘sh bo‘lsa karta nomidan olinadi', () => {
  assert.equal(ticketOf({ contractNo: '', cardName: 'A26010163 (7)' }), 'A26010163');
});

test('qarz qatori tiketni bog‘langan sotuvdan oladi', () => {
  const sales = [{ id: 5, contractNo: 'B26010120' }];
  const debt  = { sourceType: 'sale', sourceId: 5 };
  assert.equal(ticketOf(debt, sales), 'B26010120');
});

test('sotuvda tiket bo‘lmasa zavod yukidan (recvId) olinadi', () => {
  const recv  = [{ id: 1, contractNo: 'B26010120' }];
  const sale  = { id: 2, recvId: 1 };
  assert.equal(ticketOf(sale, [], recv), 'B26010120');
  // Zavod yukida ham contractNo bo'lmasa — karta nomidan
  assert.equal(ticketOf({ id: 3, recvId: 9 }, [], [{ id: 9, cardName: 'B26010120 (1101)' }]), 'B26010120');
});

test('qarz → sotuv → zavod yuki zanjiri oxirigacha boradi', () => {
  const recv  = [{ id: 1, contractNo: 'B26010120' }];
  const sales = [{ id: 2, recvId: 1 }];           // sotuvda tiket yo'q
  const debt  = { sourceType: 'sale', sourceId: 2 }; // qarzda ham yo'q
  assert.equal(ticketOf(debt, sales, recv), 'B26010120');
});

test('bog‘langan sotuvda ham tiket yo‘q bo‘lsa bo‘sh qaytadi', () => {
  const sales = [{ id: 5 }];
  assert.equal(ticketOf({ sourceType: 'sale', sourceId: 5 }, sales), '');
  assert.equal(ticketOf({ sourceType: 'sale', sourceId: 99 }, sales), '');
  assert.equal(ticketOf(null), '');
  assert.equal(ticketOf({}), '');
});

test('qatorning o‘z tiketi sotuvnikidan ustun', () => {
  const sales = [{ id: 5, contractNo: 'B26010120' }];
  assert.equal(ticketOf({ contractNo: 'A26010163', sourceType: 'sale', sourceId: 5 }, sales), 'A26010163');
});
