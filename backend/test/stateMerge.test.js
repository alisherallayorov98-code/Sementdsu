// ─────────────────────────────────────────────────────────────────────────────
// Bir vaqtda ishlash to'qnashuvi — birlashtirish testlari.
// Ishga tushirish:  cd backend && npm test
//
// Har bir test real ssenariyni takrorlaydi: ikki xodim bir vaqtda ishlaydi,
// ikkinchisining nusxasida birinchisining ishi yo'q. Asosiy talab — PUL
// YO'QOLMASLIGI va qarz/kassa muvozanati buzilmasligi.
// ─────────────────────────────────────────────────────────────────────────────
const test = require('node:test');
const assert = require('node:assert');
const { mergeStates, mergeTombstones } = require('../src/services/stateMerge');

const sumPaid = (rows) => rows.reduce((s, r) => s + Number(r.paid || 0), 0);

test("boshqa xodim qo'shgan sotuv yo'qolmaydi", () => {
  const server = { sales_rows: [{ id: 1, tons: 5 }, { id: 2, tons: 3 }] };
  const client = { sales_rows: [{ id: 1, tons: 5 }, { id: 3, tons: 7 }] };
  const out = mergeStates(server, client, []);
  assert.deepStrictEqual(out.sales_rows.map(r => r.id).sort(), [1, 2, 3]);
});

test("BITTA qarzga ikki xodim to'lov qilsa, ikkala to'lov ham saqlanadi", () => {
  // A 1 mln to'ladi (serverga yozdi), B ayni paytda 2 mln to'ladi.
  // B ning nusxasida A ning to'lovi yo'q.
  const server = {
    debt_rows: [{
      id: 10, amount: 5000000, paid: 1000000,
      payments: [{ id: 101, amount: 1000000 }],
    }],
  };
  const client = {
    debt_rows: [{
      id: 10, amount: 5000000, paid: 2000000,
      payments: [{ id: 102, amount: 2000000 }],
    }],
  };
  const out = mergeStates(server, client, []);
  const row = out.debt_rows[0];

  assert.strictEqual(row.payments.length, 2, "ikkala to'lov ham qatorda bo'lishi kerak");
  assert.strictEqual(row.paid, 3000000, "paid = to'lovlar yig'indisi");
  // Kassa yozuvlari alohida id bilan qo'shiladi — ular ham saqlanadi va
  // qarzdagi summa bilan mos keladi (aks holda pul egasiz qolardi).
});

test("avans sarfi ikki tomondan birlashadi", () => {
  const server = { advance_rows: [{ id: 20, amount: 900000, used: 300000, usages: [{ id: 201, amount: 300000 }] }] };
  const client = { advance_rows: [{ id: 20, amount: 900000, used: 400000, usages: [{ id: 202, amount: 400000 }] }] };
  const out = mergeStates(server, client, []);
  assert.strictEqual(out.advance_rows[0].used, 700000);
  assert.strictEqual(out.advance_rows[0].usages.length, 2);
});

test("xodim oyligi: workers.paid to'lovlardan qayta hisoblanadi", () => {
  const server = {
    workers: [{ id: 5, name: 'Ali', salary: 3000000, paid: 1000000 }],
    salary_payments: [{ id: 501, workerId: 5, amount: 1000000 }],
  };
  const client = {
    workers: [{ id: 5, name: 'Ali', salary: 3000000, paid: 500000 }],
    salary_payments: [{ id: 502, workerId: 5, amount: 500000 }],
  };
  const out = mergeStates(server, client, []);
  assert.strictEqual(out.salary_payments.length, 2);
  assert.strictEqual(out.workers[0].paid, 1500000, 'ikkala to\'lov yig\'indisi');
});

test("o'chirilgan yozuv birlashtirish orqali QAYTA TIRILMAYDI", () => {
  const server = { cash_rows: [{ id: 1, amount: 100 }, { id: 2, amount: 200 }] };
  const client = { cash_rows: [{ id: 1, amount: 100 }] };   // 2-qator o'chirildi
  const tombs  = [{ key: 'cash_rows', id: 2, at: Date.now() }];
  const out = mergeStates(server, client, tombs);
  assert.deepStrictEqual(out.cash_rows.map(r => r.id), [1]);
});

