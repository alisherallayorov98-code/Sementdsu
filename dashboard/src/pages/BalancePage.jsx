import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import ExcelExport from '../components/ExcelExport';
import DateRangeFilter from '../components/DateRangeFilter';
import CustomerCard from '../components/CustomerCard';
import { filterByRange, isEmptyRange } from '../lib/dateRange';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (ts) => {
  if (!ts || ts < 1e10) return '—';
  const d = new Date(ts);
  return [String(d.getHours()).padStart(2,'0'), String(d.getMinutes()).padStart(2,'0')].join(':');
};

const parseDate = (s) => {
  if (!s) return 0;
  const parts = s.split('.');
  if (parts.length !== 3) return 0;
  const [d, m, y] = parts.map(Number);
  return new Date(y, m - 1, d).getTime();
};

const todayStr = () => {
  const d = new Date();
  return [String(d.getDate()).padStart(2, '0'), String(d.getMonth() + 1).padStart(2, '0'), d.getFullYear()].join('.');
};

// "kk.oo.yyyy" -> "yyyy-oo-kk". MUHIM: har bir qismga nol qo'shamiz.
// Ilgari "5.7.2026" kabi nolsiz sana "2026-7-5" bo'lib qolardi va
// <input type="date"> uni tanimay BO'SH ko'rsatardi — natijada eski davrga
// o'tib bo'lmasdi. Endi "2026-07-05" chiqadi.
const pad2 = (x) => String(x).padStart(2, '0');
const toInputDate = (s) => {
  if (!s) return '';
  const parts = String(s).split('.');
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  if (!d || !m || !y) return '';
  return `${y}-${pad2(m)}-${pad2(d)}`;
};
const fromInputDate = (v) => {
  if (!v) return '';
  const [y, m, d] = v.split('-');
  return `${pad2(d)}.${pad2(m)}.${y}`;
};

const fmtTons = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };

