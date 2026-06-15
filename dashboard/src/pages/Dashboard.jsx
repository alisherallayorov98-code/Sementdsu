// ─────────────────────────────────────────────────────────────────────────────
// Bosh sahifa — dasturni ochganda bugungi muhim holat darrov ko'rinadi:
// pul qoldiqlari, sement, bizga qarz, kutilayotgan zakazlar, bugun/shu oy sotuvi,
// eng katta qarzdorlar. Ortiqcha narsasiz, bir qarashda.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import CustomerCard from '../components/CustomerCard';
import { customerSummary } from '../lib/customerSummary';
import { activityStatus } from '../lib/monitoring';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };

const today = new Date().toLocaleDateString('ru-RU');         // dd.mm.yyyy
const monthKey = today.slice(3);                              // mm.yyyy

export default function Dashboard() {
  const navigate = useNavigate();
  const data = useData();
  const {
    totalCashBalance, totalBankBalance, totalClickBalance, totalCementBalance,
    totalDebts, salesRows, soldRows, incomeRows, expenseRows, tgOrders, debtRows, currentUser,
    customers, appSettings, pendingRecvCount, pendingBankCount,
  } = data;
  const pendingTotal = (pendingRecvCount || 0) + (pendingBankCount || 0);

  const [card, setCard] = useState(null);

  // ── Mijoz nazorati: "jim qolgan" nazoratdagi mijozlar ────────────────────
  const globalDays = Number(appSettings?.monitorDays) || 14;
  const quietCustomers = customers
    .filter(c => c.monitored)
    .map(c => ({ c, act: activityStatus(customerSummary(c.name, data), c, globalDays) }))
    .filter(m => m.act.status.key === 'alert' || m.act.status.key === 'never')
    .sort((a, b) => (b.act.daysSince || 9999) - (a.act.daysSince || 9999));

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

      {/* 🟡 Tekshirilmagan (import qilingan) yozuvlar */}
      {pendingTotal > 0 && (
        <div style={{ marginBottom: 16, border: '2px solid #f9a825', borderRadius: 6, background: '#fffde7', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontWeight: 'bold', color: '#e65100' }}>
            🟡 {pendingTotal} ta tekshirilmagan yozuv bor — tasdiqlash kerak
            {pendingBankCount > 0 && ` · Bank o'tkazma: ${pendingBankCount}`}
            {pendingRecvCount > 0 && ` · Sement olish: ${pendingRecvCount}`}
          </span>
          <span style={{ display: 'flex', gap: 8 }}>
            {pendingBankCount > 0 && <button onClick={() => navigate('/income_bank')} style={{ cursor: 'pointer', background: '#0d47a1', color: '#fff', border: 'none', borderRadius: 4, padding: '5px 12px', fontWeight: 'bold' }}>Bank →</button>}
            {pendingRecvCount > 0 && <button onClick={() => navigate('/recv_tons')} style={{ cursor: 'pointer', background: '#e65100', color: '#fff', border: 'none', borderRadius: 4, padding: '5px 12px', fontWeight: 'bold' }}>Sement →</button>}
          </span>
        </div>
      )}

      {/* ⚠️ Mijoz nazorati ogohlantirishi (faqat jim qolganlar bo'lsa) */}
      {quietCustomers.length > 0 && (
        <div style={{ marginBottom: 18, border: '2px solid #c62828', borderRadius: 6, overflow: 'hidden' }}>
          <div onClick={() => navigate('/monitoring')} style={{ background: '#c62828', color: '#fff', padding: '8px 14px', fontWeight: 'bold', fontSize: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>⚠️ E'tibor! {quietCustomers.length} ta nazoratdagi mijoz yangi yuk olmayapti</span>
            <span style={{ fontSize: 12, opacity: 0.9, textDecoration: 'underline' }}>Batafsil →</span>
          </div>
          <table className="data-table" style={{ width: '100%' }}>
            <tbody>
              {quietCustomers.slice(0, 6).map(({ c, act }) => (
                <tr key={c.id} style={{ cursor: 'pointer', background: '#fff5f5' }} onClick={() => setCard(c.name)}>
                  <td style={{ fontWeight: 'bold' }}>👤 {c.name}</td>
                  <td style={{ fontSize: 12 }}>{c.phone ? `📞 ${c.phone}` : '—'}</td>
                  <td style={{ textAlign: 'right', color: '#c62828', fontWeight: 'bold', fontSize: 12 }}>
                    {act.daysSince !== null ? `${act.daysSince} kun yangi yuk yo'q` : "Hech xarid qilmagan"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
