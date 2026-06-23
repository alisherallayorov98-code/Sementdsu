import { useState } from 'react';
import { useData } from '../context/DataContext';
import ExcelExport from '../components/ExcelExport';
import DateRangeFilter from '../components/DateRangeFilter';
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

const toInputDate = (s) => {
  if (!s || s.length < 8) return '';
  const [d, m, y] = s.split('.');
  return `${y}-${m}-${d}`;
};
const fromInputDate = (v) => {
  if (!v) return '';
  const [y, m, d] = v.split('-');
  return `${d}.${m}.${y}`;
};

export default function BalancePage({ lang, type, title, color }) {
  const data = useData();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [range, setRange] = useState({ from: '', to: '' }); // sanadan–sanagacha

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

  // Ko'rsatiladigan harakatlar: oraliq faol bo'lsa — oraliqdagi barchasi,
  // aks holda tanlangan kundagilar.
  const dayTx = (rangeActive
    ? filterByRange(allTx, range)
    : allTx.filter(t => t.date === selectedDate)
  ).slice().sort((a, b) => (parseDate(b.date) - parseDate(a.date)) || (b.createdAt - a.createdAt));
  const dayIn = dayTx.filter(t => t.sign > 0).reduce((s, t) => s + Number(t.amount), 0);
  const dayOut = dayTx.filter(t => t.sign < 0).reduce((s, t) => s + Number(t.amount), 0);
  const dayNet = dayIn - dayOut;

  const periodLabel = rangeActive
    ? `${range.from || '…'} — ${range.to || '…'}`
    : selectedDate;

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
            <input type="date" value={toInputDate(selectedDate)} onChange={e => setSelectedDate(fromInputDate(e.target.value))} style={{ ...inp, border: `2px solid ${color}` }} />
            <button onClick={() => setSelectedDate(todayStr())} style={{ ...inp, cursor: 'pointer', background: selectedDate === todayStr() ? color : '#f5f5f5', color: selectedDate === todayStr() ? '#fff' : '#333', fontWeight: 'bold', border: `1px solid ${color}` }}>
              Bugun
            </button>
            <button onClick={() => { const d = new Date(); d.setDate(d.getDate()-1); setSelectedDate([String(d.getDate()).padStart(2,'0'), String(d.getMonth()+1).padStart(2,'0'), d.getFullYear()].join('.')); }} style={{ ...inp, cursor: 'pointer', background: '#f5f5f5', border: '1px solid #ccc' }}>
              Kecha
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
          <span>📋 {rangeActive ? `${periodLabel} oralig'idagi` : `${selectedDate} kunidagi`} barcha harakatlar ({dayTx.length} ta)</span>
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
            Bu sanada hech qanday operatsiya topilmadi.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '2px solid #eee' }}>
                <th style={thS}>#</th>
                {rangeActive && <th style={thS}>Sana</th>}
                <th style={thS}>Vaqt</th>
                <th style={thS}>Kategoriya</th>
                <th style={thS}>Xodim</th>
                <th style={thS}>Izoh / Mijoz</th>
                <th style={{ ...thS, textAlign: 'right' }}>Summa</th>
              </tr>
            </thead>
            <tbody>
              {dayTx.map((row, i) => (
                <tr key={row.id} style={{ borderBottom: '1px solid #eee', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ ...tdS, color: '#888', textAlign: 'center', width: 30 }}>{i + 1}</td>
                  {rangeActive && <td style={{ ...tdS, width: 80, color: '#555' }}>{row.date}</td>}
                  <td style={{ ...tdS, width: 60, fontWeight: 'bold', color: '#555' }}>{fmtT(row.createdAt)}</td>
                  <td style={{ ...tdS, width: 140, fontWeight: 'bold', color: row.sign > 0 ? '#2e7d32' : '#c62828' }}>{row.cat}</td>
                  <td style={{ ...tdS, width: 120 }}>{row.worker || '—'}</td>
                  <td style={tdS}>{typeof row.desc === 'object' ? row.desc[lang] : (row.desc || '—')}</td>
                  <td style={{ ...tdS, textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', fontSize: 14, color: row.sign > 0 ? '#2e7d32' : '#c62828' }}>
                    {row.sign > 0 ? '+' : '-'}{fmt(Math.abs(row.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}

const thS = { padding: '10px 14px', textAlign: 'left', fontWeight: 'bold', color: '#555', fontSize: 12, textTransform: 'uppercase' };
const tdS = { padding: '10px 14px', fontSize: 13 };
