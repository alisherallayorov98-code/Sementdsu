import { useState } from 'react';
import { useData } from '../context/DataContext';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU');
const pct = (used, total) => total ? Math.min(100, Math.round((used / total) * 100)) : 0;

const CEMENT_MARKS = [
  '42.5H в россып', '42.5H в мешках',
  '32.5H в россып', '32.5H в мешках',
  '42.5N в россып', '42.5N в мешках',
];

export default function Tiketlar() {
  const { tickets, addTicket, closeTicket, reopenTicket, deleteTicket, appSettings } = useData();
  const color = appSettings.themeColor || '#1565c0';

  const [form, setForm] = useState({ number: '', marka: '', totalTonna: '' });
  const [showClosed, setShowClosed] = useState(false);
  const [filter, setFilter] = useState('');

  const openTickets   = tickets.filter(t => t.status === 'open');
  const closedTickets = tickets.filter(t => t.status !== 'open');

  const filtered = (list) => {
    if (!filter.trim()) return list;
    const q = filter.toLowerCase();
    return list.filter(t => t.number.toLowerCase().includes(q) || t.marka.toLowerCase().includes(q));
  };

  const handleAdd = (e) => {
    e.preventDefault();
    const n = form.number.trim();
    const m = form.marka.trim();
    const t = Number(form.totalTonna);
    if (!n || !m || !t) { alert('Barcha maydonlarni to\'ldiring.'); return; }
    addTicket(n, m, t);
    setForm({ number: '', marka: '', totalTonna: '' });
  };

  const sInp = {
    padding: '8px 12px', fontSize: 13, border: '1px solid #ccc',
    borderRadius: 4, boxSizing: 'border-box',
  };

  return (
    <div style={{ fontFamily: 'Tahoma, sans-serif', maxWidth: 860 }}>

      {/* Yangi tiket qo'shish */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 14px', color }}>Yangi tiket ochish</h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px' }}>
            <label style={{ fontSize: 11, color: '#666' }}>Tiket raqami</label>
            <input
              value={form.number}
              onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
              placeholder="A26008982"
              style={{ ...sInp }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '2 1 200px' }}>
            <label style={{ fontSize: 11, color: '#666' }}>Marka va tur</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <select
                value={CEMENT_MARKS.includes(form.marka) ? form.marka : ''}
                onChange={e => e.target.value && setForm(f => ({ ...f, marka: e.target.value }))}
                style={{ ...sInp, flex: 1 }}
              >
                <option value="">Tanlang...</option>
                {CEMENT_MARKS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input
                value={form.marka}
                onChange={e => setForm(f => ({ ...f, marka: e.target.value }))}
                placeholder="yoki o'zingiz yozing"
                style={{ ...sInp, flex: 1 }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 100px' }}>
            <label style={{ fontSize: 11, color: '#666' }}>Jami tonna</label>
            <input
              type="number"
              value={form.totalTonna}
              onChange={e => setForm(f => ({ ...f, totalTonna: e.target.value }))}
              placeholder="500"
              min="1"
              style={{ ...sInp }}
            />
          </div>
          <button type="submit"
            style={{ padding: '8px 20px', background: color, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', fontSize: 13, height: 37 }}>
            + Tiket ochish
          </button>
        </form>
      </div>

      {/* Qidiruv */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, color }}>
          Ochiq tiketlar
          <span style={{ marginLeft: 8, fontSize: 13, background: '#e8f5e9', color: '#1b5e20', padding: '2px 8px', borderRadius: 12, fontWeight: 'normal' }}>
            {openTickets.length} ta
          </span>
        </h3>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Qidirish (raqam yoki marka)"
          style={{ ...sInp, width: 220 }}
        />
      </div>

      {/* Ochiq tiketlar */}
      {filtered(openTickets).length === 0 && (
        <div style={{ color: '#999', fontSize: 13, fontStyle: 'italic', marginBottom: 20, textAlign: 'center', padding: 24, background: '#f9f9f9', borderRadius: 8 }}>
          {openTickets.length === 0 ? 'Hozir ochiq tiket yo\'q. Yuqoridan yangi tiket oching.' : 'Qidiruv natijasi topilmadi.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {filtered(openTickets).map(t => <TicketCard key={t.id} ticket={t} color={color} onClose={() => closeTicket(t.id)} onDelete={() => { if (window.confirm('Tiketni o\'chirasizmi?')) deleteTicket(t.id); }} />)}
      </div>

      {/* Yopilgan tiketlar */}
      {closedTickets.length > 0 && (
        <div>
          <button
            onClick={() => setShowClosed(s => !s)}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {showClosed ? '▼' : '▶'} Yopilgan tiketlar ({closedTickets.length} ta)
          </button>
          {showClosed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered(closedTickets).map(t => (
                <TicketCard key={t.id} ticket={t} color="#888" closed
                  onReopen={() => reopenTicket(t.id)}
                  onDelete={() => { if (window.confirm('Tiketni o\'chirasizmi?')) deleteTicket(t.id); }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket, color, closed, onClose, onReopen, onDelete }) {
  const used      = ticket.usedTonna || 0;
  const total     = ticket.totalTonna || 0;
  const remaining = total - used;
  const progress  = pct(used, total);

  const progressColor = progress >= 100 ? '#c62828' : progress >= 80 ? '#f57f17' : '#2e7d32';

  return (
    <div style={{
      background: closed ? '#fafafa' : '#fff',
      border: `1px solid ${closed ? '#e0e0e0' : (remaining <= 0 ? '#ffcdd2' : '#c8e6c9')}`,
      borderRadius: 8, padding: '14px 18px',
      opacity: closed ? 0.75 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        {/* Sol tomon */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontWeight: 'bold', fontSize: 16, color: closed ? '#888' : color, fontFamily: 'monospace' }}>
              {ticket.number}
            </span>
            <span style={{ fontSize: 13, color: '#555', background: '#f5f5f5', padding: '2px 8px', borderRadius: 4 }}>
              {ticket.marka}
            </span>
            {closed && <span style={{ fontSize: 11, color: '#999', fontStyle: 'italic' }}>yopilgan</span>}
            {!closed && remaining <= 0 && (
              <span style={{ fontSize: 11, color: '#c62828', fontWeight: 'bold', background: '#ffebee', padding: '2px 6px', borderRadius: 4 }}>
                TUGADI
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div style={{ background: '#e0e0e0', borderRadius: 6, height: 10, width: '100%', marginBottom: 6, overflow: 'hidden' }}>
            <div style={{ background: progressColor, height: '100%', width: `${Math.min(100, progress)}%`, borderRadius: 6, transition: 'width 0.3s' }} />
          </div>

          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <span style={{ color: '#555' }}>Jami: <strong>{fmt(total)} t</strong></span>
            <span style={{ color: '#c62828' }}>Ketdi: <strong>{fmt(used)} t</strong></span>
            <span style={{ color: progressColor, fontWeight: 'bold' }}>Qoldi: {fmt(remaining)} t ({100 - progress}%)</span>
          </div>
        </div>

        {/* O'ng tomon — tugmalar */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {!closed ? (
            <button onClick={onClose}
              style={{ padding: '5px 12px', background: '#fff8e1', border: '1px solid #ffd54f', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#f57f17', fontWeight: 'bold' }}>
              Yopish
            </button>
          ) : (
            <button onClick={onReopen}
              style={{ padding: '5px 12px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#2e7d32', fontWeight: 'bold' }}>
              Ochish
            </button>
          )}
          <button onClick={onDelete}
            style={{ padding: '5px 10px', background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#c62828' }}>
            ✕
          </button>
        </div>
      </div>

      {ticket.createdAt && (
        <div style={{ fontSize: 11, color: '#bbb', marginTop: 6 }}>
          Ochildi: {new Date(ticket.createdAt).toLocaleDateString('ru-RU')}
          {ticket.closedAt && ` | Yopildi: ${new Date(ticket.closedAt).toLocaleDateString('ru-RU')}`}
        </div>
      )}
    </div>
  );
}
