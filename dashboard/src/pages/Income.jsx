import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import CustomerSelect from '../components/CustomerSelect';
import ExcelExport from '../components/ExcelExport';
import Paginator from '../components/Paginator';
import DateRangeFilter from '../components/DateRangeFilter';
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

// Kirim turlari
const INCOME_TYPES = [
  { value: 'naqd',           latn: 'Naqd',           cyrl: 'Нақд',          color: '#006600', bg: '#f0fff0' },
  { value: 'click',          latn: 'Click',          cyrl: 'Клик',          color: '#6600cc', bg: '#f5f0ff' },
  { value: 'perechisleniya', latn: 'Perechisleniya', cyrl: 'Перечисление',  color: '#0000cc', bg: '#f0f0ff' },
  { value: 'kassir',         latn: 'Kassir kirim',   cyrl: 'Кассир кирим',  color: '#006666', bg: '#e8fffe' },
  { value: 'savdo',          latn: 'Savdo',          cyrl: 'Савдо',         color: '#996600', bg: '#fffde8' },
  { value: 'qarz_tolovi',    latn: "Qarz to'lovi",   cyrl: "Қарз тўлови",  color: '#cc6600', bg: '#fff5e8' },
];

const typeInfo = (val) => INCOME_TYPES.find(t => t.value === val) || { color: '#333', bg: '#fff', latn: val, cyrl: val };

const XODIMLAR = [
  'Botir aka', 'Alisher aka', 'Ganisher aka', 'Sharofidin',
  'Saloh', 'Qosim', 'Anvarjon',
];

const L = {
  tur:        { latn: 'Tur',            cyrl: 'Тур'           },
  summa:      { latn: 'Summa',          cyrl: 'Сумма'         },
  izoh:       { latn: 'Izoh',           cyrl: 'Изоҳ'          },
  mijozLbl:   { latn: 'Mijoz',          cyrl: 'Мижоз'         },
  qoshish:    { latn: "Qo'shish",       cyrl: 'Қўшиш'        },
  sana:       { latn: 'Sana',           cyrl: 'Сана'          },
  vaqt:       { latn: 'Vaqt',           cyrl: 'Вақт'          },
  xodim:      { latn: 'Xodim',          cyrl: 'Ходим'         },
  tolov:      { latn: "To'lov usuli",   cyrl: 'Тўлов усули'   },
  jami:       { latn: 'JAMI',           cyrl: 'ЖАМИ'          },
  hammasi:    { latn: 'Hammasi',        cyrl: 'Ҳаммаси'       },
  filter_tur: { latn: 'Tur:',           cyrl: 'Тур:'          },
  filter_xod: { latn: 'Xodim:',        cyrl: 'Ходим:'        },
  yoq:        { latn: 'Yozuv topilmadi.', cyrl: 'Ёзув топилмади.' },
  ochirish:   { latn: "O'chirish",      cyrl: 'Ўчириш'        },
  mijoz:      { latn: 'Mijoz',          cyrl: 'Мижоз'         },
  tonna:      { latn: 'Tonna',          cyrl: 'Тонна'         },
};

