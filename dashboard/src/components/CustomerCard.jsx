// ─────────────────────────────────────────────────────────────────────────────
// Mijoz kartochkasi (Customer 360) — bitta mijozning HAMMASI bir ekranda:
// qoldiq qarz, qoldiq avans, jami xarid (tonna/summa), sotuvlar, qarz to'lovlari,
// telegram zakazlari. Modal oyna ko'rinishida.
// ─────────────────────────────────────────────────────────────────────────────
import { useData } from '../context/DataContext';
import { customerSummary } from '../lib/customerSummary';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };

export default function CustomerCard({ name, onClose }) {
  const data = useData();
  const { customers } = data;
  const cust = customers.find(c => c.name === name);
  const s = customerSummary(name, data);

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
            <div style={{ fontSize: 18, fontWeight: 'bold' }}>👤 {name}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              {cust?.phone ? `📞 ${cust.phone}` : 'Telefon yo\'q'}{cust?.address ? `  •  📍 ${cust.address}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 20, width: 32, height: 32, borderRadius: 16, cursor: 'pointer' }}>✕</button>
        </div>

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
