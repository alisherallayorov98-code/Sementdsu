// ─────────────────────────────────────────────────────────────────────────────
// "RAQAM QAYERDAN?" — balansni tarkibiy qismlarga ajratib ko'rsatuvchi oyna.
//
// MUAMMO: bosh sahifada faqat YAKUNIY raqam ko'rinardi. Masalan naqd kassa
// beshta qismdan yig'iladi:
//     boshlang'ich qoldiq + kassa yozuvlari + kirim − chiqim + eski savdo
// lekin ekranda faqat natija turardi. Qatorlar o'chirilgandan keyin ham raqam
// qolsa, uning qayerdan kelgani va qayerga borib tuzatish kerakligi umuman
// bilinmasdi. Ayniqsa BOSHLANG'ICH QOLDIQ ko'rinmas edi: bir marta kiritilib,
// keyin abadiy har bir jamiga qo'shilib yurardi.
//
// YECHIM: har bir qism alohida qator sifatida ko'rsatiladi — summasi, nechta
// yozuvdan iborati va o'sha yozuvlarga o'tish tugmasi bilan.
//
// O'Z-O'ZINI TEKSHIRISH: qismlar yig'indisi ko'rsatilayotgan jami bilan
// solishtiriladi. Farq chiqsa — bu hisobda xato borligini bildiradi va
// yashirilmasdan qizil rangda chiqariladi.
// ─────────────────────────────────────────────────────────────────────────────
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };

