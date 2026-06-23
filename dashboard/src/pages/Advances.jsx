import { useState } from 'react';
import { useData } from '../context/DataContext';
import CustomerSelect from '../components/CustomerSelect';
import ExcelExport from '../components/ExcelExport';
import CustomerCard from '../components/CustomerCard';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');

// ─── Tarjimonlar ─────────────────────────────────────────────────────────────
const L = {
  mijoz:        { latn: 'Mijoz',              cyrl: 'Мижоз'              },
  avans:        { latn: 'Avans summasi',      cyrl: 'Аванс суммаси'     },
  ishlatildi:   { latn: 'Ishlatildi',         cyrl: 'Ишлатилди'          },
  qoldi:        { latn: 'Qolgan avans',       cyrl: 'Қолган аванс'      },
  qoshish:      { latn: "Qo'shish",           cyrl: 'Қўшиш'              },
  ishlatish:    { latn: 'Ishlatish',          cyrl: 'Ишлатиш'            },
  sana:         { latn: 'Sana',              cyrl: 'Сана'                },
  jami:         { latn: 'Jami avans',        cyrl: 'Жами аванс'         },
  jamiAll:      { latn: 'Umumiy avans',      cyrl: 'Умумий аванс'       },
  jamiUsed:     { latn: 'Jami ishlatildi',   cyrl: 'Жами ишлатилди'     },
  jamiLeft:     { latn: 'Jami qolgan',       cyrl: 'Жами қолган'        },
  miqdor:       { latn: 'Miqdor',            cyrl: 'Миқдор'              },
  izoh:         { latn: 'Izoh',              cyrl: 'Изоҳ'                },
  ishlatishIzoh:{ latn: 'Ishlatish izohi',  cyrl: 'Ишлатиш изоҳи'     },
  qidirish:     { latn: 'Qidirish...',       cyrl: 'Қидириш...'          },
  barchasi:     { latn: 'Barchasi',          cyrl: 'Барчаси'             },
  tugamagan:    { latn: 'Tugamagan',         cyrl: 'Тугамаган'           },
  qisman:       { latn: 'Qisman',            cyrl: 'Қисман'              },
  toliqIshlatilgan: { latn: "To'liq ishlatilgan", cyrl: 'Тўлиқ ишлатилган' },
  tarix:        { latn: 'Ishlatish tarixi', cyrl: 'Ишлатиш тарихи'     },
  yopish:       { latn: 'Yopish',           cyrl: 'Ёпиш'                },
  yozuvYoq:     { latn: 'Yozuv topilmadi.', cyrl: 'Ёзув топилмади.'    },
  xodim:        { latn: 'Xodim',            cyrl: 'Ходим'               },
  holat:        { latn: 'Holat',            cyrl: 'Ҳолат'               },
};

// ─── Holat ───────────────────────────────────────────────────────────────────
function getStatus(amount, used) {
  const rem = Number(amount) - Number(used);
  if (rem <= 0)          return 'full';
  if (Number(used) > 0)  return 'partial';
  return 'none';
}

const STATUS_STYLE = {
  full:    { bg: '#fff3e0', border: '#ff9800', color: '#e65100', label: { latn: "To'liq ishlatilgan", cyrl: 'Тўлиқ ишлатилган' } },
  partial: { bg: '#e3f2fd', border: '#1976d2', color: '#1565c0', label: { latn: 'Qisman',             cyrl: 'Қисман'            } },
  none:    { bg: '#fff',    border: '#4caf50', color: '#2e7d32', label: { latn: 'Tugamagan',           cyrl: 'Тугамаган'         } },
};

