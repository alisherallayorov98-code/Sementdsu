import { useState, useEffect, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { api } from '../api';
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
const toDay = () => new Date().toLocaleDateString('ru-RU');
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
  sale: '📦 Sotuv', sklad_sale: '🏗 Sklad', sklad_nasiya: '⚠️ Sklad Nasiya',
  debt_payment: '💰 Qarz to\'lovi', advance: '🔄 Avans', salary: '👔 Oylik',
  supplier_payment: '🏭 Zavod', transfer: '↔️ O\'tkazma', recv: '🏗 Sement olish',
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
function FRow({ children }) {
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
    cashRows, addCashRow, updateCashRow,
    bankRows, addBankRow, updateBankRow,
    clickRows, addClickRow, updateClickRow,
    totalCashBalance, totalBankBalance, totalClickBalance,
    payCustomerDebt, addAdvanceRow,
    advanceBalanceOf, debtRows,
    salesRows,
    appSettings, currentWorker, setCurrentWorker, workers,
    addSkladSotuv, totalSkladKg, skladRows, updateSkladRow, deleteSkladSotuv,
    cementTypes, skladKgByType,
  } = data;

  // ── Tab holati ────────────────────────────────────────────────────────────────
  const [tab, setTab]     = useState('kirim');
  const [toast, setToast] = useState('');
  const showToast = useCallback((msg) => setToast(msg), []);

  // ── Formalar ─────────────────────────────────────────────────────────────────
  const [kirim,  setKirim]  = useState({ customer: '', amount: '', note: '', channel: 'naqd' });
  const [chiqim, setChiqim] = useState({ customer: '', amount: '', note: '', channel: 'naqd', isTransfer: false, tDir: 'bank_to_naqd' });
  const [sklad,  setSklad]  = useState({ customer: '', kg: '', pricePerKg: '', channel: 'naqd', note: '', cementType: '' });

  // ── Modallar ──────────────────────────────────────────────────────────────────
  const [notifyRow,    setNotifyRow]    = useState(null);
  const [card,         setCard]         = useState(null);
  const [editRow,      setEditRow]      = useState(null); // { row, channel }
  const [editSkladRow, setEditSkladRow] = useState(null);

  // ── Sklad tarixi filter ────────────────────────────────────────────────────────
  const [skladSearch, setSkladSearch] = useState('');
  const [skladRange,  setSkladRange]  = useState({ from: '', to: '' });
  const [skladPage,   setSkladPage]   = useState(1);
  useEffect(() => { setSkladPage(1); }, [skladSearch, skladRange.from, skladRange.to]);

  // ── Mijoz holati (kirim tab) ──────────────────────────────────────────────────
  const custDebt = kirim.customer
    ? debtRows.filter(r => r.customer === kirim.customer).reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.paid)), 0)
    : 0;
  const custAdv = kirim.customer ? advanceBalanceOf(kirim.customer) : 0;

  const addRow = (channel, amount, desc, customer = '') => {
    const fn = { naqd: addCashRow, bank: addBankRow, click: addClickRow }[channel];
    if (fn) fn(amount, desc, toDay(), customer);
  };

  // ── KIRIM ────────────────────────────────────────────────────────────────────
  const submitKirim = (e) => {
    e.preventDefault();
    const amt = Number(kirim.amount);
    if (!amt) return;
    if (kirim.customer) {
      const res = payCustomerDebt(kirim.customer, amt, kirim.channel, kirim.note);
      if (res.applied === 0) {
        addAdvanceRow(kirim.customer, amt, kirim.note, kirim.channel);
        showToast(`${fmt(amt)} so'm avans sifatida qabul qilindi`);
      } else if (res.leftover > 0) {
        addAdvanceRow(kirim.customer, res.leftover, `${kirim.note} (ortiqcha)`, kirim.channel);
        showToast(`${fmt(res.applied)} qarz ✓ · ${fmt(res.leftover)} avans`);
      } else {
        showToast(`${fmt(res.applied)} so'm qarz to'lovi qabul qilindi`);
      }
    } else {
      addRow(kirim.channel, amt, kirim.note, kirim.customer);
      showToast(`+${fmt(amt)} so'm kirim`);
    }
    setKirim({ customer: '', amount: '', note: '', channel: 'naqd' });
  };

  // ── CHIQIM ───────────────────────────────────────────────────────────────────
  const submitChiqim = (e) => {
    e.preventDefault();
    const amt = Number(chiqim.amount);
    if (!amt) return;
    if (chiqim.isTransfer) {
      const opt = TRANSFERS.find(o => o.v === chiqim.tDir);
      if (!opt) return;
      const tag = `↔️ ${opt.label}${chiqim.note ? ': ' + chiqim.note : ''}`;
      addRow(opt.from, -amt, tag);
      addRow(opt.to,   +amt, tag);
      showToast(`${fmt(amt)} so'm o'tkazildi`);
    } else {
      const fullDesc = chiqim.note;
      addRow(chiqim.channel, -amt, fullDesc, chiqim.customer);
      showToast(`-${fmt(amt)} so'm chiqim`);
      // Haydovchiga Telegram xabari (agar mijoz haydovchi bo'lsa)
      if (chiqim.customer) {
        const { drivers = [] } = data;
        const isDriver = drivers.some(d => d.name.trim().toLowerCase() === chiqim.customer.trim().toLowerCase());
        if (isDriver) {
          api.notifyDriverPayment(chiqim.customer, amt, chiqim.channel).catch(() => {});
        }
      }
    }
    setChiqim({ customer: '', amount: '', note: '', channel: 'naqd', isTransfer: false, tDir: 'bank_to_naqd' });
  };

  // ── SKLAD SOTUV (kg) ─────────────────────────────────────────────────────────
  const submitSklad = (e) => {
    e.preventDefault();
    if (!sklad.customer || !sklad.kg || !sklad.pricePerKg) return;
    if (totalSkladKg < Number(sklad.kg)) {
      alert(`Sklad qoldig'i yetarli emas. Qoldiq: ${fmt(totalSkladKg)} kg`); return;
    }
    const created = addSkladSotuv({ customer: sklad.customer, kg: sklad.kg, pricePerKg: sklad.pricePerKg, channel: sklad.channel, note: sklad.note, cementType: sklad.cementType });
    showToast(`${sklad.kg} kg sotildi — ${fmt(Number(sklad.kg) * Number(sklad.pricePerKg))} so'm`);
    if (created && sklad.channel !== 'nasiya') {
      const kgAbs = Math.abs(Number(sklad.kg));
      const q = customerSummary(created.customer, data).qolganQarz;
      printSaleReceipt({
        customer: created.customer, tons: (kgAbs / 1000).toFixed(3),
        pricePerTon: Number(sklad.pricePerKg) * 1000,
        paymentChannel: created.channel,
        note: `${created.note || ''} (${kgAbs} kg)`,
        date: created.date, worker: currentWorker,
      }, { appName: appSettings?.appName || 'SEMENT', phone: appSettings?.companyPhone || '', address: appSettings?.companyAddress || '', qolganQarz: q });
    }
    setSklad({ customer: '', kg: '', pricePerKg: '', channel: 'naqd', note: '', cementType: '' });
  };

  // ── Sklad cheki ──────────────────────────────────────────────────────────────
  const printSkladChek = (sale) => {
    const kgAbs = Math.abs(Number(sale.kg));
    const q = customerSummary(sale.customer, data).qolganQarz;
    printSaleReceipt({
      customer: sale.customer, tons: (kgAbs / 1000).toFixed(3),
      pricePerTon: Number(sale.pricePerKg) * 1000,
      paymentChannel: sale.channel,
      note: `${sale.note || ''} (${kgAbs} kg)`,
      date: sale.date, worker: sale.worker || '',
    }, { appName: appSettings?.appName || 'SEMENT', phone: appSettings?.companyPhone || '', address: appSettings?.companyAddress || '', qolganQarz: q });
  };

  // ── Kassa yozuvi tahrirlash ───────────────────────────────────────────────────
  const saveEdit = (fields) => {
    if (!editRow) return;
    const { row, channel } = editRow;
    const fn = { naqd: updateCashRow, bank: updateBankRow, click: updateClickRow }[channel];
    if (fn) fn(row.id, fields);
    setEditRow(null);
    showToast('Saqlandi');
  };

  // ── Sklad tarixi ─────────────────────────────────────────────────────────────
  const SK_PAGE = 50;
  const sortedSklad = [...(skladRows || []).filter(r => r.type === 'chiqim')]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const filteredSklad = filterByRange(
    sortedSklad.filter(r =>
      !skladSearch ||
      (r.customer || '').toLowerCase().includes(skladSearch.toLowerCase()) ||
      (r.note || '').toLowerCase().includes(skladSearch.toLowerCase())
    ),
    skladRange
  );
  const pagedSklad = filteredSklad.slice((skladPage - 1) * SK_PAGE, skladPage * SK_PAGE);
  const totalSkladKgSold  = sortedSklad.reduce((s, r) => s + Math.abs(Number(r.kg || 0)), 0);
  const totalSkladSomSold = sortedSklad.reduce((s, r) => s + Math.abs(Number(r.kg || 0)) * Number(r.pricePerKg || 0), 0);

  const chBadge = (ch) => {
    const colors = { naqd: ['#e8f5e9','#2e7d32'], bank: ['#e3f2fd','#0d47a1'], click: ['#f3e5f5','#4a148c'], nasiya: ['#ffebee','#c62828'], avans: ['#fff8e1','#e65100'] };
    const [bg, fg] = colors[ch] || ['#f5f5f5', '#555'];
    return <span style={{ background: bg, color: fg, padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', border: `1px solid ${fg}44` }}>{(ch || '').toUpperCase()}</span>;
  };

  // ── Bugungi jurnal ────────────────────────────────────────────────────────────
  const today = toDay();
  const jSkladNasiya = (skladRows || [])
    .filter(r => r.date === today && r.type === 'chiqim' && r.channel === 'nasiya')
    .map(r => ({
      ...r, _ch: 'nasiya_sklad', _nasiyaAmt: r.amount, amount: 0,
      desc: `Sklad nasiya: ${r.customer} (${Math.abs(r.kg)} kg × ${fmt(r.pricePerKg)} so'm/kg)`,
      sourceType: 'sklad_nasiya',
    }));

  const journalRows = [
    ...cashRows.map(r => ({ ...r, _ch: 'naqd' })),
    ...bankRows.map(r => ({ ...r, _ch: 'bank' })),
    ...clickRows.map(r => ({ ...r, _ch: 'click' })),
    ...jSkladNasiya,
  ].filter(r => r.date === today).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const todayIn  = journalRows.filter(r => Number(r.amount) > 0).reduce((s, r) => s + Number(r.amount), 0);
  const todayOut = journalRows.filter(r => Number(r.amount) < 0).reduce((s, r) => s + Number(r.amount), 0);

  // ── Tablar ────────────────────────────────────────────────────────────────────
  const TABS = {
    kirim:  { color: '#2e7d32', bg: '#e8f5e9', label: '➕ Kirim' },
    chiqim: { color: '#c62828', bg: '#ffebee', label: '➖ Chiqim' },
    sotuv:  { color: '#4e342e', bg: '#efebe9', label: '🏗 Sotish (kg)' },
  };
  const activeTab = TABS[tab];

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13, paddingBottom: 30 }}>
      <Toast msg={toast} onHide={() => setToast('')} />

      {/* ── BALANSLAR ── */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14,
        paddingBottom: 10, borderBottom: '2px solid #eee',
      }}>
        {[
          { label: '💵 Naqd',  val: totalCashBalance,  color: '#1565c0', bg: '#e3f2fd' },
          { label: '🏦 Bank',  val: totalBankBalance,  color: '#2e7d32', bg: '#e8f5e9' },
          { label: '📱 Click', val: totalClickBalance, color: '#6a1b9a', bg: '#f3e5f5' },
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

      {/* ── FORMA ── */}
      <div style={{ background: activeTab.bg, border: `2px solid ${activeTab.color}44`, borderRadius: 8, padding: '16px 18px', marginBottom: 16 }}>

        {/* ─ KIRIM ─ */}
        {tab === 'kirim' && (
          <form onSubmit={submitKirim}>
            <FRow>
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
            </FRow>
            <FRow>
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
              <Field label="Izoh">
                <input value={kirim.note} onChange={e => setKirim({ ...kirim, note: e.target.value })}
                  placeholder="To'lov sababi yoki qayerdan..." style={{ ...inp, width: 260 }} />
              </Field>
            </FRow>
            <Field label="Kanal"><ChanBtns value={kirim.channel} onChange={v => setKirim({ ...kirim, channel: v })} /></Field>
            <SaveBtn color="#2e7d32" label="✓ Kirim qilish" />
          </form>
        )}

        {/* ─ CHIQIM ─ */}
        {tab === 'chiqim' && (
          <form onSubmit={submitChiqim}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 'bold', color: chiqim.isTransfer ? '#6a1b9a' : '#555' }}>
                <input type="checkbox" checked={chiqim.isTransfer} onChange={e => setChiqim({ ...chiqim, isTransfer: e.target.checked })} />
                ↔️ Kanallar orasida o'tkazma
              </label>
            </div>
            {chiqim.isTransfer ? (
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
            ) : (
              <Field label="Chiqim kanali">
                <ChanBtns value={chiqim.channel} onChange={v => setChiqim({ ...chiqim, channel: v })} />
              </Field>
            )}
            {!chiqim.isTransfer && (
              <FRow>
                <Field label="Mijoz (ixtiyoriy)">
                  <CustomerSelect value={chiqim.customer} onChange={v => setChiqim({ ...chiqim, customer: v })}
                    placeholder="Pul kimga chiqdi? (ixtiyoriy)" accentColor="#c62828" />
                </Field>
              </FRow>
            )}
            <FRow>
              <Field label="Izoh">
                <input value={chiqim.note} onChange={e => setChiqim({ ...chiqim, note: e.target.value })}
                  placeholder="Nima uchun chiqim (masalan: taksi, ovqat, tamirlash...)"
                  style={{ ...inp, width: 300 }} />
              </Field>
              <Field label="Summa *">
                <input type="number" value={chiqim.amount} onChange={e => setChiqim({ ...chiqim, amount: e.target.value })}
                  placeholder="0" style={{ ...inp, width: 150 }} required />
              </Field>
            </FRow>
            <SaveBtn color="#c62828" label="✓ Chiqim yozish" />
          </form>
        )}

        {/* ─ SOTISH (kg) ─ */}
        {tab === 'sotuv' && (
          <form onSubmit={submitSklad}>
            <div style={{ marginBottom: 10, padding: '8px 14px', background: '#fff', borderRadius: 6, border: '1px solid #bcaaa4', fontSize: 13 }}>
              <div style={{ marginBottom: 4 }}>
                🏗 Jami sklad qoldig'i:
                <b style={{ color: totalSkladKg < 0 ? '#c62828' : '#4e342e', fontFamily: 'monospace', fontSize: 16, marginLeft: 6 }}>{fmt(totalSkladKg)} kg</b>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {cementTypes.map(t => {
                  const kgVal = skladKgByType[t] || 0;
                  return (
                    <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, border: `1px solid ${kgVal > 0 ? '#4e342e' : '#ddd'}`, background: kgVal > 0 ? '#efebe9' : '#f9f9f9', color: kgVal > 0 ? '#4e342e' : '#bbb', fontFamily: 'monospace', fontWeight: kgVal > 0 ? 'bold' : 'normal' }}>
                      {t}: {fmt(kgVal)} kg
                    </span>
                  );
                })}
              </div>
            </div>
            <FRow>
              <Field label="Mijoz *">
                <CustomerSelect value={sklad.customer} onChange={v => setSklad({ ...sklad, customer: v })}
                  placeholder="Mijoz (izlash...)" accentColor="#4e342e" />
              </Field>
              <Field label="Sement turi *">
                <select value={sklad.cementType} onChange={e => setSklad({ ...sklad, cementType: e.target.value })}
                  style={{ ...inp, width: 160, color: sklad.cementType ? '#4a148c' : '#999', fontWeight: sklad.cementType ? 'bold' : 'normal' }} required>
                  <option value="">— tanlang —</option>
                  {cementTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Kilogram *">
                <input type="number" step="0.01" value={sklad.kg} onChange={e => setSklad({ ...sklad, kg: e.target.value })}
                  placeholder="0" style={{ ...inp, width: 120 }} required />
              </Field>
              <Field label="1 kg narxi *">
                <input type="number" value={sklad.pricePerKg} onChange={e => setSklad({ ...sklad, pricePerKg: e.target.value })}
                  placeholder="0" style={{ ...inp, width: 140 }} required />
              </Field>
            </FRow>
            {sklad.kg && sklad.pricePerKg && (
              <div style={{ marginBottom: 10, padding: '8px 14px', background: '#fff', borderRadius: 6, border: '1px solid #bcaaa4', fontSize: 14 }}>
                💰 Jami: <b style={{ color: '#4e342e', fontSize: 16 }}>{fmt(Number(sklad.kg) * Number(sklad.pricePerKg))} so'm</b>
                <span style={{ fontSize: 11, color: '#888', marginLeft: 12 }}>Qoldiq: {fmt(totalSkladKg - Number(sklad.kg || 0))} kg</span>
              </div>
            )}
            <FRow>
              <Field label="Izoh">
                <input value={sklad.note} onChange={e => setSklad({ ...sklad, note: e.target.value })}
                  placeholder="Ixtiyoriy" style={{ ...inp, width: 260 }} />
              </Field>
            </FRow>
            <Field label="To'lov turi">
              <ChanBtns value={sklad.channel} onChange={v => setSklad({ ...sklad, channel: v })} extra={[
                { v: 'nasiya', icon: '⚠️', label: 'Nasiya', color: '#c62828' },
              ]} />
            </Field>
            <SaveBtn color="#4e342e" label="✓ Sotish (Chek chiqadi)" />
          </form>
        )}
      </div>

      {/* ── SKLAD SAVDO TARIXI (kg) ── */}
      <div style={{ marginBottom: 20, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontWeight: 'bold', fontSize: 14, color: '#4e342e' }}>🏗 Sklad savdo tarixi (kg)</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input placeholder="🔍 Mijoz yoki izoh..." value={skladSearch}
              onChange={e => setSkladSearch(e.target.value)} style={{ ...inp, width: 220 }} />
            <ExcelExport
              filename="Sklad_savdo_tarixi"
              sheetName="Sklad"
              title="Sklad savdo tarixi (kg)"
              columns={[
                { header: 'Sana',       value: r => r.date },
                { header: 'Mijoz',      value: r => r.customer },
                { header: 'Tur',        value: r => r.cementType || '' },
                { header: 'Kg',         value: r => Math.abs(Number(r.kg || 0)) },
                { header: 'Narx/kg',    value: r => Number(r.pricePerKg || 0) },
                { header: 'Jami summa', value: r => Math.abs(Number(r.kg || 0)) * Number(r.pricePerKg || 0) },
                { header: "To'lov",     value: r => r.channel || '' },
                { header: 'Izoh',       value: r => r.note || '' },
                { header: 'Xodim',      value: r => r.worker || '' },
              ]}
              rows={filteredSklad}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ padding: '6px 14px', background: '#efebe9', borderRadius: 6, fontSize: 12 }}>
            🏗 Qoldiq: <b style={{ color: totalSkladKg < 0 ? '#c62828' : '#4e342e' }}>{fmt(totalSkladKg)} kg</b>
          </div>
          <div style={{ padding: '6px 14px', background: '#e3f2fd', borderRadius: 6, fontSize: 12 }}>
            📦 Jami sotilgan: <b>{fmt(totalSkladKgSold)} kg · {fmt(totalSkladSomSold)} so'm</b>
          </div>
        </div>

        <DateRangeFilter value={skladRange} onChange={setSkladRange} color="#4e342e" />

        {filteredSklad.length === 0 ? (
          <p style={{ color: '#aaa', fontStyle: 'italic' }}>Sklad savdo topilmadi.</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: 30 }}>#</th>
                    <th style={{ width: 90 }}>Sana</th>
                    <th>Mijoz</th>
                    <th style={{ width: 110 }}>Tur</th>
                    <th>Izoh</th>
                    <th style={{ width: 90 }}>To'lov</th>
                    <th style={{ textAlign: 'right', width: 80 }}>Kg</th>
                    <th style={{ textAlign: 'right', width: 100 }}>Narx/kg</th>
                    <th style={{ textAlign: 'right', width: 130 }}>Jami</th>
                    <th style={{ width: 70, textAlign: 'center' }}>Xodim</th>
                    <th style={{ width: 90, textAlign: 'center' }}>Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedSklad.map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ color: '#888', textAlign: 'center', fontSize: 11 }}>{(skladPage - 1) * SK_PAGE + i + 1}</td>
                      <td style={{ fontSize: 12, color: '#555' }}>{r.date}</td>
                      <td>
                        <div onClick={() => setCard(r.customer)} title="Mijoz kartochkasi"
                          style={{ fontWeight: 'bold', color: '#1565c0', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                          {r.customer}
                        </div>
                      </td>
                      <td style={{ fontSize: 11, color: '#4a148c', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{r.cementType || '—'}</td>
                      <td style={{ fontSize: 12, color: '#555', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.note || '—'}</td>
                      <td>{chBadge(r.channel)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' }}>{fmt(Math.abs(Number(r.kg || 0)))}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#555' }}>{fmt(r.pricePerKg)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', fontSize: 14, color: '#333' }}>
                        {fmt(Math.abs(Number(r.kg || 0)) * Number(r.pricePerKg || 0))}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: 11, color: '#888' }}>{r.worker || '—'}</td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button onClick={() => printSkladChek(r)} title="Chek chiqarish"
                          style={{ cursor: 'pointer', background: '#e3f2fd', border: '1px solid #1976d2', color: '#1565c0', borderRadius: 3, padding: '2px 6px', marginRight: 3, fontSize: 13 }}>🧾</button>
                        <button onClick={() => setEditSkladRow(r)} title="Tahrirlash"
                          style={{ cursor: 'pointer', background: '#fff8e1', border: '1px solid #f9a825', color: '#e65100', borderRadius: 3, padding: '2px 6px', marginRight: 3, fontSize: 13 }}>✏️</button>
                        <button onClick={() => { if (window.confirm("O'chirasizmi? Bog'liq to'lov yozuvlari ham o'chadi.")) deleteSkladSotuv(r.id); }}
                          style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#c62828', fontSize: 13 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginator total={filteredSklad.length} page={skladPage} setPage={setSkladPage} pageSize={SK_PAGE} />
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
              { header: 'Vaqt',       value: r => timeStr(r.createdAt) },
              { header: 'Kanal',      value: r => r._ch || '' },
              { header: 'Operatsiya', value: r => OP_LABELS[r.sourceType] || (Number(r.amount) > 0 ? 'Kirim' : 'Chiqim') },
              { header: 'Mijoz',      value: r => r.customer || '' },
              { header: 'Izoh',       value: r => r.desc || r.note || '' },
              { header: 'Summa',      value: r => r._ch === 'nasiya_sklad' ? r._nasiyaAmt : Number(r.amount || 0) },
              { header: 'Xodim',      value: r => r.worker || '' },
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
                <th style={{ width: 130 }}>Operatsiya</th>
                <th style={{ width: 120 }}>Mijoz</th>
                <th>Izoh</th>
                <th style={{ textAlign: 'right', width: 130 }}>Summa</th>
                <th style={{ width: 80 }}>Xodim</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {journalRows.map((r, i) => {
                const amt = Number(r.amount || 0);
                const isNasiyaSklad = r._ch === 'nasiya_sklad';
                const ch = isNasiyaSklad
                  ? { icon: '⚠️', label: 'Nasiya', color: '#c62828' }
                  : CH.find(c => c.v === r._ch);
                const opLabel = OP_LABELS[r.sourceType] || (amt > 0 ? '➕ Kirim' : '➖ Chiqim');
                return (
                  <tr key={r.id || i} style={{
                    background: isNasiyaSklad ? '#fff8e1' : (i % 2 === 0 ? '#fff' : '#f9f9f9'),
                    borderLeft: isNasiyaSklad ? '3px solid #f9a825' : undefined,
                  }}>
                    <td style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{timeStr(r.createdAt)}</td>
                    <td style={{ fontSize: 11, color: ch?.color || '#555' }}>{ch?.icon} {ch?.label || r._ch}</td>
                    <td style={{ fontWeight: 'bold', color: '#003366', fontSize: 12 }}>{opLabel}</td>
                    <td>
                      {r.customer
                        ? <span onClick={() => setCard(r.customer)} title="Mijoz kartochkasi"
                            style={{ fontWeight: 'bold', color: '#1565c0', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', fontSize: 12 }}>
                            {r.customer}
                          </span>
                        : <span style={{ color: '#ccc', fontSize: 11 }}>—</span>
                      }
                    </td>
                    <td style={{ fontSize: 12, color: '#555', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.desc || r.note || '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', fontSize: 14 }}>
                      {isNasiyaSklad
                        ? <span style={{ color: '#e65100' }}>{fmt(r._nasiyaAmt)} <span style={{ fontSize: 10, background: '#ffe0b2', color: '#e65100', borderRadius: 4, padding: '1px 5px' }}>NASIYA</span></span>
                        : <span style={{ color: amt >= 0 ? '#2e7d32' : '#c62828' }}>{amt >= 0 ? '+' : ''}{fmt(amt)}</span>
                      }
                    </td>
                    <td style={{ fontSize: 11, color: '#888' }}>{r.worker || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {r.sourceType === 'sale' && (() => {
                        const sale = (salesRows || []).find(s => s.id === r.sourceId);
                        if (!sale) return null;
                        return (
                          <button type="button" onClick={() => {
                            const q = customerSummary(sale.customer, data).qolganQarz;
                            printSaleReceipt(sale, { appName: appSettings?.appName || 'SEMENT', phone: appSettings?.companyPhone || '', address: appSettings?.companyAddress || '', qolganQarz: q });
                          }}
                            style={{ padding: '2px 6px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 11, marginRight: 3 }}>
                            🧾
                          </button>
                        );
                      })()}
                      {!isNasiyaSklad && (
                        <button type="button" onClick={() => setEditRow({ row: r, channel: r._ch })}
                          title="Tahrirlash"
                          style={{ padding: '2px 6px', background: '#f5f5f5', border: '1px solid #ccc', borderRadius: 3, cursor: 'pointer', fontSize: 11 }}>
                          ✏️
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background: '#fffde7', fontWeight: 'bold', borderTop: '2px solid #fbc02d' }}>
                <td colSpan={5} style={{ textAlign: 'right', padding: '6px 8px' }}>BUGUNGI JAMI (naqd):</td>
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
      {editRow && <EditModal row={editRow.row} channel={editRow.channel} onSave={saveEdit} onClose={() => setEditRow(null)} />}
      {editSkladRow && (
        <SkladEditModal
          row={editSkladRow}
          onSave={(fields) => { updateSkladRow(editSkladRow.id, fields); setEditSkladRow(null); showToast('Saqlandi'); }}
          onClose={() => setEditSkladRow(null)}
        />
      )}
    </div>
  );
}

// ── EditModal (kassa yozuvi) ──────────────────────────────────────────────────
function EditModal({ row, channel, onSave, onClose }) {
  const isAuto = row.auto === true;
  const [desc,   setDesc]   = useState(row.desc || row.note || '');
  const [amount, setAmount] = useState(String(Math.abs(Number(row.amount || 0))));

  const handleSave = (e) => {
    e.preventDefault();
    const fields = { desc };
    if (!isAuto) {
      const sign = Number(row.amount) >= 0 ? 1 : -1;
      fields.amount = sign * Number(amount);
    }
    onSave(fields);
  };

  const chColor = { naqd: '#1565c0', bank: '#2e7d32', click: '#6a1b9a' }[channel] || '#333';
  const isOut = Number(row.amount) < 0;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 420, fontFamily: 'Tahoma, sans-serif', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
        <div style={{ background: chColor, color: '#fff', padding: '12px 16px', borderRadius: '8px 8px 0 0', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
          <span>✏️ Tahrirlash — {channel?.toUpperCase()}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <form onSubmit={handleSave} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, color: '#888' }}>
            {row.date} · {isOut ? 'Chiqim' : 'Kirim'}
            {isAuto && <span style={{ marginLeft: 8, background: '#fff3e0', color: '#e65100', padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>avtomatik yozuv — faqat izoh tahrir qilinadi</span>}
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 'bold', color: '#555', display: 'block', marginBottom: 4 }}>Izoh *</label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
              style={{ ...inpS, width: '100%', boxSizing: 'border-box' }}
              placeholder="Izoh yozing..." required />
          </div>
          {!isAuto && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 'bold', color: '#555', display: 'block', marginBottom: 4 }}>Summa (mutlaq qiymat) *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                style={{ ...inpS, width: 180 }} required />
              <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>Manfiy/musbat belgi avtomatik saqlanadi</div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 20px', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', background: '#f5f5f5' }}>Bekor</button>
            <button type="submit" style={{ padding: '8px 24px', background: chColor, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>✓ Saqlash</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── SkladEditModal ─────────────────────────────────────────────────────────────
function SkladEditModal({ row, onSave, onClose }) {
  const kgAbs = Math.abs(Number(row.kg || 0));
  const [customer, setCustomer] = useState(row.customer || '');
  const [note,     setNote]     = useState(row.note || '');

  const handleSave = (e) => {
    e.preventDefault();
    onSave({ customer, note });
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 420, fontFamily: 'Tahoma, sans-serif', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
        <div style={{ background: '#4e342e', color: '#fff', padding: '12px 16px', borderRadius: '8px 8px 0 0', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
          <span>✏️ Sklad sotuv tahrirlash</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <form onSubmit={handleSave} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, color: '#888' }}>
            {row.date} · {kgAbs} kg · {fmt(kgAbs * Number(row.pricePerKg || 0))} so'm · {(row.channel || '').toUpperCase()}
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 'bold', color: '#555', display: 'block', marginBottom: 4 }}>Mijoz *</label>
            <input value={customer} onChange={e => setCustomer(e.target.value)}
              style={{ ...inpS, width: '100%', boxSizing: 'border-box' }} required />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 'bold', color: '#555', display: 'block', marginBottom: 4 }}>Izoh</label>
            <input value={note} onChange={e => setNote(e.target.value)}
              style={{ ...inpS, width: '100%', boxSizing: 'border-box' }} placeholder="Ixtiyoriy" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 20px', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', background: '#f5f5f5' }}>Bekor</button>
            <button type="submit" style={{ padding: '8px 24px', background: '#4e342e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>✓ Saqlash</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inpS = { padding: '7px 10px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4, fontFamily: 'Tahoma, sans-serif' };
