import { useState } from 'react';
import { useData } from '../context/DataContext';
import CustomerSelect from '../components/CustomerSelect';
import { printSaleReceipt } from '../lib/receipt';
import { customerSummary } from '../lib/customerSummary';
import NotifyModal from '../components/NotifyModal';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (ts) => {
  if (!ts || ts < 1e10) return '—';
  const d = new Date(ts);
  return [String(d.getHours()).padStart(2,'0'), String(d.getMinutes()).padStart(2,'0')].join(':');
};
const fmtTons = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };

const ACCENT = '#01579b'; // Dark blue for Sales
const BG     = '#e1f5fe';

export default function Sales({ lang }) {
  const data = useData();
  const { salesRows, addSaleRow, deleteSaleRow, currentWorker, totalCementBalance, appSettings, customers } = data;
  const [form, setForm] = useState({ customer: '', tons: '', pricePerTon: '', paymentChannel: 'naqd', note: '' });
  const [search, setSearch] = useState('');
  const [notifyRow, setNotifyRow] = useState(null); // { name, phone, text }

  const phoneOf = (name) => customers.find(c => c.name === name)?.phone || '';
  const CH_LBL = { naqd: 'Naqd', bank: 'Bank', click: 'Click', nasiya: 'Nasiya (qarzga)' };
  const saleMsg = (r) => {
    const total = Number(r.tons || 0) * Number(r.pricePerTon || 0);
    const base = `Hurmatli ${r.customer}! ${fmtTons(r.tons)} tn sement sotildi. Summa: ${fmt(total)} so'm. To'lov: ${CH_LBL[r.paymentChannel] || r.paymentChannel}.`;
    const q = customerSummary(r.customer, data).qolganQarz;
    return q > 0 ? `${base} Qoldiq qarz: ${fmt(q)} so'm. Rahmat!` : `${base} Rahmat!`;
  };
  const openNotify = (r) => setNotifyRow({ name: r.customer, phone: phoneOf(r.customer), text: saleMsg(r) });

  // ── Chek chiqarish ─────────────────────────────────────────────────────────
  const printChek = (sale, qolganQarzOverride = null) => {
    const q = qolganQarzOverride != null ? qolganQarzOverride : customerSummary(sale.customer, data).qolganQarz;
    printSaleReceipt(sale, {
      appName: appSettings?.appName || 'SEMENT',
      phone: appSettings?.companyPhone || '',
      address: appSettings?.companyAddress || '',
      qolganQarz: q,
    });
  };
  const printChekAuto = (sale, qolganQarz) => printChek(sale, qolganQarz);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.customer || !form.tons || !form.pricePerTon) return;

    // Qoldiqni tekshirish
    if (Number(form.tons) > Number(totalCementBalance)) {
      if (!window.confirm(`Diqqat! Omboringizda faqat ${totalCementBalance} tn sement bor. Baribir sotasizmi?`)) {
        return;
      }
    }

    const created = addSaleRow({ ...form, worker: currentWorker });
    setForm({ customer: '', tons: '', pricePerTon: '', paymentChannel: 'naqd', note: '' });
    // ── Sotuvdan so'ng chek MAJBURIY va AVTOMATIK chiqadi (kassa sotuvi) ──────
    // Sozlamada o'chirilgan bo'lsagina chiqmaydi (autoPrintReceipt === false).
    if (created && appSettings?.autoPrintReceipt !== false) {
      const extraDebt = (created.paymentChannel === 'nasiya') ? Number(created.tons || 0) * Number(created.pricePerTon || 0) : 0;
      const s = customerSummary(created.customer, data);
      printChekAuto(created, s.qolganQarz + extraDebt);
    }
  };

  // ── Hisob-kitoblar ────────────────────────────────────────────────────────
  const totalTons = salesRows.reduce((s, r) => s + Number(r.tons || 0), 0);
  const totalSum  = salesRows.reduce((s, r) => s + (Number(r.tons || 0) * Number(r.pricePerTon || 0)), 0);

  // Kanal bo'yicha tushumlar
  const ch = (channel) => salesRows.filter(r => r.paymentChannel === channel).reduce((s, r) => s + (Number(r.tons || 0) * Number(r.pricePerTon || 0)), 0);
  const sumNaqd   = ch('naqd');
  const sumBank   = ch('bank');
  const sumClick  = ch('click');
  const sumNasiya = ch('nasiya');

  // Filter
  const sorted = [...salesRows].sort((a,b) => b.createdAt - a.createdAt);
  const filtered = sorted.filter(r => !search || r.customer.toLowerCase().includes(search.toLowerCase()) || (r.note||'').toLowerCase().includes(search.toLowerCase()));

  const inp = { padding: '6px 10px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4, fontFamily: 'Tahoma, sans-serif' };

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13, paddingBottom: 30 }}>

      {/* ── STATISTIKA VA QOLDIQ PANELI ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Joriy Sement Qoldig'i (Katta qizil/yashil karta) */}
        <div style={{ background: '#fff3e0', borderLeft: `6px solid #e65100`, padding: '16px 20px', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', minWidth: 220 }}>
          <div style={{ fontSize: 12, color: '#e65100', marginBottom: 4, fontWeight: 'bold' }}>Joriy Sement Qoldig'i</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: totalCementBalance > 0 ? '#1b5e20' : '#c62828', fontFamily: 'monospace' }}>
            {fmtTons(totalCementBalance)} <span style={{ fontSize: 14, color: '#888' }}>tn</span>
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Omborda bor sement</div>
        </div>

        {/* Jami Savdo */}
        <div style={{ background: '#e8f5e9', borderLeft: `6px solid #2e7d32`, padding: '16px 20px', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', minWidth: 220, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 12, color: '#2e7d32', marginBottom: 4, fontWeight: 'bold' }}>Jami Sotilgan</div>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1b5e20', fontFamily: 'monospace' }}>
            {fmtTons(totalTons)} <span style={{ fontSize: 12, color: '#888' }}>tn</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 'bold', color: '#2e7d32', fontFamily: 'monospace', marginTop: 4 }}>
            {fmt(totalSum)} <span style={{ fontSize: 12, color: '#888' }}>so'm</span>
          </div>
        </div>

        {/* To'lov turlari bo'yicha tushumlar */}
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 16, minWidth: 300 }}>
          <div><div style={{ fontSize: 11, color: '#666' }}>💵 Naqd savdo</div><div style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{fmt(sumNaqd)}</div></div>
          <div><div style={{ fontSize: 11, color: '#666' }}>🏦 Bank savdo</div><div style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{fmt(sumBank)}</div></div>
          <div><div style={{ fontSize: 11, color: '#666' }}>💜 Click savdo</div><div style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{fmt(sumClick)}</div></div>
          <div><div style={{ fontSize: 11, color: '#c62828' }}>⚠️ Nasiya savdo</div><div style={{ fontWeight: 'bold', fontFamily: 'monospace', color: '#c62828' }}>{fmt(sumNasiya)}</div></div>
        </div>
      </div>

      {/* ── QO'SHISH FORMASI ──────────────────────────────────────────────── */}
      <div style={{ background: '#f5f5f5', border: `1px solid #ccc`, padding: '16px 20px', borderRadius: 8, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 'bold', color: ACCENT, marginBottom: 12 }}>🛒 Yangi savdoni ro'yxatga olish</div>
        
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 4 }}>Mijoz *</label>
            <CustomerSelect
              value={form.customer}
              onChange={val => setForm({ ...form, customer: val })}
              placeholder="Mijoz (izlash...)"
              width={260}
              accentColor={ACCENT}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 4 }}>Miqdor (tn) *</label>
            <input type="number" placeholder="Masalan: 10" value={form.tons} onChange={e => setForm({ ...form, tons: e.target.value })} style={{ ...inp, width: 100 }} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 4 }}>1 tn narxi *</label>
            <input type="number" placeholder="Masalan: 500000" value={form.pricePerTon} onChange={e => setForm({ ...form, pricePerTon: e.target.value })} style={{ ...inp, width: 140 }} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 4 }}>To'lov turi *</label>
            <select value={form.paymentChannel} onChange={e => setForm({ ...form, paymentChannel: e.target.value })} style={{ ...inp, width: 120, fontWeight: 'bold', color: '#333' }}>
              <option value="naqd">💵 Naqd</option>
              <option value="bank">🏦 Bank</option>
              <option value="click">💜 Click</option>
              <option value="nasiya">⚠️ Nasiya (Qarz)</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 4 }}>Izoh / Mashina raqami</label>
            <input type="text" placeholder="Ixtiyoriy" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
          </div>

          <button type="submit" style={{ padding: '8px 24px', cursor: 'pointer', background: ACCENT, color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', height: 35 }}>
            ✓ Sotish
          </button>
        </form>
        
        {/* Real vaqtda jami summani ko'rsatish */}
        {form.tons && form.pricePerTon && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#fff', borderLeft: '4px solid #4caf50', borderRadius: 4, display: 'inline-block' }}>
            Hisoblangan Summa: <strong style={{ fontSize: 16, fontFamily: 'monospace' }}>{fmt(Number(form.tons) * Number(form.pricePerTon))}</strong> so'm
          </div>
        )}
      </div>

      {/* ── QIDIRUV VA JADVAL ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <input placeholder="🔍 Mijoz yoki izoh bo'yicha qidirish..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, width: 300 }} />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: ACCENT, color: '#fff', borderBottom: '2px solid #eee' }}>
              <th style={thS}>#</th>
              <th style={thS}>Vaqt</th>
              <th style={thS}>Mijoz / Izoh</th>
              <th style={thS}>To'lov turi</th>
              <th style={{ ...thS, textAlign: 'right' }}>Tonna</th>
              <th style={{ ...thS, textAlign: 'right' }}>Narxi (1 tn)</th>
              <th style={{ ...thS, textAlign: 'right' }}>Jami Summa</th>
              <th style={{ ...thS, textAlign: 'center', width: 80 }}>Chek</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: '#888', fontStyle: 'italic' }}>Savdo topilmadi.</td></tr>
            ) : filtered.map((r, i) => {
              const typeColor = r.paymentChannel === 'naqd' ? '#2e7d32' : r.paymentChannel === 'bank' ? '#0d47a1' : r.paymentChannel === 'click' ? '#4a148c' : '#c62828';
              const typeBg    = r.paymentChannel === 'naqd' ? '#e8f5e9' : r.paymentChannel === 'bank' ? '#e3f2fd' : r.paymentChannel === 'click' ? '#f3e5f5' : '#ffebee';
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid #eee', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ ...tdS, color: '#888', textAlign: 'center', width: 30 }}>{i + 1}</td>
                  <td style={{ ...tdS, width: 80, color: '#555' }}>
                    <div>{r.date}</div>
                    <div style={{ fontSize: 10, fontWeight: 'bold' }}>{fmtT(r.createdAt)}</div>
                  </td>
                  <td style={{ ...tdS, width: 220 }}>
                    <div style={{ fontWeight: 'bold', color: '#1565c0' }}>{r.customer}</div>
                    <div style={{ fontSize: 11, color: '#777' }}>{r.note || '—'}</div>
                    {r.worker && <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>👷 {r.worker}</div>}
                  </td>
                  <td style={tdS}>
                    <span style={{ background: typeBg, color: typeColor, padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', border: `1px solid ${typeColor}44` }}>
                      {r.paymentChannel.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ ...tdS, textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', fontSize: 14 }}>{fmtTons(r.tons)}</td>
                  <td style={{ ...tdS, textAlign: 'right', color: '#555' }}>{fmt(r.pricePerTon)}</td>
                  <td style={{ ...tdS, textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', fontSize: 15, color: '#333' }}>
                    {fmt(Number(r.tons) * Number(r.pricePerTon))}
                  </td>
                  <td style={{ ...tdS, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button onClick={() => printChek(r)} title="Chek chiqarish"
                      style={{ cursor: 'pointer', background: '#e3f2fd', border: '1px solid #1976d2', color: '#1565c0', borderRadius: 3, padding: '2px 7px', marginRight: 4, fontSize: 13 }}>🧾</button>
                    <button onClick={() => openNotify(r)} title="Xabar yuborish (Telegram/SMS)"
                      style={{ cursor: 'pointer', background: '#e8f5e9', border: '1px solid #2e7d32', color: '#2e7d32', borderRadius: 3, padding: '2px 7px', marginRight: 4, fontSize: 13 }}>✉️</button>
                    <button onClick={() => { if(window.confirm("O'chirasizmi? (Sement qoldig'i joyiga qaytadi)")) deleteSaleRow(r.id); }}
                      title="O'chirish"
                      style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#c62828' }}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {notifyRow && <NotifyModal name={notifyRow.name} phone={notifyRow.phone} defaultText={notifyRow.text} onClose={() => setNotifyRow(null)} />}
    </div>
  );
}

const thS = { padding: '10px 14px', textAlign: 'left', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' };
const tdS = { padding: '10px 14px', fontSize: 13 };
