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
    cashRows, bankRows, clickRows,
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
    const drv   = drivers.find(d => d.id === id);
    const trips = driverTrips.filter(t => t.driverId === id);
    const totalEarnings = trips.filter(t => !t.isPayment).reduce((s, t) => s + Number(t.price), 0);
    const tripPaid      = trips.filter(t => t.isPayment).reduce((s, t) => s + Number(t.price), 0);
    // Kassirdan qo'lda kiritilgan to'lovlar (auto emas — driverTrips orqali yaratilgan avtomatiklar ikki marta sanalmaydi)
    const kassiPaid = drv ? [...(cashRows || []), ...(bankRows || []), ...(clickRows || [])]
      .filter(r => !r.auto && r.customer === drv.name && Number(r.amount) < 0)
      .reduce((s, r) => s + Math.abs(Number(r.amount)), 0) : 0;
    const totalPaid = tripPaid + kassiPaid;
    const balance   = totalEarnings - totalPaid;
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

  // ── Lightbox holati ───────────────────────────────────────────────────────
  const [lightbox, setLightbox] = useState(null); // url

  // ── To'liq ekran haydovchi sahifasi ───────────────────────────────────────
  const DetailPage = () => {
    if (!modalDriver) return null;
    const d = drivers.find(x => x.id === modalDriver);
    if (!d) return null;
    const st    = getStats(d.id);
    const trips = driverTrips.filter(t => t.driverId === d.id).sort((a, b) => b.createdAt - a.createdAt);
    const link  = driverLink(d);
    const myPending = pending.filter(t => t.driverId === d.id);
    const tariff = (driverTariffs || []).find(t => t.id === d.tariffId);

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#f5f5f5', display: 'flex', flexDirection: 'column', fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>

        {/* ── TOP HEADER ────────────────────────────────────────────────────── */}
        <div style={{ background: ACCENT, color: '#fff', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 17 }}>🚚 {d.name}</div>
              <div style={{ fontSize: 12, color: '#d7ccc8', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {d.carNumber && <span>🔢 {d.carNumber}</span>}
                {d.phone     && <span>📞 {d.phone}</span>}
                {tariff      && <span style={{ background: '#1565c0', padding: '1px 8px', borderRadius: 8, fontSize: 10, fontWeight: 'bold' }}>{tariff.name}</span>}
                {d.telegramChatId
                  ? <span style={{ color: '#a5d6a7' }}>✅ Telegram ulangan</span>
                  : <span style={{ color: '#ef9a9a' }}>⚠ Ulanmagan</span>}
              </div>
            </div>
          </div>
          <button onClick={() => setModalDriver(null)}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', fontSize: 16, cursor: 'pointer', borderRadius: 4, padding: '5px 14px', fontWeight: 'bold' }}>
            ✕ Yopish
          </button>
        </div>

        {/* ── SCROLLABLE KONTENT ────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

          {/* Telegram ssilka (ulanmagan bo'lsa) */}
          {!d.telegramChatId && (
            <div style={{ marginBottom: 14, padding: '10px 16px', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 6, fontSize: 12 }}>
              📱 <b>Haydovchi botga ulashishi uchun ssilkani yuboring:</b>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                <span style={{ color: '#1565c0', wordBreak: 'break-all', flex: 1 }}>{link}</span>
                <button onClick={() => { navigator.clipboard.writeText(link); }}
                  style={{ padding: '3px 10px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}>
                  📋 Nusxa
                </button>
              </div>
            </div>
          )}

          {/* ── STATISTIKA ─────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { lbl: `Ishladi (${st.tripsCount} marta)`, val: fmt(st.totalEarnings),          color: '#333',   bg: '#fff' },
              { lbl: "To'landi (avans)",                  val: fmt(st.totalPaid),               color: '#2e7d32',bg: '#e8f5e9' },
              { lbl: st.balance > 0 ? 'Qarzimiz' : 'Hisob-kitob',
                val: st.balance === 0 ? '✓ Yo\'q' : fmt(Math.abs(st.balance)),
                color: st.balance > 0 ? '#c62828' : '#2e7d32',
                bg: st.balance > 0 ? '#ffebee' : '#e8f5e9' },
            ].map((s, i) => (
              <div key={i} style={{ padding: '10px 20px', background: s.bg, borderLeft: `4px solid ${s.color}`, borderRadius: 4, minWidth: 150 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{s.lbl}</div>
                <div style={{ fontSize: 16, fontWeight: 'bold', color: s.color, fontFamily: 'monospace' }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* ── PENDING REYSLARI ───────────────────────────────────────────── */}
          {myPending.length > 0 && (
            <div style={{ marginBottom: 16, background: '#fff8e1', border: '2px solid #fbc02d', borderRadius: 6, padding: '12px 16px' }}>
              <div style={{ fontWeight: 'bold', color: '#e65100', marginBottom: 10, fontSize: 13 }}>
                ⏳ Tasdiqlash kutilayotgan reyslari ({myPending.length} ta)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {myPending.map(t => {
                  const loading = approving[t.id];
                  return (
                    <div key={t.id} style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#fff', border: '1px solid #ffe082', borderRadius: 6, padding: '10px 14px', flexWrap: 'wrap' }}>
                      {/* Rasm — bosganda lightbox */}
                      {photoUrls[t.id] ? (
                        <img src={photoUrls[t.id]} alt="yuk xati"
                          onClick={() => setLightbox(photoUrls[t.id])}
                          style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4, border: '2px solid #ddd', flexShrink: 0, cursor: 'zoom-in' }} />
                      ) : t.photoFileId ? (
                        <div style={{ width: 80, height: 80, background: '#eee', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#888', flexShrink: 0 }}>📷</div>
                      ) : null}
                      {/* Ma'lumotlar */}
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: 12, color: '#777' }}>📅 {t.date}</div>
                        <div style={{ fontWeight: 'bold', fontSize: 14, marginTop: 2 }}>📍 {t.destination}</div>
                        <div style={{ color: '#2e7d32', fontWeight: 'bold', fontFamily: 'monospace', fontSize: 15, marginTop: 2 }}>💰 {fmt(t.price)} so'm</div>
                      </div>
                      {/* Tugmalar */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleApprove(t.id)} disabled={!!loading}
                          style={{ padding: '7px 18px', background: loading ? '#ccc' : '#2e7d32', color: '#fff', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: 13 }}>
                          {loading === 'approving' ? '...' : '✅ Tasdiqlash'}
                        </button>
                        <button onClick={() => handleReject(t.id)} disabled={!!loading}
                          style={{ padding: '7px 14px', background: loading ? '#ccc' : '#c62828', color: '#fff', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: 13 }}>
                          {loading === 'rejecting' ? '...' : '✕ Rad'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── QATNOV QO'SHISH FORMASI ────────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <button type="button" onClick={() => setTripForm({ ...tripForm, isPayment: false })}
                style={{ flex: 1, padding: 9, cursor: 'pointer', border: tripForm.isPayment ? '1px solid #ccc' : `2px solid ${ACCENT}`, background: tripForm.isPayment ? '#fafafa' : ACCENT, color: tripForm.isPayment ? '#555' : '#fff', fontWeight: 'bold', borderRadius: 4, fontSize: 13 }}>
                🚛 Yangi qatnov (ish)
              </button>
              <button type="button" onClick={() => setTripForm({ ...tripForm, isPayment: true, destination: 'Avans' })}
                style={{ flex: 1, padding: 9, cursor: 'pointer', border: !tripForm.isPayment ? '1px solid #ccc' : `2px solid #2e7d32`, background: !tripForm.isPayment ? '#fafafa' : '#2e7d32', color: !tripForm.isPayment ? '#555' : '#fff', fontWeight: 'bold', borderRadius: 4, fontSize: 13 }}>
                💸 Avans berish
              </button>
            </div>
            <form onSubmit={handleAddTrip} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {!tripForm.isPayment && (
                <div>
                  <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>Yo'nalish *</div>
                  <input placeholder="Qayerga (masalan: Oqqo'rg'on)" value={tripForm.destination}
                    onChange={e => setTripForm({ ...tripForm, destination: e.target.value })}
                    style={{ ...inp, width: 200 }} required />
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>{tripForm.isPayment ? 'Avans summasi *' : "Yo'l haqi *"}</div>
                <input type="number" placeholder="Summa" value={tripForm.price}
                  onChange={e => setTripForm({ ...tripForm, price: e.target.value })}
                  style={{ ...inp, width: 130 }} required />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>Izoh</div>
                <input placeholder="Ixtiyoriy" value={tripForm.note}
                  onChange={e => setTripForm({ ...tripForm, note: e.target.value })}
                  style={{ ...inp, width: 140 }} />
              </div>
              {tripForm.isPayment && (
                <div>
                  <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>Kanal</div>
                  <select value={tripForm.channel} onChange={e => setTripForm({ ...tripForm, channel: e.target.value })} style={inp}>
                    {CH_OPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                  </select>
                </div>
              )}
              <button type="submit" style={{ padding: '6px 20px', background: tripForm.isPayment ? '#2e7d32' : ACCENT, color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 'bold' }}>
                ✓ Saqlash
              </button>
            </form>
          </div>

          {/* ── TARIX JADVALI ──────────────────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '14px 16px' }}>
            <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 10, color: ACCENT }}>
              Qatnov tarixi ({trips.length} ta)
            </div>
            {trips.length === 0 ? (
              <p style={{ color: '#aaa', fontStyle: 'italic', fontSize: 12 }}>Tarix bo'sh.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: ACCENT, color: '#fff' }}>
                    <th style={{ ...thS, color: '#fff', border: '1px solid #6d4c41' }}>#</th>
                    <th style={{ ...thS, color: '#fff', border: '1px solid #6d4c41' }}>Sana</th>
                    <th style={{ ...thS, color: '#fff', border: '1px solid #6d4c41' }}>Yo'nalish / Amaliyot</th>
                    <th style={{ ...thS, color: '#fff', border: '1px solid #6d4c41' }}>Izoh</th>
                    <th style={{ ...thS, textAlign: 'right', color: '#fff', border: '1px solid #6d4c41' }}>Summa</th>
                    <th style={{ width: 50, border: '1px solid #6d4c41' }}>Rasm</th>
                    <th style={{ width: 36, border: '1px solid #6d4c41' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((t, i) => {
                    const url = photoUrls[t.id];
                    return (
                      <tr key={t.id} style={{ background: t.isPayment ? '#e8f5e9' : (i % 2 === 0 ? '#fff' : '#fafafa'), borderBottom: '1px solid #eee' }}>
                        <td style={{ ...tdS, textAlign: 'center', color: '#999', fontSize: 11 }}>{i + 1}</td>
                        <td style={tdS}>{t.date} <span style={{ color: '#aaa', fontSize: 10 }}>{fmtT(t.createdAt)}</span></td>
                        <td style={{ ...tdS, fontWeight: t.isPayment ? 'normal' : 'bold' }}>
                          {t.isPayment ? '💸 Avans berildi' : `🚛 ${t.destination}`}
                          {t.fromBot && <span style={{ fontSize: 10, background: '#e3f2fd', color: '#1565c0', padding: '1px 5px', borderRadius: 8, marginLeft: 4 }}>BOT</span>}
                        </td>
                        <td style={{ ...tdS, color: '#666' }}>{t.note || '—'}</td>
                        <td style={{ ...tdS, textAlign: 'right', fontWeight: 'bold', color: t.isPayment ? '#2e7d32' : '#333', fontFamily: 'monospace' }}>
                          {t.isPayment ? '−' : '+'}{fmt(t.price)}
                        </td>
                        <td style={{ textAlign: 'center', padding: 4 }}>
                          {url ? (
                            <img src={url} alt="rasm" onClick={() => setLightbox(url)}
                              style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 3, cursor: 'zoom-in', border: '1px solid #ddd' }} />
                          ) : t.photoFileId ? (
                            <span style={{ fontSize: 18 }}>📷</span>
                          ) : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button onClick={() => { if (window.confirm("O'chirasizmi?")) deleteDriverTrip(t.id); }}
                            style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#c62828', fontSize: 16 }}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
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

      {/* ── TO'LIQ EKRAN SAHIFA ─────────────────────────────────────────────── */}
      <DetailPage />

      {/* ── LIGHTBOX ────────────────────────────────────────────────────────── */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setLightbox(null)}
            style={{ position: 'absolute', top: 16, right: 20, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', fontSize: 22, cursor: 'pointer', borderRadius: 4, padding: '4px 14px', fontWeight: 'bold', zIndex: 1 }}>
            ✕ Yopish
          </button>
          <img src={lightbox} alt="rasm" onClick={e => e.stopPropagation()}
            style={{ maxWidth: '95vw', maxHeight: '92vh', borderRadius: 6, boxShadow: '0 8px 40px rgba(0,0,0,0.8)', objectFit: 'contain' }} />
        </div>
      )}
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
