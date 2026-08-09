// ─────────────────────────────────────────────────────────────────────────────
// BIRJA ↔ ZAVOD solishtiruvi (akt sverka).
//
// Sement birjadan TIKET (shartnoma) bilan sotib olinadi: har bir tiket alohida
// shartnoma. Keyin o'sha tiket bo'yicha zavod yuk yuboradi. Zavod ko'pincha
// xato qiladi: kam yoki ortiq yuboradi. Shuning uchun har tiket bo'yicha
// "birjada sotib olindi" va "zavoddan keldi" raqamlari yonma-yon solishtiriladi.
//
// Sof funksiya: React yo'q — testlash oson va hisob-kitob kod o'zgarganda ham
// kafolatlangan.
// ─────────────────────────────────────────────────────────────────────────────

const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };

// Tiket raqami turli joyda turlicha yozilishi mumkin: "A-26007338",
// "a 26007338", "А26007338". Solishtirish uchun yagona kalitga keltiramiz.
// Kirill "А, В, Е, К, М, Н, О, Р, С, Т, У, Х" lotin ko'rinishiga o'tkaziladi —
// birja fayli kirill, zavod fayli lotin bo'lishi odatiy hol.
const CYR2LAT = { 'А':'A','В':'B','Е':'E','К':'K','М':'M','Н':'H','О':'O','Р':'P','С':'C','Т':'T','У':'Y','Х':'X' };
export const ticketKey = (s) => String(s == null ? '' : s)
  .trim()
  .toUpperCase()
  .replace(/[А-Я]/g, (c) => CYR2LAT[c] || c)
  .replace(/[\s\-_.,/\\]+/g, '');

// Tonna taqqoslashda yaxlitlash qoldig'i (masalan 49.6 va 49.600)
const EPS = 0.01;

/**
 * @param {Array} birjaRows  — birja oborotkasidan import qilingan qatorlar
 *                             { ticket, tons, summa, date, marka }
 * @param {Array} recvRows   — zavoddan olingan yuklar { contractNo, tons, pending }
 * @param {Array} closed     — yopilgan tiketlar [{ ticket, closedAt }]
 * @returns {{ rows: Array, totals: Object }}
 *   rows: har tiket uchun
 *     { key, ticket, birjaTons, zavodTons, diff, status, birjaRows, recvRows,
 *       birjaSumma, pendingTons }
 *   status: 'teng' | 'kam' | 'ortiq' | 'zavod_yoq' | 'birja_yoq'
 */
export function reconcile(birjaRows = [], recvRows = [], closed = []) {
  const map = new Map();
  const get = (t) => {
    const key = ticketKey(t);
    if (!map.has(key)) {
      map.set(key, {
        key, ticket: String(t || '').trim() || '(raqamsiz)',
        birjaTons: 0, birjaSumma: 0, zavodTons: 0, pendingTons: 0,
        birja: [], recv: [],
      });
    }
    return map.get(key);
  };

  for (const b of birjaRows) {
    const g = get(b.ticket);
    g.birjaTons  += num(b.tons);
    g.birjaSumma += num(b.summa) || num(b.tons) * num(b.price);
    g.birja.push(b);
  }
  for (const r of recvRows) {
    // Tiket raqami yozilmagan yuk solishtiruvga kirmaydi — aks holda u
    // "(raqamsiz)" guruhida yig'ilib, boshqa tiketlarning farqini yashirardi.
    if (!ticketKey(r.contractNo)) continue;
    const g = get(r.contractNo);
    g.zavodTons += num(r.tons);
    // Tasdiqlanmagan (pending) yuk alohida ko'rsatiladi: u hali rasman
    // kelgan hisoblanmaydi, lekin farqni tushuntirishi mumkin.
    if (r.pending) g.pendingTons += num(r.tons);
    g.recv.push(r);
  }

  const closedSet = new Set((closed || []).map(c => ticketKey(c.ticket)));
  const rows = [...map.values()].map(g => {
    const diff = g.zavodTons - g.birjaTons;
    let status;
    if (g.birja.length === 0)      status = 'birja_yoq';   // zavod yubordi, birjada yo'q
    else if (g.recv.length === 0)  status = 'zavod_yoq';   // sotib olindi, yuk kelmadi
    else if (Math.abs(diff) <= EPS) status = 'teng';
    else if (diff < 0)             status = 'kam';         // zavod kam yubordi
    else                           status = 'ortiq';       // zavod ortiq yubordi
    return { ...g, diff, status, closed: closedSet.has(g.key), canClose: status === 'teng' };
  });

  // Avval muammolilar: farqi bor va yopilmaganlar tepada
  const rank = (r) => r.closed ? 3 : (r.status === 'teng' ? 2 : (r.status === 'kam' || r.status === 'ortiq') ? 0 : 1);
  rows.sort((a, b) => rank(a) - rank(b) || Math.abs(b.diff) - Math.abs(a.diff));

  const totals = {
    tickets:    rows.length,
    birjaTons:  rows.reduce((s, r) => s + r.birjaTons, 0),
    zavodTons:  rows.reduce((s, r) => s + r.zavodTons, 0),
    birjaSumma: rows.reduce((s, r) => s + r.birjaSumma, 0),
    ochiq:      rows.filter(r => !r.closed).length,
    farqli:     rows.filter(r => !r.closed && (r.status === 'kam' || r.status === 'ortiq')).length,
    yopilgan:   rows.filter(r => r.closed).length,
  };
  totals.diff = totals.zavodTons - totals.birjaTons;
  return { rows, totals };
}

export const STATUS_LABEL = {
  teng:      { text: '✓ Teng',              color: '#2e7d32', bg: '#e8f5e9' },
  kam:       { text: '↓ Zavod kam yubordi', color: '#c62828', bg: '#ffebee' },
  ortiq:     { text: '↑ Zavod ortiq yubordi', color: '#e65100', bg: '#fff3e0' },
  zavod_yoq: { text: '⏳ Yuk kelmagan',      color: '#1565c0', bg: '#e3f2fd' },
  birja_yoq: { text: '⚠️ Birjada yo‘q',      color: '#6a1b9a', bg: '#f3e5f5' },
};
