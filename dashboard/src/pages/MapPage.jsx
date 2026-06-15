// ─────────────────────────────────────────────────────────────────────────────
// Xarita — mijoz/do'konlar xaritada, SAVDO bo'yicha aqlli:
//  • Nuqta KATTALIGI — jami xarid (tonna) hajmiga qarab (katta mijoz — katta nuqta)
//  • Rang rejimi: Holat (nazorat) / Qarz / Davr faolligi
//  • Davr filtri: bugun / hafta / oy / hammasi (kim shu davrda yuk oldi)
//  • Popup: tonna, xarid summasi, oxirgi xarid, qarz, yo'l ko'rsatish
// Joylashuv bot (📍) yoki qo'lda (mijoz kartochkasi) belgilanadi.
// Leaflet + ko'cha/sputnik (bepul, kalitsiz).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import { customerSummary } from '../lib/customerSummary';
import { activityStatus, STATUS } from '../lib/monitoring';
import CustomerCard from '../components/CustomerCard';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };
const dayAgo = (ts) => (ts && ts > 1e10 ? Math.floor((Date.now() - ts) / 86400000) : null);

const parseDate = (s) => {
  if (!s) return 0;
  const p = String(s).split('.');
  if (p.length !== 3) return 0;
  const [d, m, y] = p.map(Number);
  return new Date(y, m - 1, d).getTime();
};
const rowTs = (r) => parseDate(r.date) || Number(r.createdAt || r.id || 0);

function periodStart(key) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  if (key === 'today') return new Date(y, m, d).getTime();
  if (key === 'week')  { const wd = (now.getDay() + 6) % 7; return new Date(y, m, d - wd).getTime(); }
  if (key === 'month') return new Date(y, m, 1).getTime();
  return 0; // all
}

const PERIODS = [
  { k: 'today', l: 'Bugun' }, { k: 'week', l: 'Hafta' }, { k: 'month', l: 'Oy' }, { k: 'all', l: 'Hammasi' },
];
const COLOR_MODES = [
  { k: 'status', l: '🔔 Holat' }, { k: 'debt', l: '💳 Qarz' }, { k: 'activity', l: '📅 Davr faolligi' },
];

