// ─────────────────────────────────────────────────────────────────────────────
// Mijoz kartochkasi (Customer 360) — bitta mijozning HAMMASI bir ekranda:
// qoldiq qarz, qoldiq avans, jami xarid (tonna/summa), sotuvlar, qarz to'lovlari,
// telegram zakazlari. Modal oyna ko'rinishida.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useData } from '../context/DataContext';
import { customerSummary } from '../lib/customerSummary';
import { activityStatus } from '../lib/monitoring';
import NotifyModal from './NotifyModal';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };

export default function CustomerCard({ name, onClose }) {
  const data = useData();
  const { customers, appSettings, setMonitor, tgChatIdFor, tgLocationFor, updateCustomer } = data;
  const cust = customers.find(c => c.name === name);
  const s = customerSummary(name, data);
  const act = cust?.monitored ? activityStatus(s, cust, Number(appSettings?.monitorDays) || 14) : null;
  const tgLinked = !!(cust?.telegramChatId) || (cust?.phone ? !!tgChatIdFor(cust.phone) : false);
  // Effektiv joylashuv: qo'lda belgilangan ustun, bo'lmasa botdan
  const loc = (cust?.lat != null && cust?.lon != null)
    ? { lat: cust.lat, lon: cust.lon }
    : (cust?.phone ? tgLocationFor(cust.phone) : null);

  const setMyLocation = () => {
    if (!cust) return;
    if (!navigator.geolocation) { alert("Brauzer joylashuvni qo'llab-quvvatlamaydi."); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { updateCustomer(cust.id, { lat: pos.coords.latitude, lon: pos.coords.longitude }); alert("📍 Joylashuv saqlandi (shu qurilma)."); },
      () => alert("Joylashuvni olishning iloji bo'lmadi. Ruxsat bering yoki GPS yoqing."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const [notify, setNotify] = useState(false);
  const [tgInput, setTgInput] = useState(false);
  const [tgIdVal, setTgIdVal] = useState('');
  const defaultMsg = s.qolganQarz > 0
    ? `Hurmatli ${name}! Sizning qoldiq qarzingiz: ${fmt(s.qolganQarz)} so'm. To'lov uchun rahmat.`
    : `Hurmatli ${name}!`;

  const box = (label, value, color, bg) => (
    <div style={{ flex: 1, minWidth: 150, padding: '10px 14px', background: bg, borderLeft: `4px solid ${color}`, borderRadius: 4 }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 'bold', color, fontFamily: 'monospace' }}>{value}</div>
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 16px', overflowY: 'auto' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 760, boxShadow: '0 8px 30px rgba(0,0,0,0.3)', fontFamily: 'Tahoma, Arial, sans-serif' }}
      >
        {/* Sarlavha */}
        <div style={{ background: '#003366', color: '#fff', padding: '12px 18px', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 'bold' }}>
              👤 {name}
              {cust && (
                <button
                  onClick={() => setMonitor(cust.id, !cust.monitored)}
                  title={cust.monitored ? 'Nazoratdan olib tashlash' : "Nazoratga qo'shish"}
                  style={{ marginLeft: 10, cursor: 'pointer', background: cust.monitored ? '#ef6c00' : 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: 12 }}>
                  🔔 {cust.monitored ? 'Nazoratda' : 'Nazoratga'}
                </button>
              )}
            </div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              {cust?.phone ? `📞 ${cust.phone}` : 'Telefon yo\'q'}{cust?.address ? `  •  📍 ${cust.address}` : ''}
              {tgLinked
                ? <span style={{ marginLeft: 8, background: '#2e7d32', padding: '1px 7px', borderRadius: 8, fontSize: 10, cursor:'pointer' }}
                    onClick={() => { setTgIdVal(cust.telegramChatId || ''); setTgInput(true); }}
                    title="Telegram ID ni o'zgartirish">
                    📱 Telegram ulangan ✎
                  </span>
                : <span
                    onClick={() => { setTgIdVal(''); setTgInput(true); }}
                    style={{ marginLeft: 8, background: 'rgba(255,165,0,0.5)', padding: '1px 7px', borderRadius: 8, fontSize: 10, cursor:'pointer' }}
                    title="Telegram ID kiritish">
                    🔗 Telegram ulash
                  </span>}
            </div>
            <div style={{ fontSize: 12, marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {loc
                ? <a href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lon}`} target="_blank" rel="noreferrer"
                    style={{ background: '#1565c0', color: '#fff', padding: '3px 10px', borderRadius: 12, textDecoration: 'none', fontWeight: 'bold' }}>📍 Xaritada ochish</a>
                : <span style={{ opacity: 0.8 }}>📍 Joylashuv belgilanmagan</span>}
              {cust && <button onClick={setMyLocation} title="Shu qurilmaning joriy joylashuvini saqlash"
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 12, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}>
                {loc ? '🔄 Joylashuvni yangilash' : '➕ Joylashuvni belgilash'}
              </button>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {cust?.phone && (
              <button onClick={() => setNotify(true)} title="Xabar yuborish (Telegram/SMS)"
                style={{ background: '#2e7d32', border: 'none', color: '#fff', fontSize: 12, padding: '0 12px', borderRadius: 16, cursor: 'pointer', fontWeight: 'bold' }}>✉️ Xabar</button>
            )}
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 20, width: 32, height: 32, borderRadius: 16, cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        {notify && <NotifyModal name={name} phone={cust?.phone || ''} defaultText={defaultMsg} onClose={() => setNotify(false)} />}

        {/* Telegram ID ulash modali */}
        {tgInput && (
          <div style={{ background:'#fff3cd', border:'1px solid #ffc107', padding:'12px 16px', display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ fontSize:13, fontWeight:'bold', color:'#856404' }}>🆔 Telegram ID ulash</div>
            <div style={{ fontSize:12, color:'#555' }}>
              Mijozdan <b>@sementchiuzbot</b> ga kirib <b>/myid</b> buyrug'ini yuborishini so'rang — bot unga raqam ko'rsatadi. O'sha raqamni shu yerga kiriting:
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input
                type="text" placeholder="Masalan: 123456789"
                value={tgIdVal} onChange={e => setTgIdVal(e.target.value)}
                style={{ padding:'6px 10px', fontSize:14, border:'1px solid #ccc', borderRadius:4, width:200, fontFamily:'monospace' }}
                autoFocus
              />
              <button
                onClick={() => {
                  const id = tgIdVal.trim();
                  if (!id) return;
                  updateCustomer(cust.id, { telegramChatId: id });
                  setTgInput(false);
                }}
                style={{ padding:'6px 14px', background:'#2e7d32', color:'#fff', border:'none', borderRadius:4, cursor:'pointer', fontWeight:'bold' }}>
                ✓ Saqlash
              </button>
              {cust?.telegramChatId && (
                <button
                  onClick={() => { updateCustomer(cust.id, { telegramChatId: '' }); setTgInput(false); }}
                  style={{ padding:'6px 10px', background:'#ffebee', color:'#c62828', border:'1px solid #ef9a9a', borderRadius:4, cursor:'pointer' }}>
                  ✕ O'chirish
                </button>
              )}
              <button onClick={() => setTgInput(false)}
                style={{ padding:'6px 10px', background:'#f0f0f0', border:'1px solid #ccc', borderRadius:4, cursor:'pointer' }}>
                Bekor
              </button>
            </div>
          </div>
        )}

        {/* Nazorat holati (faqat nazoratdagi mijoz uchun) */}
        {act && (
          <div style={{ background: act.status.bg, color: act.status.color, padding: '7px 18px', fontSize: 13, fontWeight: 'bold', borderBottom: `1px solid ${act.status.color}` }}>
            {act.status.icon} {act.status.label}
            {act.daysSince !== null
              ? ` — oxirgi xaridi ${act.daysSince} kun oldin (nazorat muddati: ${act.threshold} kun)`
              : ' — hali xarid qilmagan'}
          </div>
        )}

        <div style={{ padding: 18 }}>
          {/* Asosiy raqamlar */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
            {box("Qoldiq qarz (bizga)", fmt(s.qolganQarz) + " so'm", '#c62828', '#ffebee')}
            {box("Qoldiq avans",        fmt(s.qolganAvans) + " so'm", '#1565c0', '#e3f2fd')}
            {box("Jami xarid",          fmt(s.totalXarid) + " so'm", '#2e7d32', '#e8f5e9')}
            {box("Jami tonna",          fmtT(s.totalTon) + " tn",    '#5d4037', '#efebe9')}
          </div>

          {/* Sotuvlar */}
          <Section title={`Xaridlar / Sotuvlar (${s.sales.length})`}>
            {s.sales.length === 0 ? <Empty /> : (
              <table className="data-table" style={{ width: '100%' }}>
                <thead><tr><th>Sana</th><th style={{ textAlign: 'right' }}>Tonna</th><th style={{ textAlign: 'right' }}>Narx/tn</th><th style={{ textAlign: 'right' }}>Summa</th><th>Izoh</th></tr></thead>
                <tbody>
                  {[...s.sales].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(r => (
                    <tr key={r.id}>
                      <td style={{ fontSize: 12 }}>{r.date}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtT(r.tons)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.pricePerTon)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{fmt(Number(r.tons || 0) * Number(r.pricePerTon || 0))}</td>
                      <td style={{ fontSize: 12, color: '#555' }}>{r.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Qarzlar */}
          <Section title={`Qarzlar (${s.debts.length})`}>
            {s.debts.length === 0 ? <Empty /> : (
              <table className="data-table" style={{ width: '100%' }}>
                <thead><tr><th>Sana</th><th style={{ textAlign: 'right' }}>Qarz</th><th style={{ textAlign: 'right' }}>To'landi</th><th style={{ textAlign: 'right' }}>Qoldiq</th><th>Izoh</th></tr></thead>
                <tbody>
                  {[...s.debts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(r => {
                    const qoldiq = Math.max(0, Number(r.amount || 0) - Number(r.paid || 0));
                    return (
                      <tr key={r.id}>
                        <td style={{ fontSize: 12 }}>{r.date}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.amount)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#2e7d32' }}>{fmt(r.paid)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: qoldiq > 0 ? '#c62828' : '#888' }}>{fmt(qoldiq)}</td>
                        <td style={{ fontSize: 12, color: '#555' }}>{r.note || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Section>

          {/* Avanslar */}
          <Section title={`Avanslar (${s.advs.length})`}>
            {s.advs.length === 0 ? <Empty /> : (
              <table className="data-table" style={{ width: '100%' }}>
                <thead><tr><th>Sana</th><th style={{ textAlign: 'right' }}>Avans</th><th style={{ textAlign: 'right' }}>Ishlatildi</th><th style={{ textAlign: 'right' }}>Qoldiq</th><th>Izoh</th></tr></thead>
                <tbody>
                  {[...s.advs].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(r => {
                    const qoldiq = Math.max(0, Number(r.amount || 0) - Number(r.used || 0));
                    return (
                      <tr key={r.id}>
                        <td style={{ fontSize: 12 }}>{r.date}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.amount)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#ef6c00' }}>{fmt(r.used)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#1565c0' }}>{fmt(qoldiq)}</td>
                        <td style={{ fontSize: 12, color: '#555' }}>{r.note || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Section>

          {/* Telegram zakazlari */}
          {s.orders.length > 0 && (
            <Section title={`Telegram zakazlari (${s.orders.length})`}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead><tr><th>Sana</th><th style={{ textAlign: 'right' }}>Tonna</th><th>Holati</th><th>Izoh</th></tr></thead>
                <tbody>
                  {[...s.orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(o => (
                    <tr key={o.id}>
                      <td style={{ fontSize: 12 }}>{o.date}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtT(o.tons)}</td>
                      <td style={{ fontSize: 12 }}>{o.status}</td>
                      <td style={{ fontSize: 12, color: '#555' }}>{o.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ background: '#eceff1', padding: '5px 10px', fontWeight: 'bold', fontSize: 13, color: '#37474f', borderRadius: 3, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

function Empty() {
  return <p style={{ color: '#999', fontStyle: 'italic', fontSize: 13, margin: '4px 0 0 4px' }}>Ma'lumot yo'q.</p>;
}
