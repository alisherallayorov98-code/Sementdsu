// ─────────────────────────────────────────────────────────────────────────────
// SANANI OMMAVIY TO'G'RILASH — import paytida noto'g'ri sana qo'yilganda.
//
// NEGA KERAK: qarz/avans importida bitta sana butun faylga qo'yiladi. Xato
// yozilsa (masalan 06.07.2026 o'rniga 06.08.2026), yuzlab qatorni bittalab
// tahrirlash amalda imkonsiz. Boshqa yo'l — hammasini o'chirib qayta import
// qilish, lekin unda mijozlar bazasiga qo'shilgan yangi mijozlar va
// qilingan to'lovlar ham ketardi.
//
// XAVFSIZLIK:
//   · avval nechta yozuv topilgani KO'RSATILADI, keyin tasdiq so'raladi;
//   · faqat qator sanasi o'zgaradi — to'lovlar (payments) va sarflar
//     (usages) o'z sanasida qoladi, chunki ular haqiqatan o'sha kunlarda
//     bo'lgan;
//   · import qilingan qarz/avans kassaga yozuv yaratmaydi, shuning uchun
//     bog'lanishni qayta tiklash shart emas;
//   · o'zgarish nazorat jurnaliga tushadi (sana o'zgarishi — yuqori xavf).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useData } from '../context/DataContext';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');

// "kk.oo.yyyy" tekshiruvi
const validDate = (s) => {
  const p = String(s || '').split('.');
  if (p.length !== 3) return false;
  const [d, m, y] = p.map(Number);
  return d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2999;
};

const SCOPES = [
  { v: 'debt',    label: '💰 Qarzlar' },
  { v: 'advance', label: '🔄 Avanslar' },
  { v: 'both',    label: 'Ikkalasi' },
];

export default function DateFixTool({ themeColor = '#003366' }) {
  const { debtRows, advanceRows, fixRowDates } = useData();
  const [scope, setScope] = useState('both');
  const [from, setFrom]   = useState('');
  const [to, setTo]       = useState('');
  const [msg, setMsg]     = useState('');

  const wantDebt = scope === 'debt' || scope === 'both';
  const wantAdv  = scope === 'advance' || scope === 'both';

  // Nechta yozuv topildi — foydalanuvchi bosishdan OLDIN ko'rsin
  const hitDebt = wantDebt && validDate(from) ? debtRows.filter(r => r.date === from) : [];
  const hitAdv  = wantAdv  && validDate(from) ? advanceRows.filter(r => r.date === from) : [];
  const total   = hitDebt.length + hitAdv.length;
  const sumDebt = hitDebt.reduce((s, r) => s + Number(r.amount || 0), 0);
  const sumAdv  = hitAdv.reduce((s, r) => s + Number(r.amount || 0), 0);

  const apply = () => {
    setMsg('');
    if (!validDate(from) || !validDate(to)) {
      alert("Sana \"kk.oo.yyyy\" ko'rinishida bo'lishi kerak. Masalan: 06.08.2026");
      return;
    }
    if (from === to) { alert("Eski va yangi sana bir xil."); return; }
    if (!total) { alert(`${from} sanasida bunday yozuv topilmadi.`); return; }

    const parts = [];
    if (hitDebt.length) parts.push(`Qarzlar: ${hitDebt.length} ta (${fmt(sumDebt)} so'm)`);
    if (hitAdv.length)  parts.push(`Avanslar: ${hitAdv.length} ta (${fmt(sumAdv)} so'm)`);

    if (!window.confirm(
      `Sana o'zgartirilsinmi?\n\n${from}  →  ${to}\n\n${parts.join('\n')}\n\n` +
      `To'lovlar va sarflar o'z sanasida qoladi.\n` +
      `Bu o'zgarish nazorat jurnaliga yoziladi.`
    )) return;

    const res = fixRowDates({ scope, from, to });
    setMsg(`✓ Tuzatildi — qarzlar: ${res.debts} ta, avanslar: ${res.advances} ta`);
    setFrom(''); setTo('');
  };

  const inp = { padding: '8px 10px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4, width: 130, fontFamily: 'monospace' };
  const box = { background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: 20, marginBottom: 16 };

  return (
    <div style={box}>
      <h3 style={{ marginTop: 0, color: '#e65100', fontSize: 15 }}>🛠 Sanani ommaviy to'g'rilash</h3>
      <p style={{ fontSize: 12.5, color: '#555', lineHeight: 1.7, marginTop: 0 }}>
        Import paytida sana xato qo'yilgan bo'lsa shu yerdan tuzatiladi.
        Bitta sanadagi <b>hamma</b> qarz/avans yozuvi yangi sanaga o'tadi.
        To'lovlar va sarflar o'z sanasida qoladi.
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {SCOPES.map(s => (
          <button key={s.v} onClick={() => setScope(s.v)}
            style={{
              padding: '6px 14px', cursor: 'pointer', borderRadius: 5, fontSize: 12.5,
              border: `2px solid ${scope === s.v ? themeColor : '#ccc'}`,
              background: scope === s.v ? themeColor : '#fff',
              color: scope === s.v ? '#fff' : '#555',
              fontWeight: scope === s.v ? 'bold' : 'normal',
            }}>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 3 }}>Xato sana (hozirgi)</div>
          <input value={from} onChange={e => setFrom(e.target.value)} placeholder="06.07.2026" style={inp} />
        </div>
        <div style={{ fontSize: 18, color: '#888', paddingBottom: 6 }}>→</div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 3 }}>To'g'ri sana</div>
          <input value={to} onChange={e => setTo(e.target.value)} placeholder="06.08.2026" style={inp} />
        </div>
        <button onClick={apply} disabled={!total}
          style={{
            padding: '9px 20px', border: 'none', borderRadius: 5, fontWeight: 'bold', fontSize: 13,
            color: '#fff', background: total ? '#e65100' : '#bbb',
            cursor: total ? 'pointer' : 'default',
          }}>
          To'g'rilash
        </button>
      </div>

      {/* Jonli hisoblagich — bosishdan oldin nima o'zgarishini ko'rsatadi */}
      {validDate(from) && (
        <div style={{ marginTop: 12, fontSize: 12.5, lineHeight: 1.7,
          color: total ? '#1b5e20' : '#b71c1c',
          background: total ? '#e8f5e9' : '#ffebee',
          border: `1px solid ${total ? '#a5d6a7' : '#ef9a9a'}`,
          padding: 10, borderRadius: 4 }}>
          {total ? (
            <>
              <b>{from}</b> sanasida topildi:
              {hitDebt.length > 0 && <div>· Qarzlar: <b>{hitDebt.length} ta</b> — {fmt(sumDebt)} so'm</div>}
              {hitAdv.length  > 0 && <div>· Avanslar: <b>{hitAdv.length} ta</b> — {fmt(sumAdv)} so'm</div>}
            </>
          ) : <>{from} sanasida yozuv topilmadi.</>}
        </div>
      )}

      {msg && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: '#1b5e20', background: '#e8f5e9', border: '1px solid #a5d6a7', padding: 10, borderRadius: 4 }}>
          {msg}
        </div>
      )}
    </div>
  );
}
