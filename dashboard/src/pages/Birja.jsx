// ─────────────────────────────────────────────────────────────────────────────
// BIRJA — sement birjadan tiket (shartnoma) bilan sotib olingan tonnaning
// hisobi va ZAVOD bilan avtomatik solishtiruvi (akt sverka).
//
// Ish tartibi:
//   1. Birja oborotkasi Excel bo'lib yuklanadi (ustunlar qo'lda moslanadi —
//      har bir birja fayli har xil ko'rinishda bo'ladi).
//   2. Har bir tiket bo'yicha "birjada sotib olindi" va "zavoddan keldi"
//      raqamlari yonma-yon chiqadi ("Olingan tonna"dagi Shartnoma № orqali).
//   3. Ikkala taraf teng bo'lsa — tiket yopiladi.
// ─────────────────────────────────────────────────────────────────────────────
import { Fragment, useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useData } from '../context/DataContext';
import { reconcile, ticketKey, STATUS_LABEL } from '../lib/birjaRecon';
import { parseNum } from '../lib/parseNum';
import { excelDateToStr } from '../lib/excelDate';
import ExcelExport from '../components/ExcelExport';
import { useFocusRow, FOCUS_STYLE } from '../lib/useFocusRow';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };

// Ustunlarni avtomatik topish uchun kalit so'zlar (rus/o'zbek/lotin-kirill).
// Topilmasa foydalanuvchi qo'lda tanlaydi — fayl ko'rinishi har xil bo'ladi.
const GUESS = {
  ticket: ['тикет', 'tiket', 'шартнома', 'договор', 'контракт', 'kontrakt', 'shartnoma', 'номер', 'raqam', '№'],
  date:   ['дата', 'sana', 'sana', 'вақт', 'vaqt', 'время'],
  marka:  ['марка', 'marka', 'товар', 'mahsulot', 'наименование'],
  tons:   ['объем', 'обьем', 'тонна', 'tonna', 'кол-во', 'количество', 'miqdor', 'hajm'],
  price:  ['цена', 'narx', 'нарх'],
  summa:  ['сумма', 'summa', 'жами', 'итого'],
};

const guessCol = (headers, kind) => {
  const keys = GUESS[kind];
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').toLowerCase().trim();
    if (!h) continue;
    if (keys.some(k => h.includes(k))) return i;
  }
  return -1;
};

