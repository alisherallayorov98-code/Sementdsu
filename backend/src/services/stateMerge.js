// ─────────────────────────────────────────────────────────────────────────────
// HOLATLARNI BIRLASHTIRISH (bir vaqtda ishlash to'qnashuvi)
//
// Client butun holatni bitta PUT bilan yuboradi. Ikki xodim bir vaqtda ishlasa,
// ikkinchisining nusxasida birinchisining ishi yo'q — ustiga yozilsa yo'qoladi.
// Shuning uchun server versiyasi bilan BIRLASHTIRAMIZ.
//
// Uch qatlamli birlashtirish:
//
//   1) QATOR darajasi — id bo'yicha. Clientda yo'q, serverda bor qator
//      saqlanib qoladi (boshqa xodim qo'shgan sotuv yo'qolmaydi).
//
//   2) QATOR ICHIDAGI RO'YXAT darajasi — to'lovlar (payments) va avans
//      sarflari (usages). Ikki xodim BITTA qarzga to'lov qilsa, qator
//      ikkalasida ham bor — id bo'yicha oxirgi yozgan g'olib bo'lardi va
//      birinchi to'lov YO'QOLARDI. Lekin o'sha to'lovning kassa yozuvi
//      (alohida id bilan) saqlanib qolardi: kassada pul bor, qarzda esa
//      to'lanmagan — balans hech qachon to'g'rilanmaydigan holat.
//      Endi ikkala ro'yxat birlashtiriladi va yig'indi (paid/used) qayta
//      hisoblanadi.
//
//   3) HOSILA maydonlar — workers[].paid oylik to'lovlaridan qayta hisoblanadi
//      (salary_payments alohida massiv bo'lgani uchun xuddi shu xavf bor edi).
//
// O'CHIRISH: birlashtirish "clientda yo'q" qatorni tiklaydi, ya'ni o'chirilgan
// yozuv qaytib kelardi. Buning oldini olish uchun client o'chirilgan id larni
// (tombstone) yuboradi — ro'yxatdagi id hech qachon tiklanmaydi.
// ─────────────────────────────────────────────────────────────────────────────

// Qator ichidagi qaysi ro'yxatlar birlashtiriladi va yig'indisi qayerga yoziladi
const ROW_LISTS = {
  debt_rows:    [{ list: 'payments', sum: 'paid' }],
  advance_rows: [{ list: 'usages',   sum: 'used' }],
};

// Qatorli emas, "kalit → qiymat" ko'rinishidagi bo'limlar: kalitlar bo'yicha
// birlashtiriladi (o'chirish kamdan-kam va qo'lda bo'lgani uchun tombstone
// kerak emas — kalit qayta biriktirilsa client qiymati ustun turadi).
const MERGE_MAPS = new Set(['brand_type_map']);

const TOMBSTONE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 kun

const isRow = (x) => x && typeof x === 'object' && !Array.isArray(x) && x.id !== undefined;

function isRowArray(v) {
  return Array.isArray(v) && v.every(isRow);
}

const isPlainMap = (v) => v && typeof v === 'object' && !Array.isArray(v);

const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };

// Ikki ro'yxatni id bo'yicha birlashtirish. Tartib: avval client, keyin
// serverdagi qo'shimchalar (vaqt bo'yicha saralash chaqiruvchi tomonda).
function mergeById(clientList, serverList) {
  const a = Array.isArray(clientList) ? clientList : [];
  const b = Array.isArray(serverList) ? serverList : [];
  if (!b.length) return a;
  const seen = new Set(a.filter(isRow).map(x => x.id));
  const extra = b.filter(x => isRow(x) && !seen.has(x.id));
  return extra.length ? [...a, ...extra] : a;
}

// Bitta qatorni birlashtirish: client qatori asos, ichidagi ro'yxatlar esa
// server bilan qo'shiladi va yig'indi maydoni qayta hisoblanadi.
function mergeRow(clientRow, serverRow, specs) {
  if (!serverRow || !specs || !specs.length) return clientRow;
  let out = clientRow;
  for (const { list, sum } of specs) {
    const merged = mergeById(clientRow[list], serverRow[list]);
    // Ro'yxat o'zgarmagan bo'lsa qatorga tegmaymiz
    if (merged === clientRow[list] || merged.length === (clientRow[list] || []).length) continue;
    out = { ...out, [list]: merged, [sum]: merged.reduce((s, x) => s + num(x.amount), 0) };
  }
  return out;
}

