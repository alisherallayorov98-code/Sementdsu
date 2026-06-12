// ─────────────────────────────────────────────────────────────────────────────
// Excel orqali import — qayta ishlatiladigan komponent.
//   1) Bo'sh shablon (.xlsx) yuklab olish
//   2) To'ldirilgan faylni yuklash → ustunlar avtomatik moslanadi
//   3) Ko'rib chiqish (nechta yozuv) → "Import qilish"
//
// Props:
//   title, color, sheetName, templateName
//   columns: [{ key, header, aliases?, required? }]
//   onImport: (rows) => { added, skipped }   // haqiqiy qo'shishni ota komponent bajaradi
//   hint?: ko'rsatma matni
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import * as XLSX from 'xlsx';

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/[ʻʼ'`]/g, "'");

export default function ExcelImport({ title, color = '#003366', sheetName, templateName, columns, onImport, hint }) {
  const [preview, setPreview] = useState(null); // { rows, total, invalid }

  // ── Shablon yuklab olish ─────────────────────────────────────────────────
  const downloadTemplate = () => {
    const headers = columns.map(c => c.header);
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws['!cols'] = columns.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, templateName);
  };

  // ── Fayl o'qish va moslashtirish ──────────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const mapped = raw.map(row => {
          // qatorning ustunlarini normallashtirilgan kalit bilan saqlash
          const lk = {};
          Object.keys(row).forEach(k => { lk[norm(k)] = row[k]; });
          const obj = {};
          columns.forEach(col => {
            let val = '';
            for (const alias of [col.header, ...(col.aliases || [])]) {
              const v = lk[norm(alias)];
              if (v !== undefined && v !== '') { val = v; break; }
            }
            obj[col.key] = typeof val === 'string' ? val.trim() : val;
          });
          return obj;
        });

        const valid = mapped.filter(o => columns.every(c => !c.required || String(o[c.key] ?? '').trim() !== ''));
        setPreview({ rows: valid, total: raw.length, invalid: raw.length - valid.length });
      } catch {
        alert("Faylni o'qib bo'lmadi. Bu haqiqiy Excel (.xlsx) fayl ekanini tekshiring.");
      }
      e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Import ────────────────────────────────────────────────────────────────
  const doImport = () => {
    if (!preview?.rows.length) return;
    const res = onImport(preview.rows) || {};
    const added = res.added ?? preview.rows.length;
    const skipped = res.skipped ?? 0;
    alert(`✅ Import tugadi!\n\nQo'shildi: ${added} ta` + (skipped ? `\nO'tkazib yuborildi (dublikat yoki bo'sh): ${skipped} ta` : ''));
    setPreview(null);
  };

  const btn = { padding: '10px 18px', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 };

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, marginBottom: 18, overflow: 'hidden' }}>
      <div style={{ background: color, color: '#fff', padding: '10px 16px', fontWeight: 'bold' }}>{title}</div>
      <div style={{ padding: 16 }}>
        {hint && <p style={{ fontSize: 13, color: '#555', marginTop: 0, lineHeight: 1.6 }}>{hint}</p>}

        <div style={{ fontSize: 12, color: '#777', marginBottom: 10 }}>
          Ustunlar: <strong>{columns.map(c => c.header + (c.required ? '*' : '')).join('  |  ')}</strong>
          <span style={{ marginLeft: 6 }}>( * — majburiy )</span>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={downloadTemplate} style={{ ...btn, background: '#455a64', color: '#fff' }}>
            ⬇️ Shablonni yuklab olish
          </button>
          <label style={{ ...btn, background: color, color: '#fff', display: 'inline-block' }}>
            📂 To'ldirilgan faylni tanlash
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
          </label>
        </div>

        {/* Ko'rib chiqish */}
        {preview && (
          <div style={{ marginTop: 16, background: '#f9f9f9', border: '1px solid #eee', borderRadius: 6, padding: 14 }}>
            <div style={{ fontSize: 14, marginBottom: 10 }}>
              Faylda <strong>{preview.total}</strong> ta qator topildi.
              Import qilinadi: <strong style={{ color: '#2e7d32' }}>{preview.rows.length}</strong> ta.
              {preview.invalid > 0 && <span style={{ color: '#c62828' }}>  (majburiy maydoni bo'sh: {preview.invalid} ta o'tkazib yuboriladi)</span>}
            </div>

            {preview.rows.length > 0 && (
              <table className="data-table" style={{ width: '100%', marginBottom: 12 }}>
                <thead>
                  <tr>{columns.map(c => <th key={c.key}>{c.header}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>{columns.map(c => <td key={c.key} style={{ fontSize: 12 }}>{String(r[c.key] ?? '') || '—'}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            )}
            {preview.rows.length > 5 && <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>... va yana {preview.rows.length - 5} ta</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={doImport} disabled={!preview.rows.length} style={{ ...btn, background: '#2e7d32', color: '#fff', opacity: preview.rows.length ? 1 : 0.5 }}>
                ✓ {preview.rows.length} ta yozuvni import qilish
              </button>
              <button onClick={() => setPreview(null)} style={{ ...btn, background: '#eee', color: '#333' }}>Bekor qilish</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
