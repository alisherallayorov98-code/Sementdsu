import { useState, useEffect, useCallback } from 'react';
import { useData } from '../context/DataContext';
import CustomerSelect from '../components/CustomerSelect';
import { printSaleReceipt } from '../lib/receipt';
import { customerSummary } from '../lib/customerSummary';
import NotifyModal from '../components/NotifyModal';
import ExcelExport from '../components/ExcelExport';
import CustomerCard from '../components/CustomerCard';
import DateRangeFilter from '../components/DateRangeFilter';
import Paginator from '../components/Paginator';
import { filterByRange } from '../lib/dateRange';

const fmt   = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT  = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(3); };
const toDay = () => new Date().toLocaleDateString('ru-RU');
const toISO = () => new Date().toISOString().slice(0, 10);
const isoToLocal = (iso) => { if (!iso) return toDay(); const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; };
const timeStr = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const CH = [
  { v: 'naqd',  icon: '💵', label: 'Naqd',  color: '#1565c0' },
  { v: 'bank',  icon: '🏦', label: 'Bank',  color: '#2e7d32' },
  { v: 'click', icon: '📱', label: 'Click', color: '#6a1b9a' },
];

const TRANSFERS = [
  { v: 'bank_to_naqd',  label: '🏦→💵 Bank→Naqd',   from: 'bank',  to: 'naqd'  },
  { v: 'naqd_to_bank',  label: '💵→🏦 Naqd→Bank',   from: 'naqd',  to: 'bank'  },
  { v: 'bank_to_click', label: '🏦→📱 Bank→Click',  from: 'bank',  to: 'click' },
  { v: 'click_to_bank', label: '📱→🏦 Click→Bank',  from: 'click', to: 'bank'  },
  { v: 'naqd_to_click', label: '💵→📱 Naqd→Click',  from: 'naqd',  to: 'click' },
  { v: 'click_to_naqd', label: '📱→💵 Click→Naqd',  from: 'click', to: 'naqd'  },
];

const OP_LABELS = {
  sale: '📦 Sotuv', sklad_sale: '🏗 Sklad', debt_payment: '💰 Qarz to\'lovi',
  advance: '🔄 Avans', salary: '👔 Oylik', supplier_payment: '🏭 Zavod',
  transfer: '↔️ O\'tkazma', recv: '🏗 Sement olish',
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, onHide }) {
  useEffect(() => {
    if (msg) { const t = setTimeout(onHide, 2500); return () => clearTimeout(t); }
  }, [msg, onHide]);
  if (!msg) return null;
  return (
    <div style={{
      position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
      background: '#1b5e20', color: '#fff', padding: '12px 28px', borderRadius: 8,
      fontWeight: 'bold', fontSize: 15, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      pointerEvents: 'none',
    }}>✅ {msg}</div>
  );
}

// ── Kanal tugmalari ────────────────────────────────────────────────────────────
function ChanBtns({ value, onChange, extra = [] }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {[...CH, ...extra].map(c => (
        <button key={c.v} type="button" onClick={() => onChange(c.v)} style={{
          padding: '7px 14px', cursor: 'pointer', fontWeight: 'bold', fontSize: 13, borderRadius: 6,
          border: `2px solid ${value === c.v ? c.color : '#ccc'}`,
          background: value === c.v ? c.color : '#f9f9f9',
          color: value === c.v ? '#fff' : '#555',
        }}>{c.icon} {c.label}</button>
      ))}
    </div>
  );
}

