import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import ExcelExport from '../components/ExcelExport';
import Paginator from '../components/Paginator';
import CustomerCard from '../components/CustomerCard';
import DateRangeFilter from '../components/DateRangeFilter';
import { filterByRange } from '../lib/dateRange';
import { nameKey } from '../lib/customerRef';
import { useFocusRow, FOCUS_STYLE } from '../lib/useFocusRow';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };

// ─── Tarjimonlar ─────────────────────────────────────────────────────────────
const L = {
  mijoz:        { latn: 'Mijoz',              cyrl: 'Мижоз'              },
  avans:        { latn: 'Avans summasi',      cyrl: 'Аванс суммаси'     },
  ishlatildi:   { latn: 'Ishlatildi',         cyrl: 'Ишлатилди'          },
  qoldi:        { latn: 'Qolgan avans',       cyrl: 'Қолган аванс'      },
  qoshish:      { latn: "Qo'shish",           cyrl: 'Қўшиш'              },
  ishlatish:    { latn: 'Ishlatish',          cyrl: 'Ишлатиш'            },
  sana:         { latn: 'Sana',              cyrl: 'Сана'                },
  jami:         { latn: 'Jami avans',        cyrl: 'Жами аванс'         },
  jamiAll:      { latn: 'Umumiy avans',      cyrl: 'Умумий аванс'       },
  jamiUsed:     { latn: 'Jami ishlatildi',   cyrl: 'Жами ишлатилди'     },
  jamiLeft:     { latn: 'Jami qolgan',       cyrl: 'Жами қолган'        },
  miqdor:       { latn: 'Miqdor',            cyrl: 'Миқдор'              },
  izoh:         { latn: 'Izoh',              cyrl: 'Изоҳ'                },
  ishlatishIzoh:{ latn: 'Ishlatish izohi',  cyrl: 'Ишлатиш изоҳи'     },
  qidirish:     { latn: 'Qidirish...',       cyrl: 'Қидириш...'          },
  barchasi:     { latn: 'Barchasi',          cyrl: 'Барчаси'             },
  tugamagan:    { latn: 'Tugamagan',         cyrl: 'Тугамаган'           },
  qisman:       { latn: 'Qisman',            cyrl: 'Қисман'              },
  toliqIshlatilgan: { latn: "To'liq ishlatilgan", cyrl: 'Тўлиқ ишлатилган' },
  tarix:        { latn: 'Ishlatish tarixi', cyrl: 'Ишлатиш тарихи'     },
  yopish:       { latn: 'Yopish',           cyrl: 'Ёпиш'                },
  yozuvYoq:     { latn: 'Yozuv topilmadi.', cyrl: 'Ёзув топилмади.'    },
  xodim:        { latn: 'Xodim',            cyrl: 'Ходим'               },
  holat:        { latn: 'Holat',            cyrl: 'Ҳолат'               },
};

// ─── Holat ───────────────────────────────────────────────────────────────────
function getStatus(amount, used) {
  const rem = Number(amount) - Number(used);
  if (rem <= 0)          return 'full';
  if (Number(used) > 0)  return 'partial';
  return 'none';
}

const STATUS_STYLE = {
  full:    { bg: '#fff3e0', border: '#ff9800', color: '#e65100', label: { latn: "To'liq ishlatilgan", cyrl: 'Тўлиқ ишлатилган' } },
  partial: { bg: '#e3f2fd', border: '#1976d2', color: '#1565c0', label: { latn: 'Qisman',             cyrl: 'Қисман'            } },
  none:    { bg: '#fff',    border: '#4caf50', color: '#2e7d32', label: { latn: 'Tugamagan',           cyrl: 'Тугамаган'         } },
};