// Har bir balans turi uchun tarkibni hisoblaymiz.
// DataContext dagi formulalar bilan AYNAN bir xil bo'lishi shart.
function buildParts(type, d) {
  const sum = (arr, f) => (arr || []).reduce((s, r) => s + f(r), 0);
  const amt = (r) => Number(r.amount || 0);

  if (type === 'naqd') {
    // totalCashBalance = cashOpening + cashRows + income − expense + soldNaqd
    const soldNaqd = (d.soldRows || []).filter(r => (r.paymentChannel || 'naqd') === 'naqd');
    return {
      total: d.totalCashBalance,
      unit: "so'm",
      parts: [
        { label: "Boshlang'ich qoldiq", value: Number(d.cashOpening?.amount || 0),
          note: d.cashOpening?.date ? `${d.cashOpening.date} holatiga` : 'sana ko\'rsatilmagan',
          opening: 'cash' },
        { label: 'Kassa yozuvlari', value: sum(d.cashRows, amt), count: (d.cashRows || []).length,
          note: 'sotuv, qarz to\'lovi, avans, oylik va qo\'lda kiritilganlar', to: '/kassir' },
        { label: 'Kirim (naqd)', value: sum(d.incomeRows, amt), count: (d.incomeRows || []).length, to: '/gen_info?tab=cash' },
        { label: 'Chiqim (naqd)', value: -sum(d.expenseRows, amt), count: (d.expenseRows || []).length, to: '/gen_info?tab=cash' },
        { label: 'Eski savdo (naqd)', value: sum(soldNaqd, r => Number(r.tons || 0) * Number(r.pricePerTon || 0)),
          count: soldNaqd.length, to: '/sold_tons' },
      ],
    };
  }

  if (type === 'bank') {
    const soldBank = (d.soldRows || []).filter(r => r.paymentChannel === 'bank');
    return {
      total: d.totalBankBalance,
      unit: "so'm",
      parts: [
        { label: "Boshlang'ich qoldiq", value: Number(d.bankOpening?.amount || 0),
          note: d.bankOpening?.date ? `${d.bankOpening.date} holatiga` : 'sana ko\'rsatilmagan',
          opening: 'bank' },
        { label: 'Bank yozuvlari', value: sum(d.bankRows, amt), count: (d.bankRows || []).length,
          note: 'sotuv, qarz to\'lovi, avans va boshqalar', to: '/kassir' },
        { label: 'Kirim (bank)', value: sum(d.bankIncomeRows, amt), count: (d.bankIncomeRows || []).length, to: '/income_bank' },
        { label: 'Chiqim (bank)', value: -sum(d.bankExpenseRows, amt), count: (d.bankExpenseRows || []).length, to: '/income_bank' },
        { label: 'Eski savdo (bank)', value: sum(soldBank, r => Number(r.tons || 0) * Number(r.pricePerTon || 0)),
          count: soldBank.length, to: '/sold_tons' },
      ],
    };
  }

  if (type === 'click') {
    const soldClick = (d.soldRows || []).filter(r => r.paymentChannel === 'click');
    return {
      total: d.totalClickBalance,
      unit: "so'm",
      parts: [
        { label: "Boshlang'ich qoldiq", value: Number(d.clickOpening?.amount || 0),
          note: d.clickOpening?.date ? `${d.clickOpening.date} holatiga` : 'sana ko\'rsatilmagan',
          opening: 'click' },
        { label: 'Click yozuvlari', value: sum(d.clickRows, amt), count: (d.clickRows || []).length, to: '/kassir' },
        { label: 'Kirim (click)', value: sum(d.clickIncomeRows, amt), count: (d.clickIncomeRows || []).length, to: '/income_click' },
        { label: 'Chiqim (click)', value: -sum(d.clickExpenseRows, amt), count: (d.clickExpenseRows || []).length, to: '/income_click' },
        { label: 'Eski savdo (click)', value: sum(soldClick, r => Number(r.tons || 0) * Number(r.pricePerTon || 0)),
          count: soldClick.length, to: '/sold_tons' },
      ],
    };
  }

  if (type === 'cement') {
    // totalCementBalance = cementOpening + ulgurji qabul − eski savdo − yangi sotuv
    // Skladga (kg) o'tkazilgan qism qabuldan chiqarib tashlanadi.
    const skladKgByRecv = {};
    (d.skladRows || []).filter(r => r.type === 'kirim' && r.sourceId)
      .forEach(r => { skladKgByRecv[r.sourceId] = (skladKgByRecv[r.sourceId] || 0) + Number(r.kg || 0); });
    const recvNet = (d.recvRows || []).reduce((s, r) =>
      s + Math.max(0, Number(r.tons || 0) - (skladKgByRecv[r.id] || 0) / 1000), 0);
    const toSkladTons = Object.values(skladKgByRecv).reduce((s, kg) => s + kg, 0) / 1000;

    return {
      total: d.totalCementBalance,
      unit: 'tn',
      isTons: true,
      parts: [
        { label: "Boshlang'ich qoldiq", value: Number(d.cementOpening?.tons || 0),
          note: d.cementOpening?.date ? `${d.cementOpening.date} holatiga` : 'sana ko\'rsatilmagan',
          opening: 'cement' },
        { label: 'Qabul qilingan (ulgurji)', value: recvNet, count: (d.recvRows || []).length,
          note: toSkladTons > 0 ? `${fmtT(toSkladTons)} tn chakana skladga o'tkazilgan — bu yerdan chiqarilgan` : '',
          to: '/recv_tons' },
        { label: 'Sotilgan (yangi)', value: -(d.salesRows || []).reduce((s, r) => s + Number(r.tons || 0), 0),
          count: (d.salesRows || []).length, to: '/sales' },
        { label: 'Sotilgan (eski)', value: -(d.soldRows || []).reduce((s, r) => s + Number(r.tons || 0), 0),
          count: (d.soldRows || []).length, to: '/sold_tons' },
      ],
    };
  }

  if (type === 'debt') {
    const byCust = {};
    (d.debtRows || []).forEach(r => {
      const q = Math.max(0, Number(r.amount || 0) - Number(r.paid || 0));
      if (q > 0) byCust[r.customer] = (byCust[r.customer] || 0) + q;
    });
    const list = Object.entries(byCust).sort((a, b) => b[1] - a[1]);
    return {
      total: d.totalDebts,
      unit: "so'm",
      customList: list,
      parts: [
        { label: 'Qarzi bor mijozlar', value: d.totalDebts, count: list.length, to: '/debts' },
      ],
    };
  }

  return null;
}

const TITLES = {
  naqd:   '💵 Naqd kassa',
  bank:   '🏦 Bank',
  click:  '📱 Click',
  cement: "📦 Sement qoldig'i",
  debt:   '💰 Bizga jami qarz',
};

