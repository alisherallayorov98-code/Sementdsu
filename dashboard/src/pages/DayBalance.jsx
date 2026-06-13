/**
 * DayBalance — istalgan kunga borib, o'sha kun oxiridagi
 * Naqd / Bank / Click / Umumiy qoldiqlarni ko'rish.
 *
 * Hisoblash logikasi:
 *   Qoldiq = Ochilish_miqdori
 *           + O'sha kunga qadar (shu kun ham kiritib) barcha kirimlar
 *           - O'sha kunga qadar (shu kun ham kiritib) barcha chiqimlar
 */

import { useState } from 'react';
import { useData } from '../context/DataContext';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtS = (n) => (n >= 0 ? '+' : '') + fmt(n);

// "dd.mm.yyyy" → timestamp (kun boshida 00:00)
const parseDate = (s) => {
  if (!s) return 0;
  const parts = s.split('.');
  if (parts.length !== 3) return 0;
  const [d, m, y] = parts.map(Number);
  return new Date(y, m - 1, d).getTime();
};

const todayStr = () => {
  const d = new Date();
  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear(),
  ].join('.');
};

// Sanani validatsiya qilish
const isValidDate = (s) => {
  if (!s || s.length < 8) return false;
  const t = parseDate(s);
  return t > 0;
};

// dd.mm.yyyy formatiga qaytarish (input date value dan)
const fromInputDate = (v) => {
  if (!v) return '';
  const [y, m, d] = v.split('-');
  return `${d}.${m}.${y}`;
};

const toInputDate = (s) => {
  if (!s || s.length < 8) return '';
  const [d, m, y] = s.split('.');
  return `${y}-${m}-${d}`;
};

