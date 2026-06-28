import { useState, useEffect, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { api } from '../api';
import Paginator from '../components/Paginator';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (ts) => {
  if (!ts || ts < 1e10) return '—';
  const d = new Date(ts);
  return [String(d.getHours()).padStart(2,'0'), String(d.getMinutes()).padStart(2,'0')].join(':');
};

const ACCENT  = '#4e342e';
const LAVANDA = '#efebe9';
const thS = { border: '1px solid #ccc', padding: '6px 8px', fontWeight: 'bold', fontSize: 11, textAlign: 'left' };
const tdS = { border: '1px solid #eee', padding: '6px 8px', fontSize: 12 };
const infoBtn = { padding: '3px 8px', cursor: 'pointer', background: '#e0f7fa', border: '1px solid #00bcd4', borderRadius: 3, color: '#006064', fontSize: 12 };
const editBtn = { padding: '3px 8px', cursor: 'pointer', background: '#e3f2fd', border: '1px solid #1976d2', borderRadius: 3, color: '#1565c0', fontSize: 12 };
const greenBtn= { padding: '3px 8px', cursor: 'pointer', background: '#e8f5e9', border: '1px solid #4caf50', borderRadius: 3, color: '#2e7d32', fontSize: 12, fontWeight: 'bold' };
const redBtn  = { padding: '3px 8px', cursor: 'pointer', background: '#ffebee', border: '1px solid #e53935', borderRadius: 3, color: '#c62828', fontSize: 12 };
const inp = { padding: '4px 7px', fontSize: 13, border: '1px solid #ccc', borderRadius: 3, fontFamily: 'Tahoma, sans-serif' };

// Bot username (deep link uchun)
const BOT_USER = 'sementchiuzbot';

export default function Drivers({ lang }) {
  const {
    drivers, addDriver, updateDriver, deleteDriver,
    driverTrips, addDriverTrip, deleteDriverTrip,
    driverTariffs, appSettings,
  } = useData();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ name: '', carNumber: '', phone: '', tariffId: '' });
  const [editId, setEditId]     = useState(null);
  const [editData, setEditData] = useState({});
  const [modalDriver, setModalDriver] = useState(null);
  const [tripForm, setTripForm] = useState({ destination: '', price: '', note: '', isPayment: false, channel: 'naqd' });
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);

  // Pending reyslari (backenddan)
  const [pending, setPending]   = useState([]);
  const [photoUrls, setPhotoUrls] = useState({}); // tripId → url
  const [approving, setApproving] = useState({}); // tripId → bool

  const PAGE_SIZE = 100;

  const fetchPending = useCallback(async () => {
    try {
      const res = await api.getPendingDriverTrips();
      if (res.ok) setPending(res.trips || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchPending();
    const id = setInterval(fetchPending, 15000); // har 15 soniyada yangilash
    return () => clearInterval(id);
  }, [fetchPending]);

  // Rasimlarni yuklash
  useEffect(() => {
    pending.forEach(async (t) => {
      if (t.photoFileId && !photoUrls[t.id]) {
        try {
          const res = await api.getDriverPhotoUrl(t.photoFileId);
          if (res.ok && res.url) setPhotoUrls(p => ({ ...p, [t.id]: res.url }));
        } catch { /* ignore */ }
      }
    });
  }, [pending]);

  // ── Haydovchi CRUD ────────────────────────────────────────────────────────
  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.name) return;
    addDriver(form.name, form.carNumber, form.phone, form.tariffId ? Number(form.tariffId) : null);
    setForm({ name: '', carNumber: '', phone: '', tariffId: '' });
    setShowForm(false);
  };
  const startEdit = (d) => {
    setEditId(d.id);
    setEditData({ name: d.name, carNumber: d.carNumber || '', phone: d.phone || '', tariffId: d.tariffId || '' });
  };
  const saveEdit = (id) => { if (!editData.name) return; updateDriver(id, editData); setEditId(null); };
  const handleDelete = (id, name) => {
    if (window.confirm(`"${name}" va uning barcha qatnovlari o'chirib yuboriladi. Rozimisiz?`)) deleteDriver(id);
  };

  // ── Qatnov qo'shish ───────────────────────────────────────────────────────
  const handleAddTrip = (e) => {
    e.preventDefault();
    if (!tripForm.price) return;
    addDriverTrip(modalDriver, tripForm.destination, tripForm.price, tripForm.isPayment, tripForm.note, tripForm.channel);
    setTripForm({ destination: '', price: '', note: '', isPayment: false, channel: 'naqd' });
  };

  // ── Pending reys tasdiqlash/rad etish ─────────────────────────────────────
  const handleApprove = async (tripId) => {
    setApproving(p => ({ ...p, [tripId]: 'approving' }));
    try {
      await api.approveDriverTrip(tripId);
      setPending(p => p.filter(t => t.id !== tripId));
    } catch (e) { alert('Xato: ' + e.message); }
    setApproving(p => ({ ...p, [tripId]: null }));
  };
  const handleReject = async (tripId) => {
    const reason = window.prompt('Rad etish sababi (ixtiyoriy):') ?? null;
    if (reason === null) return; // cancel
    setApproving(p => ({ ...p, [tripId]: 'rejecting' }));
    try {
      await api.rejectDriverTrip(tripId, reason);
      setPending(p => p.filter(t => t.id !== tripId));
    } catch (e) { alert('Xato: ' + e.message); }
    setApproving(p => ({ ...p, [tripId]: null }));
  };

  // ── Statistika ────────────────────────────────────────────────────────────
  const getStats = (id) => {
    const trips = driverTrips.filter(t => t.driverId === id);
    const totalEarnings = trips.filter(t => !t.isPayment).reduce((s, t) => s + Number(t.price), 0);
    const totalPaid     = trips.filter(t => t.isPayment).reduce((s, t) => s + Number(t.price), 0);
    const balance       = totalEarnings - totalPaid;
    return { totalEarnings, totalPaid, balance, tripsCount: trips.filter(t => !t.isPayment).length };
  };
  const allStats     = drivers.map(d => getStats(d.id));
  const totalBalance = allStats.reduce((s, x) => s + Math.max(0, x.balance), 0);
  const totalQatnov  = allStats.reduce((s, x) => s + x.tripsCount, 0);

  const filtered = drivers.filter(d =>
    !search ||
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.carNumber || '').toLowerCase().includes(search.toLowerCase())
  );
  useEffect(() => { setPage(1); }, [search]);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Deep link ─────────────────────────────────────────────────────────────
  const driverLink = (d) => `https://t.me/${BOT_USER}?start=driver_${d.id}`;

  // ── CHANNEL tugmalari ─────────────────────────────────────────────────────
  const CH_OPTS = [
    { v: 'naqd',  label: '💵 Naqd' },
    { v: 'bank',  label: '🏦 Bank' },
    { v: 'click', label: '📱 Click' },
  ];

  // ── Detail Modal ──────────────────────────────────────────────────────────
  const DetailModal = () => {
    if (!modalDriver) return null;
    const d = drivers.find(x => x.id === modalDriver);
    if (!d) return null;
    const st = getStats(d.id);
    const trips = driverTrips.filter(t => t.driverId === d.id).sort((a, b) => b.createdAt - a.createdAt);
    const link  = driverLink(d);

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        background: 'rgba(0,0,0,0.6)', zIndex: 2000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 30, overflowY: 'auto'
      }} onClick={e => { if (e.target === e.currentTarget) setModalDriver(null); }}>
        <div style={{ background: '#fff', width: 640, borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', marginBottom: 30 }}>

          {/* Header */}
          <div style={{ background: ACCENT, color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 16 }}>🚚 {d.name}</div>
              <div style={{ fontSize: 12, color: '#d7ccc8', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {d.carNumber && <span>🔢 {d.carNumber}</span>}
                {d.phone && <span>📞 {d.phone}</span>}
                {d.tariffId && (() => {
                  const t = (driverTariffs || []).find(t => t.id === d.tariffId);
                  return t ? <span style={{ background: '#1565c0', color: '#fff', padding: '1px 7px', borderRadius: 8, fontSize: 10, fontWeight: 'bold' }}>{t.name}</span> : null;
                })()}
                {d.telegramChatId
                  ? <span style={{ color: '#a5d6a7' }}>✅ Telegram ulangan</span>
                  : <span style={{ color: '#ef9a9a' }}>⚠️ Telegram ulanmagan</span>}
              </div>
            </div>
            <button onClick={() => setModalDriver(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>✕</button>
          </div>

          {/* Telegram link */}
          {!d.telegramChatId && (
            <div style={{ padding: '10px 20px', background: '#e3f2fd', borderBottom: '1px solid #bbdefb', fontSize: 12 }}>
              📱 <b>Haydovchi botni ulashi uchun quyidagi havolani yuboring:</b>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                <a href={link} target="_blank" rel="noreferrer"
                  style={{ color: '#1565c0', wordBreak: 'break-all', flex: 1 }}>{link}</a>
                <button onClick={() => { navigator.clipboard.writeText(link); }}
                  style={{ padding: '3px 10px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}>
                  📋 Nusxa
                </button>
              </div>
            </div>
          )}

          {/* Statistika */}
          <div style={{ display: 'flex', background: LAVANDA, borderBottom: '1px solid #d7ccc8' }}>
            <div style={{ flex: 1, padding: '12px', textAlign: 'center', borderRight: '1px solid #d7ccc8' }}>
              <div style={{ fontSize: 11, color: '#666' }}>Ishladi ({st.tripsCount} marta)</div>
              <div style={{ fontWeight: 'bold', fontSize: 15 }}>{fmt(st.totalEarnings)}</div>
            </div>
            <div style={{ flex: 1, padding: '12px', textAlign: 'center', borderRight: '1px solid #d7ccc8' }}>
              <div style={{ fontSize: 11, color: '#2e7d32' }}>To'landi (avans)</div>
              <div style={{ fontWeight: 'bold', fontSize: 15, color: '#2e7d32' }}>{fmt(st.totalPaid)}</div>
            </div>
            <div style={{ flex: 1, padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: st.balance > 0 ? '#c62828' : '#2e7d32' }}>
                {st.balance > 0 ? 'Qarzimiz' : 'Oshiqcha avans'}
              </div>
              <div style={{ fontWeight: 'bold', fontSize: 15, color: st.balance > 0 ? '#c62828' : st.balance < 0 ? '#e65100' : '#2e7d32' }}>
                {st.balance === 0 ? '✓ Yo\'q' : fmt(Math.abs(st.balance))}
              </div>
            </div>
          </div>

          {/* ── Pending reyslari (tasdiqlash kutilmoqda) ── */}
          {(() => {
            const myPending = pending.filter(t => t.driverId === d.id);
            if (!myPending.length) return null;
            return (
              <div style={{ margin: '0 0 0 0', background: '#fff8e1', borderBottom: '2px solid #fbc02d', padding: '12px 20px' }}>
                <div style={{ fontWeight: 'bold', color: '#e65100', marginBottom: 10, fontSize: 13 }}>
                  ⏳ Tasdiqlash kutilayotgan reyslari ({myPending.length} ta)
                </div>
                {myPending.map(t => {
                  const loading = approving[t.id];
                  return (
                    <div key={t.id} style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#fff', border: '1px solid #ffe082', borderRadius: 6, padding: '10px 12px', marginBottom: 8, flexWrap: 'wrap' }}>
                      {/* Rasm */}
                      {photoUrls[t.id] ? (
                        <a href={photoUrls[t.id]} target="_blank" rel="noreferrer">
                          <img src={photoUrls[t.id]} alt="yuk xati" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd', flexShrink: 0 }} />
                        </a>
                      ) : t.photoFileId ? (
                        <div style={{ width: 72, height: 72, background: '#eee', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#888' }}>📷</div>
                      ) : null}
                      {/* Ma'lumotlar */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#555' }}>📅 {t.date}</div>
                        <div style={{ fontWeight: 'bold', marginTop: 2 }}>📍 {t.destination}</div>
                        <div style={{ color: '#2e7d32', fontWeight: 'bold', fontFamily: 'monospace', fontSize: 14 }}>💰 {fmt(t.price)} so'm</div>
                      </div>
                      {/* Tugmalar */}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => handleApprove(t.id)} disabled={!!loading}
                          style={{ padding: '6px 14px', background: loading ? '#ccc' : '#2e7d32', color: '#fff', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: 13 }}>
                          {loading === 'approving' ? '...' : '✅ Tasdiqlash'}
                        </button>
                        <button onClick={() => handleReject(t.id)} disabled={!!loading}
                          style={{ padding: '6px 12px', background: loading ? '#ccc' : '#c62828', color: '#fff', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: 13 }}>
                          {loading === 'rejecting' ? '...' : '✕ Rad'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Forma */}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <button type="button" onClick={() => setTripForm({ ...tripForm, isPayment: false })}
                style={{ flex: 1, padding: 8, cursor: 'pointer', border: tripForm.isPayment ? '1px solid #ccc' : `2px solid ${ACCENT}`, background: tripForm.isPayment ? '#fff' : ACCENT, color: tripForm.isPayment ? '#555' : '#fff', fontWeight: 'bold', borderRadius: 4 }}>
                🚛 Yangi qatnov (ish)
              </button>
              <button type="button" onClick={() => setTripForm({ ...tripForm, isPayment: true, destination: 'Avans' })}
                style={{ flex: 1, padding: 8, cursor: 'pointer', border: !tripForm.isPayment ? '1px solid #ccc' : `2px solid #2e7d32`, background: !tripForm.isPayment ? '#fff' : '#2e7d32', color: !tripForm.isPayment ? '#555' : '#fff', fontWeight: 'bold', borderRadius: 4 }}>
                💸 Avans berish
              </button>
            </div>

            <form onSubmit={handleAddTrip} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
              {!tripForm.isPayment && (
                <div>
                  <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>Yo'nalish *</div>
                  <input placeholder="Qayerga (masalan: Oqqo'rg'on)" value={tripForm.destination}
                    onChange={e => setTripForm({ ...tripForm, destination: e.target.value })}
                    style={{ ...inp, width: 160 }} required />
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>{tripForm.isPayment ? 'Avans summasi *' : 'Yo\'l haqi *'}</div>
                <input type="number" placeholder="Summa" value={tripForm.price}
                  onChange={e => setTripForm({ ...tripForm, price: e.target.value })}
                  style={{ ...inp, width: 120 }} required autoFocus />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>Izoh</div>
                <input placeholder="Ixtiyoriy" value={tripForm.note}
                  onChange={e => setTripForm({ ...tripForm, note: e.target.value })}
                  style={{ ...inp, width: 120 }} />
              </div>
              {tripForm.isPayment && (
                <div>
                  <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>Kanal</div>
                  <select value={tripForm.channel} onChange={e => setTripForm({ ...tripForm, channel: e.target.value })} style={{ ...inp }}>
                    {CH_OPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                  </select>
                </div>
              )}
              <button type="submit" style={{ padding: '5px 16px', background: tripForm.isPayment ? '#2e7d32' : ACCENT, color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 'bold', height: 29 }}>✓ Saqlash</button>
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
                        {t.isPayment ? '💸 Avans berildi' : `🚛 ${t.destination}`}
                        {t.fromBot && <span style={{ fontSize: 10, background: '#e3f2fd', color: '#1565c0', padding: '1px 5px', borderRadius: 8, marginLeft: 4 }}>BOT</span>}
                      </td>
                      <td style={tdS}>{t.note || '—'}</td>
                      <td style={{ ...tdS, textAlign: 'right', fontWeight: 'bold', color: t.isPayment ? '#2e7d32' : '#333' }}>
                        {t.isPayment ? '-' : '+'}{fmt(t.price)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={() => { if (window.confirm("O'chirasizmi?")) deleteDriverTrip(t.id); }}
                          style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#c62828' }}>✕</button>
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

      {/* Pending reyslari endi modal ichida ko'rinadi */}

      {/* ── STATISTIKA PANELI ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <StatBox label="Jami haydovchilar" value={drivers.length} unit="ta" color={ACCENT} bg={LAVANDA} />
        <StatBox label="Jami qatnovlar"    value={totalQatnov}    unit="ta" color="#1565c0" bg="#e3f2fd" />
        <StatBox label="Haydovchilardan qarzimiz" value={fmt(totalBalance)} unit="so'm" color="#c62828" bg="#ffebee" bold />
        {pending.length > 0 && <StatBox label="Kutilayotgan reyslari" value={pending.length} unit="ta" color="#e65100" bg="#fff8e1" bold />}
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
            <input placeholder="01 A 123 AA" value={form.carNumber} onChange={e => setForm({ ...form, carNumber: e.target.value })} style={{ ...inp, width: 130 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 3 }}>Telefon</label>
            <input placeholder="+998..." value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={{ ...inp, width: 130 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 3 }}>Tarif</label>
            <select value={form.tariffId} onChange={e => setForm({ ...form, tariffId: e.target.value })} style={{ ...inp }}>
              <option value="">— Tarif tanlang —</option>
              {(driverTariffs || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <button type="submit" style={{ padding: '6px 20px', cursor: 'pointer', background: ACCENT, color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', height: 29 }}>
            ✓ Qo'shish
          </button>
        </form>
      )}

      {/* ── HAYDOVCHILAR JADVALI ──────────────────────────────────────────── */}
      {filtered.length === 0 ? <p style={{ color: '#888', fontStyle: 'italic' }}>Haydovchi topilmadi.</p> : (
        <>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 35 }}>#</th>
              <th>Ism</th>
              <th style={{ width: 130 }}>Mashina raqami</th>
              <th style={{ width: 90 }}>Tarif</th>
              <th style={{ width: 60, textAlign: 'center' }}>TG</th>
              <th style={{ textAlign: 'center', width: 80 }}>Qatnovlar</th>
              <th style={{ textAlign: 'right', width: 140, color: '#c62828' }}>Qarzimiz</th>
              <th style={{ width: 180 }}>Amal</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((d, i) => {
              const st = getStats(d.id);
              const pendCount = pending.filter(t => t.driverId === d.id).length;
              return (
                <tr key={d.id} style={{ background: pendCount > 0 ? '#fff8e1' : (st.balance > 0 ? '#fff3e0' : (i % 2 === 0 ? '#fff' : '#fafafa')) }}>
                  <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{i + 1}</td>
                  {editId === d.id ? (
                    <>
                      <td><input value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} style={{ ...inp, width: '100%' }} /></td>
                      <td><input value={editData.carNumber} onChange={e => setEditData({ ...editData, carNumber: e.target.value })} style={{ ...inp, width: '100%' }} /></td>
                      <td>
                        <select value={editData.tariffId || ''} onChange={e => setEditData({ ...editData, tariffId: e.target.value ? Number(e.target.value) : null })} style={{ ...inp, width: '100%' }}>
                          <option value="">— Tarif —</option>
                          {(driverTariffs || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </td>
                      <td></td><td colSpan={2}></td>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button onClick={() => setModalDriver(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ACCENT, fontWeight: 'bold', fontSize: 14, textDecoration: 'underline' }}>
                            🚚 {d.name}
                          </button>
                          {pendCount > 0 && <span style={{ fontSize: 10, background: '#fbc02d', color: '#333', padding: '1px 6px', borderRadius: 8, fontWeight: 'bold' }}>⏳{pendCount}</span>}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold' }}>{d.carNumber || '—'}</td>
                      <td style={{ fontSize: 11 }}>
                        {(() => {
                          const t = (driverTariffs || []).find(t => t.id === d.tariffId);
                          return t
                            ? <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '2px 7px', borderRadius: 8, fontWeight: 'bold' }}>{t.name}</span>
                            : <span style={{ color: '#bbb' }}>—</span>;
                        })()}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {d.telegramChatId
                          ? <span title="Telegram ulangan" style={{ color: '#2e7d32', fontSize: 16 }}>✅</span>
                          : <a href={driverLink(d)} target="_blank" rel="noreferrer" title="Havolani ulash" style={{ color: '#1565c0', fontSize: 13 }}>🔗</a>}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{st.tripsCount} ta</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: st.balance > 0 ? '#c62828' : '#2e7d32', fontSize: 14, fontFamily: 'monospace' }}>
                        {st.balance > 0 ? fmt(st.balance) : '✓ Yo\'q'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => setModalDriver(d.id)} style={{ ...infoBtn, fontWeight: 'bold' }}>+ Qatnov</button>
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
        <Paginator total={filtered.length} page={page} setPage={setPage} pageSize={PAGE_SIZE} />
        </>
      )}

      {/* ── MODAL ───────────────────────────────────────────────────────────── */}
      <DetailModal />
    </div>
  );
}

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
