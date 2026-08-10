// ─────────────────────────────────────────────────────────────────────────────
// "Mijoz olgan vaqt" — bitta sotuv/qarz qatorining SOAT:DAQIQAsi.
//
// Sana maydoni (row.date) tizim bo'yicha "kk.oo.yyyy" — kunlik/oylik filtrlar
// aynan shu ko'rinishni talab qiladi, shuning uchun unga vaqt QO'SHILMAYDI.
// Vaqt esa sotuv qaysi bo'limdan kelganiga qarab boshqa joyda yotadi:
//   · Olingan tonna (taqsimlash) → zavoddan chiqqan vaqt: row.factoryTime
//   · Kassir / Sotish            → xodim kiritgan vaqt:  row.createdAt
// Ikkalasi bir xil narsa emas, shuning uchun natijada `factory` bayrog'i ham
// qaytariladi — ko'rsatishda ular ajratiladi.
//
// React yo'q: sof mantiq, testlanadi.
// ─────────────────────────────────────────────────────────────────────────────

// "2026-08-09 14:35:12" → "14:35". Tanib bo'lmasa — bo'sh satr.
export const ftClock = (ft) => {
  const m = String(ft || '').match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
};

// Zavod vaqti: qatorning o'zida bo'lmasa (bu tuzatishdan oldin yozilgan
// qarz/kassa qatorlari), u kelib chiqqan sotuvdan olinadi — sourceId orqali.
export const factoryTimeOf = (row, sales = []) => (row && row.factoryTime)
  || (row && row.sourceType === 'sale'
        ? ((sales.find(x => x.id === row.sourceId) || {}).factoryTime || '')
        : '');

export function takenAt(row, sales = []) {
  if (!row) return null;
  const ft = factoryTimeOf(row, sales);
  const c  = ftClock(ft);
  if (c) return { time: c, factory: true, title: `Zavoddan chiqqan vaqt: ${ft}` };
  // Zavod vaqti yo'q — yozuv kiritilgan payt (kassir sotgan vaqt).
  // 1e10 tekshiruvi: eski/import yozuvlarda id timestamp bo'lmasligi mumkin,
  // unda 1970-yil soati chiqib, mijozga soxta vaqt ko'rsatilardi.
  const ts = Number(row.createdAt || row.id || 0);
  if (!(ts > 1e10)) return null;
  const d = new Date(ts);
  const p = (x) => String(x).padStart(2, '0');
  return { time: `${p(d.getHours())}:${p(d.getMinutes())}`, factory: false, title: 'Kiritilgan vaqt (kassir)' };
}
