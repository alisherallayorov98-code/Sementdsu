// ─────────────────────────────────────────────────────────────────────────────
// XARAJAT HISOBOTI (admin uchun)
//
// "Nimaga qancha xarajat bo'lgan?" — tayyor, filtrlanadigan hisobot.
// Chiqimlar (manba: naqd/bank/click kassa yozuvlari, manfiy summa, avtomatik
// EMAS) mijoz/guruh bo'yicha, uning ichida esa XARAJAT TURI bo'yicha
// guruhlanadi. Masalan:
//     Ishxona xarajatlari .................... 3 200 000
//        · 571 moshin moykasi ................... 450 000
//        · ovqatlanish ......................... 1 800 000
//        · taksi ................................. 950 000
//
// Har bir tur ochilib, alohida yozuvlar (sana, summa, izoh) ko'riladi.
// Sana oralig'i bo'yicha filtr — davr hisoboti uchun.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react';
import DateRangeFilter from './DateRangeFilter';
import ExcelExport from './ExcelExport';
import { filterByRange } from '../lib/dateRange';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');

const UNGROUPED = '(guruhsiz)';
const UNTYPED   = '(tur ko\'rsatilmagan)';

// Transfer (kanallararo o'tkazma) yozuvini chiqimdan ajratamiz — bu haqiqiy
// xarajat emas, pul shunchaki bir kanaldan ikkinchisiga ko'chgan.
const isTransfer = (r) => String(r.desc || '').trim().startsWith('↔️');

