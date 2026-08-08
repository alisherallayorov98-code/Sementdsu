// ─────────────────────────────────────────────────────────────────────────────
// TEKSHIRUV sahifasi — hisob-kitob butunligini bir bosishda ko'rsatadi.
//
// Mantiq lib/auditState.js da (sof funksiya, testlar bilan qoplangan).
// Bu sahifa faqat natijani ko'rsatadi.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { auditState, auditSummary } from '../lib/auditState';

export default function SelfAudit() {
  const data = useData();
  const findings = useMemo(() => auditState(data), [data]);
  const { xato, ogoh, toza } = auditSummary(findings);

  const card = (bg, border, color) => ({
    background: bg, border: `1px solid ${border}`, borderLeft: `5px solid ${color}`,
    borderRadius: 6, padding: '14px 18px', marginBottom: 12,
  });

  return (
    <div style={{ maxWidth: 900 }}>
      <h2 style={{ marginTop: 0, color: '#003366' }}>🔍 Tekshiruv</h2>
      <p style={{ fontSize: 13, color: '#555', lineHeight: 1.7, marginTop: 0 }}>
        Dastur pulni bir necha bo'lim orqali yuritadi (sotuv → kassa → qarz → avans)
        va ular orasida muvozanat bo'lishi kerak. Bu sahifa o'sha muvozanatni
        tekshiradi. <strong>Kuniga bir marta ochib ko'ring</strong> — buzilish
        o'sha kuniyoq ko'rinadi va zaxiradan tiklash oson bo'ladi.
      </p>

      {/* Umumiy holat */}
      {toza ? (
        <div style={{ ...card('#e8f5e9', '#a5d6a7', '#2e7d32'), fontSize: 15, fontWeight: 'bold', color: '#1b5e20' }}>
          ✓ Hammasi joyida — hisob-kitobda nomuvofiqlik topilmadi.
        </div>
      ) : (
        <div style={{ ...card(xato ? '#ffebee' : '#fff8e1', xato ? '#ef9a9a' : '#ffe082', xato ? '#c62828' : '#f9a825'), fontSize: 14 }}>
          <strong style={{ fontSize: 15 }}>
            {xato > 0 && <span style={{ color: '#c62828' }}>{xato} ta xato</span>}
            {xato > 0 && ogoh > 0 && ' · '}
            {ogoh > 0 && <span style={{ color: '#ef6c00' }}>{ogoh} ta ogohlantirish</span>}
          </strong>
          <div style={{ fontSize: 12.5, color: '#555', marginTop: 6 }}>
            <strong>Xato</strong> — hisob buzilgan, darhol qarash kerak.{' '}
            <strong>Ogohlantirish</strong> — shubhali, lekin to'g'ri bo'lishi ham mumkin.
          </div>
        </div>
      )}

      {/* Topilmalar */}
      {findings.map((f, i) => {
        const isErr = f.level === 'xato';
        return (
          <div key={f.code + i} style={card(isErr ? '#fff5f5' : '#fffdf5', '#eee', isErr ? '#c62828' : '#f9a825')}>
            <div style={{ fontWeight: 'bold', fontSize: 13.5, color: isErr ? '#b71c1c' : '#e65100' }}>
              {isErr ? '✕' : '⚠'} {f.title}
            </div>
            {Array.isArray(f.detail) && f.detail.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 12.5, color: '#444', lineHeight: 1.8 }}>
                {f.detail.map((d, j) => <li key={j} style={{ fontFamily: 'monospace' }}>{d}</li>)}
              </ul>
            )}
            <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>kod: {f.code}</div>
          </div>
        );
      })}

      {/* Nima tekshiriladi */}
      <details style={{ marginTop: 20, fontSize: 12.5, color: '#555' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#003366' }}>
          Nimalar tekshiriladi?
        </summary>
        <ol style={{ lineHeight: 1.9, paddingLeft: 22, marginTop: 10 }}>
          <li>Har qarzda "to'langan" summa to'lovlar ro'yxatiga mos keladimi</li>
          <li>Qarzdan ortiq to'lov qayd etilmaganmi (ortiqcha pul hisobda ko'rinmaydi)</li>
          <li>Avansda "ishlatilgan" summa sarflar ro'yxatiga mos keladimi</li>
          <li>Xodimning to'langan oyligi to'lovlar ro'yxatiga mos keladimi</li>
          <li>Takrorlangan id yo'qmi (bittasini o'chirsa ikkalasi o'chadi)</li>
          <li>Manfiy summa/tonna yo'qmi</li>
          <li>Sotuvi o'chirilgan "yetim" kassa yozuvlari yo'qmi</li>
          <li>Kassa/bank/click/sklad qoldig'i manfiy emasmi</li>
          <li>Qarzi bor mijozlar mijozlar bazasida bormi</li>
          <li>Mijozlar bazasida takrorlangan nom yo'qmi</li>
          <li>Yetkazib beruvchiga olingan yukdan ortiq to'lanmaganmi</li>
          <li>Yukdan kelganidan ko'p sement chiqarilmaganmi (sotuv + sklad)</li>
          <li>Tasdiqlanmagan yukdan sotuv qilinmaganmi</li>
          <li>Kanallararo o'tkazma juftligi muvozanatdami</li>
          <li>Sanalar to'g'ri formatdami (hisobotga tushishi uchun)</li>
        </ol>
      </details>
    </div>
  );
}
