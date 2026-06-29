import { useState } from 'react';
import { useData } from '../context/DataContext';
import { api } from '../api';

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

  const [form, setForm]           = useState({ number: '', marka: '', totalTonna: '' });
  const [showClosed, setShowClosed] = useState(false);
  const [filter, setFilter]       = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null); // o'chirish tasdiqlash
  const [detailTicket, setDetailTicket]       = useState(null); // { ticket, log, loading }

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

  const openDetail = async (ticket) => {
    setDetailTicket({ ticket, log: [], loading: true });
    try {
      const r = await api.getTicketLog(ticket.id);
      setDetailTicket({ ticket, log: r.log || [], loading: false });
    } catch {
      setDetailTicket({ ticket, log: [], loading: false });
    }
  };

  const confirmDelete = (id) => {
    deleteTicket(id);
    setDeleteConfirmId(null);
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
            <input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
              placeholder="A26008982" style={{ ...sInp }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '2 1 200px' }}>
            <label style={{ fontSize: 11, color: '#666' }}>Marka va tur</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <select value={CEMENT_MARKS.includes(form.marka) ? form.marka : ''}
                onChange={e => e.target.value && setForm(f => ({ ...f, marka: e.target.value }))}
                style={{ ...sInp, flex: 1 }}>
                <option value="">Tanlang...</option>
                {CEMENT_MARKS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input value={form.marka} onChange={e => setForm(f => ({ ...f, marka: e.target.value }))}
                placeholder="yoki o'zingiz yozing" style={{ ...sInp, flex: 1 }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 100px' }}>
            <label style={{ fontSize: 11, color: '#666' }}>Jami tonna</label>
            <input type="number" value={form.totalTonna}
              onChange={e => setForm(f => ({ ...f, totalTonna: e.target.value }))}
              placeholder="500" min="1" style={{ ...sInp }} />
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
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Qidirish (raqam yoki marka)" style={{ ...sInp, width: 220 }} />
      </div>

      {/* Ochiq tiketlar */}
      {filtered(openTickets).length === 0 && (
        <div style={{ color: '#999', fontSize: 13, fontStyle: 'italic', marginBottom: 20, textAlign: 'center', padding: 24, background: '#f9f9f9', borderRadius: 8 }}>
          {openTickets.length === 0 ? 'Hozir ochiq tiket yo\'q. Yuqoridan yangi tiket oching.' : 'Qidiruv natijasi topilmadi.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {filtered(openTickets).map(t => (
          <TicketCard key={t.id} ticket={t} color={color}
            onDetail={() => openDetail(t)}
            onClose={() => closeTicket(t.id)}
            deleteConfirm={deleteConfirmId === t.id}
            onDeleteRequest={() => setDeleteConfirmId(t.id)}
            onDeleteCancel={() => setDeleteConfirmId(null)}
            onDeleteConfirm={() => confirmDelete(t.id)}
          />
        ))}
      </div>

      {/* Yopilgan tiketlar */}
      {closedTickets.length > 0 && (
        <div>
          <button onClick={() => setShowClosed(s => !s)}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            {showClosed ? '▼' : '▶'} Yopilgan tiketlar ({closedTickets.length} ta)
          </button>
          {showClosed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered(closedTickets).map(t => (
                <TicketCard key={t.id} ticket={t} color="#888" closed
                  onDetail={() => openDetail(t)}
                  onReopen={() => reopenTicket(t.id)}
                  deleteConfirm={deleteConfirmId === t.id}
                  onDeleteRequest={() => setDeleteConfirmId(t.id)}
                  onDeleteCancel={() => setDeleteConfirmId(null)}
                  onDeleteConfirm={() => confirmDelete(t.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tiket detail modali */}
      {detailTicket && (
        <TicketDetailModal
          ticket={detailTicket.ticket}
          log={detailTicket.log}
          loading={detailTicket.loading}
          onClose={() => setDetailTicket(null)}
          color={color}
        />
      )}
    </div>
  );
}

function TicketCard({ ticket, color, closed, onDetail, onClose, onReopen, deleteConfirm, onDeleteRequest, onDeleteCancel, onDeleteConfirm }) {
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

        {/* Chap tomon — bosish hisobot ochadi */}
        <div style={{ flex: 1, cursor: 'pointer' }} onClick={onDetail}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontWeight: 'bold', fontSize: 16, color: closed ? '#888' : color, fontFamily: 'monospace', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
              {ticket.number}
            </span>
            <span style={{ fontSize: 13, color: '#555', background: '#f5f5f5', padding: '2px 8px', borderRadius: 4 }}>
              {ticket.marka}
            </span>
            {closed && <span style={{ fontSize: 11, color: '#999', fontStyle: 'italic' }}>yopilgan</span>}
            {!closed && remaining <= 0 && (
              <span style={{ fontSize: 11, color: '#c62828', fontWeight: 'bold', background: '#ffebee', padding: '2px 6px', borderRadius: 4 }}>TUGADI</span>
            )}
            <span style={{ fontSize: 11, color: '#888' }}>📋 hisobot</span>
          </div>

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
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
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

          {/* O'chirish — ikki bosqich */}
          {deleteConfirm ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 6, padding: '4px 8px' }}>
              <span style={{ fontSize: 11, color: '#c62828', fontWeight: 'bold' }}>O'chirasizmi?</span>
              <button onClick={onDeleteConfirm}
                style={{ padding: '3px 8px', background: '#c62828', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}>
                Ha
              </button>
              <button onClick={onDeleteCancel}
                style={{ padding: '3px 8px', background: '#fff', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                Yo'q
              </button>
            </div>
          ) : (
            <button onClick={onDeleteRequest}
              style={{ padding: '5px 10px', background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#c62828' }}>
              ✕
            </button>
          )}
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

function TicketDetailModal({ ticket, log, loading, onClose, color }) {
  const used  = ticket.usedTonna || 0;
  const total = ticket.totalTonna || 0;
  const progress = pct(used, total);
  const progressColor = progress >= 100 ? '#c62828' : progress >= 80 ? '#f57f17' : '#2e7d32';

  const totalTonna = log.filter(z => !z.cancelled).reduce((s, z) => {
    const t = Number(z.values?.tonna || z.values?.ton || 0);
    return s + t;
  }, 0);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 10, width: '100%', maxWidth: 640,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)', fontFamily: 'Tahoma, sans-serif',
      }}>
        {/* Header */}
        <div style={{ background: color, color: '#fff', padding: '14px 20px', borderRadius: '10px 10px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 16, fontFamily: 'monospace' }}>{ticket.number}</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{ticket.marka}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* Progress */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #eee' }}>
          <div style={{ background: '#e0e0e0', borderRadius: 6, height: 12, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ background: progressColor, height: '100%', width: `${Math.min(100, progress)}%`, borderRadius: 6 }} />
          </div>
          <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
            <span>Jami: <b>{fmt(total)} t</b></span>
            <span style={{ color: '#c62828' }}>Ketdi: <b>{fmt(used)} t</b></span>
            <span style={{ color: progressColor, fontWeight: 'bold' }}>Qoldi: {fmt(total - used)} t ({100 - progress}%)</span>
            <span style={{ color: '#888' }}>Zayavkalar: <b>{log.filter(z => !z.cancelled).length} ta</b></span>
          </div>
        </div>

        {/* Log ro'yxati */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#888', padding: 30 }}>Yuklanmoqda...</div>
          ) : log.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#aaa', padding: 30, fontStyle: 'italic' }}>
              Bu tiket bo'yicha hali zayavka yo'q
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding: '7px 10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', color: '#555', fontWeight: 'bold' }}>#</th>
                  <th style={{ padding: '7px 10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', color: '#555', fontWeight: 'bold' }}>Sana</th>
                  <th style={{ padding: '7px 10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', color: '#555', fontWeight: 'bold' }}>Ma'lumot</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '2px solid #e0e0e0', color: '#555', fontWeight: 'bold' }}>Tonna</th>
                  <th style={{ padding: '7px 10px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', color: '#555', fontWeight: 'bold' }}>Holat</th>
                </tr>
              </thead>
              <tbody>
                {log.map((z, i) => {
                  const tonna = Number(z.values?.tonna || z.values?.ton || 0);
                  // values dan mashina va haydovchi ma'lumotlarini chiqarish
                  const infoFields = Object.entries(z.values || {})
                    .filter(([k]) => !['tonna', 'ton'].includes(k))
                    .map(([, v]) => v).filter(Boolean).join(' · ');
                  return (
                    <tr key={z.id || i} style={{ background: z.cancelled ? '#fafafa' : (i % 2 === 0 ? '#fff' : '#f9f9f9'), opacity: z.cancelled ? 0.5 : 1 }}>
                      <td style={{ padding: '7px 10px', color: '#888', fontSize: 11 }}>{z.id}</td>
                      <td style={{ padding: '7px 10px', color: '#555', whiteSpace: 'nowrap' }}>{z.date}</td>
                      <td style={{ padding: '7px 10px', color: '#333', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={infoFields || z.text}>
                        {infoFields || <span style={{ color: '#aaa', fontSize: 11 }}>{z.text?.slice(0, 60)}</span>}
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', color: z.cancelled ? '#aaa' : '#1565c0' }}>
                        {tonna > 0 ? `${fmt(tonna)} t` : '—'}
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                        {z.cancelled
                          ? <span style={{ fontSize: 11, color: '#c62828', background: '#ffebee', padding: '2px 6px', borderRadius: 8 }}>Bekor</span>
                          : <span style={{ fontSize: 11, color: '#2e7d32', background: '#e8f5e9', padding: '2px 6px', borderRadius: 8 }}>✓</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#fffde7', borderTop: '2px solid #fbc02d' }}>
                  <td colSpan={3} style={{ padding: '8px 10px', fontWeight: 'bold', textAlign: 'right', color: '#555' }}>Jami (bekor qilinmaganlar):</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', color: color, fontSize: 14 }}>{fmt(totalTonna)} t</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