export default function ExpenseReport({ cashRows = [], bankRows = [], clickRows = [] }) {
  const [range, setRange]   = useState({ from: '', to: '' });
  const [search, setSearch] = useState('');
  const [openGroup, setOpenGroup] = useState({});   // qaysi guruhlar ochiq
  const [openType,  setOpenType]  = useState({});   // qaysi turlar ochiq

  // Barcha chiqim yozuvlari (kanal belgisi bilan)
  const allExpenses = useMemo(() => {
    const tag = (arr, ch) => (arr || [])
      .filter(r => Number(r.amount) < 0 && !r.auto && !isTransfer(r))
      .map(r => ({ ...r, _ch: ch, _abs: Math.abs(Number(r.amount || 0)) }));
    return [...tag(cashRows, 'naqd'), ...tag(bankRows, 'bank'), ...tag(clickRows, 'click')];
  }, [cashRows, bankRows, clickRows]);

  // Sana oralig'i + qidiruv filtri
  const filtered = useMemo(() => {
    let rows = filterByRange(allExpenses, range);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(r =>
        String(r.customer || '').toLowerCase().includes(q) ||
        String(r.expenseType || '').toLowerCase().includes(q) ||
        String(r.desc || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [allExpenses, range, search]);

  // Guruh → tur → yozuvlar
  const groups = useMemo(() => {
    const g = {};
    for (const r of filtered) {
      const gk = String(r.customer || '').trim() || UNGROUPED;
      const tk = String(r.expenseType || '').trim() || UNTYPED;
      (g[gk] ||= { total: 0, types: {} });
      g[gk].total += r._abs;
      (g[gk].types[tk] ||= { total: 0, rows: [] });
      g[gk].types[tk].total += r._abs;
      g[gk].types[tk].rows.push(r);
    }
    // Guruhlarni summasi bo'yicha kamayish tartibida
    return Object.entries(g)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, data]) => ({
        name, total: data.total,
        types: Object.entries(data.types)
          .sort((a, b) => b[1].total - a[1].total)
          .map(([tname, td]) => ({ name: tname, total: td.total, rows: td.rows.sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0)) })),
      }));
  }, [filtered]);

  const grandTotal = filtered.reduce((s, r) => s + r._abs, 0);

  // Excel uchun tekis ro'yxat
  const excelRows = filtered.map(r => ({
    guruh: String(r.customer || '').trim() || UNGROUPED,
    tur:   String(r.expenseType || '').trim() || UNTYPED,
    sana:  r.date,
    summa: r._abs,
    kanal: r._ch,
    izoh:  r.desc || '',
  }));

  const CH_LBL = { naqd: '💵', bank: '🏦', click: '📱' };

  return (
    <div>
      <div style={{ background: '#e0f2f1', border: '1px solid #80cbc4', borderRadius: 6, padding: 12, marginBottom: 14, fontSize: 12.5, color: '#00695c', lineHeight: 1.6 }}>
        Bu yerda chiqimlar <b>guruh</b> (masalan "Ishxona xarajatlari") va uning
        ichida <b>xarajat turi</b> (moyka, taksi, remont...) bo'yicha jamlanadi.
        Turlar chiqim yozganda kiritiladi — bu yerda faqat natija ko'rinadi.
      </div>

      {/* Filtrlar */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <DateRangeFilter value={range} onChange={setRange} color="#00695c" label="📅 Davr:" />
        <input placeholder="🔍 Guruh, tur yoki izoh..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '7px 10px', fontSize: 13, border: '1px solid #80cbc4', borderRadius: 4, width: 240 }} />
        <ExcelExport
          filename="Xarajatlar_hisoboti"
          sheetName="Xarajatlar"
          title="Xarajatlar hisoboti"
          columns={[
            { header: 'Guruh', value: r => r.guruh },
            { header: 'Xarajat turi', value: r => r.tur },
            { header: 'Sana', value: r => r.sana },
            { header: 'Summa', value: r => r.summa },
            { header: 'Kanal', value: r => r.kanal },
            { header: 'Izoh', value: r => r.izoh },
          ]}
          rows={excelRows}
        />
      </div>

      {/* Umumiy jami */}
      <div style={{ background: '#00695c', color: '#fff', borderRadius: 8, padding: '12px 18px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, opacity: 0.9 }}>
          Jami xarajat {range.from || range.to ? '(tanlangan davrda)' : '(butun davr)'}:
        </span>
        <span style={{ fontSize: 22, fontWeight: 'bold', fontFamily: 'monospace' }}>{fmt(grandTotal)} so'm</span>
      </div>

      {groups.length === 0 ? (
        <div style={{ color: '#888', fontStyle: 'italic', padding: 20, textAlign: 'center' }}>
          Bu shartlar bo'yicha xarajat topilmadi.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {groups.map(g => {
            const gOpen = openGroup[g.name] !== false; // standart — ochiq
            const pct = grandTotal > 0 ? Math.round((g.total / grandTotal) * 100) : 0;
            return (
              <div key={g.name} style={{ border: '1px solid #b2dfdb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                {/* Guruh sarlavhasi */}
                <div onClick={() => setOpenGroup(p => ({ ...p, [g.name]: !gOpen }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', cursor: 'pointer', background: '#e0f2f1' }}>
                  <span style={{ fontSize: 12, color: '#00695c', width: 14 }}>{gOpen ? '▼' : '▶'}</span>
                  <span style={{ fontWeight: 'bold', fontSize: 14, color: '#004d40', flex: 1 }}>
                    {g.name === UNGROUPED ? <span style={{ color: '#999' }}>{g.name}</span> : g.name}
                  </span>
                  <span style={{ fontSize: 11, color: '#00695c', background: '#b2dfdb', padding: '2px 8px', borderRadius: 10 }}>{pct}%</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 15, color: '#004d40', minWidth: 130, textAlign: 'right' }}>
                    {fmt(g.total)} so'm
                  </span>
                </div>

                {/* Turlar */}
                {gOpen && (
                  <div style={{ padding: '4px 0' }}>
                    {g.types.map(t => {
                      const tKey = g.name + '||' + t.name;
                      const tOpen = !!openType[tKey];
                      return (
                        <div key={t.name}>
                          <div onClick={() => setOpenType(p => ({ ...p, [tKey]: !tOpen }))}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 8px 34px', cursor: 'pointer', borderTop: '1px solid #f0f0f0' }}>
                            <span style={{ fontSize: 10, color: '#888', width: 12 }}>{tOpen ? '▼' : '▶'}</span>
                            <span style={{ fontSize: 13, flex: 1, color: t.name === UNTYPED ? '#999' : '#333' }}>
                              {t.name} <span style={{ color: '#aaa', fontSize: 11 }}>({t.rows.length} ta)</span>
                            </span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13, color: '#c62828', minWidth: 120, textAlign: 'right' }}>
                              {fmt(t.total)}
                            </span>
                          </div>

                          {/* Alohida yozuvlar */}
                          {tOpen && (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: '#fafafa' }}>
                              <tbody>
                                {t.rows.map(r => (
                                  <tr key={r.id} style={{ borderTop: '1px solid #eee' }}>
                                    <td style={{ padding: '5px 14px 5px 56px', color: '#666', whiteSpace: 'nowrap' }}>{r.date}</td>
                                    <td style={{ padding: '5px 8px', textAlign: 'center' }}>{CH_LBL[r._ch] || ''}</td>
                                    <td style={{ padding: '5px 8px', color: '#555' }}>{r.desc || '—'}</td>
                                    <td style={{ padding: '5px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#c62828', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                      {fmt(r._abs)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
