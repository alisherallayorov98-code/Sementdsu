import { useState } from 'react';
import { useData } from '../context/DataContext';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');

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

const L = {
  kirim:        { latn: 'Kirim bank',        cyrl: 'Кирим банк'         },
  chiqim:       { latn: 'Chiqim bank',       cyrl: 'Чиқим банк'         },
  summa:        { latn: 'Summa',             cyrl: 'Сумма'               },
  izoh:         { latn: 'Izoh / Kontragent', cyrl: 'Изоҳ / Контрагент'  },
  izohChiqim:   { latn: 'Izoh / Maqsad',    cyrl: 'Изоҳ / Мақсад'      },
  qoshish:      { latn: "Qo'shish",          cyrl: 'Қўшиш'               },
  sana:         { latn: 'Sana',              cyrl: 'Сана'                 },
  vaqt:         { latn: 'Vaqt',              cyrl: 'Вақт'                 },
  xodim:        { latn: 'Xodim',             cyrl: 'Ходим'                },
  jami:         { latn: 'JAMI',              cyrl: 'ЖАМИ'                 },
  bugun:        { latn: 'Bugun',             cyrl: 'Бугун'                },
  barchasi:     { latn: 'Barchasi',          cyrl: 'Барчаси'              },
  hammasi:      { latn: 'Hammasi',           cyrl: 'Ҳаммаси'              },
  yoq:          { latn: 'Yozuv topilmadi.',  cyrl: 'Ёзув топилмади.'     },
  ochilish:     { latn: "Ochilish qoldig'i", cyrl: 'Очилиш қолдиғи'     },
  netBalans:    { latn: 'Sof bank balansi',  cyrl: 'Соф банк баланси'    },
  jamiKirim:    { latn: 'Jami kirim',        cyrl: 'Жами кирим'           },
  jamiChiqim:   { latn: 'Jami chiqim',       cyrl: 'Жами чиқим'           },
  bugunKirim:   { latn: 'Bugungi kirim',     cyrl: 'Бугунги кирим'        },
  bugunChiqim:  { latn: 'Bugungi chiqim',    cyrl: 'Бугунги чиқим'        },
  filter_sana:  { latn: 'Sana:',             cyrl: 'Сана:'                },
  filter_xod:   { latn: 'Xodim:',            cyrl: 'Ходим:'               },
  kim:          { latn: 'Kim:',              cyrl: 'Ким:'                  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ASOSIY KOMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function IncomeBank({ lang }) {
  const {
    bankOpening, setBankOpening,
    bankIncomeRows,  addBankIncomeRow,  deleteBankIncomeRow,  totalBankIncome,
    bankExpenseRows, addBankExpenseRow, deleteBankExpenseRow, totalBankExpense,
    bankNetBalance,
    currentWorker, setCurrentWorker,
  } = useData();

  // Aktiv tab: 'kirim' | 'chiqim'
  const [activeTab, setActiveTab] = useState('kirim');

  // Formalar
  const [incForm, setIncForm] = useState({ amount: '', desc: '' });
  const [expForm, setExpForm] = useState({ amount: '', desc: '' });

  // Filterlar (alohida kirim va chiqim uchun)
  const [incFilterDate,   setIncFilterDate]   = useState('');
  const [incShowAll,      setIncShowAll]       = useState(true);
  const [incFilterWorker, setIncFilterWorker]  = useState('');
  const [expFilterDate,   setExpFilterDate]    = useState('');
  const [expShowAll,      setExpShowAll]       = useState(true);
  const [expFilterWorker, setExpFilterWorker]  = useState('');

  // Ochilish tahrirlash
  const [editOpening, setEditOpening]   = useState(false);
  const [openingVal,  setOpeningVal]    = useState(String(bankOpening.amount));

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddIncome = (e) => {
    e.preventDefault();
    if (!incForm.amount || !incForm.desc) return;
    addBankIncomeRow(incForm.amount, incForm.desc);
    setIncForm({ amount: '', desc: '' });
  };

  const handleAddExpense = (e) => {
    e.preventDefault();
    if (!expForm.amount || !expForm.desc) return;
    addBankExpenseRow(expForm.amount, expForm.desc);
    setExpForm({ amount: '', desc: '' });
  };

  const handleDelIncome  = (id) => { if (window.confirm("O'chirasizmi?")) deleteBankIncomeRow(id); };
  const handleDelExpense = (id) => { if (window.confirm("O'chirasizmi?")) deleteBankExpenseRow(id); };

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

  const sortedInc = sortRows(bankIncomeRows);
  const sortedExp = sortRows(bankExpenseRows);

  const filteredInc = applyFilter(sortedInc, incShowAll, incFilterDate, incFilterWorker);
  const filteredExp = applyFilter(sortedExp, expShowAll, expFilterDate, expFilterWorker);

  const incWorkers = [...new Set(sortedInc.map(r => r.worker).filter(Boolean))];
  const expWorkers = [...new Set(sortedExp.map(r => r.worker).filter(Boolean))];

  const filteredIncTotal = filteredInc.reduce((s, r) => s + Number(r.amount || 0), 0);
  const filteredExpTotal = filteredExp.reduce((s, r) => s + Number(r.amount || 0), 0);

  const todayInc = bankIncomeRows.filter(r => r.date === todayStr()).reduce((s, r) => s + Number(r.amount || 0), 0);
  const todayExp = bankExpenseRows.filter(r => r.date === todayStr()).reduce((s, r) => s + Number(r.amount || 0), 0);

  // ── Stil yordamchilar ─────────────────────────────────────────────────────
  const inp = {
    padding: '4px 6px', fontFamily: 'Tahoma, sans-serif',
    fontSize: 12, border: '1px solid #ccc', borderRadius: 3,
  };
  const btnS = (active) => ({
    padding: '3px 10px', fontFamily: 'Tahoma, sans-serif', fontSize: 12,
    cursor: 'pointer',
    border: active ? '2px inset #ffffff' : '2px outset #ffffff',
    background: active ? '#003366' : '#f0f0f0',
    color: active ? '#fff' : '#333',
    fontWeight: active ? 'bold' : 'normal',
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>

      {/* ── YUQORI STATISTIKA PANELI ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {/* Ochilish */}
        <StatCard
          label={L.ochilish[lang]}
          value={fmt(bankOpening.amount)}
          color="#555" bg="#f5f5f5"
          sub={bankOpening.date}
          clickable onEdit={() => setEditOpening(v => !v)}
        />
        {/* Jami kirim */}
        <StatCard label={L.jamiKirim[lang]}  value={fmt(totalBankIncome)}  color="#0d47a1" bg="#e3f2fd"
          sub={`Bugun: ${fmt(todayInc)}`} arrow="↑" />
        {/* Jami chiqim */}
        <StatCard label={L.jamiChiqim[lang]} value={fmt(totalBankExpense)} color="#b71c1c" bg="#ffebee"
          sub={`Bugun: ${fmt(todayExp)}`} arrow="↓" />
        {/* Sof balans */}
        <StatCard
          label={L.netBalans[lang]}
          value={fmt(bankNetBalance)}
          color={bankNetBalance >= 0 ? '#1b5e20' : '#b71c1c'}
          bg={bankNetBalance >= 0 ? '#e8f5e9' : '#ffebee'}
          sub="Ochilish + Kirim − Chiqim"
          bold
        />
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
          <button
            onClick={() => { setBankOpening({ ...bankOpening, amount: Number(openingVal) }); setEditOpening(false); }}
            style={{ ...inp, background: '#003366', color: '#fff', border: 'none', cursor: 'pointer', padding: '4px 14px' }}
          >✓ Saqlash</button>
          <button onClick={() => setEditOpening(false)}
            style={{ ...inp, background: '#ffcccc', border: '1px solid #c00', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ── TAB TUGMALARI ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 0, borderBottom: '2px solid #ccc' }}>
        <TabBtn
          active={activeTab === 'kirim'}
          onClick={() => setActiveTab('kirim')}
          color="#0d47a1"
          label={`↑ ${L.kirim[lang]} (${fmt(totalBankIncome)})`}
        />
        <TabBtn
          active={activeTab === 'chiqim'}
          onClick={() => setActiveTab('chiqim')}
          color="#b71c1c"
          label={`↓ ${L.chiqim[lang]} (${fmt(totalBankExpense)})`}
        />
      </div>

      {/* ══ KIRIM BANK TAB ════════════════════════════════════════════════════ */}
      {activeTab === 'kirim' && (
        <div style={{ border: '1px solid #ccc', borderTop: 'none', padding: 14 }}>

          {/* Forma */}
          <form onSubmit={handleAddIncome} style={{
            display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap',
            padding: '8px 10px', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 4,
          }}>
            <input type="number" placeholder="Summa" value={incForm.amount}
              onChange={e => setIncForm({ ...incForm, amount: e.target.value })}
              style={{ ...inp, width: 140 }} required />
            <input type="text" placeholder={L.izoh[lang]} value={incForm.desc}
              onChange={e => setIncForm({ ...incForm, desc: e.target.value })}
              style={{ ...inp, width: 230 }} required />
            <span style={{ fontSize: 12, fontWeight: 'bold', color: '#003366', alignSelf: 'center' }}>{L.kim[lang]}</span>
            <select value={currentWorker} onChange={e => setCurrentWorker(e.target.value)}
              style={{ ...inp, color: currentWorker ? '#003366' : '#999', fontWeight: currentWorker ? 'bold' : 'normal' }}>
              <option value="">— xodim —</option>
              {XODIMLAR.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            <button type="submit"
              style={{ ...inp, background: '#0d47a1', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', padding: '4px 18px' }}>
              ↑ {L.qoshish[lang]}
            </button>
          </form>

          {/* Filter */}
          <FilterBar lang={lang} L={L}
            showAll={incShowAll} setShowAll={setIncShowAll}
            filterDate={incFilterDate} setFilterDate={setIncFilterDate}
            filterWorker={incFilterWorker} setFilterWorker={setIncFilterWorker}
            workerList={incWorkers} filteredCount={filteredInc.length}
            filteredTotal={filteredIncTotal} color="#0d47a1" btnS={btnS} inp={inp}
          />

          {/* Jadval */}
          <RowsTable
            rows={filteredInc} color="#0d47a1" total={filteredIncTotal}
            onDelete={handleDelIncome} lang={lang} L={L} jami={L.jami[lang]}
            amountColor="#0d47a1" todayStr={todayStr()}
          />
        </div>
      )}

      {/* ══ CHIQIM BANK TAB ═══════════════════════════════════════════════════ */}
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
            <input type="text" placeholder={L.izohChiqim[lang]} value={expForm.desc}
              onChange={e => setExpForm({ ...expForm, desc: e.target.value })}
              style={{ ...inp, width: 230 }} required />
            <span style={{ fontSize: 12, fontWeight: 'bold', color: '#b71c1c', alignSelf: 'center' }}>{L.kim[lang]}</span>
            <select value={currentWorker} onChange={e => setCurrentWorker(e.target.value)}
              style={{ ...inp, color: currentWorker ? '#b71c1c' : '#999', fontWeight: currentWorker ? 'bold' : 'normal' }}>
              <option value="">— xodim —</option>
              {XODIMLAR.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            <button type="submit"
              style={{ ...inp, background: '#b71c1c', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', padding: '4px 18px' }}>
              ↓ {L.qoshish[lang]}
            </button>
          </form>

          {/* Filter */}
          <FilterBar lang={lang} L={L}
            showAll={expShowAll} setShowAll={setExpShowAll}
            filterDate={expFilterDate} setFilterDate={setExpFilterDate}
            filterWorker={expFilterWorker} setFilterWorker={setExpFilterWorker}
            workerList={expWorkers} filteredCount={filteredExp.length}
            filteredTotal={filteredExpTotal} color="#b71c1c" btnS={btnS} inp={inp}
          />

          {/* Jadval */}
          <RowsTable
            rows={filteredExp} color="#b71c1c" total={filteredExpTotal}
            onDelete={handleDelExpense} lang={lang} L={L} jami={L.jami[lang]}
            amountColor="#b71c1c" todayStr={todayStr()}
          />
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
    <button
      onClick={onClick}
      style={{
        padding: '8px 22px', cursor: 'pointer', border: 'none',
        borderBottom: active ? `3px solid ${color}` : '3px solid transparent',
        background: active ? '#fff' : '#f5f5f5',
        color: active ? color : '#555',
        fontFamily: 'Tahoma, sans-serif', fontSize: 13,
        fontWeight: active ? 'bold' : 'normal',
        marginBottom: active ? -2 : 0,
        transition: 'all 0.15s',
      }}
    >{label}</button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER BAR
// ─────────────────────────────────────────────────────────────────────────────
function FilterBar({ lang, L, showAll, setShowAll, filterDate, setFilterDate, filterWorker, setFilterWorker, workerList, filteredCount, filteredTotal, color, btnS, inp }) {
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
        style={{ ...inp, width: 90, background: showAll ? '#e0e0e0' : '#fff' }}
      />
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
function RowsTable({ rows, total, onDelete, L, jami, amountColor, todayStr: today }) {
  if (rows.length === 0)
    return <p style={{ color: '#888', fontStyle: 'italic', marginTop: 16 }}>{L.yoq?.latn || 'Yozuv topilmadi.'}</p>;

  const fmt2 = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
  const fmtT = (ts) => {
    if (!ts || ts < 1e10) return '—';
    const d = new Date(ts);
    return [String(d.getHours()).padStart(2,'0'), String(d.getMinutes()).padStart(2,'0'), String(d.getSeconds()).padStart(2,'0')].join(':');
  };

  return (
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
        {rows.map((r, i) => {
          const isToday = r.date === today;
          return (
            <tr key={r.id} style={{ background: isToday ? (amountColor === '#0d47a1' ? '#e8f0ff' : '#fff0f0') : (i % 2 === 0 ? '#fff' : '#f9f9f9') }}>
              <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{i + 1}</td>
              <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', color: '#555' }}>
                {fmtT(r.createdAt || (r.id > 1e10 ? r.id : null))}
              </td>
              <td style={{ fontSize: 12 }}>
                {r.date || '—'}
                {isToday && (
                  <span style={{
                    marginLeft: 3, fontSize: 9, padding: '1px 4px',
                    background: amountColor, color: '#fff', borderRadius: 8,
                  }}>bugun</span>
                )}
              </td>
              <td style={{ fontSize: 12, color: '#003366', fontWeight: r.worker ? 'bold' : 'normal' }}>
                {r.worker || '—'}
              </td>
              <td style={{ fontSize: 13 }}>{r.desc || '—'}</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold', color: amountColor, fontFamily: 'monospace', fontSize: 13 }}>
                {fmt2(r.amount)}
              </td>
              <td style={{ textAlign: 'center' }}>
                <button onClick={() => onDelete(r.id)}
                  style={{ fontSize: 10, cursor: 'pointer', background: '#ffebee', border: '1px solid #e53935', padding: '2px 6px', borderRadius: 3, color: '#c62828' }}>
                  ✕
                </button>
              </td>
            </tr>
          );
        })}
        <tr style={{ background: '#ffff00', fontWeight: 'bold' }}>
          <td colSpan={5} style={{ textAlign: 'right', paddingRight: 8 }}>{jami}</td>
          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: amountColor, fontSize: 14 }}>
            {fmt2(total)}
          </td>
          <td />
        </tr>
      </tbody>
    </table>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATISTIKA KARTOCHKASI
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, bg, sub, bold, arrow, clickable, onEdit }) {
  return (
    <div
      style={{
        padding: '8px 14px', background: bg,
        border: `1px solid ${color}33`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 4, minWidth: 155,
        cursor: clickable ? 'pointer' : 'default',
      }}
      onClick={onEdit}
      title={clickable ? 'Bosib tahrirlash' : undefined}
    >
      <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>
        {label}
        {clickable && <span style={{ marginLeft: 4, fontSize: 10, color: '#999' }}>✎</span>}
      </div>
      <div style={{ fontSize: 15, fontWeight: bold ? 700 : 'bold', color, fontFamily: 'monospace' }}>
        {arrow && <span style={{ marginRight: 3 }}>{arrow}</span>}
        {value} so'm
      </div>
      {sub && <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
