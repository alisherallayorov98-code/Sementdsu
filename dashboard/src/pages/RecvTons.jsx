import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { useData } from '../context/DataContext';
import ExcelExport from '../components/ExcelExport';
import Paginator from '../components/Paginator';
import SupplierSelect from '../components/SupplierSelect';
import CustomerSelect from '../components/CustomerSelect';
import DateRangeFilter from '../components/DateRangeFilter';
import { filterByRange } from '../lib/dateRange';

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(3); };
const todayFull = () => {
  const d = new Date();
  return [String(d.getDate()).padStart(2,'0'), String(d.getMonth()+1).padStart(2,'0'), d.getFullYear()].join('.');
};

const XODIMLAR = ['Botir aka','Alisher aka','Ganisher aka','Sharofidin','Saloh','Qosim','Anvarjon'];
const TOLOV    = [
  { v:'naqd',  latn:'Naqd',  cyrl:'Нақд'  },
  { v:'bank',  latn:'Bank',  cyrl:'Банк'  },
  { v:'click', latn:'Click', cyrl:'Клик'  },
];

const L = {
  import_btn:   { latn:'Excel yuklash',         cyrl:'Excel юклаш'          },
  shablon:      { latn:"Shablon yuklab olish",   cyrl:'Шаблон юклаб олиш'   },
  qoshish:      { latn:"Qo'shish",               cyrl:'Қўшиш'               },
  manbaa:       { latn:'Manbaa (zavod)',          cyrl:'Манба (завод)'        },
  marka:        { latn:'Sement markasi',          cyrl:'Семент маркаси'       },
  mashina:      { latn:'Mashina №',              cyrl:'Машина №'             },
  tonna:        { latn:'Tonna',                  cyrl:'Тонна'                },
  narx:         { latn:'Narx (1 tn)',             cyrl:'Нарх (1 тн)'          },
  jami:         { latn:'Jami summa',             cyrl:'Жами сумма'           },
  tolov:        { latn:"To'lov usuli",           cyrl:'Тўлов усули'          },
  karta:        { latn:'Karta nomi',             cyrl:'Карта номи'           },
  sana:         { latn:'Sana',                   cyrl:'Сана'                 },
  vaqt:         { latn:'Vaqt (zavod)',            cyrl:'Вақт (завод)'         },
  xodim:        { latn:'Xodim',                  cyrl:'Ходим'                },
  izoh:         { latn:'Izoh',                   cyrl:'Изоҳ'                 },
  jami_ton:     { latn:'Jami tonna',             cyrl:'Жами тонна'           },
  jami_summa:   { latn:'Jami summa',             cyrl:'Жами сумма'           },
  jami_lbl:     { latn:'JAMI',                   cyrl:'ЖАМИ'                 },
  yoq:          { latn:'Yozuv topilmadi.',        cyrl:'Ёзув топилмади.'      },
  filter_manbaa:{ latn:'Manbaa:',                cyrl:'Манба:'               },
  filter_marka: { latn:'Marka:',                 cyrl:'Марка:'               },
  hammasi:      { latn:'Hammasi',                cyrl:'Ҳаммаси'              },
  preview:      { latn:'Preview (import)',        cyrl:'Превью (импорт)'      },
  import_ok:    { latn:"Barchasini qo'shish",    cyrl:'Барчасини қўшиш'      },
  import_close: { latn:'Bekor qilish',           cyrl:'Бекор қилиш'          },
  akt_title:    { latn:'Akt Sverka',             cyrl:'Акт Сверка'           },
  akt_kim:      { latn:'Tashkilot: SEMENT KORXONA', cyrl:'Ташкилот: СЕМЕНТ КОРХОНА' },
  akt_manbaa:   { latn:'Manbaa (zavod):',        cyrl:'Манба (завод):'       },
  akt_sana:     { latn:'Tuzilgan:',              cyrl:'Тузилган:'            },
  akt_qoldi:    { latn:'QOLDIQ QARZ:',           cyrl:'ҚОЛДИҚ ҚАРЗ:'        },
  akt_kassa:    { latn:'Mas\'ul: _______________', cyrl:'Масъул: _______________' },
  akt_zavod:    { latn:'Zavod: _______________', cyrl:'Завод: _______________' },
  chop:         { latn:'Chop etish',             cyrl:'Чоп этиш'             },
  yopish:       { latn:'Yopish',                 cyrl:'Ёпиш'                 },
  tarixi:       { latn:'Yetkazma tarixi va Akt Sverka', cyrl:'Етказма тарихи ва Акт Сверка' },
  tolash:       { latn:"To'lash",                cyrl:'Тўлаш'                },
  ochirish:     { latn:"O'chirish",              cyrl:'Ўчириш'               },
};

// ── Shablon Excel yaratish ────────────────────────────────────────────────────
const downloadTemplate = () => {
  // Ustunlar: A=имя, B=марка, C=номер, D=объем, E=цена, F=сумма, G=время, H=карта
  // (Avvalgi versiyadagi ortiqcha bo'sh ustun olib tashlandi.)
  const headers = [
    'имя клиента', 'Марка цемента', 'Номер автомобиля',
    'объем', 'Цена за еден', 'Сумма',
    'Время выезда из завода', 'Название бумажной карты'
  ];
  const example = [
    'ZAVOD NOMI MCHJ', '42.5B-K мешание', '30953LBA',
    50, 670000, 33500000,
    '2026-06-08 22:35:42', 'A26007338 (2)'
  ];
  const ws  = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb  = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sement');
  XLSX.writeFile(wb, 'sement_shablon.xlsx');
};

