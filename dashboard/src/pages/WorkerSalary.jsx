import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import ExcelExport from '../components/ExcelExport';
import Paginator from '../components/Paginator';
import api from '../api';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (ts) => {
  if (!ts || ts < 1e10) return '—';
  const d = new Date(ts);
  return [String(d.getHours()).padStart(2,'0'), String(d.getMinutes()).padStart(2,'0')].join(':');
};

const ACC_W  = '#1a237e'; // workers accent
const BG_W   = '#e8eaf6';
const ACC_D  = '#4e342e'; // drivers accent
const BG_D   = '#efebe9';

export default function WorkerSalary({ lang }) {
  const [activeTab, setActiveTab] = useState('workers'); // 'workers' | 'drivers'

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>
      {/* ── TAB TUGMALARI ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: '2px solid #ccc', marginBottom: 16 }}>
        <button
          onClick={() => setActiveTab('workers')}
          style={{
            padding: '10px 24px', cursor: 'pointer', border: 'none', background: 'transparent',
            borderBottom: activeTab === 'workers' ? `3px solid ${ACC_W}` : '3px solid transparent',
            color: activeTab === 'workers' ? ACC_W : '#666',
            fontWeight: activeTab === 'workers' ? 'bold' : 'normal',
            fontSize: 14, marginBottom: -2, transition: 'all 0.2s',
          }}>
          👷 Ishchilar oyligi
        </button>
        <button
          onClick={() => setActiveTab('drivers')}
          style={{
            padding: '10px 24px', cursor: 'pointer', border: 'none', background: 'transparent',
            borderBottom: activeTab === 'drivers' ? `3px solid ${ACC_D}` : '3px solid transparent',
            color: activeTab === 'drivers' ? ACC_D : '#666',
            fontWeight: activeTab === 'drivers' ? 'bold' : 'normal',
            fontSize: 14, marginBottom: -2, transition: 'all 0.2s',
          }}>
          🚚 Haydovchilar (qatnov)
        </button>
      </div>

      {activeTab === 'workers' ? <WorkersTab lang={lang} /> : <DriversTab lang={lang} />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. ISHCHILAR TABI
// ═════════════════════════════════════════════════════════════════════════════
function WorkersTab() {
  const { workers, addWorker, updateWorker, payWorker, deleteWorker, salaryPayments } = useData();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ name: '', salary: '', position: '', phone: '', note: '' });
  const [payForm, setPayForm]   = useState({ id: null, amount: '', note: '', channel: 'naqd' });
  const [editId, setEditId]     = useState(null);
  const [editData, setEditData] = useState({});
  const [modalWorker, setModalWorker] = useState(null);
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.name || !form.salary) return;
    addWorker(form.name, form.salary, { position: form.position, phone: form.phone, note: form.note });
    setForm({ name: '', salary: '', position: '', phone: '', note: '' });
    setShowForm(false);
  };

  const handlePay = (id) => {
    if (payForm.id === id && payForm.amount) {
      payWorker(id, payForm.amount, payForm.note, payForm.channel);
      setPayForm({ id: null, amount: '', note: '', channel: 'naqd' });
    } else {
      setPayForm({ id, amount: '', note: '', channel: 'naqd' });
    }
  };

  const saveEdit = (id) => {
    if (!editData.name || !editData.salary) return;
    updateWorker(id, { name: editData.name, salary: Number(editData.salary), position: editData.position, phone: editData.phone, note: editData.note });
    setEditId(null);
  };

  const totalSalary = workers.reduce((s, w) => s + Number(w.salary || 0), 0);
  const totalPaid   = workers.reduce((s, w) => s + Number(w.paid || 0), 0);
  const totalQoldi  = workers.reduce((s, w) => s + Math.max(0, Number(w.salary) - Number(w.paid)), 0);
  const todayPaid   = salaryPayments.filter(p => p.date === new Date().toLocaleDateString('ru-RU')).reduce((s, p) => s + Number(p.amount || 0), 0);

  let filtered = workers.filter(w => !search || w.name.toLowerCase().includes(search.toLowerCase()) || (w.position||'').toLowerCase().includes(search.toLowerCase()) || (w.phone||'').includes(search));
  if (filterStatus === 'toliq') filtered = filtered.filter(w => Number(w.salary) <= Number(w.paid));
  if (filterStatus === 'qoldi') filtered = filtered.filter(w => Number(w.salary) > Number(w.paid));
  useEffect(() => { setPage(1); }, [search, filterStatus]);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const inp = { padding: '4px 7px', fontSize: 12, border: '1px solid #ccc', borderRadius: 3, fontFamily: 'Tahoma, sans-serif' };

  return (
    <div>
      {/* Statistika */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <StatBox label="Xodimlar soni"  value={workers.length}      unit="ta"    color={ACC_W}     bg={BG_W} />
        <StatBox label="Jami oylik"     value={fmt(totalSalary)}    unit="so'm"  color="#333"      bg="#f5f5f5" />
        <StatBox label="Jami to'landi"  value={fmt(totalPaid)}      unit="so'm"  color="#2e7d32"   bg="#e8f5e9" />
        <StatBox label="Qolgan oylik"   value={fmt(totalQoldi)}     unit="so'm"  color="#c62828"   bg="#ffebee" bold />
        <StatBox label="Bugun to'landi" value={fmt(todayPaid)}      unit="so'm"  color="#e65100"   bg="#fff3e0" />
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="🔍 Ism, lavozim, telefon..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, width: 210, border: '1px solid #9fa8da' }} />
        {[['', 'Hammasi'], ['qoldi', '🔴 Qolgan'], ['toliq', '✓ To\'liq']].map(([v, label]) => (
          <button key={v} onClick={() => setFilterStatus(v)} style={{
            padding: '4px 12px', cursor: 'pointer', fontSize: 12, border: `1px solid ${filterStatus === v ? ACC_W : '#ccc'}`,
            background: filterStatus === v ? ACC_W : '#fff', color: filterStatus === v ? '#fff' : '#333', borderRadius: 3,
          }}>{label}</button>
        ))}
        <ExcelExport
          filename="Ishchilar_oyligi"
          sheetName="Ishchilar"
          title="Ishchilar oyligi hisoboti"
          columns={[
            { header: 'Ism', value: w => w.name },
            { header: 'Lavozim', value: w => w.position || '' },
            { header: 'Telefon', value: w => w.phone || '' },
            { header: 'Oylik', value: w => Number(w.salary || 0) },
            { header: "To'landi", value: w => Number(w.paid || 0) },
            { header: 'Qolgan', value: w => Math.max(0, Number(w.salary || 0) - Number(w.paid || 0)) },
            { header: 'Izoh', value: w => w.note || '' },
          ]}
          rows={filtered}
        />
        <button onClick={() => setShowForm(v => !v)} style={{
          padding: '5px 16px', cursor: 'pointer', background: showForm ? '#c62828' : ACC_W, color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', marginLeft: 'auto',
        }}>{showForm ? '✕ Yopish' : '+ Yangi xodim'}</button>
      </div>

      {/* Forma */}
      {showForm && (
        <form onSubmit={handleAdd} style={{ marginBottom: 14, padding: '12px 14px', background: BG_W, border: `1px solid #9fa8da`, borderRadius: 6, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {[{ key: 'name', label: 'Ism *', req: true }, { key: 'salary', label: "Oylik *", req: true, num: true }, { key: 'position', label: 'Lavozim', req: false }, { key: 'phone', label: 'Telefon', req: false }, { key: 'note', label: 'Izoh', req: false }].map(({ key, label, req, num }) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 3 }}>{label}</label>
              <input type={num ? 'number' : 'text'} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} required={req} autoFocus={key === 'name'} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button type="submit" style={{ padding: '6px 20px', cursor: 'pointer', background: ACC_W, color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold' }}>✓ Qo'shish</button>
          </div>
        </form>
      )}

      {/* Jadval */}
      {filtered.length === 0 ? <p style={{ color: '#888', fontStyle: 'italic' }}>Xodim topilmadi.</p> : (
        <>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 32 }}>#</th><th style={{ minWidth: 140 }}>Ism</th><th style={{ width: 120 }}>Lavozim</th><th style={{ width: 125 }}>Telefon</th>
              <th style={{ textAlign: 'right', width: 120 }}>Oylik</th><th style={{ textAlign: 'right', width: 120, color: '#2e7d32' }}>To'landi</th>
              <th style={{ textAlign: 'right', width: 115, color: '#c62828' }}>Qolgan</th><th style={{ width: 185 }}>Amal</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((w, i) => {
              const remaining = Math.max(0, Number(w.salary) - Number(w.paid || 0));
              const isPaid = remaining <= 0;
              return (
                <tr key={w.id} style={{ background: isPaid ? '#f1f8e9' : (i % 2 === 0 ? '#fff' : '#fafafa') }}>
                  <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{i + 1}</td>
                  {editId === w.id ? (
                    <>
                      <td><input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} style={{ ...inp, width: '100%' }} /></td>
                      <td><input value={editData.position} onChange={e => setEditData({...editData, position: e.target.value})} style={{ ...inp, width: '100%' }} /></td>
                      <td><input value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} style={{ ...inp, width: '100%' }} /></td>
                      <td><input type="number" value={editData.salary} onChange={e => setEditData({...editData, salary: e.target.value})} style={{ ...inp, width: '100%' }} /></td>
                      <td colSpan={2}><input value={editData.note} onChange={e => setEditData({...editData, note: e.target.value})} style={{ ...inp, width: '100%' }} placeholder="Izoh" /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => saveEdit(w.id)} style={greenBtn}>✓</button>
                          <button onClick={() => setEditId(null)} style={redBtn}>✕</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td><button onClick={() => setModalWorker(w.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ACC_W, fontWeight: 'bold', fontSize: 13, textDecoration: 'underline' }}>👷 {w.name}</button>{isPaid && <span style={{ marginLeft: 6, fontSize: 10, color: '#2e7d32', fontWeight: 'bold' }}>✓</span>}</td>
                      <td style={{ fontSize: 12 }}>{w.position || '—'}</td>
                      <td style={{ fontSize: 12 }}>{w.phone ? <a href={`tel:${w.phone}`} style={{ color: '#1565c0', textDecoration: 'none' }}>📞 {w.phone}</a> : '—'}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{fmt(w.salary)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#2e7d32', fontWeight: 'bold' }}>{fmt(w.paid || 0)}</td>
                      <td style={{ textAlign: 'right' }}>{remaining > 0 ? <span style={{ background: '#c62828', color: '#fff', padding: '2px 8px', borderRadius: 10, fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold' }}>{fmt(remaining)}</span> : <span style={{ color: '#2e7d32', fontSize: 12 }}>✓ To'liq</span>}</td>
                      <td>
                        {payForm.id === w.id ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            <input type="number" placeholder="Summa" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} style={{ ...inp, width: 80 }} autoFocus />
                            <input placeholder="Izoh" value={payForm.note} onChange={e => setPayForm({ ...payForm, note: e.target.value })} style={{ ...inp, width: 70 }} />
                            {[{v:'naqd',l:'💵'},{v:'bank',l:'🏦'},{v:'click',l:'📱'}].map(ch => (
                              <button key={ch.v} type="button" onClick={() => setPayForm({...payForm, channel: ch.v})} title={ch.v} style={{ padding:'3px 7px', cursor:'pointer', border:`2px solid ${payForm.channel===ch.v?'#1565c0':'#ddd'}`, background:payForm.channel===ch.v?'#1565c0':'#f9f9f9', color:payForm.channel===ch.v?'#fff':'#333', borderRadius:3 }}>{ch.l}</button>
                            ))}
                            <button onClick={() => handlePay(w.id)} style={greenBtn}>✓</button>
                            <button onClick={() => setPayForm({ id: null, amount: '', note: '', channel: 'naqd' })} style={redBtn}>✕</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => handlePay(w.id)} disabled={isPaid} style={{ ...payBtn, opacity: isPaid ? 0.4 : 1, cursor: isPaid ? 'default' : 'pointer' }}>💳 To'lov</button>
                            <button onClick={() => { setEditId(w.id); setEditData({ name: w.name, salary: w.salary, position: w.position||'', phone: w.phone||'', note: w.note||'' }); }} style={editBtn}>✎</button>
                            <button onClick={() => { if(window.confirm("O'chirasizmi?")) deleteWorker(w.id); }} style={redBtn}>✕</button>
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            <tr style={{ background: '#ffff00', fontWeight: 'bold' }}>
              <td colSpan={4} style={{ textAlign: 'right', paddingRight: 8 }}>JAMI</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(totalSalary)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#2e7d32' }}>{fmt(totalPaid)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#c62828' }}>{fmt(totalQoldi)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        <Paginator total={filtered.length} page={page} setPage={setPage} pageSize={PAGE_SIZE} />
        </>
      )}

      {/* Modal */}
      {modalWorker && (() => {
        const w = workers.find(x => x.id === modalWorker);
        const pays = salaryPayments.filter(p => p.workerId === modalWorker).sort((a,b) => b.createdAt - a.createdAt);
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if(e.target===e.currentTarget) setModalWorker(null); }}>
            <div style={{ background: '#fff', borderRadius: 6, width: 500, maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ background: ACC_W, color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 'bold', fontSize: 15 }}>👷 {w?.name}</div>
                <button onClick={() => setModalWorker(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ padding: '12px 16px' }}>
                <p style={{ fontWeight: 'bold', fontSize: 13, color: ACC_W, marginBottom: 8 }}>💳 To'lovlar tarixi ({pays.length} ta)</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr style={{ background: BG_W }}><th style={thS}>Sana</th><th style={{ ...thS, textAlign: 'right' }}>Miqdor</th><th style={thS}>Izoh</th></tr></thead>
                  <tbody>{pays.map(p => <tr key={p.id}><td style={tdS}>{p.date}</td><td style={{ ...tdS, textAlign: 'right', fontWeight: 'bold', color: '#2e7d32' }}>{fmt(p.amount)}</td><td style={tdS}>{p.note||'—'}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. HAYDOVCHILAR TABI
// ═════════════════════════════════════════════════════════════════════════════
function DriversTab() {
  const { drivers, addDriver, updateDriver, deleteDriver, driverTrips, addDriverTrip, deleteDriverTrip } = useData();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ name: '', carNumber: '', phone: '' });
  const [editId, setEditId]     = useState(null);
  const [editData, setEditData] = useState({});
  const [modalDriver, setModalDriver] = useState(null);
  const [tripForm, setTripForm] = useState({ destination: '', price: '', note: '', isPayment: false, channel: 'naqd' });
  const [search, setSearch]     = useState('');
  const [page2, setPage2] = useState(1);
  const PAGE_SIZE2 = 100;
  const [botUsername, setBotUsername] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    api.getBotInfo().then(r => { if (r?.botUsername) setBotUsername(r.botUsername); }).catch(() => {});
  }, []);

  const driverLink = (id) => botUsername ? `https://t.me/${botUsername}?start=driver_${id}` : '';

  const copyLink = (id) => {
    const link = driverLink(id);
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleAdd = (e) => { e.preventDefault(); if (!form.name) return; addDriver(form.name, form.carNumber, form.phone); setForm({ name: '', carNumber: '', phone: '' }); setShowForm(false); };
  const saveEdit = (id) => { if (!editData.name) return; updateDriver(id, editData); setEditId(null); };

  const handleAddTrip = (e) => { e.preventDefault(); if (!tripForm.price) return; addDriverTrip(modalDriver, tripForm.destination, tripForm.price, tripForm.isPayment, tripForm.note, tripForm.channel); setTripForm({ destination: '', price: '', note: '', isPayment: false, channel: 'naqd' }); };

  const getStats = (id) => {
    const trips = driverTrips.filter(t => t.driverId === id);
    const earnings = trips.filter(t => !t.isPayment).reduce((s, t) => s + Number(t.price), 0);
    const paid     = trips.filter(t => t.isPayment).reduce((s, t) => s + Number(t.price), 0);
    return { earnings, paid, balance: Math.max(0, earnings - paid), count: trips.filter(t => !t.isPayment).length };
  };

  const allStats     = drivers.map(d => getStats(d.id));
  const totalBalance = allStats.reduce((s, x) => s + x.balance, 0);
  const totalQatnov  = allStats.reduce((s, x) => s + x.count, 0);

  const filtered = drivers.filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()) || (d.carNumber||'').toLowerCase().includes(search.toLowerCase()));
  useEffect(() => { setPage2(1); }, [search]);
  const paged2 = filtered.slice((page2 - 1) * PAGE_SIZE2, page2 * PAGE_SIZE2);
  const inp = { padding: '4px 7px', fontSize: 13, border: '1px solid #ccc', borderRadius: 3, fontFamily: 'Tahoma, sans-serif' };

  return (
    <div>
      {/* Statistika */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <StatBox label="Jami haydovchilar" value={drivers.length} unit="ta" color={ACC_D} bg={BG_D} />
        <StatBox label="Jami qatnovlar"    value={totalQatnov}    unit="ta" color="#1565c0" bg="#e3f2fd" />
        <StatBox label="Haydovchilardan qarzimiz" value={fmt(totalBalance)} unit="so'm" color="#c62828" bg="#ffebee" bold />
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input placeholder="🔍 Ism yoki mashina raqami..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, width: 220 }} />
        <ExcelExport
          filename="Haydovchilar"
          sheetName="Haydovchilar"
          title="Haydovchilar hisoboti"
          columns={[
            { header: 'Ism', value: d => d.name },
            { header: 'Mashina raqami', value: d => d.carNumber || '' },
            { header: 'Telefon', value: d => d.phone || '' },
            { header: 'Qatnovlar (ta)', value: d => getStats(d.id).count },
            { header: 'Ishladi (som)', value: d => getStats(d.id).earnings },
            { header: "To'landi (som)", value: d => getStats(d.id).paid },
            { header: 'Qarzimiz (som)', value: d => getStats(d.id).balance },
          ]}
          rows={filtered}
        />
        <button onClick={() => setShowForm(v => !v)} style={{ padding: '5px 16px', cursor: 'pointer', background: showForm ? '#c62828' : ACC_D, color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', marginLeft: 'auto' }}>
          {showForm ? '✕ Yopish' : '+ Yangi haydovchi'}
        </button>
      </div>

      {/* Forma */}
      {showForm && (
        <form onSubmit={handleAdd} style={{ marginBottom: 14, padding: '12px 14px', background: BG_D, border: `1px solid #bcaaa4`, borderRadius: 6, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 3 }}>Ism *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ ...inp, width: 160 }} required autoFocus /></div>
          <div><label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 3 }}>Mashina raqami</label><input value={form.carNumber} onChange={e => setForm({ ...form, carNumber: e.target.value })} style={{ ...inp, width: 140 }} /></div>
          <div><label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 3 }}>Telefon</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={{ ...inp, width: 140 }} /></div>
          <button type="submit" style={{ padding: '6px 20px', cursor: 'pointer', background: ACC_D, color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', height: 29 }}>✓ Qo'shish</button>
        </form>
      )}

      {/* Jadval */}
      {filtered.length === 0 ? <p style={{ color: '#888', fontStyle: 'italic' }}>Haydovchi topilmadi.</p> : (
        <>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 35 }}>#</th><th>Ism</th><th style={{ width: 130 }}>Mashina raqami</th><th style={{ width: 130 }}>Telefon</th>
              <th style={{ textAlign: 'center', width: 100 }}>Qatnovlar</th><th style={{ textAlign: 'right', width: 140, color: '#c62828' }}>Qarzimiz</th><th style={{ width: 80 }}>Bot</th><th style={{ width: 130 }}>Amal</th>
            </tr>
          </thead>
          <tbody>
            {paged2.map((d, i) => {
              const st = getStats(d.id);
              return (
                <tr key={d.id} style={{ background: st.balance > 0 ? '#fff8e1' : (i % 2 === 0 ? '#fff' : '#fafafa') }}>
                  <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{i + 1}</td>
                  {editId === d.id ? (
                    <>
                      <td><input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} style={{ ...inp, width: '100%' }} /></td>
                      <td><input value={editData.carNumber} onChange={e => setEditData({...editData, carNumber: e.target.value})} style={{ ...inp, width: '100%' }} /></td>
                      <td><input value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} style={{ ...inp, width: '100%' }} /></td>
                      <td colSpan={3}></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}><button onClick={() => saveEdit(d.id)} style={greenBtn}>✓</button><button onClick={() => setEditId(null)} style={redBtn}>✕</button></div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td><button onClick={() => setModalDriver(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ACC_D, fontWeight: 'bold', fontSize: 14, textDecoration: 'underline' }}>🚚 {d.name}</button></td>
                      <td style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold' }}>{d.carNumber || '—'}</td>
                      <td style={{ fontSize: 12 }}>{d.phone ? <a href={`tel:${d.phone}`} style={{ color: '#1565c0', textDecoration: 'none' }}>📞 {d.phone}</a> : '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{st.count} ta</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: st.balance > 0 ? '#c62828' : '#2e7d32', fontSize: 14, fontFamily: 'monospace' }}>{st.balance > 0 ? fmt(st.balance) : '✓ Yo\'q'}</td>
                      <td style={{ textAlign: 'center' }}>
                        {d.telegramChatId ? (
                          <span title="Telegram ulangan" style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: 13 }}>✓ Ulangan</span>
                        ) : botUsername ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                            <button onClick={() => copyLink(d.id)}
                              title={`Ssilkani nusxalash: t.me/${botUsername}?start=driver_${d.id}`}
                              style={{ padding: '3px 8px', background: copiedId === d.id ? '#2e7d32' : '#0288d1', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}>
                              {copiedId === d.id ? '✓ Nusxalandi' : '🔗 Ssilka'}
                            </button>
                          </div>
                        ) : <span style={{ color: '#bbb', fontSize: 11 }}>—</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => setModalDriver(d.id)} style={{ ...infoBtn, fontWeight: 'bold', borderColor: ACC_D, color: ACC_D }}>+ Qatnov</button>
                          <button onClick={() => { setEditId(d.id); setEditData({ name: d.name, carNumber: d.carNumber||'', phone: d.phone||'' }); }} style={editBtn}>✎</button>
                          <button onClick={() => { if(window.confirm("O'chirasizmi?")) deleteDriver(d.id); }} style={redBtn}>✕</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        <Paginator total={filtered.length} page={page2} setPage={setPage2} pageSize={PAGE_SIZE2} />
        </>
      )}

      {/* Modal */}
      {modalDriver && (() => {
        const d = drivers.find(x => x.id === modalDriver);
        const st = getStats(d.id);
        const trips = driverTrips.filter(t => t.driverId === d.id).sort((a, b) => b.createdAt - a.createdAt);
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 30, overflowY: 'auto' }} onClick={e => { if(e.target===e.currentTarget) setModalDriver(null); }}>
            <div style={{ background: '#fff', width: 600, borderRadius: 6, marginBottom: 30 }}>
              <div style={{ background: ACC_D, color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 'bold', fontSize: 16 }}>🚚 {d?.name}</div>
                <button onClick={() => setModalDriver(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ display: 'flex', background: BG_D, borderBottom: '1px solid #d7ccc8' }}>
                <div style={{ flex: 1, padding: '12px', textAlign: 'center', borderRight: '1px solid #d7ccc8' }}>
                  <div style={{ fontSize: 11, color: '#666' }}>Ishladi ({st.count} marta)</div>
                  <div style={{ fontWeight: 'bold', fontSize: 15 }}>{fmt(st.earnings)}</div>
                </div>
                <div style={{ flex: 1, padding: '12px', textAlign: 'center', borderRight: '1px solid #d7ccc8' }}>
                  <div style={{ fontSize: 11, color: '#2e7d32' }}>To'landi</div>
                  <div style={{ fontWeight: 'bold', fontSize: 15, color: '#2e7d32' }}>{fmt(st.paid)}</div>
                </div>
                <div style={{ flex: 1, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: st.balance > 0 ? '#c62828' : '#2e7d32' }}>Qarzimiz</div>
                  <div style={{ fontWeight: 'bold', fontSize: 15, color: st.balance > 0 ? '#c62828' : '#2e7d32' }}>{st.balance > 0 ? fmt(st.balance) : '✓ Yo\'q'}</div>
                </div>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <button onClick={() => setTripForm({ ...tripForm, isPayment: false })} style={{ flex: 1, padding: 8, cursor: 'pointer', border: tripForm.isPayment ? '1px solid #ccc' : `2px solid ${ACC_D}`, background: tripForm.isPayment ? '#fff' : ACC_D, color: tripForm.isPayment ? '#555' : '#fff', fontWeight: 'bold', borderRadius: 4 }}>🚛 Yangi qatnov (ish)</button>
                  <button onClick={() => setTripForm({ ...tripForm, isPayment: true, destination: 'To\'lov' })} style={{ flex: 1, padding: 8, cursor: 'pointer', border: !tripForm.isPayment ? '1px solid #ccc' : `2px solid #2e7d32`, background: !tripForm.isPayment ? '#fff' : '#2e7d32', color: !tripForm.isPayment ? '#555' : '#fff', fontWeight: 'bold', borderRadius: 4 }}>💸 Pul berish</button>
                </div>
                <form onSubmit={handleAddTrip} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
                  {!tripForm.isPayment && <input placeholder="Qayerga" value={tripForm.destination} onChange={e => setTripForm({...tripForm, destination: e.target.value})} style={{ ...inp, flex: 1, minWidth: 120 }} required />}
                  <input type="number" placeholder={tripForm.isPayment ? "To'lov summasi" : "Kira haqi"} value={tripForm.price} onChange={e => setTripForm({...tripForm, price: e.target.value})} style={{ ...inp, width: 120 }} required autoFocus />
                  <input placeholder="Izoh" value={tripForm.note} onChange={e => setTripForm({...tripForm, note: e.target.value})} style={{ ...inp, flex: 1, minWidth: 100 }} />
                  {/* Pul berishda — qaysi kassadan chiqsin */}
                  {tripForm.isPayment && [
                    { v: 'naqd', l: '💵' }, { v: 'bank', l: '🏦' }, { v: 'click', l: '📱' },
                  ].map(ch => (
                    <button key={ch.v} type="button" title={ch.v} onClick={() => setTripForm({ ...tripForm, channel: ch.v })}
                      style={{ padding: '5px 9px', cursor: 'pointer', borderRadius: 3, border: `2px solid ${tripForm.channel === ch.v ? '#2e7d32' : '#ddd'}`, background: tripForm.channel === ch.v ? '#2e7d32' : '#f9f9f9', color: tripForm.channel === ch.v ? '#fff' : '#333' }}>{ch.l}</button>
                  ))}
                  <button type="submit" style={{ padding: '0 16px', background: tripForm.isPayment ? '#2e7d32' : ACC_D, color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 'bold' }}>✓ Saqlash</button>
                </form>
                <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>Tarix</p>
                {trips.length === 0 ? <p style={{ color: '#aaa', fontStyle: 'italic', fontSize: 12 }}>Tarix bo'sh.</p> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr style={{ background: '#f5f5f5' }}><th style={thS}>Sana</th><th style={thS}>Amaliyot</th><th style={thS}>Izoh</th><th style={{ ...thS, textAlign: 'right' }}>Summa</th><th style={{ width: 40 }}></th></tr></thead>
                    <tbody>
                      {trips.map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid #eee', background: t.isPayment ? '#e8f5e9' : '#fff' }}>
                          <td style={tdS}>{t.date}</td>
                          <td style={{ ...tdS, fontWeight: t.isPayment ? 'normal' : 'bold' }}>{t.isPayment ? `💸 To'lov${t.channel ? ' (' + ({naqd:'Naqd',bank:'Bank',click:'Click'}[t.channel] || t.channel) + ')' : ''}` : `🚛 ${t.destination}`}</td>
                          <td style={tdS}>{t.note || '—'}</td>
                          <td style={{ ...tdS, textAlign: 'right', fontWeight: 'bold', color: t.isPayment ? '#2e7d32' : '#333' }}>{t.isPayment ? '-' : '+'}{fmt(t.price)}</td>
                          <td style={{ textAlign: 'center' }}><button onClick={() => { if(window.confirm("O'chirasizmi?")) deleteDriverTrip(t.id); }} style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#c62828' }}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Yordamchi ──────────────────────────────────────────────────────────────
function StatBox({ label, value, unit, color, bg, bold }) {
  return (
    <div style={{ padding: '8px 16px', background: bg, borderLeft: `4px solid ${color}`, borderRadius: 4, minWidth: 150 }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: bold ? 17 : 15, fontWeight: 'bold', color, fontFamily: 'monospace' }}>
        {value} <span style={{ fontSize: 11 }}>{unit}</span>
      </div>
    </div>
  );
}
const thS = { border: '1px solid #ccc', padding: '6px 8px', fontWeight: 'bold', fontSize: 11, textAlign: 'left' };
const tdS = { border: '1px solid #eee', padding: '6px 8px', fontSize: 12 };
const infoBtn = { padding: '3px 8px', cursor: 'pointer', background: '#fff', borderRadius: 3, fontSize: 12, border: '1px solid #ccc' };
const editBtn = { padding: '3px 8px', cursor: 'pointer', background: '#e3f2fd', border: '1px solid #1976d2', borderRadius: 3, color: '#1565c0', fontSize: 12 };
const greenBtn= { padding: '3px 8px', cursor: 'pointer', background: '#e8f5e9', border: '1px solid #4caf50', borderRadius: 3, color: '#2e7d32', fontSize: 12, fontWeight: 'bold' };
const redBtn  = { padding: '3px 8px', cursor: 'pointer', background: '#ffebee', border: '1px solid #e53935', borderRadius: 3, color: '#c62828', fontSize: 12 };
const payBtn  = { padding: '3px 8px', cursor: 'pointer', background: '#fff8e1', border: '1px solid #f9a825', borderRadius: 3, color: '#f57f17', fontSize: 12, fontWeight: 'bold' };
