import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import Paginator from '../components/Paginator';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => {
  const v = Number(n || 0);
  return v % 1 === 0 ? String(v) : v.toFixed(2);
};

// Timestamp → "HH:MM:SS"
const fmtTime = (ts) => {
  if (!ts || ts < 1e10) return '—';
  const d = new Date(ts);
  return [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    String(d.getSeconds()).padStart(2, '0'),
  ].join(':');
};

// Bugungi sana dd.mm.yyyy
const todayStr = () => {
  const d = new Date();
  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear(),
  ].join('.');
};

// dd.mm.yyyy → timestamp (saralash uchun)
const parseDate = (s) => {
  if (!s) return 0;
  const [d, m, y] = s.split('.').map(Number);
  return new Date(y, m - 1, d).getTime();
};

// Operatsiya turi belgilari
const TYPE_LABEL = {
  kirim_naqd:  { latn: 'Kirim (naqd)',  cyrl: 'Кирим (нақд)',  color: '#006600' },
  kirim_bank:  { latn: 'Kirim (bank)',  cyrl: 'Кирим (банк)',  color: '#0000cc' },
  kirim_click: { latn: 'Kirim (click)', cyrl: 'Кирим (клик)',  color: '#6600cc' },
  chiqim:      { latn: 'Chiqim',        cyrl: 'Чиқим',         color: '#cc0000' },
  sotilgan:    { latn: 'Sotilgan tn',   cyrl: 'Сотилган тн',   color: '#996600' },
  olingan:     { latn: 'Olingan tn',    cyrl: 'Олинган тн',    color: '#006699' },
};

const L = {
  vaqt:         { latn: 'Vaqt',             cyrl: 'Вақт'            },
  sana:         { latn: 'Sana',             cyrl: 'Сана'            },
  tur:          { latn: 'Tur',              cyrl: 'Тур'             },
  xodim:        { latn: 'Xodim',            cyrl: 'Ходим'           },
  izoh:         { latn: 'Izoh / Mijoz',     cyrl: 'Изоҳ / Мижоз'   },
  summa:        { latn: "Summa (so'm)",     cyrl: 'Сумма (сўм)'     },
  tonna:        { latn: 'Tonna',            cyrl: 'Тонна'           },
  tolov:        { latn: "To'lov",           cyrl: 'Тўлов'           },
  bugun:        { latn: 'Bugun',            cyrl: 'Бугун'           },
  barchasi:     { latn: 'Barchasi',         cyrl: 'Барчаси'         },
  filter_sana:  { latn: 'Sana:',            cyrl: 'Сана:'           },
  filter_xodim: { latn: "Xodim:",           cyrl: 'Ходим:'          },
  hammasi:      { latn: 'Hammasi',          cyrl: 'Ҳаммаси'         },
  yozuv_yoq:    { latn: 'Yozuv topilmadi.', cyrl: 'Ёзув топилмади.' },
  jami:         { latn: 'JAMI',             cyrl: 'ЖАМИ'            },
  jami_kirim:   { latn: 'Jami kirim:',      cyrl: 'Жами кирим:'     },
  jami_chiqim:  { latn: 'Jami chiqim:',     cyrl: 'Жами чиқим:'     },
  sotil_tonna:  { latn: 'Sotilgan tonna:',  cyrl: 'Сотилган тонна:' },
  oling_tonna:  { latn: 'Olingan tonna:',   cyrl: 'Олинган тонна:'  },
  sof:          { latn: 'Sof (K−Ch):',      cyrl: 'Соф (К−Ч):'      },
  yozuv_soni:   { latn: 'ta yozuv',         cyrl: 'та ёзув'         },
};