test("tombstone bo'lmasa, clientda yo'q qator saqlanib qoladi (eski xatti-harakat)", () => {
  // Bu ataylab shunday: tombstone'siz "yo'q" degani "boshqa xodim qo'shgan,
  // men hali ko'rmadim" bo'lishi mumkin — yo'qotgandan ko'ra saqlagan yaxshi.
  const server = { cash_rows: [{ id: 1 }, { id: 2 }] };
  const client = { cash_rows: [{ id: 1 }] };
  const out = mergeStates(server, client, []);
  assert.deepStrictEqual(out.cash_rows.map(r => r.id).sort(), [1, 2]);
});

test("o'chirilgan qator boshqa bo'limdagi bir xil id ga ta'sir qilmaydi", () => {
  const server = { cash_rows: [{ id: 7 }], bank_rows: [{ id: 7 }] };
  const client = { cash_rows: [],          bank_rows: [] };
  const tombs  = [{ key: 'cash_rows', id: 7, at: Date.now() }];
  const out = mergeStates(server, client, tombs);
  assert.deepStrictEqual(out.cash_rows, [], 'kassadan o\'chirilgan');
  assert.deepStrictEqual(out.bank_rows.map(r => r.id), [7], 'bank tegilmaydi');
});

test("clientda umuman yo'q bo'lim serverdan saqlanadi", () => {
  const server = { tickets: [{ id: 1, usedTonna: 5 }] };
  const client = { cash_rows: [] };
  const out = mergeStates(server, client, []);
  assert.deepStrictEqual(out.tickets, [{ id: 1, usedTonna: 5 }]);
});

test("to'lov ro'yxati o'zgarmagan bo'lsa paid tegilmaydi", () => {
  // Import qilingan qarzda payments bo'sh, paid 0 — qayta hisoblash uni buzmasin.
  const server = { debt_rows: [{ id: 1, amount: 500, paid: 0, payments: [] }] };
  const client = { debt_rows: [{ id: 1, amount: 500, paid: 0, payments: [] }] };
  const out = mergeStates(server, client, []);
  assert.strictEqual(out.debt_rows[0].paid, 0);
});

test('eski tombstone (30 kundan oshgan) tashlab yuboriladi', () => {
  const now = Date.now();
  const old = [{ key: 'cash_rows', id: 1, at: now - 31 * 24 * 3600 * 1000 }];
  const fresh = [{ key: 'cash_rows', id: 2, at: now }];
  const out = mergeTombstones(old, fresh, now);
  assert.deepStrictEqual(out.map(t => t.id), [2]);
});

test("uch xodim ketma-ket: hech kimning to'lovi yo'qolmaydi", () => {
  // Boshlang'ich: qarz 9 mln, to'lovsiz
  let serverState = { debt_rows: [{ id: 1, amount: 9000000, paid: 0, payments: [] }] };
  const base = JSON.parse(JSON.stringify(serverState));

  // Uchalasi ham AYNI base nusxadan boshlaydi (bir vaqtda ochishgan)
  const mk = (payId, amount) => ({
    debt_rows: [{ ...base.debt_rows[0], paid: amount, payments: [{ id: payId, amount }] }],
  });

  for (const c of [mk(11, 1000000), mk(12, 2000000), mk(13, 3000000)]) {
    serverState = mergeStates(serverState, c, []);
  }

  const row = serverState.debt_rows[0];
  assert.strictEqual(row.payments.length, 3, "uchala to'lov ham saqlanishi kerak");
  assert.strictEqual(sumPaid(serverState.debt_rows), 6000000);
  assert.strictEqual(row.paid, 6000000);
});

test('marka → tur jadvali kalitlar bo\'yicha birlashadi', () => {
  // Ikki qurilmada har xil marka biriktirilsa, ikkalasi ham saqlanishi kerak:
  // butunlay ustiga yozilsa, boshqa xodim qo'shgan biriktirish yo'qolardi.
  const server = { brand_type_map: { a: '450 Qoplik', b: '550 Qoplik' } };
  const client = { brand_type_map: { b: '550 Rasipnoy', c: 'Sulfatsement' } };
  const out = mergeStates(server, client, []);
  assert.deepStrictEqual(out.brand_type_map, {
    a: '450 Qoplik',        // faqat serverda bor — saqlanadi
    b: '550 Rasipnoy',      // to'qnashuvda client g'olib
    c: 'Sulfatsement',      // faqat clientda bor
  });
});

test("boshqa obyekt bo'limlar birlashtirilmaydi (client g'olib)", () => {
  const server = { app_settings: { themeColor: 'red', x: 1 } };
  const client = { app_settings: { themeColor: 'blue' } };
  const out = mergeStates(server, client, []);
  assert.deepStrictEqual(out.app_settings, { themeColor: 'blue' });
});
