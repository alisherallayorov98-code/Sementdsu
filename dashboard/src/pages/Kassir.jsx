import { useState, useEffect, useCallback } from 'react';
import { useData } from '../context/DataContext';
import CustomerSelect from '../components/CustomerSelect';
import { printSaleReceipt } from '../lib/receipt';
import { customerSummary } from '../lib/customerSummary';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(3); };
const todayStr = () => new Date().toLocaleDateString('ru-RU');
const timeStr  = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

const CHANNELS = [
  { v: 'naqd',  icon: '💵', label: 'Naqd',  color: '#1565c0' },
  { v: 'bank',  icon: '🏦', label: 'Bank',  color: '#2e7d32' },
  { v: 'click', icon: '📱', label: 'Click', color: '#6a1b9a' },
];

const EXPENSE_CATS = [
  { v: 'ovqat',    label: '🍽 Ovqat'      },
  { v: 'transport', label: '🚕 Transport'  },
  { v: 'aloqa',    label: '📞 Aloqa'      },
  { v: 'tamirlash', label: '🔧 Ta\'mirlash'},
  { v: 'boshqa',   label: '💼 Boshqa'     },
];

const TRANSFER_OPTS = [
  { v: 'bank_to_naqd',  label: '🏦 Bank → 💵 Naqd',  from: 'bank',  to: 'naqd'  },
  { v: 'naqd_to_bank',  label: '💵 Naqd → 🏦 Bank',  from: 'naqd',  to: 'bank'  },
  { v: 'bank_to_click', label: '🏦 Bank → 📱 Click', from: 'bank',  to: 'click' },
  { v: 'click_to_bank', label: '📱 Click → 🏦 Bank', from: 'click', to: 'bank'  },
  { v: 'naqd_to_click', label: '💵 Naqd → 📱 Click', from: 'naqd',  to: 'click' },
  { v: 'click_to_naqd', label: '📱 Click → 💵 Naqd', from: 'click', to: 'naqd'  },
];

const SOURCE_LABELS = {
  sale:             '📦 Sotuv',
  debt_payment:     '💰 Qarz to\'lovi',
  advance:          '🔄 Avans',
  salary:           '👔 Oylik',
  supplier_payment: '🏭 Zavod to\'lovi',
  transfer:         '↔️ O\'tkazma',
  recv:             '🏗 Sement olish',
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, onHide }) {
  useEffect(() => { if (msg) { const t = setTimeout(onHide, 2200); return () => clearTimeout(t); } }, [msg, onHide]);
  if (!msg) return null;
  return (
    <div style={{
      position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
      background: '#2e7d32', color: '#fff', padding: '12px 28px', borderRadius: 8,
      fontWeight: 'bold', fontSize: 15, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      pointerEvents: 'none',
    }}>
      ✅ {msg}
    </div>
  );
}

// ── Kanal tugmalari ────────────────────────────────────────────────────────────
function ChannelBtns({ value, onChange, extra = [] }) {
  const all = [...CHANNELS, ...extra];
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {all.map(ch => (
        <button key={ch.v} type="button" onClick={() => onChange(ch.v)} style={{
          padding: '7px 14px', cursor: 'pointer', fontWeight: 'bold', fontSize: 13,
          border: `2px solid ${value === ch.v ? ch.color : '#ccc'}`,
          background: value === ch.v ? ch.color : '#f9f9f9',
          color: value === ch.v ? '#fff' : '#555', borderRadius: 6,
        }}>{ch.icon} {ch.label}</button>
      ))}
    </div>
  );
}