// Auto yozuvning izohidan mijoz nomini ajratib olish (zaxira usul).
// Masalan "🔗 Qarz to'lovi: Ali" -> "Ali"
const custFromDesc = (desc) => {
  const s = typeof desc === 'object' ? (desc.latn || '') : String(desc || '');
  const m = s.match(/:\s*(.+?)(?:\s*\(|\s*\||$)/);
  return m ? m[1].trim() : '';
};

function SourceDetail({ row, data, navigate, onCustomer }) {
  const { salesRows, debtRows, recvRows, advanceRows } = data;

  const sid = row.sourceType === 'sale' || row.sourceType === 'recv' || row.sourceType === 'advance'
    ? row.sourceId : row.sourceId;

  let detail = null;    // ko'rsatiladigan matn
  let nav = null;       // { path, label } — "o'sha bo'limga o'tish"
  let customer = row.customer || '';   // mijoz kartochkasi uchun

  if (!row.auto) {
    // Qo'lda kiritilgan yozuv. Asl "manba" — bu yozuvning o'zi, lekin mijoz
    // biriktirilgan bo'lsa uning kartochkasiga o'tkazamiz (barcha savdo/qarz/
    // to'lovlari bir joyda). Foydalanuvchi "asl kelib chiqish joyi" deb shuni
    // nazarda tutgan.
    detail = <>✏️ <b>Qo'lda kiritilgan yozuv</b>{row.desc ? <> — {typeof row.desc === 'object' ? row.desc.latn : row.desc}</> : ''}</>;
  } else if (row.sourceType === 'sale') {
    const s = salesRows.find(r => r.id === sid);
    customer = s?.customer || customer;
    if (s) detail = <>📦 <b>Sotuv:</b> {s.customer} — {fmtTons(s.tons)} tn × {fmt(s.pricePerTon)} = <b>{fmt(Number(s.tons)*Number(s.pricePerTon))} so'm</b> | Sana: {s.date} | To'lov: {s.paymentChannel} {s.note ? `| ${s.note}` : ''}</>;
    nav = { path: '/sales', label: 'Sotuvlar bo\'limi' };
  } else if (row.sourceType === 'debt_payment') {
    // sourceId ikki xil formatda ("id_pTs" yoki "customer_pcBase") — ID bo'yicha
    // topib bo'lmaydi. Shuning uchun mijoz nomi orqali ishlaymiz.
    customer = customer || custFromDesc(row.desc);
    const totalQarz = debtRows.filter(r => r.customer === customer)
      .reduce((s, r) => s + Math.max(0, Number(r.amount || 0) - Number(r.paid || 0)), 0);
    detail = <>💰 <b>Qarz to'lovi:</b> {customer || '—'} — <b>{fmt(Math.abs(row.amount))} so'm</b> to'landi | Sana: {row.date} | Qolgan qarz: {fmt(totalQarz)} so'm</>;
    nav = { path: '/debts', label: 'Qarzlar bo\'limi' };
  } else if (row.sourceType === 'recv') {
    const r = recvRows.find(r => r.id === sid);
    if (r) detail = <>🏭 <b>Sement olish:</b> {r.source} — {fmtTons(r.tons)} tn | Mashina: {r.vehicleNo||'—'} | Sana: {r.date}</>;
    else detail = <>🏭 <b>Sement olish</b> — {typeof row.desc === 'object' ? row.desc.latn : (row.desc || '')}</>;
    nav = { path: '/recv_tons', label: 'Olingan tonna' };
  } else if (row.sourceType === 'advance') {
    const a = advanceRows.find(r => r.id === sid);
    customer = a?.customer || customer || custFromDesc(row.desc);
    detail = <>🅰️ <b>Avans:</b> {customer || '—'} — <b>{fmt(Math.abs(row.amount))} so'm</b> | Sana: {row.date}</>;
    nav = { path: '/advances', label: 'Avanslar bo\'limi' };
  } else if (row.sourceType === 'salary') {
    detail = <>👷 <b>Oylik to'lovi</b>{row.desc ? <>: {typeof row.desc === 'object' ? row.desc.latn : row.desc}</> : ''}</>;
    nav = { path: '/worker_salary', label: 'Ishchilar oyligi' };
  } else if (row.sourceType === 'supplier_payment') {
    detail = <>🏢 <b>Yetkazib beruvchiga to'lov</b>{row.desc ? <>: {typeof row.desc === 'object' ? row.desc.latn : row.desc}</> : ''}</>;
    nav = { path: '/recv_tons', label: 'Olingan tonna' };
  } else if (row.sourceType === 'driver') {
    detail = <>🚗 <b>Haydovchi to'lovi</b>{row.desc ? <>: {typeof row.desc === 'object' ? row.desc.latn : row.desc}</> : ''}</>;
    nav = { path: '/drivers', label: 'Haydovchilar' };
  } else {
    detail = <span style={{ color: '#888' }}>Bu yozuv qo'lda kiritilgan yoki manba turi noma'lum.</span>;
  }

  const linkBtn = {
    fontSize: 12, fontWeight: 'bold', border: 'none', borderRadius: 5,
    padding: '5px 12px', cursor: 'pointer', color: '#fff',
  };

  return (
    <div style={{ padding: '10px 16px', background: '#e8f4fd', fontSize: 12.5, color: '#333', borderLeft: '4px solid #1565c0', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
      <span>{detail}</span>
      <span style={{ display: 'flex', gap: 8 }}>
        {customer && onCustomer && (
          <button onClick={() => onCustomer(customer)} style={{ ...linkBtn, background: '#5e35b1' }}>
            👤 {customer} kartochkasi
          </button>
        )}
        {nav && navigate && (
          <button onClick={() => navigate(nav.path)} style={{ ...linkBtn, background: '#1565c0' }}>
            → {nav.label}
          </button>
        )}
      </span>
    </div>
  );
}

export default function BalancePage({ lang, type, title, color }) {
  const data = useData();
  // "Butun tarix" rejimi. Standart holatda sahifa faqat BITTA kunni ko'rsatadi —
  // shuning uchun "Naqd kassa"dagi eski pulni topib bo'lmasdi (u boshqa kunlarda
  // edi). Bosh sahifadagi tarkib oynasidan ?all=1 bilan kelinsa yoki tugma
  // bosilsa — barcha davr yozuvlari ro'yxati ko'rsatiladi.
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(sp.get('all') === '1');
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [range, setRange] = useState({ from: '', to: '' });
  const [expandedId, setExpandedId] = useState(null);
  const [card, setCard] = useState(null); // ochilgan mijoz kartochkasi (ismi)

  // Ma'lumotlarni turiga qarab ajratish
  let opening = { amount: 0, date: '' };
  let allTx = []; // { id, date, createdAt, amount, sign, cat, desc, worker }

  if (type === 'naqd') {
    opening = data.cashOpening;
    // Qo'lda kiritilgan qoldiqlar + sotuvdan avtomatik tushgan naqd
    allTx.push(...data.cashRows.map(r => {
      let cat = "Qo'lda (Tahrir)";
      if      (r.auto && r.sourceType === 'sale')         cat = 'Sotish (Naqd)';
      else if (r.auto && r.sourceType === 'debt_payment') cat = "Qarz to'lovi (Naqd)";
      else if (r.auto && r.sourceType === 'recv')         cat = 'Sement olish (Naqd)';
      else if (r.auto && r.sourceType === 'advance')      cat = 'Avans kirim (Naqd)';
      else if (r.auto && r.sourceType === 'salary')       cat = 'Oylik chiqim (Naqd)';
      else if (r.auto && r.sourceType === 'driver')       cat = "Haydovchi to'lovi (Naqd)";
      else if (r.auto && r.sourceType === 'supplier_payment') cat = "Yetkazib beruvchiga to'lov (Naqd)";
      return { ...r, sign: r.amount > 0 ? +1 : -1, cat };
    }));
    // Asosiy harakatlar
    allTx.push(...data.incomeRows.map(r => ({ ...r, sign: +1, cat: 'Kirim' })));
    allTx.push(...data.expenseRows.map(r => ({ ...r, sign: -1, cat: 'Chiqim' })));
    allTx.push(...data.soldRows.filter(r => r.paymentChannel === 'naqd').map(r => ({ ...r, amount: r.tons * r.pricePerTon, sign: +1, cat: 'Sotish (Naqd)', desc: `${r.customer} (${r.tons} tn)` })));
  } 
  else if (type === 'bank') {
    opening = data.bankOpening;
    allTx.push(...data.bankRows.map(r => {
      let cat = "Qo'lda (Tahrir)";
      if      (r.auto && r.sourceType === 'sale')         cat = 'Sotish (Bank)';
      else if (r.auto && r.sourceType === 'debt_payment') cat = "Qarz to'lovi (Bank)";
      else if (r.auto && r.sourceType === 'recv')         cat = 'Sement olish (Bank)';
      else if (r.auto && r.sourceType === 'advance')      cat = 'Avans kirim (Bank)';
      else if (r.auto && r.sourceType === 'salary')       cat = 'Oylik chiqim (Bank)';
      else if (r.auto && r.sourceType === 'driver')       cat = "Haydovchi to'lovi (Bank)";
      else if (r.auto && r.sourceType === 'supplier_payment') cat = "Yetkazib beruvchiga to'lov (Bank)";
      return { ...r, sign: r.amount > 0 ? +1 : -1, cat };
    }));
    allTx.push(...data.bankIncomeRows.map(r => ({ ...r, sign: +1, cat: 'Kirim' })));
    allTx.push(...data.bankExpenseRows.map(r => ({ ...r, sign: -1, cat: 'Chiqim' })));
    allTx.push(...data.soldRows.filter(r => r.paymentChannel === 'bank').map(r => ({ ...r, amount: r.tons * r.pricePerTon, sign: +1, cat: 'Sotish (Bank)', desc: `${r.customer} (${r.tons} tn)` })));
  }
  else if (type === 'click') {
    opening = data.clickOpening;
    allTx.push(...data.clickRows.map(r => {
      let cat = "Qo'lda (Tahrir)";
      if      (r.auto && r.sourceType === 'sale')         cat = 'Sotish (Click)';
      else if (r.auto && r.sourceType === 'debt_payment') cat = "Qarz to'lovi (Click)";
      else if (r.auto && r.sourceType === 'recv')         cat = 'Sement olish (Click)';
      else if (r.auto && r.sourceType === 'advance')      cat = 'Avans kirim (Click)';
      else if (r.auto && r.sourceType === 'salary')       cat = 'Oylik chiqim (Click)';
      else if (r.auto && r.sourceType === 'driver')       cat = "Haydovchi to'lovi (Click)";
      else if (r.auto && r.sourceType === 'supplier_payment') cat = "Yetkazib beruvchiga to'lov (Click)";
      return { ...r, sign: r.amount > 0 ? +1 : -1, cat };
    }));
    allTx.push(...data.clickIncomeRows.map(r => ({ ...r, sign: +1, cat: 'Kirim' })));
    allTx.push(...data.clickExpenseRows.map(r => ({ ...r, sign: -1, cat: 'Chiqim' })));
    allTx.push(...data.soldRows.filter(r => r.paymentChannel === 'click').map(r => ({ ...r, amount: r.tons * r.pricePerTon, sign: +1, cat: 'Sotish (Click)', desc: `${r.customer} (${r.tons} tn)` })));
  }

  const selTs = parseDate(selectedDate);
  const rangeActive = !isEmptyRange(range);

  // Qoldiq qaysi sanagacha hisoblanadi: oraliq faol bo'lsa — oraliq oxirigacha,
  // aks holda tanlangan kungacha.
  const endTs = rangeActive
    ? (range.to ? new Date(range.to + 'T23:59:59').getTime() : Infinity)
    : selTs;
  const balanceUpToDate = Number(opening.amount) + allTx
    .filter(t => parseDate(t.date) <= endTs)
    .reduce((s, t) => s + (Number(t.amount) * t.sign), 0);

  // Ko'rsatiladigan harakatlar:
  //   "Butun tarix" yoqilgan bo'lsa — HAMMASI (eng muhim rejim: kartochkadagi
  //     raqamni tashkil qilgan barcha yozuvni shu yerda topish mumkin);
  //   oraliq faol bo'lsa — oraliqdagilar;
  //   aks holda — tanlangan bitta kun.
  const dayTx = (showAll
    ? allTx.slice()
    : rangeActive
      ? filterByRange(allTx, range)
      : allTx.filter(t => t.date === selectedDate)
  ).slice().sort((a, b) => (parseDate(b.date) - parseDate(a.date)) || (b.createdAt - a.createdAt));
  const dayIn = dayTx.filter(t => t.sign > 0).reduce((s, t) => s + Number(t.amount), 0);
  const dayOut = dayTx.filter(t => t.sign < 0).reduce((s, t) => s + Number(t.amount), 0);
  const dayNet = dayIn - dayOut;

  const periodLabel = showAll
    ? 'Butun tarix (barcha yozuvlar)'
    : rangeActive
      ? `${range.from || '…'} — ${range.to || '…'}`
      : selectedDate;

  // Yozuvlar bir necha kundan bo'lganda sana ustuni ko'rsatiladi
  const multiDate = showAll || rangeActive;

  const inp = { padding: '6px 10px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4, fontFamily: 'Tahoma, sans-serif' };

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13, paddingBottom: 30 }}>
      
      {/* ── SANA TANLASH ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 6 }}>
            📅 Qaysi sanadagi harakatlarni ko'rmoqchisiz?
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="date" value={toInputDate(selectedDate)} disabled={showAll} onChange={e => { setShowAll(false); setSelectedDate(fromInputDate(e.target.value)); }} style={{ ...inp, border: `2px solid ${color}`, opacity: showAll ? 0.5 : 1 }} />
            <button onClick={() => { setShowAll(false); setSelectedDate(todayStr()); }} style={{ ...inp, cursor: 'pointer', background: (!showAll && selectedDate === todayStr()) ? color : '#f5f5f5', color: (!showAll && selectedDate === todayStr()) ? '#fff' : '#333', fontWeight: 'bold', border: `1px solid ${color}` }}>
              Bugun
            </button>
            <button onClick={() => { setShowAll(false); const d = new Date(); d.setDate(d.getDate()-1); setSelectedDate([String(d.getDate()).padStart(2,'0'), String(d.getMonth()+1).padStart(2,'0'), d.getFullYear()].join('.')); }} style={{ ...inp, cursor: 'pointer', background: '#f5f5f5', border: '1px solid #ccc' }}>
              Kecha
            </button>
            {/* Eng muhim tugma: barcha davr yozuvlarini bitta ro'yxatda ko'rish.
                "Naqd/Bank qoldig'idagi eski pulni topib bo'lmayapti" muammosining
                asosiy yechimi shu. */}
            <button onClick={() => setShowAll(v => !v)} style={{ ...inp, cursor: 'pointer', background: showAll ? color : '#fff', color: showAll ? '#fff' : color, fontWeight: 'bold', border: `2px solid ${color}` }}>
              📜 Butun tarix
            </button>
          </div>
        </div>
      </div>

      {/* ── SANA ORALIG'I (dan–gacha) ────────────────────────────────────── */}
      <DateRangeFilter value={range} onChange={setRange} color={color} label="📅 Yoki sana oralig'i (dan–gacha):" />

      {/* ── STATISTIKA ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>

        <div style={{ background: '#fff', borderLeft: `6px solid ${color}`, padding: '16px 20px', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4, fontWeight: 'bold' }}>{rangeActive ? 'Oraliq oxiridagi qoldiq' : `${selectedDate} dagi kun oxiri qoldig'i`}</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color, fontFamily: 'monospace' }}>
            {fmt(balanceUpToDate)} <span style={{ fontSize: 14, color: '#888' }}>so'm</span>
          </div>
        </div>

        <div style={{ background: '#e8f5e9', borderLeft: `6px solid #2e7d32`, padding: '16px 20px', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 12, color: '#2e7d32', marginBottom: 4, fontWeight: 'bold' }}>Kunlik kirim</div>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1b5e20', fontFamily: 'monospace' }}>
            +{fmt(dayIn)} <span style={{ fontSize: 12, color: '#888' }}>so'm</span>
          </div>
        </div>

        <div style={{ background: '#ffebee', borderLeft: `6px solid #c62828`, padding: '16px 20px', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 12, color: '#c62828', marginBottom: 4, fontWeight: 'bold' }}>Kunlik chiqim</div>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#b71c1c', fontFamily: 'monospace' }}>
            -{fmt(dayOut)} <span style={{ fontSize: 12, color: '#888' }}>so'm</span>
          </div>
        </div>

      </div>

      {/* ── JADVAL ───────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ background: color, color: '#fff', padding: '10px 14px', fontWeight: 'bold', fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>📋 {showAll ? 'Butun tarix —' : rangeActive ? `${periodLabel} oralig'idagi` : `${selectedDate} kunidagi`} barcha harakatlar ({dayTx.length} ta) · <span style={{ fontWeight: 'normal', opacity: 0.85 }}>har qatorni bosib manbasini oching</span></span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>Sof o'zgarish: {dayNet > 0 ? '+' : ''}{fmt(dayNet)} so'm</span>
            <ExcelExport
              filename={`${title}_${periodLabel}`}
              sheetName={title}
              title={`${title} — ${periodLabel}`}
              columns={[
                { header: 'Sana', value: (r) => r.date || selectedDate },
                { header: 'Vaqt', value: (r) => fmtT(r.createdAt) },
                { header: 'Kategoriya', value: (r) => r.cat },
                { header: 'Xodim', value: (r) => r.worker || '' },
                { header: 'Izoh / Mijoz', value: (r) => (typeof r.desc === 'object' ? r.desc[lang] : (r.desc || '')) },
                { header: 'Kirim/Chiqim', value: (r) => (r.sign > 0 ? 'Kirim' : 'Chiqim') },
                { header: "Summa (so'm)", value: (r) => Number(r.amount) * r.sign },
              ]}
              rows={dayTx}
            />
          </div>
        </div>
        
        {dayTx.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#888', fontStyle: 'italic' }}>
            {showAll ? 'Hech qanday operatsiya yo\'q.' : 'Bu sanada hech qanday operatsiya topilmadi.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '2px solid #eee' }}>
                <th style={thS}>#</th>
                {/* Sana ustuni: butun tarix yoki oraliq rejimida — yozuvlar turli
                    kunlardan bo'lgani uchun sanasiz "shunchaki raqamlar" ko'rinardi. */}
                {multiDate && <th style={thS}>Sana</th>}
                <th style={thS}>Vaqt</th>
                <th style={thS}>Kategoriya</th>
                <th style={thS}>Xodim</th>
                <th style={thS}>Izoh / Mijoz</th>
                <th style={{ ...thS, textAlign: 'right' }}>Summa</th>
                <th style={{ ...thS, textAlign: 'center', width: 70 }}>Manba</th>
              </tr>
            </thead>
            <tbody>
              {dayTx.map((row, i) => {
                const isOpen = expandedId === row.id;
                return (
                  <>
                  <tr key={row.id}
                    onClick={() => setExpandedId(isOpen ? null : row.id)}
                    style={{ borderBottom: isOpen ? 'none' : '1px solid #eee', background: isOpen ? '#e3f2fd' : (i % 2 === 0 ? '#fff' : '#fafafa'), cursor: 'pointer' }}
                    title="Bosib manbasini ko'ring">
                    <td style={{ ...tdS, color: '#888', textAlign: 'center', width: 30 }}>
                      <span style={{ fontSize: 10 }}>{isOpen ? '▼' : '▶'}</span> {i + 1}
                    </td>
                    {multiDate && <td style={{ ...tdS, width: 80, color: '#555' }}>{row.date}</td>}
                    <td style={{ ...tdS, width: 60, fontWeight: 'bold', color: '#555' }}>{fmtT(row.createdAt)}</td>
                    <td style={{ ...tdS, width: 140, fontWeight: 'bold', color: row.sign > 0 ? '#2e7d32' : '#c62828' }}>{row.cat}</td>
                    <td style={{ ...tdS, width: 120 }}>{row.worker || '—'}</td>
                    <td style={tdS}>{typeof row.desc === 'object' ? row.desc[lang] : (row.desc || '—')}</td>
                    <td style={{ ...tdS, textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', fontSize: 14, color: row.sign > 0 ? '#2e7d32' : '#c62828' }}>
                      {row.sign > 0 ? '+' : '-'}{fmt(Math.abs(row.amount))}
                    </td>
                    <td style={{ ...tdS, textAlign: 'center', width: 70 }}>
                      <span style={{ fontSize: 11, color: '#1565c0', border: '1px solid #90caf9', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap', background: isOpen ? '#bbdefb' : '#e3f2fd' }}>
                        {isOpen ? '▲ yopish' : '🔍 ko\'rish'}
                      </span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={row.id + '_detail'} style={{ borderBottom: '1px solid #eee' }}>
                      <td colSpan={multiDate ? 8 : 7} style={{ padding: 0 }}>
                        <SourceDetail row={row} data={data} navigate={navigate} onCustomer={setCard} />
                      </td>
                    </tr>
                  )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {card && <CustomerCard name={card} onClose={() => setCard(null)} />}
    </div>
  );
}

const thS = { padding: '10px 14px', textAlign: 'left', fontWeight: 'bold', color: '#555', fontSize: 12, textTransform: 'uppercase' };
const tdS = { padding: '10px 14px', fontSize: 13 };
