import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { api } from '../api';
import ExcelImport from '../components/ExcelImport';

const normName = (s) => String(s ?? '').trim().toLowerCase();
const parseAmount = (v) => Number(String(v ?? '').replace(/\s/g, '').replace(/,/g, '')) || 0;

// Parol yacheykasi: yangi parolni kiriting, eski hashni ko'rsatmaydi
function PasswordCell({ workerId, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  if (!editing) return (
    <button onClick={() => { setVal(''); setEditing(true); }}
      style={{ padding:'3px 10px', cursor:'pointer', background:'#e3f2fd', border:'1px solid #90caf9', borderRadius:4, fontSize:12 }}>
      🔑 O'zgartirish
    </button>
  );
  return (
    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
      <input type="password" value={val} onChange={e => setVal(e.target.value)}
        placeholder="Yangi parol" autoFocus
        style={{ padding:'3px 6px', width:90, borderRadius:3, border:'1px solid #ccc', fontSize:12 }} />
      <button onClick={() => { if (val.trim()) { onSave(val.trim()); setEditing(false); } }}
        style={{ padding:'3px 8px', cursor:'pointer', background:'#2e7d32', color:'#fff', border:'none', borderRadius:3, fontSize:12 }}>✓</button>
      <button onClick={() => setEditing(false)}
        style={{ padding:'3px 8px', cursor:'pointer', background:'#ffcccc', border:'1px solid #c00', borderRadius:3, fontSize:12 }}>✕</button>
    </div>
  );
}

function TariffAdder({ onAdd, themeColor }) {
  const [val, setVal] = useState('');
  const handle = () => {
    const t = val.trim();
    if (!t) return;
    onAdd(t);
    setVal('');
  };
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()}
        placeholder="Yangi tarif nomi..."
        style={{ padding: '5px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12, width: 160 }} />
      <button onClick={handle}
        style={{ padding: '5px 14px', background: themeColor, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', fontSize: 12 }}>
        + Tarif
      </button>
    </div>
  );
}

function TariffCard({ tariff, onRename, onDelete, onAddPrice, onRemovePrice, themeColor }) {
  const [newPrice, setNewPrice] = useState('');
  const [editName, setEditName] = useState(false);
  const [nameVal, setNameVal]   = useState(tariff.name);
  const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');

  return (
    <div style={{ background: '#fff', border: '2px solid #e0e0e0', borderRadius: 8, padding: 16, minWidth: 220, flex: '1 1 220px', maxWidth: 300 }}>
      {/* Tarif nomi */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        {editName ? (
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            <input value={nameVal} onChange={e => setNameVal(e.target.value)} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') { onRename(nameVal); setEditName(false); } if (e.key === 'Escape') setEditName(false); }}
              style={{ flex: 1, padding: '3px 6px', fontSize: 13, border: '1px solid #ccc', borderRadius: 3 }} />
            <button onClick={() => { onRename(nameVal); setEditName(false); }}
              style={{ padding: '2px 8px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12 }}>✓</button>
          </div>
        ) : (
          <span style={{ fontWeight: 'bold', fontSize: 15, color: themeColor, cursor: 'pointer' }} onClick={() => { setNameVal(tariff.name); setEditName(true); }}>
            {tariff.name} ✎
          </span>
        )}
        <button onClick={onDelete} style={{ background: 'none', border: 'none', color: '#c62828', fontSize: 16, cursor: 'pointer', marginLeft: 4 }}>🗑</button>
      </div>

      {/* Narxlar ro'yxati */}
      <div style={{ marginBottom: 10, minHeight: 40 }}>
        {tariff.prices.length === 0 && <div style={{ color: '#bbb', fontSize: 12, fontStyle: 'italic' }}>Narx yo'q</div>}
        {tariff.prices.map(p => (
          <div key={p} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', marginBottom: 4, background: '#f5f5f5', borderRadius: 5 }}>
            <span style={{ fontWeight: 'bold', fontFamily: 'monospace', color: '#1565c0', fontSize: 14 }}>{fmt(p)} so'm</span>
            <button onClick={() => onRemovePrice(p)}
              style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>
          </div>
        ))}
      </div>

      {/* Narx qo'shish */}
      <div style={{ display: 'flex', gap: 4 }}>
        <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { onAddPrice(newPrice); setNewPrice(''); } }}
          placeholder="Narx (so'm)" style={{ flex: 1, padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }} />
        <button onClick={() => { onAddPrice(newPrice); setNewPrice(''); }}
          style={{ padding: '4px 10px', background: themeColor, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>+</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Zayavka Bot Settings Tab
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_TEMPLATE = `Доверенность на получение цемента
Наименование клиента: DAVR-SU MCHJ:
Номер клиента: 401061
Номер тикета - {tiket}
Дата погрузки: {sana}
Марка и вид цемента: {marka}
Количество тонн {tonna}
Номер машины {mashina}
____________________________

Имя получателя: сардор
Телефон получателя 943731116
Адрес доставки: Samarqand`;

const DEFAULT_LABELS = {
  tiket:   'Tiket raqami / Номер тикета',
  marka:   'Sement markasi / Марка и вид цемента',
  tonna:   'Tonna miqdori / Количество тонн',
  mashina: 'Mashina raqami / Номер машины',
};
const DEFAULT_OPTIONS = {
  marka: ['42.5H в россып', '42.5H в мешках', '32.5H в россып', '32.5H в мешках'],
  tonna: ['20', '22', '25', '27', '30', '50'],
};

function ZayavkaBotSettings({ themeColor }) {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [log, setLog] = useState([]);
  const [showLog, setShowLog] = useState(false);

  const [form, setForm] = useState({
    botToken: '',
    groupChatId: '',
    template: DEFAULT_TEMPLATE,
    fieldLabels: DEFAULT_LABELS,
    fieldOptions: DEFAULT_OPTIONS,
    optionalFields: [],
    autoFields: ['sana'],
  });

  // Option editing state
  const [optField, setOptField] = useState('');
  const [optVal, setOptVal] = useState('');
  const [labelField, setLabelField] = useState('');
  const [labelVal, setLabelVal] = useState('');

  useEffect(() => {
    api.getZayavkaConfig().then(r => {
      if (r.ok) {
        setCfg(r.config);
        setForm(f => ({
          ...f,
          botToken: r.config.hasToken ? '***' : '',
          groupChatId: r.config.groupChatId || '',
          template: r.config.template || DEFAULT_TEMPLATE,
          fieldLabels: r.config.fieldLabels || DEFAULT_LABELS,
          fieldOptions: r.config.fieldOptions || DEFAULT_OPTIONS,
          optionalFields: r.config.optionalFields || [],
          autoFields: r.config.autoFields || ['sana'],
        }));
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await api.saveZayavkaConfig({
        botToken: form.botToken === '***' ? undefined : form.botToken,
        groupChatId: form.groupChatId,
        template: form.template,
        fieldLabels: form.fieldLabels,
        fieldOptions: form.fieldOptions,
        optionalFields: form.optionalFields,
        autoFields: form.autoFields,
      });
      setMsg('✅ Saqlandi! Bot qayta ishga tushdi.');
    } catch (e) {
      setMsg('❌ Xato: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const loadLog = async () => {
    try { const r = await api.getZayavkaLog(20); setLog(r.log || []); setShowLog(true); } catch { /* */ }
  };

  // Extract fields from template for label/options editing
  const extractFields = (tmpl) => {
    const seen = new Set(); const fields = [];
    for (const m of (tmpl || '').matchAll(/\{(\w+)\}/g)) {
      if (!seen.has(m[1]) && m[1] !== 'number') { seen.add(m[1]); fields.push(m[1]); }
    }
    return fields;
  };

  const templateFields = extractFields(form.template);

  const sInput = { padding: '8px 12px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4, width: '100%', boxSizing: 'border-box' };
  const sBtn   = { padding: '8px 16px', background: themeColor, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 };

  if (loading) return <div style={{ padding: 24, color: '#888' }}>Yuklanmoqda...</div>;

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Yo'riqnoma */}
      <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: 16, marginBottom: 20, fontSize: 13, lineHeight: 1.7 }}>
        <strong style={{ color: '#1b5e20', fontSize: 14 }}>Zayavka Bot — qanday ishlaydi?</strong>
        <ol style={{ margin: '8px 0 0 20px', padding: 0 }}>
          <li>BotFather'dan yangi bot yarating → tokenini quyida kiriting</li>
          <li>Botni maqsad guruhingizga <strong>admin</strong> qilib qo'shing</li>
          <li>Guruhda <code>/chatid</code> yozing → bot javob bergan ID ni "Guruh Chat ID" ga kiriting</li>
          <li>Shablon va maydon sozlamalarini to'ldiring → Saqlang</li>
          <li>Xodimlar bot orqali <code>/zayavka</code> yozadi → 4 ta savol (sana avtomatik) → guruhga boradi</li>
        </ol>
        <div style={{ marginTop: 8, color: '#555', background: '#f1f8e9', border: '1px solid #c5e1a5', borderRadius: 4, padding: '8px 12px' }}>
          <strong>Shablon:</strong> o'zgaradigan joylarni <code>{`{tiket}`}</code>, <code>{`{marka}`}</code>, <code>{`{tonna}`}</code>, <code>{`{mashina}`}</code> kabi yozing.<br/>
          <code>{`{sana}`}</code> — avtomatik (bugungi sana). <code>{`{number}`}</code> — tartib raqam. Qolgan matn doimiy turadi.<br/>
          <strong>Savollar</strong> ikki tilda (O'zbek/Rus), <strong>natija</strong> shablon tilidadir (Rus).
        </div>
      </div>

      {/* Token va Chat ID */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 14px', color: themeColor }}>Bot sozlamalari</h4>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Bot Token (BotFather'dan)</div>
            <input
              type="password"
              value={form.botToken}
              onChange={e => setForm(f => ({ ...f, botToken: e.target.value }))}
              placeholder={cfg?.hasToken ? '(o\'zgartirilmaydi — yangi token kiriting)' : '1234567890:AAFxxxxxxx...'}
              style={sInput}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Guruh Chat ID (botni guruhga qo'shib /chatid yozing)</div>
            <input
              value={form.groupChatId}
              onChange={e => setForm(f => ({ ...f, groupChatId: e.target.value }))}
              placeholder="-1001234567890"
              style={sInput}
            />
          </div>
        </div>
      </div>

      {/* Shablon */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 4px', color: themeColor }}>Xabar shabloni</h4>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>Markdown qo'llashingiz mumkin (*qalin*, _kursiv_). {`{number}`} = tartib raqam. Har safar /zayavka bosganda maydonlar ketma-ket so'raladi.</div>
        <textarea
          value={form.template}
          onChange={e => setForm(f => ({ ...f, template: e.target.value }))}
          rows={8}
          style={{ ...sInput, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
        />
        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
          <strong>Shablon dagi maydonlar:</strong>{' '}
          {templateFields.length === 0
            ? <span style={{ color: '#c62828' }}>Hech qanday maydon topilmadi. {`{sana}`} kabi yozing.</span>
            : templateFields.map(f => <code key={f} style={{ marginRight: 6, background: '#f0f4ff', padding: '1px 5px', borderRadius: 3, color: '#1565c0' }}>{`{${f}}`}</code>)
          }
        </div>
      </div>

      {/* Maydon sozlamalari */}
      {templateFields.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 14px', color: themeColor }}>Maydon sozlamalari</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', whiteSpace: 'nowrap' }}>Maydon</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Yorliq / Подпись (botda ko'rinadi)</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Tez tugmalar (vergul bilan)</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', whiteSpace: 'nowrap' }}>🤖 Auto</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', whiteSpace: 'nowrap' }}>Ixtiyoriy</th>
                </tr>
              </thead>
              <tbody>
                {templateFields.map((field, i) => {
                  const isAuto     = (form.autoFields || []).includes(field);
                  const isOptional = (form.optionalFields || []).includes(field);
                  return (
                    <tr key={field} style={{ borderBottom: '1px solid #f0f0f0', background: isAuto ? '#fffde7' : (i % 2 === 0 ? '#fff' : '#fafafa') }}>
                      <td style={{ padding: '7px 10px' }}>
                        <code style={{ background: '#f0f4ff', padding: '2px 6px', borderRadius: 3, color: '#1565c0', fontSize: 12 }}>{`{${field}}`}</code>
                        {isAuto && <span style={{ marginLeft: 4, fontSize: 10, color: '#f57f17', fontWeight: 'bold' }}>AUTO</span>}
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        {isAuto ? (
                          <span style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>Bugungi sana (avtomatik)</span>
                        ) : (
                          <input
                            value={form.fieldLabels[field] || ''}
                            onChange={e => setForm(f => ({ ...f, fieldLabels: { ...f.fieldLabels, [field]: e.target.value } }))}
                            placeholder={field}
                            style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 3, fontSize: 12, width: 200 }}
                          />
                        )}
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        {isAuto ? <span style={{ color: '#ccc', fontSize: 12 }}>—</span> : (
                          <input
                            value={(form.fieldOptions[field] || []).join(', ')}
                            onChange={e => {
                              const opts = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                              setForm(f => ({ ...f, fieldOptions: { ...f.fieldOptions, [field]: opts } }));
                            }}
                            placeholder="masalan: 20, 25, 50"
                            style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 3, fontSize: 12, width: 200 }}
                          />
                        )}
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isAuto}
                          title="Avtomatik to'ldirish (so'ralmaydi)"
                          onChange={e => setForm(f => {
                            const cur = f.autoFields || [];
                            return { ...f, autoFields: e.target.checked ? [...cur, field] : cur.filter(x => x !== field) };
                          })}
                        />
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isOptional && !isAuto}
                          disabled={isAuto}
                          title="O'tkazib yuborish mumkin"
                          onChange={e => setForm(f => {
                            const cur = f.optionalFields || [];
                            return { ...f, optionalFields: e.target.checked ? [...cur, field] : cur.filter(x => x !== field) };
                          })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 8, lineHeight: 1.6 }}>
            <strong>🤖 Auto</strong> — maydon so'ralmaydi, avtomatik to'ldiriladi (<code>sana</code> = bugungi sana).<br/>
            <strong>Ixtiyoriy</strong> — bot "O'tkazib yuborish" tugmasi ko'rsatadi.<br/>
            Tez tugmalar bo'lsa ham foydalanuvchi o'zi ham yoza oladi.
          </div>
        </div>
      )}

      {/* Saqlash */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <button onClick={save} disabled={saving} style={{ ...sBtn, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saqlanmoqda...' : '💾 Saqlash va Botni Ishga Tushirish'}
        </button>
        <button onClick={loadLog} style={{ ...sBtn, background: '#455a64' }}>
          📋 Oxirgi zayavkalar
        </button>
      </div>
      {msg && (
        <div style={{ background: msg.startsWith('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${msg.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontWeight: 'bold', color: msg.startsWith('✅') ? '#1b5e20' : '#c62828' }}>
          {msg}
        </div>
      )}

      {/* Zayavkalar tarixi */}
      {showLog && (
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 20 }}>
          <h4 style={{ margin: '0 0 12px', color: themeColor }}>Oxirgi 20 ta zayavka</h4>
          {log.length === 0 && <div style={{ color: '#999', fontSize: 13 }}>Hali zayavka yuborilmagan.</div>}
          {log.map((z, i) => (
            <div key={i} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 'bold', color: '#1565c0' }}>#{z.id} — {z.date}</span>
                <span style={{ fontSize: 11, color: '#999' }}>{z.sentAt ? new Date(z.sentAt).toLocaleString('uz-UZ') : ''}</span>
              </div>
              <pre style={{ margin: 0, fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 8, borderRadius: 4, color: '#333' }}>{z.text}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DestinationAdder({ existing, onAdd, themeColor }) {
  const [val, setVal] = useState('');
  const handle = () => {
    const t = val.trim();
    if (!t) return;
    if (existing.includes(t)) { alert('Bu manzil allaqachon mavjud.'); return; }
    onAdd(t);
    setVal('');
  };
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handle()}
        placeholder="Yangi manzil (masalan: Oqqo'rg'on)"
        style={{ flex: 1, padding: '8px 12px', borderRadius: 5, border: '1px solid #ccc', fontSize: 13 }}
      />
      <button onClick={handle}
        style={{ padding: '8px 18px', background: themeColor, color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>
        + Qo'shish
      </button>
    </div>
  );
}

function CementTypeAdder({ addCementType, cementTypes, themeColor }) {
  const [val, setVal] = useState('');
  const handle = () => {
    const t = val.trim();
    if (!t) return;
    if (cementTypes.includes(t)) { alert('Bu tur allaqachon mavjud.'); return; }
    addCementType(t);
    setVal('');
  };
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handle()}
        placeholder="Yangi tur nomi (masalan: 400 Qoplik)"
        style={{ flex: 1, padding: '8px 12px', borderRadius: 5, border: '1px solid #ccc', fontSize: 13 }}
      />
      <button onClick={handle}
        style={{ padding: '8px 18px', background: themeColor, color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>
        + Qo'shish
      </button>
    </div>
  );
}

export default function Settings({ lang }) {
  const {
    workers, updateWorker, deleteWorker, addWorker, appSettings, updateAppSettings,
    customers, importCustomers, importDebts,
    warehouses, addWarehouse, updateWarehouse, deleteWarehouse,
    cementTypes, addCementType, removeCementType,
    driverTariffs, addDriverTariff, removeDriverTariff, renameDriverTariff, addPriceToTariff, removePriceFromTariff,
  } = useData();
  const [tab, setTab] = useState('workers');
  const [newWh, setNewWh] = useState('');

  // ── Excel import: Mijozlar ────────────────────────────────────────────────
  const importCustomersHandler = (rows) => {
    const existing = new Set(customers.map(c => normName(c.name)));
    const clean = [];
    let skipped = 0;
    rows.forEach(r => {
      const name = String(r.name || '').trim();
      if (!name || existing.has(normName(name))) { skipped++; return; }
      existing.add(normName(name));
      clean.push({ name, phone: r.phone, address: r.address, note: r.note });
    });
    importCustomers(clean);
    return { added: clean.length, skipped };
  };

  // ── Excel import: Qarzlar ─────────────────────────────────────────────────
  const importDebtsHandler = (rows) => {
    const clean = [];
    let skipped = 0;
    rows.forEach(r => {
      const customer = String(r.customer || '').trim();
      const amount = parseAmount(r.amount);
      if (!customer || amount <= 0) { skipped++; return; }
      clean.push({ customer, amount, note: r.note, date: r.date });
    });
    importDebts(clean);
    return { added: clean.length, skipped };
  };

  // ── Zaxira (backup) funksiyalari ──────────────────────────────────────────
  const handleExport = async () => {
    try {
      const state = await api.getState();
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `sement-zaxira-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Zaxira olishda xato. Server ishlayotganini tekshiring.");
    }
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm("DIQQAT! Tiklash hozirgi BARCHA ma'lumotni zaxiradagi ma'lumotga almashtiradi. Davom etamizmi?")) {
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        await api.saveState(parsed);
        alert("Ma'lumotlar tiklandi! Dastur yangilanadi.");
        window.location.reload();
      } catch {
        alert("Fayl noto'g'ri yoki buzilgan. Tiklab bo'lmadi.");
      }
    };
    reader.readAsText(file);
  };

  // Xodim qo'shish formasi
  const [newW, setNewW] = useState({ name: '', role: 'sotuvchi', password: '1234', position: '', warehouseId: '' });
  
  // App sozlamalari formasi
  const [appF, setAppF] = useState(appSettings);

  const handleAddWorker = (e) => {
    e.preventDefault();
    if (newW.name) {
      addWorker(newW.name, 0, newW);
      setNewW({ name: '', role: 'sotuvchi', password: '1234', position: '' });
    }
  };

  const handleSaveApp = (e) => {
    e.preventDefault();
    updateAppSettings(appF);
    alert("Saqlandi! Tizim ranglari va nomlari o'zgardi.");
  };

  const inp = { padding: '8px 12px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4, width: '100%', boxSizing: 'border-box' };
  const btn = { padding: '8px 16px', background: appSettings.themeColor, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' };

  return (
    <div style={{ fontFamily: 'Tahoma, sans-serif' }}>
      
      {/* TABS */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '2px solid #eee', marginBottom: 20 }}>
        <button 
          onClick={() => setTab('workers')} 
          style={{ padding: '10px 20px', background: tab === 'workers' ? appSettings.themeColor : 'transparent', color: tab === 'workers' ? '#fff' : '#555', border: 'none', borderRadius: '4px 4px 0 0', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Xodimlar va Rollar
        </button>
        <button 
          onClick={() => setTab('app')} 
          style={{ padding: '10px 20px', background: tab === 'app' ? appSettings.themeColor : 'transparent', color: tab === 'app' ? '#fff' : '#555', border: 'none', borderRadius: '4px 4px 0 0', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Dastur Sozlamalari
        </button>
        <button
          onClick={() => setTab('import')}
          style={{ padding: '10px 20px', background: tab === 'import' ? appSettings.themeColor : 'transparent', color: tab === 'import' ? '#fff' : '#555', border: 'none', borderRadius: '4px 4px 0 0', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Excel Import
        </button>
        <button
          onClick={() => setTab('backup')}
          style={{ padding: '10px 20px', background: tab === 'backup' ? appSettings.themeColor : 'transparent', color: tab === 'backup' ? '#fff' : '#555', border: 'none', borderRadius: '4px 4px 0 0', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Zaxira (Backup)
        </button>
        <button
          onClick={() => setTab('cement')}
          style={{ padding: '10px 20px', background: tab === 'cement' ? appSettings.themeColor : 'transparent', color: tab === 'cement' ? '#fff' : '#555', border: 'none', borderRadius: '4px 4px 0 0', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Sement Turlari
        </button>
        <button
          onClick={() => setTab('tariflar')}
          style={{ padding: '10px 20px', background: tab === 'tariflar' ? appSettings.themeColor : 'transparent', color: tab === 'tariflar' ? '#fff' : '#555', border: 'none', borderRadius: '4px 4px 0 0', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Reys Tariflar
        </button>
        <button
          onClick={() => setTab('zayavka')}
          style={{ padding: '10px 20px', background: tab === 'zayavka' ? appSettings.themeColor : 'transparent', color: tab === 'zayavka' ? '#fff' : '#555', border: 'none', borderRadius: '4px 4px 0 0', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Zayavka Bot
        </button>
      </div>

      {/* EXCEL IMPORT TABI */}
      {tab === 'import' && (
        <div style={{ maxWidth: 760 }}>
          <div style={{ fontSize: 13, color: '#555', background: '#e3f2fd', border: '1px solid #bbdefb', padding: 12, borderRadius: 6, marginBottom: 16, lineHeight: 1.6 }}>
            <strong style={{ color: '#1565c0' }}>MoySklad yoki boshqa joydan ma'lumot ko'chirish:</strong>
            <ol style={{ margin: '6px 0 0 18px', padding: 0 }}>
              <li>Kerakli bo'lim shablonini yuklab oling.</li>
              <li>Excel'da ustunlarga ma'lumotni to'ldiring (sarlavha qatorini o'zgartirmang).</li>
              <li>Faylni qaytadan shu yerga yuklang va "Import qilish"ni bosing.</li>
            </ol>
          </div>

          <ExcelImport
            title="👥 Mijozlar bazasini import qilish"
            color="#00695c"
            sheetName="Mijozlar"
            templateName="mijozlar-shablon.xlsx"
            hint="Bir xil ismli mijoz allaqachon bo'lsa, qayta qo'shilmaydi (o'tkazib yuboriladi)."
            columns={[
              { key: 'name',    header: 'Ism',     aliases: ['nomi', 'mijoz', 'name', 'фио', 'наименование'], required: true },
              { key: 'phone',   header: 'Telefon', aliases: ['tel', 'phone', 'телефон'] },
              { key: 'address', header: 'Manzil',  aliases: ['address', 'adres', 'адрес'] },
              { key: 'note',    header: 'Izoh',    aliases: ['note', 'eslatma', 'комментарий'] },
            ]}
            onImport={importCustomersHandler}
          />

          <ExcelImport
            title="💳 Qarzlar ro'yxatini import qilish"
            color="#c62828"
            sheetName="Qarzlar"
            templateName="qarzlar-shablon.xlsx"
            hint="Summa raqam bo'lishi kerak (masalan: 1500000). Bo'sh yoki noto'g'ri summa o'tkazib yuboriladi."
            columns={[
              { key: 'customer', header: 'Mijoz',        aliases: ['ism', 'name', 'контрагент'], required: true },
              { key: 'amount',   header: 'Qarz summasi', aliases: ['summa', 'qarz', 'amount', 'сумма', 'долг'], required: true },
              { key: 'note',     header: 'Izoh',         aliases: ['note', 'комментарий'] },
              { key: 'date',     header: 'Sana',         aliases: ['date', 'дата'] },
            ]}
            onImport={importDebtsHandler}
          />
        </div>
      )}

      {/* ZAXIRA TABI */}
      {tab === 'backup' && (
        <div style={{ maxWidth: 640 }}>
          <div style={{ background: '#f9f9f9', padding: 24, borderRadius: 8, border: '1px solid #eee' }}>
            <h3 style={{ marginTop: 0, color: appSettings.themeColor }}>Ma'lumotlar zaxirasi</h3>
            <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
              Barcha ma'lumotlar serverda saqlanadi va har soatda avtomatik zaxiralanadi.
              Qo'shimcha xavfsizlik uchun vaqti-vaqti bilan zaxirani faylga yuklab oling
              va USB yoki bulutga (Telegram, Google Drive) saqlab qo'ying.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
              <button onClick={handleExport} style={{ ...btn, padding: '12px 20px' }}>
                ⬇️ Zaxirani yuklab olish (JSON)
              </button>

              <label style={{ ...btn, padding: '12px 20px', background: '#455a64', display: 'inline-block' }}>
                ⬆️ Zaxiradan tiklash (fayldan)
                <input type="file" accept="application/json,.json" onChange={handleImport} style={{ display: 'none' }} />
              </label>
            </div>

            <div style={{ fontSize: 12, color: '#b71c1c', background: '#ffebee', border: '1px solid #ef9a9a', padding: 10, borderRadius: 4, marginTop: 16 }}>
              ⚠️ <strong>Diqqat:</strong> "Tiklash" hozirgi barcha ma'lumotni faylga almashtiradi.
              Faqat ishonchli zaxira fayli bilan ishlating.
            </div>
          </div>
        </div>
      )}

      {/* SEMENT TURLARI TABI */}
      {tab === 'cement' && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ background: '#f9f9f9', padding: 24, borderRadius: 8, border: '1px solid #eee' }}>
            <h3 style={{ marginTop: 0, color: appSettings.themeColor }}>Sement turlari boshqaruvi</h3>
            <p style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>
              Qo'shilgan turlar Kassir va Qabul sahifalarida tanlov sifatida ko'rinadi.
            </p>

            {/* Mavjud turlar ro'yxati */}
            <div style={{ marginBottom: 20 }}>
              {cementTypes.length === 0 && (
                <div style={{ color: '#999', fontSize: 13, fontStyle: 'italic' }}>Hech qanday tur yo'q</div>
              )}
              {cementTypes.map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', marginBottom: 6, background: '#fff', border: '1px solid #ddd', borderRadius: 6 }}>
                  <span style={{ fontWeight: 'bold', color: '#4a148c', fontSize: 14 }}>{t}</span>
                  <button
                    onClick={() => {
                      if (cementTypes.length <= 1) { alert("Kamida bitta tur bo'lishi kerak."); return; }
                      if (window.confirm(`"${t}" turini o'chirasizmi?`)) removeCementType(t);
                    }}
                    style={{ background: 'none', border: 'none', color: '#c62828', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
                    title="O'chirish"
                  >✕</button>
                </div>
              ))}
            </div>

            {/* Yangi tur qo'shish */}
            <CementTypeAdder addCementType={addCementType} cementTypes={cementTypes} themeColor={appSettings.themeColor} />
          </div>
        </div>
      )}

      {/* REYS TARIFLAR TABI */}
      {tab === 'tariflar' && (
        <div style={{ maxWidth: 700 }}>
          <div style={{ background: '#f9f9f9', padding: 24, borderRadius: 8, border: '1px solid #eee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h3 style={{ margin: 0, color: appSettings.themeColor }}>Reys tariflar boshqaruvi</h3>
              <TariffAdder onAdd={addDriverTariff} themeColor={appSettings.themeColor} />
            </div>
            <p style={{ fontSize: 12, color: '#777', marginBottom: 20 }}>
              Har bir tarif haydovchiga tayinlanadi. Bot o'sha tarif narxlarini ko'rsatadi. Manzil haydovchi o'zi erkin yozadi.
            </p>
            {(driverTariffs || []).length === 0 && (
              <div style={{ color: '#999', fontSize: 13, fontStyle: 'italic' }}>Tarif yo'q.</div>
            )}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {(driverTariffs || []).map(tariff => (
                <TariffCard
                  key={tariff.id}
                  tariff={tariff}
                  onRename={(name) => renameDriverTariff(tariff.id, name)}
                  onDelete={() => {
                    if (window.confirm(`"${tariff.name}" tarifini o'chirasizmi?`)) removeDriverTariff(tariff.id);
                  }}
                  onAddPrice={(p) => addPriceToTariff(tariff.id, p)}
                  onRemovePrice={(p) => removePriceFromTariff(tariff.id, p)}
                  themeColor={appSettings.themeColor}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ZAYAVKA BOT TABI */}
      {tab === 'zayavka' && (
        <ZayavkaBotSettings themeColor={appSettings.themeColor} />
      )}

      {/* XODIMLAR TABI */}
      {tab === 'workers' && (
        <>
        {/* ── SKLADLAR (OMBORLAR) BOSHQARUVI ──────────────────────────────── */}
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <h3 style={{ marginTop: 0, color: '#1b5e20' }}>🏬 Skladlar (omborlar)</h3>
          <p style={{ fontSize: 12, color: '#555', margin: '0 0 10px' }}>
            Har bir sklad alohida qoldiqqa ega. Xodimga sklad biriktirsangiz — u kirganda o'z skladi tanlangan bo'ladi.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
            {warehouses.map(w => (
              <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #c8e6c9', borderRadius: 6, padding: '6px 10px' }}>
                <input value={w.name} onChange={e => updateWarehouse(w.id, e.target.value)}
                  style={{ border: '1px solid #ddd', borderRadius: 4, padding: '4px 8px', fontSize: 13, width: 160 }} />
                {warehouses.length > 1 && (
                  <button onClick={() => { if (window.confirm(`"${w.name}" skladini o'chirasizmi? (yozuvlari asosiy skladga o'tadi)`)) deleteWarehouse(w.id); }}
                    style={{ background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: 4, cursor: 'pointer', padding: '4px 8px', fontSize: 12 }}>✕</button>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={newWh} onChange={e => setNewWh(e.target.value)} placeholder="Yangi sklad nomi (masalan: Chakana do'kon)"
              style={{ border: '1px solid #a5d6a7', borderRadius: 4, padding: '7px 10px', fontSize: 13, width: 280 }} />
            <button onClick={() => { if (newWh.trim()) { addWarehouse(newWh.trim()); setNewWh(''); } }}
              style={{ background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '7px 16px', fontWeight: 'bold' }}>
              + Sklad qo'shish
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>

          {/* Yangi qo'shish */}
          <div style={{ background: '#f9f9f9', padding: 20, borderRadius: 8, border: '1px solid #eee', alignSelf: 'start' }}>
            <h3 style={{ marginTop: 0, color: appSettings.themeColor }}>Yangi xodim qo'shish</h3>
            <form onSubmit={handleAddWorker} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Ism (Login nomi)</label>
                <input type="text" value={newW.name} onChange={e => setNewW({...newW, name: e.target.value})} style={inp} required />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Roli (Ruxsatlari)</label>
                <select value={newW.role} onChange={e => setNewW({...newW, role: e.target.value})} style={inp}>
                  <option value="admin">Admin (Hamma joyga ruxsat)</option>
                  <option value="kassir">Kassir (Chek majburiy — kassa sotuvi)</option>
                  <option value="sotuvchi">Sotuvchi (Optom — chek ixtiyoriy)</option>
                  <option value="omborchi">Omborchi (Faqat Ombor va Yuk qabul qilish)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Parol (Kirish uchun)</label>
                <input type="text" value={newW.password} onChange={e => setNewW({...newW, password: e.target.value})} style={inp} required />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Sklad (biriktirilgan ombor)</label>
                <select value={newW.warehouseId} onChange={e => setNewW({...newW, warehouseId: e.target.value})} style={inp}>
                  <option value="">— sklad tanlanmagan —</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Lavozimi (Izoh)</label>
                <input type="text" value={newW.position} onChange={e => setNewW({...newW, position: e.target.value})} style={inp} />
              </div>
              <button type="submit" style={btn}>+ Qo'shish</button>
            </form>
          </div>

          {/* Mavjud xodimlar ro'yxati */}
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ background: appSettings.themeColor, color: '#fff' }}>
                <tr>
                  <th style={{ padding: 12 }}>Ism (Login)</th>
                  <th style={{ padding: 12 }}>Rol</th>
                  <th style={{ padding: 12 }}>Sklad</th>
                  <th style={{ padding: 12 }}>Parol</th>
                  <th style={{ padding: 12 }}>Lavozim</th>
                  <th style={{ padding: 12 }}>Telegram</th>
                  <th style={{ padding: 12 }}>Boshqarish</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w, i) => (
                  <tr key={w.id} style={{ borderBottom: '1px solid #eee', background: i % 2 === 0 ? '#fff' : '#fcfcfc' }}>
                    <td style={{ padding: 12, fontWeight: 'bold' }}>{w.name}</td>
                    <td style={{ padding: 12 }}>
                      <select value={w.role || 'sotuvchi'} onChange={(e) => updateWorker(w.id, { role: e.target.value })} style={{ padding: 4, borderRadius: 4, border: '1px solid #ccc' }}>
                        <option value="admin">Admin</option>
                        <option value="kassir">Kassir</option>
                        <option value="sotuvchi">Sotuvchi (optom)</option>
                        <option value="omborchi">Omborchi</option>
                      </select>
                    </td>
                    <td style={{ padding: 12 }}>
                      <select value={w.warehouseId || ''} onChange={(e) => updateWorker(w.id, { warehouseId: e.target.value })} style={{ padding: 4, borderRadius: 4, border: '1px solid #ccc' }}>
                        <option value="">— yo'q —</option>
                        {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: 12 }}>
                      <PasswordCell workerId={w.id} onSave={(newPwd) => updateWorker(w.id, { password: newPwd })} />
                    </td>
                    <td style={{ padding: 12, fontSize: 13, color: '#555' }}>{w.position || '—'}</td>
                    <td style={{ padding: '8px 12px', minWidth: 160 }}>
                      {w.linkCode ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {w.telegramChatId
                              ? <span style={{ fontSize: 11, background: '#e8f5e9', color: '#2e7d32', padding: '1px 6px', borderRadius: 10, border: '1px solid #a5d6a7' }}>✓ Ulangan</span>
                              : <span style={{ fontSize: 11, background: '#fff3e0', color: '#e65100', padding: '1px 6px', borderRadius: 10, border: '1px solid #ffcc80' }}>Ulanmagan</span>
                            }
                          </div>
                          <button
                            onClick={() => { navigator.clipboard.writeText(`https://t.me/sementchiuzbot?start=${w.linkCode}`); alert('Havola nusxalandi!'); }}
                            style={{ fontSize: 11, padding: '2px 8px', cursor: 'pointer', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 4, color: '#0d47a1' }}>
                            🔗 Havola nusxalash
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => updateWorker(w.id, { linkCode: Math.random().toString(36).slice(2,10).toUpperCase() })}
                          style={{ fontSize: 11, padding: '3px 10px', cursor: 'pointer', background: '#f3e5f5', border: '1px solid #ce93d8', borderRadius: 4, color: '#6a1b9a' }}>
                          + Havola yaratish
                        </button>
                      )}
                    </td>
                    <td style={{ padding: 12 }}>
                      <button onClick={() => { if(window.confirm("Rostdan ham o'chirasizmi?")) deleteWorker(w.id) }} style={{ background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: 4, cursor: 'pointer', padding: '4px 8px' }}>
                        O'chirish
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: 12, fontSize: 12, color: '#666', background: '#fff9c4' }}>
              ℹ️ Izoh: Rolni yoki parolni o'zgartirganingiz zahoti saqlanadi. Xodim yangi paroli bilan kirishi kerak bo'ladi.
            </div>
          </div>

        </div>
        </>
      )}

      {/* APP SOZLAMALARI TABI */}
      {tab === 'app' && (
        <div style={{ maxWidth: 600 }}>
          <form onSubmit={handleSaveApp} style={{ background: '#f9f9f9', padding: 24, borderRadius: 8, border: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 'bold', color: '#444', marginBottom: 6, display: 'block' }}>Dastur nomi (Tepada chiqadigan yozuv)</label>
              <input type="text" value={appF.appName} onChange={e => setAppF({...appF, appName: e.target.value})} style={inp} />
            </div>
            
            <div>
              <label style={{ fontSize: 13, fontWeight: 'bold', color: '#444', marginBottom: 6, display: 'block' }}>Dastur Asosiy Rangi (Theme Color)</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="color" value={appF.themeColor} onChange={e => setAppF({...appF, themeColor: e.target.value})} style={{ width: 50, height: 40, cursor: 'pointer' }} />
                <span style={{ fontFamily: 'monospace' }}>{appF.themeColor}</span>
              </div>
            </div>

            {/* Chek (sotuv cheki) uchun ma'lumotlar */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 'bold', color: '#1565c0', marginBottom: 8 }}>🧾 Chekda chiqadigan korxona ma'lumotlari</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#555', marginBottom: 4, display: 'block' }}>Korxona telefoni (chek tepasida)</label>
                  <input type="text" placeholder="+998 90 000 00 00" value={appF.companyPhone || ''} onChange={e => setAppF({...appF, companyPhone: e.target.value})} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#555', marginBottom: 4, display: 'block' }}>Korxona manzili (chek tepasida)</label>
                  <input type="text" placeholder="Shahar, ko'cha..." value={appF.companyAddress || ''} onChange={e => setAppF({...appF, companyAddress: e.target.value})} style={inp} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#444', cursor: 'pointer', background: '#fff', border: '1px solid #c5e1a5', borderRadius: 6, padding: '8px 10px' }}>
                  <input type="checkbox" checked={appF.autoPrintReceipt !== false} onChange={e => setAppF({...appF, autoPrintReceipt: e.target.checked})} />
                  <span><b>Sotuvdan keyin chek avtomatik chiqsin</b><br/><span style={{ fontSize: 11, color: '#777' }}>Kassa sotuvida har bir sotuvdan so'ng chek darrov chop etiladi (majburiy rejim).</span></span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#444', cursor: 'pointer', background: '#fff', border: '1px solid #ffcdd2', borderRadius: 6, padding: '8px 10px' }}>
                  <input type="checkbox" checked={!!appF.allowBulkDelete} onChange={e => setAppF({...appF, allowBulkDelete: e.target.checked})} />
                  <span><b>Ommaviy o'chirishga ruxsat (Olingan tonna)</b><br/><span style={{ fontSize: 11, color: '#777' }}>Yoqilganda "Olingan tonna" sahifasida bir nechta yozuvni belgilab o'chirish tugmasi paydo bo'ladi.</span></span>
                </label>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 'bold', color: '#444', marginBottom: 6, display: 'block' }}>Telegram Bot</label>
              <div style={{ fontSize: 12, color: '#666', background: '#e3f2fd', padding: 10, borderRadius: 4, border: '1px solid #bbdefb' }}>
                <strong style={{ color: '#1565c0' }}>Bot endi serverda (backend) boshqariladi.</strong>
                <p style={{ margin: '6px 0' }}>
                  Xavfsizlik uchun bot tokeni brauzerda emas, balki serverda — <code>backend/.env</code> faylida saqlanadi.
                  Botni ulash uchun:
                </p>
                <ol style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  <li>Telegramda <strong>@BotFather</strong> ni toping, <code>/newbot</code> ni bosing va token oling.</li>
                  <li><code>backend/.env</code> faylida <code>TELEGRAM_BOT_TOKEN=...</code> qatoriga tokenni yozing.</li>
                  <li>Backend serverini qayta ishga tushiring.</li>
                  <li>Endi botga yozilgan zakazlar avtomatik <strong>Telegram zakaz</strong> bo'limiga tushadi (ovozli signal bilan).</li>
                </ol>
              </div>
            </div>

            {/* Mijozga xabar yuborish — qo'llanma */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 'bold', color: '#444', marginBottom: 6, display: 'block' }}>📨 Mijozga xabar yuborish (Telegram / SMS)</label>
              <div style={{ fontSize: 12, color: '#666', background: '#f1f8e9', padding: 10, borderRadius: 4, border: '1px solid #c5e1a5' }}>
                <p style={{ margin: '0 0 6px' }}><strong style={{ color: '#2e7d32' }}>📱 Telegram (bepul):</strong> Mijoz botingizga kirib <code>/ulash</code> yozadi va "📱 Raqamni ulashish" tugmasini bosadi. Shundan so'ng uning kartochkasida "Telegram ulangan ✓" chiqadi va siz kompyuterdan xabar yuborasiz.</p>
                <p style={{ margin: '0 0 6px' }}><strong style={{ color: '#1565c0' }}>✉️ SMS (Eskiz.uz):</strong> <code>backend/.env</code> fayliga <code>ESKIZ_EMAIL</code>, <code>ESKIZ_PASSWORD</code> va <code>ESKIZ_FROM</code> (tasdiqlangan nom) yozing va backendni qayta ishga tushiring. SMS pullik — Eskiz balansingizdan yechiladi.</p>
                <p style={{ margin: 0 }}><strong style={{ color: '#6a1b9a' }}>📞 Qo'ng'iroq:</strong> Mijoz telefoni yonidagi 📞 tugmasi (mobil/planshetda) dialerni ochadi.</p>
                <p style={{ margin: '6px 0 0', fontStyle: 'italic' }}>Xabar yuborish: mijoz kartochkasi, "Sotish" yoki "Qarzlar" sahifasidagi ✉️ tugmasi orqali.</p>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px dashed #ccc', margin: '10px 0' }} />

            <button type="submit" style={{ ...btn, padding: '12px', fontSize: 16 }}>💾 Saqlash va Qo'llash</button>
          </form>
        </div>
      )}

    </div>
  );
}
