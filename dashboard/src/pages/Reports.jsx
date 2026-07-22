import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { buildReport, parseDate } from '../lib/reportData';
import { generateReportExcel } from '../lib/reportExcel';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };

// Sana yordamchilari
const iso     = (d) => d.toISOString().slice(0, 10);
const todayISO = () => iso(new Date());
const isoToDM = (s) => { const [y, m, d] = s.split('-'); return `${d}.${m}.${y}`; };

function presetRange(key) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const start = (dt) => iso(dt);
  switch (key) {
    case 'today':     return [start(new Date(y, m, d)), todayISO()];
    case 'yesterday': { const yd = new Date(y, m, d - 1); return [iso(yd), iso(yd)]; }
    case 'week':      { const wd = (now.getDay() + 6) % 7; return [iso(new Date(y, m, d - wd)), todayISO()]; }
    case 'month':     return [iso(new Date(y, m, 1)), todayISO()];
    case 'lastmonth': return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
    case 'year':      return [iso(new Date(y, 0, 1)), todayISO()];
    case 'all':       return ['2020-01-01', todayISO()];
    default:          return [iso(new Date(y, m, 1)), todayISO()];
  }
}

export default function Reports() {
  const data = useData();
  const [preset, setPreset] = useState('month');
  const [[from, to], setRange] = useState(presetRange('month'));
  const [busy, setBusy] = useState(false);

  const setPresetRange = (key) => { setPreset(key); setRange(presetRange(key)); };

  const fromTs = useMemo(() => new Date(from + 'T00:00:00').getTime(), [from]);
  const toTs   = useMemo(() => new Date(to   + 'T23:59:59.999').getTime(), [to]);

  const report = useMemo(() => buildReport(data, fromTs, toTs), [data, fromTs, toTs]);

  const inRange = (r) => { const t = parseDate(r.date) || Number(r.createdAt || r.id || 0); return t >= fromTs && t <= toTs; };

  // ── SOF KAPITAL / JORIY BALANS ("Hammasidan hisobot"dan birlashtirildi) ────
  // Davrga bog'liq emas — hozirgi holat. Aktiv − Majburiyat = o'z pulimiz.
  const {
    totalCashBalance = 0, totalBankBalance = 0, totalClickBalance = 0,
    totalDebts = 0, totalAdvances = 0,
    workers = [], salaryPayments = [], drivers = [], driverTrips = [],
    cashRows = [], bankRows = [], clickRows = [],
  } = data;

  // Xodim qarzi — JORIY OY (WorkerSalary bilan bir xil)
  const nowMonth = (() => { const n = new Date(); return `${String(n.getMonth() + 1).padStart(2, '0')}.${n.getFullYear()}`; })();
  const paidThisMonth = (wid) => salaryPayments
    .filter(p => p.workerId === wid && (p.date || '').endsWith(nowMonth))
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalWDebt = workers.reduce((s, w) => s + Math.max(0, Number(w.salary) - paidThisMonth(w.id)), 0);

  // Haydovchi qarzi — reys + Kassir to'lovlari (Drivers bilan bir xil)
  const totalDriverDebt = drivers.reduce((sum, d) => {
    const trips = driverTrips.filter(t => t.driverId === d.id);
    const earnings = trips.filter(t => !t.isPayment).reduce((s, t) => s + Number(t.price), 0);
    const tripPaid = trips.filter(t => t.isPayment).reduce((s, t) => s + Number(t.price), 0);
    const kassiPaid = [...cashRows, ...bankRows, ...clickRows]
      .filter(r => !r.auto && r.customer === d.name && Number(r.amount) < 0)
      .reduce((s, r) => s + Math.abs(Number(r.amount)), 0);
    return sum + Math.max(0, earnings - tripPaid - kassiPaid);
  }, 0);

  const totalAssets      = Number(totalCashBalance) + Number(totalBankBalance) + Number(totalClickBalance) + Number(totalDebts);
  const totalLiabilities = Number(totalAdvances) + totalWDebt + totalDriverDebt;
  const netCapital       = totalAssets - totalLiabilities;

  const handleExcel = async () => {
    setBusy(true);
    try {
      await generateReportExcel(report, {
        appName: (data.appSettings?.appName || 'SEMENT') + ' — MOLIYAVIY HISOBOT',
        fromLabel: isoToDM(from), toLabel: isoToDM(to),
        generatedAt: new Date().toLocaleString('ru-RU'),
        worker: data.currentWorker || data.currentUser?.name || '',
        fileName: `sement-hisobot_${from}_${to}.xlsx`,
        raw: data, inRange,
      });
    } catch (e) {
      alert('Excel yaratishda xato: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const presets = [
    { k: 'today', l: 'Bugun' }, { k: 'yesterday', l: 'Kecha' }, { k: 'week', l: 'Shu hafta' },
    { k: 'month', l: 'Shu oy' }, { k: 'lastmonth', l: "O'tgan oy" }, { k: 'year', l: 'Shu yil' }, { k: 'all', l: 'Hammasi' },
  ];

  const inp = { padding: '5px 8px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4, fontFamily: 'Tahoma, sans-serif' };

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13, paddingBottom: 40 }}>

      {/* ── DAVR TANLASH + EXCEL ──────────────────────────────────────────── */}
      <div style={{ background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 8, padding: '12px 16px', marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          {presets.map(p => (
            <button key={p.k} onClick={() => setPresetRange(p.k)} style={{
              padding: '5px 12px', cursor: 'pointer', borderRadius: 4, fontSize: 12, fontWeight: 'bold',
              border: '1px solid #1565c0', background: preset === p.k ? '#1565c0' : '#fff', color: preset === p.k ? '#fff' : '#1565c0',
            }}>{p.l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#555' }}>Davr:</span>
          <input type="date" value={from} max={to} onChange={e => { setPreset('custom'); setRange([e.target.value, to]); }} style={inp} />
          <span>—</span>
          <input type="date" value={to} min={from} max={todayISO()} onChange={e => { setPreset('custom'); setRange([from, e.target.value]); }} style={inp} />
          <button onClick={handleExcel} disabled={busy} style={{
            marginLeft: 'auto', padding: '8px 20px', cursor: busy ? 'wait' : 'pointer',
            background: '#1b5e20', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', fontSize: 14, opacity: busy ? 0.7 : 1,
          }}>
            {busy ? 'Tayyorlanmoqda...' : '⬇️ Excel hisobotni yuklab olish'}
          </button>
        </div>
      </div>

      {/* ── KATTA KARTALAR ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        <Big title="Davr savdosi (summa)" value={fmt(report.sales.totalSum)} unit="so'm" color="#1565c0" bg="#e3f2fd" />
        <Big title="Davr savdosi (tonna)" value={fmtT(report.sales.totalTons)} unit="tn" color="#1b5e20" bg="#e8f5e9" />
        <Big title="Davr sof pul oqimi" value={fmt(report.periodNetCash)} unit="so'm" color={report.periodNetCash >= 0 ? '#2e7d32' : '#c62828'} bg={report.periodNetCash >= 0 ? '#e8f5e9' : '#ffebee'} />
        <Big title="Sof kapital (o'z pulimiz)" value={fmt(netCapital)} unit="so'm" color={netCapital >= 0 ? '#1a237e' : '#c62828'} bg="#e8eaf6" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 18 }}>
        {/* Davr savdosi */}
        <Section title="🛒 Davr savdosi (to'lov turi bo'yicha)" color="#1565c0">
          <Row label="💵 Naqd savdo" val={report.sales.byChannel.naqd} />
          <Row label="🏦 Bank savdo" val={report.sales.byChannel.bank} />
          <Row label="💜 Click savdo" val={report.sales.byChannel.click} />
          <Row label="⚠️ Nasiya (qarzga)" val={report.sales.byChannel.nasiya} color="#c62828" />
          <Divider />
          <Row label="Jami savdo" val={report.sales.totalSum} color="#1565c0" bold />
        </Section>

        {/* Sement harakati */}
        <Section title="🏗 Sement harakati (davr)" color="#ef6c00">
          <Row label="Olingan sement" val={report.recv.totalTons} unit="tn" />
          <Row label="Olingan summa (xarid)" val={report.recv.totalCost} color="#c62828" />
          <Row label="Sotilgan sement" val={report.sales.totalTons} unit="tn" />
          <Divider />
          <Row label="Hozirgi sement qoldig'i" val={report.snapshot.cement} unit="tn" color="#ef6c00" bold />
        </Section>

        {/* Pul harakati */}
        <Section title="🔄 Pul harakati (davr, qo'lda yozuvlar)" color="#2e7d32">
          <Row label="Naqd kirim" val={report.finance.naqdIn} color="#2e7d32" />
          <Row label="Naqd chiqim" val={report.finance.naqdOut} color="#c62828" />
          <Row label="Bank kirim" val={report.finance.bankIn} color="#2e7d32" />
          <Row label="Bank chiqim" val={report.finance.bankOut} color="#c62828" />
          <Row label="Click kirim" val={report.finance.clickIn} color="#2e7d32" />
          <Row label="Click chiqim" val={report.finance.clickOut} color="#c62828" />
        </Section>

        {/* Hozirgi holat */}
        <Section title="📌 Hozirgi holat (joriy qoldiqlar)" color="#003366">
          <Row label="Naqd kassa" val={report.snapshot.cash} bold />
          <Row label="Bank" val={report.snapshot.bank} bold />
          <Row label="Click" val={report.snapshot.click} bold />
          <Divider />
          <Row label="Mijozlar bizga qarzi" val={report.snapshot.debts} color="#2e7d32" bold />
          <Row label="Biz olgan avanslar" val={report.snapshot.advances} color="#c62828" bold />
        </Section>

        {/* Sof kapital / balans — "Hammasidan hisobot"dan birlashtirildi */}
        <Section title="💼 Sof kapital (o'z pulimiz)" color="#1a237e">
          <Row label="Jami aktivlar" val={totalAssets} color="#2e7d32" bold />
          <div style={{ paddingLeft: 12, fontSize: 12, color: '#777' }}>
            <Row label="· Kassa + bank + click" val={Number(totalCashBalance) + Number(totalBankBalance) + Number(totalClickBalance)} />
            <Row label="· Mijozlar bizga qarzi (debitor)" val={Number(totalDebts)} />
          </div>
          <Row label="Jami majburiyatlar" val={totalLiabilities} color="#c62828" bold />
          <div style={{ paddingLeft: 12, fontSize: 12, color: '#777' }}>
            <Row label="· Biz olgan avanslar" val={Number(totalAdvances)} />
            <Row label="· Ishchilarga qarzimiz (shu oy)" val={totalWDebt} />
            <Row label="· Haydovchilarga qarzimiz" val={totalDriverDebt} />
          </div>
          <Divider />
          <Row label="SOF KAPITAL = Aktiv − Majburiyat" val={netCapital} color={netCapital >= 0 ? '#1a237e' : '#c62828'} bold />
        </Section>
      </div>

      {/* ── TOP MIJOZLAR ──────────────────────────────────────────────────── */}
      <div style={{ marginTop: 22 }}>
        <div style={{ background: '#6a1b9a', color: '#fff', padding: '8px 14px', fontWeight: 'bold', fontSize: 14, borderRadius: '6px 6px 0 0' }}>
          🏆 Davr top mijozlari ({report.topCustomers.length} ta)
        </div>
        {report.topCustomers.length === 0 ? (
          <div style={{ padding: 16, color: '#888', border: '1px solid #eee', fontStyle: 'italic' }}>Bu davrda savdo yo'q.</div>
        ) : (
          <table className="data-table" style={{ width: '100%', maxWidth: 700 }}>
            <thead>
              <tr><th style={{ width: 40 }}>#</th><th>Mijoz</th><th style={{ textAlign: 'right' }}>Savdolar</th><th style={{ textAlign: 'right' }}>Tonna</th><th style={{ textAlign: 'right' }}>Summa</th></tr>
            </thead>
            <tbody>
              {report.topCustomers.slice(0, 15).map((x, i) => (
                <tr key={x.name} style={{ background: i % 2 ? '#faf7fc' : '#fff' }}>
                  <td style={{ textAlign: 'center', color: '#888' }}>{i + 1}</td>
                  <td style={{ fontWeight: 'bold', color: '#4a148c' }}>{x.name}</td>
                  <td style={{ textAlign: 'right' }}>{x.count}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtT(x.tons)} tn</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{fmt(x.sum)} so'm</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Yordamchi komponentlar ──────────────────────────────────────────────────
function Big({ title, value, unit, color, bg }) {
  return (
    <div style={{ background: bg, borderLeft: `6px solid ${color}`, padding: '14px 18px', borderRadius: 6 }}>
      <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 'bold', color, fontFamily: 'monospace' }}>
        {value} <span style={{ fontSize: 12, color: '#888' }}>{unit}</span>
      </div>
    </div>
  );
}
function Section({ title, color, children }) {
  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
      <div style={{ background: color, color: '#fff', padding: '9px 14px', fontWeight: 'bold', fontSize: 13 }}>{title}</div>
      <div style={{ padding: '4px 14px 12px' }}>{children}</div>
    </div>
  );
}
function Row({ label, val, unit = "so'm", color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px dashed #eee' }}>
      <span style={{ color: '#555' }}>{label}</span>
      <span style={{ fontWeight: bold ? 'bold' : 'normal', color: color || '#333', fontFamily: 'monospace', fontSize: 14 }}>
        {Number(val || 0).toLocaleString('ru-RU').replace(/,/g, ' ')} <span style={{ fontSize: 11, color: '#888' }}>{unit}</span>
      </span>
    </div>
  );
}
function Divider() { return <div style={{ height: 1, background: '#ddd', margin: '6px 0' }} />; }
