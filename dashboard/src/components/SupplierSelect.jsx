/**
 * SupplierSelect — yetkazib beruvchi (manbaa/zavod) uchun autocomplete.
 * CustomerSelect bilan bir xil mantiq, lekin yetkazib beruvchilar bazasi bo'yicha.
 *
 * Props:
 *   value      : string
 *   onChange   : (name) => void
 *   placeholder: string
 *   width      : number | string (default 160)
 *   required   : bool
 *   accentColor: string (default '#00695c')
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../context/DataContext';

export default function SupplierSelect({
  value = '',
  onChange,
  placeholder = 'Manbaa (zavod)',
  style = {},
  width = 160,
  required = false,
  accentColor = '#00695c',
}) {
  const { suppliers, supplierList, addSupplier } = useData();

  const [open,  setOpen]  = useState(false);
  const [modal, setModal] = useState(false);
  const [newSup, setNewSup] = useState({ name: '', phone: '', note: '' });

  // Nom → telefon (saqlangan yetkazib beruvchilardan)
  const phoneOf = (name) => suppliers.find(s => s.name === name)?.phone || '';

  const query = value.trim();
  const suggestions = query.length >= 2
    ? supplierList.filter(n => n.toLowerCase().includes(query.toLowerCase())).slice(0, 12)
    : [];
  const exactMatch = supplierList.some(n => n.trim().toLowerCase() === query.toLowerCase());
  const isNewName  = query.length >= 2 && !exactMatch;

  const select = (name) => { onChange(name); setOpen(false); };

  const handleNewSup = (e) => {
    e.preventDefault();
    if (!newSup.name) return;
    const phone = newSup.phone.trim() === '+998' ? '' : newSup.phone.trim();
    addSupplier({ ...newSup, phone });
    onChange(newSup.name);
    setNewSup({ name: '', phone: '+998 ', note: '' });
    setModal(false);
  };

  const openModal = () => {
    setNewSup({ name: value, phone: '+998 ', note: '' });
    setOpen(false);
    setModal(true);
  };

  const inputStyle = {
    padding: '3px 6px', fontFamily: 'Tahoma, sans-serif', fontSize: 12,
    border: '2px inset #ffffff', width, ...style,
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <input
            value={value}
            onChange={e => { onChange(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={placeholder}
            style={inputStyle}
            required={required}
            autoComplete="off"
          />

          {open && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 500,
              background: '#fff', border: '1px solid #aaa', borderRadius: 3,
              minWidth: 230, maxHeight: 200, overflowY: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}>
              {suggestions.length > 0 ? (
                suggestions.map(n => (
                  <div
                    key={n}
                    onMouseDown={() => select(n)}
                    style={{
                      padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#e0f2f1'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  >
                    <b style={{ color: accentColor, fontSize: 13 }}>🏭 {n}</b>
                    {phoneOf(n) && <span style={{ color: '#555', fontSize: 10 }}>📞 {phoneOf(n)}</span>}
                  </div>
                ))
              ) : (
                <div style={{ padding: '8px 10px', color: '#aaa', fontSize: 12, fontStyle: 'italic' }}>
                  {query.length < 2 ? 'Izlash uchun kamida 2 ta harf yozing…' : 'Topilmadi'}
                </div>
              )}

              <div
                onMouseDown={openModal}
                style={{
                  padding: '6px 10px', cursor: 'pointer',
                  background: '#e0f2f1', borderTop: '1px solid #b2dfdb',
                  color: accentColor, fontWeight: 'bold', fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#b2dfdb'}
                onMouseLeave={e => e.currentTarget.style.background = '#e0f2f1'}
              >
                <span style={{ fontSize: 16 }}>+</span>
                {isNewName ? <>"{query}" ni yetkazib beruvchi sifatida saqlash</> : 'Yangi yetkazib beruvchi'}
              </div>
            </div>
          )}

          {isNewName && !open && (
            <button
              type="button"
              onClick={openModal}
              style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 2, zIndex: 400,
                padding: '4px 10px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer',
                background: '#e0f2f1', color: accentColor, border: `1px solid ${accentColor}`,
                borderRadius: 4, whiteSpace: 'nowrap',
              }}
            >
              💾 "{query}" ni saqlash
            </button>
          )}
        </div>

        <button
          type="button"
          title="Yangi yetkazib beruvchi qo'shish"
          onClick={openModal}
          style={{
            padding: '3px 7px', fontSize: 14, fontWeight: 'bold',
            background: accentColor, color: '#fff', border: 'none',
            cursor: 'pointer', borderRadius: 2, lineHeight: 1,
          }}
        >+</button>
      </div>

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
            style={{ background: '#fff', borderRadius: 6, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.3)', minWidth: 340, maxWidth: 400 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontWeight: 'bold', fontSize: 15, color: accentColor, marginBottom: 16 }}>
              🏭 Yangi yetkazib beruvchi qo'shish
            </div>
            <form onSubmit={handleNewSup}>
              {[
                { key: 'name',  label: 'Nomi *',   ph: 'Zavod / yetkazib beruvchi nomi', req: true },
                { key: 'phone', label: 'Telefon',  ph: '+998 90 000 00 00',              req: false, mode: 'tel' },
                { key: 'note',  label: 'Izoh',     ph: "Qo'shimcha ma'lumot",            req: false },
              ].map(({ key, label, ph, req, mode }) => (
                <div key={key} style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 3 }}>{label}</label>
                  <input
                    placeholder={ph}
                    value={newSup[key]}
                    onChange={e => setNewSup({ ...newSup, [key]: e.target.value })}
                    required={req}
                    inputMode={mode}
                    autoFocus={key === 'name'}
                    style={{ width: '100%', padding: '6px 8px', fontSize: 13, border: '1px solid #ccc', borderRadius: 3, boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button type="submit" style={{ flex: 1, padding: '7px 0', fontWeight: 'bold', fontSize: 13, background: accentColor, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                  ✓ Saqlash
                </button>
                <button type="button" onClick={() => setModal(false)} style={{ flex: 1, padding: '7px 0', fontSize: 13, background: '#ffebee', border: '1px solid #e53935', borderRadius: 4, cursor: 'pointer', color: '#c62828' }}>
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
