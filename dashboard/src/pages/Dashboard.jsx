// ─────────────────────────────────────────────────────────────────────────────
// Bosh sahifa — dasturni ochganda bugungi muhim holat darrov ko'rinadi:
// pul qoldiqlari, sement, bizga qarz, kutilayotgan zakazlar, bugun/shu oy sotuvi,
// eng katta qarzdorlar. Ortiqcha narsasiz, bir qarashda.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import CustomerCard from '../components/CustomerCard';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };

const today = new Date().toLocaleDateString('ru-RU');         // dd.mm.yyyy
const monthKey = today.slice(3);                              // mm.yyyy

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    totalCashBalance, totalBankBalance, totalClickBalance, totalCementBalance,
    totalDebts, salesRows, soldRows, incomeRows, expenseRows, tgOrders, debtRows, currentUser,
  } = useData();

  const [card, setCard] = useState(null);

  const allSales = [...salesRows, ...soldRows];
  const sumOf = (arr) => arr.reduce((s, r) => s + Number(r.tons || 0) * Number(r.pricePerTon || 0), 0);
  const tonsOf = (arr) => arr.reduce((s, r) => s + Number(r.tons || 0), 0);

  const todaySales = allSales.filter(r => r.date === today);
  const monthSales = allSales.filter(r => (r.date || '').endsWith(monthKey));

  const todayIncome  = incomeRows.filter(r => r.date === today).reduce((s, r) => s + Number(r.amount || 0), 0);
  const todayExpense = expenseRows.filter(r => r.date === today).reduce((s, r) => s + Number(r.amount || 0), 0);

  const pending = tgOrders.filter(o => o.status === 'kutilmoqda');
  const pendingTons = pending.reduce((s, o) => s + Number(o.tons || 0), 0);

  // Eng katta qarzdorlar
  const debtByCust = {};
  debtRows.forEach(r => {
    const q = Math.max(0, Number(r.amount || 0) - Number(r.paid || 0));
    if (q > 0) debtByCust[r.customer] = (debtByCust[r.customer] || 0) + q;
  });
  const topDebtors = Object.entries(debtByCust).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div style={{ fontFamily: 'Tahoma, Arial, sans-serif' }}>
      <div style={{ fontSize: 14, color: '#555', marginBottom: 14 }}>
        Xush kelibsiz, <strong>{currentUser?.name}</strong>! Bugun: <strong>{today}</strong>
      </div>

      {/* Asosiy qoldiqlar */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Stat label="Naqd kassa"        value={fmt(totalCashBalance)}   unit="so'm" color="#2e7d32" bg="#e8f5e9" onClick={() => navigate('/cash_bal')} />
        <Stat label="Bank"              value={fmt(totalBankBalance)}   unit="so'm" color="#1565c0" bg="#e3f2fd" onClick={() => navigate('/bank_bal')} />
        <Stat label="Click"             value={fmt(totalClickBalance)}  unit="so'm" color="#6a1b9a" bg="#f3e5f5" onClick={() => navigate('/click_bal')} />
        <Stat label="Sement qoldig'i"   value={fmtT(totalCementBalance)} unit="tn"  color={totalCementBalance >= 0 ? '#5d4037' : '#c62828'} bg="#efebe9" onClick={() => navigate('/cement_bal')} />
        <Stat label="Bizga jami qarz"   value={fmt(totalDebts)}         unit="so'm" color="#c62828" bg="#ffebee" onClick={() => navigate('/debts')} />
        <Stat label="Kutilayotgan zakaz" value={`${pending.length} ta`} unit={`${fmtT(pendingTons)} tn`} color="#ef6c00" bg="#fff3e0" onClick={() => navigate('/tg_order')} blink={pending.length > 0} />
      </div>

      {/* Bugun va shu oy */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <Panel title="📅 Bugun">
          <Line label="Sotuv (tonna)" value={`${fmtT(tonsOf(todaySales))} tn`} />
          <Line label="Sotuv (summa)" value={`${fmt(sumOf(todaySales))} so'm`} strong />
          <Line label="Naqd kirim"    value={`${fmt(todayIncome)} so'm`} color="#2e7d32" />
          <Line label="Naqd chiqim"   value={`${fmt(todayExpense)} so'm`} color="#c62828" />
        </Panel>

        <Panel title="🗓 Shu oy">
          <Line label="Sotuv (tonna)" value={`${fmtT(tonsOf(monthSales))} tn`} />
          <Line label="Sotuv (summa)" value={`${fmt(sumOf(monthSales))} so'm`} strong />
          <Line label="Sotuvlar soni" value={`${monthSales.length} ta`} />
        </Panel>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Eng katta qarzdorlar */}
        <div style={{ flex: 1, minWidth: 320 }}>
          <div style={{ background: '#c62828', color: '#fff', padding: '6px 12px', fontWeight: 'bold', fontSize: 13, borderRadius: '4px 4px 0 0' }}>
            Eng katta qarzdorlar
          </div>
          {topDebtors.length === 0 ? (
            <div style={{ padding: 14, color: '#888', fontSize: 13, border: '1px solid #eee' }}>Qarzdorlar yo'q. 👍</div>
          ) : (
            <table className="data-table" style={{ width: '100%' }}>
              <tbody>
                {topDebtors.map(([name, sum]) => (
                  <tr key={name} style={{ cursor: 'pointer' }} onClick={() => setCard(name)}>
                    <td style={{ fontWeight: 'bold' }}>👤 {name}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#c62828' }}>{fmt(sum)} so'm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Kutilayotgan zakazlar */}
        <div style={{ flex: 1, minWidth: 320 }}>
          <div style={{ background: '#ef6c00', color: '#fff', padding: '6px 12px', fontWeight: 'bold', fontSize: 13, borderRadius: '4px 4px 0 0' }}>
            Kutilayotgan zakazlar
          </div>
          {pending.length === 0 ? (
            <div style={{ padding: 14, color: '#888', fontSize: 13, border: '1px solid #eee' }}>Yangi zakaz yo'q.</div>
          ) : (
            <table className="data-table" style={{ width: '100%' }}>
              <tbody>
                {pending.slice(0, 8).map(o => (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/tg_order')}>
                    <td style={{ fontWeight: 'bold' }}>{o.customer}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtT(o.tons)} tn</td>
                    <td style={{ fontSize: 12, color: '#888' }}>{o.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {card && <CustomerCard name={card} onClose={() => setCard(null)} />}
    </div>
  );
}

function Stat({ label, value, unit, color, bg, onClick, blink }) {
  return (
    <div onClick={onClick} style={{
      flex: 1, minWidth: 175, padding: '12px 16px', background: bg, borderLeft: `5px solid ${color}`,
      borderRadius: 5, cursor: 'pointer', boxShadow: blink ? `0 0 0 2px ${color}` : 'none',
    }}>
      <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 'bold', color, fontFamily: 'monospace', lineHeight: 1.1 }}>
        {value} <span style={{ fontSize: 12, color: '#888' }}>{unit}</span>
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div style={{ flex: 1, minWidth: 280, border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ background: '#37474f', color: '#fff', padding: '6px 12px', fontWeight: 'bold', fontSize: 13 }}>{title}</div>
      <div style={{ padding: '8px 12px' }}>{children}</div>
    </div>
  );
}

function Line({ label, value, color, strong }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed #eee' }}>
      <span style={{ fontSize: 13, color: '#555' }}>{label}</span>
      <span style={{ fontSize: strong ? 15 : 13, fontWeight: 'bold', color: color || '#000', fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}
