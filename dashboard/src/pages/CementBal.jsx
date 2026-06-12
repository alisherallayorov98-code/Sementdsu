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
  const { cementOpening, totalCementBalance, totalRecvTons, totalSoldTons } = useData();

  const rows = [
    { label: L.ochilish, val: fmt(cementOpening.tons) + ' tn', bg: '#fff' },
    { label: L.olingan,  val: '+' + fmt(totalRecvTons) + ' tn', bg: '#e8ffe8' },
    { label: L.sotilgan, val: '-' + fmt(totalSoldTons) + ' tn', bg: '#ffe8e8' },
    { label: L.joriy,    val: fmt(totalCementBalance) + ' tn',  bg: '#ffff00' },
  ];

  return (
    <div>
      <p style={{ color: '#666', fontSize: 13 }}>
        {L.date[lang]}: {cementOpening.date} &nbsp;|&nbsp;
        {L.ochilish[lang]}: <b>{cementOpening.tons} tn</b>
      </p>
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
