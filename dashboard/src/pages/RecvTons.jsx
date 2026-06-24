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
    recvRows, addRecvRow, deleteRecvRow, importRecvRows, verifyRecvRow,
    addSaleRow, addSupplier,
    currentWorker, setCurrentWorker,
    warehouses, defaultWhId, currentUser, appSettings,
  } = useData();
  const myWh = currentUser?.warehouseId || defaultWhId;
  const [verifyRow, setVerifyRow] = useState(null); // tasdiqlash modali
  // "Birdan sotish" — tasdiqlash oynasida zavoddan to'g'ri mijozga sotish
  const [sell, setSell] = useState({ on: false, customer: '', pricePerTon: '', paymentChannel: 'naqd' });
  const [range, setRange] = useState({ from: '', to: '' }); // sana oralig'i filtri
  const [selected, setSelected] = useState(new Set()); // ommaviy tanlash

  const [form, setForm] = useState({
    source:'', brand:'', vehicleNo:'', tons:'', pricePerTon:'',
    paymentChannel:'naqd', cardName:'', factoryTime:'', izoh:'', warehouseId:'',
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
    if (!form.source || !form.tons) return;
    addSupplier({ name: form.source }); // yangi manbaani bazaga saqlab qo'yamiz
    addRecvRow({
      source: form.source, brand: form.brand,
      vehicleNo: form.vehicleNo, tons: form.tons,
      pricePerTon: form.pricePerTon || 0,
      paymentChannel: form.paymentChannel,
      cardName: form.cardName, factoryTime: form.factoryTime,
      izoh: form.izoh,
      warehouseId: form.warehouseId || myWh,
    });
    setForm({ source:'', brand:'', vehicleNo:'', tons:'', pricePerTon:'',
              paymentChannel:'naqd', cardName:'', factoryTime:'', izoh:'', warehouseId:'' });
  };

  // ── Excel import ──────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb   = XLSX.read(ev.target.result, { type: 'binary', cellDates: true });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      // 1-qator sarlavha, 2-qatordan boshlab ma'lumot.
      // Ustunlar (ortiqcha bo'sh ustun olib tashlangan yangi shablon):
      // A=imya(0) B=marka(1) C=avto(2) D=hajm(3) E=narx(4) F=summa(5) G=vaqt(6) H=karta(7)
      const rows = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const tons = Number(row[3]);          // D ustun (hajm)
        const price = Number(row[4]);         // E ustun (narx)
        if (!tons) continue;                  // bo'sh qatorni o'tkazib yuborish
        rows.push({
          source:     String(row[0] || '').trim(),
          brand:      String(row[1] || '').trim(),
          vehicleNo:  String(row[2] || '').trim(),
          tons,
          pricePerTon: price || 0,
          summa:      Number(row[5]) || (tons * price),
          factoryTime: row[6] ? String(row[6]).trim() : '',
          cardName:   String(row[7] || '').trim(),
          paymentChannel: 'naqd',
          izoh: '',
        });
      }
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
    setSell({ on: false, customer: '', pricePerTon: '', paymentChannel: 'naqd' });
  };
  const closeVerify = () => { setVerifyRow(null); setSell({ on: false, customer: '', pricePerTon: '', paymentChannel: 'naqd' }); };
  const confirmVerify = () => {
    if (!verifyRow.source) { alert('Zavod nomini kiriting'); return; }
    const tons = Number(verifyRow.tons) || 0;
    if (sell.on && (!sell.customer || !sell.pricePerTon)) {
      alert('Birdan sotish uchun mijoz va sotish narxini kiriting.');
      return;
    }
    // Yangi manbaani bazaga saqlash
    addSupplier({ name: verifyRow.source });
    // 1) Tasdiqlash → yetkazib beruvchiga qarz yoziladi (kassadan pul yechilmaydi)
    verifyRecvRow(verifyRow.id, {
      source: verifyRow.source, brand: verifyRow.brand,
      tons, pricePerTon: Number(verifyRow.pricePerTon) || 0,
      paymentChannel: verifyRow.paymentChannel,
      warehouseId: verifyRow.warehouseId || myWh,
    });
    // 2) Birdan sotish → zavoddan to'g'ri mijozga (sklad orqali o'tmaydi)
    if (sell.on) {
      const vehicleNo = verifyRow.vehicleNo || '';
      addSaleRow({
        customer: sell.customer,
        tons,
        pricePerTon: Number(sell.pricePerTon) || 0,
        paymentChannel: sell.paymentChannel,
        warehouseId: verifyRow.warehouseId || myWh,
        vehicleNo,
        date: verifyRow.date,
        factoryTime: verifyRow.factoryTime || '',
        note: [vehicleNo && `Mashina: ${vehicleNo}`, `Zavod: ${verifyRow.source}`].filter(Boolean).join(' | '),
      });
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
    if (!window.confirm(`${selected.size} ta yozuv o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.`)) return;
    selected.forEach(id => deleteRecvRow(id));
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

              {/* ── Birdan sotish (zavoddan to'g'ri mijozga) ── */}
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, fontWeight:'bold', color:'#01579b', cursor:'pointer', background:'#e1f5fe', padding:'8px 10px', borderRadius:6 }}>
                <input type="checkbox" checked={sell.on} onChange={e => setSell({ ...sell, on: e.target.checked })} />
                🛒 Birdan mijozga sotish (zavoddan to'g'ri ketdi)
              </label>
              {sell.on && (
                <div style={{ display:'flex', flexDirection:'column', gap:10, border:'1px solid #b3e5fc', borderRadius:6, padding:10, background:'#f5fbff' }}>
                  <Field label="Mijoz *">
                    <CustomerSelect value={sell.customer} onChange={val => setSell({ ...sell, customer: val })} placeholder="Mijoz (izlash...)" width={'100%'} accentColor="#01579b" />
                  </Field>
                  <div style={{ display:'flex', gap:10 }}>
                    <Field label="Sotish narxi (1 tn) *"><input type="number" value={sell.pricePerTon} onChange={e => setSell({ ...sell, pricePerTon: e.target.value })} style={vInp} placeholder="Masalan: 720000" /></Field>
                    <Field label="To'lov turi">
                      <select value={sell.paymentChannel} onChange={e => setSell({ ...sell, paymentChannel: e.target.value })} style={vInp}>
                        <option value="naqd">💵 Naqd</option>
                        <option value="bank">🏦 Bank</option>
                        <option value="click">📱 Click</option>
                        <option value="nasiya">⚠️ Nasiya (Qarz)</option>
                      </select>
                    </Field>
                  </div>
                  <div style={{ fontSize:12, color:'#01579b', background:'#e1f5fe', padding:8, borderRadius:4 }}>
                    Sotuv summasi: <b>{fmt(Number(verifyRow.tons||0)*Number(sell.pricePerTon||0))} so'm</b> — "{sell.customer || '...'}" ga sotiladi.
                  </div>
                </div>
              )}

              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <button onClick={confirmVerify}
                  style={{ flex:1, padding:'9px 0', background:'#2e7d32', color:'#fff', border:'none', borderRadius:6, fontWeight:'bold', cursor:'pointer' }}>
                  {sell.on ? '✓ Tasdiqlab sotish' : '✓ Tasdiqlash'}
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

const thS = { border:'1px solid #999', padding:'5px 8px', background:'#f0f0f0', fontWeight:'bold', fontSize:12, textAlign:'left' };
const tdS = { border:'1px solid #ccc', padding:'5px 8px', fontSize:12 };
