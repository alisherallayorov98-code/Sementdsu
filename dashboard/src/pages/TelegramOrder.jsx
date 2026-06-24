import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { api } from '../api';
import CustomerSelect from '../components/CustomerSelect';
import ExcelExport from '../components/ExcelExport';
import Paginator from '../components/Paginator';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (ts) => {
  if (!ts || ts < 1e10) return '—';
  const d = new Date(ts);
  return [String(d.getHours()).padStart(2,'0'), String(d.getMinutes()).padStart(2,'0')].join(':');
};
const fmtTons = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };

const ACCENT = '#0288d1'; // blue for telegram
const BG     = '#e1f5fe';

export default function TelegramOrder({ lang }) {
  const {
    tgOrders, addTgOrder, setTgStatus, deleteTgOrder,
    currentWorker, workers,
  } = useData();

  const [form, setForm] = useState({ customer: '', tons: '', note: '' });
  // Xodim tanlovi (faqat shu formada ko'rsatish uchun). Standart — tizimga kirgan xodim.
  const [worker, setWorker] = useState(currentWorker);

  // Filter state
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'kutilmoqda' | 'bajarildi' | 'bekor'
  const [filterDate, setFilterDate]     = useState('');
  const [search, setSearch]             = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.customer || !form.tons) return;
    addTgOrder(form.customer, form.tons, form.note, worker);
    setForm({ customer: '', tons: '', note: '' });
  };

  const handleStatusChange = (id, newStatus) => {
    if (newStatus === 'bekor' && !window.confirm("Haqiqatan ham bekor qilasizmi?")) return;
    setTgStatus(id, newStatus);
    if (newStatus === 'bajarildi') {
      const order = tgOrders.find(o => o.id === id);
      if (order?.chatId) {
        api.notifyOrderDone({
          chatId: order.chatId,
          customer: order.customer,
          tons: order.tons,
          brand: order.brand,
          tur: order.tur,
          note: order.note,
        }).catch(() => {});
      }
    }
  };

  // ── Hisobot ───────────────────────────────────────────────────────────────
  const totalTons      = tgOrders.reduce((s, o) => s + Number(o.tons), 0);
  const pendingTons    = tgOrders.filter(o => o.status === 'kutilmoqda').reduce((s, o) => s + Number(o.tons), 0);
  const completedTons  = tgOrders.filter(o => o.status === 'bajarildi').reduce((s, o) => s + Number(o.tons), 0);
  const canceledTons   = tgOrders.filter(o => o.status === 'bekor').reduce((s, o) => s + Number(o.tons), 0);

  const pendingCount   = tgOrders.filter(o => o.status === 'kutilmoqda').length;
  const completedCount = tgOrders.filter(o => o.status === 'bajarildi').length;

  // ── Saralash va filterlash ────────────────────────────────────────────────
  const sorted = [...tgOrders].sort((a, b) => b.createdAt - a.createdAt);
  const filtered = sorted.filter(o => {
    let match = true;
    if (filterStatus !== 'all' && o.status !== filterStatus) match = false;
    if (filterDate && o.date !== filterDate) match = false;
    if (search && !o.customer.toLowerCase().includes(search.toLowerCase()) && !(o.note||'').toLowerCase().includes(search.toLowerCase())) match = false;
    return match;
  });

  const filteredTotalTons = filtered.reduce((s, o) => s + Number(o.tons), 0);
  useEffect(() => { setPage(1); }, [search, filterDate]);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const inp = { padding: '5px 8px', fontSize: 13, border: '1px solid #ccc', borderRadius: 3, fontFamily: 'Tahoma, sans-serif' };

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>

      {/* ── STATISTIKA PANELI ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <StatBox label="Kutilayotgan zakazlar" value={pendingCount}    unit="ta" sub={`${fmtTons(pendingTons)} tn`} color="#f57f17" bg="#fffde7" bold />
        <StatBox label="Bajarilgan zakazlar"   value={completedCount}  unit="ta" sub={`${fmtTons(completedTons)} tn`} color="#2e7d32" bg="#e8f5e9" />
        <StatBox label="Bekor qilingan"        value={fmtTons(canceledTons)} unit="tn" color="#c62828" bg="#ffebee" />
        <StatBox label="Jami tushgan zakazlar" value={fmtTons(totalTons)} unit="tn" color={ACCENT}  bg={BG} />
      </div>

      {/* ── QO'SHISH FORMASI ──────────────────────────────────────────────── */}
      <form onSubmit={handleAdd} style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center',
        padding: '10px 14px', background: BG, border: `1px solid #81d4fa`, borderRadius: 6
      }}>
        <CustomerSelect
          value={form.customer}
          onChange={val => setForm({ ...form, customer: val })}
          placeholder="Mijoz (izlash...)"
          width={240}
          accentColor={ACCENT}
          style={{ border: '1px solid #ccc', borderRadius: 3 }}
          required
        />
        <input type="number" placeholder="Tonna *" value={form.tons}
          onChange={e => setForm({ ...form, tons: e.target.value })}
          style={{ ...inp, width: 100 }} required />
        <input placeholder="Izoh (manzil, mashina...)" value={form.note}
          onChange={e => setForm({ ...form, note: e.target.value })}
          style={{ ...inp, width: 220 }} />

        <span style={{ fontSize: 12, fontWeight: 'bold', color: ACCENT, alignSelf: 'center', marginLeft: 8 }}>Xodim:</span>
        <select value={worker} onChange={e => setWorker(e.target.value)}
          style={{ ...inp, color: worker ? ACCENT : '#999', fontWeight: worker ? 'bold' : 'normal' }}>
          <option value="">— tanlang —</option>
          {(workers || []).map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
        </select>

        <button type="submit" style={{ padding: '6px 20px', cursor: 'pointer', background: ACCENT, color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', marginLeft: 'auto' }}>
          ✓ Qo'shish
        </button>
      </form>

      {/* ── FILTERLAR ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="🔍 Mijoz yoki izohdan izlash..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, width: 220 }} />

        {/* Holat filtri */}
        <div style={{ display: 'flex', border: '1px solid #ccc', borderRadius: 4, overflow: 'hidden' }}>
          {[
            { v: 'all',        l: 'Barchasi' },
            { v: 'kutilmoqda', l: 'Kutilmoqda' },
            { v: 'bajarildi',  l: 'Bajarildi' },
            { v: 'bekor',      l: 'Bekor qilingan' },
          ].map(f => (
            <button key={f.v} onClick={() => setFilterStatus(f.v)} style={{
              padding: '4px 12px', cursor: 'pointer', border: 'none',
              background: filterStatus === f.v ? '#cfd8dc' : '#f5f5f5',
              color: filterStatus === f.v ? '#000' : '#555',
              fontWeight: filterStatus === f.v ? 'bold' : 'normal',
              borderRight: '1px solid #ccc', fontSize: 12
            }}>
              {f.l}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 12, fontWeight: 'bold', marginLeft: 6 }}>Sana:</span>
        <input type="text" placeholder="dd.mm.yyyy" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ ...inp, width: 90 }} />
        {filterDate && <button onClick={() => setFilterDate('')} style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#888', fontSize: 16 }}>✕</button>}

        <span style={{ marginLeft: 'auto', color: '#888', fontSize: 12 }}>
          {filtered.length} ta zakaz ({fmtTons(filteredTotalTons)} tn)
        </span>
        <ExcelExport
          filename="Telegram_zakazlar"
          sheetName="Zakazlar"
          title="Telegram zakazlari hisoboti"
          columns={[
            { header: 'Sana', value: o => o.date },
            { header: 'Mijoz', value: o => o.customer },
            { header: 'Marka', value: o => o.brand || '' },
            { header: 'Tur', value: o => o.tur || '' },
            { header: 'Tonna', value: o => Number(o.tons || 0) },
            { header: 'Xodim', value: o => o.worker || '' },
            { header: 'Izoh', value: o => o.note || '' },
            { header: 'Holati', value: o => ({ kutilmoqda: 'Kutilmoqda', bajarildi: 'Bajarildi', bekor: 'Bekor qilindi' }[o.status] || o.status) },
          ]}
          rows={filtered}
        />
      </div>

      {/* ── JADVAL ────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? <p style={{ color: '#888', fontStyle: 'italic', marginTop: 20 }}>Zakaz topilmadi.</p> : (
        <>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th style={{ width: 85 }}>Sana</th>
              <th style={{ width: 60 }}>Vaqt</th>
              <th style={{ minWidth: 140 }}>Mijoz</th>
              <th style={{ width: 90 }}>Marka</th>
              <th style={{ width: 80 }}>Tur</th>
              <th style={{ textAlign: 'right', width: 80 }}>Tonna</th>
              <th style={{ width: 70 }}>Manba</th>
              <th style={{ width: 100 }}>Xodim</th>
              <th>Izoh</th>
              <th style={{ width: 150 }}>Holati</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((o, i) => {
              const bg = o.status === 'kutilmoqda' ? '#fffde7' : o.status === 'bajarildi' ? '#f1f8e9' : '#ffebee';
              const sColor = o.status === 'kutilmoqda' ? '#f57f17' : o.status === 'bajarildi' ? '#2e7d32' : '#c62828';
              return (
                <tr key={o.id} style={{ background: bg }}>
                  <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{i + 1}</td>
                  <td style={{ fontSize: 12 }}>{o.date}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', color: '#555' }}>{fmtT(o.createdAt)}</td>
                  <td style={{ fontWeight: 'bold', color: '#1565c0' }}>{o.customer}</td>
                  <td style={{ fontSize: 12, color: '#006699', fontWeight: 'bold' }}>{o.brand || '—'}</td>
                  <td style={{ fontSize: 12 }}>
                    {o.tur
                      ? <span style={{ background: o.tur.includes('Qoplik') ? '#e3f2fd' : '#f3e5f5', padding: '1px 6px', borderRadius: 10, fontSize: 11 }}>{o.tur}</span>
                      : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', fontSize: 14 }}>{fmtTons(o.tons)}</td>
                  <td style={{ textAlign: 'center' }}>
                    {o.source === 'customer'
                      ? <span title="Mijoz bot orqali" style={{ fontSize: 15 }}>🤖</span>
                      : o.source === 'seller'
                        ? <span title="Sotuvchi bot orqali" style={{ fontSize: 15 }}>👷</span>
                        : <span title="Qo'lda kiritilgan" style={{ fontSize: 15 }}>✍️</span>
                    }
                  </td>
                  <td style={{ fontSize: 12, color: '#555' }}>{o.worker || '—'}</td>
                  <td style={{ fontSize: 12 }}>{o.note || '—'}</td>
                  <td>
                    <select
                      value={o.status}
                      onChange={e => handleStatusChange(o.id, e.target.value)}
                      style={{
                        padding: '3px 6px', fontSize: 12, borderRadius: 12, cursor: 'pointer',
                        border: `1px solid ${sColor}`, color: sColor, fontWeight: 'bold',
                        background: '#fff', width: '100%', outline: 'none'
                      }}>
                      <option value="kutilmoqda">⏳ Kutilmoqda</option>
                      <option value="bajarildi">✓ Bajarildi</option>
                      <option value="bekor">✕ Bekor qilindi</option>
                    </select>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button onClick={() => { if(window.confirm("O'chirasizmi?")) deleteTgOrder(o.id); }}
                      style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#c62828' }}>✕</button>
                  </td>
                </tr>
              );
            })}
            <tr style={{ background: '#ffff00', fontWeight: 'bold' }}>
              <td colSpan={4} style={{ textAlign: 'right', paddingRight: 8 }}>JAMI KO'RINAYOTGAN TONNA</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 15 }}>{fmtTons(filteredTotalTons)}</td>
              <td colSpan={5}></td>
            </tr>
          </tbody>
        </table>
        <Paginator total={filtered.length} page={page} setPage={setPage} pageSize={PAGE_SIZE} />
        </>
      )}
    </div>
  );
}

// ─── Yordamchi komponentlar ──────────────────────────────────────────────────
function StatBox({ label, value, unit, sub, color, bg, bold }) {
  return (
    <div style={{ padding: '8px 16px', background: bg, borderLeft: `4px solid ${color}`, borderRadius: 4, minWidth: 160 }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: bold ? 18 : 16, fontWeight: 'bold', color, fontFamily: 'monospace' }}>
        {value} <span style={{ fontSize: 11 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: '#888', marginTop: 2, fontWeight: 'bold' }}>{sub}</div>}
    </div>
  );
}
