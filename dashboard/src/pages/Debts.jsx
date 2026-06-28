import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import NotifyModal from '../components/NotifyModal';
import ExcelExport from '../components/ExcelExport';
import CustomerCard from '../components/CustomerCard';
import DateRangeFilter from '../components/DateRangeFilter';
import { filterByRange } from '../lib/dateRange';
import Paginator from '../components/Paginator';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');

// ─── Tarjimonlar ─────────────────────────────────────────────────────────────
const L = {
  mijoz:       { latn: 'Mijoz',            cyrl: 'Мижоз'            },
  qarz:        { latn: 'Qarz summasi',     cyrl: 'Қарз суммаси'    },
  qoldi:       { latn: 'Qolgan qarz',      cyrl: 'Қолган қарз'     },
  tolandi:     { latn: "To'landi",         cyrl: 'Тўланди'          },
  qoshish:     { latn: "Qo'shish",         cyrl: 'Қўшиш'            },
  tolash:      { latn: "To'lamoq",         cyrl: 'Тўламоқ'          },
  izoh:        { latn: 'Izoh',             cyrl: 'Изоҳ'             },
  sana:        { latn: 'Sana',             cyrl: 'Сана'              },
  jami:        { latn: 'Jami qarz',        cyrl: 'Жами қарз'        },
  jamiAll:     { latn: 'Umumiy qarz',      cyrl: 'Умумий қарз'      },
  jamiPaid:    { latn: "Jami to'langan",   cyrl: 'Жами тўланган'    },
  jamiLeft:    { latn: 'Jami qolgan',      cyrl: 'Жами қолган'      },
  tolashSum:   { latn: "To'lov summasi",   cyrl: 'Тўлов суммаси'   },
  tolashIzoh:  { latn: "To'lov izohi",     cyrl: 'Тўлов изоҳи'     },
  qidirish:    { latn: 'Qidirish...',      cyrl: 'Қидириш...'       },
  barchasi:    { latn: 'Barchasi',         cyrl: 'Барчаси'          },
  tolanmagan:  { latn: "To'lanmagan",      cyrl: 'Тўланмаган'       },
  qisman:      { latn: 'Qisman',           cyrl: 'Қисман'           },
  toliqTolangan:{ latn: "To'liq to'langan", cyrl: "Тўлиқ тўланган" },
  tarix:       { latn: "To'lov tarixi",    cyrl: 'Тўлов тарихи'    },
  yopish:      { latn: 'Yopish',           cyrl: 'Ёпиш'             },
  yozuvYoq:    { latn: 'Yozuv topilmadi.', cyrl: 'Ёзув топилмади.' },
  xodim:       { latn: 'Xodim',            cyrl: 'Ходим'             },
  holat:       { latn: 'Holat',            cyrl: 'Ҳолат'             },
  o_chirish:   { latn: "O'chirish",        cyrl: 'Ўчириш'           },
};

// ─── Holat ─────────────────────────────────────────────────────────────────
function getStatus(amount, paid) {
  const rem = Number(amount) - Number(paid);
  if (rem <= 0)         return 'full';
  if (Number(paid) > 0) return 'partial';
  return 'none';
}

const STATUS_STYLE = {
  full:    { bg: '#e6ffe6', border: '#4caf50', color: '#2e7d32', label: { latn: "To'liq ✓", cyrl: 'Тўлиқ ✓' } },
  partial: { bg: '#fff8e1', border: '#ff9800', color: '#e65100', label: { latn: 'Qisman',   cyrl: 'Қисман'   } },
  none:    { bg: '#fff',    border: '#e53935', color: '#c62828', label: { latn: "To'lanmagan", cyrl: 'Тўланмаган' } },
};

