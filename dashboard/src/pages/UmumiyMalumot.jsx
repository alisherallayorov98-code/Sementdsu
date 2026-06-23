import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import CashBal   from './CashBal';
import BankBal   from './BankBal';
import ClickBal  from './ClickBal';
import CementBal from './CementBal';
import DailyWork from './DailyWork';

// "Umumiy ma'lumot" — bitta sahifa. Ichidagi bo'limlar chap ustunda turadi,
// qaysi biri bosilsa — o'sha bo'lim shu yerda (o'ngda) ochiladi.
// (Bu bo'limlar endi asosiy chap menyuda alohida ko'rinmaydi.)
const TABS = [
  { key: 'cash',   latn: "Naqd pul qoldig'i", cyrl: "Нақд пул қолдиғи", color: '#1565c0', roles: ['admin', 'sotuvchi'] },
  { key: 'bank',   latn: "Bank qoldig'i",     cyrl: "Банк қолдиғи",     color: '#0d47a1', roles: ['admin', 'sotuvchi'] },
  { key: 'click',  latn: "Click qoldig'i",    cyrl: "Клик қолдиғи",     color: '#6a1b9a', roles: ['admin', 'sotuvchi'] },
  { key: 'cement', latn: "Sement qoldig'i",   cyrl: "Цемент қолдиғи",   color: '#e65100', roles: ['admin', 'omborchi', 'sotuvchi'] },
  { key: 'daily',  latn: "Kunlik ish",        cyrl: "Кунлик иш",        color: '#00695c', roles: ['admin'] },
];

export default function UmumiyMalumot({ lang = 'latn' }) {
  const { currentUser } = useData();
  const role = currentUser?.role === 'kassir' ? 'sotuvchi' : currentUser?.role;

  // Rolga ruxsat berilgan bo'limlar
  const tabs = TABS.filter(t => t.roles.includes(role));

  // Bosh sahifadagi kartochkalardan kelganda — kerakli bo'limni ochish (?tab=...)
  const [sp] = useSearchParams();
  const wanted = sp.get('tab');
  const allowed = (k) => tabs.some(t => t.key === k);
  const [active, setActive] = useState(() => (allowed(wanted) ? wanted : (tabs[0]?.key || 'cash')));
  useEffect(() => {
    if (allowed(wanted)) setActive(wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);

  const render = () => {
    switch (active) {
      case 'cash':   return <CashBal   lang={lang} />;
      case 'bank':   return <BankBal   lang={lang} />;
      case 'click':  return <ClickBal  lang={lang} />;
      case 'cement': return <CementBal lang={lang} />;
      case 'daily':  return <DailyWork lang={lang} />;
      default:       return null;
    }
  };

  if (tabs.length === 0) {
    return <p style={{ color: '#888', fontStyle: 'italic' }}>Ruxsat etilgan bo'lim yo'q.</p>;
  }

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', fontFamily: 'Tahoma, Verdana, Arial, sans-serif' }}>

      {/* ── Chap ustun: bo'limlar ro'yxati ── */}
      <div style={{
        flex: '0 0 200px', background: '#fff', border: '1px solid #e3e6ea',
        borderRadius: 6, overflow: 'hidden',
      }}>
        <div style={{ background: '#f7f8fa', borderBottom: '1px solid #e3e6ea', padding: '8px 12px', fontWeight: 'bold', fontSize: 13, color: '#555' }}>
          Bo'limlar
        </div>
        {tabs.map(t => {
          const on = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                padding: '10px 12px', fontSize: 13, fontFamily: 'Tahoma, sans-serif',
                background: on ? '#e8eef6' : '#fff',
                borderLeft: `3px solid ${on ? t.color : 'transparent'}`,
                borderBottom: '1px solid #f0f1f3', borderTop: 'none', borderRight: 'none',
                color: on ? t.color : '#333', fontWeight: on ? 'bold' : 'normal',
              }}
            >
              {t[lang === 'cyrl' ? 'cyrl' : 'latn']}
            </button>
          );
        })}
      </div>

      {/* ── O'ng: tanlangan bo'lim ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {render()}
      </div>
    </div>
  );
}
