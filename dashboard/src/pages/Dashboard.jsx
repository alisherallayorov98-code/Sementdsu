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
    cashRows, bankRows, clickRows,
    advanceRows, totalAdvances, totalAdvancesUsed, totalAdvancesAll,
    bankIncomeRows, clickIncomeRows, bankExpenseRows, clickExpenseRows,
    totalSoldTons,
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

  const kassirTodayIn  = (arr) => arr.filter(r => r.date === today && !r.auto && Number(r.amount) > 0).reduce((s, r) => s + Number(r.amount), 0);
  const kassirTodayOut = (arr) => arr.filter(r => r.date === today && !r.auto && Number(r.amount) < 0).reduce((s, r) => s - Number(r.amount), 0);
  const todayIncome  = incomeRows.filter(r => r.date === today).reduce((s, r) => s + Number(r.amount || 0), 0) + kassirTodayIn(cashRows) + kassirTodayIn(bankRows) + kassirTodayIn(clickRows);
  const todayExpense = expenseRows.filter(r => r.date === today).reduce((s, r) => s + Number(r.amount || 0), 0) + kassirTodayOut(cashRows) + kassirTodayOut(bankRows) + kassirTodayOut(clickRows);

  const pending = tgOrders.filter(o => o.status === 'kutilmoqda');
  const pendingTons = pending.reduce((s, o) => s + Number(o.tons || 0), 0);

  // Kirim/chiqim jami (barcha kanallar)
  const sumArr = (arr, positive = true) => (arr || []).reduce((s, r) => {
    const v = Number(r.amount || 0);
    return positive ? s + (v > 0 ? v : 0) : s + (v < 0 ? -v : 0);
  }, 0);
  const totalIncome  = sumArr(incomeRows) + sumArr(clickIncomeRows) + sumArr(bankIncomeRows)
    + sumArr(cashRows) + sumArr(bankRows) + sumArr(clickRows);
  const totalExpense = sumArr(expenseRows) + sumArr(bankExpenseRows || []) + sumArr(clickExpenseRows || [])
    + (cashRows || []).filter(r => !r.auto && Number(r.amount) < 0).reduce((s, r) => s - Number(r.amount), 0)
    + (bankRows || []).filter(r => !r.auto && Number(r.amount) < 0).reduce((s, r) => s - Number(r.amount), 0)
    + (clickRows || []).filter(r => !r.auto && Number(r.amount) < 0).reduce((s, r) => s - Number(r.amount), 0);

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
        <Stat label="Naqd kassa"        value={fmt(totalCashBalance)}   unit="so'm" onClick={() => navigate('/gen_info?tab=cash')} />
        <Stat label="Bank"              value={fmt(totalBankBalance)}   unit="so'm" onClick={() => navigate('/gen_info?tab=bank')} />
        <Stat label="Click"             value={fmt(totalClickBalance)}  unit="so'm" onClick={() => navigate('/gen_info?tab=click')} />
        <Stat label="Sement qoldig'i"   value={fmtT(totalCementBalance)} unit="tn"  onClick={() => navigate('/gen_info?tab=cement')} />
        <Stat label="Bizga jami qarz"   value={fmt(totalDebts)}         unit="so'm" onClick={() => navigate('/debts')} />
        <Stat label="Kutilayotgan zakaz" value={`${pending.length} ta`} unit={`${fmtT(pendingTons)} tn`} onClick={() => navigate('/tg_order')} blink={pending.length > 0} />
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
          <Line label="Naqd kirim"    value={`${fmt(todayIncome)} so'm`} />
          <Line label="Naqd chiqim"   value={`${fmt(todayExpense)} so'm`} />
        </Panel>

        <Panel title="🗓 Shu oy">
          <Line label="Sotuv (tonna)" value={`${fmtT(tonsOf(monthSales))} tn`} />
          <Line label="Sotuv (summa)" value={`${fmt(sumOf(monthSales))} so'm`} strong />
          <Line label="Sotuvlar soni" value={`${monthSales.length} ta`} />
        </Panel>
      </div>

      {/* Sotilgan tonna (eski) */}
      {soldRows.length > 0 && (() => {
        const byChannel = soldRows.reduce((acc, r) => {
          const ch = r.paymentChannel || 'noma\'lum';
          acc[ch] = (acc[ch] || 0) + Number(r.tons || 0);
          return acc;
        }, {});
        const todaySold = soldRows.filter(r => r.date === today).reduce((s, r) => s + Number(r.tons || 0), 0);
        const monthSold = soldRows.filter(r => (r.date || '').endsWith(monthKey)).reduce((s, r) => s + Number(r.tons || 0), 0);
        return (
          <div style={{ marginBottom: 18 }}>
            <div style={{ background: '#003366', color: '#fff', padding: '6px 12px', fontWeight: 'bold', fontSize: 13, borderRadius: '4px 4px 0 0' }}>
              🏭 Sotilgan tonna (eski)
            </div>
            <div style={{ border: '1px solid #e0e0e0', borderTop: 'none', borderRadius: '0 0 4px 4px', padding: '10px 12px' }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                <MiniStat label="Jami sotilgan"  value={`${fmtT(totalSoldTons)} tn`}  color="#003366" />
                <MiniStat label="Bugun"           value={`${fmtT(todaySold)} tn`}       color="#555"    />
                <MiniStat label="Shu oy"          value={`${fmtT(monthSold)} tn`}       color="#555"    />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(byChannel).map(([ch, t]) => (
                  <span key={ch} style={{ fontSize: 12, padding: '2px 10px', background: '#f0f4ff', border: '1px solid #b0c4de', borderRadius: 12 }}>
                    {ch}: <strong>{fmtT(t)} tn</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Kirim / Chiqim umumiy */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 280, border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ background: '#1b5e20', color: '#fff', padding: '6px 12px', fontWeight: 'bold', fontSize: 13 }}>
            💰 Kirim (jami)
          </div>
          <div style={{ padding: '8px 12px' }}>
            <Line label="Naqd kirim"    value={`${fmt(sumArr(incomeRows))} so'm`} />
            <Line label="Bank kirim"    value={`${fmt(sumArr(bankIncomeRows))} so'm`} />
            <Line label="Click kirim"   value={`${fmt(sumArr(clickIncomeRows))} so'm`} />
            <Line label="Kassir (naqd)" value={`${fmt(sumArr(cashRows))} so'm`} />
            <Line label="Jami kirim"    value={`${fmt(totalIncome)} so'm`} color="#1b5e20" strong />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 280, border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ background: '#b71c1c', color: '#fff', padding: '6px 12px', fontWeight: 'bold', fontSize: 13 }}>
            📤 Chiqim (jami)
          </div>
          <div style={{ padding: '8px 12px' }}>
            <Line label="Naqd chiqim"   value={`${fmt(sumArr(expenseRows))} so'm`} />
            <Line label="Bank chiqim"   value={`${fmt(sumArr(bankExpenseRows || []))} so'm`} />
            <Line label="Click chiqim"  value={`${fmt(sumArr(clickExpenseRows || []))} so'm`} />
            <Line label="Kassir chiqim" value={`${fmt((cashRows||[]).filter(r=>!r.auto&&Number(r.amount)<0).reduce((s,r)=>s-Number(r.amount),0))} so'm`} />
            <Line label="Jami chiqim"   value={`${fmt(totalExpense)} so'm`} color="#b71c1c" strong />
          </div>
        </div>
      </div>

      {/* Avanslar holati */}
      {totalAdvancesAll > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ background: '#003366', color: '#fff', padding: '6px 12px', fontWeight: 'bold', fontSize: 13, borderRadius: '4px 4px 0 0' }}>
            Avanslar holati
          </div>
          <div style={{ border: '1px solid #e0e0e0', borderTop: 'none', borderRadius: '0 0 4px 4px', padding: '10px 12px' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <MiniStat label="Jami avans"      value={`${fmt(totalAdvancesAll)} so'm`}  color="#333"    />
              <MiniStat label="Ishlatildi"       value={`${fmt(totalAdvancesUsed)} so'm`} color="#e65100" />
              <MiniStat label="Qolgan avans"     value={`${fmt(totalAdvances)} so'm`}     color="#2e7d32" />
            </div>
            {(() => {
              const active = advanceRows.filter(r => Math.max(0, Number(r.amount) - Number(r.used)) > 0)
                .sort((a, b) => (Number(b.amount) - Number(b.used)) - (Number(a.amount) - Number(a.used)))
                .slice(0, 5);
              if (!active.length) return null;
              return (
                <table className="data-table" style={{ width: '100%', maxWidth: 600 }}>
                  <thead>
                    <tr>
                      <th>Mijoz</th>
                      <th style={{ textAlign: 'right' }}>Avans</th>
                      <th style={{ textAlign: 'right', color: '#2e7d32' }}>Qolgan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map(r => (
                      <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setCard(r.customer)}>
                        <td style={{ fontWeight: 'bold' }}>👤 {r.customer}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.amount)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#2e7d32' }}>
                          {fmt(Math.max(0, Number(r.amount) - Number(r.used)))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Eng katta qarzdorlar */}
        <div style={{ flex: 1, minWidth: 320 }}>
          <div style={{ background: '#003366', color: '#fff', padding: '6px 12px', fontWeight: 'bold', fontSize: 13, borderRadius: '4px 4px 0 0' }}>
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
          <div style={{ background: '#003366', color: '#fff', padding: '6px 12px', fontWeight: 'bold', fontSize: 13, borderRadius: '4px 4px 0 0' }}>
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

// Bir xil klassik ko'rinish: hamma kartochka bitta korporativ ko'k (#003366) + neytral kulrang
function Stat({ label, value, unit, onClick, blink }) {
  const color = '#003366';
  return (
    <div onClick={onClick} style={{
      flex: 1, minWidth: 175, padding: '12px 16px', background: '#f0f0f0', borderLeft: `5px solid ${color}`,
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
      <div style={{ background: '#003366', color: '#fff', padding: '6px 12px', fontWeight: 'bold', fontSize: 13 }}>{title}</div>
      <div style={{ padding: '8px 12px' }}>{children}</div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ padding: '6px 14px', borderLeft: `4px solid ${color}`, background: '#f9f9f9', borderRadius: 3, minWidth: 160 }}>
      <div style={{ fontSize: 11, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 'bold', color, fontFamily: 'monospace' }}>{value}</div>
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
