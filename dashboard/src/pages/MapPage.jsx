// ─────────────────────────────────────────────────────────────────────────────
// Xarita — mijoz/do'konlarni xaritada ko'rsatadi. Joylashuv bot orqali (📍) yoki
// qo'lda (mijoz kartochkasi) belgilanadi. Nazoratdagi mijozlar holat rangi bilan:
// yashil=faol, sariq=yaqinlashmoqda, qizil=jim qoldi. Yangi agent do'konni topadi.
// Leaflet (bepul, OpenStreetMap) — index.html'da CDN orqali ulangan.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import { customerSummary } from '../lib/customerSummary';
import { activityStatus, STATUS } from '../lib/monitoring';
import CustomerCard from '../components/CustomerCard';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');

export default function MapPage() {
  const data = useData();
  const { customers, appSettings, tgLocationFor } = data;
  const globalDays = Number(appSettings?.monitorDays) || 14;
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const layerRef = useRef(null);
  const [card, setCard] = useState(null);
  const [onlyMonitored, setOnlyMonitored] = useState(false);

  // Joylashuvi bor mijozlar + holati
  const located = customers
    .map(c => {
      const loc = (c.lat != null && c.lon != null) ? { lat: c.lat, lon: c.lon } : (c.phone ? tgLocationFor(c.phone) : null);
      if (!loc) return null;
      const s = customerSummary(c.name, data);
      const act = c.monitored ? activityStatus(s, c, globalDays) : null;
      return { c, loc, qarz: s.qolganQarz, status: act?.status || null };
    })
    .filter(Boolean)
    .filter(m => !onlyMonitored || m.c.monitored);

  const colorOf = (m) => m.status ? m.status.color : '#1565c0';

  // Xaritani bir marta yaratish (ko'cha + sputnik qatlamlari)
  useEffect(() => {
    if (!window.L || mapObj.current || !mapRef.current) return;
    const map = window.L.map(mapRef.current, { maxZoom: 21 }).setView([41.311, 69.240], 11); // Toshkent default

    // Ko'cha xaritasi (OSM). maxNativeZoom — plitkalar shu darajagacha mavjud,
    // undan yaqinroqqa olib kelsa oxirgi plitkalar KATTALASHTIRILADI (bo'sh qolmaydi).
    const street = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxNativeZoom: 19, maxZoom: 21, attribution: '© OpenStreetMap',
    });
    // Sputnik (Esri World Imagery — bepul, kalitsiz). {z}/{y}/{x} tartibi.
    const satellite = window.L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxNativeZoom: 18, maxZoom: 21, attribution: 'Tiles © Esri',
      });
    // Sputnik ustiga ko'cha/nom yozuvlari (ixtiyoriy, sputnikda mo'ljal uchun)
    const labels = window.L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxNativeZoom: 18, maxZoom: 21, attribution: '',
      });
    const satelliteGroup = window.L.layerGroup([satellite, labels]);

    street.addTo(map); // standart — ko'cha
    window.L.control.layers(
      { '🗺 Ko\'cha xaritasi': street, '🛰 Sputnik': satelliteGroup },
      null, { collapsed: false }
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
      const color = colorOf(m);
      const marker = window.L.circleMarker([m.loc.lat, m.loc.lon], {
        radius: 9, color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.9,
      });
      const dir = `https://www.google.com/maps/dir/?api=1&destination=${m.loc.lat},${m.loc.lon}`;
      marker.bindPopup(
        `<b>${m.c.name}</b><br/>` +
        (m.c.phone ? `📞 ${m.c.phone}<br/>` : '') +
        (m.status ? `Holat: <b style="color:${m.status.color}">${m.status.label}</b><br/>` : '') +
        (m.qarz > 0 ? `Qarz: <b style="color:#c62828">${fmt(m.qarz)} so'm</b><br/>` : '') +
        `<a href="${dir}" target="_blank">📍 Yo'l ko'rsatish</a>`
      );
      marker.addTo(layer);
      pts.push([m.loc.lat, m.loc.lon]);
    });
    if (pts.length) {
      try { map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 }); } catch { /* ignore */ }
    }
  }, [located.length, onlyMonitored]);

  const counts = located.reduce((a, m) => {
    const k = m.status?.key || 'plain'; a[k] = (a[k] || 0) + 1; return a;
  }, {});

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>
      {/* Izoh + filtr + sanoq */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ fontWeight: 'bold', color: '#01579b' }}>🗺 Mijozlar xaritasi</span>
        <span style={{ fontSize: 12, color: '#666' }}>{located.length} ta joylashuv</span>
        <Legend color={STATUS.ok.color} label={`Faol ${counts.ok || 0}`} />
        <Legend color={STATUS.warning.color} label={`Yaqinlashmoqda ${counts.warning || 0}`} />
        <Legend color={STATUS.alert.color} label={`Jim qoldi ${counts.alert || 0}`} />
        <Legend color="#1565c0" label={`Oddiy ${counts.plain || 0}`} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', cursor: 'pointer', fontSize: 12 }}>
          <input type="checkbox" checked={onlyMonitored} onChange={e => setOnlyMonitored(e.target.checked)} />
          Faqat nazoratdagilar
        </label>
      </div>

      {!window.L && (
        <div style={{ padding: 10, background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: 6, marginBottom: 10, fontSize: 12 }}>
          ⚠ Xarita yuklanmadi (internet kerak). Quyidagi ro'yxat va "Yo'l ko'rsatish" havolalari baribir ishlaydi.
        </div>
      )}

      {/* Xarita */}
      <div ref={mapRef} style={{ width: '100%', height: 460, borderRadius: 8, border: '1px solid #ccc', marginBottom: 14, background: '#eef3f7' }} />

      {/* Ro'yxat (xarita ishlamasa ham) */}
      {located.length === 0 ? (
        <p style={{ color: '#888', fontStyle: 'italic' }}>
          Hali joylashuv belgilanmagan. Mijoz botga <b>📍 Joylashuvni yuborish</b> qilsin, yoki mijoz kartochkasidan qo'lda belgilang.
        </p>
      ) : (
        <table className="data-table" style={{ width: '100%', maxWidth: 760 }}>
          <thead><tr><th style={{ width: 30 }}>#</th><th>Mijoz</th><th style={{ width: 130 }}>Telefon</th><th style={{ width: 130 }}>Holat</th><th style={{ width: 120 }}>Yo'l</th></tr></thead>
          <tbody>
            {located.map((m, i) => (
              <tr key={m.c.id}>
                <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{i + 1}</td>
                <td>
                  <button onClick={() => setCard(m.c.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#283593', fontWeight: 'bold', textDecoration: 'underline', padding: 0 }}>{m.c.name}</button>
                </td>
                <td style={{ fontSize: 12 }}>{m.c.phone ? <a href={`tel:${m.c.phone}`} style={{ color: '#1565c0', textDecoration: 'none' }}>📞 {m.c.phone}</a> : '—'}</td>
                <td>
                  {m.status
                    ? <span style={{ color: m.status.color, fontWeight: 'bold', fontSize: 12 }}>{m.status.icon} {m.status.label}</span>
                    : <span style={{ color: '#999', fontSize: 12 }}>—</span>}
                </td>
                <td>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${m.loc.lat},${m.loc.lon}`} target="_blank" rel="noreferrer"
                    style={{ background: '#1565c0', color: '#fff', padding: '3px 10px', borderRadius: 4, textDecoration: 'none', fontSize: 12 }}>📍 Yo'l</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {card && <CustomerCard name={card} onClose={() => setCard(null)} />}
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#555' }}>
      <span style={{ width: 12, height: 12, borderRadius: 6, background: color, display: 'inline-block', border: '1px solid #fff', boxShadow: '0 0 0 1px #ccc' }} />
      {label}
    </span>
  );
}