export default function BalanceBreakdown({ type, onClose }) {
  const data = useData();
  const navigate = useNavigate();
  const built = buildParts(type, data);
  if (!built) return null;

  const { total, unit, parts, isTons, customList } = built;
  const f = isTons ? fmtT : fmt;

  // O'z-o'zini tekshirish: qismlar yig'indisi jami bilan mos kelishi shart
  const partsSum = parts.reduce((s, p) => s + Number(p.value || 0), 0);
  const diff = Number(total || 0) - partsSum;
  const mismatch = Math.abs(diff) > (isTons ? 0.001 : 0.5);

  const go = (to) => { onClose(); navigate(to); };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 10, width: 620, maxWidth: '100%',
        maxHeight: '88vh', overflowY: 'auto', fontFamily: 'Tahoma, Verdana, Arial, sans-serif',
        boxShadow: '0 18px 50px rgba(0,0,0,0.3)',
      }}>
        {/* Sarlavha */}
        <div style={{
          background: '#003366', color: '#fff', padding: '14px 18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 15 }}>{TITLES[type]}</div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>Bu raqam qayerdan kelgan?</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: 18 }}>
          {/* Tarkib jadvali */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {parts.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '11px 6px 11px 0', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 'bold', color: '#333' }}>
                      {p.label}
                      {p.count !== undefined && (
                        <span style={{ fontWeight: 'normal', color: '#888', fontSize: 11, marginLeft: 6 }}>
                          {p.count} ta yozuv
                        </span>
                      )}
                    </div>
                    {p.note && (
                      <div style={{ fontSize: 11, color: '#888', marginTop: 3, lineHeight: 1.5 }}>{p.note}</div>
                    )}
                    {/* Boshlang'ich qoldiq — yashirin raqamning eng ko'p uchraydigan manbai */}
                    {p.opening && Math.abs(p.value) > 0 && (
                      <div style={{
                        fontSize: 11, color: '#e65100', marginTop: 5, background: '#fff3e0',
                        padding: '5px 8px', borderRadius: 4, lineHeight: 1.5,
                      }}>
                        ⚠️ Bu qo'lda kiritilgan boshlang'ich qoldiq. Hech qanday yozuvga
                        bog'lanmagan — ya'ni yozuvlarni o'chirsangiz ham u qolaveradi.
                        Noto'g'ri bo'lsa <b>Sozlamalar → Boshlang'ich qoldiqlar</b> dan tuzating.
                      </div>
                    )}
                  </td>
                  <td style={{
                    padding: '11px 10px', textAlign: 'right', fontFamily: 'monospace',
                    fontWeight: 'bold', whiteSpace: 'nowrap',
                    color: p.value < 0 ? '#c62828' : p.value > 0 ? '#2e7d32' : '#999',
                  }}>
                    {p.value > 0 ? '+' : ''}{f(p.value)}
                  </td>
                  <td style={{ padding: '11px 0', width: 78, textAlign: 'right' }}>
                    {p.opening ? (
                      <button onClick={() => go('/settings?tab=opening')} style={linkBtn}>Sozlash →</button>
                    ) : p.to ? (
                      <button onClick={() => go(p.to)} style={linkBtn}>Ko'rish →</button>
                    ) : null}
                  </td>
                </tr>
              ))}

              {/* Jami */}
              <tr style={{ background: '#f5f7fa' }}>
                <td style={{ padding: '13px 6px 13px 0', fontWeight: 'bold', fontSize: 14 }}>JAMI</td>
                <td style={{
                  padding: '13px 10px', textAlign: 'right', fontFamily: 'monospace',
                  fontWeight: 'bold', fontSize: 16, color: '#003366', whiteSpace: 'nowrap',
                }}>
                  {f(total)} <span style={{ fontSize: 11, color: '#888' }}>{unit}</span>
                </td>
                <td />
              </tr>
            </tbody>
          </table>

          {/* Nomuvofiqlik — yashirmaymiz */}
          {mismatch && (
            <div style={{
              marginTop: 14, background: '#ffebee', border: '1px solid #ef9a9a',
              borderRadius: 6, padding: '10px 12px', fontSize: 12, color: '#c62828', lineHeight: 1.6,
            }}>
              <b>⚠️ Nomuvofiqlik aniqlandi:</b> qismlar yig'indisi ({f(partsSum)}) yakuniy
              raqamdan ({f(total)}) <b>{f(Math.abs(diff))} {unit}</b> farq qilmoqda.
              <br />Bu hisobda xato borligini bildiradi — dasturchiga xabar bering.
            </div>
          )}

          {/* Qarz bo'yicha mijozlar ro'yxati */}
          {customList && customList.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 8 }}>
                Kimlarda qarz bor:
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <tbody>
                  {customList.slice(0, 12).map(([name, val]) => (
                    <tr key={name} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '6px 0' }}>{name}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'monospace', color: '#c62828', fontWeight: 'bold' }}>
                        {fmt(val)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {customList.length > 12 && (
                <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
                  …yana {customList.length - 12} ta mijoz
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 16, fontSize: 11, color: '#888', lineHeight: 1.6 }}>
            Har bir qatordagi <b>"Ko'rish →"</b> tugmasi o'sha summani hosil qilgan
            yozuvlar ro'yxatiga olib boradi.
          </div>
        </div>
      </div>
    </div>
  );
}

const linkBtn = {
  background: '#e8eef6', border: '1px solid #b3c6de', color: '#1565c0',
  borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer',
  whiteSpace: 'nowrap', fontFamily: 'Tahoma, sans-serif',
};
