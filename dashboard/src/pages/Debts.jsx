import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import NotifyModal from '../components/NotifyModal';
import CustomerCard from '../components/CustomerCard';
import DateRangeFilter from '../components/DateRangeFilter';
import { filterByRange } from '../lib/dateRange';
import Paginator from '../components/Paginator';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');

const TODAY_MS = Date.now();
const daysSince = (ts) => ts ? Math.floor((TODAY_MS - ts) / 86400000) : null;

// Qarz yoshi darajasi (kunlar bo'yicha)
function ageLevel(days) {
  if (days === null) return 0;
  if (days < 30)  return 0; // normal
  if (days < 60)  return 1; // sariq
  if (days < 90)  return 2; // to'q sariq
  return 3;                  // qizil
}
const AGE_COLORS = ['#fff', '#fff8e1', '#ffe0b2', '#ffebee'];
const AGE_BADGE  = [
  null,
  { text: '30+ kun', bg: '#ff9800', color: '#fff' },
  { text: '60+ kun', bg: '#e65100', color: '#fff' },
  { text: '90+ kun', bg: '#c62828', color: '#fff' },
];

// ─── ASOSIY KOMPONENT ────────────────────────────────────────────────────────
export default function Debts({ lang }) {
  const { debtRows, totalDebts, totalDebtsPaid, totalDebtsAll, customers } = useData();

  const [reminder, setReminder] = useState(null);
  const [search,   setSearch]   = useState('');
  const [range,    setRange]    = useState({ from: '', to: '' });
  const [filter,   setFilter]   = useState('all');
  const [page,     setPage]     = useState(1);
  const [history,  setHistory]  = useState(null); // customer nomi
  const [card,     setCard]     = useState(null);
  const PAGE_SIZE = 100;

  // ── Guruhlash ─────────────────────────────────────────────────────────────
  const allRows = filterByRange(debtRows, range)
    .filter(r => !search || r.customer.toLowerCase().includes(search.toLowerCase()))
    .slice().reverse();

  const groupMap = {};
  allRows.forEach(r => {
    if (!groupMap[r.customer])
      groupMap[r.customer] = { customer: r.customer, rows: [], totalAmount: 0, totalPaid: 0, allPayments: [] };
    const g = groupMap[r.customer];
    g.rows.push(r);
    g.totalAmount += Number(r.amount || 0);
    g.totalPaid   += Number(r.paid   || 0);
    (r.payments || []).forEach(p => g.allPayments.push({ ...p, _debtNote: r.note || '' }));
  });

  // Har guruh uchun qarz yoshi va oxirgi to'lov hisobi
  Object.values(groupMap).forEach(g => {
    const rem = g.totalAmount - g.totalPaid;
    // Oxirgi to'lov (barcha to'lovlar ichidan eng yangi)
    g.lastPaymentAt = g.allPayments.reduce((mx, p) => Math.max(mx, p.id || 0), 0) || null;
    g.lastPaymentStr = g.lastPaymentAt
      ? g.allPayments.find(p => p.id === g.lastPaymentAt)?.date || '—'
      : '—';
    // Eng eski to'lanmagan qarz sanasi
    const unpaidRows = g.rows.filter(r => Math.max(0, Number(r.amount) - Number(r.paid)) > 0);
    g.oldestUnpaidAt = unpaidRows.reduce((mn, r) => Math.min(mn, r.createdAt || r.id || TODAY_MS), TODAY_MS);
    g.debtDays = rem > 0 ? daysSince(g.oldestUnpaidAt) : null;
    g.level    = rem > 0 ? ageLevel(g.debtDays) : 0;
    g.remaining = rem;
  });

  const groupList = Object.values(groupMap).filter(g => {
    const rem = g.totalAmount - g.totalPaid;
    const st  = rem <= 0 ? 'full' : g.totalPaid > 0 ? 'partial' : 'none';
    return filter === 'all' || filter === st ||
      (filter === 'alert30' && g.debtDays >= 30) ||
      (filter === 'alert60' && g.debtDays >= 60) ||
      (filter === 'alert90' && g.debtDays >= 90);
  }).sort((a, b) => b.remaining - a.remaining);

  useEffect(() => { setPage(1); }, [search, filter, range.from, range.to]);
  const pagedGroups = groupList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Statistika ─────────────────────────────────────────────────────────────
  const allGroups = Object.values(groupMap);
  const cnt30  = allGroups.filter(g => g.debtDays >= 30).length;
  const cnt60  = allGroups.filter(g => g.debtDays >= 60).length;
  const cnt90  = allGroups.filter(g => g.debtDays >= 90).length;

  // ── Eslatma ───────────────────────────────────────────────────────────────
  const openReminder = (g) => {
    const phone = customers.find(c => c.name === g.customer)?.phone || '';
    const text  = `Hurmatli ${g.customer}! Sizning qoldiq qarzingiz ${fmt(g.remaining)} so'm. Iltimos, to'lovni amalga oshiring. Rahmat!`;
    setReminder({ name: g.customer, phone, text });
  };

  // ── Excel ─────────────────────────────────────────────────────────────────
  const exportRows = groupList.filter(g => g.remaining > 0).map(g => ({
    customer:      g.customer,
    totalAmount:   g.totalAmount,
    totalPaid:     g.totalPaid,
    remaining:     g.remaining,
    debtDays:      g.debtDays ?? 0,
    lastPayment:   g.lastPaymentStr,
    phone:         customers.find(c => c.name === g.customer)?.phone || '',
  }));

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>

      {/* ── STATISTIKA ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <StatCard label="Umumiy qarz"     value={fmt(totalDebtsAll)}  color="#333"    bg="#f5f5f5" />
        <StatCard label="Jami to'langan"  value={fmt(totalDebtsPaid)} color="#2e7d32" bg="#e8f5e9" />
        <StatCard label="Jami qolgan"     value={fmt(totalDebts)}     color="#c62828" bg="#ffebee" />
        {cnt30 > 0 && <StatCard label="30+ kun to'lamagan" value={`${cnt30} ta`} color="#e65100" bg="#fff3e0" unit="" onClick={() => setFilter('alert30')} active={filter==='alert30'} />}
        {cnt60 > 0 && <StatCard label="60+ kun to'lamagan" value={`${cnt60} ta`} color="#bf360c" bg="#fbe9e7" unit="" onClick={() => setFilter('alert60')} active={filter==='alert60'} />}
        {cnt90 > 0 && <StatCard label="90+ kun to'lamagan" value={`${cnt90} ta`} color="#b71c1c" bg="#ffebee" unit="" onClick={() => setFilter('alert90')} active={filter==='alert90'} />}
      </div>

      {/* ── SANA FILTRI ────────────────────────────────────────────────────── */}
      <DateRangeFilter value={range} onChange={setRange} color="#c62828" />

      {/* ── FILTER + QIDIRUV ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="Qidirish..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inp, width: 200, border: '1px solid #aaa' }}
        />
        {[
          { key: 'all',     lbl: 'Barchasi'         },
          { key: 'none',    lbl: "To'lanmagan"       },
          { key: 'partial', lbl: 'Qisman'            },
          { key: 'full',    lbl: "To'liq to'langan"  },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={filterBtn(filter === f.key)}>
            {f.lbl}
          </button>
        ))}
        <span style={{ marginLeft: 4, color: '#888', fontSize: 11 }}>({groupList.length} ta)</span>

        {/* Excel */}
        <button onClick={() => {
          const XLSX = window._XLSX;
          if (!XLSX) { alert('Excel yuklanmagan'); return; }
          const ws = XLSX.utils.json_to_sheet(exportRows.map(r => ({
            'Mijoz':             r.customer,
            'Telefon':           r.phone,
            'Qarz (so\'m)':      r.totalAmount,
            'To\'landi (so\'m)': r.totalPaid,
            'Qolgan (so\'m)':    r.remaining,
            'Qarz yoshi (kun)':  r.debtDays,
            'Oxirgi to\'lov':    r.lastPayment,
          })));
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Qarzdorlar');
          XLSX.writeFile(wb, `qarzdorlar-${new Date().toISOString().slice(0,10)}.xlsx`);
        }} style={{ padding: '4px 12px', cursor: 'pointer', background: '#1b5e20', color: '#fff', border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 'bold' }}>
          ⬇ Excel
        </button>
      </div>

      {/* ── TO'LOV TARIXI MODAL (mijoz bo'yicha) ─────────────────────────── */}
      {history && (() => {
        const g = groupMap[history];
        const payments = (g?.allPayments || []).slice().sort((a, b) => (b.id || 0) - (a.id || 0));
        return (
          <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
            onClick={() => setHistory(null)}>
            <div style={{ background:'#fff', padding:24, borderRadius:8, boxShadow:'0 4px 24px rgba(0,0,0,0.3)', minWidth:480, maxWidth:640, maxHeight:'80vh', overflowY:'auto' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontWeight:'bold', fontSize:15, marginBottom:4, color:'#003366' }}>
                To'lov tarixi: <span style={{ color:'#c62828' }}>{history}</span>
              </div>
              <div style={{ fontSize:12, color:'#888', marginBottom:14 }}>
                Jami qarz: <b>{fmt(g?.totalAmount)}</b> · To'landi: <b style={{ color:'#2e7d32' }}>{fmt(g?.totalPaid)}</b> · Qolgan: <b style={{ color:'#c62828' }}>{fmt(g?.remaining)}</b>
              </div>
              {payments.length === 0 ? (
                <p style={{ color:'#888', fontStyle:'italic' }}>Hech qanday to'lov yo'q.</p>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#003366', color:'#fff' }}>
                      <th style={th}>#</th>
                      <th style={th}>Sana</th>
                      <th style={{ ...th, textAlign:'right' }}>Summa</th>
                      <th style={th}>Kanal</th>
                      <th style={th}>Xodim</th>
                      <th style={th}>Izoh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p, i) => (
                      <tr key={p.id || i} style={{ background: i % 2 === 0 ? '#f9f9f9' : '#fff' }}>
                        <td style={td}>{i + 1}</td>
                        <td style={td}>{p.date || '—'}</td>
                        <td style={{ ...td, textAlign:'right', color:'#2e7d32', fontWeight:'bold' }}>{fmt(p.amount)}</td>
                        <td style={td}>{{ naqd:'💵 Naqd', bank:'🏦 Bank', click:'📱 Click' }[p.channel] || '💵'}</td>
                        <td style={td}>{p.worker || '—'}</td>
                        <td style={{ ...td, color:'#888', fontSize:11 }}>{p.note || p._debtNote || '—'}</td>
                      </tr>
                    ))}
                    <tr style={{ background:'#e8f5e9', fontWeight:'bold' }}>
                      <td colSpan={2} style={td}>Jami to'landi:</td>
                      <td style={{ ...td, textAlign:'right', color:'#2e7d32' }}>{fmt(payments.reduce((s,p) => s + Number(p.amount||0), 0))}</td>
                      <td colSpan={3} style={td}></td>
                    </tr>
                  </tbody>
                </table>
              )}
              <div style={{ marginTop:16, textAlign:'right' }}>
                <button onClick={() => setHistory(null)}
                  style={{ padding:'5px 20px', cursor:'pointer', background:'#003366', color:'#fff', border:'none', borderRadius:3 }}>
                  Yopish
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── ASOSIY JADVAL ─────────────────────────────────────────────────── */}
      {groupList.length === 0 ? (
        <p style={{ color:'#888', fontStyle:'italic', marginTop:20 }}>Yozuv topilmadi.</p>
      ) : (
        <>
        <table className="data-table" style={{ width:'100%' }}>
          <thead>
            <tr>
              <th style={{ width:30 }}>#</th>
              <th>Mijoz</th>
              <th style={{ textAlign:'right', width:130 }}>Qarz summasi</th>
              <th style={{ textAlign:'right', width:120 }}>To'landi</th>
              <th style={{ textAlign:'right', width:130, color:'#c62828' }}>Qolgan qarz</th>
              <th style={{ width:100 }}>Oxirgi to'lov</th>
              <th style={{ width:95 }}>Qarz yoshi</th>
              <th style={{ width:90 }}>Holat</th>
              <th style={{ width:100 }}>Amal</th>
            </tr>
          </thead>
          <tbody>
            {pagedGroups.map((g, i) => {
              const st  = g.remaining <= 0 ? 'full' : g.totalPaid > 0 ? 'partial' : 'none';
              const ss  = STATUS_STYLE[st];
              const lvl = g.level;
              const rowBg = g.remaining > 0 ? AGE_COLORS[lvl] : '#e6ffe6';
              const ageBadge = g.remaining > 0 ? AGE_BADGE[lvl] : null;
              const phone = customers.find(c => c.name === g.customer)?.phone || '';
              return (
                <tr key={g.customer} style={{ background: rowBg }}>
                  <td style={{ textAlign:'center', color:'#888', fontSize:11 }}>{(page-1)*PAGE_SIZE+i+1}</td>
                  <td>
                    <button onClick={() => setCard(g.customer)}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'#003366', fontWeight:'bold', fontSize:13, padding:0, textDecoration:'underline', textAlign:'left' }}>
                      {g.customer}
                    </button>
                    <span style={{ marginLeft:6, fontSize:11, color:'#888' }}>{g.rows.length} ta</span>
                    {phone && <span style={{ marginLeft:6, fontSize:11, color:'#555' }}>📞 {phone}</span>}
                  </td>
                  <td style={{ textAlign:'right', fontFamily:'monospace', fontWeight:'bold' }}>{fmt(g.totalAmount)}</td>
                  <td style={{ textAlign:'right', fontFamily:'monospace', color:'#2e7d32', fontWeight:'bold' }}>{fmt(g.totalPaid)}</td>
                  <td style={{ textAlign:'right', fontFamily:'monospace', color:'#c62828', fontWeight:'bold', fontSize:14 }}>{fmt(g.remaining)}</td>
                  <td style={{ fontSize:12, color: g.lastPaymentStr === '—' ? '#bbb' : '#333' }}>
                    {g.lastPaymentStr}
                  </td>
                  <td>
                    {g.remaining > 0 && g.debtDays !== null ? (
                      <span style={{ display:'inline-block', padding:'2px 8px', fontSize:11, borderRadius:10, fontWeight:'bold',
                        background: ageBadge ? ageBadge.bg : '#e0e0e0',
                        color: ageBadge ? ageBadge.color : '#555',
                      }}>
                        {g.debtDays} kun
                      </span>
                    ) : <span style={{ color:'#bbb', fontSize:11 }}>—</span>}
                  </td>
                  <td>
                    <span style={{ display:'inline-block', padding:'2px 8px', fontSize:11, border:`1px solid ${ss.border}`, borderRadius:10, color:ss.color, fontWeight:'bold' }}>
                      {ss.label[lang]}
                    </span>
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={() => setHistory(g.customer)}
                        title="To'lov tarixi"
                        style={actionBtn('#1565c0', '#e3f2fd')}>📋</button>
                      {phone && (
                        <button onClick={() => openReminder(g)}
                          title="Eslatma yuborish"
                          style={actionBtn('#6a1b9a', '#f3e5f5')}>📢</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr style={{ background:'#ffff00', fontWeight:'bold' }}>
              <td colSpan={2} style={{ paddingLeft:8 }}>Jami ({groupList.length} mijoz)</td>
              <td style={{ textAlign:'right', fontFamily:'monospace' }}>{fmt(groupList.reduce((s,g)=>s+g.totalAmount,0))}</td>
              <td style={{ textAlign:'right', fontFamily:'monospace', color:'#2e7d32' }}>{fmt(groupList.reduce((s,g)=>s+g.totalPaid,0))}</td>
              <td style={{ textAlign:'right', fontFamily:'monospace', color:'#c62828' }}>{fmt(groupList.reduce((s,g)=>s+Math.max(0,g.remaining),0))}</td>
              <td colSpan={4}></td>
            </tr>
          </tbody>
        </table>
        <Paginator total={groupList.length} page={page} setPage={setPage} pageSize={PAGE_SIZE} />
        </>
      )}

      {reminder && <NotifyModal name={reminder.name} phone={reminder.phone} defaultText={reminder.text} onClose={() => setReminder(null)} />}
      {card && <CustomerCard name={card} onClose={() => setCard(null)} />}
    </div>
  );
}

// ─── Yordamchi komponentlar ──────────────────────────────────────────────────
function StatCard({ label, value, color, bg, unit = 'so\'m', onClick, active }) {
  return (
    <div onClick={onClick} style={{
      padding:'8px 16px', background: active ? color : bg,
      borderLeft:`4px solid ${color}`, borderRadius:4, minWidth:140,
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ fontSize:11, color: active ? '#fff' : '#666', marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:'bold', color: active ? '#fff' : color, fontFamily:'monospace' }}>
        {value} {unit && <span style={{ fontSize:12 }}>{unit}</span>}
      </div>
    </div>
  );
}

const STATUS_STYLE = {
  full:    { bg:'#e6ffe6', border:'#4caf50', color:'#2e7d32', label:{ latn:"To'liq ✓", cyrl:'Тўлиқ ✓' } },
  partial: { bg:'#fff8e1', border:'#ff9800', color:'#e65100', label:{ latn:'Qisman',   cyrl:'Қисман'   } },
  none:    { bg:'#fff',    border:'#e53935', color:'#c62828', label:{ latn:"To'lanmagan", cyrl:'Тўланмаган' } },
};

const actionBtn = (color, bg) => ({
  padding:'2px 8px', cursor:'pointer', fontSize:13,
  background: bg, border:`1px solid ${color}`, borderRadius:3, color,
});

const inp = { padding:'4px 6px', fontSize:13, border:'1px solid #ccc', borderRadius:3 };

const filterBtn = (active) => ({
  padding:'3px 10px', cursor:'pointer', fontFamily:'Tahoma, sans-serif', fontSize:12,
  border: active ? '2px inset #ffffff' : '2px outset #ffffff',
  background: active ? '#003366' : '#f0f0f0',
  color: active ? '#fff' : '#333', fontWeight: active ? 'bold' : 'normal',
});

const th = { padding:'5px 8px', textAlign:'left', border:'1px solid #1a4080', fontWeight:'bold' };
const td = { padding:'5px 8px', border:'1px solid #ddd' };
