import { useState } from 'react';
import { useData } from '../context/DataContext';
import CustomerSelect from '../components/CustomerSelect';

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
    debtRows, addDebtRow, payDebt, deleteDebtRow,
    totalDebts, totalDebtsPaid, totalDebtsAll,
  } = useData();

  const [form, setForm]       = useState({ customer: '', amount: '', note: '' });
  const [payForm, setPayForm] = useState({ id: null, amount: '', note: '', channel: 'naqd' });
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all'); // 'all' | 'none' | 'partial' | 'full'
  const [history, setHistory] = useState(null);  // qaysi qarz tarixi ko'rinmoqda

  // ── Forma submit ────────────────────────────────────────────────────────────
  const handleAdd = (e) => {
    e.preventDefault();
    if (form.customer && form.amount) {
      addDebtRow(form.customer, form.amount, form.note);
      setForm({ customer: '', amount: '', note: '' });
    }
  };

  // ── To'lash ─────────────────────────────────────────────────────────────────
  const handlePayOpen = (id) => {
    setPayForm({ id, amount: '', note: '', channel: 'naqd' });
  };
  const handlePayConfirm = () => {
    if (payForm.amount) {
      payDebt(payForm.id, payForm.amount, payForm.note, payForm.channel);
      setPayForm({ id: null, amount: '', note: '', channel: 'naqd' });
    }
  };

  // ── O'chirish ───────────────────────────────────────────────────────────────
  const handleDelete = (id) => {
    if (window.confirm("Ushbu qarz yozuvini o'chirasizmi?")) {
      deleteDebtRow(id);
    }
  };

  // ── Filtrlash ───────────────────────────────────────────────────────────────
  const filtered = debtRows
    .filter(r => {
      const st = getStatus(r.amount, r.paid);
      if (filter !== 'all' && st !== filter) return false;
      if (search && !r.customer.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .slice()
    .reverse(); // yangi yozuvlar tepada

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>

      {/* ── STATISTIKA PANELI ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <StatCard label={L.jamiAll[lang]}  value={fmt(totalDebtsAll)}  color="#333"    bg="#f5f5f5" />
        <StatCard label={L.jamiPaid[lang]} value={fmt(totalDebtsPaid)} color="#2e7d32" bg="#e8f5e9" />
        <StatCard label={L.jamiLeft[lang]} value={fmt(totalDebts)}     color="#c62828" bg="#ffebee" />
      </div>

      {/* ── QARZ QO'SHISH FORMASI ─────────────────────────────────────────── */}
      <form onSubmit={handleAdd} style={{
        display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap',
        padding: '8px 10px', background: '#f9f9f9', border: '1px solid #ddd',
      }}>
        <CustomerSelect
          value={form.customer}
          onChange={name => setForm({ ...form, customer: name })}
          placeholder={L.mijoz[lang]}
          accentColor="#c62828"
          required
        />
        <input
          type="number"
          placeholder={L.qarz[lang]}
          value={form.amount}
          onChange={e => setForm({ ...form, amount: e.target.value })}
          style={{ ...inp, width: 150 }}
        />
        <input
          placeholder={L.izoh[lang]}
          value={form.note}
          onChange={e => setForm({ ...form, note: e.target.value })}
          style={{ ...inp, width: 180 }}
        />
        <button type="submit" style={addBtn}>{L.qoshish[lang]}</button>
      </form>

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
      </div>

      {/* ── TO'LOV MODAL OVERLAY ─────────────────────────────────────────── */}
      {payForm.id !== null && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.35)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={() => setPayForm({ id: null, amount: '', note: '', channel: 'naqd' })}
        >
          <div
            style={{
              background: '#fff', padding: 24, borderRadius: 6,
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)', minWidth: 340,
            }}
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const row = debtRows.find(r => r.id === payForm.id);
              const rem = row ? Math.max(0, Number(row.amount) - Number(row.paid)) : 0;
              return (
                <>
                  <div style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 12, color: '#003366' }}>
                    {L.tolash[lang]}: <span style={{ color: '#c62828' }}>{row?.customer}</span>
                  </div>
                  <div style={{ marginBottom: 10, fontSize: 12, color: '#555' }}>
                    Qolgan qarz: <b style={{ color: '#c62828' }}>{fmt(rem)} so'm</b>
                  </div>
                  <input
                    type="number"
                    placeholder={L.tolashSum[lang]}
                    value={payForm.amount}
                    onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                    style={{ ...inp, width: '100%', marginBottom: 8, boxSizing: 'border-box' }}
                    autoFocus
                  />
                  <input
                    placeholder={L.tolashIzoh[lang]}
                    value={payForm.note}
                    onChange={e => setPayForm({ ...payForm, note: e.target.value })}
                    style={{ ...inp, width: '100%', marginBottom: 8, boxSizing: 'border-box' }}
                  />
                  {/* ── To'lov kanali ── */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 4 }}>
                      Pul qaysi kassaga tushadi?
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[
                        { v: 'naqd',  label: '💵 Naqd',  color: '#1565c0' },
                        { v: 'bank',  label: '🏦 Bank',  color: '#2e7d32' },
                        { v: 'click', label: '📱 Click', color: '#6a1b9a' },
                      ].map(ch => (
                        <button
                          key={ch.v}
                          type="button"
                          onClick={() => setPayForm({ ...payForm, channel: ch.v })}
                          style={{
                            flex: 1, padding: '6px 4px', fontSize: 12, cursor: 'pointer',
                            border: `2px solid ${payForm.channel === ch.v ? ch.color : '#ddd'}`,
                            background: payForm.channel === ch.v ? ch.color : '#f9f9f9',
                            color: payForm.channel === ch.v ? '#fff' : '#333',
                            borderRadius: 4, fontWeight: payForm.channel === ch.v ? 'bold' : 'normal',
                          }}
                        >
                          {ch.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handlePayConfirm} style={{ ...addBtn, flex: 1 }}>✓ {L.tolash[lang]}</button>
                    <button
                      onClick={() => setPayForm({ id: null, amount: '', note: '', channel: 'naqd' })}
                      style={{ flex: 1, padding: '5px 14px', cursor: 'pointer', background: '#ffcccc', border: '1px solid #c00', borderRadius: 3 }}
                    >
                      ✕
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

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

      {/* ── ASOSIY JADVAL ────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <p style={{ color: '#888', fontStyle: 'italic', marginTop: 20 }}>{L.yozuvYoq[lang]}</p>
      ) : (
        <table className="data-table" style={{ width: '100%', maxWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th style={{ width: 80 }}>{L.sana[lang]}</th>
              <th>{L.mijoz[lang]}</th>
              <th style={{ textAlign: 'right', width: 120 }}>{L.qarz[lang]}</th>
              <th style={{ textAlign: 'right', width: 110 }}>{L.tolandi[lang]}</th>
              <th style={{ textAlign: 'right', width: 110, color: '#c62828' }}>{L.qoldi[lang]}</th>
              <th style={{ width: 90 }}>{L.holat[lang]}</th>
              <th>{L.izoh[lang]}</th>
              <th style={{ width: 140 }}>Amal</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const remaining = Math.max(0, Number(r.amount) - Number(r.paid));
              const st        = getStatus(r.amount, r.paid);
              const ss        = STATUS_STYLE[st];
              return (
                <tr key={r.id} style={{ background: ss.bg }}>
                  <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{i + 1}</td>
                  <td style={{ fontSize: 12 }}>{r.date}</td>
                  <td style={{ fontWeight: 'bold', color: '#003366' }}>{r.customer}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.amount)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#2e7d32', fontWeight: 'bold' }}>{fmt(r.paid)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#c62828', fontWeight: 'bold' }}>{fmt(remaining)}</td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '2px 7px', fontSize: 11,
                      border: `1px solid ${ss.border}`, borderRadius: 10,
                      color: ss.color, fontWeight: 'bold', whiteSpace: 'nowrap',
                    }}>
                      {ss.label[lang]}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: '#555' }}>{r.note || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {remaining > 0 && (
                        <button
                          onClick={() => handlePayOpen(r.id)}
                          style={{ fontSize: 11, cursor: 'pointer', padding: '2px 7px', background: '#fffde7', border: '1px solid #fbc02d', borderRadius: 3 }}
                        >
                          💰 {L.tolash[lang]}
                        </button>
                      )}
                      {(r.payments || []).length > 0 && (
                        <button
                          onClick={() => setHistory(r.id)}
                          style={{ fontSize: 11, cursor: 'pointer', padding: '2px 7px', background: '#e3f2fd', border: '1px solid #1976d2', borderRadius: 3, color: '#1565c0' }}
                        >
                          📋 {L.tarix[lang]}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(r.id)}
                        style={{ fontSize: 11, cursor: 'pointer', padding: '2px 7px', background: '#ffebee', border: '1px solid #e53935', borderRadius: 3, color: '#c62828' }}
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Jami qator */}
            <tr style={{ background: '#ffff00', fontWeight: 'bold' }}>
              <td colSpan={3} style={{ paddingLeft: 8 }}>{L.jami[lang]}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(filtered.reduce((s, r) => s + Number(r.amount), 0))}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#2e7d32' }}>{fmt(filtered.reduce((s, r) => s + Number(r.paid), 0))}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#c62828' }}>{fmt(filtered.reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.paid)), 0))}</td>
              <td colSpan={3}></td>
            </tr>
          </tbody>
        </table>
      )}
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
