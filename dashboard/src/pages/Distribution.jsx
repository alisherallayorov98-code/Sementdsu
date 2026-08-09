// ─────────────────────────────────────────────────────────────────────────────
// Yuk taqsimlash — bir kunlik katta yukni (masalan 1000 tn) mijozlarga
// maydalab tarqatish. Tez kiritish: mijoz + tonna → Enter. Har bir kiritma
// avtomatik SOTUVga aylanadi (sement kamayadi, narx bo'lsa qarz/kassa yangilanadi).
// Jonli qoldiq hisoblagich: bugun olingan − taqsimlangan = qolgan.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { parseNum } from '../lib/parseNum';
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
  { v: 'avans',  label: '🅰️ Avansdan',      color: '#00838f' },
];

export default function Distribution() {
  const { salesRows, addSaleRow, deleteSaleRow, updateSaleRow, recvRows, totalCementBalance, currentWorker,
          warehouses, whOf, defaultWhId, currentUser, cementBalanceOf, whName } = useData();
  const myWh = currentUser?.warehouseId || defaultWhId;

  // Standart sozlamalar (har kiritmada qayta yozmaslik uchun)
  const [defPrice, setDefPrice]     = useState('');
  const [defChannel, setDefChannel] = useState('nasiya');
  const [wh, setWh] = useState(myWh); // qaysi skladdan taqsimlanmoqda

  // Tez kiritish formasi
  const [row, setRow] = useState({ customer: '', tons: '', price: '' });
  const tonsRef = useRef();

  // Qator tahrirlash: taqsimotda tez kiritilgani uchun xato (noto'g'ri mijoz,
  // tonna yoki narx) tez-tez uchraydi. Ilgari yagona chora — o'chirib qayta
  // kiritish edi. Endi qator joyida tahrirlanadi.
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({ customer: '', tons: '', price: '', channel: 'nasiya' });

  const startEdit = (r) => {
    setEditId(r.id);
    setEdit({
      customer: r.customer || '',
      tons: String(r.tons ?? ''),
      price: String(r.pricePerTon ?? ''),
      channel: r.paymentChannel || 'naqd',
    });
  };
  const cancelEdit = () => { setEditId(null); };
  const saveEdit = (r) => {
    const tonsN  = parseNum(edit.tons);
    const priceN = parseNum(edit.price);
    if (!edit.customer)   { alert('Mijoz tanlanmagan.'); return; }
    if (!(tonsN > 0))     { alert("Tonna 0 dan katta bo'lishi kerak."); return; }
    if (!(priceN >= 0) || !isFinite(priceN)) { alert("Narx noto'g'ri kiritilgan."); return; }
    // Qoldiq tekshiruvi: tahrirda tonna oshsa ham omborda yo'q sement
    // "sotilib" ketmasin. Farq hisobga olinadi (eski tonna allaqachon yechilgan).
    const delta = tonsN - Number(r.tons || 0);
    if (delta > Number(whQoldiq || 0)) {
      if (!window.confirm(
        `Diqqat! "${whName(wh)}" skladida ${fmtT(whQoldiq)} tn sement bor.\n` +
        `Tonna ${fmtT(delta)} tn ga oshirilmoqda.\n\nBaribir davom etamizmi?`
      )) return;
    }
    // updateSaleRow rad etsa (masalan qarzga to'lov qilingan bo'lsa) forma
    // ochiq qoladi — o'zgarish saqlanmagani bilinmay qolmasin.
    if (updateSaleRow(r.id, {
      customer: edit.customer,
      tons: tonsN,
      pricePerTon: priceN,
      paymentChannel: edit.channel,
    }) === false) return;
    setEditId(null);
  };

  const t = today();
  // Tanlangan sklad bo'yicha
  const todaySales = salesRows.filter(r => r.date === t && whOf(r) === wh);
  const bugunOlingan      = recvRows.filter(r => r.date === t && whOf(r) === wh).reduce((s, r) => s + Number(r.tons || 0), 0);
  const bugunTaqsimlangan = todaySales.reduce((s, r) => s + Number(r.tons || 0), 0);
  const qolgan = bugunOlingan - bugunTaqsimlangan;
  const whQoldiq = cementBalanceOf(wh);

  const add = (e) => {
    e.preventDefault();
    if (!row.customer || !row.tons) return;
    const tonsN  = parseNum(row.tons);
    const priceN = parseNum(row.price !== '' ? row.price : defPrice);
    if (!(tonsN > 0))  { alert("Tonna 0 dan katta bo'lishi kerak."); return; }
    if (!(priceN > 0)) { alert("Narx 0 dan katta bo'lishi kerak."); return; }
    // Sklad qoldig'i tekshiruvi — "Sotish" bo'limida bor edi, taqsimlashda
    // YO'Q edi. Aynan bu yerda xato ehtimoli eng katta: yozuvlar ketma-ket
    // tez kiritiladi va omborda yo'q tonna sassiz "sotilib" ketardi.
    if (tonsN > Number(whQoldiq || 0)) {
      if (!window.confirm(
        `Diqqat! "${whName(wh)}" skladida ${fmtT(whQoldiq)} tn sement bor.\n` +
        `Taqsimlanmoqchi: ${fmtT(tonsN)} tn.\n\nBaribir davom etamizmi?`
      )) return;
    }
    // Natija tekshiriladi: rad etilsa forma tozalanmasin (taqsimlashda
    // ketma-ket tez kiritiladi — yo'qolgan qator sezilmay qolardi).
    if (!addSaleRow({
      customer: row.customer,
      tons: tonsN,
      pricePerTon: priceN,
      paymentChannel: defChannel,
      note: 'Taqsimot',
      warehouseId: wh,
      worker: currentWorker,
    })) return;
    setRow({ customer: '', tons: '', price: '' });
    // Keyingi kiritma uchun mijoz maydoniga fokus — tez ishlash
    setTimeout(() => { const el = document.getElementById('dist-customer'); if (el) el.focus(); }, 30);
  };

  const inp = { padding: '7px 10px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4, fontFamily: 'Tahoma, sans-serif' };

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>

      {/* ── SKLAD TANLASH ──────────────────────────────────────────────────── */}
      {warehouses.length > 1 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', color: '#01579b' }}>🏬 Qaysi skladdan:</span>
          {warehouses.map(w => (
            <button key={w.id} onClick={() => setWh(w.id)} style={{
              padding: '6px 16px', cursor: 'pointer', borderRadius: 6, fontSize: 13, fontWeight: 'bold',
              border: `2px solid ${wh === w.id ? '#01579b' : '#ccc'}`,
              background: wh === w.id ? '#01579b' : '#fff', color: wh === w.id ? '#fff' : '#333',
            }}>{w.name}</button>
          ))}
        </div>
      )}

      {/* ── JONLI QOLDIQ ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <Stat label="Bugun olingan (zavoddan)" value={fmtT(bugunOlingan)} unit="tn" color="#1565c0" bg="#e3f2fd" />
        <Stat label="Bugun taqsimlangan"       value={fmtT(bugunTaqsimlangan)} unit="tn" color="#2e7d32" bg="#e8f5e9" />
        <Stat label="Bugundan qolgan"          value={fmtT(qolgan)} unit="tn" color={qolgan < 0 ? '#c62828' : '#ef6c00'} bg="#fff3e0" big />
        <Stat label={warehouses.length > 1 ? `"${whName(wh)}" qoldig'i` : 'Omborda qoldiq'} value={fmtT(whQoldiq)} unit="tn" color="#5d4037" bg="#efebe9" />
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
              <th style={{ width: 78 }}></th>
            </tr>
          </thead>
          <tbody>
            {[...todaySales].sort((a, b) => b.createdAt - a.createdAt).map((r, i) => {
              const sum = Number(r.tons || 0) * Number(r.pricePerTon || 0);
              const isNasiya = r.paymentChannel === 'nasiya';
              const isEdit = editId === r.id;
              return (
                <tr key={r.id} style={{ background: isEdit ? '#fffde7' : (i % 2 === 0 ? '#fff' : '#f7fbfd') }}>
                  <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{todaySales.length - i}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{timeOf(r.createdAt)}</td>
                  <td style={{ fontWeight: 'bold', color: '#01579b' }}>
                    {isEdit ? (
                      <CustomerSelect
                        value={edit.customer}
                        onChange={val => setEdit({ ...edit, customer: val })}
                        placeholder="Mijoz..."
                        width={190}
                        accentColor="#0288d1"
                      />
                    ) : r.customer}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', fontSize: 15 }}>
                    {isEdit ? (
                      <input type="number" step="0.01" value={edit.tons}
                        onChange={e => setEdit({ ...edit, tons: e.target.value })}
                        style={editInp} />
                    ) : fmtT(r.tons)}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#555' }}>
                    {isEdit ? (
                      <input type="number" value={edit.price}
                        onChange={e => setEdit({ ...edit, price: e.target.value })}
                        style={{ ...editInp, width: 100 }} />
                    ) : (r.pricePerTon ? fmt(r.pricePerTon) : '—')}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {isEdit
                      ? fmt(parseNum(edit.tons) * parseNum(edit.price))
                      : (sum ? fmt(sum) : '—')}
                  </td>
                  <td>
                    {isEdit ? (
                      <select value={edit.channel} onChange={e => setEdit({ ...edit, channel: e.target.value })}
                        style={{ ...editInp, width: 92, textAlign: 'left' }}>
                        {CHANNELS.map(ch => <option key={ch.v} value={ch.v}>{ch.label}</option>)}
                      </select>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 'bold', color: isNasiya ? '#c62828' : '#2e7d32' }}>
                        {isNasiya ? 'Nasiya' : (r.paymentChannel || 'naqd')}
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {isEdit ? (
                      <>
                        <button onClick={() => saveEdit(r)} title="Saqlash"
                          style={{ cursor: 'pointer', background: '#e8f5e9', border: '1px solid #2e7d32', color: '#2e7d32', borderRadius: 3, padding: '2px 7px', marginRight: 4, fontWeight: 'bold' }}>✓</button>
                        <button onClick={cancelEdit} title="Bekor qilish"
                          style={{ cursor: 'pointer', background: '#f5f5f5', border: '1px solid #bbb', color: '#555', borderRadius: 3, padding: '2px 7px' }}>✕</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(r)} title="Tahrirlash"
                          style={{ cursor: 'pointer', background: '#e3f2fd', border: '1px solid #1976d2', color: '#1565c0', borderRadius: 3, padding: '2px 7px', marginRight: 4 }}>✎</button>
                        <button onClick={() => { if (window.confirm("O'chirasizmi? (Sement qoldig'i qaytadi)")) deleteSaleRow(r.id); }}
                          title="O'chirish"
                          style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#c62828' }}>✕</button>
                      </>
                    )}
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

// Jadval ichidagi tahrir maydonlari — qator balandligi o'zgarmasin uchun kichik
const editInp = { width: 78, padding: '2px 4px', fontSize: 13, border: '1px solid #0288d1', borderRadius: 3, fontFamily: 'monospace', textAlign: 'right' };

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
