// Ichki tekshiruv (auditState) testlari — cd dashboard && npm test
//
// Har test bitta buzilish turini yaratadi va tekshiruv uni TOPISHI kerak.
// Bu testlar tekshiruvning o'zi ishlashiga kafolat beradi: kelajakda kimdir
// auditState ni buzsa, xatolar jimgina o'tib ketmasin.
import test from 'node:test';
import assert from 'node:assert';
import { auditState, auditSummary } from './auditState.js';

const codes = (st) => auditState(st).map(f => f.code);

test('toza holatda hech qanday topilma yo\'q', () => {
  const st = {
    debtRows: [{ id: 1, customer: 'Ali', amount: 1000, paid: 400, payments: [{ id: 9, amount: 400 }] }],
    customers: [{ id: 5, name: 'Ali' }],
    totalCashBalance: 500000,
  };
  assert.deepStrictEqual(auditState(st), []);
  assert.strictEqual(auditSummary(auditState(st)).toza, true);
});

test('qarzdagi paid to\'lovlar yig\'indisiga mos kelmasa topiladi', () => {
  const st = {
    debtRows: [{ id: 1, customer: 'Ali', amount: 1000, paid: 900, payments: [{ id: 9, amount: 400 }] }],
    customers: [{ id: 5, name: 'Ali' }],
  };
  assert.ok(codes(st).includes('debt-paid-mismatch'));
});

test('qarzdan ortiq to\'lov topiladi', () => {
  const st = {
    debtRows: [{ id: 1, customer: 'Ali', amount: 1000, paid: 1500, payments: [{ id: 9, amount: 1500 }] }],
    customers: [{ id: 5, name: 'Ali' }],
  };
  assert.ok(codes(st).includes('debt-overpaid'));
});

test('avansdan ortiq sarf topiladi', () => {
  const st = {
    advanceRows: [{ id: 1, customer: 'Ali', amount: 500, used: 800, usages: [{ id: 2, amount: 800 }] }],
    customers: [{ id: 5, name: 'Ali' }],
  };
  assert.ok(codes(st).includes('advance-overused'));
});

test('xodim oyligidagi nomuvofiqlik topiladi', () => {
  const st = {
    workers: [{ id: 1, name: 'Vali', paid: 500000 }],
    salaryPayments: [{ id: 2, workerId: 1, amount: 300000 }],
  };
  assert.ok(codes(st).includes('worker-paid-mismatch'));
});

test('takrorlangan id topiladi', () => {
  const st = { cashRows: [{ id: 7, amount: 10 }, { id: 7, amount: 20 }] };
  assert.ok(codes(st).includes('duplicate-id'));
});

test('manfiy qarz topiladi', () => {
  const st = { debtRows: [{ id: 1, customer: 'A', amount: -5000, paid: 0, payments: [] }], customers: [{ id: 1, name: 'A' }] };
  assert.ok(codes(st).includes('negative-amount'));
});

test('sotuvi o\'chirilgan yetim kassa yozuvi topiladi', () => {
  const st = {
    salesRows: [],   // sotuv o'chirilgan
    cashRows: [{ id: 2, auto: true, sourceType: 'sale', sourceId: 99, amount: 700000, desc: 'Sotuv' }],
  };
  assert.ok(codes(st).includes('orphan-auto-row'));
});

test('manfiy kassa qoldig\'i ogohlantirish beradi', () => {
  const st = { totalCashBalance: -120000 };
  const f = auditState(st).find(x => x.code === 'negative-balance');
  assert.ok(f);
  assert.strictEqual(f.level, 'ogoh');
});

test('bazada yo\'q mijoz ogohlantirish beradi', () => {
  const st = {
    debtRows: [{ id: 1, customer: 'Notanish aka', amount: 100, paid: 0, payments: [] }],
    customers: [],
  };
  assert.ok(codes(st).includes('unknown-customer'));
});

test('mijoz nomi boshqacha yozilgan bo\'lsa ham tanilaadi (registr/probel)', () => {
  const st = {
    debtRows: [{ id: 1, customer: '  ALI  aka ', amount: 100, paid: 0, payments: [] }],
    customers: [{ id: 5, name: 'Ali aka' }],
  };
  assert.ok(!codes(st).includes('unknown-customer'));
});

test('yetkazib beruvchiga ortiqcha to\'lov ogohlantirish beradi', () => {
  const st = {
    recvRows: [{ id: 1, source: 'Zavod', tons: 10, pricePerTon: 100000, pending: false }],
    supplierPayments: [{ id: 2, supplier: 'Zavod', amount: 1500000 }],
  };
  assert.ok(codes(st).includes('supplier-overpaid'));
});

test('bazadagi takrorlangan mijoz nomi topiladi', () => {
  const st = {
    customers: [
      { id: 1, name: 'Ali aka' },
      { id: 2, name: '  ALI  aka ' },   // normallashtirilganda bir xil
      { id: 3, name: 'Vali' },
    ],
  };
  const f = auditState(st).find(x => x.code === 'duplicate-customer');
  assert.ok(f, 'dublikat topilishi kerak');
  assert.strictEqual(f.level, 'ogoh');
  assert.ok(f.detail[0].includes('2 ta'));
});

test('har xil nomli mijozlar dublikat sanalmaydi', () => {
  const st = { customers: [{ id: 1, name: 'Ali aka' }, { id: 2, name: 'Ali aka (Chirchiq)' }] };
  assert.ok(!codes(st).includes('duplicate-customer'));
});

