// ─────────────────────────────────────────────────────────────────────────────
// Mijoz Nazorati — "jim qolgan" mijozlarni aniqlash.
//
// Korxona ko'p do'konlarga yuk tarqatadi. Doimiy mijoz har necha kunda yangi yuk
// oladi. Agar belgilangan muddat (masalan 2 hafta) ichida yangi xarid bo'lmasa —
// mijoz boshqa yerdan olmoqda yoki pulni "uxlatmoqda". Rahbar buni darrov ko'radi.
//
// Faqat NAZORATGA belgilangan mijozlar tekshiriladi. Muddatni global yoki har bir
// mijozga alohida (10 kun / 2 hafta / 1 oy) qo'yish mumkin.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { customerSummary } from '../lib/customerSummary';
import { activityStatus, effectiveDays } from '../lib/monitoring';
import CustomerCard from '../components/CustomerCard';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };
const dateOf = (ts) => (ts && ts > 1e10 ? new Date(ts).toLocaleDateString('ru-RU') : '—');

const PRESETS = [
  { d: 10, label: '10 kun' },
  { d: 14, label: '2 hafta' },
  { d: 30, label: '1 oy' },
  { d: 45, label: '45 kun' },
];

export default function Monitoring() {
  const data = useData();
  const { customers, appSettings, updateAppSettings, setMonitor } = data;
  const globalDays = Number(appSettings.monitorDays) || 14;

  const [card, setCard]       = useState(null);
  const [filter, setFilter]   = useState('all'); // all | alert | warning | ok
  const [editDaysId, setEditDaysId] = useState(null);
  const [daysVal, setDaysVal] = useState('');

  // ── Nazoratdagi mijozlar + holatlari ─────────────────────────────────────
  const monitored = useMemo(() => {
    return customers
      .filter(c => c.monitored)
      .map(c => {
        const s = customerSummary(c.name, data);
        const act = activityStatus(s, c, globalDays);
        return { c, s, act };
      })
      // eng xavfli (ko'p kun jim qolgan) tepada
      .sort((a, b) => {
        const order = { alert: 0, never: 1, warning: 2, ok: 3 };
        const d = order[a.act.status.key] - order[b.act.status.key];
        if (d !== 0) return d;
        return (b.act.daysSince || 0) - (a.act.daysSince || 0);
      });
  }, [customers, data, globalDays]);

  // ── Statistika ────────────────────────────────────────────────────────────
  const counts = monitored.reduce((acc, m) => {
    acc[m.act.status.key] = (acc[m.act.status.key] || 0) + 1;
    return acc;
  }, {});
  const alertCount = (counts.alert || 0) + (counts.never || 0);

  const shown = monitored.filter(m => {
    if (filter === 'all')   return true;
    if (filter === 'alert') return m.act.status.key === 'alert' || m.act.status.key === 'never';
    return m.act.status.key === filter;
  });

  const saveDays = (id) => {
    setMonitor(id, true, Number(daysVal) || null);
    setEditDaysId(null);
    setDaysVal('');
  };

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>

      {/* ── TUSHUNTIRISH ──────────────────────────────────────────────────── */}
      <div style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: '#0d47a1', lineHeight: 1.6 }}>
        <strong>🔔 Mijoz nazorati nima?</strong> Doimiy mijozlaringizni "Nazoratga" qo'shing.
        Agar mijoz belgilangan muddat ichida (hozir: <b>{globalDays} kun</b>) yangi yuk olmasa —
        u <b style={{ color: '#c62828' }}>"JIM QOLDI"</b> deb belgilanadi. Demak u boshqa joydan olmoqda
        yoki to'lovni cho'zmoqda — darhol bog'laning.
      </div>

      {/* ── GLOBAL MUDDAT SOZLAMASI ───────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', padding: '10px 14px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6 }}>
        <span style={{ fontWeight: 'bold', color: '#333' }}>⏱ Umumiy muddat:</span>
        {PRESETS.map(p => (
          <button key={p.d} onClick={() => updateAppSettings({ monitorDays: p.d })} style={{
            padding: '5px 14px', cursor: 'pointer', borderRadius: 4, fontSize: 12, fontWeight: 'bold',
            border: `2px solid ${globalDays === p.d ? '#1565c0' : '#ccc'}`,
            background: globalDays === p.d ? '#1565c0' : '#fff',
            color: globalDays === p.d ? '#fff' : '#555',
          }}>{p.label}</button>
        ))}
        <span style={{ color: '#888', fontSize: 12, marginLeft: 4 }}>yoki</span>
        <input type="number" min={1} value={globalDays}
          onChange={e => updateAppSettings({ monitorDays: Math.max(1, Number(e.target.value) || 1) })}
          style={{ width: 70, padding: '5px 8px', border: '1px solid #aaa', borderRadius: 4, fontSize: 13 }} />
        <span style={{ color: '#555', fontSize: 12 }}>kun</span>
      </div>

      {/* ── STATISTIKA ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <StatBox label="Nazoratda" value={monitored.length} unit="mijoz" color="#283593" bg="#e8eaf6"
          onClick={() => setFilter('all')} active={filter === 'all'} />
        <StatBox label="⚠️ Jim qolgan" value={alertCount} unit="mijoz" color="#c62828" bg="#ffebee" bold
          onClick={() => setFilter('alert')} active={filter === 'alert'} />
        <StatBox label="⏳ Yaqinlashmoqda" value={counts.warning || 0} unit="mijoz" color="#ef6c00" bg="#fff3e0"
          onClick={() => setFilter('warning')} active={filter === 'warning'} />
        <StatBox label="✓ Faol" value={counts.ok || 0} unit="mijoz" color="#2e7d32" bg="#e8f5e9"
          onClick={() => setFilter('ok')} active={filter === 'ok'} />
      </div>

      {/* ── ASOSIY JADVAL ─────────────────────────────────────────────────── */}
      {monitored.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: '#888', background: '#fafafa', border: '1px dashed #ccc', borderRadius: 6, marginBottom: 16, lineHeight: 1.7 }}>
          Hali nazoratga mijoz qo'shilmagan.<br />
          <b>"Mijozlar bazasi"</b> bo'limiga o'ting va doimiy mijoz yonidagi <b>🔔</b> tugmasini bosing.
        </div>
      ) : (
        <table className="data-table" style={{ width: '100%', marginBottom: 20 }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th style={{ minWidth: 150 }}>Mijoz</th>
              <th style={{ width: 135 }}>Telefon</th>
              <th style={{ width: 150 }}>Holat</th>
              <th style={{ width: 95 }}>Oxirgi xarid</th>
              <th style={{ textAlign: 'center', width: 90 }}>Muddat</th>
              <th style={{ textAlign: 'right', width: 110 }}>Qolgan qarz</th>
              <th style={{ width: 90 }}>Amal</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m, i) => {
              const { c, s, act } = m;
              const st = act.status;
              return (
                <tr key={c.id} style={{ background: st.key === 'alert' || st.key === 'never' ? st.bg : (i % 2 === 0 ? '#fff' : '#fafafa') }}>
                  <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{i + 1}</td>
                  <td>
                    <button onClick={() => setCard(c.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#283593', fontWeight: 'bold', fontSize: 13, padding: 0, textDecoration: 'underline' }}>
                      {c.name}
                    </button>
                  </td>
                  <td>
                    {c.phone
                      ? <a href={`tel:${c.phone}`} style={{ color: '#1565c0', textDecoration: 'none', fontWeight: 'bold', fontSize: 12 }}>📞 {c.phone}</a>
                      : <span style={{ color: '#bbb' }}>—</span>}
                  </td>
                  <td>
                    <span style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}`, padding: '3px 9px', borderRadius: 12, fontSize: 12, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      {st.icon} {st.label}
                    </span>
                    {act.daysSince !== null && (
                      <div style={{ fontSize: 10.5, color: '#777', marginTop: 3 }}>
                        {act.daysSince} kun oldin ({act.threshold} kundan)
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 11.5, color: '#555' }}>{dateOf(act.lastSaleAt)}</td>
                  <td style={{ textAlign: 'center' }}>
                    {editDaysId === c.id ? (
                      <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                        <input type="number" min={1} value={daysVal} onChange={e => setDaysVal(e.target.value)} placeholder={String(globalDays)}
                          style={{ width: 48, padding: '2px 4px', fontSize: 12, border: '1px solid #aaa', borderRadius: 3 }} autoFocus />
                        <button onClick={() => saveDays(c.id)} style={miniGreen}>✓</button>
                        <button onClick={() => setEditDaysId(null)} style={miniRed}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditDaysId(c.id); setDaysVal(c.monitorDays || ''); }}
                        title="Bu mijoz uchun alohida muddat" style={{ cursor: 'pointer', background: c.monitorDays ? '#fff3e0' : '#f0f0f0', border: '1px solid #ccc', borderRadius: 10, padding: '2px 9px', fontSize: 11.5, color: '#555' }}>
                        {effectiveDays(c, globalDays)} kun{c.monitorDays ? ' ✎' : ''}
                      </button>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {s.qolganQarz > 0
                      ? <span style={{ background: '#c62828', color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' }}>{fmt(s.qolganQarz)}</span>
                      : <span style={{ color: '#bbb', fontSize: 11 }}>—</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setCard(c.name)} style={infoBtn}>👁</button>
                      <button onClick={() => setMonitor(c.id, false)} title="Nazoratdan olib tashlash" style={miniRed}>🔕</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {card && <CustomerCard name={card} onClose={() => setCard(null)} />}
    </div>
  );
}

// ─── Yordamchilar ─────────────────────────────────────────────────────────────
function StatBox({ label, value, unit, color, bg, bold, onClick, active }) {
  return (
    <div onClick={onClick} style={{
      padding: '8px 16px', background: bg, borderLeft: `4px solid ${color}`, borderRadius: 4, minWidth: 130,
      cursor: onClick ? 'pointer' : 'default', boxShadow: active ? `0 0 0 2px ${color}` : 'none',
    }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: bold ? 20 : 18, fontWeight: 'bold', color, fontFamily: 'monospace' }}>
        {value} <span style={{ fontSize: 12 }}>{unit}</span>
      </div>
    </div>
  );
}

const infoBtn   = { padding: '2px 7px', cursor: 'pointer', background: '#e8eaf6', border: '1px solid #3949ab', borderRadius: 3, color: '#283593', fontSize: 12 };
const miniGreen = { padding: '2px 6px', cursor: 'pointer', background: '#e8f5e9', border: '1px solid #4caf50', borderRadius: 3, color: '#2e7d32', fontSize: 11 };
const miniRed   = { padding: '2px 6px', cursor: 'pointer', background: '#ffebee', border: '1px solid #e53935', borderRadius: 3, color: '#c62828', fontSize: 12 };