// ─── ASOSIY KOMPONENT ────────────────────────────────────────────────────────
export default function Advances({ lang }) {
  // Bu sahifa FAQAT KO'RISH uchun (hisobot + tarix), xuddi Qarzlar kabi.
  // Avans qabul qilish — Kassir → Kirim; sarflash — Sotishda "avans" turi.
  // Shu sababli addAdvanceRow va spendAdvance bu yerdan olib tashlangan:
  // ular kassaga to'g'ridan-to'g'ri yozardi va pul ikkita turli joydan
  // kirib, hisobni kuzatish qiyinlashardi.
  const {
    advanceRows,
    totalAdvances, totalAdvancesUsed, totalAdvancesAll,
    salesRows, soldRows, skladRows,
  } = useData();

  const [search, setSearch]   = useState('');
  const [range,  setRange]    = useState({ from: '', to: '' });
  const [filter, setFilter]   = useState('all'); // 'all' | 'none' | 'partial' | 'full'
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;
  const [history, setHistory] = useState(null);

  // Avans sarfi qaysi sotuvdan kelgan — uchala sotuv turida ham qidiramiz
  // (ulgurji "Sotish", eski "Sotilgan tonna", chakana sklad kg).
  const srcOf = (saleId) => {
    if (saleId == null) return '—';
    const s1 = (salesRows || []).find(r => r.id === saleId);
    if (s1) return `📦 Sotuv: ${fmtT(s1.tons)} tn × ${fmt(s1.pricePerTon)}`;
    const s2 = (soldRows || []).find(r => r.id === saleId);
    if (s2) return `📦 Sotuv (eski): ${fmtT(s2.tons)} tn × ${fmt(s2.pricePerTon)}`;
    const s3 = (skladRows || []).find(r => r.id === saleId);
    if (s3) return `🏗 Sklad: ${Math.abs(Number(s3.kg || 0))} kg`;
    return `— (sotuv o'chirilgan)`;
  };
  const [card, setCard]       = useState(null); // ochilgan mijoz kartochkasi (ismi)

  // ── Filtrlash ───────────────────────────────────────────────────────────────
  // Qidiruv normallashtirilgan ism bo'yicha: "ali" yozilganda apostrof yoki
  // probel farqi bilan yozilgan variant ham topiladi.
  // (nameKey String() qiladi — customer maydoni bo'sh qatorda .toLowerCase()
  // to'g'ridan-to'g'ri chaqirilsa xato berardi.)
  const searchKey = nameKey(search);
  const filtered = filterByRange(advanceRows, range)
    .filter(r => {
      const st = getStatus(r.amount, r.used);
      if (filter !== 'all' && st !== filter) return false;
      if (searchKey && !nameKey(r.customer).includes(searchKey)) return false;
      return true;
    })
    .slice()
    .reverse();

  useEffect(() => { setPage(1); }, [search, filter, range.from, range.to]);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  // Mijoz kartochkasidagi 'manba' oynasidan kelinganda (?focus=id) shu avans
  // qatori ajratib ko'rsatiladi.
  const { rowRef: focusRef, isFocused } = useFocusRow(filtered, PAGE_SIZE, setPage);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', fontSize: 13 }}>

      {/* ── STATISTIKA PANELI ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <StatCard label={L.jamiAll[lang]}  value={fmt(totalAdvancesAll)}  color="#333"    bg="#f5f5f5" />
        <StatCard label={L.jamiUsed[lang]} value={fmt(totalAdvancesUsed)} color="#e65100" bg="#fff3e0" />
        <StatCard label={L.jamiLeft[lang]} value={fmt(totalAdvances)}     color="#2e7d32" bg="#e8f5e9" />
      </div>

      {/* Bu bo'lim — FAQAT KO'RISH (hisobot va tarix), xuddi Qarzlar kabi.
          Pul harakati bitta joydan boshqariladi: Kassir. Ilgari bu yerda
          avans qo'shish formasi va "ishlatish" tugmasi bor edi — ular
          kassaga to'g'ridan-to'g'ri yozardi, ya'ni pul ikkita turli
          joydan kirib, hisobni kuzatish qiyinlashardi. */}
      <div style={{
        background: '#e0f2f1', border: '1px solid #80cbc4', borderRadius: 6,
        padding: '10px 14px', marginBottom: 12, fontSize: 12.5, color: '#00695c', lineHeight: 1.7,
      }}>
        ℹ️ Bu bo'lim <b>faqat ko'rish uchun</b>. Avans <b>Kassir → Kirim</b> orqali qabul qilinadi
        (mijoz tanlanadi: qarzi bo'lsa avval qarz yopiladi, ortig'i avansga yoziladi).
        <br />
        Avans <b>“🅰️ Avansdan”</b> to'lov turi tanlanganda avtomatik ishlatiladi — eng eski
        avansdan boshlab. Bu tur quyidagi joylarda bor: <b>Sotish</b> · <b>Taqsimlash</b> ·
        <b> Kassir → Sotish (kg)</b> · <b>Sotilgan tonna</b> · <b>Olingan tonna → mijozga sotish</b>.
        Avans yetmasa, qolgan qismi qarzga yoziladi.
      </div>

      {/* ── SANA ORALIG'I FILTRI ──────────────────────────────────────────── */}
      <DateRangeFilter value={range} onChange={setRange} color="#e65100" />

      {/* ── FILTER va QIDIRUV ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder={L.qidirish[lang]}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inp, width: 180, border: '1px solid #aaa' }}
        />
        {[
          { key: 'all',     lbl: L.barchasi[lang]         },
          { key: 'none',    lbl: L.tugamagan[lang]         },
          { key: 'partial', lbl: L.qisman[lang]            },
          { key: 'full',    lbl: L.toliqIshlatilgan[lang]  },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={filterBtn(filter === f.key)}>
            {f.lbl}
          </button>
        ))}
        <span style={{ marginLeft: 6, color: '#888', fontSize: 11 }}>({filtered.length} ta)</span>
        <ExcelExport
          filename="Avanslar"
          sheetName="Avanslar"
          title="Avanslar hisoboti"
          columns={[
            { header: 'Sana', value: r => r.date },
            { header: 'Mijoz', value: r => r.customer },
            { header: 'Avans summasi', value: r => Number(r.amount || 0) },
            { header: 'Ishlatildi', value: r => Number(r.used || 0) },
            { header: 'Qolgan avans', value: r => Math.max(0, Number(r.amount || 0) - Number(r.used || 0)) },
            { header: 'Holat', value: r => STATUS_STYLE[getStatus(r.amount, r.used)].label.latn },
            { header: 'Izoh', value: r => r.note || '' },
          ]}
          rows={filtered}
        />
      </div>


      {/* ── TARIX MODAL ─────────────────────────────────────────────────── */}
      {history !== null && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.35)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={() => setHistory(null)}
        >
          <div
            style={{
              background: '#fff', padding: 24, borderRadius: 6,
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)', minWidth: 420, maxWidth: 580,
            }}
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const row    = advanceRows.find(r => r.id === history);
              const usages = row?.usages || [];
              return (
                <>
                  <div style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 12, color: '#003366' }}>
                    {L.tarix[lang]}: {row?.customer}
                  </div>
                  {usages.length === 0 ? (
                    <p style={{ color: '#888', fontStyle: 'italic' }}>{L.yozuvYoq[lang]}</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#e65100', color: '#fff' }}>
                          <th style={th}>#</th>
                          <th style={th}>{L.sana[lang]}</th>
                          <th style={{ ...th, textAlign: 'right' }}>{L.miqdor[lang]}</th>
                          <th style={th}>Nimaga ishlatildi</th>
                          <th style={th}>{L.izoh[lang]}</th>
                          <th style={th}>{L.xodim[lang]}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usages.map((u, i) => (
                          <tr key={u.id} style={{ background: i % 2 === 0 ? '#f9f9f9' : '#fff' }}>
                            <td style={td}>{i + 1}</td>
                            <td style={td}>{u.date}</td>
                            <td style={{ ...td, textAlign: 'right', color: '#e65100', fontWeight: 'bold' }}>{fmt(u.amount)}</td>
                            {/* Sarf qaysi sotuvdan kelganini ko'rsatamiz — ilgari
                                faqat "Sotuvga ishlatildi" degan umumiy izoh
                                turardi va qaysi sotuv ekanini topib bo'lmasdi. */}
                            <td style={{ ...td, fontSize: 12 }}>{srcOf(u.saleId)}</td>
                            <td style={td}>{u.note || '—'}</td>
                            <td style={td}>{u.worker || '—'}</td>
                          </tr>
                        ))}
                        <tr style={{ background: '#fff3e0', fontWeight: 'bold' }}>
                          <td colSpan={2} style={td}>Jami ishlatildi:</td>
                          <td style={{ ...td, textAlign: 'right', color: '#e65100' }}>{fmt(usages.reduce((s, u) => s + Number(u.amount || 0), 0))}</td>
                          <td colSpan={3} style={td}></td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                  <div style={{ marginTop: 16, textAlign: 'right' }}>
                    <button
                      onClick={() => setHistory(null)}
                      style={{ padding: '5px 20px', cursor: 'pointer', background: '#003366', color: '#fff', border: 'none', borderRadius: 3 }}
                    >
                      {L.yopish[lang]}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── ASOSIY JADVAL ────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <p style={{ color: '#888', fontStyle: 'italic', marginTop: 20 }}>{L.yozuvYoq[lang]}</p>
      ) : (
        <>
        <table className="data-table" style={{ width: '100%', maxWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th style={{ width: 80 }}>{L.sana[lang]}</th>
              <th>{L.mijoz[lang]}</th>
              <th style={{ textAlign: 'right', width: 120 }}>{L.avans[lang]}</th>
              <th style={{ textAlign: 'right', width: 110 }}>{L.ishlatildi[lang]}</th>
              <th style={{ textAlign: 'right', width: 110, color: '#2e7d32' }}>{L.qoldi[lang]}</th>
              <th style={{ width: 110 }}>{L.holat[lang]}</th>
              <th>{L.izoh[lang]}</th>
              <th style={{ width: 140 }}>Amal</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r, i) => {
              const remaining = Math.max(0, Number(r.amount) - Number(r.used));
              const st        = getStatus(r.amount, r.used);
              const ss        = STATUS_STYLE[st];
              return (
                <tr key={r.id}
                  ref={isFocused(r.id) ? focusRef : null}
                  style={isFocused(r.id) ? FOCUS_STYLE : { background: ss.bg }}>
                  <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{i + 1}</td>
                  <td style={{ fontSize: 12 }}>{r.date}</td>
                  <td onClick={() => setCard(r.customer)} title="Mijoz ma'lumotlarini ochish"
                    style={{ fontWeight: 'bold', color: '#003366', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>{r.customer}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.amount)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#e65100', fontWeight: 'bold' }}>{fmt(r.used)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#2e7d32', fontWeight: 'bold' }}>{fmt(remaining)}</td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '2px 7px', fontSize: 11,
                      border: `1px solid ${ss.border}`, borderRadius: 10,
                      color: ss.color, fontWeight: 'bold', whiteSpace: 'nowrap',
                    }}>
                      {ss.label[lang]}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: '#555' }}>{r.note || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {/* "Ishlatish" tugmasi olib tashlandi: avans Sotishda
                          "avans" to'lov turi tanlanganda avtomatik yechiladi.
                          Qo'lda ishlatish hisobni ikkiga bo'lardi. */}
                      {(r.usages || []).length > 0 && (
                        <button
                          onClick={() => setHistory(r.id)}
                          style={{ fontSize: 11, cursor: 'pointer', padding: '2px 7px', background: '#e3f2fd', border: '1px solid #1976d2', borderRadius: 3, color: '#1565c0' }}
                        >
                          📋 {L.tarix[lang]}
                        </button>
                      )}
                      {/* O'chirish tugmasi OLIB TASHLANDI: bu bo'lim faqat
                          ko'rish uchun (Qarzlar kabi). Avans Kassir → Kirim
                          orqali paydo bo'ladi — xato yozuvni ham o'sha
                          yerdan tuzatish kerak, aks holda avans o'chib,
                          kassadagi puli qayerdan kelgani noaniq qolardi. */}
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Jami qator */}
            <tr style={{ background: '#ffff00', fontWeight: 'bold' }}>
              <td colSpan={3} style={{ paddingLeft: 8 }}>{L.jami[lang]}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(filtered.reduce((s, r) => s + Number(r.amount), 0))}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#e65100' }}>{fmt(filtered.reduce((s, r) => s + Number(r.used), 0))}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#2e7d32' }}>{fmt(filtered.reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.used)), 0))}</td>
              <td colSpan={3}></td>
            </tr>
          </tbody>
        </table>
        <Paginator total={filtered.length} page={page} setPage={setPage} pageSize={PAGE_SIZE} />
        </>
      )}

      {card && <CustomerCard name={card} onClose={() => setCard(null)} />}
    </div>
  );
}

// ─── Yordamchi komponent: statistika kartochkasi ─────────────────────────────
function StatCard({ label, value, color, bg }) {
  return (
    <div style={{
      padding: '8px 16px', background: bg, border: `1px solid ${color}33`,
      borderLeft: `4px solid ${color}`, borderRadius: 4, minWidth: 160,
    }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 'bold', color, fontFamily: 'monospace' }}>{value} so'm</div>
    </div>
  );
}

// ─── Stil konstantalar ───────────────────────────────────────────────────────
const inp = {
  padding: '4px 6px', fontSize: 13,
  border: '1px solid #ccc', borderRadius: 3, width: 160,
};


const filterBtn = (active) => ({
  padding: '3px 10px', cursor: 'pointer',
  fontFamily: 'Tahoma, sans-serif', fontSize: 12,
  border: active ? '2px inset #ffffff' : '2px outset #ffffff',
  background: active ? '#003366' : '#f0f0f0',
  color: active ? '#fff' : '#333',
  fontWeight: active ? 'bold' : 'normal',
});

const th = {
  padding: '5px 8px', textAlign: 'left',
  border: '1px solid #bf360c', fontWeight: 'bold',
};

const td = {
  padding: '5px 8px', border: '1px solid #ddd',
};
