// Haydovchi balansi (backend) — cd backend && npm test
//
// Bot haydovchiga "sizga qancha to'lanishi kerak" deb yozadi. Bu raqam
// dasturdagi (frontend lib/driverBalance.js) hisob bilan AYNAN bir xil
// bo'lishi shart — aks holda haydovchi bir raqamni, buxgalter boshqasini
// ko'radi va nizo chiqadi.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sement-drv-'));
process.env.DATA_DIR = tmp;

const db = require('../src/db');
const ACC = 'test-driver';

const setState = (state) => db.setState(ACC, state);
const DRV = { id: 1, name: 'Aziz aka' };

test('faqat reyslar — hammasi to\'lanishi kerak', () => {
  setState({
    drivers: [DRV],
    driver_trips: [
      { id: 1, driverId: 1, price: 200000, isPayment: false },
      { id: 2, driverId: 1, price: 300000, isPayment: false },
    ],
  });
  assert.strictEqual(db.driverBalance(ACC, 1), 500000);
});

test('reys to\'lovi ayiriladi', () => {
  setState({
    drivers: [DRV],
    driver_trips: [
      { id: 1, driverId: 1, price: 500000, isPayment: false },
      { id: 2, driverId: 1, price: 200000, isPayment: true },
    ],
  });
  assert.strictEqual(db.driverBalance(ACC, 1), 300000);
});

test('KASSADAN berilgan pul ham ayiriladi', () => {
  // Asosiy tuzatish: ilgari bu hisobga olinmasdi va bot oshirilgan
  // summani aytardi.
  setState({
    drivers: [DRV],
    driver_trips: [{ id: 1, driverId: 1, price: 500000, isPayment: false }],
    cash_rows: [{ id: 10, customer: 'Aziz aka', amount: -150000 }],
  });
  assert.strictEqual(db.driverBalance(ACC, 1), 350000);
});

test('bank va click yozuvlari ham hisobga olinadi', () => {
  setState({
    drivers: [DRV],
    driver_trips: [{ id: 1, driverId: 1, price: 500000, isPayment: false }],
    bank_rows:  [{ id: 10, customer: 'Aziz aka', amount: -100000 }],
    click_rows: [{ id: 11, customer: 'Aziz aka', amount: -50000 }],
  });
  assert.strictEqual(db.driverBalance(ACC, 1), 350000);
});

test('AVTOMATIK kassa yozuvi ikki marta sanalmaydi', () => {
  setState({
    drivers: [DRV],
    driver_trips: [
      { id: 1, driverId: 1, price: 500000, isPayment: false },
      { id: 2, driverId: 1, price: 200000, isPayment: true },
    ],
    cash_rows: [{ id: 10, customer: 'Aziz aka', amount: -200000, auto: true, sourceType: 'driver', sourceId: 2 }],
  });
  assert.strictEqual(db.driverBalance(ACC, 1), 300000);
});

test('MIJOZGA qilingan to\'lov haydovchi balansiga tegmaydi', () => {
  setState({
    drivers: [DRV],
    driver_trips: [{ id: 1, driverId: 1, price: 500000, isPayment: false }],
    cash_rows: [
      { id: 10, customerId: 77, customer: 'Aziz aka', amount: -300000 },  // mijozga
      { id: 11, customer: 'Aziz aka', amount: -100000 },                   // haydovchiga
    ],
  });
  assert.strictEqual(db.driverBalance(ACC, 1), 400000);
});

test('ism registr/probel farqi bilan yozilsa ham topiladi', () => {
  setState({
    drivers: [DRV],
    driver_trips: [{ id: 1, driverId: 1, price: 500000, isPayment: false }],
    cash_rows: [{ id: 10, customer: '  AZIZ  aka ', amount: -200000 }],
  });
  assert.strictEqual(db.driverBalance(ACC, 1), 300000);
});

test('kassa KIRIMI (musbat) to\'lov sanalmaydi', () => {
  setState({
    drivers: [DRV],
    driver_trips: [{ id: 1, driverId: 1, price: 500000, isPayment: false }],
    cash_rows: [{ id: 10, customer: 'Aziz aka', amount: 200000 }],
  });
  assert.strictEqual(db.driverBalance(ACC, 1), 500000);
});

test('haydovchi topilmasa reyslar bo\'yicha hisoblanadi', () => {
  setState({ drivers: [], driver_trips: [{ id: 1, driverId: 1, price: 100000, isPayment: false }] });
  assert.strictEqual(db.driverBalance(ACC, 1), 100000);
});

test('bo\'sh holatda 0', () => {
  setState({});
  assert.strictEqual(db.driverBalance(ACC, 1), 0);
});

test.after(() => {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
});