export default function DailyWork({ lang }) {
  const {
    incomeRows, expenseRows,
    bankIncomeRows, bankExpenseRows, clickIncomeRows, clickExpenseRows,
    soldRows, salesRows, recvRows,
    currentWorker, setCurrentWorker,
  } = useData();

  const XODIMLAR = [
    'Botir aka', 'Alisher aka', 'Ganisher aka', 'Sharofidin',
    'Saloh', 'Qosim', 'Anvarjon',
  ];

  const [filterDate,   setFilterDate]   = useState(todayStr());
  const [showAll,      setShowAll]      = useState(false);
  const [filterWorker, setFilterWorker] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;

  // ── Barcha manbaalardan yig'ish ──────────────────────────────────────────
  const allRows = [
    ...incomeRows.map(r => ({
      id: 'inc_' + r.id,
      createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
      date: r.date, type: 'kirim_naqd',
      worker: r.worker || '',
      izoh: r.desc, summa: r.amount,
      tonna: null, tolov: 'Naqd',
    })),
    ...bankIncomeRows.map(r => ({
      id: 'bnk_' + r.id,
      createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
      date: r.date, type: 'kirim_bank',
      worker: r.worker || '',
      izoh: r.desc, summa: r.amount,
      tonna: null, tolov: 'Bank',
    })),
    ...clickIncomeRows.map(r => ({
      id: 'clk_' + r.id,
      createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
      date: r.date, type: 'kirim_click',
      worker: r.worker || '',
      izoh: r.desc, summa: r.amount,
      tonna: null, tolov: 'Click',
    })),
    ...expenseRows.map(r => ({
      id: 'exp_' + r.id,
      createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
      date: r.date, type: 'chiqim',
      worker: r.worker || '',
      izoh: r.desc, summa: r.amount,
      tonna: null, tolov: 'Naqd',
    })),
    ...bankExpenseRows.map(r => ({
      id: 'bexp_' + r.id,
      createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
      date: r.date, type: 'chiqim',
      worker: r.worker || '',
      izoh: r.desc, summa: r.amount,
      tonna: null, tolov: 'Bank',
    })),
    ...clickExpenseRows.map(r => ({
      id: 'cexp_' + r.id,
      createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
      date: r.date, type: 'chiqim',
      worker: r.worker || '',
      izoh: r.desc, summa: r.amount,
      tonna: null, tolov: 'Click',
    })),
    // Yangi "Sotish" + eski "Sotilgan tonna" — ikkalasi ham
    ...[...salesRows, ...soldRows].map(r => ({
      id: 'sol_' + r.id,
      createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
      date: r.date, type: 'sotilgan',
      worker: r.worker || '',
      izoh: r.customer,
      summa: Number(r.tons || 0) * Number(r.pricePerTon || 0),
      tonna: r.tons,
      tolov: r.paymentChannel || '—',
    })),
    ...recvRows.map(r => ({
      id: 'rcv_' + r.id,
      createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
      date: r.date, type: 'olingan',
      worker: r.worker || '',
      izoh: r.source,
      summa: Number(r.tons || 0) * Number(r.pricePerTon || 0),
      tonna: r.tons,
      tolov: r.paymentChannel || '—',
    })),
  ];

  // Vaqt bo'yicha saralash — yangi tepada
  allRows.sort((a, b) => {
    const ta = a.createdAt || parseDate(a.date);
    const tb = b.createdAt || parseDate(b.date);
    return tb - ta;
  });

  // Noyob xodimlar ro'yxati
  const workerList = [...new Set(allRows.map(r => r.worker).filter(Boolean))];

  // Filtrlash
  let filtered = showAll ? allRows : allRows.filter(r => r.date === filterDate);
  if (filterWorker) filtered = filtered.filter(r => r.worker === filterWorker);

  // ── Jami ─────────────────────────────────────────────────────────────────
  const totalKirim  = filtered.filter(r => r.type.startsWith('kirim')).reduce((s, r) => s + Number(r.summa || 0), 0);
  const totalChiqim = filtered.filter(r => r.type === 'chiqim').reduce((s, r) => s + Number(r.summa || 0), 0);
  const totalSotil  = filtered.filter(r => r.type === 'sotilgan').reduce((s, r) => s + Number(r.tonna || 0), 0);
  const totalOling  = filtered.filter(r => r.type === 'olingan').reduce((s, r) => s + Number(r.tonna || 0), 0);
  const sof         = totalKirim - totalChiqim;
  useEffect(() => { setPage(1); }, [filterDate, filterWorker, showAll]);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const btnStyle = (active) => ({
    padding: '3px 10px',
    fontFamily: 'Tahoma, sans-serif',
    fontSize: 12,
    cursor: 'pointer',
    border: active ? '2px inset #ffffff' : '2px outset #ffffff',
    background: active ? '#003366' : '#f0f0f0',
    color: active ? '#fff' : '#000',
    fontWeight: active ? 'bold' : 'normal',
  });

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>

      {/* ── Filter paneli ── */}
      <table style={{ marginBottom: 10, borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ paddingRight: 6, fontWeight: 'bold', fontSize: 12 }}>
              {L.filter_sana[lang]}
            </td>
            <td style={{ paddingRight: 4 }}>
              <input
                type="text"
                placeholder="dd.mm.yyyy"
                value={filterDate}
                onChange={e => { setFilterDate(e.target.value); setShowAll(false); }}
                disabled={showAll}
                style={{
                  padding: '3px 6px', fontFamily: 'Tahoma, sans-serif',
                  fontSize: 12, width: 100,
                  border: '2px inset #ffffff',
                  background: showAll ? '#e0e0e0' : '#fff',
                }}
              />
            </td>
            <td style={{ paddingRight: 4 }}>
              <button
                onClick={() => { setFilterDate(todayStr()); setShowAll(false); }}
                style={btnStyle(!showAll && filterDate === todayStr())}
              >
                {L.bugun[lang]}
              </button>
            </td>
            <td style={{ paddingRight: 10 }}>
              <button
                onClick={() => setShowAll(v => !v)}
                style={btnStyle(showAll)}
              >
                {L.barchasi[lang]}
              </button>
            </td>

            {/* Kim kiritdi (faol xodim) */}
            <td style={{ paddingLeft: 10, paddingRight: 4, fontWeight: 'bold', fontSize: 12, color: '#003366', whiteSpace: 'nowrap' }}>
              Kim:
            </td>
            <td style={{ paddingRight: 8 }}>
              <select
                value={currentWorker}
                onChange={e => setCurrentWorker(e.target.value)}
                style={{
                  padding: '3px 5px', fontFamily: 'Tahoma, sans-serif',
                  fontSize: 12, border: '2px inset #ffffff',
                  background: currentWorker ? '#e8f0ff' : '#fff',
                  cursor: 'pointer',
                  fontWeight: currentWorker ? 'bold' : 'normal',
                  color: currentWorker ? '#003366' : '#666',
                }}
              >
                <option value="">— xodim —</option>
                {XODIMLAR.map(x => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </td>

            {/* Xodim bo'yicha filter (ko'rish uchun) */}
            {workerList.length > 0 && (
              <>
                <td style={{ paddingRight: 4, fontWeight: 'bold', fontSize: 12, whiteSpace: 'nowrap' }}>
                  Filter:
                </td>
                <td style={{ paddingRight: 8 }}>
                  <select
                    value={filterWorker}
                    onChange={e => setFilterWorker(e.target.value)}
                    style={{
                      padding: '3px 5px', fontFamily: 'Tahoma, sans-serif',
                      fontSize: 12, border: '2px inset #ffffff',
                      background: '#fff', cursor: 'pointer',
                    }}
                  >
                    <option value="">{L.hammasi[lang]}</option>
                    {workerList.map(w => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </td>
              </>
            )}

            <td style={{ paddingLeft: 8, color: '#666', fontSize: 11 }}>
              ({filtered.length} {L.yozuv_soni[lang]})
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Jami xulosasi ── */}
      <table style={{
        borderCollapse: 'collapse', marginBottom: 12,
        border: '1px solid #999', background: '#fffde8',
      }}>
        <tbody>
          <tr>
            <td style={sumCell}><b style={{ color: '#006600' }}>{L.jami_kirim[lang]}</b></td>
            <td style={{ ...sumCell, color: '#006600', fontWeight: 'bold', textAlign: 'right' }}>
              {fmt(totalKirim)} so'm
            </td>
            <td style={sumSep} />
            <td style={sumCell}><b style={{ color: '#cc0000' }}>{L.jami_chiqim[lang]}</b></td>
            <td style={{ ...sumCell, color: '#cc0000', fontWeight: 'bold', textAlign: 'right' }}>
              {fmt(totalChiqim)} so'm
            </td>
            <td style={sumSep} />
            <td style={sumCell}><b style={{ color: sof >= 0 ? '#006600' : '#cc0000' }}>{L.sof[lang]}</b></td>
            <td style={{ ...sumCell, color: sof >= 0 ? '#006600' : '#cc0000', fontWeight: 'bold', textAlign: 'right' }}>
              {sof >= 0 ? '' : '−'}{fmt(Math.abs(sof))} so'm
            </td>
            <td style={sumSep} />
            <td style={sumCell}><b style={{ color: '#996600' }}>{L.sotil_tonna[lang]}</b></td>
            <td style={{ ...sumCell, color: '#996600', fontWeight: 'bold', textAlign: 'right' }}>
              {fmtT(totalSotil)} tn
            </td>
            <td style={sumSep} />
            <td style={sumCell}><b style={{ color: '#006699' }}>{L.oling_tonna[lang]}</b></td>
            <td style={{ ...sumCell, color: '#006699', fontWeight: 'bold', textAlign: 'right' }}>
              {fmtT(totalOling)} tn
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Jadval ── */}
      {filtered.length === 0 ? (
        <p style={{ color: '#666', fontStyle: 'italic' }}>{L.yozuv_yoq[lang]}</p>
      ) : (
        <>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th style={{ width: 68 }}>{L.vaqt[lang]}</th>
              <th style={{ width: 85 }}>{L.sana[lang]}</th>
              <th style={{ width: 130 }}>{L.tur[lang]}</th>
              <th style={{ width: 110 }}>{L.xodim[lang]}</th>
              <th>{L.izoh[lang]}</th>
              <th style={{ textAlign: 'right', width: 135 }}>{L.summa[lang]}</th>
              <th style={{ textAlign: 'right', width: 75 }}>{L.tonna[lang]}</th>
              <th style={{ width: 75 }}>{L.tolov[lang]}</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r, i) => {
              const meta = TYPE_LABEL[r.type] || {};
              const isKirim  = r.type.startsWith('kirim');
              const isChiqim = r.type === 'chiqim';
              const rowBg    = i % 2 === 0 ? '#ffffff' : '#f5f5f5';
              return (
                <tr key={r.id} style={{ background: rowBg }}>
                  <td style={{ textAlign: 'center', color: '#666', fontSize: 11 }}>{i + 1}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', color: '#333' }}>
                    {fmtTime(r.createdAt)}
                  </td>
                  <td style={{ fontSize: 12 }}>{r.date || '—'}</td>
                  <td style={{ color: meta.color || '#333', fontWeight: 'bold', fontSize: 12 }}>
                    {meta[lang] || r.type}
                  </td>
                  <td style={{ fontSize: 12, color: '#003366', fontWeight: r.worker ? 'bold' : 'normal' }}>
                    {r.worker || '—'}
                  </td>
                  <td>{r.izoh || '—'}</td>
                  <td style={{
                    textAlign: 'right', fontWeight: 'bold',
                    color: isKirim ? '#006600' : isChiqim ? '#cc0000' : '#333',
                    fontFamily: 'monospace',
                  }}>
                    {r.summa ? fmt(r.summa) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#006699', fontWeight: 'bold' }}>
                    {r.tonna ? fmtT(r.tonna) : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: '#555' }}>{r.tolov}</td>
                </tr>
              );
            })}
            {/* Jami qator */}
            <tr style={{ background: '#ffff00', fontWeight: 'bold' }}>
              <td colSpan={6} style={{ textAlign: 'right' }}>{L.jami[lang]}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                <span style={{ color: '#006600' }}>↑{fmt(totalKirim)}</span>
                {' / '}
                <span style={{ color: '#cc0000' }}>↓{fmt(totalChiqim)}</span>
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                <span style={{ color: '#996600' }}>{fmtT(totalSotil)}</span>
                {' / '}
                <span style={{ color: '#006699' }}>{fmtT(totalOling)}</span>
              </td>
              <td />
            </tr>
          </tbody>
        </table>
        <Paginator total={filtered.length} page={page} setPage={setPage} pageSize={PAGE_SIZE} />
        </>
      )}
    </div>
  );
}

const sumCell = {
  padding: '5px 10px',
  fontSize: 12,
  border: '1px solid #ccc',
};

const sumSep = {
  width: 8,
  background: '#e0e0e0',
  border: '1px solid #ccc',
};