// ─── ASOSIY KOMPONENT ────────────────────────────────────────────────────────
export default function Debts({ lang }) {
  const {
    debtRows, totalDebts, totalDebtsPaid, totalDebtsAll, customers,
  } = useData();

  const [reminder, setReminder] = useState(null);
  const [search, setSearch]     = useState('');
  const [range,  setRange]      = useState({ from: '', to: '' });
  const [filter, setFilter]     = useState('all');
  const [page, setPage]         = useState(1);
  const PAGE_SIZE = 100;
  const [history, setHistory]   = useState(null);
  const [card, setCard]         = useState(null);

  const openReminder = (r) => {
    const remaining = Math.max(0, Number(r.amount) - Number(r.paid));
    const phone = customers.find(c => c.name === r.customer)?.phone || '';
    const text = `Hurmatli ${r.customer}! Eslatma: qoldiq qarzingiz ${fmt(remaining)} so'm. Rahmat!`;
    setReminder({ name: r.customer, phone, text });
  };

  // ── Guruhlash (mijoz bo'yicha) ──────────────────────────────────────────────
  const allRows = filterByRange(debtRows, range)
    .filter(r => !search || r.customer.toLowerCase().includes(search.toLowerCase()))
    .slice().reverse();

  const groupMap = {};
  allRows.forEach(r => {
    if (!groupMap[r.customer]) groupMap[r.customer] = { customer: r.customer, rows: [], totalAmount: 0, totalPaid: 0 };
    groupMap[r.customer].rows.push(r);
    groupMap[r.customer].totalAmount += Number(r.amount || 0);
    groupMap[r.customer].totalPaid  += Number(r.paid  || 0);
  });

  const groupList = Object.values(groupMap).filter(g => {
    const rem = g.totalAmount - g.totalPaid;
    const st  = rem <= 0 ? 'full' : g.totalPaid > 0 ? 'partial' : 'none';
    return filter === 'all' || st === filter;
  }).sort((a, b) => (b.totalAmount - b.totalPaid) - (a.totalAmount - a.totalPaid));

  // Excel uchun flat list
  const filtered = allRows;

  useEffect(() => { setPage(1); }, [search, filter, range.from, range.to]);
  const pagedGroups = groupList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>

      {/* ── STATISTIKA PANELI ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <StatCard label={L.jamiAll[lang]}  value={fmt(totalDebtsAll)}  color="#333"    bg="#f5f5f5" />
        <StatCard label={L.jamiPaid[lang]} value={fmt(totalDebtsPaid)} color="#2e7d32" bg="#e8f5e9" />
        <StatCard label={L.jamiLeft[lang]} value={fmt(totalDebts)}     color="#c62828" bg="#ffebee" />
      </div>

      {/* ── SANA ORALIG'I FILTRI ──────────────────────────────────────────── */}
      <DateRangeFilter value={range} onChange={setRange} color="#c62828" />

      {/* ── FILTER va QIDIRUV ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder={L.qidirish[lang]}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inp, width: 180, border: '1px solid #aaa' }}
        />
        {[
          { key: 'all',     lbl: L.barchasi[lang]       },
          { key: 'none',    lbl: L.tolanmagan[lang]      },
          { key: 'partial', lbl: L.qisman[lang]          },
          { key: 'full',    lbl: L.toliqTolangan[lang]   },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={filterBtn(filter === f.key)}>
            {f.lbl}
          </button>
        ))}
        <span style={{ marginLeft: 6, color: '#888', fontSize: 11 }}>({filtered.length} ta)</span>
        <ExcelExport
          filename="Qarzdorlar"
          sheetName="Qarzdorlar"
          title="Qarzdorlar ro'yxati"
          columns={[
            { header: 'Mijoz', value: g => g.customer },
            { header: 'Qolgan qarz (so\'m)', value: g => Math.max(0, g.totalAmount - g.totalPaid) },
          ]}
          rows={groupList.filter(g => g.totalAmount - g.totalPaid > 0)}
        />
      </div>

      {/* ── TO'LOV TARIXI MODAL ─────────────────────────────────────────── */}
      {history !== null && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.35)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={() => setHistory(null)}
        >
          <div
            style={{
              background: '#fff', padding: 24, borderRadius: 6,
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)', minWidth: 420, maxWidth: 580,
            }}
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const row = debtRows.find(r => r.id === history);
              const payments = row?.payments || [];
              return (
                <>
                  <div style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 12, color: '#003366' }}>
                    {L.tarix[lang]}: {row?.customer}
                  </div>
                  {payments.length === 0 ? (
                    <p style={{ color: '#888', fontStyle: 'italic' }}>{L.yozuvYoq[lang]}</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#003366', color: '#fff' }}>
                          <th style={th}>#</th>
                          <th style={th}>{L.sana[lang]}</th>
                          <th style={{ ...th, textAlign: 'right' }}>{L.tolashSum[lang]}</th>
                          <th style={th}>Kanal</th>
                          <th style={th}>{L.izoh[lang]}</th>
                          <th style={th}>{L.xodim[lang]}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p, i) => (
                          <tr key={p.id} style={{ background: i % 2 === 0 ? '#f9f9f9' : '#fff' }}>
                            <td style={td}>{i + 1}</td>
                            <td style={td}>{p.date}</td>
                            <td style={{ ...td, textAlign: 'right', color: '#2e7d32', fontWeight: 'bold' }}>{fmt(p.amount)}</td>
                            <td style={td}>
                              {{ naqd: '💵 Naqd', bank: '🏦 Bank', click: '📱 Click' }[p.channel] || '💵 Naqd'}
                            </td>
                            <td style={td}>{p.note || '—'}</td>
                            <td style={td}>{p.worker || '—'}</td>
                          </tr>
                        ))}
                        <tr style={{ background: '#e8f5e9', fontWeight: 'bold' }}>
                          <td colSpan={2} style={td}>Jami to'landi:</td>
                          <td style={{ ...td, textAlign: 'right', color: '#2e7d32' }}>{fmt(payments.reduce((s, p) => s + p.amount, 0))}</td>
                          <td colSpan={2} style={td}></td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                  <div style={{ marginTop: 16, textAlign: 'right' }}>
                    <button
                      onClick={() => setHistory(null)}
                      style={{ padding: '5px 20px', cursor: 'pointer', background: '#003366', color: '#fff', border: 'none', borderRadius: 3 }}
                    >
                      {L.yopish[lang]}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── ASOSIY JADVAL (mijoz bo'yicha guruhlab) ──────────────────────── */}
      {groupList.length === 0 ? (
        <p style={{ color: '#888', fontStyle: 'italic', marginTop: 20 }}>{L.yozuvYoq[lang]}</p>
      ) : (
        <>
        <table className="data-table" style={{ width: '100%', maxWidth: 980 }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th>{L.mijoz[lang]}</th>
              <th style={{ textAlign: 'right', width: 130 }}>{L.qarz[lang]}</th>
              <th style={{ textAlign: 'right', width: 120 }}>{L.tolandi[lang]}</th>
              <th style={{ textAlign: 'right', width: 130, color: '#c62828' }}>{L.qoldi[lang]}</th>
              <th style={{ width: 90 }}>{L.holat[lang]}</th>
            </tr>
          </thead>
          <tbody>
            {pagedGroups.map((g, i) => {
              const remaining = g.totalAmount - g.totalPaid;
              const st = remaining <= 0 ? 'full' : g.totalPaid > 0 ? 'partial' : 'none';
              const ss = STATUS_STYLE[st];
              return (
                <tr key={g.customer} style={{ background: ss.bg, cursor: 'pointer' }} onClick={() => setCard(g.customer)}>
                  <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{i + 1}</td>
                  <td>
                    <span style={{ fontWeight: 'bold', color: '#1565c0', fontSize: 14, textDecoration: 'underline' }}>{g.customer}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#888' }}>{g.rows.length} ta</span>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{fmt(g.totalAmount)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#2e7d32', fontWeight: 'bold' }}>{fmt(g.totalPaid)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#c62828', fontWeight: 'bold', fontSize: 15 }}>{fmt(remaining)}</td>
                  <td>
                    <span style={{ display: 'inline-block', padding: '2px 8px', fontSize: 11, border: `1px solid ${ss.border}`, borderRadius: 10, color: ss.color, fontWeight: 'bold' }}>
                      {ss.label[lang]}
                    </span>
                  </td>
                </tr>
              );
            })}

            {/* Jami qator */}
            <tr style={{ background: '#ffff00', fontWeight: 'bold' }}>
              <td colSpan={2} style={{ paddingLeft: 8 }}>{L.jami[lang]} ({groupList.length} mijoz)</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(groupList.reduce((s, g) => s + g.totalAmount, 0))}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#2e7d32' }}>{fmt(groupList.reduce((s, g) => s + g.totalPaid, 0))}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#c62828' }}>{fmt(groupList.reduce((s, g) => s + Math.max(0, g.totalAmount - g.totalPaid), 0))}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        <Paginator total={groupList.length} page={page} setPage={setPage} pageSize={PAGE_SIZE} />
        </>
      )}

      {reminder && <NotifyModal name={reminder.name} phone={reminder.phone} defaultText={reminder.text} onClose={() => setReminder(null)} />}
      {card && <CustomerCard name={card} onClose={() => setCard(null)} />}
    </div>
  );
}

