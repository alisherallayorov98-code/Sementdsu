import { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import ExcelExport from '../components/ExcelExport';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtDateTime = (ts) => new Date(ts).toLocaleString('ru-RU');

const ACTION = {
  create: { label: 'Qo\'shildi', color: '#2e7d32', icon: '➕' },
  update: { label: 'O\'zgartirildi', color: '#ef6c00', icon: '✎' },
  delete: { label: 'O\'chirildi', color: '#c62828', icon: '🗑' },
};
const SEV = { high: { bg: '#ffebee', border: '#c62828', color: '#c62828', label: 'Yuqori' },
              medium: { bg: '#fff8e1', border: '#ef6c00', color: '#ef6c00', label: 'O\'rta' } };

export default function Audit() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]       = useState('');
  const [tab, setTab]       = useState('suspicious'); // suspicious | all
  const [q, setQ]           = useState('');

  const refresh = () => {
    setLoading(true);
    api.getAudit(2000)
      .then(d => { setData(d); setErr(''); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(refresh, []);

  const entries = data?.entries || [];
  const suspicious = useMemo(() => entries.filter(e => e.flags?.length), [entries]);

  const list = (tab === 'suspicious' ? suspicious : entries).filter(e =>
    !q || (e.userName || '').toLowerCase().includes(q.toLowerCase())
       || (e.label || '').toLowerCase().includes(q.toLowerCase())
       || (e.text || '').toLowerCase().includes(q.toLowerCase())
  );

  const highCount = suspicious.filter(e => e.flags.some(f => f.severity === 'high')).length;

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13, paddingBottom: 40 }}>

      {/* Izoh */}
      <div style={{ background: '#e3f2fd', border: '1px solid #bbdefb', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#1565c0', lineHeight: 1.6 }}>
        🔒 <strong>Nazorat jurnali</strong> — har bir o'zgarish <strong>server vaqti</strong> bilan yoziladi.
        Kassir qaysi "sana"ni qo'ymasin, server haqiqiy vaqtni biladi — shu sababli
        <strong> orqaga sana</strong> bilan yozilgan xarajatlar, eski yozuvlarni tahrirlash/o'chirish darrov bilinadi.
        Bu sahifa faqat sizga (admin) ko'rinadi.
      </div>

      {/* Statistika */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <Stat label="Jami o'zgarishlar" value={entries.length} color="#283593" bg="#e8eaf6" />
        <Stat label="Shubhali harakatlar" value={suspicious.length} color="#ef6c00" bg="#fff3e0" />
        <Stat label="Yuqori xavf" value={highCount} color="#c62828" bg="#ffebee" />
        <button onClick={refresh} style={{ marginLeft: 'auto', alignSelf: 'center', padding: '8px 16px', cursor: 'pointer', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>
          🔄 Yangilash
        </button>
      </div>

      {/* Tabs + qidiruv */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setTab('suspicious')} style={tabBtn(tab === 'suspicious', '#c62828')}>
          ⚠️ Shubhali harakatlar ({suspicious.length})
        </button>
        <button onClick={() => setTab('all')} style={tabBtn(tab === 'all', '#283593')}>
          📋 Barcha o'zgarishlar ({entries.length})
        </button>
        <input placeholder="🔍 Xodim, bo'lim yoki izoh..." value={q} onChange={e => setQ(e.target.value)}
          style={{ padding: '5px 10px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4, width: 240, marginLeft: 'auto' }} />
        <ExcelExport
          filename="Nazorat_jurnali"
          sheetName="Audit"
          title="Nazorat jurnali (audit)"
          columns={[
            { header: 'Haqiqiy vaqt (server)', value: e => fmtDateTime(e.ts) },
            { header: 'Xodim', value: e => e.userName || '' },
            { header: 'Rol', value: e => e.role || '' },
            { header: 'Amal', value: e => (ACTION[e.action]?.label || e.action) },
            { header: 'Nima', value: e => e.label || '' },
            { header: 'Izoh', value: e => e.text || '' },
            { header: 'Yozuv sanasi', value: e => e.recordDate || '' },
            { header: 'Summa', value: e => Number(e.amount || 0) },
            { header: 'Ogohlantirish', value: e => (e.flags || []).map(f => f.text).join('; ') },
          ]}
          rows={list}
        />
      </div>

      {loading ? <p style={{ color: '#888' }}>Yuklanmoqda...</p>
       : err ? <p style={{ color: '#c62828' }}>Xato: {err}</p>
       : list.length === 0 ? (
        <p style={{ color: '#888', fontStyle: 'italic', marginTop: 20 }}>
          {tab === 'suspicious' ? '✅ Shubhali harakat topilmadi.' : 'Hali o\'zgarishlar yo\'q.'}
        </p>
      ) : (
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 140 }}>Haqiqiy vaqt (server)</th>
              <th style={{ width: 120 }}>Xodim</th>
              <th style={{ width: 110 }}>Amal</th>
              <th>Nima</th>
              <th style={{ width: 90 }}>Yozuv sanasi</th>
              <th style={{ textAlign: 'right', width: 120 }}>Summa</th>
              <th style={{ minWidth: 220 }}>Ogohlantirish</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e, i) => {
              const act = ACTION[e.action] || { label: e.action, color: '#555', icon: '•' };
              const topSev = e.flags?.some(f => f.severity === 'high') ? 'high' : e.flags?.length ? 'medium' : null;
              const rowBg = topSev === 'high' ? '#fff5f5' : topSev === 'medium' ? '#fffdf5' : (i % 2 ? '#fafafa' : '#fff');
              return (
                <tr key={i} style={{ background: rowBg }}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtDateTime(e.ts)}</td>
                  <td style={{ fontWeight: 'bold' }}>{e.userName} <span style={{ fontSize: 10, color: '#999' }}>({e.role})</span></td>
                  <td style={{ color: act.color, fontWeight: 'bold' }}>{act.icon} {act.label}</td>
                  <td>
                    <div style={{ fontWeight: 'bold' }}>{e.label}</div>
                    {e.text && <div style={{ fontSize: 11, color: '#666' }}>{e.text}</div>}
                    {e.changes?.length > 0 && (
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                        {e.changes.map((c, j) => <span key={j} style={{ marginRight: 8 }}>{c.field}: <b>{String(c.from) || '—'}</b>→<b>{String(c.to) || '—'}</b></span>)}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>{e.recordDate || '—'}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{e.amount ? fmt(e.amount) : '—'}</td>
                  <td>
                    {e.flags?.length ? e.flags.map((f, j) => {
                      const s = SEV[f.severity] || SEV.medium;
                      return (
                        <div key={j} style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 'bold', marginBottom: 3, display: 'inline-block', marginRight: 4 }}>
                          {f.text}
                        </div>
                      );
                    }) : <span style={{ color: '#bbb', fontSize: 11 }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Stat({ label, value, color, bg }) {
  return (
    <div style={{ padding: '8px 18px', background: bg, borderLeft: `4px solid ${color}`, borderRadius: 4, minWidth: 150 }}>
      <div style={{ fontSize: 11, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 'bold', color, fontFamily: 'monospace' }}>{value}</div>
    </div>
  );
}
const tabBtn = (active, color) => ({
  padding: '7px 16px', cursor: 'pointer', borderRadius: 4, fontWeight: 'bold', fontSize: 13,
  border: `1px solid ${color}`, background: active ? color : '#fff', color: active ? '#fff' : color,
});