export default function RecvTons({ lang }) {
  const {
    recvRows, addRecvRow, updateRecvRow, deleteRecvRow, importRecvRows, verifyRecvRow,
    addSaleRow, updateSaleRow, addSupplier,
    currentWorker, setCurrentWorker,
    warehouses, defaultWhId, currentUser, appSettings,
    skladRows, addSkladKirim,
    salesRows, skladSourceIds,
    cementTypes,
  } = useData();
  const [editRecv, setEditRecv] = useState(null); // tahrirlash uchun
  const myWh = currentUser?.warehouseId || defaultWhId;
  const [verifyRow, setVerifyRow] = useState(null); // tasdiqlash modali
  // Taqsimlash: har bir qator { id, type:'sklad'|'mijoz', customer, tons, pricePerTon, paymentChannel }
  const [splits, setSplits] = useState([]);
  const [range, setRange] = useState({ from: '', to: '' }); // sana oralig'i filtri
  const [selected, setSelected] = useState(new Set()); // ommaviy tanlash

  const [form, setForm] = useState({
    source:'', brand:'', vehicleNo:'', tons:'', pricePerTon:'',
    paymentChannel:'bank', cardName:'', factoryTime:'', izoh:'', warehouseId:'',
    cementType:'',
  });
  const [filterSource, setFilterSource] = useState('');
  const [filterBrand,  setFilterBrand]  = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;
  const [importRows,   setImportRows]   = useState(null); // Excel preview
  const [modalSource,  setModalSource]  = useState(null); // Akt Sverka

  const fileRef  = useRef();
  const printRef = useRef();

  // ── Qo'lda qo'shish ──────────────────────────────────────────────────────
  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.source) { alert('Zavod / Manba nomini kiriting!'); return; }
    if (!form.tons)   { alert('Tonna kiritilmagan!'); return; }
    addSupplier({ name: form.source }); // yangi manbaani bazaga saqlab qo'yamiz
    const created = addRecvRow({
      source: form.source, brand: form.brand,
      vehicleNo: form.vehicleNo, tons: form.tons,
      pricePerTon: form.pricePerTon || 0,
      paymentChannel: form.paymentChannel,
      cardName: form.cardName, factoryTime: form.factoryTime,
      izoh: form.izoh,
      warehouseId: form.warehouseId || myWh,
      cementType: form.cementType || '',
    });
    if (!created) return; // rad etilsa forma tozalanmaydi
    setForm({ source:'', brand:'', vehicleNo:'', tons:'', pricePerTon:'',
              paymentChannel:'bank', cardName:'', factoryTime:'', izoh:'', warehouseId:'', cementType:'' });
  };

  // ── Excel import ──────────────────────────────────────────────────────────
  // Excel katakchasidagi sonni ishonchli o'qish.
  // Number("12,5") = NaN — mahalliy (rus) Excel'da kasr VERGUL bilan yoziladi,
  // minglar esa probel bilan ajratiladi. Ilgari bunday qatorlar `if (!tons)`
  // sharti bilan JIMGINA tashlab ketilardi: 100 qator yuklab 60 tasi kelardi.
  const xlNum = (v) => {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    const s = String(v ?? '').trim()
      .replace(/\s| /g, '')   // probel va uzilmas probel
      .replace(',', '.');           // vergulli kasr
    if (!s) return NaN;
    const n = Number(s);
    return isFinite(n) ? n : NaN;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => alert("Faylni o'qib bo'lmadi.");
    reader.onload = (ev) => {
      let data;
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'binary', cellDates: true });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        if (!ws) { alert("Faylda varaq topilmadi."); return; }
        data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      } catch (err) {
        // Ilgari xato ushlanmasdi — buzuq fayl yuklansa hech qanday javob
        // bo'lmay, foydalanuvchi nima bo'lganini bilmay qolardi.
        alert(`Excel faylni o'qishda xato:\n${err?.message || err}`);
        return;
      }

      // 1-qator sarlavha, 2-qatordan boshlab ma'lumot.
      // A=imya(0) B=marka(1) C=avto(2) D=hajm(3) E=narx(4) F=summa(5) G=vaqt(6) H=karta(7)
      const rows = [];
      const skipped = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.every(c => String(c ?? '').trim() === '')) continue; // butunlay bo'sh qator
        const tons  = xlNum(row[3]);          // D ustun (hajm)
        const price = xlNum(row[4]);          // E ustun (narx)
        if (!isFinite(tons) || tons <= 0) {
          skipped.push(`${i + 1}-qator: hajm "${row[3]}" o'qilmadi`);
          continue;
        }
        const p = isFinite(price) && price > 0 ? price : 0;
        const summa = xlNum(row[5]);
        rows.push({
          source:     String(row[0] || '').trim(),
          brand:      String(row[1] || '').trim(),
          vehicleNo:  String(row[2] || '').trim(),
          tons,
          pricePerTon: p,
          summa:      isFinite(summa) && summa > 0 ? summa : tons * p,
          factoryTime: row[6] ? String(row[6]).trim() : '',
          cardName:   String(row[7] || '').trim(),
          paymentChannel: 'naqd',
          izoh: '',
        });
      }
      // Tashlab ketilgan qatorlar haqida XABAR BERAMIZ (ilgari sukut saqlanardi)
      if (skipped.length) {
        alert(
          `${rows.length} qator o'qildi, ${skipped.length} qator tashlab ketildi:\n\n` +
          skipped.slice(0, 10).join('\n') +
          (skipped.length > 10 ? `\n...yana ${skipped.length - 10} ta` : '')
        );
      }
      if (!rows.length && !skipped.length) alert("Faylda ma'lumot topilmadi.");
      setImportRows(rows);
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  // Excel import tasdiqlash (tarixiy ma'lumot — kassaga ta'sir qilmaydi, unikal id)
  const confirmImport = () => {
    if (!importRows) return;
    importRecvRows(importRows);
    setImportRows(null);
  };

  // ── Tasdiqlash (+ ixtiyoriy birdan sotish) ───────────────────────────────
  const openVerify = (r) => {
    setVerifyRow({ ...r });
    setSplits([]);
  };
  const closeVerify = () => { setVerifyRow(null); setSplits([]); };

  const addSplit = (type) => setSplits(p => [...p, { id: Date.now(), type, customer: '', tons: '', pricePerTon: '', paymentChannel: 'naqd' }]);
  const updateSplit = (id, field, val) => setSplits(p => p.map(s => s.id === id ? { ...s, [field]: val } : s));
  const removeSplit = (id) => setSplits(p => p.filter(s => s.id !== id));

  const confirmVerify = () => {
    if (!verifyRow.source) { alert('Zavod nomini kiriting'); return; }
    const tons = Number(verifyRow.tons) || 0;
    // Taqsimlash validatsiyasi
    const splitTotal = splits.reduce((s, sp) => s + (Number(sp.tons) || 0), 0);
    if (splitTotal > tons + 0.001) { alert(`Taqsimlangan tonna (${splitTotal}) umumiy tonnadan (${tons}) oshib ketdi!`); return; }
    for (const sp of splits) {
      if (!Number(sp.tons)) { alert('Har bir taqsimlash qatorida tonna kiriting'); return; }
      if (sp.type === 'mijoz' && (!sp.customer || !sp.pricePerTon)) { alert('Mijoz uchun mijoz ismi va narxini kiriting'); return; }
    }
    addSupplier({ name: verifyRow.source });
    // 1) Tasdiqlash → yetkazib beruvchiga qarz
    verifyRecvRow(verifyRow.id, {
      source: verifyRow.source, brand: verifyRow.brand,
      tons, pricePerTon: Number(verifyRow.pricePerTon) || 0,
      paymentChannel: verifyRow.paymentChannel,
      warehouseId: verifyRow.warehouseId || myWh,
    });
    // 2) Taqsimlash — har bir qator
    const vehicleNo = verifyRow.vehicleNo || '';
    const desc = `${verifyRow.source}${verifyRow.brand ? ' · ' + verifyRow.brand : ''}`;
    for (const sp of splits) {
      const spTons = Number(sp.tons) || 0;
      if (sp.type === 'mijoz') {
        addSaleRow({
          customer: sp.customer,
          tons: spTons,
          pricePerTon: Number(sp.pricePerTon) || 0,
          paymentChannel: sp.paymentChannel,
          warehouseId: verifyRow.warehouseId || myWh,
          vehicleNo,
          date: verifyRow.factoryTime || verifyRow.date,
          factoryTime: verifyRow.factoryTime || '',
          note: `Zavod: ${verifyRow.source}`,
          recvId: verifyRow.id,
          cementType: verifyRow.cementType || '',
        });
      } else {
        addSkladKirim(verifyRow.id, spTons * 1000, desc, verifyRow.cementType || '');
      }
    }
    closeVerify();
  };

  // ── Filtrlar ──────────────────────────────────────────────────────────────
  const sourceList = [...new Set(recvRows.map(r => r.source).filter(Boolean))];
  const brandList  = [...new Set(recvRows.map(r => r.brand).filter(Boolean))];

  let filtered = recvRows;
  if (filterSource) filtered = filtered.filter(r => r.source === filterSource);
  if (filterBrand)  filtered = filtered.filter(r => r.brand  === filterBrand);
  filtered = filterByRange(filtered, range); // sanadan–sanagacha

  const totalTons = filtered.reduce((s,r) => s + Number(r.tons||0), 0);
  const totalSum  = filtered.reduce((s,r) => s + Number(r.tons||0)*Number(r.pricePerTon||0), 0);
  useEffect(() => { setPage(1); setSelected(new Set()); }, [filterSource, filterBrand, range.from, range.to]);
  const reversedFiltered = [...filtered].reverse();
  const paged = reversedFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSelect = (id) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const allPageSelected = paged.length > 0 && paged.every(r => selected.has(r.id));
  const toggleAllPage = () => {
    if (allPageSelected) {
      setSelected(prev => { const s = new Set(prev); paged.forEach(r => s.delete(r.id)); return s; });
    } else {
      setSelected(prev => { const s = new Set(prev); paged.forEach(r => s.add(r.id)); return s; });
    }
  };
  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    // Sotuvi bor yuklarni oldindan ajratamiz — aks holda har biri uchun
    // alohida ogohlantirish oynasi chiqib ketardi.
    const ids = [...selected];
    const blocked = ids.filter(id => salesRows.some(s => s.recvId === id));
    const free    = ids.filter(id => !blocked.includes(id));
    if (blocked.length && !window.confirm(
      `${blocked.length} ta yozuvdan sotuv qilingan — ular o'chirilmaydi.\n\n` +
      `Qolgan ${free.length} ta yozuv o'chirilsinmi?`
    )) return;
    if (!blocked.length && !window.confirm(`${selected.size} ta yozuv o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.`)) return;
    free.forEach(id => deleteRecvRow(id));
    setSelected(new Set());
  };

  // ── Akt Sverka chop etish ─────────────────────────────────────────────────
  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win     = window.open('','_blank');
    win.document.write(`
      <html><head><title>Akt Sverka - ${modalSource}</title>
      <style>
        body { font-family: Times New Roman, serif; margin:30px; color:#000; font-size:13px; }
        h2 { text-align:center; text-transform:uppercase; margin-bottom:4px; }
        table { width:100%; border-collapse:collapse; margin:8px 0; }
        th,td { border:1px solid #000; padding:4px 7px; font-size:11px; }
        th { background:#f0f0f0; font-weight:bold; }
        .total-row { background:#ffff00; font-weight:bold; }
        .sign { display:flex; justify-content:space-between; margin-top:40px; }
        @media print { button { display:none; } }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.print();
  };

  // ── Modal: manbaa tarixi + Akt Sverka ────────────────────────────────────
  const renderModal = () => {
    if (!modalSource) return null;
    const srcRows   = recvRows.filter(r => r.source === modalSource);
    const totTons   = srcRows.reduce((s,r) => s+Number(r.tons||0), 0);
    const totSum    = srcRows.reduce((s,r) => s+Number(r.tons||0)*Number(r.pricePerTon||0), 0);

    return (
      <div style={{
        position:'fixed', top:0, left:0, width:'100%', height:'100%',
        background:'rgba(0,0,0,0.5)', zIndex:1000,
        display:'flex', alignItems:'flex-start', justifyContent:'center',
        paddingTop:30, boxSizing:'border-box', overflowY:'auto',
      }} onClick={e => { if(e.target===e.currentTarget) setModalSource(null); }}>
        <div style={{
          background:'#fff', border:'2px solid #003366',
          width:'95%', maxWidth:960, maxHeight:'90vh', overflowY:'auto',
          boxShadow:'4px 4px 16px rgba(0,0,0,0.4)',
        }}>
          {/* Header */}
          <div style={{ background:'#003366', color:'#fff', padding:'8px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <b style={{ fontSize:14 }}>{L.tarixi[lang]}: {modalSource}</b>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={handlePrint} style={{ ...btnS, background:'#006600', color:'#fff', fontWeight:'bold' }}>
                🖨 {L.chop[lang]}
              </button>
              <button onClick={() => setModalSource(null)} style={{ ...btnS, background:'#cc0000', color:'#fff' }}>
                ✕ {L.yopish[lang]}
              </button>
            </div>
          </div>

          {/* Printable */}
          <div ref={printRef} style={{ padding:'16px 20px', fontFamily:'Tahoma, sans-serif', fontSize:13 }}>
            <h2 style={{ textAlign:'center', fontSize:16, margin:'0 0 4px' }}>{L.akt_title[lang]}</h2>
            <p style={{ textAlign:'center', margin:'2px 0 10px', fontSize:12, color:'#555' }}>
              {L.akt_kim[lang]}<br/>
              {L.akt_manbaa[lang]} <b>{modalSource}</b> &nbsp;|&nbsp;
              {L.akt_sana[lang]} <b>{todayFull()}</b>
            </p>

            {/* Yetkazmalar jadvali */}
            <p style={{ fontWeight:'bold', marginBottom:4 }}>Yetkazilgan sementlar:</p>
            <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:12 }}>
              <thead>
                <tr style={{ background:'#f0f0f0' }}>
                  <th style={thS}>#</th>
                  <th style={thS}>{L.sana[lang]}</th>
                  <th style={thS}>{L.marka[lang]}</th>
                  <th style={thS}>{L.mashina[lang]}</th>
                  <th style={thS}>{L.vaqt[lang]}</th>
                  <th style={{ ...thS, textAlign:'right' }}>{L.tonna[lang]}</th>
                  <th style={{ ...thS, textAlign:'right' }}>{L.narx[lang]}</th>
                  <th style={{ ...thS, textAlign:'right' }}>{L.jami[lang]}</th>
                  <th style={thS}>{L.tolov[lang]}</th>
                  <th style={thS}>{L.karta[lang]}</th>
                  <th style={thS}>{L.izoh[lang]}</th>
                </tr>
              </thead>
              <tbody>
                {srcRows.map((r, i) => {
                  const s = Number(r.tons||0)*Number(r.pricePerTon||0);
                  return (
                    <tr key={r.id} style={{ background: i%2===0?'#fff':'#f5f5f5' }}>
                      <td style={tdS}>{i+1}</td>
                      <td style={tdS}>{r.date}</td>
                      <td style={{ ...tdS, fontWeight:'bold', color:'#003366' }}>{r.brand||'—'}</td>
                      <td style={tdS}>{r.vehicleNo||'—'}</td>
                      <td style={{ ...tdS, fontSize:11 }}>{r.factoryTime||'—'}</td>
                      <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', fontFamily:'monospace' }}>{fmtT(r.tons)}</td>
                      <td style={{ ...tdS, textAlign:'right', fontFamily:'monospace' }}>{r.pricePerTon?fmt(r.pricePerTon):'—'}</td>
                      <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:'#006699', fontFamily:'monospace' }}>{s?fmt(s):'—'}</td>
                      <td style={tdS}>{r.paymentChannel||'—'}</td>
                      <td style={{ ...tdS, fontSize:11 }}>{r.cardName||'—'}</td>
                      <td style={tdS}>{r.izoh||'—'}</td>
                    </tr>
                  );
                })}
                {/* Jami */}
                <tr style={{ background:'#fffde8', fontWeight:'bold' }}>
                  <td colSpan={5} style={{ ...tdS, textAlign:'right' }}>JAMI:</td>
                  <td style={{ ...tdS, textAlign:'right', fontFamily:'monospace' }}>{fmtT(totTons)} tn</td>
                  <td style={tdS}></td>
                  <td style={{ ...tdS, textAlign:'right', color:'#006699', fontFamily:'monospace' }}>{fmt(totSum)}</td>
                  <td colSpan={3} style={tdS}></td>
                </tr>
              </tbody>
            </table>

            {/* Umumiy hisob */}
            <table style={{ borderCollapse:'collapse', marginBottom:20 }}>
              <tbody>
                <tr>
                  <td style={{ border:'1px solid #999', padding:'6px 14px', background:'#f0f8ff' }}>
                    <b style={{ color:'#003366' }}>Jami olingan tonna:</b>
                  </td>
                  <td style={{ border:'1px solid #999', padding:'6px 14px', background:'#f0f8ff', fontFamily:'monospace', fontWeight:'bold', color:'#003366' }}>
                    {fmtT(totTons)} tn
                  </td>
                  <td style={{ border:'2px solid #006699', padding:'6px 14px', background:'#006699' }}>
                    <b style={{ color:'#fff' }}>JAMI SUMMA:</b>
                  </td>
                  <td style={{ border:'2px solid #006699', padding:'8px 16px', background:'#f0f8ff', fontFamily:'monospace', fontWeight:'bold', color:'#006699', fontSize:16 }}>
                    {fmt(totSum)} so'm
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Imzo */}
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:30, paddingTop:10, borderTop:'1px solid #999' }}>
              <span style={{ fontSize:13 }}>{L.akt_kassa[lang]}</span>
              <span style={{ fontSize:13 }}>{L.akt_zavod[lang]}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Excel import preview modali ───────────────────────────────────────────
  const renderImportPreview = () => {
    if (!importRows) return null;
    const totTn = importRows.reduce((s,r) => s+Number(r.tons||0), 0);
    const totSm = importRows.reduce((s,r) => s+(Number(r.tons||0)*Number(r.pricePerTon||0)), 0);
    return (
      <div style={{
        position:'fixed', top:0, left:0, width:'100%', height:'100%',
        background:'rgba(0,0,0,0.6)', zIndex:2000,
        display:'flex', alignItems:'flex-start', justifyContent:'center',
        paddingTop:20, boxSizing:'border-box', overflowY:'auto',
      }}>
        <div style={{ background:'#fff', border:'2px solid #006600', width:'95%', maxWidth:1000, maxHeight:'90vh', overflowY:'auto', boxShadow:'4px 4px 16px rgba(0,0,0,0.5)' }}>
          <div style={{ background:'#006600', color:'#fff', padding:'8px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <b style={{ fontSize:14 }}>📊 {L.preview[lang]} — {importRows.length} ta yozuv</b>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={confirmImport} style={{ ...btnS, background:'#fff', color:'#006600', fontWeight:'bold', border:'2px solid #006600' }}>
                ✅ {L.import_ok[lang]}
              </button>
              <button onClick={() => setImportRows(null)} style={{ ...btnS, background:'#cc0000', color:'#fff' }}>
                ✕ {L.import_close[lang]}
              </button>
            </div>
          </div>
          <div style={{ padding:'12px 16px' }}>
            <table className="data-table" style={{ width:'100%', fontSize:12 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{L.manbaa[lang]}</th>
                  <th>{L.marka[lang]}</th>
                  <th>{L.mashina[lang]}</th>
                  <th style={{ textAlign:'right' }}>{L.tonna[lang]}</th>
                  <th style={{ textAlign:'right' }}>{L.narx[lang]}</th>
                  <th style={{ textAlign:'right' }}>{L.jami[lang]}</th>
                  <th>{L.vaqt[lang]}</th>
                  <th>{L.karta[lang]}</th>
                </tr>
              </thead>
              <tbody>
                {importRows.map((r, i) => (
                  <tr key={i} style={{ background: i%2===0?'#f0fff0':'#fff' }}>
                    <td style={{ textAlign:'center', color:'#888', fontSize:11 }}>{i+1}</td>
                    <td style={{ fontWeight:'bold', color:'#003366', fontSize:11 }}>{r.source}</td>
                    <td style={{ color:'#006699' }}>{r.brand}</td>
                    <td style={{ fontSize:11 }}>{r.vehicleNo}</td>
                    <td style={{ textAlign:'right', fontWeight:'bold', fontFamily:'monospace' }}>{fmtT(r.tons)}</td>
                    <td style={{ textAlign:'right', fontFamily:'monospace' }}>{r.pricePerTon?fmt(r.pricePerTon):'—'}</td>
                    <td style={{ textAlign:'right', fontWeight:'bold', color:'#006699', fontFamily:'monospace' }}>{r.summa?fmt(r.summa):'—'}</td>
                    <td style={{ fontSize:10, color:'#555' }}>{r.factoryTime}</td>
                    <td style={{ fontSize:10 }}>{r.cardName}</td>
                  </tr>
                ))}
                <tr style={{ background:'#ffff00', fontWeight:'bold' }}>
                  <td colSpan={4} style={{ textAlign:'right' }}>JAMI:</td>
                  <td style={{ textAlign:'right', fontFamily:'monospace' }}>{fmtT(totTn)} tn</td>
                  <td></td>
                  <td style={{ textAlign:'right', fontFamily:'monospace' }}>{fmt(totSm)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const inp = { padding:'3px 6px', fontFamily:'Tahoma, sans-serif', fontSize:12, border:'2px inset #ffffff' };
  const btnS = { padding:'3px 12px', fontFamily:'Tahoma, sans-serif', fontSize:12, cursor:'pointer', border:'2px outset #ffffff', background:'#f0f0f0' };

  return (
    <div style={{ fontFamily:'Tahoma, Verdana, Arial, sans-serif', fontSize:13 }}>

      {/* ── Excel import va shablon tugmalar ── */}
      <div style={{ display:'flex', gap:6, marginBottom:10, alignItems:'center', flexWrap:'wrap' }}>
        <button
          onClick={() => fileRef.current.click()}
          style={{ ...btnS, background:'#006600', color:'#fff', fontWeight:'bold', fontSize:13, padding:'4px 16px' }}
        >
          📂 {L.import_btn[lang]}
        </button>
        <button
          onClick={downloadTemplate}
          style={{ ...btnS, background:'#005599', color:'#fff', fontWeight:'bold', fontSize:13, padding:'4px 16px' }}
        >
          📋 {L.shablon[lang]}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} style={{ display:'none' }} />
        <span style={{ fontSize:11, color:'#666', marginLeft:4 }}>
          · Zavod bergan Excel faylni yuklang → preview → tasdiqlang
        </span>
      </div>

      {/* ── Qo'lda qo'shish formasi ── */}
      <details style={{ marginBottom:12 }}>
        <summary style={{ cursor:'pointer', fontWeight:'bold', color:'#003366', padding:'4px 0', userSelect:'none' }}>
          ✏️ Qo'lda qo'shish (kengaytirish uchun bosing)
        </summary>
        <form onSubmit={handleAdd} style={{ display:'flex', gap:5, marginTop:8, alignItems:'center', flexWrap:'wrap' }}>
          <SupplierSelect value={form.source} onChange={val=>setForm({...form,source:val})} placeholder={L.manbaa[lang]} width={140} accentColor="#00695c" required />
          <input placeholder={L.marka[lang]}   value={form.brand}     onChange={e=>setForm({...form,brand:e.target.value})}     style={{ ...inp, width:130 }} />
          <select value={form.cementType} onChange={e=>setForm({...form,cementType:e.target.value})} style={{ ...inp, width:130, color: form.cementType ? '#4a148c' : '#999' }} title="Sement turi">
            <option value="">— tur —</option>
            {cementTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input placeholder={L.mashina[lang]} value={form.vehicleNo} onChange={e=>setForm({...form,vehicleNo:e.target.value})} style={{ ...inp, width:100 }} />
          <input type="number" placeholder={L.tonna[lang]} value={form.tons} onChange={e=>setForm({...form,tons:e.target.value})} style={{ ...inp, width:90 }} required />
          <input type="number" placeholder={L.narx[lang]}  value={form.pricePerTon} onChange={e=>setForm({...form,pricePerTon:e.target.value})} style={{ ...inp, width:110 }} />
          {warehouses.length > 1 && (
            <select value={form.warehouseId || myWh} onChange={e=>setForm({...form,warehouseId:e.target.value})} style={{ ...inp, fontWeight:'bold', color:'#1b5e20' }} title="Qaysi skladga">
              {warehouses.map(w => <option key={w.id} value={w.id}>🏬 {w.name}</option>)}
            </select>
          )}
          <select value={form.paymentChannel} onChange={e=>setForm({...form,paymentChannel:e.target.value})} style={inp}>
            {TOLOV.map(t=><option key={t.v} value={t.v}>{t[lang==='cyrl'?'cyrl':'latn']}</option>)}
          </select>
          <input placeholder={L.karta[lang]}  value={form.cardName}   onChange={e=>setForm({...form,cardName:e.target.value})}   style={{ ...inp, width:110 }} />
          <input placeholder={L.vaqt[lang]}   value={form.factoryTime} onChange={e=>setForm({...form,factoryTime:e.target.value})} style={{ ...inp, width:120 }} />
          <input placeholder={L.izoh[lang]}   value={form.izoh}       onChange={e=>setForm({...form,izoh:e.target.value})}       style={{ ...inp, width:130 }} />
          <select value={currentWorker} onChange={e=>setCurrentWorker(e.target.value)}
            style={{ ...inp, color:currentWorker?'#003366':'#999', fontWeight:currentWorker?'bold':'normal' }}>
            <option value="">— xodim —</option>
            {XODIMLAR.map(x=><option key={x} value={x}>{x}</option>)}
          </select>
          <button type="submit" style={{ ...inp, border:'2px outset #ffffff', cursor:'pointer', background:'#003366', color:'#fff', fontWeight:'bold', padding:'3px 14px' }}>
            {L.qoshish[lang]}
          </button>
        </form>
      </details>

      {/* ── Statistika kartochkalar ── */}
      <table style={{ borderCollapse:'collapse', marginBottom:10 }}>
        <tbody>
          <tr>
            <td style={{ border:'1px solid #999', padding:'5px 14px', background:'#f0f8ff', textAlign:'center', minWidth:160 }}>
              <div style={{ fontSize:11, fontWeight:'bold', color:'#003366' }}>{L.jami_ton[lang]}</div>
              <div style={{ fontSize:15, fontWeight:'bold', color:'#003366', fontFamily:'monospace' }}>{fmtT(totalTons)} tn</div>
            </td>
            <td style={{ border:'1px solid #999', padding:'5px 14px', background:'#f0fff0', textAlign:'center', minWidth:180 }}>
              <div style={{ fontSize:11, fontWeight:'bold', color:'#006600' }}>{L.jami_summa[lang]}</div>
              <div style={{ fontSize:15, fontWeight:'bold', color:'#006600', fontFamily:'monospace' }}>{fmt(totalSum)} so'm</div>
            </td>
            <td style={{ border:'1px solid #999', padding:'5px 14px', background:'#fffde8', textAlign:'center', minWidth:140 }}>
              <div style={{ fontSize:11, fontWeight:'bold', color:'#996600' }}>Manbaalar soni</div>
              <div style={{ fontSize:15, fontWeight:'bold', color:'#996600' }}>{sourceList.length} ta</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Sana oralig'i filtri ── */}
      <DateRangeFilter value={range} onChange={setRange} color="#003366" />

      {/* ── Filter paneli ── */}
      <table style={{ borderCollapse:'collapse', marginBottom:8 }}>
        <tbody>
          <tr>
            <td style={{ paddingRight:5, fontWeight:'bold', fontSize:12 }}>{L.filter_manbaa[lang]}</td>
            <td style={{ paddingRight:4 }}>
              <select value={filterSource} onChange={e=>setFilterSource(e.target.value)} style={{ ...inp }}>
                <option value="">{L.hammasi[lang]}</option>
                {sourceList.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </td>
            <td style={{ paddingLeft:10, paddingRight:5, fontWeight:'bold', fontSize:12 }}>{L.filter_marka[lang]}</td>
            <td style={{ paddingRight:4 }}>
              <select value={filterBrand} onChange={e=>setFilterBrand(e.target.value)} style={{ ...inp }}>
                <option value="">{L.hammasi[lang]}</option>
                {brandList.map(b=><option key={b} value={b}>{b}</option>)}
              </select>
            </td>
            <td style={{ paddingLeft:10, color:'#666', fontSize:11 }}>
              ({filtered.length} ta yozuv)
            </td>
            <td style={{ paddingLeft:10 }}>
              <ExcelExport
                filename="Olingan_tonna"
                sheetName="Olingan tonna"
                title="Olingan tonna hisoboti"
                columns={[
                  { header: 'Sana', value: r => r.date },
                  { header: 'Manbaa (zavod)', value: r => r.source },
                  { header: 'Marka', value: r => r.brand || '' },
                  { header: 'Mashina №', value: r => r.vehicleNo || '' },
                  { header: 'Tonna', value: r => Number(r.tons || 0) },
                  { header: 'Narx (1 tn)', value: r => Number(r.pricePerTon || 0) },
                  { header: 'Jami summa', value: r => Number(r.tons || 0) * Number(r.pricePerTon || 0) },
                  { header: "To'lov usuli", value: r => r.paymentChannel || '' },
                  { header: 'Karta nomi', value: r => r.cardName || '' },
                  { header: 'Vaqt (zavod)', value: r => r.factoryTime || '' },
                  { header: 'Xodim', value: r => r.worker || '' },
                ]}
                rows={[...filtered].reverse()}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Asosiy jadval ── */}
      {filtered.length === 0 ? (
        <p style={{ color:'#666', fontStyle:'italic' }}>{L.yoq[lang]}</p>
      ) : (
        <>
        {/* ── Ommaviy o'chirish paneli ── */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, padding:'6px 10px', background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:6 }}>
          <span style={{ fontSize:12, color:'#e65100', fontWeight:'bold' }}>☑ Ommaviy o'chirish:</span>
          {selected.size > 0 ? (
            <>
              <button onClick={handleBulkDelete}
                style={{ fontSize:12, cursor:'pointer', background:'#c62828', color:'#fff', border:'none', borderRadius:4, padding:'4px 14px', fontWeight:'bold' }}>
                🗑 {selected.size} ta yozuvni o'chirish
              </button>
              <button onClick={() => setSelected(new Set())}
                style={{ fontSize:11, cursor:'pointer', background:'#f0f0f0', border:'1px solid #ccc', borderRadius:4, padding:'3px 10px' }}>
                Bekor qilish
              </button>
            </>
          ) : (
            <span style={{ fontSize:11, color:'#888' }}>Qatorlarni belgilang (chap ustun)</span>
          )}
        </div>
        <div style={{ overflowX:'auto' }}>
          <table className="data-table" style={{ width:'100%', minWidth:1000 }}>
            <thead>
              <tr>
                <th style={{ width:30, textAlign:'center' }}>
                  <input type="checkbox" checked={allPageSelected} onChange={toggleAllPage} title="Sahifadagi hammasini belgilash" />
                </th>
                <th style={{ width:30 }}>#</th>
                <th style={{ width:85 }}>{L.sana[lang]}</th>
                <th style={{ width:160 }}>{L.manbaa[lang]}</th>
                <th style={{ width:130 }}>{L.marka[lang]}</th>
                <th style={{ width:110 }}>Tur</th>
                <th style={{ width:90 }}>{L.mashina[lang]}</th>
                <th style={{ textAlign:'right', width:80 }}>{L.tonna[lang]}</th>
                <th style={{ textAlign:'right', width:110 }}>{L.narx[lang]}</th>
                <th style={{ textAlign:'right', width:130 }}>{L.jami[lang]}</th>
                <th style={{ width:70 }}>{L.tolov[lang]}</th>
                <th style={{ width:100 }}>{L.karta[lang]}</th>
                <th style={{ width:130, fontSize:11 }}>{L.vaqt[lang]}</th>
                <th style={{ width:80 }}>{L.xodim[lang]}</th>
                <th style={{ width:40 }}></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r, i) => {
                const s = Number(r.tons||0) * Number(r.pricePerTon||0);
                const absIdx = (page - 1) * PAGE_SIZE + i;
                const isSelected = selected.has(r.id);
                return (
                  <tr key={r.id} style={{ background: isSelected ? '#fff3e0' : r.pending ? '#fff8c4' : (i%2===0?'#fff':'#f5f5f5') }}>
                    <td style={{ textAlign:'center' }}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(r.id)} />
                    </td>
                    <td style={{ textAlign:'center', color:'#888', fontSize:11 }}>
                      {r.pending ? <span title="Tekshirilmagan" style={{ color:'#e65100' }}>⚠</span> : filtered.length-absIdx}
                    </td>
                    <td style={{ fontSize:12 }}>{r.date}</td>
                    <td>
                      <button
                        onClick={() => setModalSource(r.source)}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'#003366', fontWeight:'bold', fontSize:12, padding:0, textDecoration:'underline' }}
                      >
                        {r.source}
                      </button>
                    </td>
                    <td style={{ color:'#006699', fontWeight:'bold', fontSize:12 }}>{r.brand||'—'}</td>
                    <td style={{ fontSize:11, color: r.cementType ? '#4a148c' : '#bbb', fontWeight: r.cementType ? 'bold' : 'normal' }}>{r.cementType||'—'}</td>
                    <td style={{ fontSize:12 }}>{r.vehicleNo||'—'}</td>
                    <td style={{ textAlign:'right', fontWeight:'bold', fontFamily:'monospace' }}>{fmtT(r.tons)}</td>
                    <td style={{ textAlign:'right', fontFamily:'monospace' }}>{r.pricePerTon?fmt(r.pricePerTon):'—'}</td>
                    <td style={{ textAlign:'right', fontWeight:'bold', color:'#006699', fontFamily:'monospace', fontSize:13 }}>{s?fmt(s):'—'}</td>
                    <td style={{ fontSize:12 }}>{r.paymentChannel||'—'}</td>
                    <td style={{ fontSize:11, color:'#555' }}>{r.cardName||'—'}</td>
                    <td style={{ fontSize:10, color:'#555' }}>{r.factoryTime||'—'}</td>
                    <td style={{ fontSize:11, color:'#003366', fontWeight:r.worker?'bold':'normal' }}>{r.worker||'—'}</td>
                    <td style={{ whiteSpace:'nowrap' }}>
                      {r.pending && (
                        <button
                          onClick={() => openVerify(r)}
                          title="Tekshirib tasdiqlash"
                          style={{ fontSize:11, cursor:'pointer', background:'#2e7d32', color:'#fff', border:'none', borderRadius:3, padding:'3px 8px', marginRight:4, fontWeight:'bold' }}
                        >✓ Tekshirish</button>
                      )}
                      {!r.pending && skladSourceIds.has(r.id) && (
                        <span title="Asosiy skladga (chakana) qo'shilgan" style={{ fontSize:11, color:'#2e7d32', fontWeight:'bold', marginRight:4 }}>📦✓</span>
                      )}
                      {!r.pending && salesRows.some(s => s.recvId === r.id) && (
                        <span title="Ulgurji sotilgan (birdan sotish)" style={{ fontSize:11, color:'#1565c0', fontWeight:'bold', marginRight:4 }}>🛒✓</span>
                      )}
                      <button
                        onClick={() => setEditRecv({ ...r })}
                        title="Tahrirlash"
                        style={{ fontSize:11, cursor:'pointer', background:'#1565c0', color:'#fff', border:'none', borderRadius:3, padding:'3px 7px', marginRight:4 }}
                      >✏️</button>
                      <button
                        onClick={() => { if(window.confirm("O'chirilsinmi?")) deleteRecvRow(r.id); }}
                        style={{ fontSize:10, cursor:'pointer', background:'#ffcccc', border:'1px solid #c00', padding:'2px 5px' }}
                      >✕</button>
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background:'#ffff00', fontWeight:'bold' }}>
                {appSettings?.allowBulkDelete && <td></td>}
                <td colSpan={5} style={{ textAlign:'right' }}>{L.jami_lbl[lang]}</td>
                <td style={{ textAlign:'right', fontFamily:'monospace' }}>{fmtT(totalTons)} tn</td>
                <td></td>
                <td style={{ textAlign:'right', fontFamily:'monospace' }}>{fmt(totalSum)}</td>
                <td colSpan={5}></td>
              </tr>
            </tbody>
          </table>
          <Paginator total={filtered.length} page={page} setPage={setPage} pageSize={PAGE_SIZE} />
        </div>
        </>
      )}

      {renderModal()}
      {renderImportPreview()}
      {editRecv && (
        <RecvEditModal
          row={editRecv}
          warehouses={warehouses}
          myWh={myWh}
          cementTypesList={cementTypes}
          linkedSale={salesRows.find(s => s.recvId === editRecv.id) || null}
          onSave={(recvFields, saleFields) => {
            updateRecvRow(editRecv.id, recvFields);
            if (saleFields) {
              const linked = salesRows.find(s => s.recvId === editRecv.id);
              if (linked) updateSaleRow(linked.id, saleFields);
            }
            setEditRecv(null);
          }}
          onClose={() => setEditRecv(null)}
        />
      )}

      {/* ── TEKSHIRISH (TASDIQLASH) MODALI ─────────────────────────────────── */}
      {verifyRow && createPortal(
        <div onClick={closeVerify} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9000, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:16, overflowY:'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:8, width:'100%', maxWidth:480, marginTop:20, fontFamily:'Tahoma, sans-serif' }}>
            <div style={{ background:'#e65100', color:'#fff', padding:'12px 16px', borderRadius:'8px 8px 0 0', fontWeight:'bold' }}>
              ✓ Yetkazmani tekshirib tasdiqlash
            </div>
            <div style={{ padding:16, display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ fontSize:12, color:'#777' }}>Sana: {verifyRow.date} · {fmtT(verifyRow.tons)} tn</div>
              <Field label="Zavod / Manba *">
                <input value={verifyRow.source} onChange={e => setVerifyRow({ ...verifyRow, source: e.target.value })} style={vInp} placeholder="Zavod nomi" />
              </Field>
              <Field label="Marka">
                <input value={verifyRow.brand} onChange={e => setVerifyRow({ ...verifyRow, brand: e.target.value })} style={vInp} placeholder="Sement markasi" />
              </Field>
              <Field label="Sement turi *">
                <select value={verifyRow.cementType || ''} onChange={e => setVerifyRow({ ...verifyRow, cementType: e.target.value })} style={vInp}>
                  <option value="">— tanlang —</option>
                  {cementTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <div style={{ display:'flex', gap:10 }}>
                <Field label="Tonna *"><input type="number" value={verifyRow.tons} onChange={e => setVerifyRow({ ...verifyRow, tons: e.target.value })} style={vInp} /></Field>
                <Field label="Olish narxi (1 tn)"><input type="number" value={verifyRow.pricePerTon} onChange={e => setVerifyRow({ ...verifyRow, pricePerTon: e.target.value })} style={vInp} /></Field>
              </div>
              {warehouses.length > 1 && (
                <Field label="Sklad">
                  <select value={verifyRow.warehouseId || myWh} onChange={e => setVerifyRow({ ...verifyRow, warehouseId: e.target.value })} style={vInp}>
                    {warehouses.map(w => <option key={w.id} value={w.id}>🏬 {w.name}</option>)}
                  </select>
                </Field>
              )}
              <div style={{ fontSize:12, color:'#004d40', background:'#e0f2f1', padding:8, borderRadius:4 }}>
                Tasdiqlangach: <b>{fmt(Number(verifyRow.tons||0)*Number(verifyRow.pricePerTon||0))} so'm</b> yetkazib beruvchiga <b>qarz</b> sifatida yoziladi. Kassadan pul yechilmaydi — to'lovni keyin "Yetkazib beruvchi qarzi" bo'limidan kiritasiz.
              </div>

              {/* ── Taqsimlash ── */}
              <div style={{ borderTop:'1px solid #ddd', paddingTop:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <span style={{ fontSize:13, fontWeight:'bold', color:'#444' }}>Taqsimlash</span>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => addSplit('mijoz')} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:'600', padding:'6px 13px', background:'linear-gradient(135deg,#0288d1,#01579b)', color:'#fff', border:'none', borderRadius:20, cursor:'pointer', boxShadow:'0 2px 5px rgba(1,87,155,0.35)' }}>🛒 Mijozga sotish</button>
                    <button onClick={() => addSplit('sklad')} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:'600', padding:'6px 13px', background:'linear-gradient(135deg,#6d4c41,#4e342e)', color:'#fff', border:'none', borderRadius:20, cursor:'pointer', boxShadow:'0 2px 5px rgba(78,52,46,0.35)' }}>🏗 Skladga</button>
                  </div>
                </div>
                {splits.length === 0 && (
                  <div style={{ fontSize:12, color:'#999', textAlign:'center', padding:'8px 0' }}>Hech narsa taqsimlanmagan — faqat tasdiqlash yoziladi</div>
                )}
                {splits.map(sp => (
                  <div key={sp.id} style={{ display:'flex', flexDirection:'column', gap:8, border:`1px solid ${sp.type==='mijoz' ? '#b3e5fc' : '#d7ccc8'}`, borderRadius:6, padding:8, marginBottom:8, background: sp.type==='mijoz' ? '#f5fbff' : '#fdf5f3' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:12, fontWeight:'bold', color: sp.type==='mijoz' ? '#01579b' : '#4e342e' }}>
                        {sp.type==='mijoz' ? '🛒 Mijozga sotish' : '🏗 Asosiy skladga'}
                      </span>
                      <button onClick={() => removeSplit(sp.id)} style={{ fontSize:11, padding:'2px 7px', background:'#fff', border:'1px solid #ccc', borderRadius:4, cursor:'pointer', color:'#c00' }}>✕</button>
                    </div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <Field label="Tonna *">
                        <input type="number" value={sp.tons} onChange={e => updateSplit(sp.id,'tons',e.target.value)} style={{ ...vInp, width:90 }} placeholder="0" />
                      </Field>
                      {sp.type==='mijoz' && (
                        <>
                          <div style={{ flex:2, minWidth:160 }}>
                            <Field label="Mijoz *">
                              <CustomerSelect value={sp.customer} onChange={val => updateSplit(sp.id,'customer',val)} placeholder="Mijoz..." width={'100%'} accentColor="#01579b" />
                            </Field>
                          </div>
                          <Field label="Narx (1 tn) *">
                            <input type="number" value={sp.pricePerTon} onChange={e => updateSplit(sp.id,'pricePerTon',e.target.value)} style={{ ...vInp, width:110 }} placeholder="0" />
                          </Field>
                          <Field label="To'lov">
                            <select value={sp.paymentChannel} onChange={e => updateSplit(sp.id,'paymentChannel',e.target.value)} style={{ ...vInp, width:110 }}>
                              <option value="naqd">💵 Naqd</option>
                              <option value="bank">🏦 Bank</option>
                              <option value="click">📱 Click</option>
                              <option value="nasiya">⚠️ Nasiya</option>
                            </select>
                          </Field>
                        </>
                      )}
                    </div>
                    {sp.type==='sklad' && Number(sp.tons) > 0 && (
                      <div style={{ fontSize:11, color:'#4e342e' }}>{sp.tons} tn × 1000 = <b>{(Number(sp.tons)*1000).toLocaleString('ru-RU')} kg</b></div>
                    )}
                    {sp.type==='mijoz' && Number(sp.tons) > 0 && Number(sp.pricePerTon) > 0 && (
                      <div style={{ fontSize:11, color:'#01579b' }}>Summa: <b>{fmt(Number(sp.tons)*Number(sp.pricePerTon))} so'm</b></div>
                    )}
                  </div>
                ))}
                {splits.length > 0 && (() => {
                  const total = Number(verifyRow.tons) || 0;
                  const used = splits.reduce((s,sp) => s + (Number(sp.tons)||0), 0);
                  const left = total - used;
                  return (
                    <div style={{ fontSize:12, padding:'5px 8px', borderRadius:4, background: Math.abs(left) < 0.001 ? '#e8f5e9' : left < 0 ? '#ffebee' : '#fff9c4', color: left < 0 ? '#c00' : '#555' }}>
                      Jami: <b>{total} tn</b> · Taqsimlangan: <b>{used} tn</b> · Qoldi: <b style={{ color: left < 0 ? '#c00' : left < 0.001 ? '#2e7d32' : '#e65100' }}>{left.toFixed(3)} tn</b>
                    </div>
                  );
                })()}
              </div>

              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <button onClick={confirmVerify}
                  style={{ flex:1, padding:'9px 0', background:'#2e7d32', color:'#fff', border:'none', borderRadius:6, fontWeight:'bold', cursor:'pointer' }}>
                  ✓ Tasdiqlash
                </button>
                <button onClick={closeVerify} style={{ padding:'9px 16px', background:'#f0f0f0', border:'1px solid #ccc', borderRadius:6, cursor:'pointer' }}>Bekor</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display:'block', flex:1 }}>
      <span style={{ display:'block', fontSize:11, fontWeight:'bold', color:'#555', marginBottom:3 }}>{label}</span>
      {children}
    </label>
  );
}
const vInp = { width:'100%', boxSizing:'border-box', padding:'7px 9px', fontSize:13, border:'1px solid #ccc', borderRadius:4, fontFamily:'Tahoma, sans-serif' };

// ── RecvRow tahrirlash modali ─────────────────────────────────────────────────
export function RecvEditModal({ row, warehouses, myWh, onSave, onClose, linkedSale, cementTypesList }) {
  const [f, setF]   = useState({ ...row });
  const [sf, setSf] = useState(linkedSale ? { ...linkedSale } : null);
  const sv = v => e => setF(p => ({ ...p, [v]: e.target.value }));
  const ss = v => e => setSf(p => ({ ...p, [v]: e.target.value }));
  const handle = e => {
    e.preventDefault();
    const recvFields = { source: f.source, brand: f.brand, tons: f.tons, pricePerTon: f.pricePerTon, vehicleNo: f.vehicleNo, cardName: f.cardName, factoryTime: f.factoryTime, paymentChannel: f.paymentChannel, warehouseId: f.warehouseId, izoh: f.izoh, cementType: f.cementType };
    const saleFields = sf ? { customer: sf.customer, pricePerTon: sf.pricePerTon, paymentChannel: sf.paymentChannel, note: sf.note } : null;
    onSave(recvFields, saleFields);
  };
  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9100, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:16, overflowY:'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:8, width:'100%', maxWidth:520, marginTop:20, fontFamily:'Tahoma, sans-serif' }}>
        <div style={{ background:'#1565c0', color:'#fff', padding:'12px 16px', borderRadius:'8px 8px 0 0', fontWeight:'bold', display:'flex', justifyContent:'space-between' }}>
          <span>✏️ Yozuvni tahrirlash</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', fontSize:18, lineHeight:1 }}>✕</button>
        </div>
        <form onSubmit={handle} style={{ padding:16, display:'flex', flexDirection:'column', gap:10 }}>
          {!f.pending && (
            <div style={{ fontSize:12, color:'#e65100', background:'#fff3e0', padding:8, borderRadius:4 }}>
              ⚠ Tasdiqlangan yozuv — tonnani o'zgartirish yetkazib beruvchi qarziga ta'sir qilmaydi (qo'lda tekshiring)
            </div>
          )}
          {/* ── Kirim (RecvRow) ma'lumotlari ── */}
          <div style={{ fontWeight:'bold', fontSize:12, color:'#1565c0', borderBottom:'1px solid #e3f2fd', paddingBottom:4 }}>📦 Kirim ma'lumotlari</div>
          <div style={{ display:'flex', gap:10 }}>
            <Field label="Zavod / Manba *">
              <input value={f.source||''} onChange={sv('source')} style={vInp} placeholder="Zavod nomi" required />
            </Field>
            <Field label="Marka">
              <input value={f.brand||''} onChange={sv('brand')} style={vInp} placeholder="Sement markasi" />
            </Field>
          </div>
          <Field label="Sement turi">
            <select value={f.cementType||''} onChange={sv('cementType')} style={vInp}>
              <option value="">— tanlang —</option>
              {(cementTypesList || []).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <div style={{ display:'flex', gap:10 }}>
            <Field label="Tonna *">
              <input type="number" value={f.tons||''} onChange={sv('tons')} style={vInp} required />
            </Field>
            <Field label="Narx (1 tn)">
              <input type="number" value={f.pricePerTon||''} onChange={sv('pricePerTon')} style={vInp} />
            </Field>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <Field label="Mashina №">
              <input value={f.vehicleNo||''} onChange={sv('vehicleNo')} style={vInp} />
            </Field>
            <Field label="Karta nomi">
              <input value={f.cardName||''} onChange={sv('cardName')} style={vInp} />
            </Field>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <Field label="Vaqt (zavod)">
              <input value={f.factoryTime||''} onChange={sv('factoryTime')} style={vInp} placeholder="2026-06-24 20:57:13" />
            </Field>
            <Field label="To'lov usuli">
              <select value={f.paymentChannel||'naqd'} onChange={sv('paymentChannel')} style={vInp}>
                <option value="naqd">💵 Naqd</option>
                <option value="bank">🏦 Bank</option>
                <option value="click">📱 Click</option>
              </select>
            </Field>
          </div>
          {warehouses?.length > 1 && (
            <Field label="Sklad">
              <select value={f.warehouseId||myWh} onChange={sv('warehouseId')} style={vInp}>
                {warehouses.map(w => <option key={w.id} value={w.id}>🏬 {w.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Izoh">
            <input value={f.izoh||''} onChange={sv('izoh')} style={vInp} placeholder="Ixtiyoriy" />
          </Field>

          {/* ── Sotuv (birdan sotish) ma'lumotlari — faqat bog'liq savdo bo'lsa ── */}
          {sf && (
            <>
              <div style={{ fontWeight:'bold', fontSize:12, color:'#2e7d32', borderBottom:'1px solid #e8f5e9', paddingBottom:4, marginTop:4 }}>
                🛒 Ulgurji sotuv ma'lumotlari
              </div>
              <div style={{ fontSize:11, color:'#555', background:'#f1f8e9', padding:'6px 10px', borderRadius:4 }}>
                Mijoz: <b>{sf.customer}</b> · {sf.tons} tn × {fmt(sf.pricePerTon)} = <b>{fmt(Number(sf.tons||0)*Number(sf.pricePerTon||0))} so'm</b>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <Field label="Mijoz *">
                  <input value={sf.customer||''} onChange={ss('customer')} style={vInp} placeholder="Mijoz ismi" required />
                </Field>
                <Field label="Sotish narxi (1 tn)">
                  <input type="number" value={sf.pricePerTon||''} onChange={ss('pricePerTon')} style={vInp} />
                </Field>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <Field label="To'lov turi">
                  <select value={sf.paymentChannel||'naqd'} onChange={ss('paymentChannel')} style={vInp}>
                    <option value="naqd">💵 Naqd</option>
                    <option value="bank">🏦 Bank</option>
                    <option value="click">📱 Click</option>
                    <option value="nasiya">⚠️ Nasiya</option>
                  </select>
                </Field>
                <Field label="Izoh">
                  <input value={sf.note||''} onChange={ss('note')} style={vInp} placeholder="Ixtiyoriy" />
                </Field>
              </div>
            </>
          )}

          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
            <button type="button" onClick={onClose} style={{ padding:'8px 20px', border:'1px solid #ccc', borderRadius:6, cursor:'pointer', background:'#f5f5f5' }}>Bekor</button>
            <button type="submit" style={{ padding:'8px 28px', background:'#1565c0', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontWeight:'bold', fontSize:14 }}>✓ Saqlash</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

const thS = { border:'1px solid #999', padding:'5px 8px', background:'#f0f0f0', fontWeight:'bold', fontSize:12, textAlign:'left' };
const tdS = { border:'1px solid #ccc', padding:'5px 8px', fontSize:12 };