// ── Olingan tonna (sement oqimi) ─────────────────────────────────────────────

test('yukdan kelganidan ko\'p sement chiqarilsa topiladi', () => {
  const st = {
    recvRows:  [{ id: 1, source: 'Zavod', vehicleNo: '01A', tons: 50 }],
    salesRows: [{ id: 10, recvId: 1, tons: 30 }, { id: 11, recvId: 1, tons: 25 }], // 55 > 50
  };
  const f = auditState(st).find(x => x.code === 'recv-over-used');
  assert.ok(f, 'ortiqcha sarf topilishi kerak');
  assert.strictEqual(f.level, 'xato');
});

test('sotuv + sklad birgalikda yukdan oshsa topiladi', () => {
  const st = {
    recvRows:  [{ id: 1, source: 'Zavod', tons: 50 }],
    salesRows: [{ id: 10, recvId: 1, tons: 30 }],
    skladRows: [{ id: 20, type: 'kirim', sourceId: 1, kg: 25000 }],  // 25 tn
  };
  assert.ok(codes(st).includes('recv-over-used'));
});

test('yuk to\'liq taqsimlansa xato yo\'q', () => {
  const st = {
    recvRows:  [{ id: 1, source: 'Zavod', tons: 50 }],
    salesRows: [{ id: 10, recvId: 1, tons: 30 }],
    skladRows: [{ id: 20, type: 'kirim', sourceId: 1, kg: 20000 }],  // 30 + 20 = 50
  };
  assert.ok(!codes(st).includes('recv-over-used'));
});

test('sklad CHIQIMI yuk sarfiga qo\'shilmaydi', () => {
  // Skladdan sotuv (type: 'chiqim') yukka emas, sklad qoldig'iga tegishli
  const st = {
    recvRows:  [{ id: 1, source: 'Zavod', tons: 50 }],
    skladRows: [
      { id: 20, type: 'kirim',  sourceId: 1, kg: 50000 },
      { id: 21, type: 'chiqim', customer: 'Ali', kg: -10000 },
    ],
  };
  assert.ok(!codes(st).includes('recv-over-used'));
});

test('tasdiqlanmagan yukdan sotuv ogohlantirish beradi', () => {
  const st = {
    recvRows:  [{ id: 1, source: 'Zavod', tons: 50, pending: true }],
    salesRows: [{ id: 10, recvId: 1, tons: 10 }],
  };
  const f = auditState(st).find(x => x.code === 'pending-recv-sold');
  assert.ok(f);
  assert.strictEqual(f.level, 'ogoh');
});

test("o'tkazma juftligi muvozanatda bo'lsa xato yo'q", () => {
  const st = {
    bankRows:  [{ id: 1, transferId: 'tr1', amount: -1000000, desc: '↔️ Bank→Naqd' }],
    cashRows:  [{ id: 2, transferId: 'tr1', amount:  1000000, desc: '↔️ Bank→Naqd' }],
    totalCashBalance: 1000000,
  };
  assert.ok(!codes(st).includes('transfer-unbalanced'));
});

test("o'tkazmaning bir tomoni o'zgartirilsa topiladi", () => {
  // Naqddagi kirim 2 mln ga oshirilgan — 1 mln yo'qdan paydo bo'ldi
  const st = {
    bankRows: [{ id: 1, transferId: 'tr1', amount: -1000000, desc: '↔️ Bank→Naqd' }],
    cashRows: [{ id: 2, transferId: 'tr1', amount:  2000000, desc: '↔️ Bank→Naqd' }],
    totalCashBalance: 2000000,
  };
  const f = auditState(st).find(x => x.code === 'transfer-unbalanced');
  assert.ok(f, 'muvozanat buzilishi topilishi kerak');
  assert.strictEqual(f.level, 'xato');
});

test("o'tkazmaning bir tomoni o'chirilsa topiladi", () => {
  const st = {
    cashRows: [{ id: 2, transferId: 'tr1', amount: 1000000, desc: '↔️ Bank→Naqd' }],
    totalCashBalance: 1000000,
  };
  assert.ok(codes(st).includes('transfer-unbalanced'));
});

test('buzuq sana topiladi (Excel seriya raqami va 2 xonali yil)', () => {
  const st = {
    cashRows: [
      { id: 1, date: '46209', amount: 100 },       // Excel seriya raqami
      { id: 2, date: '23.06.26', amount: 100 },    // 2 xonali yil → 1926
      { id: 3, date: '23.06.2026', amount: 100 },  // to'g'ri
    ],
  };
  const f = auditState(st).find(x => x.code === 'bad-date');
  assert.ok(f, 'buzuq sana topilishi kerak');
  assert.ok(f.detail[0].includes('2 ta'), 'aynan 2 ta buzuq sana');
});

test('sanasi bo\'sh yozuv buzuq deb hisoblanmaydi', () => {
  const st = { cashRows: [{ id: 1, amount: 100 }, { id: 2, date: '', amount: 50 }] };
  assert.ok(!codes(st).includes('bad-date'));
});

test('1 so\'mgacha yaxlitlash farqi xato deb hisoblanmaydi', () => {
  const st = {
    debtRows: [{ id: 1, customer: 'A', amount: 1000, paid: 400.4, payments: [{ id: 9, amount: 400 }] }],
    customers: [{ id: 1, name: 'A' }],
  };
  assert.ok(!codes(st).includes('debt-paid-mismatch'));
});
