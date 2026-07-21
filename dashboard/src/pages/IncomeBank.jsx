import { useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { useData } from '../context/DataContext';
import { api } from '../api';
import CustomerSelect from '../components/CustomerSelect';
import DateRangeFilter from '../components/DateRangeFilter';
import { filterByRange } from '../lib/dateRange';
import Paginator from '../components/Paginator';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');

const todayStr = () => {
  const d = new Date();
  return [String(d.getDate()).padStart(2,'0'), String(d.getMonth()+1).padStart(2,'0'), d.getFullYear()].join('.');
};

const parseNum = (v) =>
  Number(String(v ?? '').replace(/\s/g, '').replace(/,/g, '.')) || 0;

// ─── ASOSIY KOMPONENT ────────────────────────────────────────────────────────
export default function IncomeBank({ lang }) {
  const {
    bankOpening, setBankOpening,
    bankIncomeRows,  addBankIncomeRow,  deleteBankIncomeRow,  totalBankIncome,
    bankExpenseRows, addBankExpenseRow, deleteBankExpenseRow, totalBankExpense,
    totalBankBalance,
    bankPendingRows, importOborotka, confirmBankPendingRow, deleteBankPendingRow,
    payCustomerDebt, addAdvanceRow, debtRows,
  } = useData();

  // Kirim/chiqim natijasi haqida qisqa xabar
  const [msg, setMsg] = useState('');
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  // ── Bank KIRIM — Kassir bilan bir xil integratsiya ────────────────────────
  // Mijoz tanlansa: pul avval QARZni yopadi (eng eskisidan), ortig'i AVANSga
  // yoziladi. Mijoz tanlanmasa: oddiy bank kirim (bankIncomeRows).
  // Shu tariqa mijoz puli hech qachon "osilib" qolmaydi.
  const submitBankIncome = (e) => {
    e.preventDefault();
    const amt = parseNum(incForm.amount);
    if (!amt) return;
    const customer = (incForm.customer || '').trim();
    if (customer) {
      const custDebt = debtRows.filter(r => r.customer === customer)
        .reduce((s, r) => s + Math.max(0, Number(r.amount || 0) - Number(r.paid || 0)), 0);
      const res = payCustomerDebt(customer, amt, 'bank', incForm.desc);
      if (res.applied === 0) {
        addAdvanceRow(customer, amt, incForm.desc, 'bank');
        flash(`${fmt(amt)} so'm — qarzi yo'q, avans sifatida qabul qilindi`);
      } else if (res.leftover > 0) {
        addAdvanceRow(customer, res.leftover, `${incForm.desc} (ortiqcha)`, 'bank');
        flash(`${fmt(res.applied)} so'm qarzga · ${fmt(res.leftover)} so'm avansga`);
      } else {
        flash(`${fmt(res.applied)} so'm qarz to'lovi qabul qilindi`);
      }
      if (res.applied > 0) {
        const remainDebt = Math.max(0, custDebt - res.applied);
        api.notifyCustomerPayment(customer, res.applied, 'bank', remainDebt).catch(() => {});
      }
    } else {
      addBankIncomeRow(amt, incForm.desc, todayS, '');
      flash(`+${fmt(amt)} so'm bank kirim`);
    }
    setIncForm({ amount: '', desc: '', customer: '' });
  };

  const [activeTab,    setActiveTab]    = useState('pending'); // pending | kirim | chiqim
  const [range,        setRange]        = useState({ from: '', to: '' });
  const [editOpening,  setEditOpening]  = useState(false);
  const [openingVal,   setOpeningVal]   = useState(String(bankOpening.amount));

  // Balans tekshiruvi (oborotka faylidan olingan)
  const [oborotBal, setOborotBal] = useState(null); // { opening, closing }

  // Pending qatorlar uchun lokal tahrir holati
  const [pendingEdits, setPendingEdits] = useState({}); // { [id]: { customer, izoh } }
  const getEdit = (id) => pendingEdits[id] || { customer: '', izoh: '' };
  const setEdit = (id, patch) => setPendingEdits(p => ({ ...p, [id]: { ...getEdit(id), ...patch } }));

  // Qo'lda kiritish formalari
  const [incForm, setIncForm] = useState({ amount: '', desc: '', customer: '' });
  const [expForm, setExpForm] = useState({ amount: '', desc: '', customer: '' });

  // Filterlar
  const [incPage, setIncPage] = useState(1);
  const [expPage, setExpPage] = useState(1);
  const PAGE = 100;

  // ── Oborotka Excel parser ─────────────────────────────────────────────────
  const handleOborotka = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Ochilish va yopilish qoldig'i
        let openingBal = 0, closingBal = 0;
        for (const row of raw) {
          const text = String(row.join(' '));
          const mO = text.match(/нач[^:]*[:\s]+([0-9][0-9\s,.]+)/i);
          if (mO) openingBal = parseNum(mO[1].replace(/\s/g,''));
          const mC = text.match(/кон[^:]*[:\s]+([0-9][0-9\s,.]+)/i);
          if (mC) closingBal = parseNum(mC[1].replace(/\s/g,''));
        }

        // Sarlavha qatorini topish
        let hIdx = -1;
        for (let i = 0; i < raw.length; i++) {
          if (raw[i].some(c => /дата|date/i.test(String(c)))) { hIdx = i; break; }
        }
        if (hIdx < 0) { alert('Jadval boshi (Дата ustuni) topilmadi'); return; }

        const hdrs = raw[hIdx].map(c => String(c).toLowerCase().replace(/\s+/g,' ').trim());
        const col = (...keys) => {
          for (const k of keys) {
            const i = hdrs.findIndex(h => h.includes(k));
            if (i >= 0) return i;
          }
          return -1;
        };

        const iDate   = col('дата', 'date');
        const iOrg    = col('счет', 'инн', 'контраг', 'отправ', 'получат');
        const iDebet  = col('дебет', 'debet', 'расход');
        const iKredit = col('кредит', 'kredit', 'приход');
        const iNazn   = col('назначение', 'описание', 'izoh', 'наз');

        const rows = [];
        for (let i = hIdx + 1; i < raw.length; i++) {
          const row = raw[i];
          const rawDate = row[iDate];
          if (!rawDate && !row.some(c => c !== '')) continue;

          const debet  = iDebet  >= 0 ? parseNum(row[iDebet])  : 0;
          const kredit = iKredit >= 0 ? parseNum(row[iKredit]) : 0;
          if (!debet && !kredit) continue;

          // Tashkilot nomini ajratish: "12345/INN/TASHKILOT NOMI" → "TASHKILOT NOMI"
          const orgFull = String(row[iOrg] ?? '').trim();
          const parts   = orgFull.split('/');
          const orgName = parts.length >= 3 ? parts.slice(2).join('/').trim() : orgFull;
          const naznachenie = iNazn >= 0 ? String(row[iNazn] ?? '').trim() : '';

          // Sanani formatlash
          let dateStr = '';
          if (typeof rawDate === 'number' && rawDate > 1000) {
            // Excel serial sana
            const info = XLSX.SSF.parse_date_code(rawDate);
            dateStr = `${String(info.d).padStart(2,'0')}.${String(info.m).padStart(2,'0')}.${info.y}`;
          } else {
            // "01.06.2026 9:07" → "01.06.2026"
            dateStr = String(rawDate).trim().slice(0, 10).replace(/\s.*/,'');
          }

          // Bizning oborotkada: Kredit = kirim, Debet = chiqim
          if (kredit > 0) rows.push({ date: dateStr, orgName, amount: kredit, type: 'kirim',  naznachenie });
          if (debet  > 0) rows.push({ date: dateStr, orgName, amount: debet,  type: 'chiqim', naznachenie });
        }

        if (!rows.length) { alert("Oborotkadan hech qanday summa topilmadi.\nDebet/Kredit ustunlari nomi to'g'rimi?"); return; }

        setOborotBal({ opening: openingBal, closing: closingBal });
        importOborotka(rows);
        setActiveTab('pending');
      } catch (err) {
        console.error(err);
        alert("Excel o'qishda xato: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Hamma pendinglarni tasdiqlash (mijoz tanlanmaganlari ham)
  const confirmAll = () => {
    bankPendingRows.forEach(r => {
      const e = getEdit(r.id);
      confirmBankPendingRow(r.id, { customer: e.customer, izoh: e.izoh });
    });
    setPendingEdits({});
  };

  // ── Statistika ─────────────────────────────────────────────────────────────
  const todayS = todayStr();
  const todayInc = bankIncomeRows.filter(r => r.date === todayS).reduce((s,r) => s + Number(r.amount||0), 0);
  const todayExp = bankExpenseRows.filter(r => r.date === todayS).reduce((s,r) => s + Number(r.amount||0), 0);

  // Balans hisob
  const computedBal = Number(bankOpening.amount) + totalBankIncome - totalBankExpense;
  const balDiff     = oborotBal ? computedBal - oborotBal.closing : null;

  // Pending jami
  const pendKirim  = bankPendingRows.filter(r => r.type === 'kirim').reduce((s,r) => s + r.amount, 0);
  const pendChiqim = bankPendingRows.filter(r => r.type === 'chiqim').reduce((s,r) => s + r.amount, 0);

  // Filterlangan jadvallar
  const sortedInc = [...bankIncomeRows].sort((a,b) => (b.createdAt||b.id) - (a.createdAt||a.id));
  const sortedExp = [...bankExpenseRows].sort((a,b) => (b.createdAt||b.id) - (a.createdAt||a.id));
  const filtInc   = filterByRange(sortedInc, range);
  const filtExp   = filterByRange(sortedExp, range);
  const filtIncTotal = filtInc.reduce((s,r) => s + Number(r.amount||0), 0);
  const filtExpTotal = filtExp.reduce((s,r) => s + Number(r.amount||0), 0);

  const inp = { padding:'4px 6px', fontSize:12, fontFamily:'Tahoma,sans-serif', border:'1px solid #ccc', borderRadius:3 };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:'Tahoma,Verdana,Arial,sans-serif', fontSize:13 }}>

      {/* ── STATISTIKA PANELI ──────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:10, marginBottom:12, flexWrap:'wrap' }}>
        <StatCard label="Ochilish qoldig'i" value={fmt(bankOpening.amount)} color="#555" bg="#f5f5f5"
          sub={bankOpening.date} onEdit={() => setEditOpening(v => !v)} />
        <StatCard label="Jami kirim" value={fmt(totalBankIncome)} color="#0d47a1" bg="#e3f2fd"
          arrow="↑" sub={`Bugun: ${fmt(todayInc)}`} />
        <StatCard label="Jami chiqim" value={fmt(totalBankExpense)} color="#b71c1c" bg="#ffebee"
          arrow="↓" sub={`Bugun: ${fmt(todayExp)}`} />
        <StatCard label="Bank qoldig'i" value={fmt(computedBal)}
          color={computedBal >= 0 ? '#1b5e20' : '#b71c1c'}
          bg={computedBal >= 0 ? '#e8f5e9' : '#ffebee'}
          sub="Ochilish + kirim − chiqim" bold />
        {bankPendingRows.length > 0 && (
          <StatCard label={`Tasdiqlanmagan (${bankPendingRows.length} ta)`}
            value={`+${fmt(pendKirim)} / −${fmt(pendChiqim)}`}
            color="#e65100" bg="#fff3e0" sub="Tasdiqlash kutmoqda" />
        )}
      </div>

      {/* ── OCHILISH TAHRIRLASH ───────────────────────────────────────────── */}
      {editOpening && (
        <div style={{ marginBottom:12, padding:'8px 12px', background:'#fff8e1', border:'1px solid #fbc02d', borderRadius:4, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:12, fontWeight:'bold' }}>Kun boshi qoldig'i (bir marta kiritiladi):</span>
          <input type="text" placeholder="dd.mm.yyyy" value={bankOpening.date}
            onChange={e => setBankOpening(p => ({ ...p, date: e.target.value }))}
            style={{ ...inp, width:100 }} />
          <input type="number" placeholder="Summa" value={openingVal}
            onChange={e => setOpeningVal(e.target.value)}
            style={{ ...inp, width:160 }} />
          <button onClick={() => { setBankOpening({ date: bankOpening.date, amount: Number(openingVal) }); setEditOpening(false); }}
            style={{ ...inp, background:'#003366', color:'#fff', border:'none', cursor:'pointer', padding:'4px 14px', fontWeight:'bold' }}>
            ✓ Saqlash
          </button>
          <button onClick={() => setEditOpening(false)}
            style={{ ...inp, background:'#ffcccc', border:'1px solid #c00', cursor:'pointer' }}>✕</button>
        </div>
      )}

      {/* ── OBOROTKA BALANS TEKSHIRUVI ────────────────────────────────────── */}
      {oborotBal && (
        <div style={{ marginBottom:12, padding:'10px 14px', background: balDiff === 0 ? '#e8f5e9' : '#fff3e0', border:`1px solid ${balDiff === 0 ? '#4caf50' : '#ff9800'}`, borderRadius:4 }}>
          <div style={{ fontWeight:'bold', marginBottom:4, color: balDiff === 0 ? '#2e7d32' : '#e65100' }}>
            {balDiff === 0 ? '✓ Balans to\'g\'ri' : '⚠ Balans farqi bor'}
          </div>
          <div style={{ fontSize:12, color:'#555', display:'flex', gap:24, flexWrap:'wrap' }}>
            <span>Oborotka boshi: <b>{fmt(oborotBal.opening)}</b></span>
            <span>Oborotka oxiri: <b>{fmt(oborotBal.closing)}</b></span>
            <span>Hisoblangan: <b>{fmt(computedBal)}</b></span>
            {balDiff !== 0 && <span style={{ color:'#c62828' }}>Farq: <b>{fmt(Math.abs(balDiff))}</b></span>}
          </div>
          <button onClick={() => setOborotBal(null)} style={{ marginTop:6, fontSize:11, cursor:'pointer', background:'none', border:'none', color:'#888', textDecoration:'underline' }}>Yopish</button>
        </div>
      )}

      {/* ── OBOROTKA IMPORT TUGMASI ───────────────────────────────────────── */}
      <div style={{ marginBottom:12, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <label style={{ background:'#00695c', color:'#fff', padding:'7px 16px', borderRadius:4, cursor:'pointer', fontWeight:'bold', fontSize:12, display:'inline-flex', alignItems:'center', gap:6 }}>
          📥 Bank oborotkasini yuklash (Excel)
          <input type="file" accept=".xlsx,.xls" onChange={handleOborotka} style={{ display:'none' }} />
        </label>
        <span style={{ fontSize:11, color:'#888' }}>Ustunlar: Дата, Счет/ИНН, Оборот Дебет, Оборот Кредит, Назначение — avtomatik aniqlanadi</span>
      </div>

      {/* ── SANA FILTRI ───────────────────────────────────────────────────── */}
      <DateRangeFilter value={range} onChange={setRange} color="#0d47a1" />

      {/* ── TAB TUGMALARI ─────────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:0, borderBottom:'2px solid #ccc', marginBottom:0 }}>
        <TabBtn active={activeTab==='pending'} onClick={() => setActiveTab('pending')} color="#e65100"
          label={`⏳ Tasdiqlash navbati (${bankPendingRows.length})`} />
        <TabBtn active={activeTab==='kirim'}  onClick={() => setActiveTab('kirim')}  color="#0d47a1"
          label={`↑ Kirim bank (${fmt(totalBankIncome)})`} />
        <TabBtn active={activeTab==='chiqim'} onClick={() => setActiveTab('chiqim')} color="#b71c1c"
          label={`↓ Chiqim bank (${fmt(totalBankExpense)})`} />
      </div>

      {/* ══ PENDING TAB ═══════════════════════════════════════════════════════ */}
      {activeTab === 'pending' && (
        <div style={{ border:'1px solid #ccc', borderTop:'none', padding:14 }}>
          {bankPendingRows.length === 0 ? (
            <div style={{ color:'#888', fontStyle:'italic', padding:'20px 0', textAlign:'center' }}>
              Tasdiqlash navbati bo'sh.<br/>
              <span style={{ fontSize:12 }}>Bank oborotkasini yuklang — kirim va chiqim tranzaksiyalar shu yerga tushadi.</span>
            </div>
          ) : (
            <>
              {/* Bulk amallar */}
              <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:12, color:'#555' }}>
                  Jami: <b style={{ color:'#0d47a1' }}>↑ {fmt(pendKirim)}</b> kirim ·
                  <b style={{ color:'#b71c1c' }}> ↓ {fmt(pendChiqim)}</b> chiqim
                </span>
                <button onClick={confirmAll}
                  style={{ padding:'4px 14px', background:'#2e7d32', color:'#fff', border:'none', borderRadius:3, cursor:'pointer', fontSize:12, fontWeight:'bold' }}>
                  ✓ Hammasini tasdiqlash
                </button>
                <button onClick={() => { if(window.confirm('Barcha kutayotgan yozuvlarni o\'chirasizmi?')) { bankPendingRows.forEach(r => deleteBankPendingRow(r.id)); setPendingEdits({}); }}}
                  style={{ padding:'4px 14px', background:'#ffebee', color:'#c62828', border:'1px solid #ef9a9a', borderRadius:3, cursor:'pointer', fontSize:12 }}>
                  ✕ Hammasini bekor qilish
                </button>
              </div>

              {/* Pending jadval */}
              <table className="data-table" style={{ width:'100%' }}>
                <thead>
                  <tr>
                    <th style={{ width:30 }}>#</th>
                    <th style={{ width:85 }}>Sana</th>
                    <th style={{ width:60 }}>Tur</th>
                    <th>Tashkilot nomi</th>
                    <th style={{ textAlign:'right', width:130 }}>Summa</th>
                    <th style={{ width:180 }}>Mijoz (ixtiyoriy)</th>
                    <th style={{ width:200 }}>Izoh (ixtiyoriy)</th>
                    <th style={{ width:90 }}>Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {bankPendingRows.map((r, i) => {
                    const ed = getEdit(r.id);
                    const isKirim = r.type === 'kirim';
                    return (
                      <tr key={r.id} style={{ background: isKirim ? '#f0f7ff' : '#fff5f5' }}>
                        <td style={{ textAlign:'center', color:'#888', fontSize:11 }}>{i+1}</td>
                        <td style={{ fontSize:12 }}>{r.date || '—'}</td>
                        <td>
                          <span style={{ display:'inline-block', padding:'2px 7px', borderRadius:10, fontSize:11, fontWeight:'bold',
                            background: isKirim ? '#0d47a1' : '#b71c1c', color:'#fff' }}>
                            {isKirim ? '↑ Kirim' : '↓ Chiqim'}
                          </span>
                        </td>
                        <td style={{ fontSize:12 }}>
                          <div style={{ fontWeight:'bold', color:'#333' }}>{r.orgName || '—'}</div>
                          {r.naznachenie && <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{r.naznachenie.slice(0,80)}{r.naznachenie.length>80?'…':''}</div>}
                        </td>
                        <td style={{ textAlign:'right', fontFamily:'monospace', fontWeight:'bold',
                          color: isKirim ? '#0d47a1' : '#b71c1c', fontSize:13 }}>
                          {fmt(r.amount)}
                        </td>
                        <td>
                          <CustomerSelect
                            value={ed.customer}
                            onChange={v => setEdit(r.id, { customer: v })}
                            placeholder="Mijoz (ixtiyoriy)"
                            accentColor={isKirim ? '#0d47a1' : '#b71c1c'}
                          />
                        </td>
                        <td>
                          <input value={ed.izoh} onChange={e => setEdit(r.id, { izoh: e.target.value })}
                            placeholder={r.naznachenie ? r.naznachenie.slice(0,40) : 'Izoh...'}
                            style={{ ...inp, width:'100%', boxSizing:'border-box' }} />
                        </td>
                        <td style={{ whiteSpace:'nowrap' }}>
                          <button onClick={() => { confirmBankPendingRow(r.id, { customer: ed.customer, izoh: ed.izoh }); setPendingEdits(p => { const n={...p}; delete n[r.id]; return n; }); }}
                            style={{ padding:'3px 10px', background:'#2e7d32', color:'#fff', border:'none', borderRadius:3, cursor:'pointer', fontSize:12, fontWeight:'bold', marginRight:4 }}>
                            ✓
                          </button>
                          <button onClick={() => deleteBankPendingRow(r.id)}
                            style={{ padding:'3px 8px', background:'#ffebee', color:'#c62828', border:'1px solid #ef9a9a', borderRadius:3, cursor:'pointer', fontSize:12 }}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* ══ KIRIM BANK TAB ════════════════════════════════════════════════════ */}
      {activeTab === 'kirim' && (
        <div style={{ border:'1px solid #ccc', borderTop:'none', padding:14 }}>

          {msg && (
            <div style={{ background:'#e8f5e9', color:'#1b5e20', border:'1px solid #a5d6a7', borderRadius:4, padding:'8px 12px', marginBottom:12, fontSize:13, fontWeight:'bold' }}>
              {msg}
            </div>
          )}

          {/* Qo'lda kiritish */}
          <form onSubmit={submitBankIncome}
            style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap', padding:'8px 10px', background:'#e3f2fd', border:'1px solid #90caf9', borderRadius:4 }}>
            <input type="number" placeholder="Summa" value={incForm.amount}
              onChange={e => setIncForm(p => ({...p, amount:e.target.value}))}
              style={{ ...inp, width:130 }} required />
            <div style={{ width:180 }}>
              <CustomerSelect value={incForm.customer} onChange={v => setIncForm(p=>({...p,customer:v}))}
                placeholder="Mijoz (tanlansa — qarzga)" accentColor="#0d47a1" />
            </div>
            <input type="text" placeholder="Izoh (ixtiyoriy)" value={incForm.desc}
              onChange={e => setIncForm(p => ({...p, desc:e.target.value}))}
              style={{ ...inp, width:200 }} />
            <button type="submit"
              style={{ ...inp, background:'#0d47a1', color:'#fff', border:'none', cursor:'pointer', fontWeight:'bold', padding:'4px 16px' }}>
              ↑ Qo'shish
            </button>
          </form>
          {/* Mijoz tanlanganda pul qarzga/avansga ketishini tushuntirish */}
          {incForm.customer.trim() && (
            <div style={{ fontSize: 11, color: '#0d47a1', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 4, padding: '6px 10px', marginTop: -6, marginBottom: 12 }}>
              ℹ️ <b>{incForm.customer.trim()}</b> tanlangani uchun bu pul avval qarzini yopadi, ortig'i avansga yoziladi (Kassir bilan bir xil).
            </div>
          )}

          {/* Excel hisobot */}
          <div style={{ marginBottom:10 }}>
            <button onClick={() => exportExcel(filtInc, filtExp, 'kirim')}
              style={{ padding:'4px 12px', background:'#1b5e20', color:'#fff', border:'none', borderRadius:3, cursor:'pointer', fontSize:12, fontWeight:'bold' }}>
              ⬇ Excel hisobot
            </button>
            <span style={{ marginLeft:8, fontSize:11, color:'#888' }}>
              {filtInc.length} ta · <b style={{ color:'#0d47a1' }}>{fmt(filtIncTotal)}</b> so'm
            </span>
          </div>

          <RowsTable rows={filtInc} page={incPage} setPage={setIncPage}
            onDelete={id => { if(window.confirm("O'chirasizmi?")) deleteBankIncomeRow(id); }}
            amountColor="#0d47a1" total={filtIncTotal} />
        </div>
      )}

      {/* ══ CHIQIM BANK TAB ═══════════════════════════════════════════════════ */}
      {activeTab === 'chiqim' && (
        <div style={{ border:'1px solid #ccc', borderTop:'none', padding:14 }}>

          {/* Qo'lda kiritish */}
          <form onSubmit={e => { e.preventDefault(); if(!expForm.amount) return; addBankExpenseRow(expForm.amount, expForm.desc, todayS, expForm.customer); setExpForm({ amount:'', desc:'', customer:'' }); }}
            style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap', padding:'8px 10px', background:'#ffebee', border:'1px solid #ef9a9a', borderRadius:4 }}>
            <input type="number" placeholder="Summa" value={expForm.amount}
              onChange={e => setExpForm(p => ({...p, amount:e.target.value}))}
              style={{ ...inp, width:130 }} required />
            <div style={{ width:180 }}>
              <CustomerSelect value={expForm.customer} onChange={v => setExpForm(p=>({...p,customer:v}))}
                placeholder="Mijoz (ixtiyoriy)" accentColor="#b71c1c" />
            </div>
            <input type="text" placeholder="Izoh (ixtiyoriy)" value={expForm.desc}
              onChange={e => setExpForm(p => ({...p, desc:e.target.value}))}
              style={{ ...inp, width:200 }} />
            <button type="submit"
              style={{ ...inp, background:'#b71c1c', color:'#fff', border:'none', cursor:'pointer', fontWeight:'bold', padding:'4px 16px' }}>
              ↓ Qo'shish
            </button>
          </form>

          {/* Excel hisobot */}
          <div style={{ marginBottom:10 }}>
            <button onClick={() => exportExcel(filtInc, filtExp, 'chiqim')}
              style={{ padding:'4px 12px', background:'#1b5e20', color:'#fff', border:'none', borderRadius:3, cursor:'pointer', fontSize:12, fontWeight:'bold' }}>
              ⬇ Excel hisobot
            </button>
            <span style={{ marginLeft:8, fontSize:11, color:'#888' }}>
              {filtExp.length} ta · <b style={{ color:'#b71c1c' }}>{fmt(filtExpTotal)}</b> so'm
            </span>
          </div>

          <RowsTable rows={filtExp} page={expPage} setPage={setExpPage}
            onDelete={id => { if(window.confirm("O'chirasizmi?")) deleteBankExpenseRow(id); }}
            amountColor="#b71c1c" total={filtExpTotal} />
        </div>
      )}
    </div>
  );
}

// ─── Excel hisobot ───────────────────────────────────────────────────────────
function exportExcel(incRows, expRows, tab) {
  const XLSX = window.XLSX || (typeof require !== 'undefined' ? require('xlsx') : null);
  // XLSX import qilingan, window.XLSX emas — shuning uchun modulni ishlatamiz
  import('xlsx').then(X => {
    const rows = (tab === 'kirim' ? incRows : expRows).map(r => ({
      'Sana':    r.date   || '—',
      'Mijoz':   r.customer || '—',
      'Izoh':    r.desc   || '—',
      'Tur':     tab === 'kirim' ? 'Kirim' : 'Chiqim',
      "Summa (so'm)": Number(r.amount || 0),
    }));
    const ws = X.utils.json_to_sheet(rows);
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, tab === 'kirim' ? 'Kirim bank' : 'Chiqim bank');
    X.writeFile(wb, `bank-${tab}-${new Date().toISOString().slice(0,10)}.xlsx`);
  });
}

// ─── Jadval ──────────────────────────────────────────────────────────────────
function RowsTable({ rows, page, setPage, onDelete, amountColor, total }) {
  const PAGE = 100;
  const paged = rows.slice((page-1)*PAGE, page*PAGE);
  const fmt2  = (n) => Number(n||0).toLocaleString('ru-RU').replace(/,/g,' ');
  const today = todayStr();

  if (!rows.length)
    return <p style={{ color:'#888', fontStyle:'italic', marginTop:16 }}>Yozuv topilmadi.</p>;

  return (
    <>
    <table className="data-table" style={{ width:'100%' }}>
      <thead>
        <tr>
          <th style={{ width:30 }}>#</th>
          <th style={{ width:88 }}>Sana</th>
          <th style={{ width:160 }}>Mijoz</th>
          <th>Izoh</th>
          <th style={{ textAlign:'right', width:140 }}>Summa</th>
          <th style={{ width:36 }}></th>
        </tr>
      </thead>
      <tbody>
        {paged.map((r, i) => {
          const isToday = r.date === today;
          const absIdx  = (page-1)*PAGE + i;
          return (
            <tr key={r.id} style={{ background: isToday ? (amountColor==='#0d47a1'?'#e8f0ff':'#fff0f0') : (i%2===0?'#fff':'#f9f9f9') }}>
              <td style={{ textAlign:'center', color:'#888', fontSize:11 }}>{absIdx+1}</td>
              <td style={{ fontSize:12 }}>
                {r.date || '—'}
                {isToday && <span style={{ marginLeft:3, fontSize:9, padding:'1px 4px', background:amountColor, color:'#fff', borderRadius:8 }}>bugun</span>}
              </td>
              <td style={{ fontSize:12, color:'#1565c0', fontWeight: r.customer ? 'bold' : 'normal' }}>
                {r.customer || <span style={{ color:'#bbb' }}>—</span>}
              </td>
              <td style={{ fontSize:12, color:'#555' }}>{r.desc || '—'}</td>
              <td style={{ textAlign:'right', fontFamily:'monospace', fontWeight:'bold', color:amountColor, fontSize:13 }}>
                {fmt2(r.amount)}
              </td>
              <td style={{ textAlign:'center' }}>
                <button onClick={() => onDelete(r.id)}
                  style={{ fontSize:10, cursor:'pointer', background:'#ffebee', border:'1px solid #e53935', padding:'2px 6px', borderRadius:3, color:'#c62828' }}>
                  ✕
                </button>
              </td>
            </tr>
          );
        })}
        <tr style={{ background:'#ffff00', fontWeight:'bold' }}>
          <td colSpan={4} style={{ textAlign:'right', paddingRight:8 }}>JAMI</td>
          <td style={{ textAlign:'right', fontFamily:'monospace', color:amountColor, fontSize:14 }}>{fmt2(total)}</td>
          <td />
        </tr>
      </tbody>
    </table>
    <Paginator total={rows.length} page={page} setPage={setPage} pageSize={PAGE} />
    </>
  );
}

// ─── Tab tugmasi ─────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, label, color }) {
  return (
    <button onClick={onClick} style={{
      padding:'8px 20px', cursor:'pointer', border:'none',
      borderBottom: active ? `3px solid ${color}` : '3px solid transparent',
      background: active ? '#fff' : '#f5f5f5',
      color: active ? color : '#555',
      fontFamily:'Tahoma,sans-serif', fontSize:13,
      fontWeight: active ? 'bold' : 'normal',
      marginBottom: active ? -2 : 0,
    }}>{label}</button>
  );
}

// ─── Statistika kartochkasi ───────────────────────────────────────────────────
function StatCard({ label, value, color, bg, sub, bold, arrow, onEdit }) {
  return (
    <div onClick={onEdit} style={{
      padding:'8px 14px', background:bg,
      border:`1px solid ${color}33`,
      borderLeft:`4px solid ${color}`,
      borderRadius:4, minWidth:150,
      cursor: onEdit ? 'pointer' : 'default',
    }} title={onEdit ? 'Bosib tahrirlash' : undefined}>
      <div style={{ fontSize:11, color:'#666', marginBottom:2 }}>
        {label}{onEdit && <span style={{ marginLeft:4, fontSize:10, color:'#999' }}>✎</span>}
      </div>
      <div style={{ fontSize:15, fontWeight: bold ? 700 : 'bold', color, fontFamily:'monospace' }}>
        {arrow && <span style={{ marginRight:3 }}>{arrow}</span>}
        {value} so'm
      </div>
      {sub && <div style={{ fontSize:10, color:'#999', marginTop:2 }}>{sub}</div>}
    </div>
  );
}