// ── Yordamchilar ──────────────────────────────────────────────────────────────
function Row({ children }) {
  return <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10, alignItems: 'flex-end' }}>{children}</div>;
}
function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ fontSize: 11, color: '#555', fontWeight: 'bold' }}>{label}</label>
      {children}
    </div>
  );
}
function SaveBtn({ color, label }) {
  return (
    <div style={{ marginTop: 12 }}>
      <button type="submit" style={{
        padding: '10px 32px', background: color, color: '#fff', border: 'none',
        borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 15,
      }}>{label}</button>
    </div>
  );
}
const inp = { padding: '7px 10px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4, fontFamily: 'Tahoma, sans-serif' };

// ── Asosiy komponent ──────────────────────────────────────────────────────────
export default function Kassir() {
  const data = useData();
  const {
    cashOpening, cashRows, addCashRow,
    bankOpening, bankRows, addBankRow,
    clickOpening, clickRows, addClickRow,
    payCustomerDebt, addAdvanceRow,
    advanceBalanceOf, debtRows,
    salesRows, addSaleRow, deleteSaleRow,
    totalCementBalance, warehouses, defaultWhId, cementBalanceOf, whName,
    appSettings, currentWorker, setCurrentWorker, workers,
    customers, currentUser,
    addSkladSotuv, totalSkladKg,
  } = data;

  const myWh = currentUser?.warehouseId || defaultWhId;

  // ── Balanslar ────────────────────────────────────────────────────────────────
  const cashBal  = Number(cashOpening?.amount  || 0) + cashRows.reduce((s, r)  => s + Number(r.amount  || 0), 0);
  const bankBal  = Number(bankOpening?.amount  || 0) + bankRows.reduce((s, r)  => s + Number(r.amount  || 0), 0);
  const clickBal = Number(clickOpening?.amount || 0) + clickRows.reduce((s, r) => s + Number(r.amount || 0), 0);

  // ── Asosiy tab ───────────────────────────────────────────────────────────────
  const [tab, setTab]     = useState('kirim');    // kirim | chiqim | sotuv
  const [sotuvTab, setSotuvTab] = useState('ton'); // ton | kg
  const [toast, setToast] = useState('');
  const showToast = useCallback((msg) => setToast(msg), []);

  // ── Form holatlari ───────────────────────────────────────────────────────────
  const [kirim, setKirim] = useState({ customer: '', amount: '', note: '', channel: 'naqd' });
  const [chiqim, setChiqim] = useState({ amount: '', note: '', channel: 'naqd', isTransfer: false, tDir: 'bank_to_naqd' });
  const [sotuv, setSotuv] = useState({ customer: '', tons: '', pricePerTon: '', channel: 'naqd', note: '', warehouseId: '', date: toISO() });
  const [sklad, setSklad] = useState({ customer: '', kg: '', pricePerKg: '', channel: 'naqd', note: '' });
  const [search, setSearch] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [salesPage, setSalesPage] = useState(1);
  const [notifyRow, setNotifyRow] = useState(null);
  const [card, setCard] = useState(null);

  useEffect(() => { setSalesPage(1); }, [search, range.from, range.to]);

  // ── Mijoz qoldig'i (kirim tab) ───────────────────────────────────────────────
  const custDebt = kirim.customer
    ? debtRows.filter(r => r.customer === kirim.customer).reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.paid)), 0)
    : 0;
  const custAdv = kirim.customer ? advanceBalanceOf(kirim.customer) : 0;

  // Sotuv formasidagi sklad qoldig'i
  const activeWh = sotuv.warehouseId || myWh;
  const whBal = cementBalanceOf(activeWh);
  const sotuvAdv = sotuv.customer && sotuv.channel === 'avans' ? advanceBalanceOf(sotuv.customer) : 0;

  const addRow = (channel, amount, desc) => {
    const fn = { naqd: addCashRow, bank: addBankRow, click: addClickRow }[channel];
    if (fn) fn(amount, desc, toDay());
  };

  // ── Submit: KIRIM ────────────────────────────────────────────────────────────
  const submitKirim = (e) => {
    e.preventDefault();
    const amt = Number(kirim.amount);
    if (!amt || !kirim.note) return;

    if (kirim.customer) {
      const res = payCustomerDebt(kirim.customer, amt, kirim.channel, kirim.note);
      const leftover = res.leftover;
      if (res.applied === 0) {
        // qarz yo'q — to'liq avans
        addAdvanceRow(kirim.customer, amt, kirim.note, kirim.channel);
        showToast(`${fmt(amt)} so'm avans sifatida qabul qilindi`);
      } else if (leftover > 0) {
        // ortiqcha qism avansga
        addAdvanceRow(kirim.customer, leftover, `${kirim.note} (ortiqcha)`, kirim.channel);
        showToast(`${fmt(res.applied)} qarz ✓ · ${fmt(leftover)} avans`);
      } else {
        showToast(`${fmt(res.applied)} so'm qarz to'lovi qabul qilindi`);
      }
    } else {
      addRow(kirim.channel, amt, kirim.note);
      showToast(`+${fmt(amt)} so'm kirim`);
    }
    setKirim({ customer: '', amount: '', note: '', channel: 'naqd' });
  };

  // ── Submit: CHIQIM ───────────────────────────────────────────────────────────
  const submitChiqim = (e) => {
    e.preventDefault();
    const amt = Number(chiqim.amount);
    if (!amt || !chiqim.note) return;

    if (chiqim.isTransfer) {
      const opt = TRANSFERS.find(o => o.v === chiqim.tDir);
      if (!opt) return;
      const tag = `↔️ ${opt.label}${chiqim.note ? ': ' + chiqim.note : ''}`;
      addRow(opt.from, -amt, tag);
      addRow(opt.to,   +amt, tag);
      showToast(`${fmt(amt)} so'm o'tkazildi`);
    } else {
      addRow(chiqim.channel, -amt, chiqim.note);
      showToast(`-${fmt(amt)} so'm chiqim`);
    }
    setChiqim({ amount: '', note: '', channel: 'naqd', isTransfer: false, tDir: 'bank_to_naqd' });
  };

  // ── Submit: SOTUV (ton) ──────────────────────────────────────────────────────
  const submitSotuv = (e) => {
    e.preventDefault();
    if (!sotuv.customer || !sotuv.tons || !sotuv.pricePerTon) return;
    if (Number(sotuv.tons) > Number(whBal)) {
      if (!window.confirm(`Diqqat! "${whName(activeWh)}" sklad qoldig'i: ${whBal} tn. Baribir sotasizmi?`)) return;
    }
    const localDate = isoToLocal(sotuv.date);
    const created = addSaleRow({
      customer: sotuv.customer, tons: sotuv.tons, pricePerTon: sotuv.pricePerTon,
      paymentChannel: sotuv.channel, note: sotuv.note, warehouseId: activeWh,
      date: localDate, worker: currentWorker,
    });
    showToast(`${fmtT(sotuv.tons)} tn sotildi — ${fmt(Number(sotuv.tons) * Number(sotuv.pricePerTon))} so'm`);
    if (created) {
      const s = customerSummary(created.customer, data);
      const extraDebt = created.paymentChannel === 'nasiya' ? Number(created.tons || 0) * Number(created.pricePerTon || 0) : 0;
      printSaleReceipt(created, {
        appName: appSettings?.appName || 'SEMENT', phone: appSettings?.companyPhone || '',
        address: appSettings?.companyAddress || '', qolganQarz: s.qolganQarz + extraDebt,
      });
    }
    setSotuv({ customer: '', tons: '', pricePerTon: '', channel: 'naqd', note: '', warehouseId: sotuv.warehouseId, date: toISO() });
  };

  // ── Submit: SKLAD (kg) ───────────────────────────────────────────────────────
  const submitSklad = (e) => {
    e.preventDefault();
    if (!sklad.customer || !sklad.kg || !sklad.pricePerKg) return;
    if (totalSkladKg < Number(sklad.kg)) {
      alert(`Sklad qoldig'i yetarli emas. Qoldiq: ${fmt(totalSkladKg)} kg`); return;
    }
    addSkladSotuv({ customer: sklad.customer, kg: sklad.kg, pricePerKg: sklad.pricePerKg, channel: sklad.channel, note: sklad.note });
    showToast(`${sklad.kg} kg sotildi — ${fmt(Number(sklad.kg) * Number(sklad.pricePerKg))} so'm`);
    setSklad({ customer: '', kg: '', pricePerKg: '', channel: 'naqd', note: '' });
  };

  // ── Savdo tarixi ─────────────────────────────────────────────────────────────
  const CH_LBL = { naqd: 'Naqd', bank: 'Bank', click: 'Click', nasiya: 'Nasiya', avans: 'Avans' };
  const saleMsg = (r) => {
    const total = Number(r.tons || 0) * Number(r.pricePerTon || 0);
    const base = `Hurmatli ${r.customer}! ${fmtT(r.tons)} tn sement. Summa: ${fmt(total)} so'm. To'lov: ${CH_LBL[r.paymentChannel] || r.paymentChannel}.`;
    const q = customerSummary(r.customer, data).qolganQarz;
    return q > 0 ? `${base} Qoldiq qarz: ${fmt(q)} so'm.` : `${base} Rahmat!`;
  };
  const printChek = (sale) => {
    const q = customerSummary(sale.customer, data).qolganQarz;
    printSaleReceipt(sale, { appName: appSettings?.appName || 'SEMENT', phone: appSettings?.companyPhone || '', address: appSettings?.companyAddress || '', qolganQarz: q });
  };

  const sortedSales = [...salesRows].sort((a, b) => b.createdAt - a.createdAt);
  const filteredSales = filterByRange(
    sortedSales.filter(r => !search || r.customer.toLowerCase().includes(search.toLowerCase()) || (r.note || '').toLowerCase().includes(search.toLowerCase())),
    range
  );
  const PAGE_SIZE = 50;
  const pagedSales = filteredSales.slice((salesPage - 1) * PAGE_SIZE, salesPage * PAGE_SIZE);

  const totalTons    = salesRows.reduce((s, r) => s + Number(r.tons || 0), 0);
  const totalSalesSum = salesRows.reduce((s, r) => s + Number(r.tons || 0) * Number(r.pricePerTon || 0), 0);
  const chSum = (ch) => salesRows.filter(r => r.paymentChannel === ch).reduce((s, r) => s + Number(r.tons || 0) * Number(r.pricePerTon || 0), 0);

  const chBadge = (ch) => {
    const colors = { naqd: ['#e8f5e9','#2e7d32'], bank: ['#e3f2fd','#0d47a1'], click: ['#f3e5f5','#4a148c'], nasiya: ['#ffebee','#c62828'], avans: ['#fff8e1','#e65100'] };
    const [bg, fg] = colors[ch] || ['#f5f5f5', '#555'];
    return <span style={{ background: bg, color: fg, padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', border: `1px solid ${fg}44` }}>{(ch || '').toUpperCase()}</span>;
  };

  // ── Bugungi jurnal ────────────────────────────────────────────────────────────
  const today = toDay();
  const journalRows = [
    ...cashRows.map(r => ({ ...r, _ch: 'naqd' })),
    ...bankRows.map(r => ({ ...r, _ch: 'bank' })),
    ...clickRows.map(r => ({ ...r, _ch: 'click' })),
  ].filter(r => r.date === today).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const todayIn  = journalRows.filter(r => Number(r.amount) > 0).reduce((s, r) => s + Number(r.amount), 0);
  const todayOut = journalRows.filter(r => Number(r.amount) < 0).reduce((s, r) => s + Number(r.amount), 0);

  // ── Tab colors ───────────────────────────────────────────────────────────────
  const TABS = {
    kirim:  { color: '#2e7d32', bg: '#e8f5e9', label: '➕ Kirim' },
    chiqim: { color: '#c62828', bg: '#ffebee', label: '➖ Chiqim' },
    sotuv:  { color: '#e65100', bg: '#fff3e0', label: '📦 Sotish' },
  };
  const activeTab = TABS[tab];

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13, paddingBottom: 30 }}>
      <Toast msg={toast} onHide={() => setToast('')} />

      {/* ── KASSA QOLDIG'I ── */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14,
        position: 'sticky', top: 0, zIndex: 100,
        background: '#fff', paddingBottom: 10, borderBottom: '2px solid #eee',
      }}>
        {[
          { label: '💵 Naqd',  val: cashBal,  color: '#1565c0', bg: '#e3f2fd' },
          { label: '🏦 Bank',  val: bankBal,  color: '#2e7d32', bg: '#e8f5e9' },
          { label: '📱 Click', val: clickBal, color: '#6a1b9a', bg: '#f3e5f5' },
          { label: '🏗 Sklad', val: totalSkladKg, color: '#4e342e', bg: '#efebe9', unit: 'kg' },
        ].map(c => (
          <div key={c.label} style={{ flex: 1, minWidth: 130, padding: '8px 14px', background: c.bg, borderLeft: `5px solid ${c.color}`, borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: '#666', fontWeight: 'bold' }}>{c.label} qoldig'i</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: c.val < 0 ? '#c62828' : c.color, fontFamily: 'monospace', marginTop: 2 }}>
              {fmt(c.val)} {c.unit || 'so\'m'}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 140 }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Kassir:</div>
          <select value={currentWorker} onChange={e => setCurrentWorker(e.target.value)}
            style={{ padding: '6px 8px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4, fontWeight: 'bold', color: '#003366' }}>
            <option value="">— tanlang —</option>
            {(workers || []).map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── 3 ASOSIY TAB ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {Object.entries(TABS).map(([v, t]) => (
          <button key={v} onClick={() => setTab(v)} style={{
            flex: 1, padding: '16px 8px', cursor: 'pointer', fontSize: 16, fontWeight: 'bold',
            borderRadius: 8, border: `3px solid ${tab === v ? t.color : '#ddd'}`,
            background: tab === v ? t.color : '#f9f9f9', color: tab === v ? '#fff' : '#444',
            boxShadow: tab === v ? `0 4px 14px ${t.color}44` : 'none', transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── FORMA MAYDONI ── */}
      <div style={{ background: activeTab.bg, border: `2px solid ${activeTab.color}44`, borderRadius: 8, padding: '16px 18px', marginBottom: 16 }}>

        {/* ─ KIRIM ─ */}
        {tab === 'kirim' && (
          <form onSubmit={submitKirim}>
            <Row>
              <Field label="Mijoz (ixtiyoriy)">
                <CustomerSelect value={kirim.customer} onChange={v => setKirim({ ...kirim, customer: v })}
                  placeholder="Mijoz (izlash...)" accentColor="#2e7d32" />
              </Field>
              {kirim.customer && (
                <Field label="Mijoz holati">
                  <div style={{ padding: '6px 10px', background: '#fff', border: '1px solid #ccc', borderRadius: 4, fontSize: 12, lineHeight: 1.6 }}>
                    {custDebt > 0 && <div style={{ color: '#c62828', fontWeight: 'bold' }}>Qarz: {fmt(custDebt)} so'm</div>}
                    {custAdv  > 0 && <div style={{ color: '#2e7d32', fontWeight: 'bold' }}>Avans: {fmt(custAdv)} so'm</div>}
                    {custDebt === 0 && custAdv === 0 && <div style={{ color: '#888' }}>Qarz/avans yo'q</div>}
                  </div>
                </Field>
              )}
            </Row>
            <Row>
              <Field label="Summa *">
                <input type="number" value={kirim.amount} onChange={e => setKirim({ ...kirim, amount: e.target.value })}
                  placeholder="0" style={{ ...inp, width: 160 }} required />
                {kirim.customer && custDebt > 0 && Number(kirim.amount) > 0 && (
                  <div style={{ fontSize: 11, color: '#555', marginTop: 3 }}>
                    {Number(kirim.amount) >= custDebt
                      ? <span style={{ color: '#2e7d32' }}>✓ Qarz to'liq yopiladi, {fmt(Number(kirim.amount) - custDebt)} so'm avansga</span>
                      : <span style={{ color: '#e65100' }}>Qarzdan {fmt(kirim.amount)} yopiladi, {fmt(custDebt - Number(kirim.amount))} qoladi</span>
                    }
                  </div>
                )}
              </Field>
              <Field label="Izoh *">
                <input value={kirim.note} onChange={e => setKirim({ ...kirim, note: e.target.value })}
                  placeholder="To'lov sababi yoki qayerdan..." style={{ ...inp, width: 260 }} required />
              </Field>
            </Row>
            <Field label="Kanal"><ChanBtns value={kirim.channel} onChange={v => setKirim({ ...kirim, channel: v })} /></Field>
            <SaveBtn color="#2e7d32" label="✓ Kirim qilish" />
          </form>
        )}

        {/* ─ CHIQIM ─ */}
        {tab === 'chiqim' && (
          <form onSubmit={submitChiqim}>
            {/* O'tkazma toggle */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 'bold', color: chiqim.isTransfer ? '#6a1b9a' : '#555' }}>
                <input type="checkbox" checked={chiqim.isTransfer} onChange={e => setChiqim({ ...chiqim, isTransfer: e.target.checked })} />
                ↔️ Kanallar orasida o'tkazma
              </label>
            </div>

            {chiqim.isTransfer ? (
              <>
                <Field label="Yo'nalish">
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {TRANSFERS.map(o => (
                      <button key={o.v} type="button" onClick={() => setChiqim({ ...chiqim, tDir: o.v })} style={{
                        padding: '7px 12px', cursor: 'pointer', borderRadius: 6, fontWeight: 'bold', fontSize: 12,
                        border: `2px solid ${chiqim.tDir === o.v ? '#6a1b9a' : '#ddd'}`,
                        background: chiqim.tDir === o.v ? '#6a1b9a' : '#f9f9f9',
                        color: chiqim.tDir === o.v ? '#fff' : '#444',
                      }}>{o.label}</button>
                    ))}
                  </div>
                </Field>
              </>
            ) : (
              <Field label="Chiqim kanali">
                <ChanBtns value={chiqim.channel} onChange={v => setChiqim({ ...chiqim, channel: v })} />
              </Field>
            )}

            <Row>
              <Field label="Izoh *">
                <input value={chiqim.note} onChange={e => setChiqim({ ...chiqim, note: e.target.value })}
                  placeholder="Nima uchun chiqim (masalan: taksi, ovqat, tamirlash...)"
                  style={{ ...inp, width: 300 }} required />
              </Field>
              <Field label="Summa *">
                <input type="number" value={chiqim.amount} onChange={e => setChiqim({ ...chiqim, amount: e.target.value })}
                  placeholder="0" style={{ ...inp, width: 150 }} required />
              </Field>
            </Row>
            <SaveBtn color="#c62828" label="✓ Chiqim yozish" />
          </form>
        )}

        {/* ─ SOTISH ─ */}
        {tab === 'sotuv' && (
          <>
            {/* Sub-tab: Tonna | Kg */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[
                { v: 'ton', label: '📦 Tonnalab (Sement)', color: '#e65100' },
                { v: 'kg',  label: '🏗 Kilogramlab (Sklad)', color: '#4e342e' },
              ].map(t => (
                <button key={t.v} onClick={() => setSotuvTab(t.v)} type="button" style={{
                  padding: '8px 20px', cursor: 'pointer', fontWeight: 'bold', fontSize: 13, borderRadius: 6,
                  border: `2px solid ${sotuvTab === t.v ? t.color : '#ddd'}`,
                  background: sotuvTab === t.v ? t.color : '#f9f9f9', color: sotuvTab === t.v ? '#fff' : '#555',
                }}>{t.label}</button>
              ))}
            </div>

            {/* TONNALAB */}
            {sotuvTab === 'ton' && (
              <form onSubmit={submitSotuv}>
                {/* Sement qoldig'i */}
                <div style={{ marginBottom: 10, padding: '8px 14px', background: '#fff', borderRadius: 6, border: '1px solid #ffcc80', fontSize: 13 }}>
                  🏬 {warehouses.length > 1 ? whName(activeWh) + ' qoldig\'i' : "Sement qoldig'i"}:
                  <b style={{ color: whBal > 0 ? '#1b5e20' : '#c62828', fontFamily: 'monospace', fontSize: 16, marginLeft: 6 }}>{fmtT(whBal)} tn</b>
                  {warehouses.length > 1 && <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>Umumiy: {fmtT(totalCementBalance)} tn</span>}
                </div>
                <Row>
                  <Field label="Mijoz *">
                    <CustomerSelect value={sotuv.customer} onChange={v => setSotuv({ ...sotuv, customer: v })}
                      placeholder="Mijoz (izlash...)" accentColor="#e65100" />
                  </Field>
                  <Field label="Tonna *">
                    <input type="number" step="0.001" value={sotuv.tons} onChange={e => setSotuv({ ...sotuv, tons: e.target.value })}
                      placeholder="0.000" style={{ ...inp, width: 120 }} required />
                  </Field>
                  <Field label="1 tn narxi *">
                    <input type="number" value={sotuv.pricePerTon} onChange={e => setSotuv({ ...sotuv, pricePerTon: e.target.value })}
                      placeholder="0" style={{ ...inp, width: 140 }} required />
                  </Field>
                  {warehouses.length > 1 && (
                    <Field label="Sklad">
                      <select value={activeWh} onChange={e => setSotuv({ ...sotuv, warehouseId: e.target.value })} style={{ ...inp, fontWeight: 'bold' }}>
                        {warehouses.map(w => <option key={w.id} value={w.id}>🏬 {w.name}</option>)}
                      </select>
                    </Field>
                  )}
                </Row>
                {sotuv.tons && sotuv.pricePerTon && (
                  <div style={{ marginBottom: 10, padding: '8px 14px', background: '#fff', borderRadius: 6, border: '1px solid #ffcc80', fontSize: 14 }}>
                    💰 Jami: <b style={{ color: '#e65100', fontSize: 16 }}>{fmt(Number(sotuv.tons) * Number(sotuv.pricePerTon))} so'm</b>
                  </div>
                )}
                <Row>
                  <Field label="Izoh / Mashina №">
                    <input value={sotuv.note} onChange={e => setSotuv({ ...sotuv, note: e.target.value })}
                      placeholder="Masalan: 30156UPA, buyurtma №12..." style={{ ...inp, width: 260 }} />
                  </Field>
                  <Field label="📅 Sotuv sanasi *">
                    <input type="date" value={sotuv.date} onChange={e => setSotuv({ ...sotuv, date: e.target.value })} style={{ ...inp, width: 160 }} required />
                  </Field>
                </Row>
                <Field label="To'lov turi">
                  <ChanBtns value={sotuv.channel} onChange={v => setSotuv({ ...sotuv, channel: v })} extra={[
                    { v: 'nasiya', icon: '⚠️', label: 'Nasiya', color: '#c62828' },
                    { v: 'avans',  icon: '🅰️', label: 'Avans',  color: '#e65100' },
                  ]} />
                  {sotuv.customer && sotuv.channel === 'avans' && (
                    <div style={{ fontSize: 12, marginTop: 4, color: sotuvAdv > 0 ? '#2e7d32' : '#c62828' }}>
                      Mavjud avans: <b>{fmt(sotuvAdv)} so'm</b>
                      {sotuvAdv <= 0 && ' — yetmaydi, qolgani qarzga yoziladi'}
                    </div>
                  )}
                </Field>
                <SaveBtn color="#e65100" label="✓ Sotish (Chek chiqadi)" />
              </form>
            )}

            {/* KILOGRAMLAB */}
            {sotuvTab === 'kg' && (
              <form onSubmit={submitSklad}>
                <div style={{ marginBottom: 10, padding: '8px 14px', background: '#fff', borderRadius: 6, border: '1px solid #bcaaa4', fontSize: 13 }}>
                  🏗 Sklad qoldig'i:
                  <b style={{ color: totalSkladKg < 0 ? '#c62828' : '#4e342e', fontFamily: 'monospace', fontSize: 16, marginLeft: 6 }}>{fmt(totalSkladKg)} kg</b>
                  <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>({(totalSkladKg / 1000).toFixed(3)} tn)</span>
                </div>
                <Row>
                  <Field label="Mijoz *">
                    <CustomerSelect value={sklad.customer} onChange={v => setSklad({ ...sklad, customer: v })}
                      placeholder="Mijoz (izlash...)" accentColor="#4e342e" />
                  </Field>
                  <Field label="Kilogram *">
                    <input type="number" step="0.01" value={sklad.kg} onChange={e => setSklad({ ...sklad, kg: e.target.value })}
                      placeholder="0" style={{ ...inp, width: 120 }} required />
                  </Field>
                  <Field label="1 kg narxi *">
                    <input type="number" value={sklad.pricePerKg} onChange={e => setSklad({ ...sklad, pricePerKg: e.target.value })}
                      placeholder="0" style={{ ...inp, width: 140 }} required />
                  </Field>
                </Row>
                {sklad.kg && sklad.pricePerKg && (
                  <div style={{ marginBottom: 10, padding: '8px 14px', background: '#fff', borderRadius: 6, border: '1px solid #bcaaa4', fontSize: 14 }}>
                    💰 Jami: <b style={{ color: '#4e342e', fontSize: 16 }}>{fmt(Number(sklad.kg) * Number(sklad.pricePerKg))} so'm</b>
                    <span style={{ fontSize: 11, color: '#888', marginLeft: 12 }}>Qoldiq: {fmt(totalSkladKg - Number(sklad.kg || 0))} kg</span>
                  </div>
                )}
                <Row>
                  <Field label="Izoh">
                    <input value={sklad.note} onChange={e => setSklad({ ...sklad, note: e.target.value })}
                      placeholder="Ixtiyoriy" style={{ ...inp, width: 260 }} />
                  </Field>
                </Row>
                <Field label="To'lov turi">
                  <ChanBtns value={sklad.channel} onChange={v => setSklad({ ...sklad, channel: v })} extra={[
                    { v: 'nasiya', icon: '⚠️', label: 'Nasiya', color: '#c62828' },
                  ]} />
                </Field>
                <SaveBtn color="#4e342e" label="✓ Sklad sotuv" />
              </form>
            )}
          </>
        )}
      </div>

      {/* ── SAVDO TARIXI ── */}
      <div style={{ marginBottom: 20, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontWeight: 'bold', fontSize: 14, color: '#003366' }}>📦 Savdo tarixi</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input placeholder="🔍 Mijoz yoki izoh..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, width: 220 }} />
            <ExcelExport
              filename="Savdo_tarixi"
              sheetName="Savdo"
              title="Savdo tarixi"
              columns={[
                { header: 'Sana',        value: r => r.date },
                { header: 'Mijoz',       value: r => r.customer },
                { header: 'Tonna',       value: r => Number(r.tons || 0) },
                { header: 'Narx (1 tn)', value: r => Number(r.pricePerTon || 0) },
                { header: 'Jami summa',  value: r => Number(r.tons || 0) * Number(r.pricePerTon || 0) },
                { header: "To'lov turi", value: r => r.paymentChannel || '' },
                { header: 'Izoh',        value: r => r.note || '' },
                { header: 'Xodim',       value: r => r.worker || '' },
              ]}
              rows={filteredSales}
            />
          </div>
        </div>

        {/* Statistika */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ padding: '6px 14px', background: '#e8f5e9', borderRadius: 6, fontSize: 12 }}>
            🏬 Qoldiq: <b style={{ color: whBal > 0 ? '#1b5e20' : '#c62828' }}>{fmtT(whBal)} tn</b>
          </div>
          <div style={{ padding: '6px 14px', background: '#e3f2fd', borderRadius: 6, fontSize: 12 }}>
            📦 Jami: <b>{fmtT(totalTons)} tn · {fmt(totalSalesSum)} so'm</b>
          </div>
          {[['naqd','💵'],['bank','🏦'],['click','📱'],['nasiya','⚠️']].map(([c, icon]) => (
            <div key={c} style={{ padding: '6px 10px', background: '#f5f5f5', borderRadius: 6, fontSize: 12 }}>
              {icon} {c}: <b>{fmt(chSum(c))}</b>
            </div>
          ))}
        </div>

        <DateRangeFilter value={range} onChange={setRange} color="#003366" />

        {filteredSales.length === 0 ? (
          <p style={{ color: '#aaa', fontStyle: 'italic' }}>Savdo topilmadi.</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: 30 }}>#</th>
                    <th style={{ width: 90 }}>Sana</th>
                    <th>Mijoz</th>
                    <th>Izoh</th>
                    <th style={{ width: 90 }}>To'lov</th>
                    <th style={{ textAlign: 'right', width: 80 }}>Tonna</th>
                    <th style={{ textAlign: 'right', width: 120 }}>Narx</th>
                    <th style={{ textAlign: 'right', width: 130 }}>Jami</th>
                    <th style={{ width: 90, textAlign: 'center' }}>Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedSales.map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ color: '#888', textAlign: 'center', fontSize: 11 }}>{(salesPage - 1) * PAGE_SIZE + i + 1}</td>
                      <td style={{ fontSize: 12, color: '#555' }}>
                        <div>{r.date}</div>
                        {r.factoryTime && <div style={{ fontSize: 10, color: '#e65100', fontWeight: 'bold' }}>{r.factoryTime}</div>}
                      </td>
                      <td>
                        <div onClick={() => setCard(r.customer)} title="Mijoz kartochkasi"
                          style={{ fontWeight: 'bold', color: '#1565c0', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                          {r.customer}
                        </div>
                        {r.worker && <div style={{ fontSize: 10, color: '#aaa' }}>👷 {r.worker}</div>}
                      </td>
                      <td style={{ fontSize: 12, color: '#555', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.note || '—'}</td>
                      <td>{chBadge(r.paymentChannel)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' }}>{fmtT(r.tons)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#555' }}>{fmt(r.pricePerTon)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', fontSize: 14, color: '#333' }}>
                        {fmt(Number(r.tons) * Number(r.pricePerTon))}
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button onClick={() => printChek(r)} title="Chek chiqarish"
                          style={{ cursor: 'pointer', background: '#e3f2fd', border: '1px solid #1976d2', color: '#1565c0', borderRadius: 3, padding: '2px 6px', marginRight: 3, fontSize: 13 }}>🧾</button>
                        <button onClick={() => setNotifyRow({ name: r.customer, phone: customers?.find(c => c.name === r.customer)?.phone || '', text: saleMsg(r) })}
                          title="Xabar yuborish"
                          style={{ cursor: 'pointer', background: '#e8f5e9', border: '1px solid #2e7d32', color: '#2e7d32', borderRadius: 3, padding: '2px 6px', marginRight: 3, fontSize: 13 }}>✉️</button>
                        <button onClick={() => { if (window.confirm("O'chirasizmi?")) deleteSaleRow(r.id); }}
                          style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#c62828', fontSize: 13 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginator total={filteredSales.length} page={salesPage} setPage={setSalesPage} pageSize={PAGE_SIZE} />
          </>
        )}
      </div>

      {/* ── BUGUNGI JURNAL ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', fontSize: 14, color: '#003366' }}>📋 Bugungi kassa operatsiyalari ({journalRows.length} ta)</span>
          <span style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: 12 }}>+{fmt(todayIn)}</span>
          <span style={{ color: '#c62828', fontWeight: 'bold', fontSize: 12 }}>{fmt(todayOut)}</span>
          <span style={{ color: '#555', fontSize: 12 }}>= <b>{fmt(todayIn + todayOut)}</b> so'm sof</span>
          <ExcelExport
            filename={`Jurnal_${today.replace(/\./g, '-')}`}
            sheetName="Jurnal"
            title={`Bugungi jurnal — ${today}`}
            columns={[
              { header: 'Vaqt',     value: r => timeStr(r.createdAt) },
              { header: 'Kanal',    value: r => r._ch || '' },
              { header: 'Operatsiya', value: r => OP_LABELS[r.sourceType] || (Number(r.amount) > 0 ? 'Kirim' : 'Chiqim') },
              { header: 'Izoh',     value: r => r.desc || r.note || '' },
              { header: 'Summa',    value: r => Number(r.amount || 0) },
              { header: 'Xodim',    value: r => r.worker || '' },
            ]}
            rows={journalRows}
          />
        </div>

        {journalRows.length === 0 ? (
          <p style={{ color: '#aaa', fontStyle: 'italic' }}>Bugun hali operatsiya yo'q.</p>
        ) : (
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 50 }}>Vaqt</th>
                <th style={{ width: 60 }}>Kanal</th>
                <th style={{ width: 140 }}>Operatsiya</th>
                <th>Izoh</th>
                <th style={{ textAlign: 'right', width: 130 }}>Summa</th>
                <th style={{ width: 80 }}>Xodim</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {journalRows.map((r, i) => {
                const amt = Number(r.amount || 0);
                const ch = CH.find(c => c.v === r._ch);
                const opLabel = OP_LABELS[r.sourceType] || (amt > 0 ? '➕ Kirim' : '➖ Chiqim');
                return (
                  <tr key={r.id || i} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                    <td style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{timeStr(r.createdAt)}</td>
                    <td style={{ fontSize: 11, color: ch?.color || '#555' }}>{ch?.icon} {ch?.label || r._ch}</td>
                    <td style={{ fontWeight: 'bold', color: '#003366', fontSize: 12 }}>{opLabel}</td>
                    <td style={{ fontSize: 12, color: '#555', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.desc || r.note || '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: amt >= 0 ? '#2e7d32' : '#c62828', fontSize: 14 }}>
                      {amt >= 0 ? '+' : ''}{fmt(amt)}
                    </td>
                    <td style={{ fontSize: 11, color: '#888' }}>{r.worker || '—'}</td>
                    <td>
                      {r.sourceType === 'sale' && (() => {
                        const sale = (salesRows || []).find(s => s.id === r.sourceId);
                        if (!sale) return null;
                        return (
                          <button type="button" onClick={() => printChek(sale)}
                            style={{ padding: '2px 6px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 11 }}>
                            🧾
                          </button>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background: '#fffde7', fontWeight: 'bold', borderTop: '2px solid #fbc02d' }}>
                <td colSpan={4} style={{ textAlign: 'right', padding: '6px 8px' }}>BUGUNGI JAMI:</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', color: (todayIn + todayOut) >= 0 ? '#2e7d32' : '#c62828', fontSize: 14 }}>
                  {(todayIn + todayOut) >= 0 ? '+' : ''}{fmt(todayIn + todayOut)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {notifyRow && <NotifyModal name={notifyRow.name} phone={notifyRow.phone} defaultText={notifyRow.text} onClose={() => setNotifyRow(null)} />}
      {card && <CustomerCard name={card} onClose={() => setCard(null)} />}
    </div>
  );
}
