/**
 * DateRangeFilter — qayta ishlatiladigan "sanadan–sanagacha" filtri.
 *
 * Props:
 *   value    : { from: 'yyyy-oo-kk', to: 'yyyy-oo-kk' }   — joriy oraliq
 *   onChange : (range) => void
 *   color    : highlight rangi (default '#003366')
 *   label    : chap tomondagi yozuv (default "Sana oralig'i:")
 */

import { todayISO, daysAgoISO, isEmptyRange } from '../lib/dateRange';

export default function DateRangeFilter({
  value = { from: '', to: '' },
  onChange,
  color = '#003366',
  label = "📅 Sana oralig'i:",
}) {
  const set = (patch) => onChange({ ...value, ...patch });
  const quick = (from, to) => onChange({ from, to });
  const clear = () => onChange({ from: '', to: '' });

  const inp = {
    padding: '4px 6px', fontSize: 12, fontFamily: 'Tahoma, sans-serif',
    border: `1px solid ${color}`, borderRadius: 4,
  };
  const qbtn = (active) => ({
    padding: '4px 10px', fontSize: 12, cursor: 'pointer', borderRadius: 4,
    border: `1px solid ${active ? color : '#ccc'}`,
    background: active ? color : '#f5f5f5',
    color: active ? '#fff' : '#333', fontWeight: active ? 'bold' : 'normal',
  });

  const today = todayISO();
  const isToday  = value.from === today && value.to === today;
  const is7      = value.from === daysAgoISO(6) && value.to === today;
  const is30     = value.from === daysAgoISO(29) && value.to === today;
  const isMonth  = (() => {
    const d = new Date();
    const first = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), '01'].join('-');
    return value.from === first && value.to === today;
  })();

  return (
    <div style={{
      display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
      padding: '8px 10px', background: '#f9f9f9', border: '1px solid #e0e0e0',
      borderRadius: 6, marginBottom: 10,
    }}>
      <span style={{ fontWeight: 'bold', fontSize: 12, color }}>{label}</span>
      <input type="date" value={value.from || ''} max={value.to || undefined}
        onChange={(e) => set({ from: e.target.value })} style={inp} />
      <span style={{ color: '#888' }}>—</span>
      <input type="date" value={value.to || ''} min={value.from || undefined}
        onChange={(e) => set({ to: e.target.value })} style={inp} />

      <button type="button" onClick={() => quick(today, today)}            style={qbtn(isToday)}>Bugun</button>
      <button type="button" onClick={() => quick(daysAgoISO(6), today)}    style={qbtn(is7)}>7 kun</button>
      <button type="button" onClick={() => {
        const d = new Date();
        const first = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), '01'].join('-');
        quick(first, today);
      }} style={qbtn(isMonth)}>Shu oy</button>
      <button type="button" onClick={() => quick(daysAgoISO(29), today)}   style={qbtn(is30)}>30 kun</button>
      <button type="button" onClick={clear} style={qbtn(isEmptyRange(value))}>Hammasi</button>
    </div>
  );
}
