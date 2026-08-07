// ─────────────────────────────────────────────────────────────────────────────
// Tashqi manbadan (Excel, matn maydoni) kelgan sonni ishonchli o'qish.
//
// Number("12,5") = NaN — mahalliy Excel kasrni VERGUL bilan, minglarni probel
// (ba'zan uzilmas probel, U+00A0) bilan yozadi. `Number(x) || 0` naqshi bunday
// qiymatni JIMGINA 0 ga aylantirardi: 12 500 000 so'mlik qarz 0 bo'lib
// import bo'lardi.
//
// Vergulni shunchaki O'CHIRIB tashlash ham xato: "1 378 756,50" -> "137875650"
// bo'lib, summa 100 barobar oshib ketardi. Vergul nuqtaga almashtiriladi.
// ─────────────────────────────────────────────────────────────────────────────
export const parseNum = (v) => {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v ?? '').trim()
    // \s uzilmas probelni (U+00A0) ham qamrab oladi — alohida belgi shart emas.
    .replace(/\s/g, '')
    .replace(',', '.');
  if (!s) return 0;
  const n = Number(s);
  return isFinite(n) ? n : 0;
};
