/**
 * CustomerSelect — qayta ishlatiladigan mijoz autocomplete komponenti
 *
 * Props:
 *   value      : string           — joriy matn qiymati
 *   onChange   : (name) => void   — qiymat o'zgarganda
 *   placeholder: string
 *   style      : object           — input uchun qo'shimcha stil
 *   width      : number | string  — input kengligi (default 160)
 *   required   : bool
 *   accentColor: string           — highlight rangi (default '#283593')
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../context/DataContext';

export default function CustomerSelect({
  value = '',
  onChange,
  placeholder = 'Mijoz',
  style = {},
  width = 160,
  required = false,
  accentColor = '#283593',
  inputId,
}) {
  const { customers, addCustomer, drivers = [], workers = [] } = useData();

  const [open,    setOpen]    = useState(false);
  const [modal,   setModal]   = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', address: '', note: '' });

  // ── Suggestion hisoblash ─────────────────────────────────────────────────
  const query = value.trim();

  const allEntries = query.length >= 2 ? [
    ...customers.filter(c =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      (c.phone || '').includes(query)
    ).slice(0, 8).map(c => ({ key: 'c' + c.id, name: c.name, sub: c.phone || '', badge: '👤', badgeColor: '#1565c0' })),

    ...drivers.filter(d =>
      d.name.toLowerCase().includes(query.toLowerCase()) ||
      (d.carNumber || '').toLowerCase().includes(query.toLowerCase()) ||
      (d.phone || '').includes(query)
    ).slice(0, 4).map(d => ({ key: 'd' + d.id, name: d.name, sub: d.carNumber || d.phone || '', badge: '🚚', badgeColor: '#4e342e' })),

    ...workers.filter(w =>
      w.name.toLowerCase().includes(query.toLowerCase()) ||
      (w.phone || '').includes(query)
    ).slice(0, 4).map(w => ({ key: 'w' + w.id, name: w.name, sub: w.role || w.phone || '', badge: '👷', badgeColor: '#e65100' })),
  ] : [];

  const suggestions = allEntries;

  // Yozilgan nom bazada bormi?
  const allNames = [...customers, ...drivers, ...workers];
  const exactMatch = allNames.some(x => x.name.trim().toLowerCase() === query.toLowerCase());
  const isNewName  = query.length >= 2 && !exactMatch;

  const highlight = (text, q) => {
    if (!q || q.length < 2) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: '#fff176', padding: 0 }}>{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  const select = (name) => {
    onChange(name);
    setOpen(false);
  };

  const handleNewCust = (e) => {
    e.preventDefault();
    if (!newCust.name) return;
    // Faqat "+998" qolgan bo'lsa (raqam kiritilmagan) — bo'sh deb saqlaymiz
    const phone = newCust.phone.trim() === '+998' ? '' : newCust.phone.trim();
    addCustomer({ ...newCust, phone });
    onChange(newCust.name);
    setNewCust({ name: '', phone: '+998 ', address: '', note: '' });
    setModal(false);
  };

  const openModal = () => {
    // Telefon avtomatik +998 bilan boshlanadi (har savdoda vaqt tejaydi).
    // Boshqa davlat raqami uchun foydalanuvchi +998 ni o'chirib tashlashi mumkin.
    setNewCust({ name: value, phone: '+998 ', address: '', note: '' });
    setOpen(false);
    setModal(true);
  };

  const inputStyle = {
    padding: '3px 6px',
    fontFamily: 'Tahoma, sans-serif',
    fontSize: 12,
    border: '2px inset #ffffff',
    width,
    ...style,
  };

  return (
    <>
      {/* ── Input + "+" tugmasi ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <input
            id={inputId}
            value={value}
            onChange={e => { onChange(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={placeholder}
            style={inputStyle}
            required={required}
            autoComplete="off"
          />

          {/* ── Dropdown ──────────────────────────────────────────────────── */}
          {open && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 500,
              background: '#fff', border: '1px solid #aaa',
              borderRadius: 3, minWidth: 230,
              maxHeight: 200, overflowY: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}>
              {/* Qidiruv natijalari */}
              {suggestions.length > 0 ? (
                suggestions.map(entry => (
                  <div
                    key={entry.key}
                    onMouseDown={() => select(entry.name)}
                    style={{
                      padding: '5px 10px', cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 14 }}>{entry.badge}</span>
                      <b style={{ color: entry.badgeColor, fontSize: 13 }}>
                        {highlight(entry.name, query)}
                      </b>
                    </span>
                    {entry.sub && (
                      <span style={{ color: '#888', fontSize: 10, marginLeft: 8, whiteSpace: 'nowrap' }}>
                        {entry.sub}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ padding: '8px 10px', color: '#aaa', fontSize: 12, fontStyle: 'italic' }}>
                  {query.length < 2 ? 'Izlash uchun kamida 2 ta harf yozing…' : 'Topilmadi'}
                </div>
              )}

              {/* Divider + yangi qo'shish (yozilgan nom bilan) */}
              <div
                onMouseDown={openModal}
                style={{
                  padding: '6px 10px', cursor: 'pointer',
                  background: '#e8eaf6', borderTop: '1px solid #c5cae9',
                  color: accentColor, fontWeight: 'bold', fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#c5cae9'}
                onMouseLeave={e => e.currentTarget.style.background = '#e8eaf6'}
              >
                <span style={{ fontSize: 16 }}>+</span>
                {isNewName ? <>"{query}" ni yangi mijoz sifatida saqlash</> : "Yangi mijoz qo'shish"}
              </div>
            </div>
          )}

          {/* ── Inline saqlash tugmasi (yangi nom yozilganda pastdan chiqadi) ── */}
          {isNewName && !open && (
            <button
              type="button"
              onClick={openModal}
              style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 2, zIndex: 400,
                padding: '4px 10px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer',
                background: '#e8f5e9', color: '#1b5e20', border: '1px solid #2e7d32',
                borderRadius: 4, whiteSpace: 'nowrap',
              }}
            >
              💾 "{query}" ni saqlash
            </button>
          )}
        </div>

        {/* ── "+" tugmasi (tashqaridagi) ──────────────────────────────────── */}
        <button
          type="button"
          title="Yangi mijoz qo'shish"
          onClick={openModal}
          style={{
            padding: '3px 7px', fontSize: 14, fontWeight: 'bold',
            background: accentColor, color: '#fff',
            border: 'none', cursor: 'pointer', borderRadius: 2,
            lineHeight: 1,
          }}
        >+</button>
      </div>

      {/* ── Yangi mijoz modali (Portal orqali — forma ichma-ich bo'lmasligi uchun) ── */}
      {modal && createPortal(
        <div
          style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.45)', zIndex: 9000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setModal(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 6, padding: 24,
              boxShadow: '0 4px 24px rgba(0,0,0,0.3)', minWidth: 340, maxWidth: 400,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              fontWeight: 'bold', fontSize: 15, color: accentColor,
              marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              👤 Yangi mijoz qo'shish
            </div>

            <form onSubmit={handleNewCust}>
              {[
                { key: 'name',    label: 'Ism *',    ph: 'Mijoz ismi yoki korxona nomi', req: true  },
                { key: 'phone',   label: 'Telefon',  ph: '+998 90 000 00 00',             req: false, mode: 'tel' },
                { key: 'address', label: 'Manzil',   ph: "Shahar, ko'cha, uy",            req: false },
                { key: 'note',    label: 'Izoh',     ph: "Qo'shimcha ma'lumot",           req: false },
              ].map(({ key, label, ph, req, mode }) => (
                <div key={key} style={{ marginBottom: 10 }}>
                  <label style={{
                    display: 'block', fontSize: 11,
                    fontWeight: 'bold', color: '#555', marginBottom: 3,
                  }}>
                    {label}
                  </label>
                  <input
                    placeholder={ph}
                    value={newCust[key]}
                    onChange={e => setNewCust({ ...newCust, [key]: e.target.value })}
                    required={req}
                    inputMode={mode}
                    autoFocus={key === 'name'}
                    style={{
                      width: '100%', padding: '6px 8px', fontSize: 13,
                      border: '1px solid #ccc', borderRadius: 3,
                      boxSizing: 'border-box',
                      outline: req && !newCust[key] ? '1px solid #e53935' : undefined,
                    }}
                  />
                </div>
              ))}

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button
                  type="submit"
                  style={{
                    flex: 1, padding: '7px 0', fontWeight: 'bold', fontSize: 13,
                    background: accentColor, color: '#fff',
                    border: 'none', borderRadius: 4, cursor: 'pointer',
                  }}
                >
                  ✓ Saqlash
                </button>
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  style={{
                    flex: 1, padding: '7px 0', fontSize: 13,
                    background: '#ffebee', border: '1px solid #e53935',
                    borderRadius: 4, cursor: 'pointer', color: '#c62828',
                  }}
                >
                  ✕ Bekor
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