export default function MapPage() {
  const data = useData();
  const { customers, appSettings, tgLocationFor, salesRows = [], soldRows = [] } = data;
  const globalDays = Number(appSettings?.monitorDays) || 14;

  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const layerRef = useRef(null);
  const [card, setCard] = useState(null);
  const [onlyMonitored, setOnlyMonitored] = useState(false);
  const [colorMode, setColorMode] = useState('status');
  const [period, setPeriod] = useState('all');

  // Davr bo'yicha har mijozning sotuvi (tonna/summa)
  const start = periodStart(period);
  const periodByCust = {};
  [...salesRows, ...soldRows].forEach(r => {
    if (rowTs(r) < start) return;
    const k = r.customer || '';
    if (!k) return;
    if (!periodByCust[k]) periodByCust[k] = { tons: 0, sum: 0 };
    periodByCust[k].tons += Number(r.tons || 0);
    periodByCust[k].sum  += Number(r.tons || 0) * Number(r.pricePerTon || 0);
  });

  // Joylashuvi bor mijozlar + savdo ma'lumoti
  const located = customers
    .map(c => {
      const loc = (c.lat != null && c.lon != null) ? { lat: c.lat, lon: c.lon } : (c.phone ? tgLocationFor(c.phone) : null);
      if (!loc) return null;
      const s = customerSummary(c.name, data);
      const act = c.monitored ? activityStatus(s, c, globalDays) : null;
      const per = periodByCust[c.name] || { tons: 0, sum: 0 };
      return {
        c, loc, status: act?.status || null,
        totalTon: s.totalTon, totalXarid: s.totalXarid, qarz: s.qolganQarz,
        lastDays: dayAgo(s.lastSaleAt),
        periodTons: per.tons, periodSum: per.sum, periodBought: per.tons > 0,
      };
    })
    .filter(Boolean)
    .filter(m => !onlyMonitored || m.c.monitored);

  const colorOf = (m) => {
    if (colorMode === 'debt')     return m.qarz > 0 ? '#c62828' : '#2e7d32';
    if (colorMode === 'activity') return m.periodBought ? '#2e7d32' : '#9e9e9e';
    return m.status ? m.status.color : '#1565c0'; // status
  };
  // Nuqta kattaligi — jami tonna hajmiga qarab
  const radiusOf = (m) => Math.max(6, Math.min(24, 6 + Math.sqrt(Number(m.totalTon) || 0) * 1.6));

  // Xaritani bir marta yaratish (ko'cha + sputnik)
  useEffect(() => {
    if (!window.L || mapObj.current || !mapRef.current) return;
    const map = window.L.map(mapRef.current, { maxZoom: 21 }).setView([41.311, 69.240], 11);
    const street = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxNativeZoom: 19, maxZoom: 21, attribution: '© OpenStreetMap',
    });
    const satellite = window.L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxNativeZoom: 18, maxZoom: 21, attribution: 'Tiles © Esri',
      });
    const labels = window.L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxNativeZoom: 18, maxZoom: 21, attribution: '',
      });
    const satelliteGroup = window.L.layerGroup([satellite, labels]);
    street.addTo(map);
    window.L.control.layers(
      { '🗺 Ko\'cha xaritasi': street, '🛰 Sputnik': satelliteGroup }, null, { collapsed: false }
    ).addTo(map);
    mapObj.current = map;
    layerRef.current = window.L.layerGroup().addTo(map);
  }, []);

  // Markerlarni yangilash
  useEffect(() => {
    const map = mapObj.current, layer = layerRef.current;
    if (!window.L || !map || !layer) return;
    layer.clearLayers();
    const pts = [];
    located.forEach(m => {
      const marker = window.L.circleMarker([m.loc.lat, m.loc.lon], {
        radius: radiusOf(m), color: '#fff', weight: 2, fillColor: colorOf(m), fillOpacity: 0.9,
      });
      const dir = `https://www.google.com/maps/dir/?api=1&destination=${m.loc.lat},${m.loc.lon}`;
      marker.bindPopup(
        `<b>${m.c.name}</b><br/>` +
        (m.c.phone ? `📞 ${m.c.phone}<br/>` : '') +
        (m.status ? `Holat: <b style="color:${m.status.color}">${m.status.label}</b>` + (m.lastDays != null ? ` (${m.lastDays} kun)` : '') + `<br/>` : '') +
        `Jami xarid: <b>${fmtT(m.totalTon)} tn</b> · ${fmt(m.totalXarid)} so'm<br/>` +
        (period !== 'all' ? `Davr (${period}): <b>${fmtT(m.periodTons)} tn</b><br/>` : '') +
        (m.qarz > 0 ? `Qarz: <b style="color:#c62828">${fmt(m.qarz)} so'm</b><br/>` : '') +
        `<a href="${dir}" target="_blank">📍 Yo'l ko'rsatish</a>`
      );
      marker.addTo(layer);
      pts.push([m.loc.lat, m.loc.lon]);
    });
    if (pts.length) { try { map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 }); } catch { /* ignore */ } }
  }, [located.length, colorMode, period, onlyMonitored]);

  // Yig'indi (ko'rinayotgan nuqtalar bo'yicha)
  const sum = located.reduce((a, m) => {
    a.periodTons += m.periodTons; a.periodSum += m.periodSum; a.qarz += m.qarz;
    if (m.periodBought) a.active += 1;
    return a;
  }, { periodTons: 0, periodSum: 0, qarz: 0, active: 0 });

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>
      {/* Sarlavha + sanoq */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontWeight: 'bold', color: '#01579b', fontSize: 15 }}>🗺 Savdo xaritasi</span>
        <span style={{ fontSize: 12, color: '#666' }}>{located.length} ta do'kon</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', cursor: 'pointer', fontSize: 12 }}>
          <input type="checkbox" checked={onlyMonitored} onChange={e => setOnlyMonitored(e.target.checked)} />
          Faqat nazoratdagilar
        </label>
      </div>

      {/* Boshqaruv: rang rejimi + davr */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8, padding: '8px 12px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 'bold', color: '#555' }}>Rang:</span>
        {COLOR_MODES.map(cm => (
          <button key={cm.k} onClick={() => setColorMode(cm.k)} style={chip(colorMode === cm.k, '#01579b')}>{cm.l}</button>
        ))}
        <span style={{ fontSize: 12, fontWeight: 'bold', color: '#555', marginLeft: 8 }}>Davr:</span>
        {PERIODS.map(p => (
          <button key={p.k} onClick={() => setPeriod(p.k)} style={chip(period === p.k, '#2e7d32')}>{p.l}</button>
        ))}
      </div>

      {/* Davr yig'indisi */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <Stat label={`Sotuv (${period})`} value={`${fmtT(sum.periodTons)} tn`} sub={`${fmt(sum.periodSum)} so'm`} color="#2e7d32" bg="#e8f5e9" />
        <Stat label="Shu davrda olgan" value={`${sum.active} / ${located.length}`} sub="do'kon" color="#1565c0" bg="#e3f2fd" />
        <Stat label="Jami qarz (xaritada)" value={`${fmt(sum.qarz)}`} sub="so'm" color="#c62828" bg="#ffebee" />
      </div>

      {/* Izoh (rang rejimiga qarab) */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8, fontSize: 11 }}>
        {colorMode === 'status' && <>
          <Legend color={STATUS.ok.color} label="Faol" /><Legend color={STATUS.warning.color} label="Yaqinlashmoqda" />
          <Legend color={STATUS.alert.color} label="Jim qoldi" /><Legend color="#1565c0" label="Oddiy" />
        </>}
        {colorMode === 'debt' && <><Legend color="#c62828" label="Qarzi bor" /><Legend color="#2e7d32" label="Qarzi yo'q" /></>}
        {colorMode === 'activity' && <><Legend color="#2e7d32" label="Shu davrda oldi" /><Legend color="#9e9e9e" label="Olmagan" /></>}
        <span style={{ color: '#999' }}>· nuqta kattaligi = jami xarid hajmi</span>
      </div>

      {!window.L && (
        <div style={{ padding: 10, background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: 6, marginBottom: 10, fontSize: 12 }}>
          ⚠ Xarita yuklanmadi (internet kerak). Ro'yxat va "Yo'l ko'rsatish" havolalari baribir ishlaydi.
        </div>
      )}

      <div ref={mapRef} style={{ width: '100%', height: 460, borderRadius: 8, border: '1px solid #ccc', marginBottom: 14, background: '#eef3f7' }} />

      {/* Ro'yxat */}
      {located.length === 0 ? (
        <p style={{ color: '#888', fontStyle: 'italic' }}>
          Hali joylashuv belgilanmagan. Mijoz botga <b>📍 Joylashuvni yuborish</b> qilsin, yoki mijoz kartochkasidan qo'lda belgilang.
        </p>
      ) : (
        <table className="data-table" style={{ width: '100%', maxWidth: 920 }}>
          <thead><tr>
            <th style={{ width: 30 }}>#</th><th>Mijoz</th><th style={{ width: 120 }}>Telefon</th>
            <th style={{ textAlign: 'right', width: 90 }}>Jami tn</th>
            <th style={{ textAlign: 'right', width: 90 }}>Davr tn</th>
            <th style={{ textAlign: 'right', width: 110 }}>Qarz</th>
            <th style={{ width: 110 }}>Holat</th><th style={{ width: 80 }}>Yo'l</th>
          </tr></thead>
          <tbody>
            {[...located].sort((a, b) => b.totalTon - a.totalTon).map((m, i) => (
              <tr key={m.c.id} style={{ background: m.qarz > 0 ? '#fff9f0' : (i % 2 === 0 ? '#fff' : '#fafafa') }}>
                <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{i + 1}</td>
                <td><button onClick={() => setCard(m.c.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#283593', fontWeight: 'bold', textDecoration: 'underline', padding: 0 }}>{m.c.name}</button></td>
                <td style={{ fontSize: 12 }}>{m.c.phone ? <a href={`tel:${m.c.phone}`} style={{ color: '#1565c0', textDecoration: 'none' }}>📞 {m.c.phone}</a> : '—'}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{fmtT(m.totalTon)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', color: m.periodBought ? '#2e7d32' : '#bbb' }}>{m.periodTons > 0 ? fmtT(m.periodTons) : '—'}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#c62828', fontWeight: m.qarz > 0 ? 'bold' : 'normal' }}>{m.qarz > 0 ? fmt(m.qarz) : '—'}</td>
                <td>{m.status ? <span style={{ color: m.status.color, fontWeight: 'bold', fontSize: 12 }}>{m.status.icon} {m.status.label}</span> : <span style={{ color: '#999', fontSize: 12 }}>—</span>}</td>
                <td><a href={`https://www.google.com/maps/dir/?api=1&destination=${m.loc.lat},${m.loc.lon}`} target="_blank" rel="noreferrer" style={{ background: '#1565c0', color: '#fff', padding: '3px 10px', borderRadius: 4, textDecoration: 'none', fontSize: 12 }}>📍</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {card && <CustomerCard name={card} onClose={() => setCard(null)} />}
    </div>
  );
}

const chip = (active, color) => ({
  padding: '4px 12px', cursor: 'pointer', borderRadius: 14, fontSize: 12, fontWeight: 'bold',
  border: `2px solid ${active ? color : '#ccc'}`, background: active ? color : '#fff', color: active ? '#fff' : '#555',
});

function Stat({ label, value, sub, color, bg }) {
  return (
    <div style={{ padding: '8px 16px', background: bg, borderLeft: `4px solid ${color}`, borderRadius: 4, minWidth: 130 }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 'bold', color, fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#999' }}>{sub}</div>}
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#555' }}>
      <span style={{ width: 12, height: 12, borderRadius: 6, background: color, display: 'inline-block', border: '1px solid #fff', boxShadow: '0 0 0 1px #ccc' }} />
      {label}
    </span>
  );
}