export default function DayBalance({ lang }) {
  const {
    cashOpening,   cashRows,
    bankOpening,   bankRows,  bankIncomeRows,  bankExpenseRows,
    clickOpening,  clickRows, clickIncomeRows, clickExpenseRows,
    incomeRows,    expenseRows,
    soldRows,
  } = useData();

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [compareDate,  setCompareDate]  = useState('');
  const [showDetails,  setShowDetails]  = useState(false);

  // ── Sanagacha bo'lgan qoldiqni hisoblash ─────────────────────────────────
  // Markaziy model bilan bir xil: kanal qatorlari (cashRows/bankRows/clickRows)
  // sotuv/qarz/avans/oylik auto-yozuvlarini o'z ichiga oladi (ishorali summa).
  const calcBalance = (date) => {
    if (!isValidDate(date)) return null;
    const dayTs = parseDate(date);

    const upTo    = (rows) => rows.filter(r => parseDate(r.date) <= dayTs).reduce((s, r) => s + Number(r.amount || 0), 0);
    const upToPos = (rows) => rows.filter(r => parseDate(r.date) <= dayTs).reduce((s, r) => s + Math.max(0,  Number(r.amount || 0)), 0);
    const upToNeg = (rows) => rows.filter(r => parseDate(r.date) <= dayTs).reduce((s, r) => s + Math.max(0, -Number(r.amount || 0)), 0);
    const soldUpTo = (ch) => soldRows
      .filter(r => (r.paymentChannel || 'naqd') === ch && parseDate(r.date) <= dayTs)
      .reduce((s, r) => s + Number(r.tons || 0) * Number(r.pricePerTon || 0), 0);

    // ── NAQD ───────────────────────────────────────────────────────────────
    const naqdKirim  = upTo(incomeRows)  + upToPos(cashRows) + soldUpTo('naqd');
    const naqdChiqim = upTo(expenseRows) + upToNeg(cashRows);
    const naqdBalance = Number(cashOpening.amount) + naqdKirim - naqdChiqim;

    // ── BANK ───────────────────────────────────────────────────────────────
    const bankKirim  = upTo(bankIncomeRows)  + upToPos(bankRows) + soldUpTo('bank');
    const bankChiqim = upTo(bankExpenseRows) + upToNeg(bankRows);
    const bankBalance = Number(bankOpening.amount) + bankKirim - bankChiqim;

    // ── CLICK ──────────────────────────────────────────────────────────────
    const clickKirim  = upTo(clickIncomeRows)  + upToPos(clickRows) + soldUpTo('click');
    const clickChiqim = upTo(clickExpenseRows) + upToNeg(clickRows);
    const clickBalance = Number(clickOpening.amount) + clickKirim - clickChiqim;

    // ── JAMI ───────────────────────────────────────────────────────────────
    const total = naqdBalance + bankBalance + clickBalance;

    // ── O'SHA KUNDA bo'lgan tranzaksiyalar ─────────────────────────────────
    const sgn = (a) => (Number(a) >= 0 ? +1 : -1);
    const onDate = (rows) => rows.filter(r => r.date === date);
    const dayTx = [
      ...onDate(cashRows).map(r  => ({ cat: '💵 Naqd',        sign: sgn(r.amount), amount: Math.abs(Number(r.amount || 0)), desc: r.desc, worker: r.worker })),
      ...onDate(incomeRows).map(r  => ({ cat: '💚 Naqd kirim',  sign: +1, amount: r.amount, desc: r.desc, worker: r.worker })),
      ...onDate(expenseRows).map(r => ({ cat: '🔴 Naqd chiqim', sign: -1, amount: r.amount, desc: r.desc, worker: r.worker })),
      ...onDate(bankRows).map(r  => ({ cat: '🏦 Bank',        sign: sgn(r.amount), amount: Math.abs(Number(r.amount || 0)), desc: r.desc, worker: r.worker })),
      ...onDate(bankIncomeRows).map(r  => ({ cat: '🏦 Bank kirim',  sign: +1, amount: r.amount, desc: r.desc, worker: r.worker })),
      ...onDate(bankExpenseRows).map(r => ({ cat: '🏦 Bank chiqim', sign: -1, amount: r.amount, desc: r.desc, worker: r.worker })),
      ...onDate(clickRows).map(r => ({ cat: '💜 Click',       sign: sgn(r.amount), amount: Math.abs(Number(r.amount || 0)), desc: r.desc, worker: r.worker })),
      ...onDate(clickIncomeRows).map(r  => ({ cat: '💜 Click kirim',  sign: +1, amount: r.amount, desc: r.desc, worker: r.worker })),
      ...onDate(clickExpenseRows).map(r => ({ cat: '💜 Click chiqim', sign: -1, amount: r.amount, desc: r.desc, worker: r.worker })),
      ...onDate(soldRows).map(r => ({
        cat: `🏭 Eski savdo (${r.paymentChannel || 'naqd'})`, sign: +1,
        amount: Number(r.tons || 0) * Number(r.pricePerTon || 0),
        desc: `${r.customer} · ${r.tons} tn`, worker: r.worker,
      })),
    ];

    const dayIn  = dayTx.filter(t => t.sign > 0).reduce((s, t) => s + Number(t.amount), 0);
    const dayOut = dayTx.filter(t => t.sign < 0).reduce((s, t) => s + Number(t.amount), 0);

    return {
      naqdBalance, bankBalance, clickBalance, total,
      naqdKirim, naqdChiqim,
      bankKirim, bankChiqim,
      clickKirim, clickChiqim,
      dayTx, dayIn, dayOut,
    };
  };

  const result  = calcBalance(selectedDate);
  const result2 = compareDate ? calcBalance(compareDate) : null;

  const inp = {
    padding: '5px 10px', fontSize: 13,
    border: '1px solid #ccc', borderRadius: 4,
    fontFamily: 'Tahoma, sans-serif',
  };

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>

      {/* ── SARLAVHA ──────────────────────────────────────────────────────── */}
      <div style={{
        background: '#283593', color: '#fff',
        padding: '10px 16px', marginBottom: 16, borderRadius: 4,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 18 }}>📅</span>
        <span style={{ fontWeight: 'bold', fontSize: 15 }}>
          Sana bo'yicha qoldiq hisoblash
        </span>
        <span style={{ fontSize: 12, color: '#c5cae9' }}>
          — istalgan kunga borib, kun oxiridagi balansni ko'ring
        </span>
      </div>

      {/* ── SANA TANLASH ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap',
        alignItems: 'flex-end',
      }}>
        {/* Asosiy sana */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 4 }}>
            📅 Sana tanlang:
          </label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="date"
              value={toInputDate(selectedDate)}
              onChange={e => setSelectedDate(fromInputDate(e.target.value))}
              style={{ ...inp, border: '2px solid #283593' }}
            />
            <button
              onClick={() => setSelectedDate(todayStr())}
              style={{
                ...inp, cursor: 'pointer',
                background: selectedDate === todayStr() ? '#283593' : '#e8eaf6',
                color: selectedDate === todayStr() ? '#fff' : '#283593',
                fontWeight: 'bold', border: '1px solid #9fa8da',
              }}
            >
              Bugun
            </button>
            {/* Tezkor kunlar */}
            {[1, 2, 3, 7].map(days => {
              const d = new Date(); d.setDate(d.getDate() - days);
              const s = [String(d.getDate()).padStart(2,'0'), String(d.getMonth()+1).padStart(2,'0'), d.getFullYear()].join('.');
              return (
                <button key={days} onClick={() => setSelectedDate(s)}
                  style={{
                    ...inp, cursor: 'pointer', fontSize: 11,
                    background: selectedDate === s ? '#283593' : '#f5f5f5',
                    color: selectedDate === s ? '#fff' : '#555',
                    border: '1px solid #ccc', padding: '5px 8px',
                  }}>
                  -{days}kun
                </button>
              );
            })}
          </div>
        </div>

        {/* Solishtirish sanasi */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#888', marginBottom: 4 }}>
            🔄 Solishtirish uchun (ixtiyoriy):
          </label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="date"
              value={toInputDate(compareDate)}
              onChange={e => setCompareDate(fromInputDate(e.target.value))}
              style={{ ...inp, border: '1px solid #ccc' }}
            />
            {compareDate && (
              <button onClick={() => setCompareDate('')}
                style={{ ...inp, cursor: 'pointer', background: '#ffebee', color: '#c62828', border: '1px solid #e57373' }}>
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── NATIJA ───────────────────────────────────────────────────────── */}
      {result && (
        <>
          {/* Sana ko'rsatkich */}
          <div style={{
            fontSize: 14, fontWeight: 'bold', color: '#283593',
            marginBottom: 12, padding: '6px 0', borderBottom: '2px solid #e8eaf6',
            display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
          }}>
            <span>📅 {selectedDate} — kun oxiri qoldig'i</span>
            <button
              onClick={() => setShowDetails(v => !v)}
              style={{ ...inp, cursor: 'pointer', fontSize: 12, padding: '3px 12px',
                background: showDetails ? '#283593' : '#e8eaf6',
                color: showDetails ? '#fff' : '#283593', fontWeight: 'bold' }}>
              {showDetails ? '▲ Batafsil yopish' : '▼ Batafsil ko\'rish'}
            </button>
          </div>

          {/* Balans kartalar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
            <BalCard
              emoji="💵" label="NAQD QOLDIQ"
              value={result.naqdBalance}
              compare={result2?.naqdBalance}
              color="#1b5e20" bg="#e8f5e9"
              sub={`Kirim: ${fmt(result.naqdKirim)} · Chiqim: ${fmt(result.naqdChiqim)}`}
            />
            <BalCard
              emoji="🏦" label="BANK QOLDIQ"
              value={result.bankBalance}
              compare={result2?.bankBalance}
              color="#0d47a1" bg="#e3f2fd"
              sub={`Kirim: ${fmt(result.bankKirim)} · Chiqim: ${fmt(result.bankChiqim)}`}
            />
            <BalCard
              emoji="💜" label="CLICK QOLDIQ"
              value={result.clickBalance}
              compare={result2?.clickBalance}
              color="#4a148c" bg="#f3e5f5"
              sub={`Kirim: ${fmt(result.clickKirim)} · Chiqim: ${fmt(result.clickChiqim)}`}
            />
            <BalCard
              emoji="💰" label="UMUMIY JAMI"
              value={result.total}
              compare={result2?.total}
              color={result.total >= 0 ? '#1b5e20' : '#b71c1c'}
              bg={result.total >= 0 ? '#f1f8e9' : '#ffebee'}
              bold
            />
          </div>

          {/* ── O'SHA KUNDA HARAKATLAR ─────────────────────────────────── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: result2 ? '1fr 1fr' : '1fr',
            gap: 16,
          }}>
            <DayDetail date={selectedDate} tx={result.dayTx} dayIn={result.dayIn} dayOut={result.dayOut} showDetails={showDetails} />
            {result2 && (
              <DayDetail date={compareDate} tx={result2.dayTx} dayIn={result2.dayIn} dayOut={result2.dayOut} showDetails={showDetails} accent="#e65100" />
            )}
          </div>
        </>
      )}

      {!isValidDate(selectedDate) && (
        <div style={{ color: '#f57c00', padding: 16, background: '#fff8e1', borderRadius: 4, border: '1px solid #ffb74d' }}>
          ⚠️ Iltimos, to'g'ri sana tanlang.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BALANS KARTOCHKASI
// ─────────────────────────────────────────────────────────────────────────────
function BalCard({ emoji, label, value, compare, color, bg, sub, bold }) {
  const diff = compare !== undefined ? value - compare : null;

  return (
    <div style={{
      padding: '12px 16px', background: bg,
      border: `1px solid ${color}22`,
      borderLeft: `5px solid ${color}`,
      borderRadius: 5,
    }}>
      <div style={{ fontSize: 11, fontWeight: 'bold', color: '#666', marginBottom: 4 }}>
        {emoji} {label}
      </div>
      <div style={{
        fontSize: bold ? 20 : 17, fontWeight: 'bold',
        color, fontFamily: 'monospace',
      }}>
        {fmt(value)} so'm
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: '#888', marginTop: 3 }}>{sub}</div>
      )}
      {diff !== null && (
        <div style={{
          marginTop: 5, fontSize: 12, fontWeight: 'bold',
          color: diff > 0 ? '#2e7d32' : diff < 0 ? '#c62828' : '#777',
        }}>
          {diff > 0 ? '▲ +' : diff < 0 ? '▼ ' : '= '}{fmt(Math.abs(diff))} so'm
          <span style={{ fontWeight: 'normal', fontSize: 10, marginLeft: 4, color: '#888' }}>solishtirma</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KUN TAFSILOTLARI
// ─────────────────────────────────────────────────────────────────────────────
function DayDetail({ date, tx, dayIn, dayOut, showDetails, accent = '#283593' }) {
  const fmt2 = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');

  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: 5, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        background: accent, color: '#fff',
        padding: '8px 14px', fontWeight: 'bold', fontSize: 13,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>📋 {date} — kunlik harakatlar</span>
        <span style={{ fontSize: 12 }}>{tx.length} ta</span>
      </div>

      {/* Kun umumiy */}
      <div style={{
        display: 'flex', gap: 0,
        background: '#fafafa', borderBottom: '1px solid #e0e0e0',
      }}>
        <div style={{ flex: 1, padding: '8px 14px', borderRight: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: 10, color: '#666' }}>Kirim</div>
          <div style={{ fontWeight: 'bold', color: '#2e7d32', fontFamily: 'monospace' }}>
            +{fmt2(dayIn)}
          </div>
        </div>
        <div style={{ flex: 1, padding: '8px 14px', borderRight: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: 10, color: '#666' }}>Chiqim</div>
          <div style={{ fontWeight: 'bold', color: '#c62828', fontFamily: 'monospace' }}>
            -{fmt2(dayOut)}
          </div>
        </div>
        <div style={{ flex: 1, padding: '8px 14px' }}>
          <div style={{ fontSize: 10, color: '#666' }}>Sof</div>
          <div style={{
            fontWeight: 'bold', fontFamily: 'monospace',
            color: (dayIn - dayOut) >= 0 ? '#2e7d32' : '#c62828',
          }}>
            {(dayIn - dayOut) >= 0 ? '+' : ''}{fmt2(dayIn - dayOut)}
          </div>
        </div>
      </div>

      {/* Tranzaksiyalar ro'yxati */}
      {showDetails && (
        tx.length === 0 ? (
          <div style={{ padding: '16px 14px', color: '#aaa', fontStyle: 'italic', textAlign: 'center' }}>
            Bu kunda hech qanday harakat yo'q
          </div>
        ) : (
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {tx.map((t, i) => (
              <div key={i} style={{
                padding: '6px 14px',
                borderBottom: '1px solid #f0f0f0',
                background: i % 2 === 0 ? '#fff' : '#fafafa',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <span style={{ fontSize: 11, color: '#555' }}>{t.cat}</span>
                  {t.desc && (
                    <div style={{ fontSize: 12, color: '#333', marginTop: 1 }}>{t.desc}</div>
                  )}
                  {t.worker && (
                    <div style={{ fontSize: 10, color: '#999' }}>{t.worker}</div>
                  )}
                </div>
                <div style={{
                  fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13,
                  color: t.sign > 0 ? '#2e7d32' : '#c62828',
                  whiteSpace: 'nowrap', marginLeft: 12,
                }}>
                  {t.sign > 0 ? '+' : '-'}{fmt2(t.amount)}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {!showDetails && tx.length > 0 && (
        <div style={{ padding: '6px 14px', color: '#888', fontSize: 11, fontStyle: 'italic' }}>
          ▼ Batafsil ko'rish uchun yuqoridagi tugmani bosing
        </div>
      )}
    </div>
  );
}