function mergeRows(serverArr, clientArr, specs, deletedIds) {
  const byServerId = new Map(serverArr.filter(isRow).map(r => [r.id, r]));
  const out = clientArr.map(r => (isRow(r) ? mergeRow(r, byServerId.get(r.id), specs) : r));

  const clientIds = new Set(clientArr.filter(isRow).map(r => r.id));
  const extra = serverArr.filter(r =>
    isRow(r) && !clientIds.has(r.id) && !deletedIds.has(r.id)
  );
  return extra.length ? [...out, ...extra] : out;
}

// workers[].paid — oylik to'lovlaridan hosila. salary_payments birlashtirilgach
// yig'indi ham qayta hisoblanishi kerak, aks holda xodimga to'langan summa
// birlashtirilgan to'lovlar bilan mos kelmay qolardi.
function recomputeWorkerPaid(state) {
  if (!Array.isArray(state.workers) || !Array.isArray(state.salary_payments)) return state;
  const byWorker = new Map();
  for (const p of state.salary_payments) {
    if (!p || p.workerId === undefined) continue;
    byWorker.set(p.workerId, (byWorker.get(p.workerId) || 0) + num(p.amount));
  }
  return {
    ...state,
    workers: state.workers.map(w =>
      byWorker.has(w.id) || w.paid !== undefined ? { ...w, paid: byWorker.get(w.id) || 0 } : w
    ),
  };
}

// O'chirilganlar ro'yxatini yangilash: client yuborganlarini qo'shib,
// eskilarini (30 kundan oshgan) tashlaymiz — ro'yxat cheksiz o'smasin.
function mergeTombstones(oldList, clientList, now = Date.now()) {
  const byKey = new Map();
  const put = (t) => {
    if (!t || t.id === undefined) return;
    const key = `${t.key || ''}:${t.id}`;
    const at = num(t.at) || now;
    if (now - at > TOMBSTONE_TTL) return;
    const prev = byKey.get(key);
    if (!prev || at > prev.at) byKey.set(key, { key: t.key || '', id: t.id, at });
  };
  (Array.isArray(oldList) ? oldList : []).forEach(put);
  (Array.isArray(clientList) ? clientList : []).forEach(put);
  return [...byKey.values()];
}

/**
 * serverState + clientState → birlashtirilgan holat.
 * @param {object[]} tombstones — [{ key, id, at }] o'chirilgan yozuvlar
 */
function mergeStates(serverState, clientState, tombstones = []) {
  const deletedByKey = new Map();
  for (const t of tombstones) {
    if (!t || t.id === undefined) continue;
    const k = t.key || '';
    if (!deletedByKey.has(k)) deletedByKey.set(k, new Set());
    deletedByKey.get(k).add(t.id);
  }
  const emptySet = new Set();

  let out = { ...clientState };
  for (const [key, clientVal] of Object.entries(clientState)) {
    const serverVal = serverState[key];
    if (isRowArray(clientVal) && isRowArray(serverVal)) {
      out[key] = mergeRows(serverVal, clientVal, ROW_LISTS[key], deletedByKey.get(key) || emptySet);
    } else if (MERGE_MAPS.has(key) && isPlainMap(clientVal) && isPlainMap(serverVal)) {
      // "kalit → qiymat" jadvallari (masalan marka → sement turi): butunlay
      // ustiga yozilsa, boshqa qurilmada qo'shilgan biriktirish YO'QOLARDI.
      // Kalitlar birlashtiriladi, to'qnashuvda client qiymati g'olib.
      out[key] = { ...serverVal, ...clientVal };
    }
  }
  // Clientda umuman yo'q bo'limlar serverdan saqlanib qoladi
  for (const [key, serverVal] of Object.entries(serverState)) {
    if (out[key] === undefined) out[key] = serverVal;
  }
  return recomputeWorkerPaid(out);
}

module.exports = { mergeStates, mergeTombstones, mergeById, TOMBSTONE_TTL };
