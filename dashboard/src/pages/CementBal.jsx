import { useData } from '../context/DataContext';

const fmt = (n) => Number(n).toLocaleString('ru-RU').replace(/,/g, ' ');

const L = {
  ochilish: { latn: "Ochilish qoldig'i (tonna)", cyrl: "Очилиш қолдиғи (тонна)" },
  olingan:  { latn: 'Olingan tonna',             cyrl: 'Олинган тонна'          },
  sotilgan: { latn: 'Sotilgan tonna',             cyrl: 'Сотилган тонна'        },
  joriy:    { latn: "Joriy qoldiq (tonna)",       cyrl: "Жорий қолдиқ (тонна)" },
  date:     { latn: 'Sana',                       cyrl: 'Сана'                  },
};

function CementBal({ lang }) {
  const { cementOpening, totalCementBalance, totalRecvTons, totalSoldTons, totalSalesTons,
          warehouses, cementByWarehouse } = useData();

  // Sotilgan jami = eski "Sotilgan tonna" + yangi "Sotish" bo'limi
  const sotilganJami = Number(totalSoldTons || 0) + Number(totalSalesTons || 0);

  const rows = [
    { label: L.ochilish, val: fmt(cementOpening.tons) + ' tn', bg: '#fff' },
    { label: L.olingan,  val: '+' + fmt(totalRecvTons) + ' tn', bg: '#e8ffe8' },
    { label: L.sotilgan, val: '-' + fmt(sotilganJami) + ' tn', bg: '#ffe8e8' },
    { label: L.joriy,    val: fmt(totalCementBalance) + ' tn',  bg: '#ffff00' },
  ];

  return (
    <div>
      {/* ── Skladlar bo'yicha qoldiq (1 tadan ko'p bo'lsa) ── */}
      {warehouses.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 'bold', fontSize: 14, color: '#5d4037', marginBottom: 8 }}>🏬 Skladlar bo'yicha qoldiq</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {cementByWarehouse.map(w => (
              <div key={w.id} style={{ minWidth: 200, padding: '12px 16px', background: '#efebe9', borderLeft: '5px solid #5d4037', borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 3 }}>{w.name}</div>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: w.balance >= 0 ? '#1b5e20' : '#c62828', fontFamily: 'monospace' }}>
                  {fmt(w.balance)} <span style={{ fontSize: 12, color: '#888' }}>tn</span>
                </div>
                <div style={{ fontSize: 10, color: '#999', marginTop: 3 }}>
                  Olingan {fmt(w.recv)} − Chiqgan {fmt(w.out)}{w.opening ? ` (+ochilish ${fmt(w.opening)})` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={{ color: '#666', fontSize: 13 }}>
        {L.date[lang]}: {cementOpening.date} &nbsp;|&nbsp;
        {L.ochilish[lang]}: <b>{cementOpening.tons} tn</b>
      </p>
      <div style={{ fontWeight: 'bold', fontSize: 13, color: '#333', margin: '6px 0' }}>Umumiy (barcha skladlar):</div>
      <table className="data-table" style={{ width: 400 }}>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: r.bg }}>
              <td style={{ padding: '6px 10px' }}>{r.label[lang]}</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '6px 10px', width: 140 }}>{r.val}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 12, color: '#888', marginTop: 12 }}>
        * Aniq ma'lumot uchun "10. Olingan tonna" va "9. Sotilgan tonna" bo'limlariga kiring.
      </p>
    </div>
  );
}
export default CementBal;
