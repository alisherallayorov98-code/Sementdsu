import { useState } from 'react';
import * as XLSX from 'xlsx';
import { useData } from '../context/DataContext';
import { customerSummary } from '../lib/customerSummary';
import CustomerCard from '../components/CustomerCard';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };
const dateOf = (ts) => (ts && ts > 1e10 ? new Date(ts).toLocaleDateString('ru-RU') : '—');

export default function Customers() {
  const data = useData();
  const { customers, addCustomer, updateCustomer, deleteCustomer } = data;

  const [form, setForm]         = useState({ name: '', phone: '', address: '', note: '' });
  const [editId, setEditId]     = useState(null);
  const [editData, setEditData] = useState({});
  const [search, setSearch]     = useState('');
  const [showForm, setShowForm] = useState(false);
  const [modalName, setModalName] = useState(null); // ochilgan mijoz kartochkasi (nom)
  const [sortBy, setSortBy]     = useState('date'); // date | name | debt | xarid | avans | recent
  const [onlyDebt, setOnlyDebt] = useState(false);

  // ── Yagona hisoblagich (yangi "Sotish" + eski "Sotilgan tonna" birga) ─────
  const stat = (name) => customerSummary(name, data);

  // ── Qo'shish ─────────────────────────────────────────────────────────────
  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.name) return;
    const exists = customers.some(c => c.name.toLowerCase() === form.name.trim().toLowerCase());
    if (exists && !window.confirm(`"${form.name}" allaqachon mavjud. Qo'shilsinmi?`)) return;
    addCustomer(form);
    setForm({ name: '', phone: '', address: '', note: '' });
    setShowForm(false);
  };

  // ── Tahrirlash / o'chirish ────────────────────────────────────────────────
  const startEdit = (c) => { setEditId(c.id); setEditData({ name: c.name, phone: c.phone || '', address: c.address || '', note: c.note || '' }); };
  const saveEdit  = (id) => { if (!editData.name) return; updateCustomer(id, editData); setEditId(null); };
  const handleDelete = (id, name) => { if (window.confirm(`"${name}" o'chirilsinmi?`)) deleteCustomer(id); };

  // ── Filter + saralash ─────────────────────────────────────────────────────
  let filtered = customers
    .filter(c =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search) ||
      (c.address || '').toLowerCase().includes(search.toLowerCase())
    )
    .map(c => ({ ...c, _s: stat(c.name) }));

  if (onlyDebt) filtered = filtered.filter(c => c._s.qolganQarz > 0);

  if (sortBy === 'name')   filtered.sort((a, b) => a.name.localeCompare(b.name));
  if (sortBy === 'debt')   filtered.sort((a, b) => b._s.qolganQarz - a._s.qolganQarz);
  if (sortBy === 'xarid')  filtered.sort((a, b) => b._s.totalXarid - a._s.totalXarid);
  if (sortBy === 'avans')  filtered.sort((a, b) => b._s.qolganAvans - a._s.qolganAvans);
  if (sortBy === 'recent') filtered.sort((a, b) => b._s.lastSaleAt - a._s.lastSaleAt);
  if (sortBy === 'date')   filtered.sort((a, b) => b.id - a.id);

  // ── Umumiy statistika ─────────────────────────────────────────────────────
  const allStats = customers.map(c => stat(c.name));
  const totalDebtAll  = allStats.reduce((s, x) => s + x.qolganQarz, 0);
  const totalAvansAll = allStats.reduce((s, x) => s + x.qolganAvans, 0);
  const totalXaridAll = allStats.reduce((s, x) => s + x.totalXarid, 0);
  const totalTonAll   = allStats.reduce((s, x) => s + x.totalTon, 0);
  const withDebt      = allStats.filter(x => x.qolganQarz > 0).length;

  // ── Excel eksport (ko'rinayotgan ro'yxat) ─────────────────────────────────
  const exportExcel = () => {
    const rows = filtered.map((c, i) => ({
      '#': i + 1,
      'Ism': c.name,
      'Telefon': c.phone || '',
      'Manzil': c.address || '',
      'Jami xarid (som)': c._s.totalXarid,
      'Tonna': c._s.totalTon,
      'Qolgan qarz (som)': c._s.qolganQarz,
      'Qoldiq avans (som)': c._s.qolganAvans,
      'Oxirgi xarid': dateOf(c._s.lastSaleAt),
      'Izoh': c.note || '',
    }));
    if (!rows.length) { alert("Eksport uchun ma'lumot yo'q."); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 4 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mijozlar');
    XLSX.writeFile(wb, `mijozlar-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const inp = { padding: '4px 7px', fontSize: 13, border: '1px solid #ccc', borderRadius: 3, fontFamily: 'Tahoma, sans-serif' };

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>

      {/* ── STATISTIKA PANELI ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <StatBox label="Jami mijozlar" value={customers.length}      unit="ta"       color="#283593" bg="#e8eaf6" />
        <StatBox label="Umumiy xarid"  value={fmt(totalXaridAll)}    unit="so'm"     color="#1b5e20" bg="#e8f5e9" />
        <StatBox label="Jami tonna"    value={fmtT(totalTonAll)}     unit="tn"       color="#0d47a1" bg="#e3f2fd" />
        <StatBox label="Qarzdorlar"    value={withDebt}              unit="ta mijoz" color="#c62828" bg="#ffebee" onClick={() => setOnlyDebt(v => !v)} active={onlyDebt} />
        <StatBox label="Umumiy qarz"   value={fmt(totalDebtAll)}     unit="so'm"     color="#c62828" bg="#ffebee" bold />
        {totalAvansAll > 0 && <StatBox label="Qoldiq avans" value={fmt(totalAvansAll)} unit="so'm" color="#6a1b9a" bg="#f3e5f5" />}
      </div>

      {/* ── QIDIRUV + SARALASH + AMALLAR ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="🔍 Ism, telefon, manzil..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inp, width: 230, border: '1px solid #9fa8da' }}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...inp, border: '1px solid #ccc' }}>
          <option value="date">↓ Yangi qo'shilgan</option>
          <option value="name">А-Z Ism bo'yicha</option>
          <option value="debt">↓ Qarz bo'yicha</option>
          <option value="xarid">↓ Xarid bo'yicha</option>
          <option value="avans">↓ Avans bo'yicha</option>
          <option value="recent">↓ Oxirgi xarid</option>
        </select>
        <button onClick={() => setOnlyDebt(v => !v)} style={{
          padding: '5px 12px', cursor: 'pointer', borderRadius: 4, fontSize: 12, fontWeight: 'bold',
          background: onlyDebt ? '#c62828' : '#fff', color: onlyDebt ? '#fff' : '#c62828', border: '1px solid #c62828',
        }}>
          {onlyDebt ? '✓ Faqat qarzdorlar' : 'Faqat qarzdorlar'}
        </button>
        <button onClick={() => setShowForm(v => !v)} style={{
          padding: '5px 18px', cursor: 'pointer',
          background: showForm ? '#c62828' : '#283593',
          color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', fontSize: 13,
        }}>
          {showForm ? '✕ Yopish' : '+ Yangi mijoz'}
        </button>
        <button onClick={exportExcel} style={{
          padding: '5px 14px', cursor: 'pointer', background: '#1b5e20', color: '#fff',
          border: 'none', borderRadius: 4, fontWeight: 'bold', fontSize: 12,
        }}>
          ⬇️ Excel
        </button>
        <span style={{ color: '#888', fontSize: 12 }}>{filtered.length} ta ko'rinmoqda</span>
      </div>

      {/* ── YANGI MIJOZ FORMASI ───────────────────────────────────────────── */}
      {showForm && (
        <form onSubmit={handleAdd} style={{
          marginBottom: 16, padding: '14px 16px',
          background: '#e8eaf6', border: '1px solid #9fa8da', borderRadius: 6,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10,
        }}>
          {[
            { key: 'name',    label: 'Ism *',   ph: 'Ism yoki korxona', req: true  },
            { key: 'phone',   label: 'Telefon', ph: '+998 90 000 00 00', req: false },
            { key: 'address', label: 'Manzil',  ph: "Shahar, ko'cha",   req: false },
            { key: 'note',    label: 'Izoh',    ph: "Qo'shimcha",       req: false },
          ].map(({ key, label, ph, req }) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 3 }}>{label}</label>
              <input placeholder={ph} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                required={req} autoFocus={key === 'name'}
                style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button type="submit" style={{ padding: '6px 20px', cursor: 'pointer', background: '#283593', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', fontSize: 13 }}>
              ✓ Qo'shish
            </button>
            <button type="button" onClick={() => { setForm({ name:'', phone:'', address:'', note:'' }); setShowForm(false); }}
              style={{ padding: '6px 14px', cursor: 'pointer', background: '#fff', border: '1px solid #ccc', borderRadius: 4 }}>
              Bekor
            </button>
          </div>
        </form>
      )}

      {/* ── MIJOZLAR JADVAL ───────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <p style={{ color: '#888', fontStyle: 'italic', marginTop: 20 }}>Mijoz topilmadi.</p>
      ) : (
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 35 }}>#</th>
              <th style={{ minWidth: 160 }}>Ism</th>
              <th style={{ width: 135 }}>Telefon</th>
              <th style={{ width: 130 }}>Manzil</th>
              <th style={{ textAlign: 'right', width: 120 }}>Jami xarid</th>
              <th style={{ textAlign: 'right', width: 70 }}>Tonna</th>
              <th style={{ textAlign: 'right', width: 120 }}>Qolgan qarz</th>
              <th style={{ textAlign: 'right', width: 110 }}>Qoldiq avans</th>
              <th style={{ width: 85 }}>Oxirgi xarid</th>
              <th style={{ width: 90 }}>Amal</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const st = c._s;
              return (
                <tr key={c.id} style={{ background: st.qolganQarz > 0 ? '#fff9f0' : (i % 2 === 0 ? '#fff' : '#f4f5ff') }}>
                  <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{i + 1}</td>

                  {editId === c.id ? (
                    <>
                      <td><input value={editData.name}    onChange={e => setEditData({...editData, name: e.target.value})}    style={{ ...inp, width: '100%', fontSize: 12 }} /></td>
                      <td><input value={editData.phone}   onChange={e => setEditData({...editData, phone: e.target.value})}   style={{ ...inp, width: '100%', fontSize: 12 }} placeholder="+998..." /></td>
                      <td><input value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} style={{ ...inp, width: '100%', fontSize: 12 }} /></td>
                      <td colSpan={5}><input value={editData.note} onChange={e => setEditData({...editData, note: e.target.value})} style={{ ...inp, width: '100%', fontSize: 12 }} placeholder="Izoh" /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => saveEdit(c.id)} style={greenBtn}>✓</button>
                          <button onClick={() => setEditId(null)} style={redBtn}>✕</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <button onClick={() => setModalName(c.name)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#283593', fontWeight: 'bold', fontSize: 13, padding: 0, textDecoration: 'underline', textAlign: 'left' }}>
                          {c.name}
                        </button>
                        {c.note && <span style={{ color: '#999', fontSize: 10, marginLeft: 6 }}>{c.note}</span>}
                      </td>
                      <td>
                        {c.phone
                          ? <a href={`tel:${c.phone}`} style={{ color: '#1565c0', textDecoration: 'none', fontWeight: 'bold', fontSize: 12 }}>📞 {c.phone}</a>
                          : <span style={{ color: '#bbb' }}>—</span>}
                      </td>
                      <td style={{ fontSize: 11, color: '#444' }}>{c.address || <span style={{ color: '#bbb' }}>—</span>}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#1565c0', fontSize: 12 }}>
                        {st.totalXarid > 0 ? fmt(st.totalXarid) : <span style={{ color: '#bbb' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#1565c0', fontSize: 12 }}>
                        {st.totalTon > 0 ? `${fmtT(st.totalTon)}` : <span style={{ color: '#bbb' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {st.qolganQarz > 0 ? (
                          <span style={{ background: '#c62828', color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' }}>
                            {fmt(st.qolganQarz)}
                          </span>
                        ) : st.totalQarz > 0 ? (
                          <span style={{ color: '#2e7d32', fontSize: 12 }}>✓ To'landi</span>
                        ) : (
                          <span style={{ color: '#bbb', fontSize: 11 }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: '#6a1b9a', fontWeight: st.qolganAvans > 0 ? 'bold' : 'normal' }}>
                        {st.qolganAvans > 0 ? fmt(st.qolganAvans) : <span style={{ color: '#bbb' }}>—</span>}
                      </td>
                      <td style={{ fontSize: 11, color: '#777' }}>{dateOf(st.lastSaleAt)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => setModalName(c.name)} style={infoBtn}>👁</button>
                          <button onClick={() => startEdit(c)} style={editBtn}>✎</button>
                          <button onClick={() => handleDelete(c.id, c.name)} style={redBtn}>✕</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* ── MIJOZ KARTOCHKASI (yagona) ───────────────────────────────────── */}
      {modalName && <CustomerCard name={modalName} onClose={() => setModalName(null)} />}
    </div>
  );
}

// ─── Yordamchi komponentlar ──────────────────────────────────────────────────
function StatBox({ label, value, unit, color, bg, bold, onClick, active }) {
  return (
    <div onClick={onClick} style={{
      padding: '8px 16px', background: bg, borderLeft: `4px solid ${color}`, borderRadius: 4, minWidth: 140,
      cursor: onClick ? 'pointer' : 'default', boxShadow: active ? `0 0 0 2px ${color}` : 'none',
    }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: bold ? 18 : 16, fontWeight: 'bold', color, fontFamily: 'monospace' }}>
        {value} <span style={{ fontSize: 12 }}>{unit}</span>
      </div>
    </div>
  );
}

// ─── Stil konstantlari ──────────────────────────────────────────────────────
const infoBtn  = { padding: '2px 7px', cursor: 'pointer', background: '#e8eaf6', border: '1px solid #3949ab', borderRadius: 3, color: '#283593', fontSize: 12 };
const editBtn  = { padding: '2px 7px', cursor: 'pointer', background: '#e3f2fd', border: '1px solid #1976d2', borderRadius: 3, color: '#1565c0', fontSize: 12 };
const greenBtn = { padding: '2px 7px', cursor: 'pointer', background: '#e8f5e9', border: '1px solid #4caf50', borderRadius: 3, color: '#2e7d32', fontSize: 12, fontWeight: 'bold' };
const redBtn   = { padding: '2px 7px', cursor: 'pointer', background: '#ffebee', border: '1px solid #e53935', borderRadius: 3, color: '#c62828', fontSize: 12 };