// ─── ASOSIY KOMPONENT ────────────────────────────────────────────────────────
export default function Advances({ lang }) {
  const {
    advanceRows, addAdvanceRow, useAdvance, deleteAdvanceRow,
    totalAdvances, totalAdvancesUsed, totalAdvancesAll,
  } = useData();

  const [form, setForm]       = useState({ customer: '', amount: '', note: '', channel: 'naqd' });
  const [useForm, setUseForm] = useState({ id: null, amount: '', note: '' });
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all'); // 'all' | 'none' | 'partial' | 'full'
  const [history, setHistory] = useState(null);
  const [card, setCard]       = useState(null); // ochilgan mijoz kartochkasi (ismi)

  // ── Forma submit ────────────────────────────────────────────────────────────
  const handleAdd = (e) => {
    e.preventDefault();
    if (form.customer && form.amount) {
      addAdvanceRow(form.customer, form.amount, form.note, form.channel);
      setForm({ customer: '', amount: '', note: '', channel: 'naqd' });
    }
  };

  // ── Ishlatish ───────────────────────────────────────────────────────────────
  const handleUseOpen = (id) => {
    setUseForm({ id, amount: '', note: '' });
  };
  const handleUseConfirm = () => {
    if (useForm.amount) {
      useAdvance(useForm.id, useForm.amount, useForm.note);
      setUseForm({ id: null, amount: '', note: '' });
    }
  };

  // ── O'chirish ───────────────────────────────────────────────────────────────
  const handleDelete = (id) => {
    if (window.confirm("Ushbu avans yozuvini o'chirasizmi?")) {
      deleteAdvanceRow(id);
    }
  };

  // ── Filtrlash ───────────────────────────────────────────────────────────────
  const filtered = advanceRows
    .filter(r => {
      const st = getStatus(r.amount, r.used);
      if (filter !== 'all' && st !== filter) return false;
      if (search && !r.customer.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .slice()
    .reverse();

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>

      {/* ── STATISTIKA PANELI ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <StatCard label={L.jamiAll[lang]}  value={fmt(totalAdvancesAll)}  color="#333"    bg="#f5f5f5" />
        <StatCard label={L.jamiUsed[lang]} value={fmt(totalAdvancesUsed)} color="#e65100" bg="#fff3e0" />
        <StatCard label={L.jamiLeft[lang]} value={fmt(totalAdvances)}     color="#2e7d32" bg="#e8f5e9" />
      </div>

      {/* ── AVANS QO'SHISH FORMASI ───────────────────────────────────────── */}
      <form onSubmit={handleAdd} style={{
        display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap',
        padding: '8px 10px', background: '#f9f9f9', border: '1px solid #ddd',
      }}>
        <CustomerSelect
          value={form.customer}
          onChange={name => setForm({ ...form, customer: name })}
          placeholder={L.mijoz[lang]}
          accentColor="#e65100"
          required
        />
        <input
          type="number"
          placeholder={L.avans[lang]}
          value={form.amount}
          onChange={e => setForm({ ...form, amount: e.target.value })}
          style={{ ...inp, width: 150 }}
        />
        <input
          placeholder={L.izoh[lang]}
          value={form.note}
          onChange={e => setForm({ ...form, note: e.target.value })}
          style={{ ...inp, width: 150 }}
        />
        {[
          { v: 'naqd', label: '💵 Naqd', color: '#1565c0' },
          { v: 'bank', label: '🏦 Bank', color: '#2e7d32' },
          { v: 'click',label: '📱 Click',color: '#6a1b9a' },
        ].map(ch => (
          <button key={ch.v} type="button" onClick={() => setForm({ ...form, channel: ch.v })} style={{
            padding: '3px 10px', fontSize: 12, cursor: 'pointer',
            border: `2px solid ${form.channel === ch.v ? ch.color : '#ddd'}`,
            background: form.channel === ch.v ? ch.color : '#f9f9f9',
            color: form.channel === ch.v ? '#fff' : '#333', borderRadius: 3,
          }}>{ch.label}</button>
        ))}
        <button type="submit" style={addBtn}>{L.qoshish[lang]}</button>
      </form>

      {/* ── FILTER va QIDIRUV ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder={L.qidirish[lang]}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inp, width: 180, border: '1px solid #aaa' }}
        />
        {[
          { key: 'all',     lbl: L.barchasi[lang]         },
          { key: 'none',    lbl: L.tugamagan[lang]         },
          { key: 'partial', lbl: L.qisman[lang]            },
          { key: 'full',    lbl: L.toliqIshlatilgan[lang]  },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={filterBtn(filter === f.key)}>
            {f.lbl}
          </button>
        ))}
        <span style={{ marginLeft: 6, color: '#888', fontSize: 11 }}>({filtered.length} ta)</span>
        <ExcelExport
          filename="Avanslar"
          sheetName="Avanslar"
          title="Avanslar hisoboti"
          columns={[
            { header: 'Sana', value: r => r.date },
            { header: 'Mijoz', value: r => r.customer },
            { header: 'Avans summasi', value: r => Number(r.amount || 0) },
            { header: 'Ishlatildi', value: r => Number(r.used || 0) },
            { header: 'Qolgan avans', value: r => Math.max(0, Number(r.amount || 0) - Number(r.used || 0)) },
            { header: 'Holat', value: r => STATUS_STYLE[getStatus(r.amount, r.used)].label.latn },
            { header: 'Izoh', value: r => r.note || '' },
          ]}
          rows={filtered}
        />
      </div>

      {/* ── ISHLATISH MODAL ──────────────────────────────────────────────── */}
      {useForm.id !== null && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.35)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={() => setUseForm({ id: null, amount: '', note: '' })}
        >
          <div
            style={{
              background: '#fff', padding: 24, borderRadius: 6,
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)', minWidth: 320,
            }}
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const row = advanceRows.find(r => r.id === useForm.id);
              const rem = row ? Math.max(0, Number(row.amount) - Number(row.used)) : 0;
              return (
                <>
                  <div style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 12, color: '#003366' }}>
                    {L.ishlatish[lang]}: <span style={{ color: '#e65100' }}>{row?.customer}</span>
                  </div>
                  <div style={{ marginBottom: 8, fontSize: 12, color: '#555' }}>
                    Qolgan avans: <b style={{ color: '#2e7d32' }}>{fmt(rem)} so'm</b>
                  </div>
                  <input
                    type="number"
                    placeholder={L.miqdor[lang]}
                    value={useForm.amount}
                    onChange={e => setUseForm({ ...useForm, amount: e.target.value })}
                    style={{ ...inp, width: '100%', marginBottom: 8, boxSizing: 'border-box' }}
                    autoFocus
                  />
                  <input
                    placeholder={L.ishlatishIzoh[lang]}
                    value={useForm.note}
                    onChange={e => setUseForm({ ...useForm, note: e.target.value })}
                    style={{ ...inp, width: '100%', marginBottom: 14, boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleUseConfirm} style={{ ...addBtn, flex: 1, background: '#e65100' }}>
                      ✓ {L.ishlatish[lang]}
                    </button>
                    <button
                      onClick={() => setUseForm({ id: null, amount: '', note: '' })}
                      style={{ flex: 1, padding: '5px 14px', cursor: 'pointer', background: '#ffcccc', border: '1px solid #c00', borderRadius: 3 }}
                    >
                      ✕
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── TARIX MODAL ─────────────────────────────────────────────────── */}
      {history !== null && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.35)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={() => setHistory(null)}
        >
          <div
            style={{
              background: '#fff', padding: 24, borderRadius: 6,
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)', minWidth: 420, maxWidth: 580,
            }}
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const row    = advanceRows.find(r => r.id === history);
              const usages = row?.usages || [];
              return (
                <>
                  <div style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 12, color: '#003366' }}>
                    {L.tarix[lang]}: {row?.customer}
                  </div>
                  {usages.length === 0 ? (
                    <p style={{ color: '#888', fontStyle: 'italic' }}>{L.yozuvYoq[lang]}</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#e65100', color: '#fff' }}>
                          <th style={th}>#</th>
                          <th style={th}>{L.sana[lang]}</th>
                          <th style={{ ...th, textAlign: 'right' }}>{L.miqdor[lang]}</th>
                          <th style={th}>{L.izoh[lang]}</th>
                          <th style={th}>{L.xodim[lang]}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usages.map((u, i) => (
                          <tr key={u.id} style={{ background: i % 2 === 0 ? '#f9f9f9' : '#fff' }}>
                            <td style={td}>{i + 1}</td>
                            <td style={td}>{u.date}</td>
                            <td style={{ ...td, textAlign: 'right', color: '#e65100', fontWeight: 'bold' }}>{fmt(u.amount)}</td>
                            <td style={td}>{u.note || '—'}</td>
                            <td style={td}>{u.worker || '—'}</td>
                          </tr>
                        ))}
                        <tr style={{ background: '#fff3e0', fontWeight: 'bold' }}>
                          <td colSpan={2} style={td}>Jami ishlatildi:</td>
                          <td style={{ ...td, textAlign: 'right', color: '#e65100' }}>{fmt(usages.reduce((s, u) => s + u.amount, 0))}</td>
                          <td colSpan={2} style={td}></td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                  <div style={{ marginTop: 16, textAlign: 'right' }}>
                    <button
                      onClick={() => setHistory(null)}
                      style={{ padding: '5px 20px', cursor: 'pointer', background: '#003366', color: '#fff', border: 'none', borderRadius: 3 }}
                    >
                      {L.yopish[lang]}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── ASOSIY JADVAL ────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <p style={{ color: '#888', fontStyle: 'italic', marginTop: 20 }}>{L.yozuvYoq[lang]}</p>
      ) : (
        <table className="data-table" style={{ width: '100%', maxWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th style={{ width: 80 }}>{L.sana[lang]}</th>
              <th>{L.mijoz[lang]}</th>
              <th style={{ textAlign: 'right', width: 120 }}>{L.avans[lang]}</th>
              <th style={{ textAlign: 'right', width: 110 }}>{L.ishlatildi[lang]}</th>
              <th style={{ textAlign: 'right', width: 110, color: '#2e7d32' }}>{L.qoldi[lang]}</th>
              <th style={{ width: 110 }}>{L.holat[lang]}</th>
              <th>{L.izoh[lang]}</th>
              <th style={{ width: 140 }}>Amal</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const remaining = Math.max(0, Number(r.amount) - Number(r.used));
              const st        = getStatus(r.amount, r.used);
              const ss        = STATUS_STYLE[st];
              return (
                <tr key={r.id} style={{ background: ss.bg }}>
                  <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{i + 1}</td>
                  <td style={{ fontSize: 12 }}>{r.date}</td>
                  <td onClick={() => setCard(r.customer)} title="Mijoz ma'lumotlarini ochish"
                    style={{ fontWeight: 'bold', color: '#003366', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>{r.customer}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.amount)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#e65100', fontWeight: 'bold' }}>{fmt(r.used)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#2e7d32', fontWeight: 'bold' }}>{fmt(remaining)}</td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '2px 7px', fontSize: 11,
                      border: `1px solid ${ss.border}`, borderRadius: 10,
                      color: ss.color, fontWeight: 'bold', whiteSpace: 'nowrap',
                    }}>
                      {ss.label[lang]}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: '#555' }}>{r.note || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {remaining > 0 && (
                        <button
                          onClick={() => handleUseOpen(r.id)}
                          style={{ fontSize: 11, cursor: 'pointer', padding: '2px 7px', background: '#fff3e0', border: '1px solid #ff9800', borderRadius: 3 }}
                        >
                          📤 {L.ishlatish[lang]}
                        </button>
                      )}
                      {(r.usages || []).length > 0 && (
                        <button
                          onClick={() => setHistory(r.id)}
                          style={{ fontSize: 11, cursor: 'pointer', padding: '2px 7px', background: '#e3f2fd', border: '1px solid #1976d2', borderRadius: 3, color: '#1565c0' }}
                        >
                          📋 {L.tarix[lang]}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(r.id)}
                        style={{ fontSize: 11, cursor: 'pointer', padding: '2px 7px', background: '#ffebee', border: '1px solid #e53935', borderRadius: 3, color: '#c62828' }}
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Jami qator */}
            <tr style={{ background: '#ffff00', fontWeight: 'bold' }}>
              <td colSpan={3} style={{ paddingLeft: 8 }}>{L.jami[lang]}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(filtered.reduce((s, r) => s + Number(r.amount), 0))}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#e65100' }}>{fmt(filtered.reduce((s, r) => s + Number(r.used), 0))}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#2e7d32' }}>{fmt(filtered.reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.used)), 0))}</td>
              <td colSpan={3}></td>
            </tr>
          </tbody>
        </table>
      )}

      {card && <CustomerCard name={card} onClose={() => setCard(null)} />}
    </div>
  );
}

