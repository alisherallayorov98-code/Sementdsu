// ─────────────────────────────────────────────────────────────────────────────
// "Bu yozuv qayerdan keldi?" oynasi — hisobotdagi/mijoz kartochkasidagi bitta
// qatorning to'liq izi: qaysi hujjatdan kelgan, kim va qachon kiritgan, undan
// yana nima yaratilgan. Va eng muhimi — SHU YERDAN tuzatish.
//
// Nima uchun kerak: mijoz kartochkasida xato ko'rinadi, lekin xato qilingan
// yozuv boshqa bo'limda yotadi (yoki umuman ro'yxati yo'q — ulgurji sotuv).
// Bir oydan keyin uni topish deyarli imkonsiz edi.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { kindMeta, rowFields, sourceChain, derivedRows, editHint, fmtCreated } from '../lib/rowSource';
import { parseNum } from '../lib/parseNum';
import CustomerSelect from './CustomerSelect';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };
const DATE_RE = /^\d{2}\.\d{2}\.\d{4}$/;

export default function SourceModal({ kind, row, onClose }) {
  const data = useData();
  const navigate = useNavigate();
  const { updateSaleRow, deleteSaleRow } = data;

  // Zanjir ichida yurish: "manbaga o'tish" bosilganda shu oynaning o'zi
  // o'sha yozuvga almashadi (yangi oyna ochilmaydi).
  const [cur, setCur] = useState({ kind, row });
  const [edit, setEdit] = useState(null);

  const meta    = kindMeta(cur.kind);
  const chain   = sourceChain(cur.kind, cur.row, data);
  const derived = derivedRows(cur.kind, cur.row, data);
  const fields  = rowFields(cur.kind, cur.row);
  const hint    = editHint(cur.kind, cur.row);
  // Ulgurji sotuvning alohida ro'yxati yo'q — shuning uchun aynan shu oynada
  // tahrirlanadi. Qolgan turlar o'z bo'limida tahrirlanadi.
  const canEditHere = cur.kind === 'sale';

  const jump = (k, r) => { if (r) { setEdit(null); setCur({ kind: k, row: r }); } };
  const goSection = () => {
    const m = kindMeta(cur.kind);
    if (!m.route) return;
    onClose();
    navigate(`${m.route}?focus=${cur.row.id}`);
  };

  const startEdit = () => setEdit({
    customer: cur.row.customer || '',
    tons: String(cur.row.tons ?? ''),
    pricePerTon: String(cur.row.pricePerTon ?? ''),
    paymentChannel: cur.row.paymentChannel || 'naqd',
    date: cur.row.date || '',
    note: cur.row.note || '',
  });

  const saveEdit = () => {
    const tonsN  = parseNum(edit.tons);
    const priceN = parseNum(edit.pricePerTon);
    if (!edit.customer) { alert('Mijoz tanlanmagan.'); return; }
    if (!(tonsN > 0))   { alert("Tonna 0 dan katta bo'lishi kerak."); return; }
    if (!(priceN >= 0) || !isFinite(priceN)) { alert("Narx noto'g'ri kiritilgan."); return; }
    if (edit.date && !DATE_RE.test(edit.date)) { alert('Sana dd.mm.yyyy ko\'rinishida bo\'lsin.'); return; }
    if (updateSaleRow(cur.row.id, {
      customer: edit.customer, tons: tonsN, pricePerTon: priceN,
      paymentChannel: edit.paymentChannel, date: edit.date, note: edit.note,
    }) === false) return;
    // Yangilangan qatorni qayta o'qiymiz (avansUsed va h.k. o'zgargan bo'lishi mumkin)
    const fresh = (data.salesRows || []).find(r => r.id === cur.row.id);
    setCur({ kind: 'sale', row: fresh ? { ...fresh, ...{
      customer: edit.customer, tons: tonsN, pricePerTon: priceN,
      paymentChannel: edit.paymentChannel, date: edit.date, note: edit.note,
    } } : cur.row });
    setEdit(null);
    alert('✅ Saqlandi. Qarz/kassa/avans yozuvlari qayta hisoblandi.');
  };

  const removeSale = () => {
    if (!window.confirm(
      `Bu sotuv o'chirilsinmi?\n\n${cur.row.customer} · ${fmtT(cur.row.tons)} tn · ` +
      `${fmt(Number(cur.row.tons || 0) * Number(cur.row.pricePerTon || 0))} so'm\n\n` +
      `Sement qoldig'i qaytadi, undan yaratilgan qarz/kassa yozuvlari ham o'chadi.`
    )) return;
    if (deleteSaleRow(cur.row.id) !== false) { onClose(); }
  };

  return createPortal(
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:4000,
               display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'30px 16px', overflowY:'auto' }}>
      <div style={{ background:'#fff', borderRadius:8, width:'100%', maxWidth:620,
                    boxShadow:'0 12px 40px rgba(0,0,0,0.35)', fontFamily:'Tahoma, Arial, sans-serif' }}>

        {/* Sarlavha */}
        <div style={{ background:'#003366', color:'#fff', padding:'12px 16px', borderRadius:'8px 8px 0 0',
                      display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:'bold', fontSize:15 }}>{meta.icon} {meta.title}</div>
            <div style={{ fontSize:11, opacity:0.85, marginTop:2 }}>Bu yozuv qayerdan keldi va qanday tuzatiladi?</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#fff', fontSize:22, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>

        <div style={{ padding:16 }}>

          {/* Qaysi bo'limda yotadi */}
          <div style={{ fontSize:12, color:'#555', background:'#f5f7fa', borderRadius:6, padding:'8px 10px', marginBottom:12 }}>
            📁 Bo'lim: <b>{meta.section}</b>
            {fmtCreated(cur.row.createdAt || cur.row.id) &&
              <> · 🕒 kiritilgan: <b>{fmtCreated(cur.row.createdAt || cur.row.id)}</b></>}
            {cur.row.worker && <> · 👷 <b>{cur.row.worker}</b></>}
          </div>

          {/* Yozuv maydonlari */}
          {!edit && (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, marginBottom:14 }}>
              <tbody>
                {fields.map((f, i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #f0f0f0' }}>
                    <td style={{ padding:'6px 8px 6px 0', color:'#777', width:150 }}>{f.label}</td>
                    <td style={{ padding:'6px 0', fontWeight:'bold', color:'#333' }}>{f.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Tahrirlash formasi (ulgurji sotuv) */}
          {edit && (
            <div style={{ border:'2px solid #1565c0', borderRadius:6, padding:12, marginBottom:14, background:'#f5fbff' }}>
              <div style={{ fontWeight:'bold', color:'#01579b', marginBottom:10 }}>✎ Sotuvni tahrirlash</div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <L label="Mijoz *" w={230}>
                  <CustomerSelect value={edit.customer} onChange={v => setEdit({ ...edit, customer: v })}
                    placeholder="Mijoz..." width={'100%'} accentColor="#01579b" />
                </L>
                <L label="Sana (dd.mm.yyyy)" w={120}>
                  <input value={edit.date} onChange={e => setEdit({ ...edit, date: e.target.value })} style={inp} placeholder="09.08.2026" />
                </L>
                <L label="Tonna *" w={90}>
                  <input type="number" step="0.01" value={edit.tons} onChange={e => setEdit({ ...edit, tons: e.target.value })} style={inp} />
                </L>
                <L label="Narx (1 tn) *" w={120}>
                  <input type="number" value={edit.pricePerTon} onChange={e => setEdit({ ...edit, pricePerTon: e.target.value })} style={inp} />
                </L>
                <L label="To'lov turi" w={130}>
                  <select value={edit.paymentChannel} onChange={e => setEdit({ ...edit, paymentChannel: e.target.value })} style={inp}>
                    <option value="naqd">💵 Naqd</option>
                    <option value="bank">🏦 Bank</option>
                    <option value="click">📱 Click</option>
                    <option value="nasiya">⚠️ Nasiya</option>
                    <option value="avans">🅰️ Avansdan</option>
                  </select>
                </L>
                <L label="Izoh" w={200}>
                  <input value={edit.note} onChange={e => setEdit({ ...edit, note: e.target.value })} style={inp} />
                </L>
              </div>
              <div style={{ fontSize:11, color:'#e65100', marginTop:10, lineHeight:1.5 }}>
                Saqlanganda bu sotuvdan yaratilgan qarz, kassa kirimi va avans yechimi
                BEKOR QILINIB, yangi qiymatlar bo'yicha qaytadan yoziladi.
              </div>
              <div style={{ display:'flex', gap:8, marginTop:12 }}>
                <button onClick={saveEdit} style={{ ...btn, background:'#2e7d32', color:'#fff', border:'none' }}>✓ Saqlash</button>
                <button onClick={() => setEdit(null)} style={btn}>Bekor</button>
              </div>
            </div>
          )}

          {/* Tahrirlash bo'yicha maslahat */}
          {hint && !edit && (
            <div style={{ fontSize:12, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80',
                          borderRadius:6, padding:'9px 11px', marginBottom:14, lineHeight:1.6 }}>
              ⚠️ {hint}
            </div>
          )}

          {/* Manba zanjiri */}
          {chain.length > 1 && (
            <Block title="🔗 Manba zanjiri — bu yozuv shundan kelib chiqqan">
              {chain.slice(1).map((c, i) => {
                const m = kindMeta(c.kind);
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom:'1px solid #f0f0f0' }}>
                    <span style={{ fontSize:16 }}>{m.icon}</span>
                    <span style={{ flex:1, fontSize:12 }}>
                      <b>{m.title}</b>
                      <span style={{ color:'#888' }}> · {c.row.date || '—'}</span>
                      {c.why && <div style={{ color:'#888', fontSize:11, marginTop:2 }}>{c.why}</div>}
                    </span>
                    <button onClick={() => jump(c.kind, c.row)} style={linkBtn}>Ochish →</button>
                  </div>
                );
              })}
            </Block>
          )}

          {/* Bundan kelib chiqqanlar */}
          {derived.length > 0 && (
            <Block title={cur.kind === 'advance'
              ? '🅰️ Bu avans qayerlarga ishlatilgan'
              : '↳ Bu yozuvdan avtomatik yaratilganlar'}>
              {derived.map((d, i) => {
                const m = kindMeta(d.kind);
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom:'1px solid #f0f0f0' }}>
                    <span style={{ fontSize:16 }}>{m.icon}</span>
                    <span style={{ flex:1, fontSize:12 }}>
                      <b>{m.title}</b> <span style={{ color:'#888' }}>· {d.label}</span>
                      {d.note && <div style={{ color:'#c62828', fontSize:11, marginTop:2 }}>{d.note}</div>}
                    </span>
                    {d.row && <button onClick={() => jump(d.kind, d.row)} style={linkBtn}>Ochish →</button>}
                  </div>
                );
              })}
            </Block>
          )}

          {/* Amallar */}
          {!edit && (
            <div style={{ display:'flex', gap:8, marginTop:16, flexWrap:'wrap' }}>
              {canEditHere && !cur.row.auto && (
                <button onClick={startEdit} style={{ ...btn, background:'#1565c0', color:'#fff', border:'none' }}>
                  ✎ Shu yerda tahrirlash
                </button>
              )}
              {meta.route && (
                <button onClick={goSection} style={{ ...btn, background:'#eef3f8', border:'1px solid #90a4ae', color:'#01579b' }}>
                  🔎 "{meta.section}" bo'limida ochish →
                </button>
              )}
              {canEditHere && !cur.row.auto && (
                <button onClick={removeSale} style={{ ...btn, background:'#ffebee', border:'1px solid #e57373', color:'#c62828', marginLeft:'auto' }}>
                  🗑 O'chirish
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Block({ title, children }) {
  return (
    <div style={{ marginTop:6, marginBottom:12 }}>
      <div style={{ fontSize:12, fontWeight:'bold', color:'#444', background:'#f5f7fa', padding:'6px 10px', borderRadius:'4px 4px 0 0' }}>{title}</div>
      <div style={{ border:'1px solid #eee', borderTop:'none', borderRadius:'0 0 4px 4px', padding:'0 10px' }}>{children}</div>
    </div>
  );
}

function L({ label, w, children }) {
  return (
    <label style={{ display:'block', width:w }}>
      <span style={{ display:'block', fontSize:11, fontWeight:'bold', color:'#555', marginBottom:3 }}>{label}</span>
      {children}
    </label>
  );
}

const inp     = { width:'100%', boxSizing:'border-box', padding:'6px 8px', fontSize:13, border:'1px solid #ccc', borderRadius:4, fontFamily:'Tahoma, sans-serif' };
const btn     = { padding:'8px 16px', fontSize:13, cursor:'pointer', background:'#f5f5f5', border:'1px solid #ccc', borderRadius:6, fontFamily:'Tahoma, sans-serif' };
const linkBtn = { padding:'3px 10px', fontSize:11, cursor:'pointer', background:'#e3f2fd', border:'1px solid #90caf9', color:'#1565c0', borderRadius:4, whiteSpace:'nowrap' };
