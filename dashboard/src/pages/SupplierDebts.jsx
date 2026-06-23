import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import SupplierSelect from '../components/SupplierSelect';
import ExcelExport from '../components/ExcelExport';
import DateRangeFilter from '../components/DateRangeFilter';
import { filterByRange } from '../lib/dateRange';
import Paginator from '../components/Paginator';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const ACCENT = '#00695c';

const CH_LBL = { naqd: '💵 Naqd', bank: '🏦 Bank', click: '📱 Click' };

export default function SupplierDebts() {
  const {
    supplierList, supplierReceivedOf, supplierPaidOf, supplierDebtOf,
    totalSupplierReceived, totalSupplierPaid, totalSupplierDebt,
    supplierPayments, paySupplier, deleteSupplierPayment,
  } = useData();

  const [pay, setPay] = useState({ supplier: '', amount: '', channel: 'naqd', note: '' });
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState(null); // qaysi yetkazib beruvchi to'lov tarixi
  const [range, setRange] = useState({ from: '', to: '' });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;

  const debtOf = (name) => supplierDebtOf(name);

  const handlePay = (e) => {
    e.preventDefault();
    if (!pay.supplier || !pay.amount) return;
    const amt = Number(pay.amount);
    const rem = debtOf(pay.supplier);
    if (amt > rem && !window.confirm(`Diqqat! "${pay.supplier}" ga qarzimiz ${fmt(rem)} so'm. Baribir ${fmt(amt)} so'm to'lansinmi? (Ortiqcha to'lov bo'ladi)`)) return;
    paySupplier(pay.supplier, amt, pay.channel, pay.note || "Zavodga to'lov");
    setPay({ supplier: '', amount: '', channel: 'naqd', note: '' });
  };

  // Har bir yetkazib beruvchi bo'yicha hisob
  const rows = supplierList
    .map(name => ({
      name,
      received: supplierReceivedOf(name),
      paid: supplierPaidOf(name),
      debt: supplierDebtOf(name),
    }))
    .filter(r => r.received > 0 || r.paid > 0)
    .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.debt - a.debt);

  const payList = filterByRange(
    [...supplierPayments].sort((a, b) => b.createdAt - a.createdAt),
    range
  );

  const remOf = pay.supplier ? debtOf(pay.supplier) : 0;
  useEffect(() => { setPage(1); }, [search]);
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13, paddingBottom: 30 }}>

      {/* ── STATISTIKA ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <StatCard label="Jami olingan (summa)" value={fmt(totalSupplierReceived)} color="#00695c" bg="#e0f2f1" />
        <StatCard label="Jami to'langan"        value={fmt(totalSupplierPaid)}    color="#2e7d32" bg="#e8f5e9" />
        <StatCard label="Qoldiq qarzimiz"       value={fmt(totalSupplierDebt)}     color="#c62828" bg="#ffebee" />
      </div>

      {/* ── ZAVODGA TO'LOV QILISH ───────────────────────────────────────────── */}
      <form onSubmit={handlePay} style={{
        display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center',
        padding: '12px 14px', background: '#e0f2f1', border: `2px solid ${ACCENT}`, borderRadius: 8,
      }}>
        <span style={{ fontWeight: 'bold', color: '#004d40', fontSize: 14 }}>💸 Yetkazib beruvchiga to'lov:</span>
        <SupplierSelect
          value={pay.supplier}
          onChange={name => setPay({ ...pay, supplier: name })}
          placeholder="Manbaa (zavod)"
          width={200}
          accentColor={ACCENT}
          required
        />
        {pay.supplier && (
          <span style={{ fontSize: 12, color: remOf > 0 ? '#c62828' : '#2e7d32', fontWeight: 'bold' }}>
            Qarzimiz: {fmt(remOf)} so'm
          </span>
        )}
        <input
          type="number" placeholder="Qancha to'lanadi?"
          value={pay.amount}
          onChange={e => setPay({ ...pay, amount: e.target.value })}
          style={{ ...inp, width: 160, border: `1px solid ${ACCENT}` }}
        />
        {[
          { v: 'naqd', label: '💵 Naqd', color: '#1565c0' },
          { v: 'bank', label: '🏦 Bank', color: '#2e7d32' },
          { v: 'click', label: '📱 Click', color: '#6a1b9a' },
        ].map(ch => (
          <button key={ch.v} type="button" onClick={() => setPay({ ...pay, channel: ch.v })} style={{
            padding: '5px 12px', fontSize: 12, cursor: 'pointer',
            border: `2px solid ${pay.channel === ch.v ? ch.color : '#ccc'}`,
            background: pay.channel === ch.v ? ch.color : '#fff',
            color: pay.channel === ch.v ? '#fff' : '#333', borderRadius: 4, fontWeight: 'bold',
          }}>{ch.label}</button>
        ))}
        {pay.supplier && remOf > 0 && (
          <button type="button" onClick={() => setPay({ ...pay, amount: String(remOf) })}
            style={{ padding: '5px 10px', cursor: 'pointer', background: '#fff', color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 4, fontSize: 12 }}>
            To'liq ({fmt(remOf)})
          </button>
        )}
        <button type="submit" style={{ padding: '7px 22px', cursor: 'pointer', background: ACCENT, color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', fontSize: 14 }}>
          ✓ To'lash
        </button>
      </form>

      {/* ── HAR BIR YETKAZIB BERUVCHI BO'YICHA QARZ ─────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="🔍 Yetkazib beruvchini qidirish..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, width: 240 }} />
        <span style={{ color: '#888', fontSize: 11 }}>({rows.length} ta)</span>
      </div>

      {rows.length === 0 ? (
        <p style={{ color: '#888', fontStyle: 'italic' }}>Hozircha yetkazib beruvchi yo'q.</p>
      ) : (
        <>
        <table className="data-table" style={{ width: '100%', maxWidth: 820, marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th>Yetkazib beruvchi</th>
              <th style={{ textAlign: 'right', width: 150 }}>Olingan (summa)</th>
              <th style={{ textAlign: 'right', width: 140 }}>To'langan</th>
              <th style={{ textAlign: 'right', width: 140, color: '#c62828' }}>Qoldiq qarz</th>
              <th style={{ width: 90 }}>Amal</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r, i) => (
              <tr key={r.name} style={{ background: r.debt > 0 ? '#fff' : '#e8f5e9' }}>
                <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                <td style={{ fontWeight: 'bold', color: '#004d40' }}>🏭 {r.name}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.received)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#2e7d32', fontWeight: 'bold' }}>{fmt(r.paid)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', color: r.debt > 0 ? '#c62828' : '#2e7d32', fontWeight: 'bold' }}>{fmt(r.debt)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {r.debt > 0 && (
                      <button onClick={() => setPay({ supplier: r.name, amount: '', channel: 'naqd', note: '' })}
                        style={{ fontSize: 11, cursor: 'pointer', padding: '2px 7px', background: '#e0f2f1', border: `1px solid ${ACCENT}`, borderRadius: 3, color: ACCENT }}>
                        💸 To'lash
                      </button>
                    )}
                    {r.paid > 0 && (
                      <button onClick={() => setHistory(r.name)}
                        style={{ fontSize: 11, cursor: 'pointer', padding: '2px 7px', background: '#e3f2fd', border: '1px solid #1976d2', borderRadius: 3, color: '#1565c0' }}>
                        📋 Tarix
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            <tr style={{ background: '#ffff00', fontWeight: 'bold' }}>
              <td colSpan={2} style={{ paddingLeft: 8 }}>JAMI</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(rows.reduce((s, r) => s + r.received, 0))}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#2e7d32' }}>{fmt(rows.reduce((s, r) => s + r.paid, 0))}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#c62828' }}>{fmt(rows.reduce((s, r) => s + r.debt, 0))}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        <Paginator total={rows.length} page={page} setPage={setPage} pageSize={PAGE_SIZE} />
        </>
      )}

      {/* ── TO'LOVLAR TARIXI (ro'yxat + sana filtri) ────────────────────────── */}
      <h3 style={{ fontSize: 14, color: ACCENT, margin: '8px 0' }}>To'lovlar tarixi</h3>
      <DateRangeFilter value={range} onChange={setRange} color={ACCENT} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <ExcelExport
          filename="Yetkazib_beruvchi_tolovlari"
          sheetName="Tolovlar"
          title="Yetkazib beruvchiga to'lovlar"
          columns={[
            { header: 'Sana', value: r => r.date },
            { header: 'Yetkazib beruvchi', value: r => r.supplier },
            { header: "Summa (so'm)", value: r => Number(r.amount || 0) },
            { header: 'Kanal', value: r => r.channel || '' },
            { header: 'Izoh', value: r => r.note || '' },
            { header: 'Xodim', value: r => r.worker || '' },
          ]}
          rows={payList}
        />
      </div>
      {payList.length === 0 ? (
        <p style={{ color: '#888', fontStyle: 'italic' }}>To'lovlar topilmadi.</p>
      ) : (
        <table className="data-table" style={{ width: '100%', maxWidth: 820 }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th style={{ width: 90 }}>Sana</th>
              <th>Yetkazib beruvchi</th>
              <th style={{ textAlign: 'right', width: 150 }}>Summa</th>
              <th style={{ width: 90 }}>Kanal</th>
              <th>Izoh</th>
              <th style={{ width: 110 }}>Xodim</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {payList.map((p, i) => (
              <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#f5f5f5' }}>
                <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{i + 1}</td>
                <td style={{ fontSize: 12 }}>{p.date}</td>
                <td style={{ fontWeight: 'bold', color: '#004d40' }}>{p.supplier}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#c62828', fontWeight: 'bold' }}>-{fmt(p.amount)}</td>
                <td style={{ fontSize: 12 }}>{CH_LBL[p.channel] || p.channel}</td>
                <td style={{ fontSize: 12, color: '#555' }}>{p.note || '—'}</td>
                <td style={{ fontSize: 11, color: '#003366' }}>{p.worker || '—'}</td>
                <td>
                  <button onClick={() => { if (window.confirm("To'lovni o'chirasizmi? (Kassaga pul qaytadi)")) deleteSupplierPayment(p.id); }}
                    style={{ fontSize: 10, cursor: 'pointer', background: '#ffcccc', border: '1px solid #c00', padding: '2px 5px' }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── TARIX MODALI (bitta yetkazib beruvchi) ──────────────────────────── */}
      {history !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setHistory(null)}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 6, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', minWidth: 420, maxWidth: 580 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 12, color: ACCENT }}>
              To'lov tarixi: {history}
            </div>
            {(() => {
              const list = supplierPayments.filter(p => p.supplier === history).sort((a, b) => b.createdAt - a.createdAt);
              if (!list.length) return <p style={{ color: '#888', fontStyle: 'italic' }}>To'lov yo'q.</p>;
              return (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: ACCENT, color: '#fff' }}>
                      <th style={th}>#</th><th style={th}>Sana</th>
                      <th style={{ ...th, textAlign: 'right' }}>Summa</th>
                      <th style={th}>Kanal</th><th style={th}>Izoh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((p, i) => (
                      <tr key={p.id} style={{ background: i % 2 === 0 ? '#f9f9f9' : '#fff' }}>
                        <td style={td}>{i + 1}</td>
                        <td style={td}>{p.date}</td>
                        <td style={{ ...td, textAlign: 'right', color: '#2e7d32', fontWeight: 'bold' }}>{fmt(p.amount)}</td>
                        <td style={td}>{CH_LBL[p.channel] || p.channel}</td>
                        <td style={td}>{p.note || '—'}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#e8f5e9', fontWeight: 'bold' }}>
                      <td colSpan={2} style={td}>Jami to'langan:</td>
                      <td style={{ ...td, textAlign: 'right', color: '#2e7d32' }}>{fmt(list.reduce((s, p) => s + Number(p.amount || 0), 0))}</td>
                      <td colSpan={2} style={td}></td>
                    </tr>
                  </tbody>
                </table>
              );
            })()}
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button onClick={() => setHistory(null)} style={{ padding: '5px 20px', cursor: 'pointer', background: ACCENT, color: '#fff', border: 'none', borderRadius: 3 }}>Yopish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, bg }) {
  return (
    <div style={{ padding: '8px 16px', background: bg, border: `1px solid ${color}33`, borderLeft: `4px solid ${color}`, borderRadius: 4, minWidth: 170 }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 'bold', color, fontFamily: 'monospace' }}>{value} so'm</div>
    </div>
  );
}

const inp = { padding: '6px 10px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4, fontFamily: 'Tahoma, sans-serif' };
const th = { padding: '5px 8px', textAlign: 'left', border: '1px solid #00564d', fontWeight: 'bold' };
const td = { padding: '5px 8px', border: '1px solid #ddd' };