// ─── Yordamchi komponent: statistika kartochkasi ─────────────────────────────
function StatCard({ label, value, color, bg }) {
  return (
    <div style={{
      padding: '8px 16px', background: bg, border: `1px solid ${color}33`,
      borderLeft: `4px solid ${color}`, borderRadius: 4, minWidth: 160,
    }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 'bold', color, fontFamily: 'monospace' }}>{value} so'm</div>
    </div>
  );
}

// ─── Stil konstantalar ───────────────────────────────────────────────────────
const inp = {
  padding: '4px 6px', fontSize: 13,
  border: '1px solid #ccc', borderRadius: 3, width: 160,
};

const addBtn = {
  padding: '5px 16px', cursor: 'pointer',
  background: '#003366', color: '#fff',
  border: 'none', borderRadius: 3,
  fontFamily: 'Tahoma, sans-serif',
  fontSize: 13, fontWeight: 'bold',
};

const filterBtn = (active) => ({
  padding: '3px 10px', cursor: 'pointer',
  fontFamily: 'Tahoma, sans-serif', fontSize: 12,
  border: active ? '2px inset #ffffff' : '2px outset #ffffff',
  background: active ? '#003366' : '#f0f0f0',
  color: active ? '#fff' : '#333',
  fontWeight: active ? 'bold' : 'normal',
});

const th = {
  padding: '5px 8px', textAlign: 'left',
  border: '1px solid #bf360c', fontWeight: 'bold',
};

const td = {
  padding: '5px 8px', border: '1px solid #ddd',
};
