// Haydovchi hisob-kitobi testlari — cd dashboard && npm test
//
// Bu hisob uch sahifada ko'rsatiladi (Haydovchilar, Hisobotlar, Umumiy
// hisobot) va ular bir xil natija berishi shart — aks holda "haydovchiga
// qancha to'lashimiz kerak" savoliga uch xil javob chiqadi.
import test from 'node:test';
import assert from 'node:assert';
import { driverBalance, totalDriverDebt } from './driverBalance.js';

const drv = { id: 1, name: 'Aziz aka' };

test('faqat reyslar — hammasi to\'lanishi kerak', () => {
  const b = driverBalance(drv, {
    driverTrips: [
      { id: 1, driverId: 1, price: 200000, isPayment: false },
      { id: 2, driverId: 1, price: 300000, isPayment: false },
    ],
  });
  assert.strictEqual(b.earnings, 500000);
  assert.strictEqual(b.totalPaid, 0);
  assert.strictEqual(b.balance, 500000);
  assert.strictEqual(b.tripsCount, 2);
});

test('reys to\'lovi balansdan ayiriladi', () => {
  const b = driverBalance(drv, {
    driverTrips: [
      { id: 1, driverId: 1, price: 500000, isPayment: false },
      { id: 2, driverId: 1, price: 200000, isPayment: true },
    ],
  });
  assert.strictEqual(b.balance, 300000);
  assert.strictEqual(b.tripsCount, 1, 'to\'lov reys sifatida sanalmaydi');
});

test('kassadan berilgan pul ham hisobga olinadi', () => {
  const b = driverBalance(drv, {
    driverTrips: [{ id: 1, driverId: 1, price: 500000, isPayment: false }],
    cashRows: [{ id: 10, customer: 'Aziz aka', amount: -150000 }],
  });
  assert.strictEqual(b.kassiPaid, 150000);
  assert.strictEqual(b.balance, 350000);
});

test('kassa KIRIMI (musbat) haydovchiga to\'lov sanalmaydi', () => {
  const b = driverBalance(drv, {
    driverTrips: [{ id: 1, driverId: 1, price: 500000, isPayment: false }],
    cashRows: [{ id: 10, customer: 'Aziz aka', amount: 150000 }],
  });
  assert.strictEqual(b.kassiPaid, 0);
  assert.strictEqual(b.balance, 500000);
});

test('AVTOMATIK kassa yozuvi ikki marta sanalmaydi', () => {
  // driverTrips orqali to'lov qilinganda kassaga auto yozuv tushadi —
  // u tripPaid da allaqachon hisoblangan.
  const b = driverBalance(drv, {
    driverTrips: [
      { id: 1, driverId: 1, price: 500000, isPayment: false },
      { id: 2, driverId: 1, price: 200000, isPayment: true },
    ],
    cashRows: [{ id: 10, customer: 'Aziz aka', amount: -200000, auto: true, sourceType: 'driver', sourceId: 2 }],
  });
  assert.strictEqual(b.totalPaid, 200000, 'faqat bir marta');
  assert.strictEqual(b.balance, 300000);
});

test('MIJOZGA qilingan to\'lov haydovchi balansiga tegmaydi', () => {
  // Bir xil nomli mijoz va haydovchi bo'lishi mumkin. Mijozga qilingan
  // chiqimda customerId bo'ladi — u haydovchiga tegishli emas.
  const b = driverBalance(drv, {
    driverTrips: [{ id: 1, driverId: 1, price: 500000, isPayment: false }],
    cashRows: [
      { id: 10, customerId: 77, customer: 'Aziz aka', amount: -300000 },  // mijozga
      { id: 11, customer: 'Aziz aka', amount: -100000 },                   // haydovchiga
    ],
  });
  assert.strictEqual(b.kassiPaid, 100000, 'faqat mijozsiz yozuv');
  assert.strictEqual(b.balance, 400000);
});

test('ism registr/probel farqi bilan yozilsa ham topiladi', () => {
  const b = driverBalance(drv, {
    driverTrips: [{ id: 1, driverId: 1, price: 500000, isPayment: false }],
    cashRows: [{ id: 10, customer: '  AZIZ  aka ', amount: -200000 }],
  });
  assert.strictEqual(b.kassiPaid, 200000);
});

test('boshqa haydovchining reysi aralashmaydi', () => {
  const b = driverBalance(drv, {
    driverTrips: [
      { id: 1, driverId: 1, price: 500000, isPayment: false },
      { id: 2, driverId: 2, price: 900000, isPayment: false },
    ],
  });
  assert.strictEqual(b.earnings, 500000);
});

test('haydovchi avans qarzdor bo\'lsa balans MANFIY', () => {
  const b = driverBalance(drv, {
    driverTrips: [{ id: 1, driverId: 1, price: 100000, isPayment: true }],  // faqat avans
  });
  assert.strictEqual(b.balance, -100000);
});

test('totalDriverDebt manfiy balansni qo\'shmaydi', () => {
  const drivers = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
  const data = {
    driverTrips: [
      { id: 1, driverId: 1, price: 500000, isPayment: false },  // A: +500k
      { id: 2, driverId: 2, price: 200000, isPayment: true },   // B: −200k (avans qarzdor)
    ],
  };
  // Faqat A ning 500k qo'shiladi — B bizga qarzdor, bizning qarzimiz emas
  assert.strictEqual(totalDriverDebt(drivers, data), 500000);
});

test('bo\'sh ma\'lumotda xato bermaydi', () => {
  assert.strictEqual(driverBalance(null, {}).balance, 0);
  assert.strictEqual(driverBalance(drv, {}).balance, 0);
  assert.strictEqual(driverBalance(drv).balance, 0);
  assert.strictEqual(totalDriverDebt(null, {}), 0);
});

test('yaroqsiz summalar 0 deb hisoblanadi', () => {
  const b = driverBalance(drv, {
    driverTrips: [
      { id: 1, driverId: 1, price: 'yaroqsiz', isPayment: false },
      { id: 2, driverId: 1, price: 300000, isPayment: false },
    ],
  });
  assert.strictEqual(b.earnings, 300000);
});
