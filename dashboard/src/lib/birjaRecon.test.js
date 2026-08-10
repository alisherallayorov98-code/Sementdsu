import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcile, ticketKey, ticketFromCard } from './birjaRecon.js';

test('tiket kaliti: probel, chiziqcha va kirill harflar farq qilmaydi', () => {
  assert.equal(ticketKey('A-26007338'), ticketKey('a 26007338'));
  assert.equal(ticketKey('А26007338'), ticketKey('A26007338')); // kirill А
  assert.equal(ticketKey('  a26007338  '), 'A26007338');
  assert.equal(ticketKey(null), '');
});

test('teng bo‘lsa tiket yopishga tayyor', () => {
  const { rows } = reconcile(
    [{ ticket: 'A1', tons: 100, summa: 55000000 }],
    [{ contractNo: 'a-1', tons: 60 }, { contractNo: 'A 1', tons: 40 }],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'teng');
  assert.equal(rows[0].canClose, true);
  assert.equal(rows[0].zavodTons, 100);
});

test('zavod kam yuborsa farq manfiy va status "kam"', () => {
  const { rows, totals } = reconcile(
    [{ ticket: 'A1', tons: 100 }],
    [{ contractNo: 'A1', tons: 85 }],
  );
  assert.equal(rows[0].status, 'kam');
  assert.equal(rows[0].diff, -15);
  assert.equal(totals.farqli, 1);
});

test('zavod ortiq yuborsa status "ortiq"', () => {
  const { rows } = reconcile([{ ticket: 'A1', tons: 100 }], [{ contractNo: 'A1', tons: 112 }]);
  assert.equal(rows[0].status, 'ortiq');
  assert.equal(rows[0].diff, 12);
});

test('yuk kelmagan va birjada yo‘q holatlar ajratiladi', () => {
  const { rows } = reconcile(
    [{ ticket: 'A1', tons: 100 }],
    [{ contractNo: 'B2', tons: 50 }],
  );
  const a1 = rows.find(r => r.key === 'A1');
  const b2 = rows.find(r => r.key === 'B2');
  assert.equal(a1.status, 'zavod_yoq');
  assert.equal(b2.status, 'birja_yoq');
});

test('tiket raqami yozilmagan yuk solishtiruvga kirmaydi', () => {
  const { rows } = reconcile(
    [{ ticket: 'A1', tons: 100 }],
    [{ contractNo: '', tons: 40 }, { contractNo: null, tons: 10 }, { contractNo: 'A1', tons: 100 }],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].zavodTons, 100);
  assert.equal(rows[0].status, 'teng');
});

test('yaxlitlash qoldig‘i (0.005 tn) farq deb hisoblanmaydi', () => {
  const { rows } = reconcile([{ ticket: 'A1', tons: 49.6 }], [{ contractNo: 'A1', tons: 49.605 }]);
  assert.equal(rows[0].status, 'teng');
});

test('tasdiqlanmagan yuk alohida sanaladi', () => {
  const { rows } = reconcile(
    [{ ticket: 'A1', tons: 100 }],
    [{ contractNo: 'A1', tons: 60 }, { contractNo: 'A1', tons: 40, pending: true }],
  );
  assert.equal(rows[0].pendingTons, 40);
  assert.equal(rows[0].zavodTons, 100);
});

test('yopilgan tiket belgilanadi va jamida ajratiladi', () => {
  const { rows, totals } = reconcile(
    [{ ticket: 'A1', tons: 100 }],
    [{ contractNo: 'A1', tons: 100 }],
    [{ ticket: 'a-1' }],
  );
  assert.equal(rows[0].closed, true);
  assert.equal(totals.yopilgan, 1);
  assert.equal(totals.ochiq, 0);
});

test('summa birja qatoridan yoki tonna×narx dan hisoblanadi', () => {
  const { totals } = reconcile(
    [{ ticket: 'A1', tons: 10, price: 500000 }, { ticket: 'A2', tons: 5, summa: 3000000 }],
    [],
  );
  assert.equal(totals.birjaSumma, 5000000 + 3000000);
});

test('tiket "Karta nomi" ichidan ajratib olinadi', () => {
  assert.equal(ticketFromCard('A26010163 (7)'), 'A26010163');
  assert.equal(ticketFromCard('B26010120 (1101)'), 'B26010120');
  assert.equal(ticketFromCard('А26010163'), 'А26010163'); // kirill — ticketKey normallashtiradi
  assert.equal(ticketFromCard('A-26010163 (7)'), 'A26010163');
  assert.equal(ticketFromCard('naqd'), '');   // raqamsiz matn
  assert.equal(ticketFromCard(''), '');
  assert.equal(ticketFromCard(null), '');
});

test('contractNo bo‘sh bo‘lsa solishtiruv karta nomidagi tiketni ishlatadi', () => {
  const { rows } = reconcile(
    [{ ticket: 'A26010163', tons: 20, summa: 12400000 }],
    [{ contractNo: '', cardName: 'A26010163 (7)', tons: 20 }],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'teng');
  assert.equal(rows[0].zavodTons, 20);
});
