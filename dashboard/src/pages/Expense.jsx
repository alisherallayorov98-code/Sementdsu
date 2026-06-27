import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import CustomerSelect from '../components/CustomerSelect';
import ExcelExport from '../components/ExcelExport';
import DateRangeFilter from '../components/DateRangeFilter';
import Paginator from '../components/Paginator';
import { filterByRange } from '../lib/dateRange';

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

// Chiqim turlari
const EXPENSE_TYPES = [
  { value: 'naqd',          latn: 'Naqd chiqim',    cyrl: 'Нақд чиқим',     color: '#cc0000', bg: '#fff0f0' },
  { value: 'kassir_chiqim', latn: 'Kassir chiqim',  cyrl: 'Кассир чиқим',   color: '#8b0044', bg: '#fff0f8' },
  { value: 'oylik',         latn: 'Xodim oyligi',   cyrl: 'Ходим ойлиги',   color: '#993300', bg: '#fff5ee' },
  { value: 'sement',        latn: "Zavodga to'lov",  cyrl: 'Заводга тўлов',  color: '#006699', bg: '#f0f8ff' },
  { value: 'avans',         latn: 'Avans',           cyrl: 'Аванс',          color: '#cc6600', bg: '#fffbf0' },
];

const typeInfo = (val) => EXPENSE_TYPES.find(t => t.value === val) || { color: '#333', bg: '#fff', latn: val, cyrl: val };

const XODIMLAR = [
  'Botir aka', 'Alisher aka', 'Ganisher aka', 'Sharofidin',
  'Saloh', 'Qosim', 'Anvarjon',
];

const L = {
  tur:        { latn: 'Tur',            cyrl: 'Тур'           },
  summa:      { latn: 'Summa',          cyrl: 'Сумма'         },
  izoh:       { latn: 'Izoh / Xodim',  cyrl: 'Изоҳ / Ходим' },
  qoshish:    { latn: "Qo'shish",      cyrl: 'Қўшиш'         },
  sana:       { latn: 'Sana',          cyrl: 'Сана'           },
  vaqt:       { latn: 'Vaqt',          cyrl: 'Вақт'           },
  xodim:      { latn: 'Xodim',         cyrl: 'Ходим'          },
  jami:       { latn: 'JAMI',          cyrl: 'ЖАМИ'           },
  hammasi:    { latn: 'Hammasi',        cyrl: 'Ҳаммаси'       },
  filter_tur: { latn: 'Tur:',          cyrl: 'Тур:'           },
  filter_xod: { latn: 'Xodim:',        cyrl: 'Ходим:'         },
  yoq:        { latn: 'Yozuv topilmadi.', cyrl: 'Ёзув топилмади.' },
  tonna:      { latn: 'Tonna',         cyrl: 'Тонна'          },
};

