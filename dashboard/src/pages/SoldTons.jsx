import { useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import CustomerSelect from '../components/CustomerSelect';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };
const todayFull = () => {
  const d = new Date();
  return [
    String(d.getDate()).padStart(2,'0'),
    String(d.getMonth()+1).padStart(2,'0'),
    d.getFullYear(),
  ].join('.');
};

const XODIMLAR = ['Botir aka','Alisher aka','Ganisher aka','Sharofidin','Saloh','Qosim','Anvarjon'];

const TOLOV = [
  { v:'naqd',   latn:'Naqd',          cyrl:'Нақд'         },
  { v:'bank',   latn:'Bank',          cyrl:'Банк'         },
  { v:'click',  latn:'Click',         cyrl:'Клик'         },
  { v:'nasiya', latn:'Nasiya (qarz)', cyrl:'Насия (қарз)' },
];

const L = {
  mijoz:      { latn:'Mijoz',          cyrl:'Мижоз'          },
  tonna:      { latn:'Tonna',          cyrl:'Тонна'          },
  narx:       { latn:'Narx (1 tn)',    cyrl:'Нарх (1 тн)'    },
  tolov:      { latn:"To'lov usuli",   cyrl:'Тўлов усули'    },
  izoh:       { latn:'Izoh',           cyrl:'Изоҳ'           },
  qoshish:    { latn:"Qo'shish",       cyrl:'Қўшиш'          },
  sana:       { latn:'Sana',           cyrl:'Сана'           },
  jami_summa: { latn:'Jami summa',     cyrl:'Жами сумма'     },
  jami_ton:   { latn:'Jami tonna',     cyrl:'Жами тонна'     },
  qarz:       { latn:'Qarz (nasiya)',  cyrl:'Қарз (насия)'   },
  qarz_jami:  { latn:'Jami qarz',      cyrl:'Жами қарз'      },
  xodim:      { latn:'Xodim',          cyrl:'Ходим'          },
  jami:       { latn:'JAMI',           cyrl:'ЖАМИ'           },
  ochirish:   { latn:"O'chirish",      cyrl:'Ўчириш'         },
  yoq:        { latn:'Yozuv topilmadi.',cyrl:'Ёзув топилмади.'},

  // Modal
  tarixi:     { latn:'Qarz tarixi va Akt Sverka', cyrl:'Қарз тарихи ва Акт Сверка' },
  xaridlar:   { latn:'Xaridlar (nasiya)',         cyrl:'Харидлар (насия)'           },
  tolovlar:   { latn:"To'lovlar",                 cyrl:'Тўловлар'                   },
  qolgan:     { latn:'Qolgan qarz',               cyrl:'Қолган қарз'                },
  chop:       { latn:'Chop etish',                cyrl:'Чоп этиш'                   },
  yopish:     { latn:'Yopish',                    cyrl:'Yopish'                     },
  tolash:     { latn:"To'lash",                   cyrl:'Тўлаш'                      },
  tolash_sum: { latn:"To'lov summasi",             cyrl:'Тўлов суммаси'              },

  // Akt sverka
  akt_title:  { latn:'AKT SVERKA',                cyrl:'АКТ СВЕРКА'                 },
  akt_tuz:    { latn:'Tuzilgan sana:',             cyrl:'Тузилган сана:'             },
  akt_kim:    { latn:"Tashkilot nomi: SEMENT KORXONA", cyrl:"Ташкилот номи: СЕМЕНТ КОРХОНА" },
  akt_mijoz:  { latn:'Mijoz:',                    cyrl:'Мижоз:'                     },
  akt_hisobi: { latn:'Hisob-kitob:',              cyrl:'Ҳисоб-китоб:'               },
  akt_xarid:  { latn:'Xarid',                     cyrl:'Харид'                      },
  akt_tolov:  { latn:"To'lov",                    cyrl:'Тўлов'                      },
  akt_qoldi:  { latn:'QOLDIQ QARZ:',              cyrl:'ҚОЛДИҚ ҚАРЗ:'               },
  akt_imzo:   { latn:'Imzolar:',                  cyrl:'Имзолар:'                   },
  akt_kassa:  { latn:'Kassir: _______________',   cyrl:'Кассир: _______________'    },
  akt_mij:    { latn:'Mijoz:   _______________',  cyrl:'Мижоз:   _______________'   },
};

