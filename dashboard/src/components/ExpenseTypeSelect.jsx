// ─────────────────────────────────────────────────────────────────────────────
// ExpenseTypeSelect — "Xarajat turi" avtoto'ldirish maydoni.
//
// MAQSAD: har bir mayda xarajatni alohida "mijoz" sifatida saqlash o'rniga,
// bitta guruh mijoz (masalan "Ishxona xarajatlari") tanlanganda, uning ostidan
// xarajat TURINI yozish (masalan "571 moshin moykasi", "ovqatlanish", "taksi").
//
// TAKLIFLAR: alohida ro'yxat SAQLANMAYDI — takliflar shu guruh bo'yicha ilgari
// kiritilgan yozuvlardan avtomatik yig'iladi. Ya'ni turni bir marta yozsangiz,
// keyingi safar ro'yxatda chiqadi ("bir marta kiritib qo'yadi"). Qat'iy nomlar
// yo'q — foydalanuvchi o'zi xohlagancha nomlaydi.
//
// Bu maydon faqat MATN — hech qanday pul/hisobga ta'sir qilmaydi, faqat
// xarajatni turkumlab, keyin hisobot chiqarish uchun.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';

export default function ExpenseTypeSelect({
  group,                    // tanlangan guruh mijoz nomi (shu bo'yicha filtrlanadi)
  value = '',
  onChange,
  placeholder = 'Xarajat turi (masalan: moyka, taksi, remont...)',
  width = 260,
  accentColor = '#c62828',
}) {
  const { cashRows = [], bankRows = [], clickRows = [] } = useData();
  const [open, setOpen] = useState(false);

  // Shu guruh bo'yicha ilgari ishlatilgan xarajat turlarini yig'amiz.
  // Har bir tur uchun necha marta ishlatilganini ham hisoblab, ko'p
  // ishlatilganini yuqoriga chiqaramiz.
  const knownTypes = useMemo(() => {
    const g = String(group || '').trim().toLowerCase();
    const freq = {};
    [...cashRows, ...bankRows, ...clickRows].forEach(r => {
      if (!r.expenseType) return;
      if (g && String(r.customer || '').trim().toLowerCase() !== g) return;
      const t = String(r.expenseType).trim();
      if (!t) return;
      freq[t] = (freq[t] || 0) + 1;
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }, [cashRows, bankRows, clickRows, group]);

  const query = value.trim().toLowerCase();
  const matches = query
    ? knownTypes.filter(t => t.name.toLowerCase().includes(query))
    : knownTypes;
  const exact = knownTypes.some(t => t.name.toLowerCase() === query);

  const inputStyle = {
    padding: '6px 10px', fontSize: 13, border: `1px solid ${accentColor}55`,
    borderRadius: 4, fontFamily: 'Tahoma, sans-serif', width, boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder}
        style={inputStyle}
        autoComplete="off"
      />
      {open && (matches.length > 0 || (query && !exact)) && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 500, marginTop: 2,
          background: '#fff', border: '1px solid #aaa', borderRadius: 4,
          minWidth: width, maxHeight: 220, overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
        }}>
          {matches.length > 0 ? (
            matches.map(t => (
              <div
                key={t.name}
                onMouseDown={() => { onChange(t.name); setOpen(false); }}
                style={{
                  padding: '6px 10px', cursor: 'pointer', fontSize: 13,
                  borderBottom: '1px solid #f0f0f0', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center', gap: 10,
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#fff5f5'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <span>{t.name}</span>
                <span style={{ color: '#aaa', fontSize: 10, whiteSpace: 'nowrap' }}>{t.count} marta</span>
              </div>
            ))
          ) : (
            <div style={{ padding: '7px 10px', color: '#999', fontSize: 12, fontStyle: 'italic' }}>
              Bu guruhda hali tur yo'q
            </div>
          )}
          {/* Yangi tur — shunchaki yozib qoldiring, alohida saqlash shart emas */}
          {query && !exact && (
            <div style={{
              padding: '7px 10px', background: '#fdecea', borderTop: '1px solid #f5c6cb',
              color: accentColor, fontSize: 12, fontWeight: 'bold',
            }}>
              ✓ "{value.trim()}" — yangi tur (yozib chiqim qilsangiz saqlanadi)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
