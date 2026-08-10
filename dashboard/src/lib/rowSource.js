// ─────────────────────────────────────────────────────────────────────────────
// "Bu yozuv qayerdan keldi?" — yozuvning MANBA ZANJIRINI quradi.
//
// Mijoz kartochkasida yoki akt sverkada ko'ringan bitta qator ko'pincha
// avtomatik yaratilgan bo'ladi: qarz — sotuvdan, sotuv — zavoddan olingan
// yukdan. Xato topilganda esa aynan ZANJIRNING BOSHIDAGI yozuvni tuzatish
// kerak (qarzni qo'lda o'zgartirish emas — u baribir qayta yaratiladi).
//
// Bu yerda faqat sof mantiq: React yo'q, shuning uchun testlash oson.
// ─────────────────────────────────────────────────────────────────────────────

const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const fmt = (n) => num(n).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => { const v = num(n); return v % 1 === 0 ? String(v) : v.toFixed(2); };

// Timestamp → "dd.mm.yyyy HH:MM" (yozuv AYNAN qachon kiritilgani)
export const fmtCreated = (ts) => {
  const t = Number(ts);
  if (!t || t < 1e10) return null;
  const d = new Date(t);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// Har bir tur uchun: sarlavha, ikonka va (bo'lsa) qaysi bo'limda ko'rinadi.
// route null bo'lsa — bu yozuvni ko'rsatadigan alohida ro'yxat yo'q
// (masalan ulgurji sotuv), u holda oynaning o'zida tahrirlanadi.
const KIND = {
  sale:    { icon: '🛒', title: 'Ulgurji sotuv',            route: null,            section: 'Sotuv (taqsimot / birdan sotish)' },
  sold:    { icon: '📦', title: 'Sotilgan tonna (eski)',    route: '/sold_tons',    section: 'Sotilgan tonna' },
  sklad:   { icon: '🏗', title: 'Chakana sotuv (sklad)',    route: '/kassir',       section: 'Kassir — chakana sotuv' },
  recv:    { icon: '🚚', title: 'Zavoddan olingan yuk',     route: '/recv_tons',    section: 'Olingan tonna' },
  debt:    { icon: '⚠️', title: 'Qarz yozuvi',              route: '/debts',        section: 'Qarzlar' },
  advance: { icon: '🅰️', title: 'Avans (oldindan to\'lov)', route: '/advances',     section: 'Avanslar' },
  cash:    { icon: '💵', title: 'Kassa yozuvi (naqd)',      route: '/kassir',       section: 'Kassir' },
  bank:    { icon: '🏦', title: 'Bank yozuvi',              route: '/income_bank',  section: 'Bank kirim/chiqim' },
  click:   { icon: '📱', title: 'Click yozuvi',             route: '/income_click', section: 'Click' },
};

export const kindMeta = (kind) => KIND[kind] || { icon: '📄', title: 'Yozuv', route: null, section: '—' };

// Yozuvning ko'rsatiladigan maydonlari (tur bo'yicha)
export function rowFields(kind, row) {
  if (!row) return [];
  const F = [];
  const add = (label, value) => { if (value !== undefined && value !== null && value !== '') F.push({ label, value }); };

  add('Sana', row.date);
  const created = fmtCreated(row.createdAt || row.id);
  if (created) add('Kiritilgan vaqt', created);
  add('Kim kiritdi', row.worker);

  if (kind === 'sale' || kind === 'sold') {
    add('Mijoz', row.customer);
    add('Tonna', `${fmtT(row.tons)} tn`);
    add('Narx (1 tn)', `${fmt(row.pricePerTon)} so'm`);
    add('Summa', `${fmt(num(row.tons) * num(row.pricePerTon))} so'm`);
    add("To'lov turi", row.paymentChannel);
    if (num(row.advanceUsed) > 0) add('Avansdan yechilgan', `${fmt(row.advanceUsed)} so'm`);
    add('Izoh', row.note || row.izoh);
    add('Mashina №', row.vehicleNo);
    add('Zavod vaqti', row.factoryTime);
  } else if (kind === 'sklad') {
    add('Mijoz', row.customer);
    add('Miqdor', `${fmt(Math.abs(num(row.kg)))} kg`);
    add('Narx (1 kg)', `${fmt(row.pricePerKg)} so'm`);
    add('Summa', `${fmt(row.amount)} so'm`);
    add("To'lov turi", row.channel);
    add('Sement turi', row.cementType);
    add('Izoh', row.note);
  } else if (kind === 'recv') {
    add('Zavod / manba', row.source);
    add('Marka', row.brand);
    add('Sement turi', row.cementType);
    add('Mashina №', row.vehicleNo);
    add('Tonna', `${fmtT(row.tons)} tn`);
    add('Olish narxi (1 tn)', `${fmt(row.pricePerTon)} so'm`);
    add('Summa', `${fmt(num(row.tons) * num(row.pricePerTon))} so'm`);
    add('Zavod vaqti', row.factoryTime);
  } else if (kind === 'debt') {
    add('Mijoz', row.customer);
    add('Qarz summasi', `${fmt(row.amount)} so'm`);
    add("To'langan", `${fmt(row.paid)} so'm`);
    add('Qoldiq', `${fmt(Math.max(0, num(row.amount) - num(row.paid)))} so'm`);
    add("To'lovlar soni", (row.payments || []).length || undefined);
    add('Zavod vaqti', row.factoryTime);
    add('Izoh', row.note);
  } else if (kind === 'advance') {
    add('Mijoz', row.customer);
    add('Avans summasi', `${fmt(row.amount)} so'm`);
    add('Ishlatilgan', `${fmt(row.used)} so'm`);
    add('Qoldiq', `${fmt(Math.max(0, num(row.amount) - num(row.used)))} so'm`);
    add('Kanal', row.channel);
    add('Izoh', row.note);
  } else {
    add('Summa', `${fmt(row.amount)} so'm`);
    add('Izoh', typeof row.desc === 'object' ? row.desc.latn : row.desc);
    add('Mijoz', row.customer);
  }
  return F;
}

// ── Manba zanjiri ────────────────────────────────────────────────────────────
// Berilgan yozuvdan ORQAGA yurib, uni tug'dirgan yozuvlarni topadi.
// Natija: [{ kind, row, why }] — birinchisi eng "chuqur" manba emas, aksincha
// zanjir tartibida: [joriy, ota, bobo...]
export function sourceChain(kind, row, data) {
  const { salesRows = [], soldRows = [], skladRows = [], recvRows = [], advanceRows = [] } = data || {};
  const chain = [{ kind, row, why: null }];
  const seen = new Set([`${kind}:${row?.id}`]);

  let curKind = kind, cur = row;
  // Zanjir uzun bo'lmaydi (qarz → sotuv → yuk), lekin xalqadan himoya qilamiz
  for (let step = 0; step < 5 && cur; step++) {
    let next = null, nextKind = null, why = null;

    if (curKind === 'debt' || curKind === 'cash' || curKind === 'bank' || curKind === 'click') {
      // Avtomatik yozuv — uni yaratgan hujjatga o'tamiz
      if (cur.auto && cur.sourceId != null) {
        if (cur.sourceType === 'sale')        { next = salesRows.find(r => r.id === cur.sourceId);   nextKind = 'sale';    why = 'Bu yozuv shu sotuvdan avtomatik yaratilgan'; }
        else if (cur.sourceType === 'sold')   { next = soldRows.find(r => r.id === cur.sourceId);    nextKind = 'sold';    why = 'Bu yozuv shu sotuvdan avtomatik yaratilgan'; }
        else if (cur.sourceType === 'sklad_sale') { next = skladRows.find(r => r.id === cur.sourceId); nextKind = 'sklad'; why = 'Bu yozuv shu chakana sotuvdan avtomatik yaratilgan'; }
        else if (cur.sourceType === 'advance'){ next = advanceRows.find(r => r.id === cur.sourceId); nextKind = 'advance'; why = 'Bu kassa kirimi shu avansdan yaratilgan'; }
        else if (cur.sourceType === 'recv')   { next = recvRows.find(r => r.id === cur.sourceId);    nextKind = 'recv';    why = 'Bu yozuv zavoddan olingan shu yukdan yaratilgan'; }
      }
    } else if (curKind === 'sale') {
      // Ulgurji sotuv zavoddan olingan yukdan qilingan bo'lishi mumkin
      if (cur.recvId != null) { next = recvRows.find(r => r.id === cur.recvId); nextKind = 'recv'; why = 'Bu sotuv zavoddan olingan shu yukdan qilingan'; }
    } else if (curKind === 'sklad') {
      if (cur.sourceId != null && cur.type === 'kirim') { next = recvRows.find(r => r.id === cur.sourceId); nextKind = 'recv'; why = 'Skladga shu yukdan kirim qilingan'; }
    }

    if (!next) break;
    const key = `${nextKind}:${next.id}`;
    if (seen.has(key)) break;
    seen.add(key);
    chain.push({ kind: nextKind, row: next, why });
    curKind = nextKind; cur = next;
  }
  return chain;
}

// ── Bu yozuvdan KELIB CHIQQANLAR (oldinga) ───────────────────────────────────
// Masalan: avans → qaysi sotuvlarga ishlatilgan; sotuv → qaysi qarz/kassa
// yozuvini tug'dirgan. "Tuzatsam nima o'zgaradi?" savoliga javob beradi.
export function derivedRows(kind, row, data) {
  const { salesRows = [], soldRows = [], skladRows = [], debtRows = [],
          cashRows = [], bankRows = [], clickRows = [] } = data || {};
  const out = [];
  if (!row) return out;

  if (kind === 'advance') {
    for (const u of (row.usages || [])) {
      const s = salesRows.find(r => r.id === u.saleId) || soldRows.find(r => r.id === u.saleId) || skladRows.find(r => r.id === u.saleId);
      out.push({
        kind: s ? (salesRows.includes(s) ? 'sale' : soldRows.includes(s) ? 'sold' : 'sklad') : null,
        row: s || null,
        label: `${u.date || '—'} · ${fmt(u.amount)} so'm ishlatildi`,
        note: s ? null : "Bog'langan sotuv topilmadi (o'chirilgan bo'lishi mumkin)",
      });
    }
    return out;
  }

  const st = kind === 'sale' ? 'sale' : kind === 'sold' ? 'sold' : kind === 'sklad' ? 'sklad_sale' : null;
  if (!st) return out;
  const mine = (rows, k) => rows.filter(r => r.auto && r.sourceType === st && r.sourceId === row.id)
    .map(r => ({ kind: k, row: r, label: `${r.date || '—'} · ${fmt(r.amount)} so'm`, note: null }));
  out.push(...mine(debtRows, 'debt'));
  out.push(...mine(cashRows, 'cash'));
  out.push(...mine(bankRows, 'bank'));
  out.push(...mine(clickRows, 'click'));
  return out;
}

// Qaysi yozuvni tahrirlash kerakligi haqidagi maslahat.
// Avtomatik yozuvni qo'lda tuzatish mumkin emas — u manbadan qayta yaratiladi.
export function editHint(kind, row) {
  if (!row) return null;
  if (row.auto) {
    return "Bu yozuv AVTOMATIK yaratilgan — uni bevosita tahrirlab bo'lmaydi. " +
           "Pastdagi manba yozuvini tuzating: qarz/kassa yozuvi o'sha manbadan qayta hisoblanadi.";
  }
  if (kind === 'debt') {
    return num(row.paid) > 0
      ? "Bu qarzga to'lov qayd etilgan — avval to'lovni bekor qiling, keyin tuzating."
      : "Qo'lda kiritilgan qarz — Qarzlar bo'limidan tuzatiladi.";
  }
  return null;
}
