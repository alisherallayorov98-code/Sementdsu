// Qolgan bo'limlar uchun umumiy shablon (template).
// Har bir bo'lim o'z funksiyalari tayyor bo'lganda shu faylni almashtiradi.
function PageTemplate({ lang, title }) {
  return (
    <div>
      <p>
        <b>{title}</b> bo'limi tez orada ishga tushiriladi.
      </p>
      <table className="data-table" style={{ width: 600 }}>
        <thead>
          <tr>
            <th>#</th>
            <th>Sana</th>
            <th>Ma'lumot / Izoh</th>
            <th>Summa / Miqdor</th>
            <th>Amallar</th>
          </tr>
        </thead>
        <tbody>
          {[1, 2].map((n) => (
            <tr key={n}>
              <td>{n}</td>
              <td>07.06.2026</td>
              <td>—</td>
              <td>0</td>
              <td><button>Tahrirlash</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PageTemplate;
