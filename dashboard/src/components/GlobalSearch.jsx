// ─────────────────────────────────────────────────────────────────────────────
// Umumiy qidiruv — bitta oynadan butun dastur bo'ylab izlaydi:
//   mijoz ismi / telefon / manzil, qarz/avans/sotuv izohlari va summalari,
//   telegram zakazlari, olingan tonna (mashina raqami).
// Mijoz topilsa — uning to'liq kartochkasi (CustomerCard) ochiladi.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import CustomerCard from './CustomerCard';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');

export default function GlobalSearch() {
  const navigate = useNavigate();
  const {
    customers, debtRows, advanceRows, salesRows, soldRows, tgOrders, recvRows,
  } = useData();

  const [q, setQ]         = useState('');
  const [open, setOpen]   = useState(false);
  const [card, setCard]   = useState(null); // tanlangan mijoz nomi

  const query = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (query.length < 2) return [];
    const has = (v) => String(v || '').toLowerCase().includes(query);

    // 1) Barcha mijoz nomlarini yig'ish (mijozlar bazasi + tranzaksiyalardan)
    const names = new Set(customers.map(c => c.name));
    [debtRows, advanceRows, salesRows, soldRows, tgOrders].forEach(arr =>
      arr.forEach(r => { if (r.customer) names.add(r.customer); })
    );

    const custResults = [];
    for (const name of names) {
      const c = customers.find(x => x.name === name);
      // Nom/telefon/manzil mosmi?
      let match = has(name) || has(c?.phone) || has(c?.address);
      // Yoki shu mijozning qarz/avans/sotuv izohi yoki summasi mosmi?
      if (!match) {
        match =
          debtRows.some(r => r.customer === name && (has(r.note) || has(r.amount))) ||
          advanceRows.some(r => r.customer === name && (has(r.note) || has(r.amount))) ||
          [...salesRows, ...soldRows].some(r => r.customer === name && (has(r.note) || has(r.tons) || has(r.pricePerTon))) ||
          tgOrders.some(o => o.customer === name && (has(o.note) || has(o.tons)));
      }
      if (match) {
        const qoldiqQarz = debtRows.filter(r => r.customer === name)
          .reduce((s, r) => s + Math.max(0, Number(r.amount || 0) - Number(r.paid || 0)), 0);
        custResults.push({ name, phone: c?.phone, qoldiqQarz, registered: !!c });
      }
    }
    custResults.sort((a, b) => b.qoldiqQarz - a.qoldiqQarz);

    // 2) Olingan tonna — mashina raqami / zavod bo'yicha
    const recvResults = recvRows
      .filter(r => has(r.vehicleNo) || has(r.source) || has(r.brand))
      .slice(0, 5)
      .map(r => ({ vehicleNo: r.vehicleNo, source: r.source, brand: r.brand, tons: r.tons, date: r.date }));

    return { custResults: custResults.slice(0, 12), recvResults };
  }, [query, customers, debtRows, advanceRows, salesRows, soldRows, tgOrders, recvRows]);

  const hasResults = results.custResults?.length || results.recvResults?.length;

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="🔍 Qidiruv: mijoz, telefon, mashina, summa..."
        style={{ width: 320, padding: '7px 12px', fontSize: 13, border: 'none', borderRadius: 16, outline: 'none', fontFamily: 'Tahoma, sans-serif' }}
      />

      {open && query.length >= 2 && (
        <div style={{
          position: 'absolute', top: 38, left: 0, width: 420, maxHeight: 420, overflowY: 'auto',
          background: '#fff', borderRadius: 6, boxShadow: '0 6px 24px rgba(0,0,0,0.25)', zIndex: 900, color: '#000',
        }}>
          {!hasResults && (
            <div style={{ padding: 14, color: '#888', fontSize: 13, fontFamily: 'Tahoma, sans-serif' }}>Hech narsa topilmadi.</div>
          )}

          {results.custResults?.length > 0 && (
            <div>
              <Group>Mijozlar</Group>
              {results.custResults.map(c => (
                <button
                  key={c.name}
                  onMouseDown={() => { setCard(c.name); setOpen(false); }}
                  style={rowStyle}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 'bold' }}>👤 {c.name}</span>
                    {!c.registered && <span style={{ fontSize: 10, color: '#999', border: '1px solid #ddd', borderRadius: 3, padding: '0 4px' }}>bazada yo'q</span>}
                    {c.phone && <span style={{ fontSize: 11, color: '#888' }}>📞 {c.phone}</span>}
                  </span>
                  {c.qoldiqQarz > 0 && <span style={{ fontSize: 12, color: '#c62828', fontWeight: 'bold', fontFamily: 'monospace' }}>{fmt(c.qoldiqQarz)} so'm qarz</span>}
                </button>
              ))}
            </div>
          )}

          {results.recvResults?.length > 0 && (
            <div>
              <Group>Olingan tonna (mashinalar)</Group>
              {results.recvResults.map((r, i) => (
                <button
                  key={i}
                  onMouseDown={() => { navigate('/recv_tons'); setOpen(false); setQ(''); }}
                  style={rowStyle}
                >
                  <span><span style={{ fontWeight: 'bold' }}>🚛 {r.vehicleNo || '—'}</span> <span style={{ fontSize: 11, color: '#888' }}>{r.source} {r.brand}</span></span>
                  <span style={{ fontSize: 12, color: '#555', fontFamily: 'monospace' }}>{r.tons} tn · {r.date}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {card && <CustomerCard name={card} onClose={() => setCard(null)} />}
    </div>
  );
}

const rowStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
  width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderBottom: '1px solid #f0f0f0',
  background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'Tahoma, sans-serif',
};

function Group({ children }) {
  return <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 'bold', color: '#90a4ae', background: '#fafafa', textTransform: 'uppercase' }}>{children}</div>;
}
