// ─────────────────────────────────────────────────────────────────────────────
// ZAVOD MARKASI → SEMENT TURI.
//
// Bitta sement dasturda IKKI xil nomlanadi:
//   · zavod markasi (recvRow.brand)  — "32.5H包装-меш", "42.5B-K散装-рос" …
//   · ichki tur     (cementType)     — "450 Qoplik", "550 Rasipnoy" …
// Ilgari sotuvchi tasdiqlash oynasida ikkinchisini QO'LDA tanlardi: bir xil
// yuk goh "450 Qoplik", goh bo'sh, goh boshqa tur bo'lib tushardi va sklad
// qoldig'i tur bo'yicha buzilardi.
//
// Endi moslik jadval bilan belgilanadi (Sozlamalar → Sement turlari), tur esa
// markadan AVTOMAT to'ladi. Jadvalda yo'q marka uchun taxmin qilinadi
// (quyidagi guessType) va sotuvchi tasdiqlagan tanlov jadvalga yoziladi —
// keyingi safar so'ralmaydi.
//
// React yo'q: sof mantiq, testlanadi.
// ─────────────────────────────────────────────────────────────────────────────

// Marka kaliti: zavod fayllarida bir xil marka goh probel, goh chiziqcha,
// goh boshqa registr bilan keladi ("32.5H 包装-меш" / "32.5h包装 - меш").
// Kalitga aylantirishda ular farq qilmasligi kerak, aks holda bitta marka
// jadvalda uch marta paydo bo'lardi.
export const brandKey = (s) => String(s || '')
  .toLowerCase()
  .replace(/[\s\-_·.,/\\]+/g, '')
  .trim();

// Zavod nomlashidagi belgilar (xitoycha + ruscha qisqartma bir xil ma'noda
// keladi, ba'zi fayllarda faqat bittasi bo'ladi):
//   包装 / меш        → qoplik (qopda)
//   散装 / рос        → rasipnoy (bo'sh, quyma)
//   抗硫 / сул        → sulfatga chidamli
//   42.5 / 32.5       → mustahkamlik sinfi
const has = (k, ...needles) => needles.some(n => k.includes(n));

/**
 * Jadvalda yo'q marka uchun TAXMIN. Faqat taklif sifatida ishlatiladi —
 * sotuvchi tasdiqlash oynasida ko'radi va kerak bo'lsa o'zgartiradi.
 * Mavjud turlar ro'yxatidan mos keladiganini qidiradi, topolmasa '' qaytaradi
 * (yo'qdan yangi tur YARATMAYDI — turlar ro'yxatini faqat admin boshqaradi).
 */
export function guessType(brand, cementTypes = []) {
  const k = brandKey(brand);
  if (!k) return '';
  const sulfat  = has(k, '抗硫', 'сул', 'sul');
  const qoplik  = has(k, '包装', 'меш', 'mesh');
  const rasip   = has(k, '散装', 'рос', 'ros');
  const klass   = has(k, '42.5', '425') ? '550' : has(k, '32.5', '325') ? '450' : '';

  const pick = (fn) => cementTypes.find(t => fn(brandKey(t))) || '';

  if (sulfat) {
    // Sulfat turi qoplik/rasipnoyga bo'lingan bo'lsa — o'shanisi tanlanadi.
    const exact = pick(t => t.includes('sulfat') && ((qoplik && t.includes('qoplik')) || (rasip && t.includes('rasipnoy'))));
    return exact || pick(t => t.includes('sulfat'));
  }
  if (!klass) return '';
  if (qoplik) return pick(t => t.includes(klass) && t.includes('qoplik'));
  if (rasip)  return pick(t => t.includes(klass) && t.includes('rasipnoy'));
  return pick(t => t.includes(klass));
}

/**
 * Marka bo'yicha turni aniqlash.
 * @returns {{ type: string, source: 'map'|'guess'|'' }}
 *   map   — admin biriktirgan (ishonchli)
 *   guess — taxmin (tasdiqlanganda jadvalga yoziladi)
 *   ''    — aniqlanmadi, qo'lda tanlash kerak
 */
export function resolveType(brand, map = {}, cementTypes = []) {
  const k = brandKey(brand);
  if (!k) return { type: '', source: '' };
  const mapped = map[k];
  // Jadvaldagi tur o'chirilgan bo'lsa unga ishonib bo'lmaydi — taxminga tushamiz.
  if (mapped && (!cementTypes.length || cementTypes.includes(mapped))) return { type: mapped, source: 'map' };
  const g = guessType(brand, cementTypes);
  return g ? { type: g, source: 'guess' } : { type: '', source: '' };
}

/** Jadvalga yozish (kalit — normallashtirilgan marka). Bo'sh qiymat o'chiradi. */
export function withBrandType(map = {}, brand, type) {
  const k = brandKey(brand);
  if (!k) return map;
  const next = { ...map };
  if (String(type || '').trim()) next[k] = type;
  else delete next[k];
  return next;
}

/**
 * Yuklardagi barcha markalar ro'yxati — Sozlamalardagi jadval uchun.
 * Har biri: { key, brand (ko'rinishi uchun asl yozuv), count, type, source }.
 * Biriktirilmaganlari birinchi turadi — admin aynan ularni to'ldirishi kerak.
 */
export function brandRows(recvRows = [], map = {}, cementTypes = []) {
  const byKey = new Map();
  for (const r of recvRows) {
    const b = String(r?.brand || '').trim();
    const k = brandKey(b);
    if (!k) continue;
    const cur = byKey.get(k) || { key: k, brand: b, count: 0 };
    cur.count += 1;
    byKey.set(k, cur);
  }
  // Jadvalda bor, lekin hozircha yuk kelmagan markalar ham ko'rinsin.
  for (const k of Object.keys(map)) {
    if (!byKey.has(k)) byKey.set(k, { key: k, brand: k, count: 0 });
  }
  return [...byKey.values()]
    .map(x => ({ ...x, ...resolveType(x.brand, map, cementTypes) }))
    .sort((a, b) => (a.source === 'map') - (b.source === 'map') || b.count - a.count);
}
