import { useState } from 'react';
import { useData } from '../context/DataContext';
import CustomerSelect from '../components/CustomerSelect';
import ExcelExport from '../components/ExcelExport';
import DateRangeFilter from '../components/DateRangeFilter';
import { filterByRange } from '../lib/dateRange';
import Paginator from '../components/Paginator';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');

const clickExportColumns = [
  { header: 'Sana', value: (r) => r.date || '' },
  { header: 'Xodim', value: (r) => r.worker || '' },
  { header: 'Izoh', value: (r) => r.desc || '' },
  { header: "Summa (so'm)", value: (r) => Number(r.amount || 0) },
];

const fmtTime = (ts) => {
  if (!ts || ts < 1e10) return '—';
  const d = new Date(ts);
  return [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    String(d.getSeconds()).padStart(2, '0'),
  ].join(':');
};

const todayStr = () => {
  const d = new Date();
  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear(),
  ].join('.');
};

const parseDate = (s) => {
  if (!s) return 0;
  const [d, m, y] = s.split('.').map(Number);
  return new Date(y, m - 1, d).getTime();
};

const XODIMLAR = [
  'Botir aka', 'Alisher aka', 'Ganisher aka', 'Sharofidin',
  'Saloh', 'Qosim', 'Anvarjon',
];

// ─── Click turlari ────────────────────────────────────────────────────────────
const CLICK_TYPES = [
  { v: 'click',   label: 'Click',   color: '#6a1b9a' },
  { v: 'payme',   label: 'Payme',   color: '#0070f3' },
  { v: 'uzum',    label: 'Uzum',    color: '#e65100' },
  { v: 'boshqa',  label: 'Boshqa',  color: '#555'    },
];

const ACCENT   = '#6a1b9a'; // deep purple
const ACC_LITE = '#f3e5f5'; // purple light

const L = {
  kirim:      { latn: 'Kirim Click',       cyrl: 'Кирим Click'        },
  chiqim:     { latn: 'Chiqim Click',      cyrl: 'Чиқим Click'        },
  summa:      { latn: 'Summa',             cyrl: 'Сумма'               },
  izoh:       { latn: 'Izoh / Kontragent', cyrl: 'Изоҳ / Контрагент'  },
  izohCh:     { latn: 'Izoh / Maqsad',    cyrl: 'Изоҳ / Мақсад'      },
  qoshish:    { latn: "Qo'shish",          cyrl: 'Қўшиш'               },
  sana:       { latn: 'Sana',             cyrl: 'Сана'                 },
  vaqt:       { latn: 'Vaqt',             cyrl: 'Вақт'                 },
  xodim:      { latn: 'Xodim',            cyrl: 'Ходим'                },
  jami:       { latn: 'JAMI',             cyrl: 'ЖАМИ'                 },
  bugun:      { latn: 'Bugun',            cyrl: 'Бугун'                },
  barchasi:   { latn: 'Barchasi',         cyrl: 'Барчаси'              },
  hammasi:    { latn: 'Hammasi',          cyrl: 'Ҳаммаси'              },
  yoq:        { latn: 'Yozuv topilmadi.', cyrl: 'Ёзув топилмади.'     },
  ochilish:   { latn: "Ochilish qoldig'i", cyrl: 'Очилиш қолдиғи'    },
  jamiKirim:  { latn: 'Jami kirim',       cyrl: 'Жами кирим'           },
  jamiChiqim: { latn: 'Jami chiqim',      cyrl: 'Жами чиқим'           },
  netBalans:  { latn: "Click qoldig'i (jami)", cyrl: 'Click қолдиғи (жами)' },
  filter_sana:{ latn: 'Sana:',            cyrl: 'Сана:'                },
  filter_xod: { latn: 'Xodim:',           cyrl: 'Ходим:'               },
  kim:        { latn: 'Kim:',             cyrl: 'Ким:'                  },
};

