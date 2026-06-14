// ─────────────────────────────────────────────────────────────────────────────
// Yuk taqsimlash — bir kunlik katta yukni (masalan 1000 tn) mijozlarga
// maydalab tarqatish. Tez kiritish: mijoz + tonna → Enter. Har bir kiritma
// avtomatik SOTUVga aylanadi (sement kamayadi, narx bo'lsa qarz/kassa yangilanadi).
// Jonli qoldiq hisoblagich: bugun olingan − taqsimlangan = qolgan.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import CustomerSelect from '../components/CustomerSelect';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };
const today = () => new Date().toLocaleDateString('ru-RU');
const timeOf = (ts) => { if (!ts || ts < 1e10) return ''; const d = new Date(ts); return [String(d.getHours()).padStart(2,'0'), String(d.getMinutes()).padStart(2,'0')].join(':'); };

const CHANNELS = [
  { v: 'nasiya', label: '⚠️ Nasiya (qarz)', color: '#c62828' },
  { v: 'naqd',   label: '💵 Naqd',          color: '#1565c0' },
  { v: 'bank',   label: '🏦 Bank',          color: '#2e7d32' },
  { v: 'click',  label: '📱 Click',         color: '#6a1b9a' },
];

export default function Distribution() {
  const { salesRows, addSaleRow, deleteSaleRow, recvRows, totalCementBalance, currentWorker } = useData();

  // Standart sozlamalar (har kiritmada qayta yozmaslik uchun)
  const [defPrice, setDefPrice]     = useState('');
  const [defChannel, setDefChannel] = useState('nasiya');

  // Tez kiritish formasi
  const [row, setRow] = useState({ customer: '', tons: '', price: '' });
  const tonsRef = useRef();

  const t = today();
  const todaySales = salesRows.filter(r => r.date === t);
  const bugunOlingan      = recvRows.filter(r => r.date === t).reduce((s, r) => s + Number(r.tons || 0), 0);
  const bugunTaqsimlangan = todaySales.reduce((s, r) => s + Number(r.tons || 0), 0);
  const qolgan = bugunOlingan - bugunTaqsimlangan;

  const add = (e) => {
    e.preventDefault();
    if (!row.customer || !row.tons) return;
    const price = row.price !== '' ? row.price : defPrice;
    addSaleRow({
      customer: row.customer,
      tons: row.tons,
      pricePerTon: price || 0,
      paymentChannel: defChannel,
      note: 'Taqsimot',
      worker: currentWorker,
    });
    setRow({ customer: '', tons: '', price: '' });
    // Keyingi kiritma uchun mijoz maydoniga fokus — tez ishlash
    setTimeout(() => { const el = document.getElementById('dist-customer'); if (el) el.focus(); }, 30);
  };

  const inp = { padding: '7px 10px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4, fontFamily: 'Tahoma, sans-serif' };

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>

      {/* ── JONLI QOLDIQ ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <Stat label="Bugun olingan (zavoddan)" value={fmtT(bugunOlingan)} unit="tn" color="#1565c0" bg="#e3f2fd" />
        <Stat label="Bugun taqsimlangan"       value={fmtT(bugunTaqsimlangan)} unit="tn" color="#2e7d32" bg="#e8f5e9" />
        <Stat label="Bugundan qolgan"          value={fmtT(qolgan)} unit="tn" color={qolgan < 0 ? '#c62828' : '#ef6c00'} bg="#fff3e0" big />
        <Stat label="Omborda umumiy qoldiq"    value={fmtT(totalCementBalance)} unit="tn" color="#5d4037" bg="#efebe9" />
      </div>

      {/* ── STANDART SOZLAMALAR ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, padding: '10px 14px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6 }}>
        <span style={{ fontWeight: 'bold', color: '#555' }}>⚙️ Standart:</span>
        <span style={{ fontSize: 12, color: '#666' }}>Narx (1 tn):</span>
        <input type="number" placeholder="masalan 670000" value={defPrice} onChange={e => setDefPrice(e.target.value)} style={{ ...inp, width: 130 }} />
        <span style={{ fontSize: 12, color: '#666', marginLeft: 6 }}>To'lov:</span>
        {CHANNELS.map(ch => (
          <button key={ch.v} type="button" onClick={() => setDefChannel(ch.v)} style={{
            padding: '5px 12px', fontSize: 12, cursor: 'pointer',
            border: `2px solid ${defChannel === ch.v ? ch.color : '#ccc'}`,
            background: defChannel === ch.v ? ch.color : '#fff',
            color: defChannel === ch.v ? '#fff' : '#333', borderRadius: 4, fontWeight: 'bold',
          }}>{ch.label}</button>
        ))}
        <span style={{ fontSize: 11, color: '#999' }}>— har kiritmada shu qo'llaniladi (alohida o'zgartirsa bo'ladi)</span>
      </div>

      {/* ── TEZ KIRITISH ───────────────────────────────────────────────────── */}
      <form onSubmit={add} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16, padding: '14px 16px', background: '#e1f5fe', border: '2px solid #0288d1', borderRadius: 8 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 4 }}>Mijoz (kim oldi) *</label>
          <CustomerSelect
            value={row.customer}
            onChange={val => setRow({ ...row, customer: val })}
            placeholder="Mijoz..."
            width={240}
            accentColor="#0288d1"
            inputId="dist-customer"
            required
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 4 }}>Tonna *</label>
          <input ref={tonsRef} type="number" step="0.01" placeholder="necha tn" value={row.tons}
            onChange={e => setRow({ ...row, tons: e.target.value })} style={{ ...inp, width: 100, fontSize: 16, fontWeight: 'bold' }} required />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 4 }}>Narx (ixtiyoriy)</label>
          <input type="number" placeholder={defPrice ? `${fmt(defPrice)} (standart)` : 'narx'} value={row.price}
            onChange={e => setRow({ ...row, price: e.target.value })} style={{ ...inp, width: 120 }} />
        </div>
        <button type="submit" style={{ padding: '9px 28px', cursor: 'pointer', background: '#0288d1', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', fontSize: 15 }}>
          ➕ Qo'shish
        </button>
        {row.tons && (
          <span style={{ fontSize: 13, color: '#01579b', alignSelf: 'center' }}>
            {fmtT(row.tons)} tn{(row.price || defPrice) ? ` × ${fmt(row.price || defPrice)} = ` : ''}
            {(row.price || defPrice) ? <b>{fmt(Number(row.tons) * Number(row.price || defPrice))} so'm</b> : ''}
          </span>
        )}
      </form>

      {/* ── BUGUNGI TAQSIMOT RO'YXATI ──────────────────────────────────────── */}
      <div style={{ fontWeight: 'bold', fontSize: 14, color: '#01579b', marginBottom: 8 }}>
        📋 Bugungi taqsimot ({todaySales.length} ta · {fmtT(bugunTaqsimlangan)} tn)
      </div>
      {todaySales.length === 0 ? (
        <p style={{ color: '#888', fontStyle: 'italic' }}>Bugun hali taqsimot kiritilmagan. Yuqoridan boshlang.</p>
      ) : (
        <table className="data-table" style={{ width: '100%', maxWidth: 820 }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th style={{ width: 60 }}>Vaqt</th>
              <th>Mijoz</th>
              <th style={{ textAlign: 'right', width: 90 }}>Tonna</th>
              <th style={{ textAlign: 'right', width: 110 }}>Narx/tn</th>
              <th style={{ textAlign: 'right', width: 130 }}>Summa</th>
              <th style={{ width: 90 }}>To'lov</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {[...todaySales].sort((a, b) => b.createdAt - a.createdAt).map((r, i) => {
              const sum = Number(r.tons || 0) * Number(r.pricePerTon || 0);
              const isNasiya = r.paymentChannel === 'nasiya';
              return (
                <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#f7fbfd' }}>
                  <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{todaySales.length - i}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{timeOf(r.createdAt)}</td>
                  <td style={{ fontWeight: 'bold', color: '#01579b' }}>{r.customer}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', fontSize: 15 }}>{fmtT(r.tons)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#555' }}>{r.pricePerTon ? fmt(r.pricePerTon) : '—'}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{sum ? fmt(sum) : '—'}</td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 'bold', color: isNasiya ? '#c62828' : '#2e7d32' }}>
                      {isNasiya ? 'Nasiya' : (r.paymentChannel || 'naqd')}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button onClick={() => { if (window.confirm("O'chirasizmi? (Sement qoldig'i qaytadi)")) deleteSaleRow(r.id); }}
                      style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#c62828' }}>✕</button>
                  </td>
                </tr>
              );
            })}
            <tr style={{ background: '#ffff00', fontWeight: 'bold' }}>
              <td colSpan={3} style={{ textAlign: 'right' }}>JAMI</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtT(bugunTaqsimlangan)} tn</td>
              <td></td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(todaySales.reduce((s, r) => s + Number(r.tons || 0) * Number(r.pricePerTon || 0), 0))}</td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

function Stat({ label, value, unit, color, bg, big }) {
  return (
    <div style={{ padding: '10px 18px', background: bg, borderLeft: `5px solid ${color}`, borderRadius: 6, minWidth: 150 }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: big ? 28 : 22, fontWeight: 'bold', color, fontFamily: 'monospace' }}>
        {value} <span style={{ fontSize: 12, color: '#888' }}>{unit}</span>
      </div>
    </div>
  );
}