export default function Birja() {
  const {
    birjaRows, birjaClosed, importBirjaRows, deleteBirjaRow, deleteBirjaTicket,
    closeBirjaTicket, reopenBirjaTicket, recvRows, appSettings,
  } = useData();
  const color = appSettings?.themeColor || '#00695c';

  const fileRef = useRef();
  const [sheet, setSheet]   = useState(null); // { headers, rows }
  const [mapCols, setMapCols] = useState({ ticket:-1, date:-1, marka:-1, tons:-1, price:-1, summa:-1 });
  const [search, setSearch] = useState('');
  const [only, setOnly]     = useState('ochiq'); // ochiq | farqli | hammasi | yopilgan
  const [detail, setDetail] = useState(null);    // ochilgan tiket kaliti

  // ── Solishtiruv ────────────────────────────────────────────────────────────
  const { rows, totals } = useMemo(
    () => reconcile(birjaRows, recvRows, birjaClosed),
    [birjaRows, recvRows, birjaClosed]
  );

  const view = rows.filter(r => {
    if (search.trim() && !ticketKey(r.ticket).includes(ticketKey(search))) return false;
    if (only === 'ochiq')    return !r.closed;
    if (only === 'farqli')   return !r.closed && (r.status === 'kam' || r.status === 'ortiq');
    if (only === 'yopilgan') return r.closed;
    return true;
  });
  const { rowRef: focusRef, isFocused } = useFocusRow(view, 1000, null);

  // ── Excel o'qish ───────────────────────────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => alert("Faylni o'qib bo'lmadi.");
    reader.onload = (ev) => {
      let data;
      try {
        const wb = XLSX.read(ev.target.result, { type: 'binary', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) { alert('Faylda varaq topilmadi.'); return; }
        data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      } catch (err) {
        alert(`Excel faylni o'qishda xato:\n${err?.message || err}`);
        return;
      }
      if (!data.length) { alert("Faylda ma'lumot yo'q."); return; }
      // Sarlavha qatorini topamiz: birinchi 5 qator ichidan eng ko'p to'la qator
      let hIdx = 0, best = -1;
      for (let i = 0; i < Math.min(5, data.length); i++) {
        const c = (data[i] || []).filter(x => String(x ?? '').trim() !== '').length;
        if (c > best) { best = c; hIdx = i; }
      }
      const headers = (data[hIdx] || []).map(h => String(h ?? '').trim());
      const body = data.slice(hIdx + 1);
      setSheet({ headers, rows: body });
      setMapCols({
        ticket: guessCol(headers, 'ticket'),
        date:   guessCol(headers, 'date'),
        marka:  guessCol(headers, 'marka'),
        tons:   guessCol(headers, 'tons'),
        price:  guessCol(headers, 'price'),
        summa:  guessCol(headers, 'summa'),
      });
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  // Moslangan ustunlar bo'yicha qatorlarni yig'ish
  const parsed = useMemo(() => {
    if (!sheet) return [];
    const g = (row, i) => (i >= 0 ? row[i] : '');
    const out = [];
    for (const row of sheet.rows) {
      if (!row || row.every(c => String(c ?? '').trim() === '')) continue;
      const ticket = String(g(row, mapCols.ticket) ?? '').trim();
      const tons   = parseNum(g(row, mapCols.tons));
      if (!ticket && !(tons > 0)) continue;      // butunlay bo'sh/izoh qatori
      out.push({
        ticket,
        date:  excelDateToStr(g(row, mapCols.date)) || String(g(row, mapCols.date) ?? '').trim(),
        marka: String(g(row, mapCols.marka) ?? '').trim(),
        tons,
        price: parseNum(g(row, mapCols.price)),
        summa: parseNum(g(row, mapCols.summa)),
      });
    }
    return out;
  }, [sheet, mapCols]);

  const badRows = parsed.filter(r => !r.ticket || !(r.tons > 0));

  const doImport = () => {
    const good = parsed.filter(r => r.ticket && r.tons > 0);
    if (!good.length) { alert('Import qilinadigan qator topilmadi. Ustunlarni to\'g\'ri moslang.'); return; }
    const res = importBirjaRows(good);
    setSheet(null);
    alert(
      `✅ ${res.added} ta qator qo'shildi.` +
      (res.duplicates ? `\n${res.duplicates} ta qator ILGARI YUKLANGAN — takrorlanmadi.` : '') +
      (badRows.length ? `\n${badRows.length} ta qator o'tkazib yuborildi (tiket yoki tonna yo'q).` : '')
    );
  };

  const inp = { padding: '6px 9px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4, fontFamily: 'Tahoma, sans-serif' };
  const btn = { padding: '7px 16px', fontSize: 13, cursor: 'pointer', borderRadius: 6, border: '1px solid #ccc', background: '#f5f5f5', fontFamily: 'Tahoma, sans-serif' };

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13, paddingBottom: 30 }}>

      {/* ── STATISTIKA ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <Stat label="Tiketlar" value={`${totals.tickets} ta`} color="#333" bg="#f5f5f5" />
        <Stat label="Birjadan olingan" value={`${fmtT(totals.birjaTons)} tn`} color="#00695c" bg="#e0f2f1" />
        <Stat label="Zavoddan kelgan"  value={`${fmtT(totals.zavodTons)} tn`} color="#1565c0" bg="#e3f2fd" />
        <Stat label="Farq (zavod − birja)"
          value={`${totals.diff > 0 ? '+' : ''}${fmtT(totals.diff)} tn`}
          color={Math.abs(totals.diff) < 0.01 ? '#2e7d32' : '#c62828'}
          bg={Math.abs(totals.diff) < 0.01 ? '#e8f5e9' : '#ffebee'} big />
        <Stat label="Farqli tiket" value={`${totals.farqli} ta`} color="#c62828" bg="#ffebee"
          onClick={() => setOnly('farqli')} />
        <Stat label="Yopilgan" value={`${totals.yopilgan} ta`} color="#2e7d32" bg="#e8f5e9"
          onClick={() => setOnly('yopilgan')} />
      </div>

      {/* ── IMPORT ─────────────────────────────────────────────────────────── */}
      <div style={{ background: '#e0f2f1', border: '2px solid #4db6ac', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <b style={{ color: '#00695c', fontSize: 14 }}>📈 Birja oborotkasini yuklash</b>
          <button onClick={() => fileRef.current.click()} style={{ ...btn, background: '#00695c', color: '#fff', border: 'none', fontWeight: 'bold' }}>
            📂 Excel faylni tanlash
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
          <span style={{ fontSize: 11, color: '#00695c' }}>
            Fayl yuklangach ustunlar avtomatik topiladi — kerak bo'lsa qo'lda to'g'rilaysiz.
          </span>
          {birjaRows.length > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#00695c' }}>
              Bazada: <b>{birjaRows.length}</b> ta birja qatori
            </span>
          )}
        </div>

        {/* Ustunlarni moslash + preview */}
        {sheet && (
          <div style={{ marginTop: 12, background: '#fff', borderRadius: 6, padding: 12 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#00695c' }}>
              Ustunlarni moslang ({sheet.rows.length} qator o'qildi)
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              {[
                ['ticket', 'Tiket / Shartnoma № *'],
                ['tons',   'Tonna *'],
                ['date',   'Sana'],
                ['marka',  'Marka'],
                ['price',  'Narx'],
                ['summa',  'Summa'],
              ].map(([k, label]) => (
                <label key={k} style={{ display: 'block' }}>
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 3 }}>{label}</span>
                  <select value={mapCols[k]} onChange={e => setMapCols({ ...mapCols, [k]: Number(e.target.value) })}
                    style={{ ...inp, width: 170, borderColor: (k === 'ticket' || k === 'tons') && mapCols[k] < 0 ? '#c62828' : '#ccc' }}>
                    <option value={-1}>— yo'q —</option>
                    {sheet.headers.map((h, i) => (
                      <option key={i} value={i}>{String.fromCharCode(65 + i)}: {h || '(nomsiz)'}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #eee', borderRadius: 4 }}>
              <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
                <thead>
                  <tr><th>#</th><th>Tiket</th><th>Sana</th><th>Marka</th>
                    <th style={{ textAlign: 'right' }}>Tonna</th>
                    <th style={{ textAlign: 'right' }}>Narx</th>
                    <th style={{ textAlign: 'right' }}>Summa</th></tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 60).map((r, i) => {
                    const bad = !r.ticket || !(r.tons > 0);
                    return (
                      <tr key={i} style={{ background: bad ? '#ffebee' : (i % 2 ? '#fafafa' : '#fff') }}>
                        <td style={{ color: '#888', textAlign: 'center' }}>{i + 1}</td>
                        <td style={{ fontWeight: 'bold', color: r.ticket ? '#00695c' : '#c62828' }}>{r.ticket || '⚠ yo‘q'}</td>
                        <td style={{ fontSize: 11 }}>{r.date || '—'}</td>
                        <td style={{ fontSize: 11 }}>{r.marka || '—'}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: r.tons > 0 ? '#333' : '#c62828' }}>{fmtT(r.tons)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.price ? fmt(r.price) : '—'}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.summa ? fmt(r.summa) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {parsed.length > 60 && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>…yana {parsed.length - 60} ta qator</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={doImport} style={{ ...btn, background: '#2e7d32', color: '#fff', border: 'none', fontWeight: 'bold' }}>
                ✅ {parsed.filter(r => r.ticket && r.tons > 0).length} ta qatorni import qilish
              </button>
              <button onClick={() => setSheet(null)} style={btn}>Bekor</button>
              {badRows.length > 0 && (
                <span style={{ fontSize: 12, color: '#c62828' }}>
                  ⚠️ {badRows.length} ta qatorda tiket yoki tonna yo'q — ular o'tkazib yuboriladi
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── FILTR ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="🔍 Tiket raqami..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, width: 220 }} />
        {[['ochiq', 'Ochiq'], ['farqli', '⚠️ Farqli'], ['yopilgan', '✓ Yopilgan'], ['hammasi', 'Hammasi']].map(([v, l]) => (
          <button key={v} onClick={() => setOnly(v)} style={{
            ...btn, fontWeight: only === v ? 'bold' : 'normal',
            background: only === v ? color : '#f5f5f5', color: only === v ? '#fff' : '#333',
            border: `1px solid ${only === v ? color : '#ccc'}`,
          }}>{l}</button>
        ))}
        <span style={{ fontSize: 12, color: '#888' }}>({view.length} ta)</span>
        <div style={{ marginLeft: 'auto' }}>
          <ExcelExport
            filename="Birja_solishtiruv"
            sheetName="Birja"
            title="Birja ↔ Zavod solishtiruvi"
            columns={[
              { header: 'Tiket / Shartnoma', value: r => r.ticket },
              { header: 'Birjadan (tn)',     value: r => Number(r.birjaTons || 0) },
              { header: 'Zavoddan (tn)',     value: r => Number(r.zavodTons || 0) },
              { header: 'Farq (tn)',         value: r => Number(r.diff || 0) },
              { header: 'Birja summasi',     value: r => Number(r.birjaSumma || 0) },
              { header: 'Holat',             value: r => (STATUS_LABEL[r.status]?.text || r.status) },
              { header: 'Yopilgan',          value: r => (r.closed ? 'ha' : "yo'q") },
            ]}
            rows={view}
          />
        </div>
      </div>

      {/* ── SOLISHTIRUV JADVALI ────────────────────────────────────────────── */}
      {view.length === 0 ? (
        <p style={{ color: '#888', fontStyle: 'italic' }}>
          {birjaRows.length === 0
            ? "Birja oborotkasi hali yuklanmagan. Yuqoridagi tugmadan Excel faylni yuklang."
            : 'Bu filtrga mos tiket yo‘q.'}
        </p>
      ) : (
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th>Tiket / Shartnoma №</th>
              <th style={{ textAlign: 'right', width: 120 }}>Birjadan</th>
              <th style={{ textAlign: 'right', width: 120 }}>Zavoddan</th>
              <th style={{ textAlign: 'right', width: 110 }}>Farq</th>
              <th style={{ textAlign: 'right', width: 140 }}>Birja summasi</th>
              <th style={{ width: 175 }}>Holat</th>
              <th style={{ width: 150 }}>Amal</th>
            </tr>
          </thead>
          <tbody>
            {view.map((r, i) => {
              const st = STATUS_LABEL[r.status] || { text: r.status, color: '#333', bg: '#f5f5f5' };
              const open = detail === r.key;
              return (
                <Fragment key={r.key}>
                  <tr
                    ref={isFocused(r.key) ? focusRef : null}
                    style={isFocused(r.key) ? FOCUS_STYLE : { background: r.closed ? '#f1f8e9' : st.bg }}>
                    <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{i + 1}</td>
                    <td>
                      <button onClick={() => setDetail(open ? null : r.key)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00695c', fontWeight: 'bold', fontSize: 13, padding: 0, textDecoration: 'underline' }}>
                        {r.ticket} {open ? '▲' : '▼'}
                      </button>
                      <div style={{ fontSize: 10, color: '#888' }}>
                        birja: {r.birja.length} qator · zavod: {r.recv.length} mashina
                        {r.pendingTons > 0 && <span style={{ color: '#e65100' }}> · ⚠ tasdiqlanmagan {fmtT(r.pendingTons)} tn</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#00695c' }}>{fmtT(r.birjaTons)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#1565c0' }}>{fmtT(r.zavodTons)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', fontSize: 14, color: Math.abs(r.diff) < 0.01 ? '#2e7d32' : '#c62828' }}>
                      {r.diff > 0 ? '+' : ''}{fmtT(r.diff)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.birjaSumma ? fmt(r.birjaSumma) : '—'}</td>
                    <td>
                      <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 'bold', color: st.color, border: `1px solid ${st.color}55` }}>
                        {st.text}
                      </span>
                      {r.closed && <div style={{ fontSize: 10, color: '#2e7d32', fontWeight: 'bold', marginTop: 2 }}>🔒 yopilgan</div>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {r.closed ? (
                        <button onClick={() => reopenBirjaTicket(r.ticket)} style={{ ...btn, padding: '3px 10px', fontSize: 11 }}>
                          🔓 Qayta ochish
                        </button>
                      ) : r.canClose ? (
                        <button onClick={() => {
                          if (window.confirm(`"${r.ticket}" tiketi yopilsinmi?\n\nBirjadan: ${fmtT(r.birjaTons)} tn\nZavoddan: ${fmtT(r.zavodTons)} tn\nFarq: 0 — hisob-kitob to'g'ri.`))
                            closeBirjaTicket(r.ticket);
                        }} style={{ ...btn, padding: '3px 10px', fontSize: 11, background: '#2e7d32', color: '#fff', border: 'none', fontWeight: 'bold' }}>
                          🔒 Tiketni yopish
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: '#888' }}>farq bor</span>
                      )}
                    </td>
                  </tr>

                  {/* Tafsilot: ikkala tarafning qatorlari yonma-yon */}
                  {open && (
                    <tr>
                      <td colSpan={8} style={{ background: '#fafafa', padding: 12 }}>
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                          <Side title={`📈 Birjadan olingan (${fmtT(r.birjaTons)} tn)`} color="#00695c">
                            <table className="data-table" style={{ width: '100%', fontSize: 11 }}>
                              <thead><tr><th>Sana</th><th>Marka</th><th style={{ textAlign: 'right' }}>Tonna</th><th style={{ textAlign: 'right' }}>Summa</th><th style={{ width: 28 }}></th></tr></thead>
                              <tbody>
                                {r.birja.map(b => (
                                  <tr key={b.id}>
                                    <td>{b.date || '—'}</td>
                                    <td>{b.marka || '—'}</td>
                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{fmtT(b.tons)}</td>
                                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(b.summa || b.tons * b.price)}</td>
                                    <td>
                                      <button onClick={() => { if (window.confirm("Bu birja qatori o'chirilsinmi?")) deleteBirjaRow(b.id); }}
                                        title="O'chirish"
                                        style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#c62828' }}>✕</button>
                                    </td>
                                  </tr>
                                ))}
                                {r.birja.length === 0 && <tr><td colSpan={5} style={{ color: '#888', fontStyle: 'italic' }}>Birja oborotkasida bu tiket yo'q</td></tr>}
                              </tbody>
                            </table>
                          </Side>

                          <Side title={`🚚 Zavoddan kelgan (${fmtT(r.zavodTons)} tn)`} color="#1565c0">
                            <table className="data-table" style={{ width: '100%', fontSize: 11 }}>
                              <thead><tr><th>Sana</th><th>Mashina</th><th>Marka</th><th style={{ textAlign: 'right' }}>Tonna</th></tr></thead>
                              <tbody>
                                {r.recv.map(x => (
                                  <tr key={x.id} style={{ background: x.pending ? '#fff8c4' : undefined }}>
                                    <td>{x.date || '—'}</td>
                                    <td>{x.vehicleNo || '—'}</td>
                                    <td>{x.brand || '—'}</td>
                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                      {fmtT(x.tons)}{x.pending ? ' ⚠' : ''}
                                    </td>
                                  </tr>
                                ))}
                                {r.recv.length === 0 && <tr><td colSpan={4} style={{ color: '#888', fontStyle: 'italic' }}>Bu tiket bo'yicha yuk kelmagan</td></tr>}
                              </tbody>
                            </table>
                          </Side>
                        </div>
                        <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: '#888' }}>
                            Zavoddan kelgan yuklar "Olingan tonna" bo'limida <b>Shartnoma №</b> ustuni orqali bog'lanadi.
                          </span>
                          <button onClick={() => { if (window.confirm(`"${r.ticket}" tiketining BARCHA birja qatorlari o'chirilsinmi? (Zavod yozuvlariga tegilmaydi)`)) deleteBirjaTicket(r.key); }}
                            style={{ ...btn, marginLeft: 'auto', padding: '3px 10px', fontSize: 11, color: '#c62828', borderColor: '#e57373' }}>
                            🗑 Birja qatorlarini o'chirish
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            <tr style={{ background: '#ffff00', fontWeight: 'bold' }}>
              <td colSpan={2} style={{ textAlign: 'right' }}>JAMI ({view.length} tiket)</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtT(view.reduce((s, r) => s + r.birjaTons, 0))} tn</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtT(view.reduce((s, r) => s + r.zavodTons, 0))} tn</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtT(view.reduce((s, r) => s + r.diff, 0))} tn</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(view.reduce((s, r) => s + r.birjaSumma, 0))}</td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

function Stat({ label, value, color, bg, big, onClick }) {
  return (
    <div onClick={onClick} style={{
      padding: '9px 16px', background: bg, borderLeft: `5px solid ${color}`, borderRadius: 6,
      minWidth: 130, cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: big ? 22 : 18, fontWeight: 'bold', color, fontFamily: 'monospace' }}>{value}</div>
    </div>
  );
}

function Side({ title, color, children }) {
  return (
    <div style={{ flex: 1, minWidth: 280 }}>
      <div style={{ fontWeight: 'bold', fontSize: 12, color, marginBottom: 5 }}>{title}</div>
      {children}
    </div>
  );
}
