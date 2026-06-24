import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import CustomerSelect from '../components/CustomerSelect';
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
    debtRows, addDebtRow, payDebt, payCustomerDebt, deleteDebtRow,
    totalDebts, totalDebtsPaid, totalDebtsAll,
    customers,
  } = useData();

  // ── Tez to'lov (kassir uchun) — mijoz qarzini bittada qabul qilish ─────────
  const [quick, setQuick] = useState({ customer: '', amount: '', channel: 'naqd' });
  const quickRemaining = quick.customer
    ? debtRows.filter(r => r.customer === quick.customer).reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.paid)), 0)
    : 0;
  const handleQuickPay = (e) => {
    e.preventDefault();
    if (!quick.customer || !quick.amount) return;
    const res = payCustomerDebt(quick.customer, quick.amount, quick.channel, 'Kassaga to\'lov');
    if (res.applied <= 0) { alert("Bu mijozda qoldiq qarz yo'q."); return; }
    let msg = `✅ ${fmt(res.applied)} so'm qarz to'landi (${quick.channel}).\nKassaga kirim qilindi.`;
    if (res.leftover > 0) msg += `\n\n⚠ ${fmt(res.leftover)} so'm ortiqcha — qabul qilinmadi (qarzdan ko'p). Kerak bo'lsa "Avanslar"ga yozing.`;
    alert(msg);
    setQuick({ customer: '', amount: '', channel: 'naqd' });
  };

  const [reminder, setReminder] = useState(null); // { name, phone, text }
  const openReminder = (r) => {
    const remaining = Math.max(0, Number(r.amount) - Number(r.paid));
    const phone = customers.find(c => c.name === r.customer)?.phone || '';
    const text = `Hurmatli ${r.customer}! Eslatma: sizning qoldiq qarzingiz ${fmt(remaining)} so'm. Iloji bo'lsa to'lovni amalga oshiring. Rahmat!`;
    setReminder({ name: r.customer, phone, text });
  };

  const [form, setForm]       = useState({ customer: '', amount: '', note: '' });
  const [payForm, setPayForm] = useState({ id: null, amount: '', note: '', channel: 'naqd' });
  const [search, setSearch]   = useState('');
  const [range,  setRange]    = useState({ from: '', to: '' });
  const [filter, setFilter]   = useState('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;
  const [history, setHistory] = useState(null);
  const [card, setCard]       = useState(null);
  const [expanded, setExpanded] = useState(new Set());

  const toggleExpand = (customer) => setExpanded(prev => {
    const s = new Set(prev); s.has(customer) ? s.delete(customer) : s.add(customer); return s;
  });

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

      {/* ── TEZ TO'LOV (kassir) — mijoz qarzini bittada qabul qilish ───────── */}
      <form onSubmit={handleQuickPay} style={{
        display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center',
        padding: '12px 14px', background: '#e8f5e9', border: '2px solid #2e7d32', borderRadius: 8,
      }}>
        <span style={{ fontWeight: 'bold', color: '#1b5e20', fontSize: 14 }}>💰 Qarz to'lovini qabul qilish:</span>
        <CustomerSelect
          value={quick.customer}
          onChange={name => setQuick({ ...quick, customer: name })}
          placeholder="Mijozni tanlang"
          accentColor="#2e7d32"
          required
        />
        {quick.customer && (
          <span style={{ fontSize: 12, color: quickRemaining > 0 ? '#c62828' : '#2e7d32', fontWeight: 'bold' }}>
            Qoldiq qarz: {fmt(quickRemaining)} so'm
          </span>
        )}
        <input
          type="number" placeholder="Qancha to'ladi?"
          value={quick.amount}
          onChange={e => setQuick({ ...quick, amount: e.target.value })}
          style={{ ...inp, width: 150, border: '1px solid #2e7d32' }}
        />
        {[
          { v: 'naqd', label: '💵 Naqd', color: '#1565c0' },
          { v: 'bank', label: '🏦 Bank', color: '#2e7d32' },
          { v: 'click', label: '📱 Click', color: '#6a1b9a' },
        ].map(ch => (
          <button key={ch.v} type="button" onClick={() => setQuick({ ...quick, channel: ch.v })} style={{
            padding: '5px 12px', fontSize: 12, cursor: 'pointer',
            border: `2px solid ${quick.channel === ch.v ? ch.color : '#ccc'}`,
            background: quick.channel === ch.v ? ch.color : '#fff',
            color: quick.channel === ch.v ? '#fff' : '#333', borderRadius: 4, fontWeight: 'bold',
          }}>{ch.label}</button>
        ))}
        <button type="submit" style={{ padding: '7px 22px', cursor: 'pointer', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', fontSize: 14 }}>
          ✓ Qabul qilish
        </button>
        {quick.customer && quick.amount > 0 && (
          <button type="button" onClick={() => setQuick({ ...quick, amount: String(quickRemaining) })}
            style={{ padding: '7px 12px', cursor: 'pointer', background: '#fff', color: '#2e7d32', border: '1px solid #2e7d32', borderRadius: 4, fontSize: 12 }}>
            To'liq ({fmt(quickRemaining)})
          </button>
        )}
      </form>

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
          filename="Qarzlar"
          sheetName="Qarzlar"
          title="Qarzlar hisoboti"
          columns={[
            { header: 'Sana', value: r => r.date },
            { header: 'Mijoz', value: r => r.customer },
            { header: 'Qarz summasi', value: r => Number(r.amount || 0) },
            { header: "To'landi", value: r => Number(r.paid || 0) },
            { header: 'Qolgan qarz', value: r => Math.max(0, Number(r.amount || 0) - Number(r.paid || 0)) },
            { header: 'Holat', value: r => STATUS_STYLE[getStatus(r.amount, r.paid)].label.latn },
            { header: 'Izoh', value: r => r.note || '' },
          ]}
          rows={filtered}
        />
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
              <th style={{ width: 170 }}>Amal</th>
            </tr>
          </thead>
          <tbody>
            {pagedGroups.map((g, i) => {
              const remaining = g.totalAmount - g.totalPaid;
              const st  = remaining <= 0 ? 'full' : g.totalPaid > 0 ? 'partial' : 'none';
              const ss  = STATUS_STYLE[st];
              const isOpen = expanded.has(g.customer);
              return (
                <>
                {/* ── Guruh (mijoz) satri — bosib ochiladi ── */}
                <tr key={g.customer} style={{ background: ss.bg, cursor: 'pointer' }} onClick={() => toggleExpand(g.customer)}>
                  <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{i + 1}</td>
                  <td>
                    <span style={{ fontWeight: 'bold', color: '#003366', fontSize: 14 }}>{g.customer}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#888' }}>{g.rows.length} ta</span>
                    <span style={{ marginLeft: 6, fontSize: 12, color: '#888' }}>{isOpen ? '▲' : '▼'}</span>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{fmt(g.totalAmount)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#2e7d32', fontWeight: 'bold' }}>{fmt(g.totalPaid)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#c62828', fontWeight: 'bold', fontSize: 15 }}>{fmt(remaining)}</td>
                  <td>
                    <span style={{ display: 'inline-block', padding: '2px 8px', fontSize: 11, border: `1px solid ${ss.border}`, borderRadius: 10, color: ss.color, fontWeight: 'bold' }}>
                      {ss.label[lang]}
                    </span>
                  </td>
                  <td></td>
                </tr>

                {/* ── Kengaytirilgan: alohida qarz satrlari ── */}
                {isOpen && g.rows.map(r => {
                  const rem = Math.max(0, Number(r.amount) - Number(r.paid));
                  return (
                    <tr key={r.id} style={{ background: '#fafafa', borderLeft: '4px solid #90caf9' }}>
                      <td></td>
                      <td style={{ paddingLeft: 24, fontSize: 12, color: '#555' }}>
                        <span style={{ color: '#888', marginRight: 8 }}>{r.date}</span>
                        {r.note || '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmt(r.amount)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#2e7d32', fontSize: 12 }}>{fmt(r.paid)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: rem > 0 ? '#c62828' : '#888', fontSize: 12 }}>{fmt(rem)}</td>
                      <td></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {rem > 0 && (
                            <button onClick={() => handlePayOpen(r.id)}
                              style={{ fontSize: 11, cursor: 'pointer', padding: '2px 6px', background: '#fffde7', border: '1px solid #fbc02d', borderRadius: 3 }}>
                              💰
                            </button>
                          )}
                          {(r.payments || []).length > 0 && (
                            <button onClick={() => setHistory(r.id)}
                              style={{ fontSize: 11, cursor: 'pointer', padding: '2px 6px', background: '#e3f2fd', border: '1px solid #1976d2', borderRadius: 3, color: '#1565c0' }}>
                              📋
                            </button>
                          )}
                          <button onClick={() => handleDelete(r.id)}
                            style={{ fontSize: 11, cursor: 'pointer', padding: '2px 6px', background: '#ffebee', border: '1px solid #e53935', borderRadius: 3, color: '#c62828' }}>
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                </>
              );
            })}

            {/* Jami qator */}
            <tr style={{ background: '#ffff00', fontWeight: 'bold' }}>
              <td colSpan={2} style={{ paddingLeft: 8 }}>{L.jami[lang]} ({groupList.length} mijoz)</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(groupList.reduce((s, g) => s + g.totalAmount, 0))}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#2e7d32' }}>{fmt(groupList.reduce((s, g) => s + g.totalPaid, 0))}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#c62828' }}>{fmt(groupList.reduce((s, g) => s + Math.max(0, g.totalAmount - g.totalPaid), 0))}</td>
              <td colSpan={2}></td>
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
