import { useState } from 'react';
import { useData } from '../context/DataContext';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (ts) => {
  if (!ts || ts < 1e10) return '—';
  const d = new Date(ts);
  return [String(d.getHours()).padStart(2,'0'), String(d.getMinutes()).padStart(2,'0')].join(':');
};

const ACCENT  = '#4e342e'; // dark brown
const LAVANDA = '#efebe9'; // light brown bg

export default function Drivers({ lang }) {
  const {
    drivers, addDriver, updateDriver, deleteDriver,
    driverTrips, addDriverTrip, deleteDriverTrip,
  } = useData();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ name: '', carNumber: '', phone: '' });

  const [editId, setEditId]     = useState(null);
  const [editData, setEditData] = useState({});

  const [modalDriver, setModalDriver] = useState(null);
  const [tripForm, setTripForm] = useState({ destination: '', price: '', note: '', isPayment: false });

  const [search, setSearch]     = useState('');

  // ── Qo'shish ──────────────────────────────────────────────────────────────
  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.name) return;
    addDriver(form.name, form.carNumber, form.phone);
    setForm({ name: '', carNumber: '', phone: '' });
    setShowForm(false);
  };

  const startEdit = (d) => {
    setEditId(d.id);
    setEditData({ name: d.name, carNumber: d.carNumber || '', phone: d.phone || '' });
  };
  const saveEdit = (id) => {
    if (!editData.name) return;
    updateDriver(id, editData);
    setEditId(null);
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`"${name}" va uning barcha qatnovlari o'chirib yuboriladi. Rozimisiz?`)) {
      deleteDriver(id);
    }
  };

  // ── Qatnov qo'shish ───────────────────────────────────────────────────────
  const handleAddTrip = (e) => {
    e.preventDefault();
    if (!tripForm.price) return;
    addDriverTrip(modalDriver, tripForm.destination, tripForm.price, tripForm.isPayment, tripForm.note);
    setTripForm({ destination: '', price: '', note: '', isPayment: false });
  };

  // ── Hisob-kitoblar ────────────────────────────────────────────────────────
  const getStats = (id) => {
    const trips = driverTrips.filter(t => t.driverId === id);
    const totalEarnings = trips.filter(t => !t.isPayment).reduce((s, t) => s + Number(t.price), 0);
    const totalPaid     = trips.filter(t => t.isPayment).reduce((s, t) => s + Number(t.price), 0);
    const balance       = Math.max(0, totalEarnings - totalPaid);
    return { totalEarnings, totalPaid, balance, tripsCount: trips.filter(t => !t.isPayment).length };
  };

  const allStats     = drivers.map(d => getStats(d.id));
  const totalBalance = allStats.reduce((s, x) => s + x.balance, 0);
  const totalQatnov  = allStats.reduce((s, x) => s + x.tripsCount, 0);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = drivers.filter(d =>
    !search ||
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.carNumber || '').toLowerCase().includes(search.toLowerCase())
  );

  const inp = { padding: '4px 7px', fontSize: 13, border: '1px solid #ccc', borderRadius: 3, fontFamily: 'Tahoma, sans-serif' };

  // ── Modal ─────────────────────────────────────────────────────────────────
  const DetailModal = () => {
    if (!modalDriver) return null;
    const d = drivers.find(x => x.id === modalDriver);
    if (!d) return null;
    const st = getStats(d.id);
    const trips = driverTrips.filter(t => t.driverId === d.id).sort((a, b) => b.createdAt - a.createdAt);

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        background: 'rgba(0,0,0,0.6)', zIndex: 2000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 30, overflowY: 'auto'
      }} onClick={e => { if (e.target === e.currentTarget) setModalDriver(null); }}>
        <div style={{ background: '#fff', width: 600, borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', marginBottom: 30 }}>

          {/* Header */}
          <div style={{ background: ACCENT, color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 16 }}>🚚 {d.name}</div>
              <div style={{ fontSize: 12, color: '#d7ccc8', marginTop: 2 }}>
                {d.carNumber && <span style={{ marginRight: 10 }}>🔢 {d.carNumber}</span>}
                {d.phone && <span>📞 {d.phone}</span>}
              </div>
            </div>
            <button onClick={() => setModalDriver(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>✕</button>
          </div>

          {/* Statistika */}
          <div style={{ display: 'flex', background: LAVANDA, borderBottom: '1px solid #d7ccc8' }}>
            <div style={{ flex: 1, padding: '12px', textAlign: 'center', borderRight: '1px solid #d7ccc8' }}>
              <div style={{ fontSize: 11, color: '#666' }}>Ishladi ({st.tripsCount} marta)</div>
              <div style={{ fontWeight: 'bold', fontSize: 15 }}>{fmt(st.totalEarnings)}</div>
            </div>
            <div style={{ flex: 1, padding: '12px', textAlign: 'center', borderRight: '1px solid #d7ccc8' }}>
              <div style={{ fontSize: 11, color: '#2e7d32' }}>To'landi</div>
              <div style={{ fontWeight: 'bold', fontSize: 15, color: '#2e7d32' }}>{fmt(st.totalPaid)}</div>
            </div>
            <div style={{ flex: 1, padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: st.balance > 0 ? '#c62828' : '#2e7d32' }}>Qarzimiz</div>
              <div style={{ fontWeight: 'bold', fontSize: 15, color: st.balance > 0 ? '#c62828' : '#2e7d32' }}>
                {st.balance > 0 ? fmt(st.balance) : '✓ Yo\'q'}
              </div>
            </div>
          </div>

          {/* Forma */}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <button type="button" onClick={() => setTripForm({ ...tripForm, isPayment: false })}
                style={{ flex: 1, padding: 8, cursor: 'pointer', border: tripForm.isPayment ? '1px solid #ccc' : `2px solid ${ACCENT}`, background: tripForm.isPayment ? '#fff' : ACCENT, color: tripForm.isPayment ? '#555' : '#fff', fontWeight: 'bold', borderRadius: 4 }}>
                🚛 Yangi qatnov (ish)
              </button>
              <button type="button" onClick={() => setTripForm({ ...tripForm, isPayment: true, destination: 'To\'lov' })}
                style={{ flex: 1, padding: 8, cursor: 'pointer', border: !tripForm.isPayment ? '1px solid #ccc' : `2px solid #2e7d32`, background: !tripForm.isPayment ? '#fff' : '#2e7d32', color: !tripForm.isPayment ? '#555' : '#fff', fontWeight: 'bold', borderRadius: 4 }}>
                💸 Pul berish (to'lov)
              </button>
            </div>

            <form onSubmit={handleAddTrip} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {!tripForm.isPayment && (
                <input placeholder="Qayerga (masalan: Oqqo'rg'on)" value={tripForm.destination} onChange={e => setTripForm({...tripForm, destination: e.target.value})} style={{ ...inp, flex: 1, minWidth: 120 }} required />
              )}
              <input type="number" placeholder={tripForm.isPayment ? "To'lov summasi" : "Kira haqi"} value={tripForm.price} onChange={e => setTripForm({...tripForm, price: e.target.value})} style={{ ...inp, width: 120 }} required autoFocus />
              <input placeholder="Izoh" value={tripForm.note} onChange={e => setTripForm({...tripForm, note: e.target.value})} style={{ ...inp, flex: 1, minWidth: 100 }} />
              <button type="submit" style={{ padding: '0 16px', background: tripForm.isPayment ? '#2e7d32' : ACCENT, color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 'bold' }}>✓ Saqlash</button>
            </form>

            {/* Tarix */}
            <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>Tarix</p>
            {trips.length === 0 ? <p style={{ color: '#aaa', fontStyle: 'italic', fontSize: 12 }}>Tarix bo'sh.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={thS}>Sana</th>
                    <th style={thS}>Yo'nalish / Amaliyot</th>
                    <th style={thS}>Izoh</th>
                    <th style={{ ...thS, textAlign: 'right' }}>Summa</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #eee', background: t.isPayment ? '#e8f5e9' : '#fff' }}>
                      <td style={tdS}>{t.date} <span style={{ color: '#999', fontSize: 10 }}>{fmtT(t.createdAt)}</span></td>
                      <td style={{ ...tdS, fontWeight: t.isPayment ? 'normal' : 'bold' }}>
                        {t.isPayment ? '💸 To\'lov berildi' : `🚛 ${t.destination}`}
                      </td>
                      <td style={tdS}>{t.note || '—'}</td>
                      <td style={{ ...tdS, textAlign: 'right', fontWeight: 'bold', color: t.isPayment ? '#2e7d32' : '#333' }}>
                        {t.isPayment ? '-' : '+'}{fmt(t.price)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={() => { if(window.confirm("O'chirasizmi?")) deleteDriverTrip(t.id); }} style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#c62828' }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        <StatBox label="Jami haydovchilar" value={drivers.length} unit="ta" color={ACCENT} bg={LAVANDA} />
        <StatBox label="Jami qatnovlar"    value={totalQatnov}    unit="ta" color="#1565c0" bg="#e3f2fd" />
        <StatBox label="Haydovchilardan qarzimiz" value={fmt(totalBalance)} unit="so'm" color="#c62828" bg="#ffebee" bold />
      </div>

      {/* ── QIDIRUV + QO'SHISH ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input placeholder="🔍 Ism yoki mashina raqami..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, width: 220 }} />
        <button onClick={() => setShowForm(v => !v)} style={{
          padding: '5px 16px', cursor: 'pointer', background: showForm ? '#c62828' : ACCENT,
          color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', marginLeft: 'auto',
        }}>
          {showForm ? '✕ Yopish' : '+ Yangi haydovchi'}
        </button>
      </div>

      {/* ── YANGI HAYDOVCHI FORMASI ───────────────────────────────────────── */}
      {showForm && (
        <form onSubmit={handleAdd} style={{
          marginBottom: 14, padding: '12px 14px', background: LAVANDA, border: `1px solid #bcaaa4`,
          borderRadius: 6, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 3 }}>Ism *</label>
            <input placeholder="Haydovchi ismi" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ ...inp, width: 160 }} required autoFocus />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 3 }}>Mashina raqami</label>
            <input placeholder="01 A 123 AA" value={form.carNumber} onChange={e => setForm({ ...form, carNumber: e.target.value })} style={{ ...inp, width: 140 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 3 }}>Telefon</label>
            <input placeholder="+998..." value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={{ ...inp, width: 140 }} />
          </div>
          <button type="submit" style={{ padding: '6px 20px', cursor: 'pointer', background: ACCENT, color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', height: 29 }}>
            ✓ Qo'shish
          </button>
        </form>
      )}

      {/* ── HAYDOVCHILAR JADVALI ──────────────────────────────────────────── */}
      {filtered.length === 0 ? <p style={{ color: '#888', fontStyle: 'italic' }}>Haydovchi topilmadi.</p> : (
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 35 }}>#</th>
              <th>Ism</th>
              <th style={{ width: 130 }}>Mashina raqami</th>
              <th style={{ width: 130 }}>Telefon</th>
              <th style={{ textAlign: 'center', width: 100 }}>Qatnovlar</th>
              <th style={{ textAlign: 'right', width: 140, color: '#c62828' }}>Qarzimiz</th>
              <th style={{ width: 160 }}>Amal</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => {
              const st = getStats(d.id);
              return (
                <tr key={d.id} style={{ background: st.balance > 0 ? '#fff8e1' : (i % 2 === 0 ? '#fff' : '#fafafa') }}>
                  <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{i + 1}</td>
                  {editId === d.id ? (
                    <>
                      <td><input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} style={{ ...inp, width: '100%' }} /></td>
                      <td><input value={editData.carNumber} onChange={e => setEditData({...editData, carNumber: e.target.value})} style={{ ...inp, width: '100%' }} /></td>
                      <td><input value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} style={{ ...inp, width: '100%' }} /></td>
                      <td colSpan={2}></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => saveEdit(d.id)} style={greenBtn}>✓ Saqlash</button>
                          <button onClick={() => setEditId(null)} style={redBtn}>✕</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <button onClick={() => setModalDriver(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ACCENT, fontWeight: 'bold', fontSize: 14, textDecoration: 'underline' }}>
                          🚚 {d.name}
                        </button>
                      </td>
                      <td style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold' }}>{d.carNumber || '—'}</td>
                      <td style={{ fontSize: 12 }}>{d.phone ? <a href={`tel:${d.phone}`} style={{ color: '#1565c0', textDecoration: 'none' }}>📞 {d.phone}</a> : '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{st.tripsCount} ta</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: st.balance > 0 ? '#c62828' : '#2e7d32', fontSize: 14, fontFamily: 'monospace' }}>
                        {st.balance > 0 ? fmt(st.balance) : '✓ Yo\'q'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => setModalDriver(d.id)} style={{ ...infoBtn, fontWeight: 'bold' }}>+ Qatnov / To'lov</button>
                          <button onClick={() => startEdit(d)} style={editBtn}>✎</button>
                          <button onClick={() => handleDelete(d.id, d.name)} style={redBtn}>✕</button>
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

      {/* ── MODAL ───────────────────────────────────────────────────────────── */}
      <DetailModal />
    </div>
  );
}

// ─── Yordamchi ──────────────────────────────────────────────────────────────
function StatBox({ label, value, unit, color, bg, bold }) {
  return (
    <div style={{ padding: '8px 16px', background: bg, borderLeft: `4px solid ${color}`, borderRadius: 4, minWidth: 160 }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: bold ? 18 : 16, fontWeight: 'bold', color, fontFamily: 'monospace' }}>
        {value} <span style={{ fontSize: 11 }}>{unit}</span>
      </div>
    </div>
  );
}

const thS = { border: '1px solid #ccc', padding: '6px 8px', fontWeight: 'bold', fontSize: 11, textAlign: 'left' };
const tdS = { border: '1px solid #eee', padding: '6px 8px', fontSize: 12 };
const infoBtn = { padding: '3px 8px', cursor: 'pointer', background: '#e0f7fa', border: '1px solid #00bcd4', borderRadius: 3, color: '#006064', fontSize: 12 };
const editBtn = { padding: '3px 8px', cursor: 'pointer', background: '#e3f2fd', border: '1px solid #1976d2', borderRadius: 3, color: '#1565c0', fontSize: 12 };
const greenBtn= { padding: '3px 8px', cursor: 'pointer', background: '#e8f5e9', border: '1px solid #4caf50', borderRadius: 3, color: '#2e7d32', fontSize: 12, fontWeight: 'bold' };
const redBtn  = { padding: '3px 8px', cursor: 'pointer', background: '#ffebee', border: '1px solid #e53935', borderRadius: 3, color: '#c62828', fontSize: 12 };