export default function IncomeClick({ lang }) {
  const {
    clickOpening, setClickOpening,
    clickIncomeRows,  addClickIncomeRow,  deleteClickIncomeRow,  totalClickIncome,
    clickExpenseRows, addClickExpenseRow, deleteClickExpenseRow, totalClickExpense,
    totalClickBalance,
    currentWorker, setCurrentWorker,
  } = useData();

  const [activeTab,     setActiveTab]     = useState('kirim');
  const [incForm,       setIncForm]       = useState({ amount: '', desc: '', type: 'click' });
  const [expForm,       setExpForm]       = useState({ amount: '', desc: '', type: 'click' });

  // Filterlar
  const [incFilterDate,   setIncFilterDate]   = useState('');
  const [incShowAll,      setIncShowAll]       = useState(true);
  const [incFilterWorker, setIncFilterWorker]  = useState('');
  const [expFilterDate,   setExpFilterDate]    = useState('');
  const [expShowAll,      setExpShowAll]       = useState(true);
  const [expFilterWorker, setExpFilterWorker]  = useState('');
  const [range, setRange] = useState({ from: '', to: '' });

  // Ochilish tahrirlash
  const [editOpening, setEditOpening] = useState(false);
  const [openingVal,  setOpeningVal]  = useState(String(clickOpening.amount));

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddIncome = (e) => {
    e.preventDefault();
    if (!incForm.amount || !incForm.desc) return;
    addClickIncomeRow(incForm.amount, incForm.desc);
    setIncForm({ ...incForm, amount: '', desc: '' });
  };

  const handleAddExpense = (e) => {
    e.preventDefault();
    if (!expForm.amount || !expForm.desc) return;
    addClickExpenseRow(expForm.amount, expForm.desc);
    setExpForm({ ...expForm, amount: '', desc: '' });
  };

  const handleDelIncome  = (id) => { if (window.confirm("O'chirasizmi?")) deleteClickIncomeRow(id); };
  const handleDelExpense = (id) => { if (window.confirm("O'chirasizmi?")) deleteClickExpenseRow(id); };

  // ── Saralash va filtrlash ─────────────────────────────────────────────────
  const sortRows = (rows) =>
    [...rows].sort((a, b) => {
      const ta = a.createdAt || (a.id > 1e10 ? a.id : parseDate(a.date));
      const tb = b.createdAt || (b.id > 1e10 ? b.id : parseDate(b.date));
      return tb - ta;
    });

  const applyFilter = (rows, showAll, filterDate, filterWorker) => {
    let r = rows;
    if (!showAll && filterDate) r = r.filter(x => x.date === filterDate);
    if (filterWorker)            r = r.filter(x => x.worker === filterWorker);
    return r;
  };

  const sortedInc = sortRows(clickIncomeRows);
  const sortedExp = sortRows(clickExpenseRows);

  const filteredInc = filterByRange(applyFilter(sortedInc, incShowAll, incFilterDate, incFilterWorker), range);
  const filteredExp = filterByRange(applyFilter(sortedExp, expShowAll, expFilterDate, expFilterWorker), range);

  const incWorkers = [...new Set(sortedInc.map(r => r.worker).filter(Boolean))];
  const expWorkers = [...new Set(sortedExp.map(r => r.worker).filter(Boolean))];

  const filteredIncTotal = filteredInc.reduce((s, r) => s + Number(r.amount || 0), 0);
  const filteredExpTotal = filteredExp.reduce((s, r) => s + Number(r.amount || 0), 0);

  const todayInc = clickIncomeRows.filter(r => r.date === todayStr()).reduce((s, r) => s + Number(r.amount || 0), 0);
  const todayExp = clickExpenseRows.filter(r => r.date === todayStr()).reduce((s, r) => s + Number(r.amount || 0), 0);

  const inp = {
    padding: '4px 6px', fontFamily: 'Tahoma, sans-serif',
    fontSize: 12, border: '1px solid #ccc', borderRadius: 3,
  };
  const btnS = (active) => ({
    padding: '3px 10px', fontFamily: 'Tahoma, sans-serif', fontSize: 12,
    cursor: 'pointer',
    border: active ? '2px inset #ffffff' : '2px outset #ffffff',
    background: active ? ACCENT : '#f0f0f0',
    color: active ? '#fff' : '#333',
    fontWeight: active ? 'bold' : 'normal',
  });

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>

      {/* ── STATISTIKA PANELI ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <StatCard label={L.ochilish[lang]}   value={fmt(clickOpening.amount)}
          color="#555" bg="#f5f5f5" sub={clickOpening.date}
          clickable onEdit={() => setEditOpening(v => !v)} />
        <StatCard label={L.jamiKirim[lang]}  value={fmt(totalClickIncome)}  color={ACCENT}    bg={ACC_LITE}  arrow="↑" sub={`Bugun: ${fmt(todayInc)}`} />
        <StatCard label={L.jamiChiqim[lang]} value={fmt(totalClickExpense)} color="#c62828"  bg="#ffebee"    arrow="↓" sub={`Bugun: ${fmt(todayExp)}`} />
        <StatCard label={L.netBalans[lang]}
          value={fmt(totalClickBalance)}
          color={totalClickBalance >= 0 ? '#1b5e20' : '#c62828'}
          bg={totalClickBalance >= 0 ? '#e8f5e9' : '#ffebee'}
          sub="Sotuv/qarz + qo'lda — jami" bold />
      </div>

      {/* ── Ochilish tahrirlash ───────────────────────────────────────────── */}
      {editOpening && (
        <div style={{
          marginBottom: 12, padding: '8px 12px',
          background: '#fff8e1', border: '1px solid #fbc02d', borderRadius: 4,
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, fontWeight: 'bold' }}>{L.ochilish[lang]}:</span>
          <input type="number" value={openingVal} onChange={e => setOpeningVal(e.target.value)}
            style={{ ...inp, width: 150 }} />
          <button onClick={() => { setClickOpening({ ...clickOpening, amount: Number(openingVal) }); setEditOpening(false); }}
            style={{ ...inp, background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer', padding: '4px 14px' }}>
            ✓ Saqlash
          </button>
          <button onClick={() => setEditOpening(false)}
            style={{ ...inp, background: '#ffcccc', border: '1px solid #c00', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ── UMUMIY SANA ORALIG'I FILTRI ───────────────────────────────────── */}
      <DateRangeFilter value={range} onChange={setRange} color="#6a1b9a" />

      {/* ── TAB TUGMALARI ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #ccc', marginBottom: 0 }}>
        <TabBtn active={activeTab === 'kirim'}  onClick={() => setActiveTab('kirim')}
          color={ACCENT}   label={`↑ ${L.kirim[lang]} (${fmt(totalClickIncome)})`} />
        <TabBtn active={activeTab === 'chiqim'} onClick={() => setActiveTab('chiqim')}
          color="#c62828"  label={`↓ ${L.chiqim[lang]} (${fmt(totalClickExpense)})`} />
      </div>

      {/* ══ KIRIM CLICK TAB ═══════════════════════════════════════════════════ */}
      {activeTab === 'kirim' && (
        <div style={{ border: '1px solid #ccc', borderTop: 'none', padding: 14 }}>

          {/* Click turi */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 'bold', color: '#666' }}>To'lov tizimi:</span>
            {CLICK_TYPES.map(t => (
              <button key={t.v} type="button"
                onClick={() => setIncForm({ ...incForm, type: t.v })}
                style={{
                  padding: '3px 12px', cursor: 'pointer', fontSize: 12,
                  border: `2px solid ${t.color}`,
                  background: incForm.type === t.v ? t.color : '#fff',
                  color: incForm.type === t.v ? '#fff' : t.color,
                  fontWeight: 'bold', borderRadius: 3,
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Forma */}
          <form onSubmit={handleAddIncome} style={{
            display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap',
            padding: '8px 10px', background: ACC_LITE, border: `1px solid ${ACCENT}66`, borderRadius: 4,
          }}>
            <input type="number" placeholder="Summa" value={incForm.amount}
              onChange={e => setIncForm({ ...incForm, amount: e.target.value })}
              style={{ ...inp, width: 140 }} required />
            <CustomerSelect
              value={incForm.desc}
              onChange={val => setIncForm({ ...incForm, desc: val })}
              placeholder={L.izoh[lang]}
              width={220}
              accentColor={ACCENT}
              style={{ border: '1px solid #ccc', borderRadius: 3 }}
              required
            />
            <span style={{ fontSize: 12, fontWeight: 'bold', color: ACCENT, alignSelf: 'center' }}>{L.kim[lang]}</span>
            <select value={currentWorker} onChange={e => setCurrentWorker(e.target.value)}
              style={{ ...inp, color: currentWorker ? ACCENT : '#999', fontWeight: currentWorker ? 'bold' : 'normal' }}>
              <option value="">— xodim —</option>
              {XODIMLAR.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            <button type="submit"
              style={{ ...inp, background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', padding: '4px 18px' }}>
              ↑ {L.qoshish[lang]}
            </button>
          </form>

          {/* Filter */}
          <FilterBar
            showAll={incShowAll} setShowAll={setIncShowAll}
            filterDate={incFilterDate} setFilterDate={setIncFilterDate}
            filterWorker={incFilterWorker} setFilterWorker={setIncFilterWorker}
            workerList={incWorkers} filteredCount={filteredInc.length}
            filteredTotal={filteredIncTotal} color={ACCENT} btnS={btnS} inp={inp} L={L} lang={lang}
          />

          <div style={{ marginBottom: 10 }}>
            <ExcelExport filename="Click_kirim" sheetName="Click kirim" title="Kirim (Click)"
              columns={clickExportColumns} rows={filteredInc} />
          </div>

          {/* Jadval */}
          <RowsTable rows={filteredInc} total={filteredIncTotal}
            onDelete={handleDelIncome} amountColor={ACCENT} todayStr={todayStr()} jami={L.jami[lang]} />
        </div>
      )}

      {/* ══ CHIQIM CLICK TAB ══════════════════════════════════════════════════ */}
      {activeTab === 'chiqim' && (
        <div style={{ border: '1px solid #ccc', borderTop: 'none', padding: 14 }}>

          {/* Forma */}
          <form onSubmit={handleAddExpense} style={{
            display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap',
            padding: '8px 10px', background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 4,
          }}>
            <input type="number" placeholder="Summa" value={expForm.amount}
              onChange={e => setExpForm({ ...expForm, amount: e.target.value })}
              style={{ ...inp, width: 140 }} required />
            <CustomerSelect
              value={expForm.desc}
              onChange={val => setExpForm({ ...expForm, desc: val })}
              placeholder={L.izohCh[lang]}
              width={220}
              accentColor="#c62828"
              style={{ border: '1px solid #ccc', borderRadius: 3 }}
              required
            />
            <span style={{ fontSize: 12, fontWeight: 'bold', color: '#c62828', alignSelf: 'center' }}>{L.kim[lang]}</span>
            <select value={currentWorker} onChange={e => setCurrentWorker(e.target.value)}
              style={{ ...inp, color: currentWorker ? '#c62828' : '#999', fontWeight: currentWorker ? 'bold' : 'normal' }}>
              <option value="">— xodim —</option>
              {XODIMLAR.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            <button type="submit"
              style={{ ...inp, background: '#c62828', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', padding: '4px 18px' }}>
              ↓ {L.qoshish[lang]}
            </button>
          </form>

          {/* Filter */}
          <FilterBar
            showAll={expShowAll} setShowAll={setExpShowAll}
            filterDate={expFilterDate} setFilterDate={setExpFilterDate}
            filterWorker={expFilterWorker} setFilterWorker={setExpFilterWorker}
            workerList={expWorkers} filteredCount={filteredExp.length}
            filteredTotal={filteredExpTotal} color="#c62828" btnS={btnS} inp={inp} L={L} lang={lang}
          />

          <div style={{ marginBottom: 10 }}>
            <ExcelExport filename="Click_chiqim" sheetName="Click chiqim" title="Chiqim (Click)"
              columns={clickExportColumns} rows={filteredExp} />
          </div>

          {/* Jadval */}
          <RowsTable rows={filteredExp} total={filteredExpTotal}
            onDelete={handleDelExpense} amountColor="#c62828" todayStr={todayStr()} jami={L.jami[lang]} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB TUGMASI
// ─────────────────────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, label, color }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 22px', cursor: 'pointer', border: 'none',
      borderBottom: active ? `3px solid ${color}` : '3px solid transparent',
      background: active ? '#fff' : '#f5f5f5',
      color: active ? color : '#555',
      fontFamily: 'Tahoma, sans-serif', fontSize: 13,
      fontWeight: active ? 'bold' : 'normal',
      marginBottom: active ? -2 : 0,
      transition: 'all 0.15s',
    }}>{label}</button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER BAR
// ─────────────────────────────────────────────────────────────────────────────
function FilterBar({ showAll, setShowAll, filterDate, setFilterDate, filterWorker, setFilterWorker, workerList, filteredCount, filteredTotal, color, btnS, inp, L, lang }) {
  const todayS = (() => {
    const d = new Date();
    return [String(d.getDate()).padStart(2,'0'), String(d.getMonth()+1).padStart(2,'0'), d.getFullYear()].join('.');
  })();
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, fontWeight: 'bold' }}>{L.filter_sana[lang]}</span>
      <input type="text" placeholder="dd.mm.yyyy" value={filterDate}
        onChange={e => { setFilterDate(e.target.value); setShowAll(false); }}
        disabled={showAll}
        style={{ ...inp, width: 90, background: showAll ? '#e0e0e0' : '#fff' }} />
      <button onClick={() => { setFilterDate(todayS); setShowAll(false); }} style={btnS(!showAll && filterDate === todayS)}>
        {L.bugun[lang]}
      </button>
      <button onClick={() => setShowAll(v => !v)} style={btnS(showAll)}>
        {L.barchasi[lang]}
      </button>
      {workerList.length > 0 && (
        <>
          <span style={{ fontSize: 12, fontWeight: 'bold', marginLeft: 8 }}>{L.filter_xod[lang]}</span>
          <select value={filterWorker} onChange={e => setFilterWorker(e.target.value)} style={inp}>
            <option value="">{L.hammasi[lang]}</option>
            {workerList.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </>
      )}
      <span style={{ marginLeft: 6, color: '#888', fontSize: 11 }}>
        ({filteredCount} ta · <b style={{ color }}>{(Number(filteredTotal)||0).toLocaleString('ru-RU').replace(/,/g,' ')}</b> so'm)
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JADVAL
// ─────────────────────────────────────────────────────────────────────────────
function RowsTable({ rows, total, onDelete, amountColor, todayStr: today, jami }) {
  const PAGE_SIZE = 100;
  const [page, setPage] = useState(1);
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (rows.length === 0)
    return <p style={{ color: '#888', fontStyle: 'italic', marginTop: 16 }}>Yozuv topilmadi.</p>;

  const fmt2 = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
  const fmtT = (ts) => {
    if (!ts || ts < 1e10) return '—';
    const d = new Date(ts);
    return [String(d.getHours()).padStart(2,'0'), String(d.getMinutes()).padStart(2,'0'), String(d.getSeconds()).padStart(2,'0')].join(':');
  };

  return (
    <>
    <table className="data-table" style={{ width: '100%', maxWidth: 820 }}>
      <thead>
        <tr>
          <th style={{ width: 30 }}>#</th>
          <th style={{ width: 68 }}>Vaqt</th>
          <th style={{ width: 88 }}>Sana</th>
          <th style={{ width: 110 }}>Xodim</th>
          <th>Izoh</th>
          <th style={{ textAlign: 'right', width: 140 }}>Summa</th>
          <th style={{ width: 40 }}></th>
        </tr>
      </thead>
      <tbody>
        {paged.map((r, i) => {
          const isToday = r.date === today;
          return (
            <tr key={r.id} style={{ background: isToday ? '#f3e5f5' : (i % 2 === 0 ? '#fff' : '#f9f9f9') }}>
              <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
              <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', color: '#555' }}>
                {fmtT(r.createdAt || (r.id > 1e10 ? r.id : null))}
              </td>
              <td style={{ fontSize: 12 }}>
                {r.date || '—'}
                {isToday && (
                  <span style={{ marginLeft: 3, fontSize: 9, padding: '1px 4px', background: amountColor, color: '#fff', borderRadius: 8 }}>bugun</span>
                )}
              </td>
              <td style={{ fontSize: 12, color: '#333', fontWeight: r.worker ? 'bold' : 'normal' }}>{r.worker || '—'}</td>
              <td style={{ fontSize: 13 }}>{r.desc || '—'}</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold', color: amountColor, fontFamily: 'monospace', fontSize: 13 }}>
                {fmt2(r.amount)}
              </td>
              <td style={{ textAlign: 'center' }}>
                <button onClick={() => onDelete(r.id)}
                  style={{ fontSize: 10, cursor: 'pointer', background: '#ffebee', border: '1px solid #e53935', padding: '2px 6px', borderRadius: 3, color: '#c62828' }}>✕</button>
              </td>
            </tr>
          );
        })}
        <tr style={{ background: '#ffff00', fontWeight: 'bold' }}>
          <td colSpan={5} style={{ textAlign: 'right', paddingRight: 8 }}>{jami}</td>
          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: amountColor, fontSize: 14 }}>{fmt2(total)}</td>
          <td />
        </tr>
      </tbody>
    </table>
    <Paginator total={rows.length} page={page} setPage={setPage} pageSize={PAGE_SIZE} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATISTIKA KARTOCHKASI
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, bg, sub, bold, arrow, clickable, onEdit }) {
  return (
    <div style={{
      padding: '8px 14px', background: bg,
      border: `1px solid ${color}33`, borderLeft: `4px solid ${color}`,
      borderRadius: 4, minWidth: 155,
      cursor: clickable ? 'pointer' : 'default',
    }} onClick={onEdit} title={clickable ? 'Bosib tahrirlash' : undefined}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>
        {label}{clickable && <span style={{ marginLeft: 4, fontSize: 10, color: '#999' }}>✎</span>}
      </div>
      <div style={{ fontSize: 15, fontWeight: bold ? 700 : 'bold', color, fontFamily: 'monospace' }}>
        {arrow && <span style={{ marginRight: 3 }}>{arrow}</span>}{value} so'm
      </div>
      {sub && <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