export default function SoldTons({ lang }) {
  const {
    soldRows, addSoldRow, deleteSoldRow,
    debtRows, addDebtRow, payDebt, deleteDebtRow,
    currentWorker, setCurrentWorker,
  } = useData();

  const [form, setForm]               = useState({ mijoz:'', tonna:'', narx:'', tolov:'naqd', izoh:'' });
  const [modalCustomer, setModalCustomer] = useState(null);
  const [payForm, setPayForm]             = useState({ debtId: null, amount: '' });
  const printRef = useRef();

  // ── Sotish (qo'shish) ─────────────────────────────────────────────────────
  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.mijoz || !form.tonna || !form.narx) return;
    addSoldRow({
      customer: form.mijoz, tons: form.tonna,
      pricePerTon: form.narx, paymentChannel: form.tolov,
      izoh: form.izoh,
    });
    // Nasiya bo'lsa → qarz yaratish
    if (form.tolov === 'nasiya') {
      const amt  = Number(form.tonna) * Number(form.narx);
      const note = `${fmtT(form.tonna)} tn × ${fmt(form.narx)} so'm/tn` + (form.izoh ? ` · ${form.izoh}` : '');
      addDebtRow(form.mijoz, amt, note);
    }
    setForm({ mijoz:'', tonna:'', narx:'', tolov:'naqd', izoh:'' });
  };

  // ── Mijozning joriy umumiy qarzi ──────────────────────────────────────────
  const getCustomerDebt = (name) =>
    debtRows.filter(d => d.customer === name)
            .reduce((s, d) => s + Math.max(0, Number(d.amount) - Number(d.paid)), 0);

  // ── Jami ko'rsatkichlar ───────────────────────────────────────────────────
  const totalTons    = soldRows.reduce((s,r) => s + Number(r.tons||0), 0);
  const totalSum     = soldRows.reduce((s,r) => s + Number(r.tons||0)*Number(r.pricePerTon||0), 0);
  const totalNasiya  = soldRows.filter(r => r.paymentChannel==='nasiya')
                               .reduce((s,r) => s + Number(r.tons||0)*Number(r.pricePerTon||0), 0);

  // ── Akt Sverka chop etish ─────────────────────────────────────────────────
  const handlePrint = () => {
    const content  = printRef.current.innerHTML;
    const win      = window.open('','_blank');
    win.document.write(`
      <html><head><title>Akt Sverka - ${modalCustomer}</title>
      <style>
        body { font-family: Times New Roman, serif; margin: 30px; color:#000; }
        h2 { text-align:center; text-transform:uppercase; }
        table { width:100%; border-collapse:collapse; margin:10px 0; }
        th,td { border:1px solid #000; padding:5px 8px; font-size:12px; }
        th { background:#f0f0f0; font-weight:bold; }
        .total-row { background:#ffff00; font-weight:bold; font-size:14px; }
        .debt-big { font-size:18px; font-weight:bold; color:#c00; }
        .sign { display:flex; justify-content:space-between; margin-top:40px; }
        @media print { button { display:none; } }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.print();
  };

  // ── Nasiya to'lash ────────────────────────────────────────────────────────
  const handlePay = (debtId) => {
    if (payForm.debtId === debtId && payForm.amount) {
      payDebt(debtId, payForm.amount);
      setPayForm({ debtId: null, amount: '' });
    } else {
      setPayForm({ debtId, amount: '' });
    }
  };



  const inp = { padding:'3px 6px', fontFamily:'Tahoma, sans-serif', fontSize:12, border:'2px inset #ffffff' };
  const btnS = { padding:'3px 12px', fontFamily:'Tahoma, sans-serif', fontSize:12, cursor:'pointer', border:'2px outset #ffffff', background:'#f0f0f0' };

  // ── Modal: Mijoz qarz tarixi + Akt Sverka ─────────────────────────────────
  const renderModal = () => {
    if (!modalCustomer) return null;
    const custDebts  = debtRows.filter(d => d.customer === modalCustomer);
    const custSales  = soldRows.filter(r => r.customer === modalCustomer);
    const totalDebt  = custDebts.reduce((s,d) => s+Number(d.amount), 0);
    const totalPaid  = custDebts.reduce((s,d) => s+Number(d.paid||0), 0);
    const remaining  = totalDebt - totalPaid;

    return (
      <div style={{
        position:'fixed', top:0, left:0, width:'100%', height:'100%',
        background:'rgba(0,0,0,0.5)', zIndex:1000,
        display:'flex', alignItems:'flex-start', justifyContent:'center',
        paddingTop: 30, boxSizing:'border-box', overflowY:'auto',
      }} onClick={e => { if(e.target===e.currentTarget) setModalCustomer(null); }}>
        <div style={{
          background:'#fff', border:'2px solid #003366',
          width:'90%', maxWidth:860, maxHeight:'90vh', overflowY:'auto',
          boxShadow:'4px 4px 16px rgba(0,0,0,0.4)',
        }}>
          {/* Modal header */}
          <div style={{ background:'#003366', color:'#fff', padding:'8px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <b style={{ fontSize:14 }}>{L.tarixi[lang]}: {modalCustomer}</b>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={handlePrint} style={{ ...btnS, background:'#006600', color:'#fff', fontWeight:'bold' }}>
                🖨 {L.chop[lang]}
              </button>
              <button onClick={() => setModalCustomer(null)} style={{ ...btnS, background:'#cc0000', color:'#fff' }}>
                ✕ {L.yopish[lang]}
              </button>
            </div>
          </div>

          {/* Printable content */}
          <div ref={printRef} style={{ padding:'16px 20px', fontFamily:'Tahoma, sans-serif', fontSize:13 }}>

            {/* ─── AKT SVERKA sarlavhasi ─── */}
            <h2 style={{ textAlign:'center', fontSize:17, margin:'0 0 4px', textTransform:'uppercase' }}>
              {L.akt_title[lang]}
            </h2>
            <p style={{ textAlign:'center', margin:'2px 0 10px', fontSize:12, color:'#555' }}>
              {L.akt_kim[lang]}<br/>
              {L.akt_mijoz[lang]} <b>{modalCustomer}</b> &nbsp;|&nbsp;
              {L.akt_tuz[lang]} <b>{todayFull()}</b>
            </p>

            {/* ─── Barcha xaridlar jadval ─── */}
            <p style={{ fontWeight:'bold', marginBottom:4 }}>{L.xaridlar[lang]}:</p>
            <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:12 }}>
              <thead>
                <tr style={{ background:'#f0f0f0' }}>
                  <th style={thS}>#</th>
                  <th style={thS}>{L.sana[lang]}</th>
                  <th style={thS}>{L.tonna[lang]}</th>
                  <th style={{ ...thS, textAlign:'right' }}>{L.narx[lang]}</th>
                  <th style={{ ...thS, textAlign:'right' }}>{L.jami_summa[lang]}</th>
                  <th style={{ ...thS }}>{L.tolov[lang]}</th>
                  <th style={{ ...thS }}>{L.izoh[lang]}</th>
                </tr>
              </thead>
              <tbody>
                {custSales.map((r, i) => {
                  const sum = Number(r.tons||0) * Number(r.pricePerTon||0);
                  const isNasiya = r.paymentChannel === 'nasiya';
                  return (
                    <tr key={r.id} style={{ background: isNasiya ? '#fff5ee' : '#fff' }}>
                      <td style={tdS}>{i+1}</td>
                      <td style={tdS}>{r.date}</td>
                      <td style={{ ...tdS, textAlign:'right', fontWeight:'bold' }}>{fmtT(r.tons)} tn</td>
                      <td style={{ ...tdS, textAlign:'right' }}>{fmt(r.pricePerTon)}</td>
                      <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color: isNasiya?'#cc0000':'#006600' }}>
                        {fmt(sum)}
                      </td>
                      <td style={{ ...tdS, color: isNasiya?'#cc0000':'#333', fontWeight: isNasiya?'bold':'normal' }}>
                        {r.paymentChannel}
                      </td>
                      <td style={tdS}>{r.izoh || '—'}</td>
                    </tr>
                  );
                })}
                <tr style={{ background:'#fffde8', fontWeight:'bold' }}>
                  <td colSpan={2} style={tdS}>Jami:</td>
                  <td style={{ ...tdS, textAlign:'right' }}>
                    {fmtT(custSales.reduce((s,r)=>s+Number(r.tons||0),0))} tn
                  </td>
                  <td style={tdS}></td>
                  <td style={{ ...tdS, textAlign:'right' }}>
                    {fmt(custSales.reduce((s,r)=>s+Number(r.tons||0)*Number(r.pricePerTon||0),0))}
                  </td>
                  <td colSpan={2} style={tdS}></td>
                </tr>
              </tbody>
            </table>

            {/* ─── Qarz to'lovlar jadval ─── */}
            {custDebts.length > 0 && (
              <>
                <p style={{ fontWeight:'bold', marginBottom:4 }}>{L.tolovlar[lang]}:</p>
                <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:12 }}>
                  <thead>
                    <tr style={{ background:'#f0f0f0' }}>
                      <th style={thS}>#</th>
                      <th style={thS}>{L.sana[lang]}</th>
                      <th style={thS}>{L.izoh[lang]}</th>
                      <th style={{ ...thS, textAlign:'right' }}>Qarz</th>
                      <th style={{ ...thS, textAlign:'right', color:'#006600' }}>To'landi</th>
                      <th style={{ ...thS, textAlign:'right', color:'#cc0000' }}>Qolgan</th>
                      <th style={thS}>Amal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {custDebts.map((d, i) => {
                      const left = Math.max(0, Number(d.amount) - Number(d.paid||0));
                      return (
                        <tr key={d.id} style={{ background: left<=0?'#e8ffe8':'#fff' }}>
                          <td style={tdS}>{i+1}</td>
                          <td style={tdS}>{d.date}</td>
                          <td style={tdS}>{d.note || '—'}</td>
                          <td style={{ ...tdS, textAlign:'right' }}>{fmt(d.amount)}</td>
                          <td style={{ ...tdS, textAlign:'right', color:'#006600', fontWeight:'bold' }}>{fmt(d.paid||0)}</td>
                          <td style={{ ...tdS, textAlign:'right', color:'#cc0000', fontWeight:'bold' }}>{fmt(left)}</td>
                          <td style={tdS}>
                            {payForm.debtId === d.id ? (
                              <span style={{ display:'flex', gap:3 }}>
                                <input
                                  type="number"
                                  placeholder="Summa"
                                  value={payForm.amount}
                                  onChange={e => setPayForm({...payForm, amount:e.target.value})}
                                  style={{ width:90, padding:'2px 4px', fontSize:11 }}
                                />
                                <button onClick={() => handlePay(d.id)} style={{ cursor:'pointer', background:'#ccffcc', border:'1px solid #060', padding:'2px 5px', fontSize:11 }}>✓</button>
                                <button onClick={() => setPayForm({debtId:null,amount:''})} style={{ cursor:'pointer', background:'#ffcccc', border:'1px solid #c00', padding:'2px 5px', fontSize:11 }}>✕</button>
                              </span>
                            ) : (
                              <span style={{ display:'flex', gap:3 }}>
                                {left > 0 && (
                                  <button onClick={() => handlePay(d.id)} style={{ cursor:'pointer', background:'#ffffcc', border:'1px solid #990', fontSize:11, padding:'2px 6px' }}>
                                    {L.tolash[lang]}
                                  </button>
                                )}
                                <button onClick={() => deleteDebtRow(d.id)} style={{ cursor:'pointer', background:'#ffcccc', border:'1px solid #c00', fontSize:10, padding:'2px 5px' }}>✕</button>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}

            {/* ─── Jami qarz holati ─── */}
            <table style={{ borderCollapse:'collapse', marginBottom:20 }}>
              <tbody>
                <tr>
                  <td style={{ border:'1px solid #999', padding:'6px 14px', background:'#fff0f0' }}>
                    <b style={{ color:'#333' }}>Jami nasiya berildi:</b>
                  </td>
                  <td style={{ border:'1px solid #999', padding:'6px 14px', background:'#fff0f0', fontFamily:'monospace', fontWeight:'bold' }}>
                    {fmt(totalDebt)} so'm
                  </td>
                  <td style={{ border:'1px solid #999', padding:'6px 14px', background:'#e8ffe8' }}>
                    <b style={{ color:'#006600' }}>To'landi:</b>
                  </td>
                  <td style={{ border:'1px solid #999', padding:'6px 14px', background:'#e8ffe8', fontFamily:'monospace', fontWeight:'bold', color:'#006600' }}>
                    {fmt(totalPaid)} so'm
                  </td>
                  <td style={{ border:'2px solid #cc0000', padding:'6px 14px', background:'#cc0000' }}>
                    <b style={{ color:'#fff' }}>{L.akt_qoldi[lang]}</b>
                  </td>
                  <td style={{ border:'2px solid #cc0000', padding:'8px 16px', background:'#fff0f0', fontFamily:'monospace', fontWeight:'bold', color:'#cc0000', fontSize:16 }}>
                    {fmt(remaining)} so'm
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ─── Imzo ─── */}
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:30, paddingTop:10, borderTop:'1px solid #999' }}>
              <span style={{ fontSize:13 }}>{L.akt_kassa[lang]}</span>
              <span style={{ fontSize:13 }}>{L.akt_mij[lang]}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Asosiy sahifa ──────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:'Tahoma, Verdana, Arial, sans-serif', fontSize:13 }}>

      {/* ── Forma ── */}
      <form onSubmit={handleAdd} style={{ display:'flex', gap:5, marginBottom:12, alignItems:'center', flexWrap:'wrap' }}>
        {/* Mijoz - CustomerSelect */}
        <CustomerSelect
          value={form.mijoz}
          onChange={name => setForm({...form, mijoz: name})}
          placeholder={L.mijoz[lang]}
          accentColor="#003366"
          required
        />
        <input
          type="number" placeholder={L.tonna[lang]} value={form.tonna}
          onChange={e => setForm({...form, tonna:e.target.value})}
          style={{ ...inp, width:90 }} required
        />
        <input
          type="number" placeholder={L.narx[lang]} value={form.narx}
          onChange={e => setForm({...form, narx:e.target.value})}
          style={{ ...inp, width:120 }} required
        />
        <select
          value={form.tolov}
          onChange={e => setForm({...form, tolov:e.target.value})}
          style={{ ...inp, fontWeight:'bold', color: form.tolov==='nasiya'?'#cc0000':'#006600' }}
        >
          {TOLOV.map(t => <option key={t.v} value={t.v}>{t[lang==='cyrl'?'cyrl':'latn']}</option>)}
        </select>
        <input
          placeholder={L.izoh[lang]} value={form.izoh}
          onChange={e => setForm({...form, izoh:e.target.value})}
          style={{ ...inp, width:180 }}
        />
        <select
          value={currentWorker}
          onChange={e => setCurrentWorker(e.target.value)}
          style={{ ...inp, color:currentWorker?'#003366':'#999', fontWeight:currentWorker?'bold':'normal' }}
        >
          <option value="">— xodim —</option>
          {XODIMLAR.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
        <button type="submit" style={{ ...inp, border:'2px outset #ffffff', cursor:'pointer', background:'#003366', color:'#fff', fontWeight:'bold', padding:'3px 16px' }}>
          {L.qoshish[lang]}
        </button>
      </form>

      {/* ── Yuqori statistika ── */}
      <table style={{ borderCollapse:'collapse', marginBottom:12 }}>
        <tbody>
          <tr>
            <td style={{ border:'1px solid #999', padding:'5px 14px', background:'#f0f8ff', textAlign:'center', minWidth:160 }}>
              <div style={{ fontSize:11, fontWeight:'bold', color:'#003366' }}>{L.jami_ton[lang]}</div>
              <div style={{ fontSize:15, fontWeight:'bold', color:'#003366', fontFamily:'monospace' }}>{fmtT(totalTons)} tn</div>
            </td>
            <td style={{ border:'1px solid #999', padding:'5px 14px', background:'#f0fff0', textAlign:'center', minWidth:180 }}>
              <div style={{ fontSize:11, fontWeight:'bold', color:'#006600' }}>{L.jami_summa[lang]}</div>
              <div style={{ fontSize:15, fontWeight:'bold', color:'#006600', fontFamily:'monospace' }}>{fmt(totalSum)} so'm</div>
            </td>
            <td style={{ border:'2px solid #cc0000', padding:'5px 14px', background:'#fff0f0', textAlign:'center', minWidth:180 }}>
              <div style={{ fontSize:11, fontWeight:'bold', color:'#cc0000' }}>{L.qarz[lang]}</div>
              <div style={{ fontSize:15, fontWeight:'bold', color:'#cc0000', fontFamily:'monospace' }}>{fmt(totalNasiya)} so'm</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Asosiy jadval ── */}
      {soldRows.length === 0 ? (
        <p style={{ color:'#666', fontStyle:'italic' }}>{L.yoq[lang]}</p>
      ) : (
        <table className="data-table" style={{ width:'100%' }}>
          <thead>
            <tr>
              <th style={{ width:30 }}>#</th>
              <th style={{ width:85 }}>{L.sana[lang]}</th>
              <th style={{ width:130 }}>{L.mijoz[lang]}</th>
              <th style={{ textAlign:'right', width:80 }}>{L.tonna[lang]}</th>
              <th style={{ textAlign:'right', width:120 }}>{L.narx[lang]}</th>
              <th style={{ textAlign:'right', width:140 }}>{L.jami_summa[lang]}</th>
              <th style={{ width:85 }}>{L.tolov[lang]}</th>
              <th>{L.izoh[lang]}</th>
              <th style={{ width:130, color:'#cc0000' }}>{L.qarz[lang]}</th>
              <th style={{ width:115 }}>{L.xodim[lang]}</th>
              <th style={{ width:40 }}></th>
            </tr>
          </thead>
          <tbody>
            {[...soldRows].reverse().map((r, i) => {
              const sum      = Number(r.tons||0) * Number(r.pricePerTon||0);
              const isNasiya = r.paymentChannel === 'nasiya';
              const custDebt = isNasiya ? getCustomerDebt(r.customer) : 0;
              const rowBg    = isNasiya ? '#fff5ee' : (i%2===0?'#fff':'#f9f9f9');
              return (
                <tr key={r.id} style={{ background:rowBg }}>
                  <td style={{ textAlign:'center', color:'#888', fontSize:11 }}>{soldRows.length - i}</td>
                  <td style={{ fontSize:12 }}>{r.date}</td>
                  <td style={{ fontWeight:'bold', color:'#003366' }}>
                    {isNasiya ? (
                      <button
                        onClick={() => setModalCustomer(r.customer)}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'#003366', fontWeight:'bold', fontSize:13, padding:0, textDecoration:'underline' }}
                      >
                        {r.customer}
                      </button>
                    ) : r.customer}
                  </td>
                  <td style={{ textAlign:'right', fontWeight:'bold', fontFamily:'monospace' }}>{fmtT(r.tons)}</td>
                  <td style={{ textAlign:'right', fontFamily:'monospace' }}>{fmt(r.pricePerTon)}</td>
                  <td style={{ textAlign:'right', fontWeight:'bold', color: isNasiya?'#cc0000':'#006600', fontFamily:'monospace', fontSize:13 }}>
                    {fmt(sum)}
                  </td>
                  <td style={{ fontWeight: isNasiya?'bold':'normal', color: isNasiya?'#cc0000':'#333' }}>
                    {r.paymentChannel}
                  </td>
                  <td style={{ fontSize:12, color:'#555' }}>{r.izoh || '—'}</td>
                  <td>
                    {isNasiya && custDebt > 0 ? (
                      <button
                        onClick={() => setModalCustomer(r.customer)}
                        style={{
                          background:'#cc0000', color:'#fff', border:'none',
                          cursor:'pointer', fontWeight:'bold', fontSize:12,
                          padding:'2px 8px', borderRadius:3, fontFamily:'monospace',
                        }}
                        title="Bosing → Akt Sverka"
                      >
                        {fmt(custDebt)} ↗
                      </button>
                    ) : isNasiya && custDebt <= 0 ? (
                      <span style={{ color:'#006600', fontWeight:'bold', fontSize:12 }}>✓ To'landi</span>
                    ) : <span style={{ color:'#999' }}>—</span>}
                  </td>
                  <td style={{ fontSize:11, color:'#003366', fontWeight:r.worker?'bold':'normal' }}>
                    {r.worker || '—'}
                  </td>
                  <td>
                    <button
                      onClick={() => { if(window.confirm('O\'chirilsinmi?')) deleteSoldRow(r.id); }}
                      style={{ fontSize:10, cursor:'pointer', background:'#ffcccc', border:'1px solid #c00', padding:'2px 5px' }}
                    >✕</button>
                  </td>
                </tr>
              );
            })}
            <tr style={{ background:'#ffff00', fontWeight:'bold' }}>
              <td colSpan={3} style={{ textAlign:'right' }}>{L.jami[lang]}</td>
              <td style={{ textAlign:'right', fontFamily:'monospace' }}>{fmtT(totalTons)} tn</td>
              <td></td>
              <td style={{ textAlign:'right', fontFamily:'monospace' }}>{fmt(totalSum)}</td>
              <td colSpan={5}></td>
            </tr>
          </tbody>
        </table>
      )}

      {/* ── Modal: Mijoz qarz tarixi ── */}
      {renderModal()}
    </div>
  );
}

const thS = { border:'1px solid #999', padding:'5px 8px', background:'#f0f0f0', fontWeight:'bold', fontSize:12, textAlign:'left' };
const tdS = { border:'1px solid #ccc', padding:'5px 8px', fontSize:12 };