export default function Income({ lang }) {
  const {
    incomeRows,    addIncomeRow,    deleteIncomeRow,
    bankIncomeRows, addBankIncomeRow, deleteBankIncomeRow,
    clickIncomeRows, addClickIncomeRow, deleteClickIncomeRow,
    soldRows, debtRows,
    cashRows, bankRows, clickRows,
    currentWorker, setCurrentWorker,
  } = useData();

  const [form, setForm] = useState({ type: 'naqd', amount: '', desc: '' });
  const [filterType,   setFilterType]   = useState('');
  const [filterWorker, setFilterWorker] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;

  // ── Kirim qo'shish ────────────────────────────────────────────────────────
  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.amount || !form.desc) return;
    const amt = form.amount;
    const dsc = form.desc;
    if (form.type === 'naqd')           addIncomeRow(amt, dsc);
    else if (form.type === 'click')     addClickIncomeRow(amt, dsc);
    else if (form.type === 'perechisleniya') addBankIncomeRow(amt, dsc);
    setForm({ ...form, amount: '', desc: '' });
  };

  // ── Kirim o'chirish ───────────────────────────────────────────────────────
  const handleDelete = (type, id) => {
    if (!window.confirm("Haqiqatan ham bu kirim yozuvini o'chirmoqchimisiz?\n\nBu amalni qaytarib bo'lmaydi.")) return;
    if (type === 'naqd')           deleteIncomeRow(id);
    else if (type === 'click')     deleteClickIncomeRow(id);
    else if (type === 'perechisleniya') deleteBankIncomeRow(id);
  };

  // ── Barcha kirimlarni yig'ish ─────────────────────────────────────────────
  const allRows = [
    // Naqd kirim
    ...incomeRows.map(r => ({
      id: r.id, srcType: 'naqd', date: r.date,
      createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
      worker: r.worker || '', izoh: r.desc, mijoz: '',
      summa: r.amount, canDelete: true,
    })),
    // Click kirim
    ...clickIncomeRows.map(r => ({
      id: r.id, srcType: 'click', date: r.date,
      createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
      worker: r.worker || '', izoh: r.desc, mijoz: '',
      summa: r.amount, canDelete: true,
    })),
    // Perechisleniya (bank)
    ...bankIncomeRows.map(r => ({
      id: r.id, srcType: 'perechisleniya', date: r.date,
      createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
      worker: r.worker || '', izoh: r.desc, mijoz: '',
      summa: r.amount, canDelete: true,
    })),
    // Savdo (sotilgan tonna to'lovlari, nasiyasiz)
    ...soldRows
      .filter(r => r.paymentChannel !== 'nasiya')
      .map(r => ({
        id: 'sol_' + r.id,
        srcType: 'savdo',
        date: r.date,
        createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
        worker: r.worker || '',
        mijoz: r.customer,
        izoh: `${r.tons} tn × ${fmt(r.pricePerTon)}`,
        summa: Number(r.tons || 0) * Number(r.pricePerTon || 0),
        tolov: r.paymentChannel,
        canDelete: false,
      })),
    // Qarz to'lovlari (to'langan miqdor)
    ...debtRows
      .filter(r => Number(r.paid) > 0)
      .map(r => ({
        id: 'dbt_' + r.id,
        srcType: 'qarz_tolovi',
        date: r.date,
        createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
        worker: r.worker || '',
        mijoz: r.customer,
        izoh: r.note || '',
        summa: Number(r.paid),
        canDelete: false,
      })),
    // Kassir qo'lda kirim (cashRows/bankRows/clickRows — faqat manual yozuvlar)
    ...(cashRows || []).filter(r => !r.auto && Number(r.amount) > 0).map(r => ({
      id: 'kc_' + r.id, srcType: 'kassir', date: r.date,
      createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
      worker: r.worker || '', izoh: (r.desc || '') + ' [Naqd]', mijoz: '',
      summa: Number(r.amount), canDelete: false,
    })),
    ...(bankRows || []).filter(r => !r.auto && Number(r.amount) > 0).map(r => ({
      id: 'kb_' + r.id, srcType: 'kassir', date: r.date,
      createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
      worker: r.worker || '', izoh: (r.desc || '') + ' [Bank]', mijoz: '',
      summa: Number(r.amount), canDelete: false,
    })),
    ...(clickRows || []).filter(r => !r.auto && Number(r.amount) > 0).map(r => ({
      id: 'kck_' + r.id, srcType: 'kassir', date: r.date,
      createdAt: r.createdAt || (r.id > 1e10 ? r.id : null),
      worker: r.worker || '', izoh: (r.desc || '') + ' [Click]', mijoz: '',
      summa: Number(r.amount), canDelete: false,
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
  INCOME_TYPES.forEach(t => {
    totals[t.value] = allRows.filter(r => r.srcType === t.value).reduce((s, r) => s + Number(r.summa || 0), 0);
  });
  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);
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

      {/* ── Kirim qo'shish formasi ─────────────────────────────────────── */}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 5, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Tur */}
        <select
          value={form.type}
          onChange={e => setForm({ ...form, type: e.target.value })}
          style={{ ...inp, fontWeight: 'bold', color: typeInfo(form.type).color, background: typeInfo(form.type).bg, width: 155 }}
        >
          {INCOME_TYPES.filter(t => !['savdo', 'qarz_tolovi'].includes(t.value)).map(t => (
            <option key={t.value} value={t.value}>{t[lang === 'cyrl' ? 'cyrl' : 'latn']}</option>
          ))}
        </select>
        {/* Summa */}
        <input
          type="number" placeholder="Summa" value={form.amount}
          onChange={e => setForm({ ...form, amount: e.target.value })}
          style={{ ...inp, width: 130 }}
          required
        />
        {/* Izoh / Mijoz — CustomerSelect */}
        <CustomerSelect
          value={form.desc}
          onChange={val => setForm({ ...form, desc: val })}
          placeholder={L.izoh[lang]}
          width={200}
          accentColor="#006600"
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
        <button type="submit" style={{ ...inp, border: '2px outset #ffffff', cursor: 'pointer', background: '#003366', color: '#fff', fontWeight: 'bold', padding: '3px 16px' }}>
          {L.qoshish[lang]}
        </button>
      </form>

      {/* ── Jami xulosasi (tur bo'yicha) ──────────────────────────────── */}
      <table style={{ borderCollapse: 'collapse', marginBottom: 10, width: '100%', maxWidth: 900 }}>
        <tbody>
          <tr>
            {INCOME_TYPES.map(t => (
              <td key={t.value} style={{
                border: '1px solid #999', padding: '5px 10px',
                background: t.bg, textAlign: 'center', minWidth: 140,
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
              border: '2px solid #003366', padding: '5px 10px',
              background: '#003366', textAlign: 'center', minWidth: 140,
            }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: '#aaf' }}>JAMI KIRIM</div>
              <div style={{ fontSize: 15, fontWeight: 'bold', color: '#fff', fontFamily: 'monospace' }}>
                {fmt(grandTotal)}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Sana oralig'i filtri ──────────────────────────────────────── */}
      <DateRangeFilter value={range} onChange={setRange} color="#006600" />

      {/* ── Filter paneli ─────────────────────────────────────────────── */}
      <table style={{ borderCollapse: 'collapse', marginBottom: 8 }}>
        <tbody>
          <tr>
            <td style={{ paddingRight: 5, fontWeight: 'bold', fontSize: 12 }}>{L.filter_tur[lang]}</td>
            <td style={{ paddingRight: 4 }}>
              <button onClick={() => setFilterType('')} style={btnStyle(!filterType)}>{L.hammasi[lang]}</button>
            </td>
            {INCOME_TYPES.map(t => (
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
                filename="Kirim_naqd"
                sheetName="Kirim"
                title="Kirim (Naqd/Click/Bank/Savdo/Qarz)"
                columns={[
                  { header: 'Sana', value: (r) => r.date || '' },
                  { header: 'Tur', value: (r) => typeInfo(r.srcType).latn },
                  { header: 'Xodim', value: (r) => r.worker || '' },
                  { header: 'Mijoz', value: (r) => r.mijoz || '' },
                  { header: 'Izoh', value: (r) => r.izoh || '' },
                  { header: "Summa (so'm)", value: (r) => Number(r.summa || 0) },
                  { header: "To'lov usuli", value: (r) => r.tolov || '' },
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
              <th style={{ width: 160 }}>{L.mijozLbl[lang]}</th>
              <th>{L.izoh[lang]}</th>
              <th style={{ textAlign: 'right', width: 140 }}>{L.summa[lang]}</th>
              <th style={{ width: 70 }}>{L.tolov[lang]}</th>
              <th style={{ width: 45 }}></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r, i) => {
              const ti  = typeInfo(r.srcType);
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
                  <td style={{ fontSize: 13, fontWeight: r.mijoz ? 'bold' : 'normal', color: r.mijoz ? '#003366' : '#999' }}>
                    {r.mijoz || '—'}
                  </td>
                  <td style={{ fontSize: 13 }}>{r.izoh || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#006600', fontFamily: 'monospace', fontSize: 13 }}>
                    {fmt(r.summa)}
                  </td>
                  <td style={{ fontSize: 11, color: '#555' }}>{r.tolov || '—'}</td>
                  <td>
                    {r.canDelete ? (
                      <button
                        onClick={() => handleDelete(r.srcType, r.id)}
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
              <td colSpan={7} style={{ textAlign: 'right' }}>{L.jami[lang]}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#006600', fontSize: 14 }}>
                {fmt(filteredTotal)}
              </td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
        <Paginator total={filtered.length} page={page} setPage={setPage} pageSize={PAGE_SIZE} />
        </>
      )}
    </div>
  );
}
