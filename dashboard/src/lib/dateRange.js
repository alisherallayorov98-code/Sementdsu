// Sana oralig'i (dan–gacha) filtri uchun yordamchilar.
// Yozuvlarning sanasi ru-RU formatida saqlanadi: "kk.oo.yyyy" (masalan 23.06.2026).
// Filter qiymati esa HTML <input type="date"> formatida: "yyyy-oo-kk".

// "kk.oo.yyyy" → millisekund (xato bo'lsa NaN)
export const parseRu = (s) => {
  if (!s) return NaN;
  const parts = String(s).split('.');
  if (parts.length !== 3) return NaN;
  const [d, m, y] = parts.map(Number);
  if (!y || !m || !d) return NaN;
  return new Date(y, m - 1, d).getTime();
};

// Bo'sh oraliq (na from, na to) — filter o'chiq deb hisoblanadi
export const isEmptyRange = (range) => !range || (!range.from && !range.to);

// Yozuv sanasi ("kk.oo.yyyy") tanlangan oraliqqa ("yyyy-oo-kk") tushadimi?
// Sanasi noma'lum yozuvni yashirmaymiz (true qaytaramiz).
export const inRange = (rowDate, range) => {
  if (isEmptyRange(range)) return true;
  const t = parseRu(rowDate);
  if (Number.isNaN(t)) return true;
  if (range.from) {
    const f = new Date(range.from + 'T00:00:00').getTime();
    if (t < f) return false;
  }
  if (range.to) {
    const e = new Date(range.to + 'T23:59:59').getTime();
    if (t > e) return false;
  }
  return true;
};

// Massivni sana oralig'i bo'yicha filtrlash. getDate — yozuvdan sanani oluvchi.
export const filterByRange = (rows, range, getDate = (r) => r.date) =>
  isEmptyRange(range) ? rows : rows.filter((r) => inRange(getDate(r), range));

// Bugungi sana ISO formatida ("yyyy-oo-kk")
export const todayISO = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
};

// Bugundan N kun oldingi sana ISO formatida
export const daysAgoISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
};