export default function Expense({ lang }) {
  const {
    expenseRows, addExpenseRow, deleteExpenseRow,
    workers, supplierPayments, advanceRows,
    cashRows, bankRows, clickRows,
    currentWorker, setCurrentWorker,
  } = useData();

  const [form, setForm] = useState({ amount: '', desc: '' });
  const [filterType,   setFilterType]   = useState('');
  const [filterWorker, setFilterWorker] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;

  // ── Naqd chiqim qo'shish ─────────────────────────────────────────────────
  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.amount || !form.desc) return;
    addExpenseRow(form.amount, form.desc);
    setForm({ amount: '', desc: '' });
  };

  // ── Barcha chiqimlarni yig'ish ───────────────────────────────────────────
  const allRows = [
    // Naqd chiqim
    ...expenseRows.map(r => ({
      id: r.id, srcType: 'naqd', date: r.date,
      createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
      worker: r.worker || '', izoh: r.desc,
      summa: r.amount, canDelete: true,
    })),

    // Xodim oyligi (to'langan)
    ...workers
      .filter(w => Number(w.paid) > 0)
      .map(w => ({
        id: 'wkr_' + w.id, srcType: 'oylik', date: '—',
        createdAt: w.createdAt || (w.id > 1e10 ? w.id : null),
        worker: w.worker || '',
        izoh: `${w.name} (oylik: ${fmt(w.salary)})`,
        summa: Number(w.paid), canDelete: false,
      })),

    // Zavodga (yetkazib beruvchiga) to'lov — haqiqiy pul chiqimi
    ...supplierPayments.map(p => ({
      id: 'sup_' + p.id, srcType: 'sement', date: p.date,
      createdAt: p.createdAt || (p.id > 1e10 ? p.id : null),
      worker: p.worker || '',
      izoh: `${p.supplier} · ${({ naqd: 'Naqd', bank: 'Bank', click: 'Click' }[p.channel] || p.channel || '')}` + (p.note ? ` (${p.note})` : ''),
      summa: Number(p.amount || 0),
      canDelete: false,
    })),

    // Avans berilgan
    ...advanceRows
      .filter(r => Number(r.amount) > 0)
      .map(r => ({
        id: 'adv_' + r.id, srcType: 'avans', date: r.date,
        createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
        worker: r.worker || '',
        izoh: r.customer + (r.note ? ` (${r.note})` : ''),
        summa: Number(r.amount),
        qolgan: Number(r.amount) - Number(r.used || 0),
        canDelete: false,
      })),
    // Kassir qo'lda chiqim (cashRows/bankRows/clickRows — faqat manual yozuvlar)
    ...(cashRows || []).filter(r => !r.auto && Number(r.amount) < 0).map(r => ({
      id: 'kc_' + r.id, srcType: 'kassir_chiqim', date: r.date,
      createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
      worker: r.worker || '', izoh: (r.desc || '') + ' [Naqd]',
      summa: Math.abs(Number(r.amount)), canDelete: false,
    })),
    ...(bankRows || []).filter(r => !r.auto && Number(r.amount) < 0).map(r => ({
      id: 'kb_' + r.id, srcType: 'kassir_chiqim', date: r.date,
      createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
      worker: r.worker || '', izoh: (r.desc || '') + ' [Bank]',
      summa: Math.abs(Number(r.amount)), canDelete: false,
    })),
    ...(clickRows || []).filter(r => !r.auto && Number(r.amount) < 0).map(r => ({
      id: 'kck_' + r.id, srcType: 'kassir_chiqim', date: r.date,
      createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
      worker: r.worker || '', izoh: (r.desc || '') + ' [Click]',
      summa: Math.abs(Number(r.amount)), canDelete: false,
    })),
  ];

  // Vaqt bo'yicha saralash — yangi tepada
  allRows.sort((a, b) => {
    const ta = a.createdAt || 0;
    const tb = b.createdAt || 0;
    return tb - ta;
  });

  // Noyob xodimlar (filter uchun)
  const workerList = [...new Set(allRows.map(r => r.worker).filter(Boolean))];

  // Filtrlash
  let filtered = allRows;
  if (filterType)   filtered = filtered.filter(r => r.srcType === filterType);
  if (filterWorker) filtered = filtered.filter(r => r.worker === filterWorker);
  filtered = filterByRange(filtered, range);

  // ── Jami har bir tur bo'yicha ─────────────────────────────────────────────
  const totals = {};
  EXPENSE_TYPES.forEach(t => {
    totals[t.value] = allRows.filter(r => r.srcType === t.value).reduce((s, r) => s + Number(r.summa || 0), 0);
  });
  const grandTotal    = Object.values(totals).reduce((s, v) => s + v, 0);
  const filteredTotal = filtered.reduce((s, r) => s + Number(r.summa || 0), 0);
  useEffect(() => { setPage(1); }, [filterType, filterWorker, range.from, range.to]);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const inp = { padding: '3px 6px', fontFamily: 'Tahoma, sans-serif', fontSize: 12, border: '2px inset #ffffff' };
  const btnStyle = (active) => ({
    padding: '3px 10px', fontFamily: 'Tahoma, sans-serif', fontSize: 12,
    cursor: 'pointer',
    border: active ? '2px inset #ffffff' : '2px outset #ffffff',
    background: active ? '#003366' : '#f0f0f0',
    color: active ? '#fff' : '#000',
    fontWeight: active ? 'bold' : 'normal',
  });

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>

      {/* ── Naqd chiqim qo'shish formasi ──────────────────────────────── */}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 5, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Tur (faqat naqd qo'shish mumkin) */}
        <span style={{
          padding: '3px 12px', fontWeight: 'bold', fontSize: 12,
          background: '#fff0f0', color: '#cc0000',
          border: '2px inset #ffffff',
        }}>
          Naqd chiqim
        </span>
        {/* Summa */}
        <input
          type="number" placeholder="Summa" value={form.amount}
          onChange={e => setForm({ ...form, amount: e.target.value })}
          style={{ ...inp, width: 130 }} required
        />
        {/* Izoh — CustomerSelect */}
        <CustomerSelect
          value={form.desc}
          onChange={val => setForm({ ...form, desc: val })}
          placeholder={L.izoh[lang]}
          width={220}
          accentColor="#8b0000"
          style={{ border: '2px inset #ffffff', fontFamily: 'Tahoma, sans-serif', fontSize: 12 }}
          required
        />
        {/* Kim */}
        <select
          value={currentWorker}
          onChange={e => setCurrentWorker(e.target.value)}
          style={{ ...inp, color: currentWorker ? '#003366' : '#999', fontWeight: currentWorker ? 'bold' : 'normal' }}
        >
          <option value="">— xodim —</option>
          {XODIMLAR.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
        <button type="submit" style={{ ...inp, border: '2px outset #ffffff', cursor: 'pointer', background: '#8b0000', color: '#fff', fontWeight: 'bold', padding: '3px 16px' }}>
          {L.qoshish[lang]}
        </button>
      </form>

      {/* ── Jami xulosasi (tur bo'yicha) ──────────────────────────────── */}
      <table style={{ borderCollapse: 'collapse', marginBottom: 10, width: '100%', maxWidth: 900 }}>
        <tbody>
          <tr>
            {EXPENSE_TYPES.map(t => (
              <td key={t.value} style={{
                border: '1px solid #999', padding: '5px 10px',
                background: t.bg, textAlign: 'center', minWidth: 160,
              }}>
                <div style={{ fontSize: 11, fontWeight: 'bold', color: t.color }}>
                  {t[lang === 'cyrl' ? 'cyrl' : 'latn']}
                </div>
                <div style={{ fontSize: 14, fontWeight: 'bold', color: t.color, fontFamily: 'monospace' }}>
                  {fmt(totals[t.value])}
                </div>
              </td>
            ))}
            <td style={{
              border: '2px solid #8b0000', padding: '5px 10px',
              background: '#8b0000', textAlign: 'center', minWidth: 160,
            }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: '#ffaaaa' }}>JAMI CHIQIM</div>
              <div style={{ fontSize: 15, fontWeight: 'bold', color: '#fff', fontFamily: 'monospace' }}>
                {fmt(grandTotal)}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Sana oralig'i filtri ──────────────────────────────────────── */}
      <DateRangeFilter value={range} onChange={setRange} color="#8b0000" />

      {/* ── Filter paneli ──────────────────────────────────────────────── */}
      <table style={{ borderCollapse: 'collapse', marginBottom: 8 }}>
        <tbody>
          <tr>
            <td style={{ paddingRight: 5, fontWeight: 'bold', fontSize: 12 }}>{L.filter_tur[lang]}</td>
            <td style={{ paddingRight: 4 }}>
              <button onClick={() => setFilterType('')} style={btnStyle(!filterType)}>{L.hammasi[lang]}</button>
            </td>
            {EXPENSE_TYPES.map(t => (
              <td key={t.value} style={{ paddingRight: 4 }}>
                <button
                  onClick={() => setFilterType(filterType === t.value ? '' : t.value)}
                  style={{
                    ...btnStyle(filterType === t.value),
                    background: filterType === t.value ? t.color : '#f0f0f0',
                    color: filterType === t.value ? '#fff' : t.color,
                    fontWeight: 'bold',
                  }}
                >
                  {t[lang === 'cyrl' ? 'cyrl' : 'latn']}
                </button>
              </td>
            ))}
            {workerList.length > 0 && (
              <>
                <td style={{ paddingLeft: 12, paddingRight: 5, fontWeight: 'bold', fontSize: 12 }}>{L.filter_xod[lang]}</td>
                <td>
                  <select
                    value={filterWorker}
                    onChange={e => setFilterWorker(e.target.value)}
                    style={{ ...inp }}
                  >
                    <option value="">{L.hammasi[lang]}</option>
                    {workerList.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </td>
              </>
            )}
            <td style={{ paddingLeft: 10, color: '#666', fontSize: 11 }}>
              ({filtered.length} ta · {fmt(filteredTotal)} so'm)
            </td>
            <td style={{ paddingLeft: 10 }}>
              <ExcelExport
                filename="Chiqim_naqd"
                sheetName="Chiqim"
                title="Chiqim (Naqd/Oylik/Sement/Avans)"
                columns={[
                  { header: 'Sana', value: (r) => r.date || '' },
                  { header: 'Tur', value: (r) => typeInfo(r.srcType).latn },
                  { header: 'Xodim', value: (r) => r.worker || '' },
                  { header: 'Izoh', value: (r) => r.izoh || '' },
                  { header: "Summa (so'm)", value: (r) => Number(r.summa || 0) },
                ]}
                rows={filtered}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Asosiy jadval ─────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <p style={{ color: '#666', fontStyle: 'italic' }}>{L.yoq[lang]}</p>
      ) : (
        <>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th style={{ width: 68 }}>{L.vaqt[lang]}</th>
              <th style={{ width: 85 }}>{L.sana[lang]}</th>
              <th style={{ width: 145 }}>{L.tur[lang]}</th>
              <th style={{ width: 110 }}>{L.xodim[lang]}</th>
              <th>{L.izoh[lang]}</th>
              <th style={{ textAlign: 'right', width: 145 }}>{L.summa[lang]}</th>
              <th style={{ width: 45 }}></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r, i) => {
              const ti = typeInfo(r.srcType);
              const rowBg = i % 2 === 0 ? ti.bg : '#f9f9f9';
              return (
                <tr key={r.id + r.srcType} style={{ background: rowBg }}>
                  <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{i + 1}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold' }}>
                    {fmtTime(r.createdAt)}
                  </td>
                  <td style={{ fontSize: 12 }}>{r.date || '—'}</td>
                  <td style={{ fontWeight: 'bold', color: ti.color, fontSize: 12 }}>
                    {ti[lang === 'cyrl' ? 'cyrl' : 'latn']}
                  </td>
                  <td style={{ fontSize: 12, color: '#003366', fontWeight: r.worker ? 'bold' : 'normal' }}>
                    {r.worker || '—'}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {r.izoh || '—'}
                    {r.srcType === 'avans' && r.qolgan !== undefined && (
                      <span style={{ color: '#cc6600', fontSize: 11, marginLeft: 6 }}>
                        (qolgan: {fmt(r.qolgan)})
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#cc0000', fontFamily: 'monospace', fontSize: 13 }}>
                    {fmt(r.summa)}
                  </td>
                  <td>
                    {r.canDelete ? (
                      <button
                        onClick={() => { if (window.confirm("Haqiqatan ham bu chiqim yozuvini o'chirmoqchimisiz?\n\nBu amalni qaytarib bo'lmaydi.")) deleteExpenseRow(r.id); }}
                        style={{ fontSize: 10, cursor: 'pointer', background: '#ffcccc', border: '1px solid #c00', padding: '2px 5px' }}
                      >✕</button>
                    ) : (
                      <span style={{ fontSize: 10, color: '#999' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* Jami */}
            <tr style={{ background: '#ffff00', fontWeight: 'bold' }}>
              <td colSpan={6} style={{ textAlign: 'right' }}>{L.jami[lang]}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#cc0000', fontSize: 14 }}>
                {fmt(filteredTotal)}
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
