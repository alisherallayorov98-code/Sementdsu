// ─────────────────────────────────────────────────────────────────────────────
// Excel'ga chiqarish tugmasi — har bir bo'limga qo'shiladigan klassik tugma.
// Props:
//   filename   — fayl nomi (sana avtomatik qo'shiladi)
//   sheetName  — varaq nomi (ixtiyoriy)
//   title      — Excel ichidagi sarlavha qatori (ixtiyoriy)
//   columns    — [{ key, header, value? }]  value(row) ixtiyoriy hisoblovchi
//   rows       — eksport qilinadigan massiv
//   label      — tugma matni (ixtiyoriy)
// ─────────────────────────────────────────────────────────────────────────────
import { exportToExcel } from '../lib/excelExport';

export default function ExcelExport({ filename, sheetName, title, columns, rows, label = "Excel'ga chiqarish", style }) {
  const count = rows?.length || 0;
  return (
    <button
      type="button"
      onClick={() => exportToExcel({ filename, sheetName, title, columns, rows })}
      disabled={count === 0}
      title={count === 0 ? "Ma'lumot yo'q" : `${count} ta yozuvni Excel'ga chiqarish`}
      style={{
        background: count === 0 ? '#bdbdbd' : '#1d6f42',
        color: '#fff', border: 'none', borderRadius: 4,
        padding: '8px 14px', fontSize: 13, fontWeight: 'bold',
        cursor: count === 0 ? 'not-allowed' : 'pointer',
        fontFamily: 'Tahoma, sans-serif', whiteSpace: 'nowrap',
        ...style,
      }}
    >
      ⬇️ {label}{count > 0 ? ` (${count})` : ''}
    </button>
  );
}