// ─── Yordamchi komponent: statistika kartochkasi ─────────────────────────────
function StatCard({ label, value, color, bg }) {
  return (
    <div style={{
      padding: '8px 16px', background: bg, border: `1px solid ${color}33`,
      borderLeft: `4px solid ${color}`, borderRadius: 4, minWidth: 160,
    }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 'bold', color, fontFamily: 'monospace' }}>{value} so'm</div>
    </div>
  );
}

// ─── Stil konstantalar ───────────────────────────────────────────────────────
const inp = {
  padding: '4px 6px', fontSize: 13,
  border: '1px solid #ccc', borderRadius: 3, width: 160,
};

const addBtn = {
  padding: '5px 16px', cursor: 'pointer',
  background: '#003366', color: '#fff',
  border: 'none', borderRadius: 3, fontFamily: 'Tahoma, sans-serif',
  fontSize: 13, fontWeight: 'bold',
};

const filterBtn = (active) => ({
  padding: '3px 10px', cursor: 'pointer',
  fontFamily: 'Tahoma, sans-serif', fontSize: 12,
  border: active ? '2px inset #ffffff' : '2px outset #ffffff',
  background: active ? '#003366' : '#f0f0f0',
  color: active ? '#fff' : '#333',
  fontWeight: active ? 'bold' : 'normal',
});

const th = {
  padding: '5px 8px', textAlign: 'left',
  border: '1px solid #1a4080', fontWeight: 'bold',
};

const td = {
  padding: '5px 8px', border: '1px solid #ddd',
};
