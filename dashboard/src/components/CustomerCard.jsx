// ─────────────────────────────────────────────────────────────────────────────
// Mijoz kartochkasi (Customer 360) — bitta mijozning HAMMASI bir ekranda:
// qoldiq qarz, qoldiq avans, jami xarid (tonna/summa), sotuvlar, qarz to'lovlari,
// telegram zakazlari. Modal oyna ko'rinishida.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { customerSummary } from '../lib/customerSummary';
import { activityStatus } from '../lib/monitoring';
import { exportAktSverka } from '../lib/excelExport';
import NotifyModal from './NotifyModal';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };

export default function CustomerCard({ name, onClose }) {
  const data = useData();
  const { customers, appSettings, setMonitor, tgChatIdFor, tgLocationFor, updateCustomer } = data;
  const cust = customers.find(c => c.name === name);
  const s = customerSummary(name, data);
  const act = cust?.monitored ? activityStatus(s, cust, Number(appSettings?.monitorDays) || 14) : null;
  const tgLinked   = !!(cust?.telegramChatId) || (cust?.phone ? !!tgChatIdFor(cust.phone) : false);
  const botName    = 'sementchiuzbot';
  const deepLink   = cust?.linkCode ? `https://t.me/${botName}?start=${cust.linkCode}` : null;
  // Effektiv joylashuv: qo'lda belgilangan ustun, bo'lmasa botdan
  const loc = (cust?.lat != null && cust?.lon != null)
    ? { lat: cust.lat, lon: cust.lon }
    : (cust?.phone ? tgLocationFor(cust.phone) : null);

  const setMyLocation = () => {
    if (!cust) return;
    if (!navigator.geolocation) { alert("Brauzer joylashuvni qo'llab-quvvatlamaydi."); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { updateCustomer(cust.id, { lat: pos.coords.latitude, lon: pos.coords.longitude }); alert("📍 Joylashuv saqlandi (shu qurilma)."); },
      () => alert("Joylashuvni olishning iloji bo'lmadi. Ruxsat bering yoki GPS yoqing."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const [notify,  setNotify]  = useState(false);
  const [showAkt, setShowAkt] = useState(false);
  const aktRef = useRef();
  const defaultMsg = s.qolganQarz > 0
    ? `Hurmatli ${name}! Sizning qoldiq qarzingiz: ${fmt(s.qolganQarz)} so'm. To'lov uchun rahmat.`
    : `Hurmatli ${name}!`;

  const box = (label, value, color, bg) => (
    <div style={{ flex: 1, minWidth: 150, padding: '10px 14px', background: bg, borderLeft: `4px solid ${color}`, borderRadius: 4 }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 'bold', color, fontFamily: 'monospace' }}>{value}</div>
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 16px', overflowY: 'auto' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 760, boxShadow: '0 8px 30px rgba(0,0,0,0.3)', fontFamily: 'Tahoma, Arial, sans-serif' }}
      >
        {/* ── Sarlavha (ixcham) ── */}
        <div style={{ background: '#003366', color: '#fff', padding: '10px 14px', borderRadius: '8px 8px 0 0' }}>
          {/* 1-qator: Ism + badge + tugmalar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16, fontWeight: 'bold' }}>👤 {name}</span>
            {cust && (
              <button onClick={() => setMonitor(cust.id, !cust.monitored)}
                style={{ cursor: 'pointer', background: cust.monitored ? '#ef6c00' : 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11 }}>
                🔔 {cust.monitored ? 'Nazoratda' : 'Nazoratga'}
              </button>
            )}
            {tgLinked
              ? <span style={{ background: '#2e7d32', padding: '1px 7px', borderRadius: 8, fontSize: 10 }}>📱 Telegram ulangan</span>
              : deepLink && <span style={{ background: 'rgba(255,136,0,0.85)', padding: '1px 7px', borderRadius: 8, fontSize: 10 }}>⚠️ Ulanmagan</span>
            }
            {/* Tugmalar — o'ngga surish */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowAkt(true)}
                title="Akt Sverka — ko'rish va yuklab olish"
                style={{ background: '#1d6f42', border: 'none', color: '#fff', fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                📊 Akt Sverka
              </button>
              {cust?.phone && (
                <button onClick={() => setNotify(true)}
                  style={{ background: '#2e7d32', border: 'none', color: '#fff', fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>
                  ✉️ Xabar
                </button>
              )}
              <button onClick={onClose}
                style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', fontSize: 18, width: 28, height: 28, borderRadius: 14, cursor: 'pointer', lineHeight: 1 }}>
                ✕
              </button>
            </div>
          </div>
          {/* 2-qator: Kontakt + joylashuv */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap', fontSize: 12, opacity: 0.9 }}>
            {cust?.phone && <span>📞 {cust.phone}</span>}
            {cust?.address && <span>• 📍 {cust.address}</span>}
            {loc
              ? <a href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lon}`} target="_blank" rel="noreferrer"
                  style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', padding: '2px 8px', borderRadius: 8, textDecoration: 'none', fontSize: 11 }}>
                  🗺 Xaritada
                </a>
              : <span style={{ opacity: 0.7 }}>📍 Joylashuv yo'q</span>
            }
            {cust && (
              <button onClick={setMyLocation}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 8, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>
                {loc ? '🔄 Yangilash' : '➕ Belgilash'}
              </button>
            )}
          </div>
        </div>

        {notify && <NotifyModal name={name} phone={cust?.phone || ''} defaultText={defaultMsg} onClose={() => setNotify(false)} />}
        {showAkt && (
          <AktSverkaModal
            name={name} s={s} aktRef={aktRef}
            onClose={() => setShowAkt(false)}
            onExcel={() => exportAktSverka(name, { sales: s.sales, debts: s.debts, summary: s })}
          />
        )}

        {/* Telegram havola — ulashish (faqat ulanmagan bo'lsa) */}
        {!tgLinked && deepLink && (
          <div style={{ background:'#e3f2fd', borderBottom:'1px solid #90caf9', padding:'10px 18px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <span style={{ fontSize:13, color:'#0d47a1', fontWeight:'bold' }}>📲 Mijozni botga ulash:</span>
            <code style={{ fontSize:12, background:'#fff', padding:'3px 8px', borderRadius:4, border:'1px solid #90caf9', color:'#333', userSelect:'all' }}>
              {deepLink}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(deepLink); alert('✅ Havola nusxalandi!'); }}
              style={{ padding:'5px 14px', background:'#1565c0', color:'#fff', border:'none', borderRadius:4, cursor:'pointer', fontWeight:'bold', fontSize:12 }}>
              📋 Nusxa olish
            </button>
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent('Sement do\'koni botidan xaridlaringizni kuzatish uchun havola:')}`}
              target="_blank" rel="noreferrer"
              style={{ padding:'5px 14px', background:'#0088cc', color:'#fff', borderRadius:4, textDecoration:'none', fontWeight:'bold', fontSize:12 }}>
              ✈️ Telegram orqali yuborish
            </a>
          </div>
        )}

        {/* Nazorat holati (faqat nazoratdagi mijoz uchun) */}
        {act && (
          <div style={{ background: act.status.bg, color: act.status.color, padding: '7px 18px', fontSize: 13, fontWeight: 'bold', borderBottom: `1px solid ${act.status.color}` }}>
            {act.status.icon} {act.status.label}
            {act.daysSince !== null
              ? ` — oxirgi xaridi ${act.daysSince} kun oldin (nazorat muddati: ${act.threshold} kun)`
              : ' — hali xarid qilmagan'}
          </div>
        )}

        <div style={{ padding: 18 }}>
          {/* Asosiy raqamlar */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
            {box("Qoldiq qarz (bizga)", fmt(s.qolganQarz) + " so'm", '#c62828', '#ffebee')}
            {box("Qoldiq avans",        fmt(s.qolganAvans) + " so'm", '#1565c0', '#e3f2fd')}
            {box("Jami xarid",          fmt(s.totalXarid) + " so'm", '#2e7d32', '#e8f5e9')}
            {box("Jami tonna",          fmtT(s.totalTon) + " tn",    '#5d4037', '#efebe9')}
          </div>

          {/* Sotuvlar */}
          <Section title={`Xaridlar / Sotuvlar (${s.sales.length})`}>
            {s.sales.length === 0 ? <Empty /> : (
              <table className="data-table" style={{ width: '100%' }}>
                <thead><tr><th>Sana</th><th style={{ textAlign: 'right' }}>Tonna</th><th style={{ textAlign: 'right' }}>Narx/tn</th><th style={{ textAlign: 'right' }}>Summa</th><th>Izoh</th></tr></thead>
                <tbody>
                  {[...s.sales].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(r => (
                    <tr key={r.id}>
                      <td style={{ fontSize: 12 }}>{r.date}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtT(r.tons)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.pricePerTon)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{fmt(Number(r.tons || 0) * Number(r.pricePerTon || 0))}</td>
                      <td style={{ fontSize: 12, color: '#555' }}>{r.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Qarzlar */}
          <Section title={`Qarzlar (${s.debts.length})`}>
            {s.debts.length === 0 ? <Empty /> : (
              <table className="data-table" style={{ width: '100%' }}>
                <thead><tr><th>Sana</th><th style={{ textAlign: 'right' }}>Qarz</th><th style={{ textAlign: 'right' }}>To'landi</th><th style={{ textAlign: 'right' }}>Qoldiq</th><th>Izoh</th></tr></thead>
                <tbody>
                  {[...s.debts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(r => {
                    const qoldiq = Math.max(0, Number(r.amount || 0) - Number(r.paid || 0));
                    return (
                      <tr key={r.id}>
                        <td style={{ fontSize: 12 }}>{r.date}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.amount)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#2e7d32' }}>{fmt(r.paid)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: qoldiq > 0 ? '#c62828' : '#888' }}>{fmt(qoldiq)}</td>
                        <td style={{ fontSize: 12, color: '#555' }}>{r.note || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Section>

          {/* Avanslar */}
          <Section title={`Avanslar (${s.advs.length})`}>
            {s.advs.length === 0 ? <Empty /> : (
              <table className="data-table" style={{ width: '100%' }}>
                <thead><tr><th>Sana</th><th style={{ textAlign: 'right' }}>Avans</th><th style={{ textAlign: 'right' }}>Ishlatildi</th><th style={{ textAlign: 'right' }}>Qoldiq</th><th>Izoh</th></tr></thead>
                <tbody>
                  {[...s.advs].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(r => {
                    const qoldiq = Math.max(0, Number(r.amount || 0) - Number(r.used || 0));
                    return (
                      <tr key={r.id}>
                        <td style={{ fontSize: 12 }}>{r.date}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.amount)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#ef6c00' }}>{fmt(r.used)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#1565c0' }}>{fmt(qoldiq)}</td>
                        <td style={{ fontSize: 12, color: '#555' }}>{r.note || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Section>

          {/* Bog'lanmagan pul harakatlari — sotuv/qarz/avansga ULANMAGAN, lekin
              shu mijozga biriktirilgan kassa yozuvlari. Aynan shu pullar
              "qayerdan kelgani noaniq" bo'lib ko'rinardi. */}
          {s.unlinked && s.unlinked.length > 0 && (
            <Section title={`⚠️ Bog'lanmagan pul harakatlari (${s.unlinked.length})`}>
              <div style={{ fontSize: 11, color: '#e65100', background: '#fff3e0', padding: '6px 10px', borderRadius: 4, marginBottom: 8, lineHeight: 1.5 }}>
                Bu yozuvlar mijozga biriktirilgan, lekin hech qanday sotuv, qarz yoki
                avansga ulanmagan (masalan Bank kirim yoki tahrirda qo'lda biriktirilgan).
                Jami: kirim <b>{fmt(s.unlinkedIn)}</b> · chiqim <b>{fmt(s.unlinkedOut)}</b> so'm.
              </div>
              <table className="data-table" style={{ width: '100%' }}>
                <thead><tr><th>Sana</th><th>Kanal</th><th>Izoh</th><th style={{ textAlign: 'right' }}>Summa</th></tr></thead>
                <tbody>
                  {[...s.unlinked].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(r => {
                    const chLbl = { naqd: '💵 Naqd', bank: '🏦 Bank', click: '📱 Click' }[r._ch] || r._ch;
                    const pos = Number(r.amount) > 0;
                    return (
                      <tr key={r._ch + '_' + r.id}>
                        <td style={{ fontSize: 12 }}>{r.date}</td>
                        <td style={{ fontSize: 12 }}>{chLbl}</td>
                        <td style={{ fontSize: 12, color: '#555' }}>{typeof r.desc === 'object' ? r.desc.latn : (r.desc || '—')}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: pos ? '#2e7d32' : '#c62828' }}>
                          {pos ? '+' : '-'}{fmt(Math.abs(Number(r.amount)))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Section>
          )}

          {/* Telegram zakazlari */}
          {s.orders.length > 0 && (
            <Section title={`Telegram zakazlari (${s.orders.length})`}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead><tr><th>Sana</th><th style={{ textAlign: 'right' }}>Tonna</th><th>Holati</th><th>Izoh</th></tr></thead>
                <tbody>
                  {[...s.orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(o => (
                    <tr key={o.id}>
                      <td style={{ fontSize: 12 }}>{o.date}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtT(o.tons)}</td>
                      <td style={{ fontSize: 12 }}>{o.status}</td>
                      <td style={{ fontSize: 12, color: '#555' }}>{o.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Akt Sverka modali ────────────────────────────────────────────────────────
function AktSverkaModal({ name, s, aktRef, onClose, onExcel }) {
  const today = new Date().toLocaleDateString('ru-RU');
  const salesSorted  = [...s.sales].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const totalSaleTon = salesSorted.reduce((acc, r) => acc + Number(r.tons || 0), 0);
  const totalSaleSum = salesSorted.reduce((acc, r) => acc + Number(r.tons || 0) * Number(r.pricePerTon || 0), 0);
  const totalLeft    = s.debts.reduce((acc, r) => acc + Math.max(0, Number(r.amount || 0) - Number(r.paid || 0)), 0);

  // Barcha to'lovlar (debt.payments[]) — mijoz haqiqatda bergan pullar
  const allPayments = s.debts
    .flatMap(d => (d.payments || []).map(p => ({ ...p, debtNote: d.note })))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const totalPayments = allPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Akt Sverka - ${name}</title>
      <style>
        body { font-family: Times New Roman, serif; margin: 30px; color: #000; font-size: 12px; }
        h2 { text-align: center; text-transform: uppercase; margin-bottom: 4px; }
        .sub { text-align: center; font-size: 12px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0; }
        th, td { border: 1px solid #000; padding: 4px 6px; font-size: 11px; }
        th { background: #f0f0f0; font-weight: bold; }
        .total-row { background: #ffff00; font-weight: bold; }
        .sign { display: flex; justify-content: space-between; margin-top: 50px; }
        @media print { button { display: none; } }
      </style></head><body>${aktRef.current.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '2px solid #003366', width: '95%', maxWidth: 900, marginTop: 10, boxShadow: '4px 4px 20px rgba(0,0,0,0.4)' }}>
        {/* Header */}
        <div style={{ background: '#003366', color: '#fff', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b style={{ fontSize: 14 }}>📋 Akt Sverka: {name}</b>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handlePrint} style={aktBtn('#006600')}>🖨 Chop etish</button>
            <button onClick={onExcel}    style={aktBtn('#1d6f42')}>📥 Excel yuklab olish</button>
            <button onClick={onClose}   style={aktBtn('#c62828')}>✕ Yopish</button>
          </div>
        </div>

        {/* Chop etiladigan qism */}
        <div ref={aktRef} style={{ padding: '20px 24px', fontFamily: 'Times New Roman, serif' }}>
          <h2 style={{ textAlign: 'center', textTransform: 'uppercase', marginBottom: 4 }}>Akt-Sverka</h2>
          <div style={{ textAlign: 'center', fontSize: 12, marginBottom: 4 }}>Tashkilot: <b>SEMENT KORXONA</b></div>
          <div style={{ textAlign: 'center', fontSize: 12, marginBottom: 16 }}>
            Mijoz: <b>{name}</b> &nbsp;|&nbsp; Tuzilgan: <b>{today}</b>
          </div>

          {/* Umumiy raqamlar */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, border: '1px solid #000' }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th style={aTh}>Jami xarid (so'm)</th>
                <th style={aTh}>Jami tonna</th>
                <th style={{ ...aTh, color: '#006600' }}>Jami to'landi</th>
                <th style={{ ...aTh, color: '#c00' }}>Qoldiq qarz</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...aTd, fontWeight: 'bold' }}>{fmt(totalSaleSum)}</td>
                <td style={aTd}>{fmtT(totalSaleTon)} tn</td>
                <td style={{ ...aTd, color: '#006600', fontWeight: 'bold' }}>{fmt(totalPayments)}</td>
                <td style={{ ...aTd, fontWeight: 'bold', color: '#c00' }}>{fmt(totalLeft)}</td>
              </tr>
            </tbody>
          </table>

          {/* Xaridlar jadvali */}
          <div style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 4, borderBottom: '1px solid #000', paddingBottom: 2 }}>Xaridlar / Sotuvlar ({salesSorted.length} ta)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th style={aTh}>#</th>
                <th style={aTh}>Vaqt (zavod)</th>
                <th style={{ ...aTh, textAlign: 'right' }}>Tonna</th>
                <th style={{ ...aTh, textAlign: 'right' }}>Narx (1 tn)</th>
                <th style={{ ...aTh, textAlign: 'right' }}>Jami summa</th>
                <th style={aTh}>To'lov turi</th>
                <th style={aTh}>Mashina №</th>
              </tr>
            </thead>
            <tbody>
              {salesSorted.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 === 0 ? '#f9f9f9' : '#fff' }}>
                  <td style={{ ...aTd, textAlign: 'center', color: '#888' }}>{i + 1}</td>
                  <td style={{ ...aTd, fontSize: 10 }}>{r.factoryTime || r.date}</td>
                  <td style={{ ...aTd, textAlign: 'right' }}>{fmtT(r.tons)}</td>
                  <td style={{ ...aTd, textAlign: 'right' }}>{fmt(r.pricePerTon)}</td>
                  <td style={{ ...aTd, textAlign: 'right', fontWeight: 'bold' }}>{fmt(Number(r.tons || 0) * Number(r.pricePerTon || 0))}</td>
                  <td style={aTd}>{r.paymentChannel || '—'}</td>
                  <td style={aTd}>{r.vehicleNo || '—'}</td>
                </tr>
              ))}
              <tr style={{ background: '#ffff00', fontWeight: 'bold' }}>
                <td colSpan={2} style={{ ...aTd, textAlign: 'right' }}>JAMI:</td>
                <td style={{ ...aTd, textAlign: 'right' }}>{fmtT(totalSaleTon)} tn</td>
                <td style={aTd}></td>
                <td style={{ ...aTd, textAlign: 'right' }}>{fmt(totalSaleSum)}</td>
                <td colSpan={2} style={aTd}></td>
              </tr>
            </tbody>
          </table>

          {/* To'lovlar jadvali — mijoz haqiqatda bergan pullar */}
          {allPayments.length > 0 && (
            <>
              <div style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 4, borderBottom: '1px solid #000', paddingBottom: 2 }}>Mijoz to'lovlari ({allPayments.length} ta)</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    <th style={aTh}>#</th>
                    <th style={aTh}>Sana</th>
                    <th style={{ ...aTh, textAlign: 'right', color: '#006600' }}>To'lov summasi</th>
                    <th style={aTh}>Kanal</th>
                    <th style={aTh}>Izoh</th>
                    <th style={aTh}>Xodim</th>
                  </tr>
                </thead>
                <tbody>
                  {allPayments.map((p, i) => (
                    <tr key={p.id || i} style={{ background: i % 2 === 0 ? '#f0fff0' : '#fff' }}>
                      <td style={{ ...aTd, textAlign: 'center', color: '#888' }}>{i + 1}</td>
                      <td style={aTd}>{p.date}</td>
                      <td style={{ ...aTd, textAlign: 'right', fontWeight: 'bold', color: '#006600' }}>{fmt(p.amount)}</td>
                      <td style={aTd}>{{ naqd: '💵 Naqd', bank: '🏦 Bank', click: '📱 Click' }[p.channel] || p.channel || '—'}</td>
                      <td style={aTd}>{p.note || '—'}</td>
                      <td style={aTd}>{p.worker || '—'}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#ffff00', fontWeight: 'bold' }}>
                    <td colSpan={2} style={{ ...aTd, textAlign: 'right' }}>JAMI:</td>
                    <td style={{ ...aTd, textAlign: 'right', color: '#006600' }}>{fmt(totalPayments)}</td>
                    <td colSpan={3} style={aTd}></td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          {/* Imzo qatorlari */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, fontSize: 12 }}>
            <span>Mas'ul: _______________</span>
            <span>Mijoz: _______________</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const aktBtn = (bg) => ({ padding: '5px 14px', background: bg, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', fontSize: 12 });
const aTh = { border: '1px solid #000', padding: '4px 6px', fontSize: 11, fontWeight: 'bold', background: '#f0f0f0' };
const aTd = { border: '1px solid #ccc', padding: '3px 6px', fontSize: 11 };

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ background: '#eceff1', padding: '5px 10px', fontWeight: 'bold', fontSize: 13, color: '#37474f', borderRadius: 3, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

function Empty() {
  return <p style={{ color: '#999', fontStyle: 'italic', fontSize: 13, margin: '4px 0 0 4px' }}>Ma'lumot yo'q.</p>;
}