// ── Asosiy komponent ──────────────────────────────────────────────────────────
export default function Kassir() {
  const data = useData();
  const {
    cashOpening, cashRows, addCashRow,
    bankOpening, bankRows, addBankRow,
    clickOpening, clickRows, addClickRow,
    payCustomerDebt, addAdvanceRow, addSaleRow,
    debtRows, salesRows, appSettings, currentWorker, setCurrentWorker, workers,
    addSkladSotuv, totalSkladKg,
  } = data;

  const [tab, setTab]   = useState('qarz');
  const [toast, setToast] = useState('');
  const showToast = useCallback((msg) => setToast(msg), []);

  // ── Sklad qoldiq (kg) ───────────────────────────────────────────────────────
  const skladKgBal = totalSkladKg;

  // ── Qoldiqlar ───────────────────────────────────────────────────────────────
  const cashBal  = Number(cashOpening?.amount  || 0) + cashRows.reduce((s,r)  => s + Number(r.amount  || 0), 0);
  const bankBal  = Number(bankOpening?.amount  || 0) + bankRows.reduce((s,r)  => s + Number(r.amount  || 0), 0);
  const clickBal = Number(clickOpening?.amount || 0) + clickRows.reduce((s,r) => s + Number(r.amount || 0), 0);

  // ── Bugungi jurnal ──────────────────────────────────────────────────────────
  const today = todayStr();
  const journalRows = [
    ...cashRows.map(r  => ({ ...r, channel: 'naqd'  })),
    ...bankRows.map(r  => ({ ...r, channel: 'bank'  })),
    ...clickRows.map(r => ({ ...r, channel: 'click' })),
  ].filter(r => r.date === today)
   .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const todayIn  = journalRows.filter(r => Number(r.amount) > 0).reduce((s,r) => s + Number(r.amount), 0);
  const todayOut = journalRows.filter(r => Number(r.amount) < 0).reduce((s,r) => s + Number(r.amount), 0);

  // ── Form holatlari ──────────────────────────────────────────────────────────
  const [qarz,    setQarz]   = useState({ customer: '', amount: '', channel: 'naqd', note: '' });
  const [avans,   setAvans]  = useState({ customer: '', amount: '', channel: 'naqd', note: '' });
  const [sotuv,   setSotuv]  = useState({ customer: '', tons: '', pricePerTon: '', channel: 'naqd', vehicleNo: '', note: '' });
  const [kirim,   setKirim]  = useState({ desc: '', amount: '', channel: 'naqd' });
  const [chiqim,  setChiqim] = useState({ cat: 'boshqa', desc: '', amount: '', channel: 'naqd' });
  const [otkazma, setOtkazma]= useState({ dir: 'bank_to_naqd', amount: '', note: '' });
  const [sklad,   setSklad]  = useState({ customer: '', kg: '', pricePerKg: '', channel: 'naqd', note: '' });

  // Mijoz qolgan qarzi (qarz tab uchun)
  const custRemaining = qarz.customer
    ? debtRows.filter(r => r.customer === qarz.customer).reduce((s,r) => s + Math.max(0, Number(r.amount)-Number(r.paid)), 0)
    : 0;

  const addRow = (channel, amount, desc) => {
    const fn = { naqd: addCashRow, bank: addBankRow, click: addClickRow }[channel];
    if (fn) fn(amount, desc, today);
  };

  // ── Submit handlers ─────────────────────────────────────────────────────────
  const submitQarz = (e) => {
    e.preventDefault();
    if (!qarz.customer || !qarz.amount) return;
    const res = payCustomerDebt(qarz.customer, qarz.amount, qarz.channel, qarz.note || 'Kassaga to\'lov');
    if (res.applied <= 0) { alert("Bu mijozda qoldiq qarz yo'q."); return; }
    let msg = `${fmt(res.applied)} so'm qabul qilindi`;
    if (res.leftover > 0) msg += `. ⚠ ${fmt(res.leftover)} so'm ortiqcha — avansga o'tkazing`;
    showToast(msg);
    setQarz({ customer: '', amount: '', channel: 'naqd', note: '' });
  };

  const submitAvans = (e) => {
    e.preventDefault();
    if (!avans.customer || !avans.amount) return;
    addAdvanceRow(avans.customer, avans.amount, avans.note || 'Avans', avans.channel);
    showToast(`${fmt(avans.amount)} so'm avans qabul qilindi`);
    setAvans({ customer: '', amount: '', channel: 'naqd', note: '' });
  };

  const submitSotuv = (e) => {
    e.preventDefault();
    if (!sotuv.customer || !sotuv.tons || !sotuv.pricePerTon) return;
    const created = addSaleRow({
      customer: sotuv.customer,
      tons: sotuv.tons,
      pricePerTon: sotuv.pricePerTon,
      paymentChannel: sotuv.channel,
      vehicleNo: sotuv.vehicleNo,
      note: sotuv.note,
      date: today,
    });
    showToast(`${fmtT(sotuv.tons)} tn sotildi — ${fmt(Number(sotuv.tons)*Number(sotuv.pricePerTon))} so'm`);
    if (created) {
      const s = customerSummary(created.customer, data);
      const extraDebt = created.paymentChannel === 'nasiya' ? Number(created.tons||0)*Number(created.pricePerTon||0) : 0;
      printSaleReceipt(created, {
        appName: appSettings?.appName || 'SEMENT',
        phone: appSettings?.companyPhone || '',
        address: appSettings?.companyAddress || '',
        qolganQarz: s.qolganQarz + extraDebt,
      });
    }
    setSotuv({ customer: '', tons: '', pricePerTon: '', channel: 'naqd', vehicleNo: '', note: '' });
  };

  const submitKirim = (e) => {
    e.preventDefault();
    if (!kirim.desc || !kirim.amount) return;
    addRow(kirim.channel, Number(kirim.amount), kirim.desc);
    showToast(`+${fmt(kirim.amount)} so'm kirim qilindi`);
    setKirim({ desc: '', amount: '', channel: 'naqd' });
  };

  const submitChiqim = (e) => {
    e.preventDefault();
    const label = EXPENSE_CATS.find(c => c.v === chiqim.cat)?.label || 'Chiqim';
    const fullDesc = chiqim.desc ? `${label}: ${chiqim.desc}` : label;
    if (!chiqim.amount) return;
    if (chiqim.cat === 'boshqa' && !chiqim.desc) { alert("Tavsif kiriting"); return; }
    addRow(chiqim.channel, -Number(chiqim.amount), fullDesc);
    showToast(`-${fmt(chiqim.amount)} so'm chiqim yozildi`);
    setChiqim({ cat: 'boshqa', desc: '', amount: '', channel: 'naqd' });
  };

  const submitSklad = (e) => {
    e.preventDefault();
    if (!sklad.customer || !sklad.kg || !sklad.pricePerKg) return;
    if (skladKgBal < Number(sklad.kg)) { alert(`Sklad qoldig'i yetarli emas. Qoldiq: ${skladKgBal} kg`); return; }
    addSkladSotuv({ customer: sklad.customer, kg: sklad.kg, pricePerKg: sklad.pricePerKg, channel: sklad.channel, note: sklad.note });
    showToast(`${sklad.kg} kg sotildi — ${fmt(Number(sklad.kg)*Number(sklad.pricePerKg))} so'm`);
    setSklad({ customer: '', kg: '', pricePerKg: '', channel: 'naqd', note: '' });
  };

  const submitOtkazma = (e) => {
    e.preventDefault();
    if (!otkazma.amount) return;
    const opt = TRANSFER_OPTS.find(o => o.v === otkazma.dir);
    if (!opt) return;
    const amt = Number(otkazma.amount);
    const tag = `↔️ ${opt.label}`;
    addRow(opt.from, -amt, tag);
    addRow(opt.to,   +amt, tag);
    showToast(`${fmt(amt)} so'm o'tkazildi (${opt.label})`);
    setOtkazma({ dir: 'bank_to_naqd', amount: '', note: '' });
  };

  const TABS = [
    { v: 'qarz',    label: '💰 Qarz olish',   color: '#2e7d32', bg: '#e8f5e9' },
    { v: 'avans',   label: '🔄 Avans olish',  color: '#1565c0', bg: '#e3f2fd' },
    { v: 'sotuv',   label: '📦 Tovar sotish', color: '#e65100', bg: '#fff3e0' },
    { v: 'kirim',   label: '➕ Kirim',         color: '#00695c', bg: '#e0f2f1' },
    { v: 'chiqim',  label: '➖ Chiqim',        color: '#c62828', bg: '#ffebee' },
    { v: 'otkazma', label: '↔️ O\'tkazma',    color: '#6a1b9a', bg: '#f3e5f5' },
    { v: 'sklad',   label: '🏗 Sklad (kg)',   color: '#4e342e', bg: '#efebe9' },
  ];
  const activeTab = TABS.find(t => t.v === tab);

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>
      <Toast msg={toast} onHide={() => setToast('')} />

      {/* ── KASSA QOLDIG'I ── */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14,
        position: 'sticky', top: 0, zIndex: 100,
        background: '#fff', paddingBottom: 10, borderBottom: '2px solid #eee',
      }}>
        {[
          { label: '💵 Naqd', val: cashBal,  color: '#1565c0', bg: '#e3f2fd' },
          { label: '🏦 Bank', val: bankBal,  color: '#2e7d32', bg: '#e8f5e9' },
          { label: '📱 Click', val: clickBal,   color: '#6a1b9a', bg: '#f3e5f5' },
          { label: '🏗 Sklad', val: skladKgBal, color: '#4e342e', bg: '#efebe9', unit: 'kg' },
        ].map(c => (
          <div key={c.label} style={{ flex: 1, minWidth: 150, padding: '10px 16px', background: c.bg, borderLeft: `5px solid ${c.color}`, borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: '#666', fontWeight: 'bold' }}>{c.label} qoldig'i</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: c.val < 0 ? '#c62828' : c.color, fontFamily: 'monospace', marginTop: 2 }}>
              {fmt(c.val)} {c.unit || 'so\'m'}
            </div>
          </div>
        ))}
        {/* Xodim tanlash */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 140 }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Kassir:</div>
          <select value={currentWorker} onChange={e => setCurrentWorker(e.target.value)}
            style={{ padding: '6px 8px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4, fontWeight: 'bold', color: '#003366' }}>
            <option value="">— tanlang —</option>
            {(workers || []).map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── 6 TUGMA PANELI ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {TABS.map(t => (
          <button key={t.v} onClick={() => setTab(t.v)} style={{
            flex: '1 1 130px', padding: '14px 8px', cursor: 'pointer',
            fontSize: 14, fontWeight: 'bold', borderRadius: 8,
            border: `3px solid ${tab === t.v ? t.color : '#ddd'}`,
            background: tab === t.v ? t.color : '#f9f9f9',
            color: tab === t.v ? '#fff' : '#444',
            boxShadow: tab === t.v ? `0 4px 12px ${t.color}55` : 'none',
            transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── AKTIV FORMA ── */}
      <div style={{ background: activeTab.bg, border: `2px solid ${activeTab.color}44`, borderRadius: 8, padding: '16px 18px', marginBottom: 16 }}>

        {/* ─ QARZ OLISH ─ */}
        {tab === 'qarz' && (
          <form onSubmit={submitQarz}>
            <Row>
              <Field label="Mijoz *">
                <CustomerSelect value={qarz.customer} onChange={v => setQarz({...qarz, customer: v})} placeholder="Mijoz (izlash...)" accentColor="#2e7d32" />
              </Field>
              {qarz.customer && (
                <Field label="Qoldiq qarz">
                  <div style={{ padding: '6px 10px', background: '#fff', border: '1px solid #ccc', borderRadius: 4, color: custRemaining > 0 ? '#c62828' : '#2e7d32', fontWeight: 'bold', fontSize: 14 }}>
                    {fmt(custRemaining)} so'm
                  </div>
                </Field>
              )}
            </Row>
            <Row>
              <Field label="Summa *">
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="number" value={qarz.amount} onChange={e => setQarz({...qarz, amount: e.target.value})}
                    placeholder="0" style={inp} required />
                  {custRemaining > 0 && (
                    <button type="button" onClick={() => setQarz({...qarz, amount: String(custRemaining)})}
                      style={{ ...smallBtn('#2e7d32') }}>To'liq ({fmt(custRemaining)})</button>
                  )}
                </div>
              </Field>
              <Field label="Izoh">
                <input value={qarz.note} onChange={e => setQarz({...qarz, note: e.target.value})} placeholder="Ixtiyoriy" style={inp} />
              </Field>
            </Row>
            <Field label="To'lov kanali"><ChannelBtns value={qarz.channel} onChange={v => setQarz({...qarz, channel: v})} /></Field>
            <SubmitBtn color="#2e7d32" label="✓ Qabul qilish" />
          </form>
        )}

        {/* ─ AVANS OLISH ─ */}
        {tab === 'avans' && (
          <form onSubmit={submitAvans}>
            <Row>
              <Field label="Mijoz *">
                <CustomerSelect value={avans.customer} onChange={v => setAvans({...avans, customer: v})} placeholder="Mijoz (izlash...)" accentColor="#1565c0" />
              </Field>
              <Field label="Summa *">
                <input type="number" value={avans.amount} onChange={e => setAvans({...avans, amount: e.target.value})} placeholder="0" style={inp} required />
              </Field>
              <Field label="Izoh">
                <input value={avans.note} onChange={e => setAvans({...avans, note: e.target.value})} placeholder="Ixtiyoriy" style={inp} />
              </Field>
            </Row>
            <Field label="To'lov kanali"><ChannelBtns value={avans.channel} onChange={v => setAvans({...avans, channel: v})} /></Field>
            <SubmitBtn color="#1565c0" label="✓ Avans qabul qilish" />
          </form>
        )}

        {/* ─ TOVAR SOTISH ─ */}
        {tab === 'sotuv' && (
          <form onSubmit={submitSotuv}>
            <Row>
              <Field label="Mijoz *">
                <CustomerSelect value={sotuv.customer} onChange={v => setSotuv({...sotuv, customer: v})} placeholder="Mijoz (izlash...)" accentColor="#e65100" />
              </Field>
              <Field label="Tonna *">
                <input type="number" step="0.001" value={sotuv.tons} onChange={e => setSotuv({...sotuv, tons: e.target.value})} placeholder="0.000" style={inp} required />
              </Field>
              <Field label="Narx (1 tn) *">
                <input type="number" value={sotuv.pricePerTon} onChange={e => setSotuv({...sotuv, pricePerTon: e.target.value})} placeholder="0" style={inp} required />
              </Field>
            </Row>
            {sotuv.tons && sotuv.pricePerTon && (
              <div style={{ marginBottom: 10, padding: '8px 14px', background: '#fff', borderRadius: 6, border: '1px solid #ffcc80', fontSize: 14 }}>
                💰 Jami: <b style={{ color: '#e65100', fontSize: 16 }}>{fmt(Number(sotuv.tons) * Number(sotuv.pricePerTon))} so'm</b>
              </div>
            )}
            <Row>
              <Field label="Mashina №">
                <input value={sotuv.vehicleNo} onChange={e => setSotuv({...sotuv, vehicleNo: e.target.value})} placeholder="30156UPA" style={inp} />
              </Field>
              <Field label="Izoh">
                <input value={sotuv.note} onChange={e => setSotuv({...sotuv, note: e.target.value})} placeholder="Ixtiyoriy" style={inp} />
              </Field>
            </Row>
            <Field label="To'lov turi">
              <ChannelBtns value={sotuv.channel} onChange={v => setSotuv({...sotuv, channel: v})}
                extra={[{ v: 'nasiya', icon: '⚠️', label: 'Nasiya (Qarz)', color: '#c62828' }]} />
            </Field>
            <SubmitBtn color="#e65100" label="✓ Sotish" />
          </form>
        )}

        {/* ─ KIRIM ─ */}
        {tab === 'kirim' && (
          <form onSubmit={submitKirim}>
            <Row>
              <Field label="Tavsif *">
                <input value={kirim.desc} onChange={e => setKirim({...kirim, desc: e.target.value})} placeholder="Nima uchun kirim?" style={{ ...inp, width: 260 }} required />
              </Field>
              <Field label="Summa *">
                <input type="number" value={kirim.amount} onChange={e => setKirim({...kirim, amount: e.target.value})} placeholder="0" style={inp} required />
              </Field>
            </Row>
            <Field label="Kanal"><ChannelBtns value={kirim.channel} onChange={v => setKirim({...kirim, channel: v})} /></Field>
            <SubmitBtn color="#00695c" label="✓ Kirim qilish" />
          </form>
        )}

        {/* ─ CHIQIM ─ */}
        {tab === 'chiqim' && (
          <form onSubmit={submitChiqim}>
            <Field label="Kategoriya">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                {EXPENSE_CATS.map(c => (
                  <button key={c.v} type="button" onClick={() => setChiqim({...chiqim, cat: c.v})} style={{
                    padding: '7px 14px', cursor: 'pointer', borderRadius: 6, fontWeight: 'bold', fontSize: 12,
                    border: `2px solid ${chiqim.cat === c.v ? '#c62828' : '#ddd'}`,
                    background: chiqim.cat === c.v ? '#c62828' : '#f9f9f9',
                    color: chiqim.cat === c.v ? '#fff' : '#444',
                  }}>{c.label}</button>
                ))}
              </div>
            </Field>
            <Row>
              <Field label={chiqim.cat === 'boshqa' ? 'Tavsif *' : 'Tavsif (ixtiyoriy)'}>
                <input value={chiqim.desc} onChange={e => setChiqim({...chiqim, desc: e.target.value})}
                  placeholder="Batafsil izoh..." style={{ ...inp, width: 240 }}
                  required={chiqim.cat === 'boshqa'} />
              </Field>
              <Field label="Summa *">
                <input type="number" value={chiqim.amount} onChange={e => setChiqim({...chiqim, amount: e.target.value})} placeholder="0" style={inp} required />
              </Field>
            </Row>
            <Field label="Kanal"><ChannelBtns value={chiqim.channel} onChange={v => setChiqim({...chiqim, channel: v})} /></Field>
            <SubmitBtn color="#c62828" label="✓ Chiqim yozish" />
          </form>
        )}

        {/* ─ O'TKAZMA ─ */}
        {tab === 'otkazma' && (
          <form onSubmit={submitOtkazma}>
            <Field label="Yo'nalish">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                {TRANSFER_OPTS.map(o => (
                  <button key={o.v} type="button" onClick={() => setOtkazma({...otkazma, dir: o.v})} style={{
                    padding: '7px 14px', cursor: 'pointer', borderRadius: 6, fontWeight: 'bold', fontSize: 12,
                    border: `2px solid ${otkazma.dir === o.v ? '#6a1b9a' : '#ddd'}`,
                    background: otkazma.dir === o.v ? '#6a1b9a' : '#f9f9f9',
                    color: otkazma.dir === o.v ? '#fff' : '#444',
                  }}>{o.label}</button>
                ))}
              </div>
            </Field>
            <Row>
              <Field label="Summa *">
                <input type="number" value={otkazma.amount} onChange={e => setOtkazma({...otkazma, amount: e.target.value})} placeholder="0" style={inp} required />
              </Field>
              <Field label="Izoh">
                <input value={otkazma.note} onChange={e => setOtkazma({...otkazma, note: e.target.value})} placeholder="Ixtiyoriy" style={inp} />
              </Field>
            </Row>
            {otkazma.amount && (
              <div style={{ marginBottom: 10, padding: '8px 14px', background: '#fff', borderRadius: 6, border: '1px solid #ce93d8', fontSize: 13 }}>
                {TRANSFER_OPTS.find(o=>o.v===otkazma.dir)?.label} — <b>{fmt(otkazma.amount)} so'm</b>
              </div>
            )}
            <SubmitBtn color="#6a1b9a" label="✓ O'tkazma" />
          </form>
        )}

        {/* ─ SKLAD SOTUV (kg) ─ */}
        {tab === 'sklad' && (
          <form onSubmit={submitSklad}>
            <div style={{ marginBottom: 10, padding: '8px 14px', background: '#fff', borderRadius: 6, border: '1px solid #bcaaa4', fontSize: 13 }}>
              🏗 Sklad qoldig'i: <b style={{ color: skladKgBal < 0 ? '#c62828' : '#4e342e', fontFamily: 'monospace', fontSize: 16 }}>{fmt(skladKgBal)} kg</b>
              <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>({(skladKgBal/1000).toFixed(3)} tn)</span>
            </div>
            <Row>
              <Field label="Mijoz *">
                <CustomerSelect value={sklad.customer} onChange={v => setSklad({...sklad, customer: v})} placeholder="Mijoz (izlash...)" accentColor="#4e342e" />
              </Field>
              <Field label="Kilogram *">
                <input type="number" step="0.01" value={sklad.kg} onChange={e => setSklad({...sklad, kg: e.target.value})}
                  placeholder="0" style={inp} required />
              </Field>
              <Field label="Narx (1 kg) *">
                <input type="number" value={sklad.pricePerKg} onChange={e => setSklad({...sklad, pricePerKg: e.target.value})}
                  placeholder="0" style={inp} required />
              </Field>
            </Row>
            {sklad.kg && sklad.pricePerKg && (
              <div style={{ marginBottom: 10, padding: '8px 14px', background: '#fff', borderRadius: 6, border: '1px solid #bcaaa4', fontSize: 14 }}>
                💰 Jami: <b style={{ color: '#4e342e', fontSize: 16 }}>{fmt(Number(sklad.kg)*Number(sklad.pricePerKg))} so'm</b>
                <span style={{ fontSize: 11, color: '#888', marginLeft: 12 }}>Qoldiq: {fmt(skladKgBal - Number(sklad.kg||0))} kg</span>
              </div>
            )}
            <Row>
              <Field label="Izoh">
                <input value={sklad.note} onChange={e => setSklad({...sklad, note: e.target.value})} placeholder="Ixtiyoriy" style={inp} />
              </Field>
            </Row>
            <Field label="To'lov turi">
              <ChannelBtns value={sklad.channel} onChange={v => setSklad({...sklad, channel: v})}
                extra={[{ v: 'nasiya', icon: '⚠️', label: 'Nasiya (Qarz)', color: '#c62828' }]} />
            </Field>
            <SubmitBtn color="#4e342e" label="✓ Sklad sotuv" />
          </form>
        )}
      </div>

      {/* ── BUGUNGI JURNAL ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <span style={{ fontWeight: 'bold', fontSize: 14, color: '#003366' }}>📋 Bugungi operatsiyalar ({journalRows.length} ta)</span>
          <span style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: 12 }}>+{fmt(todayIn)}</span>
          <span style={{ color: '#c62828', fontWeight: 'bold', fontSize: 12 }}>{fmt(todayOut)}</span>
          <span style={{ color: '#555', fontSize: 12 }}>= {fmt(todayIn + todayOut)} so'm sof</span>
        </div>

        {journalRows.length === 0 ? (
          <p style={{ color: '#aaa', fontStyle: 'italic' }}>Bugun hali operatsiya yo'q.</p>
        ) : (
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 50 }}>Vaqt</th>
                <th>Operatsiya</th>
                <th>Tavsif / Mijoz</th>
                <th style={{ textAlign: 'right', width: 130 }}>Summa</th>
                <th style={{ width: 70 }}>Kanal</th>
                <th style={{ width: 80 }}>Xodim</th>
              </tr>
            </thead>
            <tbody>
              {journalRows.map((r, i) => {
                const amt = Number(r.amount || 0);
                const opLabel = SOURCE_LABELS[r.sourceType] || (amt > 0 ? '➕ Kirim' : '➖ Chiqim');
                const ch = CHANNELS.find(c => c.v === r.channel);
                return (
                  <tr key={r.id || i} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                    <td style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{timeStr(r.createdAt)}</td>
                    <td style={{ fontWeight: 'bold', color: '#003366', fontSize: 12 }}>{opLabel}</td>
                    <td style={{ fontSize: 12, color: '#555', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.desc || r.note || '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: amt >= 0 ? '#2e7d32' : '#c62828', fontSize: 14 }}>
                      {amt >= 0 ? '+' : ''}{fmt(amt)}
                    </td>
                    <td style={{ fontSize: 11, color: ch?.color || '#555' }}>{ch?.icon} {ch?.label || r.channel}</td>
                    <td style={{ fontSize: 11, color: '#888' }}>
                      {r.worker || '—'}
                      {r.sourceType === 'sale' && (() => {
                        const sale = (salesRows || []).find(s => s.id === r.sourceId);
                        if (!sale) return null;
                        return (
                          <button type="button" onClick={() => {
                            const s = customerSummary(sale.customer, data);
                            printSaleReceipt(sale, {
                              appName: appSettings?.appName || 'SEMENT',
                              phone: appSettings?.companyPhone || '',
                              address: appSettings?.companyAddress || '',
                              qolganQarz: s.qolganQarz,
                            });
                          }} style={{ marginLeft: 4, padding: '2px 6px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 11 }}>
                            🧾
                          </button>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background: '#fffde7', fontWeight: 'bold', borderTop: '2px solid #fbc02d' }}>
                <td colSpan={3} style={{ textAlign: 'right', padding: '6px 8px' }}>BUGUNGI JAMI:</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', color: (todayIn+todayOut) >= 0 ? '#2e7d32' : '#c62828', fontSize: 14 }}>
                  {(todayIn+todayOut) >= 0 ? '+' : ''}{fmt(todayIn + todayOut)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Yordamchi komponentlar ───────────────────────────────────────────────────
function Row({ children }) {
  return <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10, alignItems: 'flex-end' }}>{children}</div>;
}
function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, color: '#555', fontWeight: 'bold' }}>{label}</label>
      {children}
    </div>
  );
}
function SubmitBtn({ color, label }) {
  return (
    <div style={{ marginTop: 12 }}>
      <button type="submit" style={{
        padding: '10px 32px', background: color, color: '#fff',
        border: 'none', borderRadius: 6, cursor: 'pointer',
        fontWeight: 'bold', fontSize: 15, fontFamily: 'Tahoma, sans-serif',
      }}>{label}</button>
    </div>
  );
}
const smallBtn = (color) => ({
  padding: '5px 10px', background: color, color: '#fff', border: 'none',
  borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', fontSize: 11, whiteSpace: 'nowrap',
});
const inp = { padding: '7px 10px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4, width: 160, fontFamily: 'Tahoma, sans-serif' };
