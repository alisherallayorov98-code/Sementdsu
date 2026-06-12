import { useState } from 'react';
import { useData } from '../context/DataContext';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };

export default function Customers({ lang }) {
  const {
    customers, addCustomer, updateCustomer, deleteCustomer,
    soldRows, debtRows, advanceRows, incomeRows, expenseRows,
  } = useData();

  const [form, setForm]         = useState({ name: '', phone: '', address: '', note: '' });
  const [editId, setEditId]     = useState(null);
  const [editData, setEditData] = useState({});
  const [search, setSearch]     = useState('');
  const [showForm, setShowForm] = useState(false);
  const [modalCust, setModalCust] = useState(null); // detail modal
  const [sortBy, setSortBy]     = useState('date'); // 'date' | 'name' | 'debt' | 'xarid'

  // ── Qo'shish ─────────────────────────────────────────────────────────────
  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.name) return;
    const exists = customers.some(c => c.name.toLowerCase() === form.name.trim().toLowerCase());
    if (exists && !window.confirm(`"${form.name}" allaqachon mavjud. Qo'shilsinmi?`)) return;
    addCustomer(form);
    setForm({ name: '', phone: '', address: '', note: '' });
    setShowForm(false);
  };

  // ── Tahrirlash ────────────────────────────────────────────────────────────
  const startEdit = (c) => { setEditId(c.id); setEditData({ name: c.name, phone: c.phone || '', address: c.address || '', note: c.note || '' }); };
  const saveEdit  = (id) => { if (!editData.name) return; updateCustomer(id, editData); setEditId(null); };

  // ── O'chirish ────────────────────────────────────────────────────────────
  const handleDelete = (id, name) => { if (window.confirm(`"${name}" o'chirilsinmi?`)) deleteCustomer(id); };

  // ── Har bir mijoz uchun moliyaviy ma'lumot ────────────────────────────────
  const custStats = (name) => {
    const sales   = soldRows.filter(r => r.customer === name);
    const debts   = debtRows.filter(r => r.customer === name);
    const advs    = advanceRows.filter(r => r.customer === name);
    const totalXarid  = sales.reduce((s, r) => s + Number(r.tons || 0) * Number(r.pricePerTon || 0), 0);
    const totalTon    = sales.reduce((s, r) => s + Number(r.tons || 0), 0);
    const totalQarz   = debts.reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalTolandi = debts.reduce((s, r) => s + Number(r.paid || 0), 0);
    const qolganQarz  = Math.max(0, totalQarz - totalTolandi);
    const totalAvans  = advs.reduce((s, r) => s + Number(r.amount || 0), 0);
    return { totalXarid, totalTon, totalQarz, totalTolandi, qolganQarz, totalAvans, salesCount: sales.length };
  };

  // ── Filter + saralash ─────────────────────────────────────────────────────
  let filtered = customers
    .filter(c =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search) ||
      (c.address || '').toLowerCase().includes(search.toLowerCase())
    )
    .map(c => ({ ...c, _stats: custStats(c.name) }));

  if (sortBy === 'name')  filtered.sort((a, b) => a.name.localeCompare(b.name));
  if (sortBy === 'debt')  filtered.sort((a, b) => b._stats.qolganQarz - a._stats.qolganQarz);
  if (sortBy === 'xarid') filtered.sort((a, b) => b._stats.totalXarid - a._stats.totalXarid);
  if (sortBy === 'date')  filtered.sort((a, b) => b.id - a.id);

  // ── Umumiy statistika ─────────────────────────────────────────────────────
  const allStats = customers.map(c => custStats(c.name));
  const totalDebtAll  = allStats.reduce((s, x) => s + x.qolganQarz, 0);
  const totalXaridAll = allStats.reduce((s, x) => s + x.totalXarid, 0);
  const totalTonAll   = allStats.reduce((s, x) => s + x.totalTon, 0);
  const withDebt      = allStats.filter(x => x.qolganQarz > 0).length;

  const inp = { padding: '4px 7px', fontSize: 13, border: '1px solid #ccc', borderRadius: 3, fontFamily: 'Tahoma, sans-serif' };

  // ── Mijoz detail modal ───────────────────────────────────────────────────
  const DetailModal = () => {
    if (!modalCust) return null;
    const c     = customers.find(x => x.id === modalCust);
    if (!c) return null;
    const st    = custStats(c.name);
    const sales = soldRows.filter(r => r.customer === c.name).slice().reverse();
    const debts = debtRows.filter(r => r.customer === c.name);
    const advs  = advanceRows.filter(r => r.customer === c.name);

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        background: 'rgba(0,0,0,0.5)', zIndex: 2000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 24, boxSizing: 'border-box', overflowY: 'auto',
      }} onClick={e => { if (e.target === e.currentTarget) setModalCust(null); }}>
        <div style={{
          background: '#fff', width: '94%', maxWidth: 900,
          maxHeight: '92vh', overflowY: 'auto',
          borderRadius: 6, boxShadow: '0 6px 32px rgba(0,0,0,0.35)',
        }}>
          {/* Header */}
          <div style={{ background: '#283593', color: '#fff', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 16 }}>👤 {c.name}</div>
              <div style={{ fontSize: 12, color: '#c5cae9', marginTop: 2 }}>
                {c.phone && <span style={{ marginRight: 12 }}>📞 {c.phone}</span>}
                {c.address && <span>📍 {c.address}</span>}
              </div>
            </div>
            <button onClick={() => setModalCust(null)}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, padding: '4px 12px', borderRadius: 4 }}>✕</button>
          </div>

          <div style={{ padding: '16px 20px' }}>
            {/* Statistika kartalar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }}>
              <MiniCard label="Jami xarid"      value={`${fmt(st.totalXarid)} so'm`} color="#1565c0" bg="#e3f2fd" />
              <MiniCard label="Jami tonna"      value={`${fmtT(st.totalTon)} tn`}    color="#1565c0" bg="#e8f5e9" />
              <MiniCard label="Nasiya berildi"  value={`${fmt(st.totalQarz)} so'm`}  color="#e65100" bg="#fff3e0" />
              <MiniCard label="To'langan"       value={`${fmt(st.totalTolandi)} so'm`} color="#2e7d32" bg="#e8f5e9" />
              <MiniCard label="Qolgan qarz"     value={`${fmt(st.qolganQarz)} so'm`}
                color={st.qolganQarz > 0 ? '#c62828' : '#2e7d32'}
                bg={st.qolganQarz > 0 ? '#ffebee' : '#e8f5e9'} bold />
              {st.totalAvans > 0 && <MiniCard label="Avans" value={`${fmt(st.totalAvans)} so'm`} color="#6a1b9a" bg="#f3e5f5" />}
            </div>

            {/* Xaridlar tarixi */}
            {sales.length > 0 && (
              <>
                <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 6, color: '#283593' }}>🏭 Xaridlar tarixi ({sales.length} ta)</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#e8eaf6' }}>
                      <th style={thS}>#</th><th style={thS}>Sana</th>
                      <th style={{ ...thS, textAlign: 'right' }}>Tonna</th>
                      <th style={{ ...thS, textAlign: 'right' }}>Narx</th>
                      <th style={{ ...thS, textAlign: 'right' }}>Summa</th>
                      <th style={thS}>To'lov</th><th style={thS}>Izoh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((r, i) => {
                      const sum = Number(r.tons || 0) * Number(r.pricePerTon || 0);
                      return (
                        <tr key={r.id} style={{ background: r.paymentChannel === 'nasiya' ? '#fff5ee' : (i % 2 === 0 ? '#fff' : '#f9f9f9') }}>
                          <td style={tdS}>{i + 1}</td>
                          <td style={tdS}>{r.date}</td>
                          <td style={{ ...tdS, textAlign: 'right', fontWeight: 'bold' }}>{fmtT(r.tons)} tn</td>
                          <td style={{ ...tdS, textAlign: 'right' }}>{fmt(r.pricePerTon)}</td>
                          <td style={{ ...tdS, textAlign: 'right', fontWeight: 'bold', color: r.paymentChannel === 'nasiya' ? '#c62828' : '#2e7d32' }}>{fmt(sum)}</td>
                          <td style={{ ...tdS, color: r.paymentChannel === 'nasiya' ? '#c62828' : '#333', fontWeight: r.paymentChannel === 'nasiya' ? 'bold' : 'normal' }}>{r.paymentChannel}</td>
                          <td style={tdS}>{r.izoh || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}

            {/* Qarzlar */}
            {debts.length > 0 && (
              <>
                <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 6, color: '#c62828' }}>💳 Qarz / Nasiya ({debts.length} ta)</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#ffebee' }}>
                      <th style={thS}>#</th><th style={thS}>Sana</th><th style={thS}>Izoh</th>
                      <th style={{ ...thS, textAlign: 'right' }}>Qarz</th>
                      <th style={{ ...thS, textAlign: 'right', color: '#2e7d32' }}>To'landi</th>
                      <th style={{ ...thS, textAlign: 'right', color: '#c62828' }}>Qolgan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debts.map((d, i) => {
                      const left = Math.max(0, Number(d.amount) - Number(d.paid || 0));
                      return (
                        <tr key={d.id} style={{ background: left <= 0 ? '#e8f5e9' : (i % 2 === 0 ? '#fff' : '#fff9f9') }}>
                          <td style={tdS}>{i + 1}</td><td style={tdS}>{d.date}</td><td style={tdS}>{d.note || '—'}</td>
                          <td style={{ ...tdS, textAlign: 'right' }}>{fmt(d.amount)}</td>
                          <td style={{ ...tdS, textAlign: 'right', color: '#2e7d32', fontWeight: 'bold' }}>{fmt(d.paid || 0)}</td>
                          <td style={{ ...tdS, textAlign: 'right', color: left > 0 ? '#c62828' : '#2e7d32', fontWeight: 'bold' }}>
                            {left > 0 ? fmt(left) : '✓ To\'landi'}
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: '#ffff00', fontWeight: 'bold' }}>
                      <td colSpan={3} style={{ ...tdS, textAlign: 'right' }}>JAMI:</td>
                      <td style={{ ...tdS, textAlign: 'right' }}>{fmt(st.totalQarz)}</td>
                      <td style={{ ...tdS, textAlign: 'right', color: '#2e7d32' }}>{fmt(st.totalTolandi)}</td>
                      <td style={{ ...tdS, textAlign: 'right', color: st.qolganQarz > 0 ? '#c62828' : '#2e7d32' }}>{fmt(st.qolganQarz)}</td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}

            {/* Avanslar */}
            {advs.length > 0 && (
              <>
                <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 6, color: '#6a1b9a' }}>💰 Avanslar ({advs.length} ta)</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f3e5f5' }}>
                      <th style={thS}>#</th><th style={thS}>Sana</th><th style={thS}>Izoh</th>
                      <th style={{ ...thS, textAlign: 'right' }}>Miqdor</th>
                      <th style={{ ...thS, textAlign: 'right' }}>Ishlatildi</th>
                      <th style={{ ...thS, textAlign: 'right' }}>Qolgan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advs.map((a, i) => {
                      const qoldi = Math.max(0, Number(a.amount) - Number(a.used || 0));
                      return (
                        <tr key={a.id} style={{ background: i % 2 === 0 ? '#fff' : '#fdf5ff' }}>
                          <td style={tdS}>{i + 1}</td><td style={tdS}>{a.date}</td>
                          <td style={tdS}>{a.note || '—'}</td>
                          <td style={{ ...tdS, textAlign: 'right', fontWeight: 'bold' }}>{fmt(a.amount)}</td>
                          <td style={{ ...tdS, textAlign: 'right', color: '#e65100' }}>{fmt(a.used || 0)}</td>
                          <td style={{ ...tdS, textAlign: 'right', fontWeight: 'bold', color: qoldi > 0 ? '#6a1b9a' : '#2e7d32' }}>{fmt(qoldi)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}

            {sales.length === 0 && debts.length === 0 && advs.length === 0 && (
              <p style={{ color: '#aaa', fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>Bu mijoz uchun hali hech qanday tranzaksiya yo'q.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>

      {/* ── STATISTIKA PANELI ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <StatBox label="Jami mijozlar" value={customers.length} unit="ta"  color="#283593" bg="#e8eaf6" />
        <StatBox label="Umumiy xarid"  value={fmt(totalXaridAll)} unit="so'm" color="#1b5e20" bg="#e8f5e9" />
        <StatBox label="Jami tonna"    value={`${fmtT(totalTonAll)}`} unit="tn" color="#0d47a1" bg="#e3f2fd" />
        <StatBox label="Qarz bor"      value={withDebt} unit="ta mijoz"   color="#c62828" bg="#ffebee" />
        <StatBox label="Umumiy qarz"   value={fmt(totalDebtAll)} unit="so'm" color="#c62828" bg="#ffebee" bold />
      </div>

      {/* ── QIDIRUV + SARALASH + QO'SHISH ────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="🔍 Ism, telefon, manzil..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inp, width: 230, border: '1px solid #9fa8da' }}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...inp, border: '1px solid #ccc' }}>
          <option value="date">↓ Yangi qo'shilgan</option>
          <option value="name">А-Z Ism bo'yicha</option>
          <option value="debt">↓ Qarz bo'yicha</option>
          <option value="xarid">↓ Xarid bo'yicha</option>
        </select>
        <button onClick={() => setShowForm(v => !v)} style={{
          padding: '5px 18px', cursor: 'pointer',
          background: showForm ? '#c62828' : '#283593',
          color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', fontSize: 13,
        }}>
          {showForm ? '✕ Yopish' : '+ Yangi mijoz'}
        </button>
        <span style={{ color: '#888', fontSize: 12 }}>{filtered.length} ta ko'rinmoqda</span>
      </div>

      {/* ── YANGI MIJOZ FORMASI ───────────────────────────────────────────── */}
      {showForm && (
        <form onSubmit={handleAdd} style={{
          marginBottom: 16, padding: '14px 16px',
          background: '#e8eaf6', border: '1px solid #9fa8da', borderRadius: 6,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10,
        }}>
          {[
            { key: 'name',    label: 'Ism *',   ph: 'Ism yoki korxona', req: true  },
            { key: 'phone',   label: 'Telefon', ph: '+998 90 000 00 00', req: false },
            { key: 'address', label: 'Manzil',  ph: "Shahar, ko'cha",   req: false },
            { key: 'note',    label: 'Izoh',    ph: "Qo'shimcha",       req: false },
          ].map(({ key, label, ph, req }) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 3 }}>{label}</label>
              <input placeholder={ph} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                required={req} autoFocus={key === 'name'}
                style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button type="submit" style={{ padding: '6px 20px', cursor: 'pointer', background: '#283593', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', fontSize: 13 }}>
              ✓ Qo'shish
            </button>
            <button type="button" onClick={() => { setForm({ name:'', phone:'', address:'', note:'' }); setShowForm(false); }}
              style={{ padding: '6px 14px', cursor: 'pointer', background: '#fff', border: '1px solid #ccc', borderRadius: 4 }}>
              Bekor
            </button>
          </div>
        </form>
      )}

      {/* ── MIJOZLAR JADVAL ───────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <p style={{ color: '#888', fontStyle: 'italic', marginTop: 20 }}>Mijoz topilmadi.</p>
      ) : (
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 35 }}>#</th>
              <th style={{ width: 85 }}>Sana</th>
              <th style={{ minWidth: 160 }}>Ism</th>
              <th style={{ width: 135 }}>Telefon</th>
              <th style={{ width: 140 }}>Manzil</th>
              <th style={{ textAlign: 'right', width: 130 }}>Jami xarid</th>
              <th style={{ textAlign: 'right', width: 80 }}>Tonna</th>
              <th style={{ textAlign: 'right', width: 125 }}>Qolgan qarz</th>
              <th style={{ width: 90 }}>Amal</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const st = c._stats;
              return (
                <tr key={c.id} style={{ background: st.qolganQarz > 0 ? '#fff9f0' : (i % 2 === 0 ? '#fff' : '#f4f5ff') }}>
                  <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{i + 1}</td>
                  <td style={{ fontSize: 11, color: '#777' }}>
                    {c.id > 1e10 ? new Date(c.id).toLocaleDateString('ru-RU') : '—'}
                  </td>

                  {editId === c.id ? (
                    <>
                      <td><input value={editData.name}    onChange={e => setEditData({...editData, name: e.target.value})}    style={{ ...inp, width: '100%', fontSize: 12 }} /></td>
                      <td><input value={editData.phone}   onChange={e => setEditData({...editData, phone: e.target.value})}   style={{ ...inp, width: '100%', fontSize: 12 }} placeholder="+998..." /></td>
                      <td><input value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} style={{ ...inp, width: '100%', fontSize: 12 }} /></td>
                      <td colSpan={3}><input value={editData.note} onChange={e => setEditData({...editData, note: e.target.value})} style={{ ...inp, width: '100%', fontSize: 12 }} placeholder="Izoh" /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => saveEdit(c.id)} style={greenBtn}>✓</button>
                          <button onClick={() => setEditId(null)} style={redBtn}>✕</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <button onClick={() => setModalCust(c.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#283593', fontWeight: 'bold', fontSize: 13, padding: 0, textDecoration: 'underline', textAlign: 'left' }}>
                          {c.name}
                        </button>
                        {c.note && <span style={{ color: '#999', fontSize: 10, marginLeft: 6 }}>{c.note}</span>}
                      </td>
                      <td>
                        {c.phone
                          ? <a href={`tel:${c.phone}`} style={{ color: '#1565c0', textDecoration: 'none', fontWeight: 'bold', fontSize: 12 }}>📞 {c.phone}</a>
                          : <span style={{ color: '#bbb' }}>—</span>}
                      </td>
                      <td style={{ fontSize: 11, color: '#444' }}>{c.address || <span style={{ color: '#bbb' }}>—</span>}</td>
                      {/* Moliyaviy */}
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#1565c0', fontSize: 12 }}>
                        {st.totalXarid > 0 ? fmt(st.totalXarid) : <span style={{ color: '#bbb' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#1565c0', fontSize: 12 }}>
                        {st.totalTon > 0 ? `${fmtT(st.totalTon)} tn` : <span style={{ color: '#bbb' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {st.qolganQarz > 0 ? (
                          <span style={{ background: '#c62828', color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' }}>
                            {fmt(st.qolganQarz)}
                          </span>
                        ) : st.totalQarz > 0 ? (
                          <span style={{ color: '#2e7d32', fontSize: 12 }}>✓ To'landi</span>
                        ) : (
                          <span style={{ color: '#bbb', fontSize: 11 }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => setModalCust(c.id)} style={infoBtn}>👁</button>
                          <button onClick={() => startEdit(c)} style={editBtn}>✎</button>
                          <button onClick={() => handleDelete(c.id, c.name)} style={redBtn}>✕</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* ── DETAIL MODAL ─────────────────────────────────────────────────── */}
      <DetailModal />
    </div>
  );
}

// ─── Yordamchi komponentlar ──────────────────────────────────────────────────
function StatBox({ label, value, unit, color, bg, bold }) {
  return (
    <div style={{ padding: '8px 16px', background: bg, borderLeft: `4px solid ${color}`, borderRadius: 4, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: bold ? 18 : 16, fontWeight: 'bold', color, fontFamily: 'monospace' }}>
        {value} <span style={{ fontSize: 12 }}>{unit}</span>
      </div>
    </div>
  );
}

function MiniCard({ label, value, color, bg, bold }) {
  return (
    <div style={{ padding: '8px 12px', background: bg, borderLeft: `3px solid ${color}`, borderRadius: 4 }}>
      <div style={{ fontSize: 10, color: '#666', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: bold ? 15 : 13, fontWeight: 'bold', color, fontFamily: 'monospace' }}>{value}</div>
    </div>
  );
}

// ─── Stil konstantlari ──────────────────────────────────────────────────────
const thS      = { border: '1px solid #ccc', padding: '4px 8px', fontWeight: 'bold', fontSize: 11, textAlign: 'left', background: 'inherit' };
const tdS      = { border: '1px solid #e0e0e0', padding: '4px 8px', fontSize: 11 };
const infoBtn  = { padding: '2px 7px', cursor: 'pointer', background: '#e8eaf6', border: '1px solid #3949ab', borderRadius: 3, color: '#283593', fontSize: 12 };
const editBtn  = { padding: '2px 7px', cursor: 'pointer', background: '#e3f2fd', border: '1px solid #1976d2', borderRadius: 3, color: '#1565c0', fontSize: 12 };
const greenBtn = { padding: '2px 7px', cursor: 'pointer', background: '#e8f5e9', border: '1px solid #4caf50', borderRadius: 3, color: '#2e7d32', fontSize: 12, fontWeight: 'bold' };
const redBtn   = { padding: '2px 7px', cursor: 'pointer', background: '#ffebee', border: '1px solid #e53935', borderRadius: 3, color: '#c62828', fontSize: 12 };
