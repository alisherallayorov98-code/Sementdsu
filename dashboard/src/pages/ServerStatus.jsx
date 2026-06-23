import { useState, useEffect } from 'react';
import { api } from '../api';

// Baytni odam o'qiydigan formatga (KB/MB/GB)
const fmtBytes = (b) => {
  b = Number(b || 0);
  if (b < 1024) return b + ' B';
  const u = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return b.toFixed(b >= 100 ? 0 : 1) + ' ' + u[i];
};

const fmtUptime = (sec) => {
  sec = Number(sec || 0);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return (d ? `${d} kun ` : '') + (h ? `${h} soat ` : '') + `${m} daqiqa`;
};

export default function ServerStatus() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');

  const refresh = () => {
    api.getSystem()
      .then(d => { setData(d); setErr(''); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  };
  // Birinchi yuklash + har 15 soniyada avtomatik yangilash
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, []);

  const disk = data?.disk;
  const usedPct = disk && disk.total ? (disk.used / disk.total) * 100 : 0;
  const freePct = 100 - usedPct;

  // Holat: bo'sh joy ko'p bo'lsa yashil, kamaysa sariq/qizil
  let level = { color: '#2e7d32', bg: '#e8f5e9', label: '✅ Joy yetarli', note: 'Server bemalol ishlamoqda.' };
  if (disk) {
    if (usedPct >= 90 || disk.free < 1 * 1024 ** 3) level = { color: '#c62828', bg: '#ffebee', label: '⛔ Joy tugayapti', note: 'Diqqat! Disk to\'lib bormoqda — bo\'sh joy ochish kerak.' };
    else if (usedPct >= 75)                          level = { color: '#ef6c00', bg: '#fff3e0', label: '⚠️ Diqqat', note: 'Disk yarmidan ko\'p band — kuzatib turing.' };
  }

  // Mijozni tinchlantiruvchi: bo'sh joy ma'lumotdan necha marta katta
  const dataBytes = data?.data?.bytes || 0;
  const ratio = dataBytes > 0 && disk ? Math.floor(disk.free / dataBytes) : null;

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13, paddingBottom: 40, maxWidth: 820 }}>

      {/* Izoh */}
      <div style={{ background: '#e3f2fd', border: '1px solid #bbdefb', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#1565c0', lineHeight: 1.6 }}>
        🖥 <strong>Server holati</strong> — dasturning serverdagi disk va xotira bandligini ko'rsatadi.
        Bu sahifa faqat sizga (admin) ko'rinadi. Har 15 soniyada avtomatik yangilanadi.
      </div>

      {loading ? <p style={{ color: '#888' }}>Yuklanmoqda...</p>
       : err ? <p style={{ color: '#c62828' }}>Xato: {err}</p>
       : !disk ? <p style={{ color: '#c62828' }}>Disk ma'lumotini olishda muammo (server eski Node versiyasidami?).</p>
       : (
        <>
          {/* Asosiy holat banneri */}
          <div style={{ background: level.bg, border: `2px solid ${level.color}`, borderRadius: 8, padding: '14px 18px', marginBottom: 18 }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: level.color }}>{level.label}</div>
            <div style={{ fontSize: 13, color: '#444', marginTop: 4 }}>{level.note}</div>
            {ratio !== null && (
              <div style={{ fontSize: 13, color: '#444', marginTop: 6 }}>
                Hozirgi bo'sh joy — barcha kiritilgan ma'lumotdan taxminan <strong>{ratio.toLocaleString('ru-RU')} marta</strong> katta.
                Ko'p yillik yozuvlarga ham bemalol yetadi.
              </div>
            )}
          </div>

          {/* Disk progress bar */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontWeight: 'bold' }}>
              <span>💽 Disk (server)</span>
              <span style={{ color: level.color }}>{usedPct.toFixed(1)}% band</span>
            </div>
            <div style={{ height: 26, background: '#eceff1', borderRadius: 6, overflow: 'hidden', border: '1px solid #cfd8dc' }}>
              <div style={{ width: `${usedPct}%`, height: '100%', background: level.color, transition: 'width .4s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#555' }}>
              <span>Band: <strong>{fmtBytes(disk.used)}</strong></span>
              <span>Bo'sh: <strong style={{ color: '#2e7d32' }}>{fmtBytes(disk.free)}</strong> ({freePct.toFixed(1)}%)</span>
              <span>Jami: <strong>{fmtBytes(disk.total)}</strong></span>
            </div>
          </div>

          {/* Kartochkalar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Card icon="🗄" label="Dastur ma'lumotlari (jami)" value={fmtBytes(data.data.bytes)} sub={`${data.data.files.toLocaleString('ru-RU')} ta fayl`} color="#283593" />
            <Card icon="📒" label="Asosiy baza (db.json)" value={fmtBytes(data.db.bytes)} sub="joriy yozuvlar" color="#00695c" />
            <Card icon="💾" label="Zaxira nusxalar (backup)" value={fmtBytes(data.backups.bytes)} sub={`${data.backups.files.toLocaleString('ru-RU')} ta nusxa`} color="#6a1b9a" />
            <Card icon="🧠" label="Operativ xotira (RAM)" value={`${fmtBytes(data.ram.total - data.ram.free)} / ${fmtBytes(data.ram.total)}`} sub="band / jami" color="#ad1457" />
            <Card icon="⏱" label="Server uzluksiz ishlamoqda" value={fmtUptime(data.uptimeSec)} sub="oxirgi qayta yuklashdan" color="#37474f" />
          </div>

          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={refresh} style={{ padding: '8px 16px', cursor: 'pointer', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>
              🔄 Yangilash
            </button>
            <span style={{ fontSize: 11, color: '#999' }}>
              Server vaqti: {new Date(data.serverTime).toLocaleString('ru-RU')}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function Card({ icon, label, value, sub, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderLeft: `4px solid ${color}`, borderRadius: 6, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: '#666' }}>{icon} {label}</div>
      <div style={{ fontSize: 19, fontWeight: 'bold', color, fontFamily: 'monospace', marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
