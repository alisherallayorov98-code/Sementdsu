import { useData } from '../context/DataContext';

const fmt = (n) => Number(n).toLocaleString('ru-RU').replace(/,/g, ' ');

function GenInfo({ lang }) {
  const {
    totalCashBalance, totalBankBalance, totalClickBalance,
    totalCementBalance, totalSoldTons, totalRecvTons, totalSalesTons,
    totalDebts, totalAdvances,
    workers, incomeRows, expenseRows, salesRows, soldRows,
  } = useData();

  const sotilganJami = Number(totalSoldTons || 0) + Number(totalSalesTons || 0);

  const totalWorkerDebt = workers.reduce((s, w) => s + Math.max(0, Number(w.salary) - Number(w.paid)), 0);
  const totalIncome     = incomeRows.reduce((s, r) => s + Number(r.amount), 0);
  const totalExpense    = expenseRows.reduce((s, r) => s + Number(r.amount), 0);
  const totalSalesSum   = [...salesRows, ...soldRows].reduce((s, r) => s + (Number(r.tons||0) * Number(r.pricePerTon||0)), 0);

  const groups = [
    {
      title: { latn: "Pul qoldiqlari", cyrl: "Пул қолдиқлари" },
      rows: [
        { latn: "Naqd pul",          cyrl: "Нақд пул",           val: fmt(totalCashBalance),  unit: { latn: "so'm", cyrl: "сўм" } },
        { latn: "Bank (Umumiy)",      cyrl: "Банк (Умумий)",      val: fmt(totalBankBalance),  unit: { latn: "so'm", cyrl: "сўм" } },
        { latn: "Click (Umumiy)",     cyrl: "Клик (Умумий)",      val: fmt(totalClickBalance), unit: { latn: "so'm", cyrl: "сўм" } },
      ]
    },
    {
      title: { latn: "Sement harakati", cyrl: "Семент ҳаракати" },
      rows: [
        { latn: "Joriy sement qoldig'i", cyrl: "Жорий семент қолдиғи", val: fmt(totalCementBalance) + " tn", unit: { latn: "", cyrl: "" } },
        { latn: "Sotilgan tonna",         cyrl: "Сотилган тонна",       val: fmt(sotilganJami) + " tn",      unit: { latn: "", cyrl: "" } },
        { latn: "Olingan tonna",          cyrl: "Олинган тонна",        val: fmt(totalRecvTons) + " tn",     unit: { latn: "", cyrl: "" } },
        { latn: "Sotish summasi",         cyrl: "Сотиш суммаси",        val: fmt(totalSalesSum),             unit: { latn: "so'm", cyrl: "сўм" } },
      ]
    },
    {
      title: { latn: "Moliyaviy holat", cyrl: "Молиявий ҳолат" },
      rows: [
        { latn: "Jami qarzlar (bizga)",   cyrl: "Жами қарзлар (бизга)",   val: fmt(totalDebts),       unit: { latn: "so'm", cyrl: "сўм" }, color: '#c00' },
        { latn: "Jami avanslar (qolgan)", cyrl: "Жами авансlar (қолган)", val: fmt(totalAdvances),    unit: { latn: "so'm", cyrl: "сўм" }, color: '#006' },
        { latn: "Naqd kirim",             cyrl: "Нақд кирим",             val: fmt(totalIncome),      unit: { latn: "so'm", cyrl: "сўм" }, color: '#006' },
        { latn: "Naqd chiqim",            cyrl: "Нақд чиқим",             val: fmt(totalExpense),     unit: { latn: "so'm", cyrl: "сўм" }, color: '#c00' },
        { latn: "Ishchilar qolgan oylik", cyrl: "Ишчилар қолган ойлик",  val: fmt(totalWorkerDebt),  unit: { latn: "so'm", cyrl: "сўм" }, color: '#c00' },
      ]
    },
  ];

  return (
    <div>
      {groups.map((g, gi) => (
        <div key={gi} style={{ marginBottom: 20 }}>
          <div style={{ background: '#003366', color: '#fff', padding: '4px 10px', fontWeight: 'bold', fontSize: 13, marginBottom: 0 }}>
            {g.title[lang]}
          </div>
          <table className="data-table" style={{ width: 460, marginBottom: 0 }}>
            <tbody>
              {g.rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: '5px 10px' }}>{r[lang]}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '5px 10px', width: 160, color: r.color || '#000' }}>{r.val}</td>
                  <td style={{ width: 45, paddingLeft: 6, color: '#555' }}>{r.unit[lang]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
export default GenInfo;
