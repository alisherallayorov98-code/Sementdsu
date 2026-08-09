import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { sameCust, custRows, custFields, findCust, custKey, sameName, uniqueNames } from '../lib/customerRef';
import { parseNum } from '../lib/parseNum';
import { planDebtPayment, planAdvanceSpend } from '../lib/debtAllocation';

const DataContext = createContext();
export const useData = () => useContext(DataContext);

// LocalStorage yordamchi funksiyalari (offline-kesh sifatida ishlatiladi).
// Asosiy ma'lumotlar manbai — backend (server). LocalStorage faqat backend
// javob bermaguncha tezkor ko'rsatish va internetsiz vaqtinchalik ishlash uchun.
const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
};
// DIQQAT: localStorage to'lganda setItem QuotaExceededError tashlaydi.
// Bu useEffect ichida chaqirilgani uchun, ushlanmasa React renderni buzib
// butun ilovani oq ekranga aylantiradi — va har qayta yuklashda takrorlanadi,
// ya'ni dastur butunlay ishlamay qoladi. Asosiy manba baribir server, shuning
// uchun keshga yozib bo'lmasa — jimgina davom etamiz.
let _quotaWarned = false;
const save = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    if (!_quotaWarned) {
      _quotaWarned = true;
      console.warn(`Lokal kesh to'ldi (${key}). Ma'lumot serverda saqlanmoqda.`, e?.name);
      // Eng katta va eng kam kerakli keshlarni bo'shatib, joy ochamiz.
      for (const k of ['cash_rows', 'bank_rows', 'click_rows', 'sales_rows', 'recv_rows']) {
        try { localStorage.removeItem(k); } catch { /* ignore */ }
      }
    }
  }
};

// Tonnani chiroyli ko'rsatish (butun bo'lsa kasrsiz)
const fmtTons = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };

// ─────────────────────────────────────────────────────────────────────────────
// YAGONA ID GENERATORI
// Date.now() bir millisekundda bir necha marta chaqirilsa BIR XIL qiymat qaytaradi.
// Taqsimlash (bir chekdan bir necha sotuv) kabi sinxron sikllarda bu bir xil id'li
// yozuvlar yaratardi — bittasini o'chirsa ikkalasi ham o'chib ketardi.
// uid() har chaqiruvda qat'iy o'suvchi va takrorlanmas son qaytaradi.
let _lastId = 0;
const uid = () => {
  const now = Date.now();
  _lastId = now > _lastId ? now : _lastId + 1;
  return _lastId;
};

// Tashqi manbadan (Excel) kelgan sonni ishonchli o'qish — lib/parseNum.js

// Erkin kiritilgan sana/vaqtni (masalan "2026-07-20 14:30" yoki "20.07.2026")
// tizim standarti "kk.oo.yyyy" ga keltirish. Tanib bo'lmasa — null.
const toLocalDate = (s) => {
  const str = String(s || '').trim();
  if (!str) return null;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(str)) return str;      // allaqachon to'g'ri
  const d = new Date(str.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d.toLocaleDateString('ru-RU');
};

// Ichki bildirishnoma ovozi (internetsiz ham ishlaydi — Web Audio "beep")
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(); osc.stop(ctx.currentTime + 0.42);
    osc.onended = () => { try { ctx.close(); } catch { /* ignore */ } };
  } catch { /* ovoz ixtiyoriy */ }
}

// Sotuv o'chirilganda u yaratgan nasiya qarzi ham o'chadi. Lekin o'sha qarzga
// TO'LOV qilingan bo'lsa, to'lov kassaga alohida yozuv (sourceType:
// 'debt_payment') sifatida tushgan va sotuv bilan birga o'chmaydi: qarz
// yo'qolib, olingan pul kassada egasiz qolardi — balans hech qachon
// to'g'rilanmaydigan holatga kelardi.
// deleteDebtRow da bunday himoya bor edi, sotuv orqali o'chirishda yo'q edi.
const blockIfDebtPaid = (debtRows, sourceType, sourceId) => {
  const paid = debtRows
    .filter(r => r.auto && r.sourceType === sourceType && r.sourceId === sourceId)
    .reduce((s, r) => s + Number(r.paid || 0), 0);
  if (paid > 0) {
    alert(
      `Bu sotuvdan yaratilgan qarzga ${paid.toLocaleString('ru-RU')} so'm to'lov qayd etilgan.\n\n` +
      `Sotuvni o'chirsak, qarz yo'qoladi-yu olingan pul kassada egasiz qoladi.\n` +
      `Avval to'lovni bekor qiling, keyin sotuvni o'chiring.`
    );
    return true;
  }
  return false;
};

// Avtomatik yaratilgan yozuvni qo'lda o'chirishdan himoya qilish.
const guardAutoDelete = (rows, id) => {
  const row = rows.find(r => r.id === id);
  if (row?.auto) {
    const src = row.sourceType;
    const msgs = {
      sale:         "Bu yozuv sotuvdan avtomatik yaratilgan.\nO'chirish uchun \"Sotish\" bo'limidan tegishli savdoni o'chiring.",
      sold:         "Bu qarz eski sotuv (nasiya)dan avtomatik yaratilgan.\nO'chirish uchun \"Sotilgan tonna\" bo'limidan tegishli sotuvni o'chiring.",
      sklad_sale:   "Bu yozuv sklad (kg) sotuvidan avtomatik yaratilgan.\nO'chirish uchun \"Kassir → Sklad savdo tarixi\"dan tegishli sotuvni o'chiring.",
      recv:         "Bu yozuv sement olishdan avtomatik yaratilgan.\nO'chirish uchun \"Olingan tonna\" bo'limidan tegishli qatorni o'chiring.",
      debt_payment: "Bu yozuv qarz to'lovidan avtomatik yaratilgan.\nUni alohida o'chirib bo'lmaydi.",
      advance:      "Bu yozuv avans qabul qilishdan avtomatik yaratilgan.\nO'chirish uchun \"Avanslar\" bo'limidan tegishli avansni o'chiring.",
      salary:       "Bu yozuv xodim oyligidan avtomatik yaratilgan.\nO'chirish uchun \"Ishchilar oyligi\" bo'limidan to'lovni bekor qiling.",
      driver:       "Bu yozuv haydovchi to'lovidan avtomatik yaratilgan.\nO'chirish uchun \"Haydovchilar\" bo'limidan to'lovni o'chiring.",
    };
    alert(msgs[src] || "Bu yozuv avtomatik yaratilgan va alohida o'chirib bo'lmaydi.");
    return rows;
  }
  return rows.filter(r => r.id !== id);
};

export function DataProvider({ children }) {

  // ── Autentifikatsiya (JWT) — bu QURILMAGA tegishli sessiya ───────────────────
  const [token, setTokenState]        = useState(() => api.getToken());
  const [currentUser, setCurrentUser] = useState(() => load('current_user', null));
  useEffect(() => save('current_user', currentUser), [currentUser]);

  // Faol xodimning ismi. Standart — tizimga kirgan xodim, lekin ayrim sahifalarda
  // yozuvni boshqa xodim nomidan kiritish uchun dropdown orqali o'zgartirilishi mumkin.
  const [currentWorker, setCurrentWorker] = useState(currentUser ? currentUser.name : '');
  useEffect(() => {
    setCurrentWorker(currentUser ? currentUser.name : '');
  }, [currentUser]);

  // Kirish — server tomonda tekshiriladi, JWT token qaytadi.
  // Birinchi foydalanuvchi (xodimlar yo'q bo'lsa) avtomatik admin bo'ladi (server bootstrap).
  const login = async (name, password, account = '') => {
    try {
      const res = await api.login(name, password, account);
      if (!res?.token) return false;
      // Oldingi seans boshqa tashkilot yoki boshqa xodim bo'lgan bo'lsa
      // (masalan brauzer chiqmasdan yopilgan), keshni tozalaymiz.
      const who = `${account || 'default'}::${res.user?.id || ''}`;
      if (localStorage.getItem('cache_owner') !== who) {
        clearLocalCache();
        try { localStorage.setItem('cache_owner', who); } catch { /* ignore */ }
      }
      api.setToken(res.token);
      setTokenState(res.token);
      setCurrentUser(res.user);
      return true;
    } catch {
      return false;
    }
  };
  // Yangi tashkilot ochish (SaaS). Xato bo'lsa matn qaytaradi.
  const signup = async (account, name, password) => {
    try {
      const res = await api.signup(account, name, password);
      if (!res?.token) return { ok: false, error: 'Xatolik' };
      api.setToken(res.token);
      setTokenState(res.token);
      setCurrentUser(res.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  // Chiqishda lokal keshni TOZALAYMIZ. Aks holda bir kompyuterda ikkinchi
  // tashkilot kirsa, hydration tugagunicha oldingi tashkilotning savdo/qarz
  // ma'lumotlarini ko'rib turardi — SaaS'da bu jiddiy ma'lumot sizishi.
  const clearLocalCache = () => {
    try {
      for (const k of Object.keys(STATE_SETTERS)) localStorage.removeItem(k);
      localStorage.removeItem('current_user');
    } catch { /* ignore */ }
  };
  const logout = () => {
    clearLocalCache();
    api.setToken(null);
    setTokenState(null);
    setCurrentUser(null);
    hydratedRef.current = false;
    baseVersionRef.current = 0;
  };

  // ── Dastur Sozlamalari ──────────────────────────────────────────────────
  const [appSettings, setAppSettings] = useState(() => load('app_settings', {
    appName: 'Sement Biznes Boshqaruvi',
    currency: "so'm",
    themeColor: '#003366',
    monitorDays: 14, // mijoz nazorati: necha kun xarid bo'lmasa "jim qoldi" deb belgilash
    companyPhone: '',   // chekda chiqadi
    companyAddress: '', // chekda chiqadi
    autoPrintReceipt: true, // sotuvdan keyin chek avtomatik chiqsin (majburiy)
  }));
  useEffect(() => save('app_settings', appSettings), [appSettings]);
  const updateAppSettings = (data) => setAppSettings(p => ({ ...p, ...data }));

  // ── Skladlar (omborlar) ───────────────────────────────────────────────────
  // Foydalanuvchi o'zi nomlaydi. Birinchisi standart (eski ma'lumotlar shunga tegishli).
  const [warehouses, setWarehouses] = useState(() => load('warehouses', [
    { id: 'main', name: 'Asosiy sklad' },
  ]));
  useEffect(() => save('warehouses', warehouses), [warehouses]);
  const defaultWhId = warehouses[0]?.id || 'main';
  // Yozuvning skladi (bo'lmasa yoki o'chirilgan bo'lsa — standart)
  const whOf = (row) => (row?.warehouseId && warehouses.some(w => w.id === row.warehouseId)) ? row.warehouseId : defaultWhId;
  const whName = (id) => warehouses.find(w => w.id === id)?.name || '—';
  const addWarehouse = (name) => {
    const id = 'wh' + uid();
    setWarehouses(p => [...p, { id, name: String(name).trim() || 'Sklad' }]);
    return id;
  };
  const updateWarehouse = (id, name) => setWarehouses(p => p.map(w => w.id === id ? { ...w, name } : w));
  // Sklad o'chirilsa, undagi yozuvlar whOf() orqali standart skladga "sakrab"
  // o'tardi — ya'ni qoldiq bir ombordan ikkinchisiga sassiz ko'chib qolardi.
  // Shuning uchun bo'sh bo'lmagan skladni o'chirishga yo'l qo'ymaymiz.
  const deleteWarehouse = (id) => {
    if (warehouses.length <= 1) {
      alert("Oxirgi skladni o'chirib bo'lmaydi.");
      return false;
    }
    const bal = (cementByWarehouse.find(w => w.id === id) || {}).balance || 0;
    if (Math.abs(bal) > 0.001) {
      alert(
        `"${whName(id)}" skladida ${fmtTons(bal)} tn sement bor.\n\n` +
        `Avval bu sementni sotib yoki boshqa omborga o'tkazib, qoldiqni nolga tushiring.`
      );
      return false;
    }
    setWarehouses(p => p.filter(w => w.id !== id));
    return true;
  };


  // ── 2. Naqd pul ──────────────────────────────────────────────────────────
  const [cashOpening, setCashOpening] = useState(() => load('cash_opening', { date: '', amount: 0 }));
  const [cashRows, setCashRows]       = useState(() => load('cash_rows', []));
  useEffect(() => save('cash_opening', cashOpening), [cashOpening]);
  useEffect(() => save('cash_rows',    cashRows),    [cashRows]);
  const _cashRowsSum = cashRows.reduce((s, r) => s + Number(r.amount), 0);
  // NaN qalqoni: bitta yaroqsiz summa butun kanal qoldig'ini "NaN" ga
  // aylantiradi va sahifadagi HAMMA raqam yo'qoladi. Chaqiruvchilar odatda
  // parseNum bilan tozalaydi, bu esa oxirgi to'siq.
  const safeAmount = (amount, where) => {
    const v = Number(amount);
    if (!isFinite(v)) { alert(`Summa noto'g'ri kiritilgan (${where}). Yozuv qo'shilmadi.`); return null; }
    return v;
  };

  // extra — qo'shimcha maydonlar (masalan { expenseType: '571 moshin moykasi' }).
  // Guruhlangan xarajat hisoboti shu maydon orqali ishlaydi.
  const addCashRow   = (amount, desc, date = new Date().toLocaleDateString('ru-RU'), customer = '', extra = {}) => {
    const amt = safeAmount(amount, 'naqd');
    if (amt === null) return;
    const ts = uid();
    setCashRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date, amount: amt, desc, ...custFields(customers, customer), ...extra }]);
  };
  const deleteCashRow    = (id) => setCashRows(p => guardAutoDelete(p, id));
  const updateCashRow    = (id, fields) => setCashRows(p => p.map(r => r.id === id ? { ...r, ...fields } : r));

  // ── 3. Bank ───────────────────────────────────────────────────────────────
  const [bankOpening, setBankOpening] = useState(() => load('bank_opening', { date: '', amount: 0 }));
  const [bankRows, setBankRows]       = useState(() => load('bank_rows', []));
  useEffect(() => save('bank_opening', bankOpening), [bankOpening]);
  useEffect(() => save('bank_rows',    bankRows),    [bankRows]);
  const _bankRowsSum = bankRows.reduce((s, r) => s + Number(r.amount), 0);
  const addBankRow   = (amount, desc, date = new Date().toLocaleDateString('ru-RU'), customer = '', extra = {}) => {
    const amt = safeAmount(amount, 'bank');
    if (amt === null) return;
    const ts = uid();
    setBankRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date, amount: amt, desc, ...custFields(customers, customer), ...extra }]);
  };
  const deleteBankRow    = (id) => setBankRows(p => guardAutoDelete(p, id));
  const updateBankRow    = (id, fields) => setBankRows(p => p.map(r => r.id === id ? { ...r, ...fields } : r));

  // ── 4. Click ──────────────────────────────────────────────────────────────
  const [clickOpening, setClickOpening] = useState(() => load('click_opening', { date: '', amount: 0 }));
  const [clickRows, setClickRows]       = useState(() => load('click_rows', []));
  useEffect(() => save('click_opening', clickOpening), [clickOpening]);
  useEffect(() => save('click_rows',    clickRows),    [clickRows]);
  const _clickRowsSum = clickRows.reduce((s, r) => s + Number(r.amount), 0);
  const addClickRow   = (amount, desc, date = new Date().toLocaleDateString('ru-RU'), customer = '', extra = {}) => {
    const amt = safeAmount(amount, 'click');
    if (amt === null) return;
    const ts = uid();
    setClickRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date, amount: amt, desc, ...custFields(customers, customer), ...extra }]);
  };
  const deleteClickRow    = (id) => setClickRows(p => guardAutoDelete(p, id));
  const updateClickRow    = (id, fields) => setClickRows(p => p.map(r => r.id === id ? { ...r, ...fields } : r));

  // ── Kanallararo o'tkazmani bekor qilish ───────────────────────────────────
  // O'tkazma IKKI yozuvdan iborat (manbadan chiqim + maqsadga kirim), ular
  // bitta `transferId` bilan bog'langan. Bittasini o'chirish pulni yo'qdan
  // paydo qilardi yoki yo'q qilardi, shuning uchun EditModal summani
  // qulflab qo'ygan edi — natijada NOTO'G'RI o'tkazmani umuman tuzatib
  // bo'lmasdi. Bu funksiya juftlikni birga o'chiradi.
  const deleteTransfer = (transferId) => {
    if (!transferId) return false;
    const match = (r) => r.transferId === transferId;
    const count = [...cashRows, ...bankRows, ...clickRows].filter(match).length;
    if (!count) return false;
    const drop = (p) => p.filter(r => !match(r));
    setCashRows(drop); setBankRows(drop); setClickRows(drop);
    return true;
  };

  // ── 5. Sement qoldig'i ────────────────────────────────────────────────────
  const [cementOpening, setCementOpening] = useState(() => load('cement_opening', { date: '25.04.2025', tons: 0 }));
  useEffect(() => save('cement_opening', cementOpening), [cementOpening]);

  // ── 7. Kirim (naqd) ───────────────────────────────────────────────────────
  const [incomeRows, setIncomeRows] = useState(() => load('income_rows', []));
  useEffect(() => save('income_rows', incomeRows), [incomeRows]);
  // Manfiy kirim aslida chiqim bo'lib, qoldiqni jimgina kamaytirardi (va
  // "Kirim" hisobotida musbat summa sifatida ko'rinmasdi).
  const addIncomeRow = (amount, desc, date = new Date().toLocaleDateString('ru-RU')) => {
    const amt = parseNum(amount);
    if (!(amt > 0)) { alert("Kirim summasi 0 dan katta bo'lishi kerak."); return false; }
    const ts = uid();
    setIncomeRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date, amount: amt, desc }]);
    return true;
  };
  const deleteIncomeRow = (id) => setIncomeRows(p => p.filter(r => r.id !== id));

  // ── 8. Chiqim (naqd) ──────────────────────────────────────────────────────
  const [expenseRows, setExpenseRows] = useState(() => load('expense_rows', []));
  useEffect(() => save('expense_rows', expenseRows), [expenseRows]);
  const addExpenseRow = (amount, desc, date = new Date().toLocaleDateString('ru-RU')) => {
    const amt = parseNum(amount);
    if (!(amt > 0)) { alert("Chiqim summasi 0 dan katta bo'lishi kerak."); return false; }
    const ts = uid();
    setExpenseRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date, amount: amt, desc }]);
    return true;
  };
  const deleteExpenseRow = (id) => setExpenseRows(p => p.filter(r => r.id !== id));
  const _incomeSum  = incomeRows.reduce((s, r)  => s + Number(r.amount || 0), 0);
  const _expenseSum = expenseRows.reduce((s, r) => s + Number(r.amount || 0), 0);

  // ── 9. Sotilgan tonna ─────────────────────────────────────────────────────
  const [soldRows, setSoldRows] = useState(() => load('sold_rows', []));
  useEffect(() => save('sold_rows', soldRows), [soldRows]);
  const addSoldRow = (entry) => {
    // Manfiy tonna qoldiqni yo'qdan oshiradi (addSaleRow bilan bir xil xavf)
    if (!(Number(entry?.tons) > 0)) { alert("Tonna 0 dan katta bo'lishi kerak."); return null; }
    const ts = uid();
    const row = { id: ts, createdAt: ts, worker: currentWorker, date: new Date().toLocaleDateString('ru-RU'), ...entry, ...custFields(customers, entry?.customer) };
    setSoldRows(p => [...p, row]);
    // Nasiya bo'lsa — BOG'LANGAN qarz yaratamiz (sourceType 'sold'). Ilgari qarz
    // SoldTons sahifasida qo'lda yaratilardi va sotuv o'chirilганда osilib qolardi
    // (arvoh qarz). Endi sotuv bilan birga o'chadi.
    const ch  = entry.paymentChannel || 'naqd';
    const amt = Number(row.tons || 0) * Number(row.pricePerTon || 0);
    const mkDebt = (sum, tag) => setDebtRows(p => [...p, {
      id: uid(), createdAt: ts, worker: currentWorker, date: row.date,
      customer: row.customer, customerId: row.customerId, amount: sum, paid: 0, payments: [],
      note: tag, auto: true, sourceType: 'sold', sourceId: ts,
    }]);

    if ((ch === 'nasiya' || ch === 'avans') && amt > 0) {
      // NASIYA ham, AVANSDAN ham bir xil: mijozning avansi bo'lsa AVVAL
      // shundan yechiladi, yetmagan qismi qarzga o'tadi. Pul allaqachon
      // olingan — kassaga yozilmaydi (_soldByCh faqat naqd/bank/click ni
      // sanaydi). Ilgari nasiya avansga tegmasdi: avansi bor mijoz nasiyaga
      // yuk olsa, avansi turgan holda qarzdor bo'lib qolardi.
      row.advanceUsed = consumeAdvance(row.customer, amt, ts);
      const rem = amt - row.advanceUsed;
      if (rem > 0) mkDebt(rem,
        `🔗 Eski sotuv (${ch === 'avans' ? 'avans' : 'nasiya'}): ${row.customer} — ${fmtTons(row.tons)} tn` +
        (row.advanceUsed > 0 ? ` (avansdan ${row.advanceUsed.toLocaleString('ru-RU')} so'm yechildi)` : ''));
    }
    return row; // SoldTons.jsx qaytган qatorни tekshiradi
  };
  const deleteSoldRow = (id) => {
    if (blockIfDebtPaid(debtRows, 'sold', id)) return false;
    // Avansdan to'langan bo'lsa — avansni qaytaramiz (ulgurji sotuv bilan
    // bir xil), aks holda sotuv o'chib, avans ishlatilgan bo'lib qolardi.
    const sold = soldRows.find(r => r.id === id);
    if (sold && Number(sold.advanceUsed) > 0) restoreAdvanceForSale(id);
    setSoldRows(p => p.filter(r => r.id !== id));
    // Bog'langan nasiya qarzini ham o'chiramiz
    setDebtRows(p => p.filter(r => !(r.auto && r.sourceType === 'sold' && r.sourceId === id)));
    return true;
  };
  const totalSoldTons = soldRows.reduce((s, r) => s + Number(r.tons || 0), 0);
  // Eski "Sotilgan tonna" to'lov kanali bo'yicha pul tushumi (kassaga qo'shiladi)
  const _soldByCh = (ch) => soldRows
    .filter(r => (r.paymentChannel || 'naqd') === ch)
    .reduce((s, r) => s + Number(r.tons || 0) * Number(r.pricePerTon || 0), 0);
  const _soldNaqd  = _soldByCh('naqd');
  const _soldBank  = _soldByCh('bank');
  const _soldClick = _soldByCh('click');

  // To'liq Naqd balansi = ochilish + cashRows(auto+manual) + kirim − chiqim + eski sotuv(naqd)
  const totalCashBalance = Number(cashOpening.amount) + _cashRowsSum + _incomeSum - _expenseSum + _soldNaqd;

  // ── 10. Olingan tonna ─────────────────────────────────────────────────────
  // MUHIM: sement olish HAR DOIM yetkazib beruvchidan QARZGA olinadi.
  // Kassadan pul YECHILMAYDI (pul kamaymaydi). Yetkazib beruvchiga to'lov
  // keyinroq "Yetkazib beruvchi qarzlari" bo'limidan alohida kiritiladi.
  const [recvRows, setRecvRows] = useState(() => {
    const ftToDate = (ft) => { const d = new Date((ft || '').replace(' ', 'T')); return isNaN(d.getTime()) ? null : d.toLocaleDateString('ru-RU'); };
    return load('recv_rows', []).map(r => r.factoryTime ? { ...r, date: ftToDate(r.factoryTime) || r.date } : r);
  });
  useEffect(() => save('recv_rows', recvRows), [recvRows]);
  const addRecvRow = (entry) => {
    // parseNum: "12,5" kabi vergulli kasr Number() da NaN berib, to'g'ri
    // kiritilgan yuk ham rad etilardi.
    const tonsN = parseNum(entry?.tons);
    if (!(tonsN > 0)) { alert("Tonna 0 dan katta bo'lishi kerak."); return null; }
    const ts = uid();
    const today = new Date().toLocaleDateString('ru-RU');
    const ftDate = (() => { const d = new Date((entry.factoryTime || '').replace(' ', 'T')); return isNaN(d.getTime()) ? null : d.toLocaleDateString('ru-RU'); })();
    const row = {
      id: ts, createdAt: ts, worker: currentWorker, date: ftDate || today,
      source: entry.source || '', brand: entry.brand || '',
      vehicleNo: entry.vehicleNo || '', tons: tonsN,
      pricePerTon: parseNum(entry.pricePerTon),
      paymentChannel: entry.paymentChannel || 'naqd',
      cardName: entry.cardName || '', factoryTime: entry.factoryTime || '',
      izoh: entry.izoh || '',
      warehouseId: entry.warehouseId || defaultWhId,
      cementType: entry.cementType || '',
    };
    setRecvRows(p => [...p, row]);
    return row;
  };
  // Yukni tahrirlash. Tonna KAMAYTIRILSA, shu yukdan allaqachon chiqarilgan
  // miqdordan past tushib ketmasligi kerak: sotuv 30 tn, sklad 10 tn bo'lsa-yu
  // yuk 20 tn ga tushirilsa — sement qoldig'i minusga ketardi (chiqim bor,
  // kirim yo'q). deleteRecvRow da bunday himoya bor edi, tahrirda yo'q edi.
  const updateRecvRow = (id, fields) => {
    if (fields && fields.tons !== undefined) {
      const newTons = parseNum(fields.tons);
      if (!(newTons > 0)) { alert("Tonna 0 dan katta bo'lishi kerak."); return false; }
      const soldTons = salesRows
        .filter(s => s.recvId === id)
        .reduce((s, r) => s + Number(r.tons || 0), 0);
      const skladTons = skladRows
        .filter(r => r.type === 'kirim' && r.sourceId === id)
        .reduce((s, r) => s + Number(r.kg || 0), 0) / 1000;
      const used = soldTons + skladTons;
      if (newTons < used - 0.001) {
        alert(
          `Tonnani ${fmtTons(newTons)} ga tushirib bo'lmaydi.\n\n` +
          `Bu yukdan allaqachon chiqarilgan: ${fmtTons(used)} tn` +
          (soldTons ? `\n · sotuv: ${fmtTons(soldTons)} tn` : '') +
          (skladTons ? `\n · skladga: ${fmtTons(skladTons)} tn` : '') +
          `\n\nAvval o'sha sotuv/o'tkazmani bekor qiling.`
        );
        return false;
      }
    }
    setRecvRows(p => p.map(r => r.id === id ? { ...r, ...fields } : r));
    return true;
  };
  const deleteRecvRow = (id) => {
    // Taqsimlash orqali shu yukdan qilingan sotuvlar bo'lsa — yukni o'chirish
    // ularni "arvoh" qilib qoldiradi: sement kelmagan, lekin sotuv bor.
    // Sotuvni jimgina o'chirib bo'lmaydi (unga mijoz qarzi/to'lovi bog'langan),
    // shuning uchun foydalanuvchini avval o'sha sotuvlarga yo'naltiramiz.
    const linked = salesRows.filter(s => s.recvId === id);
    if (linked.length) {
      alert(
        `Bu yukdan ${linked.length} ta sotuv qilingan:\n` +
        linked.slice(0, 5).map(s => `· ${s.customer} — ${fmtTons(s.tons)} tn`).join('\n') +
        (linked.length > 5 ? `\n· ...yana ${linked.length - 5} ta` : '') +
        `\n\nAvval "Sotish" bo'limidan shu sotuvlarni o'chiring.`
      );
      return false;
    }
    // Bu yukdan chakana skladga o'tkazilgan kg allaqachon sotilgan bo'lsa,
    // yukni o'chirish sklad kirimини yo'q qilib, qoldiqни minusга tushiradi
    // (kirim yo'qoladi, sotuv chiqimи qoladi). Shuni bloklaymiz.
    const myKirimKg = skladRows
      .filter(r => r.type === 'kirim' && r.sourceId === id)
      .reduce((s, r) => s + Number(r.kg || 0), 0);
    if (myKirimKg > 0) {
      const skladNet = skladRows.reduce((s, r) => s + Number(r.kg || 0), 0);
      if (skladNet - myKirimKg < -0.001) {
        alert(
          `Bu yukdan skladga ${Math.round(myKirimKg)} kg o'tkazilgan va uning bir qismi allaqachon sotilgan.\n\n` +
          `Yukni o'chirsa sklad qoldig'i minusга tushadi. Avval tegishli sklad sotuvini bekor qiling.`
        );
        return false;
      }
    }
    setRecvRows(p => p.filter(r => r.id !== id));
    // Cascade: eski versiyalarda yaratilgan auto chiqim yozuvlari bo'lsa ham o'chirish.
    // sourceType tekshiruvi MUHIM — busiz boshqa bo'limning bir xil id'li yozuvi
    // ham qo'shib o'chib ketishi mumkin edi.
    const rm = (rows) => rows.filter(r => !(r.auto && r.sourceType === 'recv' && r.sourceId === id));
    setCashRows(rm); setBankRows(rm); setClickRows(rm);
    // Shu recvRow'dan sklad kirim yozuvlari (taqsimlash orqali yaratilgan)
    setSkladRows(p => p.filter(r => !(r.type === 'kirim' && r.sourceId === id)));
  };
  // Excel'dan ko'plab "Olingan tonna" import — TEKSHIRILMAGAN (pending) holatda.
  // Pul (zavodga to'lov) tasdiqlangandagina yoziladi.
  const importRecvRows = (rows) => {
    // id har qator uchun uid() dan: "base + i" generator hisoblagichini surmay,
    // o'sha diapazonni keyingi yozuvlar qayta band qilishi mumkin edi.
    setRecvRows(p => [...p, ...rows.map((r) => { const id = uid(); return {
      id, createdAt: id, worker: currentWorker,
      date: r.date || (() => { const d = new Date((r.factoryTime || '').replace(' ', 'T')); return isNaN(d.getTime()) ? new Date().toLocaleDateString('ru-RU') : d.toLocaleDateString('ru-RU'); })(),
      source: r.source || '', brand: r.brand || '', vehicleNo: r.vehicleNo || '',
      tons: parseNum(r.tons), pricePerTon: parseNum(r.pricePerTon),
      paymentChannel: r.paymentChannel || 'bank',
      cardName: r.cardName || '', factoryTime: r.factoryTime || '', izoh: r.izoh || '',
      warehouseId: r.warehouseId || defaultWhId,
      pending: true, // tekshirilmagan — sariq
    }; })]);
  };
  // Tasdiqlash: maydonlarni yangilab, pending'ni olib tashlaydi.
  // Kassadan pul YECHILMAYDI — bu summa yetkazib beruvchi qarzimizga qo'shiladi.
  const verifyRecvRow = (id, patch = {}) => {
    const cur = recvRows.find(r => r.id === id);
    if (!cur || !cur.pending) return false;
    const m = { ...cur, ...patch, pending: false };
    // Excel importida tonna tekshirilmaydi (fayl har xil bo'lishi mumkin), shu
    // sababli tasdiqlash — oxirgi to'siq. Manfiy/nol tonna sement qoldig'ini
    // yo'qdan oshirib, keyin sotib bo'lmaydigan "arvoh" qoldiq qoldirardi.
    if (!(parseNum(m.tons) > 0)) {
      alert("Tonna 0 dan katta bo'lishi kerak. Tasdiqlashdan oldin to'g'rilang.");
      return false;
    }
    setRecvRows(p => p.map(r => r.id === id ? m : r));
    return true;
  };
  // TASDIQLANMAGAN (pending) yuk qoldiqqa KIRMAYDI. Ilgari kirardi, lekin
  // zavod qarzi (supplierReceivedOf) pending'ni chiqarib tashlardi — natijada
  // Excel'dan import qilingan yuk sementni darhol oshirib, qarzni esa
  // oshirmasdi: "tekin sement" paydo bo'lardi. Tasdiqlash ayni tonnani
  // tekshirish bosqichi (verifyRecvRow), shuning uchun undan oldin qoldiqqa
  // qo'shish noto'g'ri.
  const _recvOk = recvRows.filter(r => !r.pending);
  const totalRecvTons = _recvOk.reduce((s, r) => s + Number(r.tons || 0), 0);
  const pendingRecvTons = recvRows.filter(r => r.pending).reduce((s, r) => s + Number(r.tons || 0), 0);
  const pendingRecvCount = recvRows.filter(r => r.pending).length;

  // ── 10b. Yetkazib beruvchilar (manbaa) bazasi ─────────────────────────────
  // Mijozlar bazasiga o'xshash — autocomplete va saqlash uchun.
  const [suppliers, setSuppliers] = useState(() => load('suppliers', []));
  useEffect(() => save('suppliers', suppliers), [suppliers]);
  const addSupplier = ({ name, phone = '', note = '' }) => {
    const nm = String(name || '').trim();
    if (!nm) return;
    const ts = uid();
    setSuppliers(p => p.some(s => sameName(s.name, nm))
      ? p
      : [...p, { id: ts, createdAt: ts, worker: currentWorker, name: nm, phone: String(phone).trim(), note }]);
  };
  // Yetkazib beruvchi ham ISM orqali bog'lanadi (recvRows.source, payments.supplier).
  // Nom o'zgarsa, olingan yuklar va to'lovlar undan uzilib, qarz noto'g'ri chiqardi.
  const updateSupplier = (id, data) => {
    const old = suppliers.find(s => s.id === id);
    const newName = String(data?.name || '').trim();
    const oldName = String(old?.name || '').trim();
    if (old && newName && newName !== oldName) {
      if (suppliers.some(s => s.id !== id && sameName(s.name, newName))) {
        alert(`"${newName}" nomli yetkazib beruvchi allaqachon bor.`);
        return false;
      }
      setRecvRows(p => p.map(r => sameName(r.source, oldName) ? { ...r, source: newName } : r));
      setSupplierPayments(p => p.map(x => sameName(x.supplier, oldName) ? { ...x, supplier: newName } : x));
    }
    setSuppliers(p => p.map(s => s.id === id ? { ...s, ...data } : s));
    return true;
  };
  const deleteSupplier = (id) => {
    const s = suppliers.find(x => x.id === id);
    if (s) {
      const debt = supplierDebtOf(s.name);
      if (debt > 0) {
        alert(`"${s.name}" ga ${debt.toLocaleString('ru-RU')} so'm qarzimiz bor.\n\nAvval hisob-kitobni yoping.`);
        return false;
      }
    }
    setSuppliers(p => p.filter(x => x.id !== id));
    return true;
  };

  // ── 10c. Yetkazib beruvchiga to'lovlar (qarzni uzish) ─────────────────────
  // Sement olganda pul yechilmaydi (qarzga). Bu yerda zavodga to'lov qilinganda
  // tegishli kassadan chiqim yoziladi.
  const [supplierPayments, setSupplierPayments] = useState(() => load('supplier_payments', []));
  useEffect(() => save('supplier_payments', supplierPayments), [supplierPayments]);
  const paySupplier = (supplier, amount, channel = 'naqd', note = '') => {
    // parseNum + `!(amt > 0)` — ikkalasi ham SHART:
    //   · Number("1 000 000") → NaN, va `NaN <= 0` FALSE bo'lgani uchun eski
    //     tekshiruv uni o'tkazib yuborardi. Kassaga `amount: -NaN` yozilib,
    //     butun naqd/bank/click qoldig'i "NaN" bo'lib qolardi;
    //   · manfiy summa esa kassaga KIRIM sifatida tushardi (-(-N) = +N).
    const amt = parseNum(amount);
    if (!supplier || !(amt > 0)) { alert("To'lov summasi 0 dan katta bo'lishi kerak."); return false; }
    // Qarzdan ortiq to'lov — supplierDebtOf() Math.max(0,...) qilgani uchun
    // ortiqcha summa hisobotda umuman ko'rinmay yo'qolardi. Ogohlantiramiz.
    const owed = supplierDebtOf(supplier);
    if (amt > owed + 0.001 && !window.confirm(
      `"${supplier}" ga qarzimiz: ${owed.toLocaleString('ru-RU')} so'm\n` +
      `To'lamoqchisiz: ${amt.toLocaleString('ru-RU')} so'm\n\n` +
      `${(amt - owed).toLocaleString('ru-RU')} so'm ORTIQCHA to'lanadi (oldindan to'lov).\nDavom etamizmi?`
    )) return false;
    const ts = uid();
    const today = new Date().toLocaleDateString('ru-RU');
    setSupplierPayments(p => [...p, {
      id: ts, createdAt: ts, worker: currentWorker, date: today,
      supplier, amount: amt, channel, note,
    }]);
    // ── INTEGRATSIYA: zavodga to'lov → tegishli kassadan chiqim ──────────────
    const tag  = `🔗 Yetkazib beruvchiga to'lov: ${supplier}`;
    const link = { auto: true, sourceType: 'supplier_payment', sourceId: ts, createdAt: ts, worker: currentWorker, date: today };
    if      (channel === 'naqd')  setCashRows(p  => [...p, { ...link, id: uid(), amount: -amt, desc: tag }]);
    else if (channel === 'bank')  setBankRows(p  => [...p, { ...link, id: uid(), amount: -amt, desc: tag }]);
    else if (channel === 'click') setClickRows(p => [...p, { ...link, id: uid(), amount: -amt, desc: tag }]);
    return true;
  };
  const deleteSupplierPayment = (id) => {
    setSupplierPayments(p => p.filter(x => x.id !== id));
    const rm = (rows) => rows.filter(r => !(r.auto && r.sourceType === 'supplier_payment' && r.sourceId === id));
    setCashRows(rm); setBankRows(rm); setClickRows(rm);
  };

  // Yetkazib beruvchilar ro'yxati (saqlanganlar + recv manbalari + to'lovlar).
  // Nomlar normallashtirilib yagonalashtiriladi: "Kizilkum sement" Excel'dan,
  // "Kizilkum Sement" qo'lda kiritilgan bo'lsa — bu bitta zavod. Ilgari ular
  // ikki qator bo'lib, olingan yuk bittasiga, to'lov ikkinchisiga yozilardi:
  // qarz to'lanmagandek ko'rinib, to'langan pul hisobotdan yo'qolardi.
  // Baza (suppliers) birinchi — ko'rsatiladigan nom o'shandan olinadi.
  const supplierList = uniqueNames(
    suppliers.map(s => s.name),
    recvRows.map(r => r.source),
    supplierPayments.map(p => p.supplier),
  );
  // Tasdiqlangan (pending bo'lmagan) olingan sementning umumiy summasi = qarz
  const supplierReceivedOf = (name) => recvRows
    .filter(r => sameName(r.source, name) && !r.pending)
    .reduce((s, r) => s + Number(r.tons || 0) * Number(r.pricePerTon || 0), 0);
  const supplierPaidOf = (name) => supplierPayments
    .filter(p => sameName(p.supplier, name))
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const supplierDebtOf = (name) => Math.max(0, supplierReceivedOf(name) - supplierPaidOf(name));
  const totalSupplierDebt    = supplierList.reduce((s, n) => s + supplierDebtOf(n), 0);
  const totalSupplierReceived = supplierList.reduce((s, n) => s + supplierReceivedOf(n), 0);
  const totalSupplierPaid     = supplierPayments.reduce((s, p) => s + Number(p.amount || 0), 0);

  // Sement qoldig'i = ochilish + olingan − (eski sotilgan + yangi sotuv)
  // Eslatma: yangi "Sotish" (salesRows) ham hisobga olinadi — pastda salesRows
  // e'lon qilingach hisoblanadi.

  // ── 11. Qarzlar ───────────────────────────────────────────────────────────
  const [debtRows, _setDebtRows] = useState(() => load('debt_rows', []));
  useEffect(() => save('debt_rows', debtRows), [debtRows]);
  // advanceRef bilan bir xil sabab: bitta render ichida qarzlar ketma-ket bir
  // necha marta o'zgartirilsa (masalan oborotkani "Hammasini tasdiqlash" —
  // payCustomerDebt sikl ichida), har bir chaqiruv ESKI debtRows'ni ko'rar va
  // bitta qarzni bir necha marta "yopib", paid > amount holatiga olib kelardi.
  // Shuning uchun setDebtRows o'ralgan: ref DARHOL yangilanadi, o'qish esa
  // hisob-kitoblarda debtRef.current dan boradi.
  const debtRef = useRef(debtRows);
  const setDebtRows = (upd) => {
    debtRef.current = typeof upd === 'function' ? upd(debtRef.current) : upd;
    _setDebtRows(debtRef.current);
  };
  const addDebtRow = (customer, amount, note = '') => {
    // Manfiy qarz umumiy qarz summasini kamaytirib, hisobotni buzardi.
    if (!(parseNum(amount) > 0)) { alert("Qarz summasi 0 dan katta bo'lishi kerak."); return false; }
    const ts = uid();
    setDebtRows(p => [...p, {
      id: ts, createdAt: ts, worker: currentWorker,
      date: new Date().toLocaleDateString('ru-RU'),
      ...custFields(customers, customer), amount: parseNum(amount), paid: 0, note,
      payments: [],
    }]);
    return true;
  };
  const payDebt = (id, payAmount, payNote = '', channel = 'naqd') => {
    const amt = parseNum(payAmount);
    // Mijoz ismini topamiz (description uchun)
    const debtRow = debtRows.find(r => r.id === id);
    const customer = debtRow?.customer || '';
    // Manfiy/nol to'lov kassaga manfiy kirim yozib, qoldiqni buzardi.
    if (!(amt > 0)) { alert("To'lov summasi 0 dan katta bo'lishi kerak."); return false; }
    // Qarzdan ortiq to'lov: qoldiq Math.max(0,...) bilan hisoblangani uchun
    // ortiqcha summa hech qaysi bo'limda ko'rinmay yo'qolardi (paySupplier
    // bilan bir xil holat — u yerda ogohlantirish bor edi, bu yerda yo'q).
    const rem = debtRow ? Math.max(0, Number(debtRow.amount) - Number(debtRow.paid)) : 0;
    if (amt > rem + 0.001 && !window.confirm(
      `Qolgan qarz: ${rem.toLocaleString('ru-RU')} so'm\n` +
      `To'lamoqchisiz: ${amt.toLocaleString('ru-RU')} so'm\n\n` +
      `${(amt - rem).toLocaleString('ru-RU')} so'm ORTIQCHA — bu summa qarz hisobida ko'rinmaydi.\n` +
      `Ortiqcha pulni avans sifatida kiritish to'g'riroq. Davom etamizmi?`
    )) return false;
    const ts = uid();
    const today = new Date().toLocaleDateString('ru-RU');
    setDebtRows(p => p.map(r => {
      if (r.id !== id) return r;
      return {
        ...r,
        paid: Number(r.paid) + amt,
        payments: [...(r.payments || []), { id: ts, date: today, amount: amt, note: payNote, worker: currentWorker, channel }],
      };
    }));
    // ── INTEGRATSIYA: qarz to'lovi → tegishli kassaga kirim ─────────────────
    const tag  = `🔗 Qarz to'lovi: ${customer}`;
    // customer maydonini linkga qo'shamiz — balans tarixida "manbaga o'tish"
    // shu orqali mijoz kartochkasini topadi (ilgari yo'q edi, manba ko'rinmasdi).
    const link = { auto: true, sourceType: 'debt_payment', sourceId: `${id}_p${ts}`, createdAt: ts, worker: currentWorker, date: today, customer };
    if      (channel === 'naqd')  setCashRows(p  => [...p, { ...link, id: uid(), amount:  amt, desc: tag }]);
    else if (channel === 'bank')  setBankRows(p  => [...p, { ...link, id: uid(), amount:  amt, desc: tag }]);
    else if (channel === 'click') setClickRows(p => [...p, { ...link, id: uid(), amount:  amt, desc: tag }]);
    return true;
  };
  // Mijozning QOLDIQ AVANSINI uning qarzlariga qo'llash (eskisidan boshlab).
  // Yangi sotuvlarda bu avtomatik bo'ladi, lekin bu qoida joriy etilgunga
  // qadar yozilgan qatorlarda mijoz bir vaqtda ham qarzdor, ham avansi bor
  // holda qolgan. Bu tugma o'sha eski yozuvlarni to'g'rilaydi.
  // Kassaga kirim YOZILMAYDI — pul avans olinganda allaqachon kassaga kirgan.
  const payDebtFromAdvance = (customer) => {
    const cRef  = custRef(customer);
    const avail = custRows(advanceRef.current, cRef)
      .reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.used)), 0);
    const myDebts = custRows(debtRows, cRef);
    const owed = myDebts.reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.paid)), 0);
    if (!(avail > 0)) { alert(`"${customer}" da qoldiq avans yo'q.`); return false; }
    if (!(owed  > 0)) { alert(`"${customer}" da qolgan qarz yo'q.`); return false; }

    const use = Math.min(avail, owed);
    if (!window.confirm(
      `"${customer}"\n\n` +
      `Qoldiq avans: ${avail.toLocaleString('ru-RU')} so'm\n` +
      `Qolgan qarz:  ${owed.toLocaleString('ru-RU')} so'm\n\n` +
      `${use.toLocaleString('ru-RU')} so'm avansdan qarzga o'tkaziladi.\n` +
      `(Kassaga qayta kirim yozilmaydi — pul allaqachon olingan.)\n\nDavom etamizmi?`
    )) return false;

    const ts    = uid();
    const today = new Date().toLocaleDateString('ru-RU');
    // Avansdan yechish: sourceId sifatida shu operatsiya ts si yoziladi, ya'ni
    // keyinchalik izini topish mumkin (usages[].saleId).
    const applied = consumeAdvance(customer, use, ts);
    if (applied <= 0) return false;

    const { plan } = planDebtPayment(myDebts, applied);
    setDebtRows(p => p.map(r => {
      const pay = plan[r.id];
      if (!pay) return r;
      return {
        ...r,
        paid: Number(r.paid) + pay,
        payments: [...(r.payments || []), {
          id: uid(), date: today, amount: pay, channel: 'avans',
          note: 'Avansdan yopildi', worker: currentWorker,
        }],
      };
    }));
    return true;
  };

  const deleteDebtRow = (id) => {
    // To'lovi bor qarzni o'chirib bo'lmaydi. Sabab: to'lov Kassa orqali
    // (payCustomerDebt — sourceId "mijoz_pc...") qilingan bo'lsa, uni bu yerdan
    // ishonchli topib o'chirib bo'lmaydi (bitta to'lov bir necha qarzga taqsimlangan
    // bo'lishi mumkin). O'chirsak — qarz yo'qoladi-yu, olingan pul kassada osilib
    // qoladi. Shuning uchun avval to'lovni bekor qilishni talab qilamiz.
    const d = debtRows.find(r => r.id === id);
    if (d && Number(d.paid) > 0) {
      alert(
        `Bu qarzda ${Number(d.paid).toLocaleString('ru-RU')} so'm to'lov qayd etilgan.\n\n` +
        `Avval to'lovni bekor qiling (Kassa yoki Qarzlar bo'limidan), keyin qarzni o'chiring.`
      );
      return false;
    }
    setDebtRows(p => guardAutoDelete(p, id));
    // Eski (payDebt) uslubidagi to'lovlardan qolgan auto yozuvlar bo'lsa tozalash.
    // paid=0 bo'lgani uchun odatda hech narsa topilmaydi — faqat himoya.
    const prefix = `${id}_p`;
    setCashRows(p  => p.filter(r => !r.auto || !String(r.sourceId || '').startsWith(prefix)));
    setBankRows(p  => p.filter(r => !r.auto || !String(r.sourceId || '').startsWith(prefix)));
    setClickRows(p => p.filter(r => !r.auto || !String(r.sourceId || '').startsWith(prefix)));
    return true;
  };
  // ── Mijoz qarzini bittada qabul qilish (kassir uchun — eng oson) ──────────
  // Summa mijozning qarzlariga ESKISIDAN boshlab taqsimlanadi, kassaga kirim
  // yoziladi. Natija: { applied (qarzga ketgan), leftover (ortiqcha) }.
  const payCustomerDebt = (customer, amount, channel = 'naqd', note = '') => {
    const amt = parseNum(amount);
    if (!(amt > 0)) return { applied: 0, leftover: 0 };
    const base = uid();
    const today = new Date().toLocaleDateString('ru-RU');

    // Taqsimlash mantiqi lib/debtAllocation.js da (sof funksiya, testlar bilan).
    // MUHIM: debtRows emas, debtRef.current — bitta render ichidagi ketma-ket
    // chaqiruvlar bir-birining natijasini ko'rishi uchun (yuqoridagi izohga q.).
    const { plan, applied, leftover } = planDebtPayment(custRows(debtRef.current, custRef(customer)), amt);
    if (applied <= 0) return { applied: 0, leftover: amt };

    // Qarzlarni yangilash (har biriga to'lov yozuvi, kanal bilan).
    // To'lov obyektlari OLDINDAN yasaladi: `apply` ref va state uchun ikki
    // marta chaqiriladi, ichida uid() bo'lsa ikkalasi har xil id olib,
    // ref bilan state bir-biridan uzilib qolardi.
    // id sifatida uid() — ilgari `base + (r.id % 100000)` ishlatilgan edi:
    // u ham takrorlanishi, ham 100 soniyagacha "kelajakdagi" vaqt berishi
    // mumkin edi (Qarzlar sahifasi bu id'ni to'lov vaqti sifatida o'qiydi).
    const payRec = {};
    for (const rid of Object.keys(plan)) {
      payRec[rid] = { id: uid(), date: today, amount: plan[rid], note: note || 'Kassaga to\'lov', worker: currentWorker, channel };
    }
    const apply = (rows) => rows.map(r => {
      const rec = payRec[r.id];
      if (!rec) return r;
      return { ...r, paid: Number(r.paid) + rec.amount, payments: [...(r.payments || []), rec] };
    });
    setDebtRows(apply); // o'ralgan setter debtRef.current ni ham darhol yangilaydi

    // Kassaga bitta umumiy kirim (sotuvdan farqlash uchun sourceType: debt_payment)
    const tag  = `🔗 Qarz to'lovi: ${customer}`;
    const link = { auto: true, sourceType: 'debt_payment', sourceId: `${customer}_pc${base}`, createdAt: base, worker: currentWorker, date: today, customer };
    // id uid() dan: "base + 1" generator hisoblagichini surmaydi va o'sha
    // qiymatni keyingi yozuv qayta band qilib, ikkalasi bir id bilan qolardi.
    if      (channel === 'naqd')  setCashRows(p  => [...p, { ...link, id: uid(), amount: applied, desc: tag }]);
    else if (channel === 'bank')  setBankRows(p  => [...p, { ...link, id: uid(), amount: applied, desc: tag }]);
    else if (channel === 'click') setClickRows(p => [...p, { ...link, id: uid(), amount: applied, desc: tag }]);

    return { applied, leftover };
  };

  // ── Excel importi uchun umumiy tayyorgarlik ───────────────────────────────
  // Mijoz bazasi bilan BIR AMALDA bog'lanadi: bazada yo'q ism uchun shu yerda
  // mijoz ochiladi va qatorga uning id'si beriladi. Buni chaqiruvchi tomonda
  // (importCustomers + import… ketma-ket) qilib bo'lmaydi — setCustomers
  // asinxron, ikkinchi chaqiruv yangi mijozlarni hali ko'rmaydi va qatorlar
  // customerId siz qolardi.
  //
  // Ism yo'q yoki summa musbat emas — qator o'tkazib yuboriladi. Chaqiruvchi
  // (Settings) ham filtrlaydi, lekin himoya shu yerda ham turishi kerak:
  // manfiy summa hisobotni teskari buzardi.
  //
  // buildRow — bo'limga xos maydonlarni qo'shadi (qarzda paid/payments,
  // avansda used/usages).
  const prepareImportRows = (rows, buildRow) => {
    const byKey = new Map(customers.map(c => [custKey(c.name), c]));
    const fresh = [];
    const prepared = (rows || []).map((r) => {
      const raw = String(r.customer ?? '').trim();
      const key = custKey(raw);
      if (!key || !(parseNum(r.amount) > 0)) return null;
      let c = byKey.get(key);
      if (!c) {
        const cid = uid();
        c = {
          id: cid, createdAt: cid, worker: currentWorker,
          name: raw, address: '', phone: '', note: 'Excel importdan',
          linkCode: genLinkCode(),
        };
        byKey.set(key, c);
        fresh.push(c);
      }
      // id uid() dan olinadi: "base + i" ko'rinishi generatorning ichki
      // hisoblagichini surmaydi, ya'ni o'sha diapazonni keyinroq boshqa yozuv
      // qayta band qilib, ikkalasi bir id bilan qolib ketishi mumkin edi.
      const rid = uid();
      return buildRow({
        id: rid, createdAt: rid, worker: currentWorker,
        date: r.date || new Date().toLocaleDateString('ru-RU'),
        customer: c.name, customerId: c.id,
        amount: parseNum(r.amount),
        note: r.note || '',
      });
    }).filter(Boolean);
    return { prepared, fresh };
  };

  // Excel'dan ko'plab qarz import qilish. Qaytaradi: { added, newCustomers }
  const importDebts = (rows) => {
    const { prepared, fresh } = prepareImportRows(rows, (base) => ({ ...base, paid: 0, payments: [] }));
    if (fresh.length) setCustomers(p => [...p, ...fresh]);
    setDebtRows(p => [...p, ...prepared]);
    return { added: prepared.length, newCustomers: fresh.length };
  };
  const totalDebts    = debtRows.reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.paid)), 0);
  const totalDebtsPaid = debtRows.reduce((s, r) => s + Number(r.paid), 0);
  const totalDebtsAll  = debtRows.reduce((s, r) => s + Number(r.amount), 0);

  // ── 12. Avanslar ──────────────────────────────────────────────────────────
  const [advanceRows, _setAdvanceRows] = useState(() => load('advance_rows', []));
  useEffect(() => save('advance_rows', advanceRows), [advanceRows]);
  // advanceRows ning sinxron nusxasi — consumeAdvance bir tikda bir necha marta
  // chaqirilganda (taqsimlash) har chaqiruv oldingisining natijasini ko'rishi uchun.
  //
  // SETTER O'RALGAN (debtRef bilan bir xil sabab): ilgari ref ba'zi joylarda
  // qo'lda yangilanar, ba'zilarida (addAdvanceRow, deleteAdvanceRow) umuman
  // yangilanmasdi — ya'ni avans qo'shilgandan keyin darhol qilingan sotuv uni
  // KO'RMAY qolishi mumkin edi. Bundan tashqari qo'lda yangilashda `apply`
  // funksiyasi IKKI MARTA chaqirilib, ichidagi uid() har safar boshqa id
  // berardi: ref bilan state bir-biridan uzilardi.
  const advanceRef = useRef(advanceRows);
  const setAdvanceRows = (upd) => {
    advanceRef.current = typeof upd === 'function' ? upd(advanceRef.current) : upd;
    _setAdvanceRows(advanceRef.current);
  };
  const addAdvanceRow = (customer, amount, note = '', channel = 'naqd') => {
    const sum = parseNum(amount);
    // Manfiy/nol avansda quyidagi `if (sum > 0)` sharti ishlamay, kassaga
    // kirim YOZILMASDI — lekin avans qatori baribir qo'shilardi. Mijozning
    // avans qoldig'i manfiyga tushib, keyingi sotuvda hisob buzilardi.
    if (!(sum > 0)) { alert("Avans summasi 0 dan katta bo'lishi kerak."); return false; }
    const ts = uid();
    const today = new Date().toLocaleDateString('ru-RU');
    setAdvanceRows(p => [...p, {
      id: ts, createdAt: ts, worker: currentWorker, date: today,
      ...custFields(customers, customer), amount: sum, used: 0, note, usages: [],
    }]);
    // ── INTEGRATSIYA: avans → tegishli kassaga kirim ─────────────────────────
    {
      const tag  = `🔗 Avans: ${customer}`;
      const link = { auto: true, sourceType: 'advance', sourceId: ts, createdAt: ts, worker: currentWorker, date: today, customer };
      if      (channel === 'naqd')  setCashRows(p  => [...p, { ...link, id: uid(), amount:  sum, desc: tag }]);
      else if (channel === 'bank')  setBankRows(p  => [...p, { ...link, id: uid(), amount:  sum, desc: tag }]);
      else if (channel === 'click') setClickRows(p => [...p, { ...link, id: uid(), amount:  sum, desc: tag }]);
    }
    return true;
  };

  // Excel'dan ko'plab avans import qilish (qarzlar importi bilan bir xil
  // qoidada). Qaytaradi: { added, newCustomers }
  //
  // MUHIM FARQ: bu KASSAGA KIRIM YOZMAYDI. addAdvanceRow yozadi, chunki u
  // "hozir pul keldi" degani. Import esa TARIXIY qoldiqni kiritadi — o'sha
  // pul allaqachon kassaga tushgan (yoki boshlang'ich qoldiqda hisobga
  // olingan). Aks holda kassa balansi import summasi qadar yolg'on oshardi.
  // Xuddi shu sabab importDebts ham kassaga tegmaydi.
  const importAdvances = (rows) => {
    const { prepared, fresh } = prepareImportRows(rows, (base) => ({ ...base, used: 0, usages: [] }));
    if (fresh.length) setCustomers(p => [...p, ...fresh]);
    setAdvanceRows(p => [...p, ...prepared]);
    return { added: prepared.length, newCustomers: fresh.length };
  };

  // ── Sanani ommaviy to'g'rilash (import xatosi uchun) ─────────────────────
  // Importda bitta sana butun faylga qo'yiladi. Xato yozilsa yuzlab qatorni
  // bittalab tuzatib bo'lmaydi, hammasini o'chirib qayta import qilish esa
  // mijozlar bazasiga qo'shilgan yangi mijozlarni va qilingan to'lovlarni
  // ham yo'q qilardi.
  //
  // FAQAT qator sanasi o'zgaradi. To'lovlar (payments) va sarflar (usages)
  // o'z sanasida qoladi — ular haqiqatan o'sha kunlarda bo'lgan. Import
  // qilingan qarz/avans kassaga yozuv yaratmaydi, shuning uchun bog'langan
  // yozuvlarni qayta tiklash shart emas.
  const fixRowDates = ({ scope = 'both', from, to }) => {
    const swap = (rows) => rows.map(r => r.date === from ? { ...r, date: to } : r);
    let debts = 0, advances = 0;

    if (scope === 'debt' || scope === 'both') {
      debts = debtRows.filter(r => r.date === from).length;
      if (debts) setDebtRows(swap);
    }
    if (scope === 'advance' || scope === 'both') {
      advances = advanceRows.filter(r => r.date === from).length;
      if (advances) {
        setAdvanceRows(swap);
      }
    }
    return { debts, advances };
  };

  const deleteAdvanceRow = (id) => {
    // Sotuvga ishlatilgan avansni o'chirib bo'lmaydi — aks holda sotuv
    // "to'langan" bo'lib qoladi-yu, puli hech qayerda ko'rinmaydi.
    const adv = advanceRows.find(r => r.id === id);
    if (adv && Number(adv.used) > 0) {
      alert(
        `Bu avansdan ${Number(adv.used).toLocaleString('ru-RU')} so'm allaqachon sotuvga ishlatilgan.\n` +
        `Avval tegishli sotuvni o'chiring — avans avtomatik qaytadi.`
      );
      return;
    }
    setAdvanceRows(p => p.filter(r => r.id !== id));
    // Faqat SHU avansdan yaratilgan avtomatik yozuvni o'chiramiz
    const rm = (rows) => rows.filter(r => !(r.auto && r.sourceType === 'advance' && r.sourceId === id));
    setCashRows(rm); setBankRows(rm); setClickRows(rm);
  };
  const totalAdvances     = advanceRows.reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.used)), 0);
  const totalAdvancesUsed = advanceRows.reduce((s, r) => s + Number(r.used), 0);
  const totalAdvancesAll  = advanceRows.reduce((s, r) => s + Number(r.amount), 0);
  // Mijozning qoldiq avansi
  const advanceBalanceOf = (customer) => custRows(advanceRows, custRef(customer))
    .reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.used)), 0);
  // Sotuvda avansdan yechish — eng eski avansdan boshlab, sourceId (saleId) bilan
  // belgilab. Qaytarilgan: ishlatilgan summa.
  const consumeAdvance = (customer, amount, saleId) => {
    const today = new Date().toLocaleDateString('ru-RU');
    // MUHIM: advanceRows emas, advanceRef.current o'qiladi. React state async
    // yangilanadi — taqsimlashda bir necha sotuv KETMA-KET (bir tikda) yaratilsa,
    // ikkinchi sotuv eski holatni ko'rib AYNAN SHU avansni qayta sarflab yuborardi.
    // Taqsimlash mantiqi lib/debtAllocation.js da (qarz to'lovi bilan bir xil
    // qoida — eng eskisidan boshlab, testlar bilan qoplangan).
    const { plan, applied } = planAdvanceSpend(custRows(advanceRef.current, custRef(customer)), amount);
    if (applied <= 0) return 0;
    const apply = (rows) => rows.map(r => {
      const use = plan[r.id];
      if (!use) return r;
      return { ...r, used: Number(r.used) + use,
        usages: [...(r.usages || []), { id: uid(), saleId, date: today, amount: use, note: 'Sotuvga ishlatildi', worker: currentWorker }] };
    });
    setAdvanceRows(apply); // o'ralgan setter advanceRef ni ham darhol yangilaydi
    return applied;
  };
  // Sotuv o'chirilsa — ishlatilgan avansni qaytarish (saleId bo'yicha)
  const restoreAdvanceForSale = (saleId) => {
    const restore = (rows) => rows.map(r => {
      const mine = (r.usages || []).filter(u => u.saleId === saleId);
      if (!mine.length) return r;
      const back = mine.reduce((s, u) => s + Number(u.amount || 0), 0);
      return { ...r, used: Math.max(0, Number(r.used) - back), usages: (r.usages || []).filter(u => u.saleId !== saleId) };
    });
    setAdvanceRows(restore);
  };

  // ── 13. Sotish ────────────────────────────────────────────────────────────
  const [salesRows, setSalesRows] = useState(() => load('sales_rows', []));
  useEffect(() => save('sales_rows', salesRows), [salesRows]);
  const addSaleRow = (entry) => {
    // MANFIY SOTUV HIMOYASI. Tonna maydoniga "-5" yozilsa, sum manfiy chiqib
    // `if (sum > 0)` sharti ishlamas — kassaga ham, qarzga ham yozuv tushmasdi,
    // lekin sotuv qatori qo'shilardi. Natijada totalSalesTons kamayib, sement
    // qoldig'i YO'QDAN oshib ketardi (pul izisiz 5 tonna paydo bo'lardi).
    const tonsN  = Number(entry?.tons);
    const priceN = Number(entry?.pricePerTon);
    if (!(tonsN > 0)) {
      alert("Tonna 0 dan katta bo'lishi kerak.");
      return null;
    }
    if (!(priceN >= 0) || !isFinite(priceN)) {
      alert("Narx noto'g'ri kiritilgan.");
      return null;
    }
    const ts = uid();
    const sale = { id: ts, createdAt: ts, worker: currentWorker, date: new Date().toLocaleDateString('ru-RU'), ...entry, ...custFields(customers, entry?.customer) };
    // Sanani tizim standartiga keltirish. Taqsimlashda "zavod vaqti" (erkin matn,
    // masalan "2026-07-20 14:30") sana sifatida kelib qolardi — natijada sotuv
    // hech qaysi kunlik/oylik filtrga tushmay, hisobotlardan yo'qolardi.
    sale.date = toLocalDate(sale.date) || new Date().toLocaleDateString('ru-RU');

    // ── INTEGRATSIYA: savdo → tegishli bo'limga avtomatik yozuv ─────────────
    // Pul/qarz/qoldiq shu orqali yangilanadi. Avtomatik yozuvlar belgilanadi
    // (auto:true, sourceId) va faqat shu savdo o'chirilganda o'chiriladi.
    const sum = Number(sale.tons || 0) * Number(sale.pricePerTon || 0);
    if (sum > 0) {
      const tag  = `🔗 Sotuv: ${sale.customer} (${fmtTons(sale.tons)} tn)${sale.vehicleNo ? ` | 🚛 ${sale.vehicleNo}` : ''}`;
      // DIQQAT: link'ga customerId QO'YILMAYDI. Kassa yozuvlarida mijoz maydoni
      // ataylab bo'sh — customerSummary shu bo'shliqqa qarab "bog'lanmagan pul"ni
      // ajratadi. customerId qo'shilsa, sotuvdan tushgan naqd u yerga ikkinchi
      // marta kirib, mijoz kartochkasidagi summa ikkilanardi.
      const link = { auto: true, sourceType: 'sale', sourceId: ts, createdAt: ts, worker: currentWorker, date: sale.date };
      const channel = sale.paymentChannel || 'naqd';
      if (channel === 'naqd')        setCashRows(p  => [...p, { ...link, id: uid(), amount: sum, desc: tag }]);
      else if (channel === 'bank')   setBankRows(p  => [...p, { ...link, id: uid(), amount: sum, desc: tag }]);
      else if (channel === 'click')  setClickRows(p => [...p, { ...link, id: uid(), amount: sum, desc: tag }]);
      else if (channel === 'nasiya' || channel === 'avans') {
        // NASIYA va AVANSDAN bir xil qoida bilan yopiladi: mijozning avansi
        // bo'lsa AVVAL shundan yechiladi, yetmagan qismi qarzga yoziladi.
        // Ilgari "nasiya" avansga umuman tegmasdi — avansi bor mijozga nasiya
        // sotilsa, u bir vaqtning o'zida ham qarzdor bo'lib, ham avansi
        // turaverardi (bir pul ikki joyda). Pul allaqachon kassada, shuning
        // uchun avansdan yopilgan qism kassaga QAYTA yozilmaydi.
        const applied = consumeAdvance(sale.customer, sum, ts);
        sale.advanceUsed = applied;
        const rem = sum - applied;
        if (rem > 0) setDebtRows(p => [...p, {
          ...link, id: uid(), customer: sale.customer, customerId: sale.customerId,
          amount: rem, paid: 0, payments: [],
          note: applied > 0 ? `${tag} (avansdan ${applied.toLocaleString('ru-RU')} so'm yechildi)` : tag,
        }]);
      }
    }
    setSalesRows(p => [...p, sale]);

    // ── Mijozga Telegram xabari (fire-and-forget) ────────────────────────────
    const cust = customers.find(c => c.id === sale.customerId) || findCust(customers, sale.customer);
    const directChatId = cust?.telegramChatId || null;
    const custPhone    = cust?.phone || '';
    if (directChatId || custPhone) {
      const existingDebt = custRows(debtRows, cust || sale.customer)
        .reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.paid)), 0);
      // Avansdan yopilgan qism qarz emas — xabarda ham shu ko'rinsin.
      const newDebt = (sale.paymentChannel === 'nasiya' || sale.paymentChannel === 'avans')
        ? Math.max(0, sum - Number(sale.advanceUsed || 0))
        : 0;
      const totalDebt = existingDebt + newDebt;
      api.notifySale({
        chatId: directChatId,   // to'g'ridan-to'g'ri (telefon shart emas)
        phone: custPhone,       // zaxira: telefon orqali qidirish
        customer: sale.customer,
        tons: sale.tons,
        pricePerTon: sale.pricePerTon,
        paymentChannel: sale.paymentChannel,
        note: sale.note || '',
        totalDebt,
        date: sale.date,
      }).catch(() => {});
    }

    return sale; // chek chiqarish uchun
  };
  // Savdoni tahrirlash.
  //
  // Ilgari bu shunchaki maydonlarni almashtirardi va izohda "narx/tonna
  // o'zgarsa cashRow/debtRow manual yangilanishi kerak" deb yozilgan edi —
  // lekin tahrir oynasi (RecvTons → RecvEditModal) aynan NARX va TO'LOV
  // KANALINI o'zgartirishga ruxsat berardi. Natijada:
  //   · narx oshirilsa — sotuv 6 mln, kassada esa eski 5 mln qolardi
  //   · kanal naqd→nasiya qilinsa — kassada pul turardi, qarz esa yaratilmasdi
  //     (mijoz qarzga olgan, dasturda "to'langan" ko'rinardi)
  //   · mijoz almashtirilsa — qarz eski mijozda qolardi
  // Endi pulga taalluqli maydon o'zgarsa, bog'langan avtomatik yozuvlar
  // qayta yaratiladi (o'chirish + qo'shish bilan bir xil mantiq).
  const updateSaleRow = (id, fields) => {
    const old = salesRows.find(r => r.id === id);
    if (!old) return false;
    const next = { ...old, ...fields };

    const money = (r) => Number(r.tons || 0) * Number(r.pricePerTon || 0);
    const chOf  = (r) => r.paymentChannel || 'naqd';
    const needsRelink =
      Math.abs(money(old) - money(next)) > 0.001 ||
      chOf(old) !== chOf(next) ||
      !sameCust(old.customer, next.customer);

    if (!needsRelink) {                       // izoh, mashina raqami va h.k.
      setSalesRows(p => p.map(r => r.id === id ? next : r));
      return true;
    }

    // To'lovi bor qarzni qayta yaratib bo'lmaydi — to'lov kassada egasiz qolardi
    if (blockIfDebtPaid(debtRows, 'sale', id)) return false;

    // Eski izlarni tozalaymiz (avansni qaytarish ham shu yerda)
    if (old.advanceUsed) restoreAdvanceForSale(id);
    const rm = (rows) => rows.filter(r => !(r.auto && r.sourceType === 'sale' && r.sourceId === id));
    setCashRows(rm); setBankRows(rm); setClickRows(rm); setDebtRows(rm);

    // Yangi qiymatlar bo'yicha qaytadan bog'laymiz
    const sum = money(next);
    const ch  = chOf(next);
    const cf  = custFields(customers, next.customer);
    next.customer = cf.customer; next.customerId = cf.customerId;
    next.advanceUsed = 0;

    if (sum > 0) {
      const tag  = `🔗 Sotuv: ${next.customer} (${fmtTons(next.tons)} tn)${next.vehicleNo ? ` | 🚛 ${next.vehicleNo}` : ''}`;
      const link = { auto: true, sourceType: 'sale', sourceId: id, createdAt: next.createdAt || id, worker: currentWorker, date: next.date };
      if      (ch === 'naqd')   setCashRows(p  => [...p, { ...link, id: uid(), amount: sum, desc: tag }]);
      else if (ch === 'bank')   setBankRows(p  => [...p, { ...link, id: uid(), amount: sum, desc: tag }]);
      else if (ch === 'click')  setClickRows(p => [...p, { ...link, id: uid(), amount: sum, desc: tag }]);
      else if (ch === 'nasiya' || ch === 'avans') {
        // addSaleRow bilan bir xil qoida: avvo avansdan, qolgani qarzga.
        const applied = consumeAdvance(next.customer, sum, id);
        next.advanceUsed = applied;
        const rem = sum - applied;
        if (rem > 0) setDebtRows(p => [...p, {
          ...link, id: uid(), ...cf, amount: rem, paid: 0, payments: [],
          note: applied > 0 ? `${tag} (avansdan ${applied.toLocaleString('ru-RU')} so'm yechildi)` : tag,
        }]);
      }
    }
    setSalesRows(p => p.map(r => r.id === id ? next : r));
    return true;
  };
  // Savdo o'chsa — u yaratgan barcha avtomatik yozuvlar ham o'chadi
  const deleteSaleRow = (id) => {
    if (blockIfDebtPaid(debtRows, 'sale', id)) return false;
    const sale = salesRows.find(r => r.id === id);
    if (sale && sale.advanceUsed) restoreAdvanceForSale(id); // ishlatilgan avansni qaytarish
    setSalesRows(p  => p.filter(r => r.id !== id));
    const rm = (rows) => rows.filter(r => !(r.auto && r.sourceType === 'sale' && r.sourceId === id));
    setCashRows(rm); setBankRows(rm); setClickRows(rm); setDebtRows(rm);
    return true;
  };
  const totalSalesTons = salesRows.reduce((s, r) => s + Number(r.tons || 0), 0);

  // ── Sement turlari (admin tomonidan boshqariladi) ─────────────────────────────
  const [cementTypes, setCementTypes] = useState(() => load('cement_types', ['450 Qoplik', '550 Qoplik', '450 Rasipnoy', '550 Rasipnoy']));
  useEffect(() => save('cement_types', cementTypes), [cementTypes]);
  const addCementType = (name) => {
    const t = name.trim();
    if (!t || cementTypes.includes(t)) return;
    setCementTypes(p => [...p, t]);
  };
  // Qoldig'i bor turni o'chirish — o'sha sement tur bo'yicha hisobdan
  // tushib qolishiga olib keladi. Shuning uchun avval qoldiqni tekshiramiz.
  const removeCementType = (name) => {
    const kg = (skladRows || [])
      .filter(r => r.cementType === name)
      .reduce((s, r) => s + Number(r.kg || 0), 0);
    if (Math.abs(kg) > 0.001) {
      alert(`"${name}" bo'yicha skladda ${kg.toLocaleString('ru-RU')} kg qoldiq bor.\n\nAvval shu qoldiqni sotib tugating, keyin turni o'chiring.`);
      return false;
    }
    const inUse = recvRows.some(r => r.cementType === name) || salesRows.some(r => r.cementType === name);
    if (inUse && !window.confirm(
      `"${name}" turi eski yozuvlarda ishlatilgan.\n\n` +
      `O'chirilsa, o'sha yozuvlar tur bo'yicha hisobotlarda ko'rinmay qoladi (summalar o'zgarmaydi).\n\nDavom etamizmi?`
    )) return false;
    setCementTypes(p => p.filter(t => t !== name));
    return true;
  };

  // ── Asosiy sklad (kilogram hisob — CHAKANA) ──────────────────────────────────
  const [skladRows, setSkladRows] = useState(() => load('sklad_rows', []));
  useEffect(() => save('sklad_rows', skladRows), [skladRows]);

  // Har bir recvRow uchun qancha kg sklad kirim sifatida yozilganini hisoblaymiz.
  // Taqsimlash (split) holatida recvRow qisman skladga ketishi mumkin —
  // shuning uchun to'liq recvRow emas, faqat sklad ketgan qismini chiqaramiz.
  const _skladKgByRecvId = {};
  skladRows.filter(r => r.type === 'kirim' && r.sourceId)
    .forEach(r => { _skladKgByRecvId[r.sourceId] = (_skladKgByRecvId[r.sourceId] || 0) + Number(r.kg || 0); });
  // UI badge uchun: qaysi recvId'lar sklad yozuviga ega (to'liq yoki qisman)
  const _skladSourceIds = new Set(Object.keys(_skladKgByRecvId).map(Number));

  // ULGURJI qoldig'i (tonnada) — har bir recvRowdan skladga ketgan tonnani ayiramiz
  const _ulgurjiRecvTons = _recvOk.reduce((s, r) => {
    const skladTons = (_skladKgByRecvId[r.id] || 0) / 1000;
    return s + Math.max(0, Number(r.tons || 0) - skladTons);
  }, 0);
  const totalCementBalance = Number(cementOpening.tons) + _ulgurjiRecvTons - totalSoldTons - totalSalesTons;

  const addSkladKirim = (recvRowId, kg, desc, cementType) => {
    const kgN = Number(kg) || 0;
    if (kgN <= 0) return null;
    // Bitta yuk (recvRow) o'zida boridan ko'proq skladga o'tkazilishini bloklaymiz.
    // Aks holda ulgurji qoldiq Math.max(0,...) bilan nolda ushlanib, farq
    // hech qayerda ko'rinmay sement "yo'qolib" qolardi.
    const src = recvRows.find(r => r.id === recvRowId);
    if (src) {
      const alreadyKg = _skladKgByRecvId[recvRowId] || 0;
      const capacityKg = Number(src.tons || 0) * 1000 - alreadyKg;
      if (kgN > capacityKg + 0.001) {
        alert(
          `Skladga o'tkazib bo'lmadi.\n\n` +
          `Bu yukda qolgani: ${(capacityKg / 1000).toFixed(3)} tn (${Math.round(capacityKg)} kg)\n` +
          `O'tkazmoqchi: ${(kgN / 1000).toFixed(3)} tn (${Math.round(kgN)} kg)`
        );
        return null;
      }
    }
    const ts = uid();
    const row = {
      id: ts, createdAt: ts, date: new Date().toLocaleDateString('ru-RU'),
      type: 'kirim', kg: kgN, sourceId: recvRowId,
      desc: desc || 'Zavoddan kirim', worker: currentWorker,
      cementType: cementType || '',
    };
    setSkladRows(p => [...p, row]);
    return row;
  };

  const addSkladSotuv = ({ customer, kg, pricePerKg, channel, note, cementType }) => {
    const kgN  = Number(kg);
    const prcN = Number(pricePerKg);
    // Manfiy kg sklad qoldig'ini yo'qdan oshirib yuborardi (chiqim qatori
    // kg: -(-N) = +N bo'lib qolardi) — sotuv ko'rinishida kirim yozilardi.
    if (!(kgN > 0)) { alert("Kilogramm 0 dan katta bo'lishi kerak."); return null; }
    if (!(prcN >= 0) || !isFinite(prcN)) { alert("Narx noto'g'ri kiritilgan."); return null; }
    const ts = uid();
    const sum  = kgN * prcN;
    const td   = new Date().toLocaleDateString('ru-RU');
    const tag  = `🏗 Sklad: ${customer} (${kgN} kg)`;
    const cf   = custFields(customers, customer);
    const link = { auto: true, sourceType: 'sklad_sale', sourceId: ts, createdAt: ts, worker: currentWorker, date: td, ...cf };
    let advanceUsed = 0;
    if (sum > 0) {
      if      (channel === 'naqd')   setCashRows(p  => [...p, { ...link, id: uid(), amount: sum, desc: tag }]);
      else if (channel === 'bank')   setBankRows(p  => [...p, { ...link, id: uid(), amount: sum, desc: tag }]);
      else if (channel === 'click')  setClickRows(p => [...p, { ...link, id: uid(), amount: sum, desc: tag }]);
      else if (channel === 'nasiya' || channel === 'avans') {
        // NASIYA va AVANSDAN bir xil: avvo mijozning avansidan yechiladi,
        // yetmagan qismi qarzga o'tadi. Pul allaqachon olingan, kassaga
        // yozilmaydi — ulgurji sotuv (addSaleRow) bilan bir xil qoida.
        advanceUsed = consumeAdvance(customer, sum, ts);
        const rem = sum - advanceUsed;
        if (rem > 0) setDebtRows(p => [...p, {
          ...link, id: uid(), amount: rem, paid: 0, payments: [],
          note: advanceUsed > 0 ? `${tag} (avansdan ${advanceUsed.toLocaleString('ru-RU')} so'm yechildi)` : tag,
        }]);
      }
    }
    const row = { id: ts, createdAt: ts, date: td, type: 'chiqim', kg: -kgN, ...cf, pricePerKg: Number(pricePerKg), amount: sum, channel, advanceUsed, note: note || '', worker: currentWorker, cementType: cementType || '' };
    setSkladRows(p => [...p, row]);
    return row;
  };

  const totalSkladKg = skladRows.reduce((s, r) => s + Number(r.kg || 0), 0);

  // Sklad sotuvini tahrirlash. Tahrir oynasi mijozni almashtirishga ruxsat
  // beradi — bog'langan qarz va kassa yozuvi ham o'sha mijozga o'tishi kerak,
  // aks holda qarz eski mijozda qolib, yangisida ko'rinmasdi.
  const updateSkladRow = (id, fields) => {
    const cf = fields.customer !== undefined ? custFields(customers, fields.customer) : null;
    const patch = cf ? { ...fields, ...cf } : fields;
    setSkladRows(p => p.map(r => r.id === id ? { ...r, ...patch } : r));
    if (!cf) return;
    const relink = (rows) => rows.map(r =>
      (r.auto && r.sourceType === 'sklad_sale' && r.sourceId === id) ? { ...r, ...cf } : r);
    setCashRows(relink); setBankRows(relink); setClickRows(relink); setDebtRows(relink);
  };

  const deleteSkladSotuv = (id) => {
    if (blockIfDebtPaid(debtRows, 'sklad_sale', id)) return false;
    // Avansdan to'langan bo'lsa — avansni QAYTARAMIZ. Aks holda sotuv
    // o'chadi-yu, mijozning avansi ishlatilgan bo'lib qolardi (pul ham,
    // sement ham unda ko'rinmasdi). Ulgurji sotuvda bu allaqachon bor edi.
    const sk = skladRows.find(r => r.id === id);
    if (sk && Number(sk.advanceUsed) > 0) restoreAdvanceForSale(id);
    setSkladRows(p => p.filter(r => r.id !== id));
    const rm = (rows) => rows.filter(r => !(r.auto && r.sourceType === 'sklad_sale' && r.sourceId === id));
    setCashRows(rm); setBankRows(rm); setClickRows(rm);
    setDebtRows(p => p.filter(r => !(r.auto && r.sourceType === 'sklad_sale' && r.sourceId === id)));
    return true;
  };

  // ── Tur bo'yicha balanslar ─────────────────────────────────────────────────────
  const cementBalanceByType = Object.fromEntries(
    cementTypes.map(type => {
      const recv    = recvRows.filter(r => r.cementType === type).reduce((s, r) => {
        const skladTons = (_skladKgByRecvId[r.id] || 0) / 1000;
        return s + Math.max(0, Number(r.tons || 0) - skladTons);
      }, 0);
      const sold    = salesRows.filter(r => r.cementType === type).reduce((s, r) => s + Number(r.tons || 0), 0);
      const soldOld = soldRows.filter(r => r.cementType === type).reduce((s, r) => s + Number(r.tons || 0), 0);
      return [type, recv - sold - soldOld];
    })
  );
  const skladKgByType = Object.fromEntries(
    cementTypes.map(type => [
      type,
      (skladRows || []).filter(r => r.cementType === type).reduce((s, r) => s + Number(r.kg || 0), 0)
    ])
  );
  // Turi ko'rsatilmagan yozuvlar hech qaysi turga tushmaydi — natijada turlar
  // yig'indisi umumiy qoldiqdan kam chiqib, farq ko'zdan yashirin qolardi.
  // Shu farqni alohida ko'rsatamiz (0 bo'lsa e'tiborsiz qoldiriladi).
  const skladKgUntyped = (skladRows || [])
    .filter(r => !r.cementType || !cementTypes.includes(r.cementType))
    .reduce((s, r) => s + Number(r.kg || 0), 0);

  // ── Ulgurji sklad (ton) bo'yicha qoldiq ────────────────────────────────────
  // Chakana skladga (kg) o'tkazilgan recvRow'lar CHIQARIB TASHLANADI
  // chunki ularning hisobi totalSkladKg orqali alohida yuritiladi.
  const cementByWarehouse = warehouses.map(w => {
    const recv  = _recvOk.filter(r => whOf(r) === w.id).reduce((s, r) => {
      const skladTons = (_skladKgByRecvId[r.id] || 0) / 1000;
      return s + Math.max(0, Number(r.tons || 0) - skladTons);
    }, 0);
    const sales = salesRows.filter(r => whOf(r) === w.id).reduce((s, r) => s + Number(r.tons || 0), 0);
    const sold  = soldRows.filter(r => whOf(r) === w.id).reduce((s, r) => s + Number(r.tons || 0), 0);
    const opening = w.id === defaultWhId ? Number(cementOpening.tons || 0) : 0;
    return { id: w.id, name: w.name, opening, recv, out: sales + sold, balance: opening + recv - sales - sold };
  });
  const cementBalanceOf = (whId) => (cementByWarehouse.find(w => w.id === whId) || {}).balance ?? 0;

  const [bankIncomeRows, setBankIncomeRows] = useState(() => load('bank_income_rows', []));
  useEffect(() => save('bank_income_rows', bankIncomeRows), [bankIncomeRows]);
  const addBankIncomeRow = (amount, desc, date = new Date().toLocaleDateString('ru-RU'), customer = '') => {
    const ts = uid();
    setBankIncomeRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date, amount: Number(amount), desc, ...custFields(customers, customer) }]);
  };
  const deleteBankIncomeRow = (id) => setBankIncomeRows(p => p.filter(r => r.id !== id));
  // Excel'dan bank o'tkazmalarini import — TEKSHIRILMAGAN (pending) holatda.
  // Xodim qaysi mijoz puli ekanini biriktirib tasdiqlaydi.
  const importBankIncomeRows = (rows) => {
    setBankIncomeRows(p => [...p, ...rows.map((r) => { const id = uid(); return {
      id, createdAt: id, worker: currentWorker,
      date: r.date || new Date().toLocaleDateString('ru-RU'),
      amount: parseNum(r.amount),
      desc: r.desc || '',
      ...custFields(customers, r.customer),
      pending: true, // tekshirilmagan — sariq
    }; })]);
  };
  // Tasdiqlash: mijoz/izoh biriktirib, pending'ni olib tashlaydi
  const verifyBankIncomeRow = (id, patch = {}) =>
    setBankIncomeRows(p => p.map(r => r.id === id ? { ...r, ...patch, pending: false } : r));
  const totalBankIncome = bankIncomeRows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const pendingBankCount = bankIncomeRows.filter(r => r.pending).length;

  // ── 14b. Chiqim bank ─────────────────────────────────────────────────────
  const [bankExpenseRows, setBankExpenseRows] = useState(() => load('bank_expense_rows', []));
  useEffect(() => save('bank_expense_rows', bankExpenseRows), [bankExpenseRows]);
  const addBankExpenseRow = (amount, desc, date = new Date().toLocaleDateString('ru-RU'), customer = '') => {
    const ts = uid();
    setBankExpenseRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date, amount: Number(amount), desc, ...custFields(customers, customer) }]);
  };
  const deleteBankExpenseRow = (id) => setBankExpenseRows(p => p.filter(r => r.id !== id));

  // ── 14c. Bank oborotka pending (kirim + chiqim aralash) ──────────────────
  const [bankPendingRows, setBankPendingRows] = useState(() => load('bank_pending_rows', []));
  useEffect(() => save('bank_pending_rows', bankPendingRows), [bankPendingRows]);

  const importOborotka = (rows) => {
    setBankPendingRows(p => [...p, ...rows.map((r) => ({
      id: uid(),
      date: r.date || new Date().toLocaleDateString('ru-RU'),
      orgName: r.orgName || '',
      amount: parseNum(r.amount),
      type: r.type, // 'kirim' | 'chiqim'
      naznachenie: r.naznachenie || '',
      customer: '',
      izoh: '',
    }))]);
  };

  // Natija qaytaradi: { ok, applied, advance } — sahifa qarzning qancha qismi
  // yopilganini foydalanuvchiga ko'rsata olishi uchun.
  const confirmBankPendingRow = (id, { customer = '', izoh = '' } = {}) => {
    const row = bankPendingRows.find(r => r.id === id);
    if (!row) return { ok: false, applied: 0, advance: 0 };
    const ts = uid();
    const desc = izoh || row.naznachenie || '';
    const cf = custFields(customers, customer);
    if (row.type === 'kirim') {
      // MIJOZ TANLANGAN BO'LSA — pul uning qarzini yopishi shart. Ilgari
      // mijoz faqat YORLIQ sifatida yozilardi: bank kirimi ko'rinardi, lekin
      // mijozning qarzi kamaymasdi va avansi paydo bo'lmasdi (oborotkadan
      // kelgan har bir to'lov mijoz kartochkasidan tashqarida qolardi).
      // payCustomerDebt/addAdvanceRow o'zi bankRows'ga kirim yozadi, shuning
      // uchun bu holatda bankIncomeRows'ga QAYTA yozmaymiz — aks holda bank
      // qoldig'i ikki barobar oshib ketardi.
      const cust = String(customer || '').trim();
      if (cust) {
        const res = payCustomerDebt(cust, row.amount, 'bank', desc);
        let advance = 0;
        if (res.applied === 0)      { addAdvanceRow(cust, row.amount, desc, 'bank'); advance = Number(row.amount); }
        else if (res.leftover > 0)  { addAdvanceRow(cust, res.leftover, `${desc} (ortiqcha)`, 'bank'); advance = res.leftover; }
        setBankPendingRows(p => p.filter(r => r.id !== id));
        return { ok: true, applied: res.applied, advance };
      }
      setBankIncomeRows(p => [...p, { id: ts, createdAt: ts, date: row.date, amount: row.amount, desc, ...cf, worker: currentWorker }]);
    } else {
      setBankExpenseRows(p => [...p, { id: ts, createdAt: ts, date: row.date, amount: row.amount, desc, ...cf, worker: currentWorker }]);
    }
    setBankPendingRows(p => p.filter(r => r.id !== id));
    return { ok: true, applied: 0, advance: 0 };
  };

  const deleteBankPendingRow = (id) => setBankPendingRows(p => p.filter(r => r.id !== id));
  const totalBankExpense = bankExpenseRows.reduce((s, r) => s + Number(r.amount || 0), 0);
  // Bank sof balansi (faqat Kirim/Chiqim Bank sahifasi uchun)
  const bankNetBalance   = Number(bankOpening.amount) + totalBankIncome - totalBankExpense;
  // To'liq Bank balansi = ochilish + bankRows(auto+manual) + kirim − chiqim + eski sotuv(bank)
  const totalBankBalance = Number(bankOpening.amount) + _bankRowsSum + totalBankIncome - totalBankExpense + _soldBank;

  // ── 15. Kirim click ───────────────────────────────────────────────────────
  const [clickIncomeRows, setClickIncomeRows] = useState(() => load('click_income_rows', []));
  useEffect(() => save('click_income_rows', clickIncomeRows), [clickIncomeRows]);
  const addClickIncomeRow = (amount, desc, date = new Date().toLocaleDateString('ru-RU')) => {
    const ts = uid();
    setClickIncomeRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date, amount: Number(amount), desc }]);
  };
  const deleteClickIncomeRow = (id) => setClickIncomeRows(p => p.filter(r => r.id !== id));
  const totalClickIncome = clickIncomeRows.reduce((s, r) => s + Number(r.amount || 0), 0);

  // ── 15b. Chiqim click ────────────────────────────────────────────────────
  const [clickExpenseRows, setClickExpenseRows] = useState(() => load('click_expense_rows', []));
  useEffect(() => save('click_expense_rows', clickExpenseRows), [clickExpenseRows]);
  const addClickExpenseRow = (amount, desc, date = new Date().toLocaleDateString('ru-RU')) => {
    const ts = uid();
    setClickExpenseRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date, amount: Number(amount), desc }]);
  };
  const deleteClickExpenseRow = (id) => setClickExpenseRows(p => p.filter(r => r.id !== id));
  const totalClickExpense = clickExpenseRows.reduce((s, r) => s + Number(r.amount || 0), 0);
  // Click sof balansi (faqat Kirim/Chiqim Click sahifasi uchun)
  const clickNetBalance   = Number(clickOpening.amount) + totalClickIncome - totalClickExpense;
  // To'liq Click balansi = ochilish + clickRows(auto+manual) + kirim − chiqim + eski sotuv(click)
  const totalClickBalance = Number(clickOpening.amount) + _clickRowsSum + totalClickIncome - totalClickExpense + _soldClick;

  // ── 16. Ishchilar oyligi ──────────────────────────────────────────────────
  const [workers,        setWorkers]        = useState(() => load('workers', []));
  const [salaryPayments, setSalaryPayments] = useState(() => load('salary_payments', []));
  useEffect(() => save('workers',         workers),        [workers]);
  useEffect(() => save('salary_payments', salaryPayments), [salaryPayments]);

  const addWorker = (name, salary, opts = {}) => {
    // MANFIY oylik "qolgan oylik" hisobini teskari buzadi
    // (totalQoldiMonth = salary − paid), shuning uchun bloklanadi.
    // NOL esa to'g'ri holat: Sozlamalardan xodim qo'shilganda oylik
    // kiritilmaydi (keyin "Ishchilar oyligi" bo'limida belgilanadi).
    // Oylik majburiy bo'lgan joyda chaqiruvchining o'zi `> 0` talab qiladi.
    const sal = parseNum(salary);
    if (sal < 0) { alert("Oylik summasi manfiy bo'lishi mumkin emas."); return false; }
    const ts = uid();
    setWorkers(p => [...p, {
      id: ts, createdAt: ts, worker: currentWorker,
      name, salary: sal, paid: 0,
      position: opts.position || '',
      phone:    opts.phone    || '',
      note:     opts.note     || '',
      role:     opts.role     || 'sotuvchi', // admin, kassir, sotuvchi, omborchi
      password: opts.password || '1234',     // Standart parol
      warehouseId: opts.warehouseId || null, // biriktirilgan sklad
      linkCode: genLinkCode(),
    }]);
    return true;
  };

  const payWorker = (id, amount, note = '', channel = 'naqd') => {
    const num = parseNum(amount);
    // Manfiy/nol summada quyidagi `if (num > 0)` sharti ishlamay, kassadan
    // chiqim YOZILMASDI — lekin xodimning "to'langan" summasi baribir
    // o'zgarardi. Ikkalasi orasidagi bu farqni keyin topib bo'lmasdi.
    if (!(num > 0)) { alert("To'lov summasi 0 dan katta bo'lishi kerak."); return false; }
    const ts = uid();
    const today = new Date().toLocaleDateString('ru-RU');
    const workerObj = workers.find(w => w.id === id);
    setWorkers(p => p.map(w => w.id === id ? { ...w, paid: Number(w.paid) + num } : w));
    setSalaryPayments(p => [...p, {
      id: ts, createdAt: ts, workerId: id, amount: num,
      date: today, note, paidBy: currentWorker, channel,
    }]);
    // ── INTEGRATSIYA: xodim oyligi → tegishli kassadan chiqim ───────────────
    if (num > 0) {
      const tag  = `🔗 Oylik: ${workerObj?.name || ''}`;
      const link = { auto: true, sourceType: 'salary', sourceId: `${id}_s${ts}`, createdAt: ts, worker: currentWorker, date: today };
      if      (channel === 'naqd')  setCashRows(p  => [...p, { ...link, id: uid(), amount: -num, desc: tag }]);
      else if (channel === 'bank')  setBankRows(p  => [...p, { ...link, id: uid(), amount: -num, desc: tag }]);
      else if (channel === 'click') setClickRows(p => [...p, { ...link, id: uid(), amount: -num, desc: tag }]);
    }
    // MUVAFFAQIYAT natijasi QAYTARILISHI shart: chaqiruvchi
    // (WorkerSalary → handlePay) `if (!payWorker(...)) return;` deb tekshiradi.
    // Qaytarilmaganda undefined kelib, to'lov o'tgan bo'lsa ham forma
    // yopilmasdi va xodim to'lov o'tmadi deb qayta bosardi.
    return true;
  };

  // Oylik to'lovini bekor qilish. guardAutoDelete kassa yozuvini o'chirmoqchi
  // bo'lgan foydalanuvchini SHU yerga yo'naltiradi — ilgari bunday funksiya
  // umuman yo'q edi, ya'ni xato kiritilgan oylikni orqaga qaytarib bo'lmasdi.
  const deleteSalaryPayment = (paymentId) => {
    const pay = salaryPayments.find(p => p.id === paymentId);
    if (!pay) return;
    setSalaryPayments(p => p.filter(x => x.id !== paymentId));
    setWorkers(p => p.map(w => w.id === pay.workerId
      ? { ...w, paid: Math.max(0, Number(w.paid || 0) - Number(pay.amount || 0)) }
      : w));
    // To'lovdan yaratilgan kassa chiqimini ham qaytaramiz
    const sid = `${pay.workerId}_s${pay.id}`;
    const rm = (rows) => rows.filter(r => !(r.auto && r.sourceType === 'salary' && r.sourceId === sid));
    setCashRows(rm); setBankRows(rm); setClickRows(rm);
  };

  const updateWorker = (id, data) => setWorkers(p => p.map(w => w.id === id ? { ...w, ...data } : w));
  const deleteWorker = (id) => {
    // Xodim o'chsa, uning oylik to'lovlaridan yaratilgan kassa chiqimlari
    // ilgari kassada "egasiz" qolib ketardi — shuning uchun ular ham o'chadi.
    // LEKIN bu kassa qoldig'ini OSHIRADI: pul haqiqatan berilgan, uni
    // o'chirish qoldiqni yolg'on ko'tarib yuboradi. Shuning uchun to'lov
    // tarixi bo'lsa, nima bo'lishini aniq aytib tasdiq so'raymiz (ilgari
    // hech qanday ogohlantirish yo'q edi).
    const myPays = salaryPayments.filter(x => x.workerId === id);
    const paidSum = myPays.reduce((s, p) => s + Number(p.amount || 0), 0);
    if (paidSum > 0) {
      const w = workers.find(x => x.id === id);
      if (!window.confirm(
        `"${w?.name || 'Xodim'}" ga ${myPays.length} ta to'lov qilingan — jami ` +
        `${paidSum.toLocaleString('ru-RU')} so'm.\n\n` +
        `O'chirilsa bu to'lovlar va ular yaratgan kassa chiqimlari ham o'chadi, ` +
        `ya'ni kassa qoldig'i ${paidSum.toLocaleString('ru-RU')} so'mga OSHADI ` +
        `(garchi pul haqiqatan berilgan bo'lsa ham).\n\n` +
        `Ishdan bo'shagan xodimni o'chirmasdan qoldirish to'g'riroq.\n\nBaribir o'chirilsinmi?`
      )) return false;
    }
    const sids = new Set(myPays.map(x => `${id}_s${x.id}`));
    setWorkers(p => p.filter(w => w.id !== id));
    setSalaryPayments(p => p.filter(x => x.workerId !== id));
    const rm = (rows) => rows.filter(r => !(r.auto && r.sourceType === 'salary' && sids.has(r.sourceId)));
    setCashRows(rm); setBankRows(rm); setClickRows(rm);
    return true;
  };

  // ── 17. Telegram zakaz ────────────────────────────────────────────────────
  const [tgOrders, setTgOrders] = useState(() => load('tg_orders', []));
  useEffect(() => save('tg_orders', tgOrders), [tgOrders]);

  const addTgOrder = (customer, tons, note = '', worker = currentWorker) => {
    const t = parseNum(tons);
    if (!(t > 0)) { alert("Zakaz tonnasi 0 dan katta bo'lishi kerak."); return false; }
    const ts = uid();
    setTgOrders(p => [...p, { id: ts, createdAt: ts, worker: worker || currentWorker, date: new Date().toLocaleDateString('ru-RU'), ...custFields(customers, customer), tons: t, status: 'kutilmoqda', note }]);
    return true;
  };
  const setTgStatus   = (id, status) => setTgOrders(p => p.map(o => o.id === id ? { ...o, status } : o));
  const deleteTgOrder = (id) => setTgOrders(p => p.filter(o => o.id !== id));
  const totalTgTons   = tgOrders.reduce((s, o) => s + Number(o.tons), 0);

  // ── 6. Kunlik ish ─────────────────────────────────────────────────────────
  const [dailyWorkRows, setDailyWorkRows] = useState(() => load('daily_work_rows', []));
  useEffect(() => save('daily_work_rows', dailyWorkRows), [dailyWorkRows]);
  const addDailyWorkRow = (entry) => {
    const ts = uid();
    setDailyWorkRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date: new Date().toLocaleDateString('ru-RU'), ...entry }]);
  };
  const deleteDailyWorkRow = (id) => setDailyWorkRows(p => p.filter(r => r.id !== id));

  // ── Mijozlar bazasi ───────────────────────────────────────────────────────
  const [customers, setCustomers] = useState(() => load('customers', []));
  useEffect(() => save('customers', customers), [customers]);
  const genLinkCode = () => Math.random().toString(36).slice(2, 10).toUpperCase();
  // Ism → mijoz obyekti (bazada bo'lsa). Shu obyekt bilan qidirilganda yozuvlar
  // avval customerId, keyin ism bo'yicha topiladi — ya'ni ismi qo'lda o'zgartirib
  // yuborilgan eski yozuv ham mijozdan uzilib qolmaydi.
  const custRef = (name) => findCust(customers, name) || name;
  // Takroriy nom BLOKLANADI. updateCustomer'da bu tekshiruv bor edi, qo'shishda
  // esa yo'q — natijada bir xil nomli ikki mijoz paydo bo'lishi mumkin edi va
  // nom bo'yicha bog'lanadigan eski yozuvlar (customerId'siz) qaysi biriga
  // tegishli ekani noaniq bo'lib qolardi. Mavjud bo'lsa, o'shani qaytaramiz —
  // chaqiruvchi (CustomerSelect) uni tanlab davom etaveradi.
  const addCustomer = ({ name, address = '', phone = '', note = '' }) => {
    const nm = String(name || '').trim();
    if (!nm) return null;
    const exists = findCust(customers, nm);
    if (exists) return exists;
    const ts = uid();
    const row = {
      id: ts, createdAt: ts, worker: currentWorker,
      name: nm, address: String(address || '').trim(), phone: String(phone || '').trim(), note,
      linkCode: genLinkCode(),
    };
    setCustomers(p => [...p, row]);
    return row;
  };
  // Yozuvlar mijozga customerId bilan bog'lanadi, lekin ism ham har yozuvda
  // saqlanadi (ro'yxatlarda shu ko'rsatiladi, eski yozuvlarda esa bog'lanishning
  // o'zi shu). Shuning uchun ism o'zgarganda hamma joyda birga yangilanadi.
  const updateCustomer = (id, data) => {
    const old = customers.find(c => c.id === id);
    const newName = String(data?.name || '').trim();
    const oldName = String(old?.name || '').trim();
    const renamed = old && newName && newName !== oldName;

    if (renamed) {
      const clash = customers.some(c => c.id !== id && sameCust(c.name, newName));
      if (clash) {
        alert(`"${newName}" nomli mijoz allaqachon bor.\nBoshqa nom tanlang yoki eski yozuvni o'chiring.`);
        return false;
      }
      // Nomi bo'yicha ham, id'si bo'yicha ham tegishli qatorlar yangilanadi:
      // id'si borlarida ism allaqachon farq qilib ketgan bo'lishi mumkin.
      const swap = (rows) => rows.map(r =>
        (r.customerId != null ? r.customerId === id : sameCust(r.customer, oldName))
          ? { ...r, customer: newName } : r);
      setSalesRows(swap); setSoldRows(swap); setDebtRows(swap);
      setAdvanceRows(swap); setSkladRows(swap);
      setCashRows(swap); setBankRows(swap); setClickRows(swap);
      setBankIncomeRows(swap); setBankExpenseRows(swap);
      setTgOrders(swap);
    }
    setCustomers(p => p.map(c => c.id === id ? { ...c, ...data } : c));
    return true;
  };

  const deleteCustomer = (id) => {
    const c = customers.find(x => x.id === id);
    if (c) {
      // Qarzi yoki avansi bor mijozni o'chirish — o'sha summa ro'yxatdan
      // yo'qolib, hech kim uni ko'rmay qolishiga olib keladi.
      const debt = custRows(debtRows, c)
        .reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.paid)), 0);
      const adv = custRows(advanceRows, c)
        .reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.used)), 0);
      if (debt > 0 || adv > 0) {
        const parts = [];
        if (debt > 0) parts.push(`qarzi: ${debt.toLocaleString('ru-RU')} so'm`);
        if (adv  > 0) parts.push(`avansi: ${adv.toLocaleString('ru-RU')} so'm`);
        alert(
          `"${c.name}" ni o'chirib bo'lmaydi — ${parts.join(', ')}.\n\n` +
          `Avval hisob-kitobni yopib, keyin o'chiring.`
        );
        return false;
      }

      // Hisob-kitobi yopilgan, lekin TARIXI bor mijoz. Uni o'chirsak sotuv va
      // to'lov yozuvlari bazada qoladi-yu, hech qaysi mijozga tegishli
      // bo'lmaydi: kartochka ochilmaydi, hisobotlarda "egasiz" ko'rinadi.
      // Bloklamaymiz (tarixni o'chirish noto'g'ri bo'lardi), lekin nima
      // bo'lishini aytamiz — ilgari hech qanday ogohlantirish yo'q edi.
      const salesCnt = custRows(salesRows, c).length + custRows(soldRows, c).length;
      const debtCnt  = custRows(debtRows, c).length;
      const advCnt   = custRows(advanceRows, c).length;
      const histCnt  = salesCnt + debtCnt + advCnt;
      if (histCnt > 0 && !window.confirm(
        `"${c.name}" da ${histCnt} ta tarix yozuvi bor` +
        (salesCnt ? `\n · sotuv: ${salesCnt} ta` : '') +
        (debtCnt  ? `\n · qarz (yopilgan): ${debtCnt} ta` : '') +
        (advCnt   ? `\n · avans (sarflangan): ${advCnt} ta` : '') +
        `\n\nMijoz o'chirilsa bu yozuvlar bazada qoladi, lekin ularni mijoz\n` +
        `kartochkasidan ko'rib bo'lmaydi (hisobotlarda "egasiz" ko'rinadi).\n\n` +
        `Baribir o'chirilsinmi?`
      )) return false;
    }
    setCustomers(p => p.filter(x => x.id !== id));
    return true;
  };
  // Mijozni nazoratga olish / olib tashlash (ixtiyoriy alohida muddat bilan)
  const setMonitor = (id, monitored, monitorDays = null) =>
    setCustomers(p => p.map(c => c.id === id ? { ...c, monitored, monitorDays: monitorDays || null } : c));
  // Excel'dan ko'plab mijoz import qilish (unikal id bilan)
  // Import DUBLIKAT YARATMAYDI. Ilgari hech qanday tekshiruv yo'q edi: bir
  // faylni ikki marta yuklash (yoki qisman to'ldirilgan ro'yxatni qayta
  // yuklash) butun bazani ikkilantirardi, keyin nom bo'yicha bog'lanish
  // buzilib, qarz/avans qaysi nusxaga tegishli ekani noaniq bo'lardi.
  // Fayl ichidagi takrorlar ham bir marta olinadi.
  const importCustomers = (rows) => {
    const seen = new Set(customers.map(c => custKey(c.name)));
    const fresh = [];
    let skipped = 0;
    for (const r of (rows || [])) {
      const nm = String(r?.name || '').trim();
      if (!nm) { skipped++; continue; }
      const k = custKey(nm);
      if (seen.has(k)) { skipped++; continue; }
      seen.add(k);
      const id = uid();
      fresh.push({
        id, createdAt: id, worker: currentWorker,
        name: nm, address: String(r.address || '').trim(),
        phone: String(r.phone || '').trim(), note: r.note || '',
        linkCode: genLinkCode(),
      });
    }
    if (fresh.length) setCustomers(p => [...p, ...fresh]);
    return { added: fresh.length, skipped };
  };

  // ── 18. Haydovchilar va Qatnovlar ─────────────────────────────────────────
  const DEFAULT_TARIFFS = [
    { id: 1, name: 'Tarif 1', prices: [50000, 100000, 150000, 200000, 250000] },
    { id: 2, name: 'Tarif 2', prices: [200000, 250000, 400000, 450000, 500000, 550000] },
  ];
  const [drivers, setDrivers]           = useState(() => load('drivers', []));
  const [driverTrips, setDriverTrips]   = useState(() => load('driver_trips', []));
  const [driverTariffs, setDriverTariffs] = useState(() => load('driver_tariffs', DEFAULT_TARIFFS));
  const [tickets, setTickets]             = useState(() => load('tickets', []));
  useEffect(() => save('drivers', drivers), [drivers]);
  useEffect(() => save('driver_trips', driverTrips), [driverTrips]);
  useEffect(() => save('driver_tariffs', driverTariffs), [driverTariffs]);
  useEffect(() => save('tickets', tickets), [tickets]);

  // ── Tiketlar (zayavka uchun) ────────────────────────────────────────────────
  const addTicket = (number, marka, totalTonna) => {
    // Tiket qoldig'i bot orqali sarflanadi (zayavka). Nol/manfiy tonnali
    // tiket ochilsa, qoldiq boshidanoq manfiy ko'rinardi.
    const t = parseNum(totalTonna);
    if (!(t > 0)) { alert("Tiket tonnasi 0 dan katta bo'lishi kerak."); return false; }
    const id = 'tk_' + uid();
    setTickets(p => [...p, {
      id, number: String(number).trim(), marka: String(marka).trim(),
      totalTonna: t,
      usedTonna: 0, status: 'open', createdAt: Date.now(),
    }]);
    return true;
  };
  const closeTicket  = (id) => setTickets(p => p.map(t => t.id === id ? { ...t, status: 'closed', closedAt: Date.now() } : t));
  const reopenTicket = (id) => setTickets(p => p.map(t => t.id === id ? { ...t, status: 'open', closedAt: null } : t));
  const deleteTicket = (id) => setTickets(p => p.filter(t => t.id !== id));
  // Bot usedTonna ni to'g'ridan-to'g'ri state ga yozadi (db.useTicketTonna).
  // Frontend keyingi sync da yangi qiymatni oladi.

  const addDriverTariff    = (name) => setDriverTariffs(p => [...p, { id: uid(), name: name.trim(), prices: [] }]);
  // Tarif o'chsa, unga biriktirilgan haydovchilarda "egasiz" tariffId qolib,
  // reys narxi ro'yxati bo'shab qolardi. Shuning uchun biriktirishni uzamiz.
  const removeDriverTariff = (id) => {
    const bound = drivers.filter(d => d.tariffId === id);
    if (bound.length && !window.confirm(
      `Bu tarif ${bound.length} ta haydovchiga biriktirilgan:\n${bound.map(d => `· ${d.name}`).join('\n')}\n\n` +
      `O'chirilsa ular tarifsiz qoladi. Davom etamizmi?`
    )) return false;
    setDriverTariffs(p => p.filter(t => t.id !== id));
    setDrivers(p => p.map(d => d.tariffId === id ? { ...d, tariffId: null } : d));
    return true;
  };
  const renameDriverTariff = (id, name) => setDriverTariffs(p => p.map(t => t.id === id ? { ...t, name } : t));
  const addPriceToTariff   = (id, price) => setDriverTariffs(p => p.map(t => {
    if (t.id !== id) return t;
    const n = Number(price);
    if (!n || t.prices.includes(n)) return t;
    return { ...t, prices: [...t.prices, n].sort((a, b) => a - b) };
  }));
  const removePriceFromTariff = (id, price) => setDriverTariffs(p => p.map(t =>
    t.id === id ? { ...t, prices: t.prices.filter(pr => pr !== price) } : t
  ));

  const addDriver = (name, carNumber, phone = '', tariffId = null) => {
    const ts = uid();
    setDrivers(p => [...p, { id: ts, name, carNumber, phone, tariffId }]);
  };
  // Haydovchi balansi kassa yozuvlaridagi ism bo'yicha ham yig'iladi
  // (Kassirdan qo'lda berilgan avanslar). Nom o'zgarsa — o'sha to'lovlar
  // haydovchidan uzilib, unga qayta to'lab yuborish xavfi tug'ilardi.
  const updateDriver = (id, data) => {
    const old = drivers.find(d => d.id === id);
    const newName = String(data?.name || '').trim();
    const oldName = String(old?.name || '').trim();
    if (old && newName && newName !== oldName) {
      const swap = (rows) => rows.map(r => sameCust(r.customer, oldName) ? { ...r, customer: newName } : r);
      setCashRows(swap); setBankRows(swap); setClickRows(swap);
    }
    setDrivers(p => p.map(d => d.id === id ? { ...d, ...data } : d));
    return true;
  };
  const deleteDriver = (id) => {
    const tripIds = new Set(driverTrips.filter(t => t.driverId === id).map(t => t.id));
    setDrivers(p => p.filter(d => d.id !== id));
    setDriverTrips(p => p.filter(t => t.driverId !== id)); // haydovchi o'chsa qatnovlari ham o'chadi
    // Shu haydovchining to'lovlaridan yaratilgan kassa chiqimlarini ham o'chirish
    const rm = (rows) => rows.filter(r => !(r.auto && r.sourceType === 'driver' && tripIds.has(r.sourceId)));
    setCashRows(rm); setBankRows(rm); setClickRows(rm);
  };

  const addDriverTrip = (driverId, destination, price, isPayment = false, note = '', channel = 'naqd') => {
    const amt = parseNum(price);
    // Manfiy summa haydovchi balansini teskari yo'nalishda o'zgartirardi:
    // "to'lov" balansni oshirib, "reys" kamaytirib yuborardi.
    if (!(amt > 0)) { alert("Summa 0 dan katta bo'lishi kerak."); return false; }
    const ts = uid();
    const today = new Date().toLocaleDateString('ru-RU');
    const newTrip = {
      id: ts, createdAt: ts, driverId, date: today,
      destination, price: amt, isPayment, note,
      channel: isPayment ? channel : undefined,
    };
    setDriverTrips(p => [...p, newTrip]);
    {
      // Haydovchiga bot xabari (avans berilib yoki qo'shimcha reys qo'shilsa).
      // MUHIM: bu blok setDriverTrips UPDATERI ICHIDA turardi. React
      // StrictMode updaterni ataylab IKKI MARTA chaqiradi (sof funksiya
      // ekanini tekshirish uchun) — natijada haydovchiga har amalda ikkita
      // bir xil xabar ketardi. Yon ta'sir updater ichida bo'lmasligi kerak.
      const updated = [...driverTrips, newTrip];
      const drv = drivers.find(d => d.id === driverId);
      if (drv?.telegramChatId) {
        const earned = updated.filter(t => t.driverId === driverId && !t.isPayment).reduce((s, t) => s + Number(t.price || 0), 0);
        const paid   = updated.filter(t => t.driverId === driverId &&  t.isPayment).reduce((s, t) => s + Number(t.price || 0), 0);
        const balance = earned - paid;
        const balText = balance > 0
          ? `💰 Sizga *${balance.toLocaleString('ru-RU').replace(/,/g,' ')} so'm* to'lanishi kerak`
          : balance < 0
            ? `⚠️ Avans qarzingiz: *${Math.abs(balance).toLocaleString('ru-RU').replace(/,/g,' ')} so'm*`
            : `✅ Hisob-kitob muvozanatli`;
        const msg = isPayment
          ? `💸 *Avans oldingiz!*\n\nSumma: *${amt.toLocaleString('ru-RU').replace(/,/g,' ')} so'm*\n\n${balText}`
          : `🚛 *Reys qo'shildi!*\n\n📍 ${destination}\n💰 *${amt.toLocaleString('ru-RU').replace(/,/g,' ')} so'm*\n\n${balText}`;
        import('../api').then(({ api }) => {
          api.notify({ chatId: drv.telegramChatId, text: msg, channels: ['telegram'] }).catch(() => {});
        });
      }
    }
    // ── INTEGRATSIYA: haydovchiga to'lov → tegishli kassadan chiqim ─────────
    if (isPayment && amt > 0) {
      const drv = drivers.find(d => d.id === driverId);
      const tag  = `🔗 Haydovchi to'lovi: ${drv?.name || ''}`;
      const link = { auto: true, sourceType: 'driver', sourceId: ts, createdAt: ts, worker: currentWorker, date: today };
      if      (channel === 'naqd')  setCashRows(p  => [...p, { ...link, id: uid(), amount: -amt, desc: tag }]);
      else if (channel === 'bank')  setBankRows(p  => [...p, { ...link, id: uid(), amount: -amt, desc: tag }]);
      else if (channel === 'click') setClickRows(p => [...p, { ...link, id: uid(), amount: -amt, desc: tag }]);
    }
    return true;
  };
  const deleteDriverTrip = (id) => {
    setDriverTrips(p => p.filter(t => t.id !== id));
    const rm = (rows) => rows.filter(r => !(r.auto && r.sourceType === 'driver' && r.sourceId === id));
    setCashRows(rm); setBankRows(rm); setClickRows(rm);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // BACKEND SINXRONIZATSIYASI
  // ═══════════════════════════════════════════════════════════════════════════
  const [backendOnline, setBackendOnline] = useState(true);
  const hydratedRef = useRef(false); // backenddan yuklanmaguncha saqlamaymiz
  // hydratedRef ning render uchun ko'rinadigan nusxasi. UI shu bo'yicha kirish
  // formalarini bloklaydi: yuklab bo'lmagan holatda kiritilgan yozuv keyingi
  // muvaffaqiyatli yuklashda serverdagi holat bilan ustidan yozilib, JIMGINA
  // yo'qolardi (foydalanuvchi "Server o'chiq" belgisini ko'rsa ham ishlayverardi).
  const [hydratedState, setHydratedState] = useState(false);
  // Token yo'q bo'lsa baribir "yuklanmagan" — buni shu yerda hisoblaymiz,
  // effekt ichida setState qilmaslik uchun (chiqishda ortiqcha render bermasin).
  const hydrated = hydratedState && !!token;
  const markHydrated = (v) => { hydratedRef.current = v; setHydratedState(v); };
  const baseVersionRef = useRef(0);  // oxirgi ko'rilgan server versiyasi (to'qnashuv nazorati)
  const [retryTick, setRetryTick] = useState(0);
  const saveTimer   = useRef(null);
  const retryTimer  = useRef(null);
  // ── O'chirilgan yozuvlarni qayd qilish (tombstone) ───────────────────────
  // Server to'qnashuvda holatlarni birlashtiradi: clientda yo'q, serverda bor
  // qator saqlanib qoladi. O'chirish esa aynan shunday ko'rinadi — natijada
  // o'chirilgan yozuv boshqa xodimning eski nusxasi orqali QAYTA TIRILARDI.
  // Shuning uchun har saqlashdan oldin oldingi holat bilan solishtirib,
  // yo'qolgan id larni ro'yxatga olamiz va PUT bilan yuboramiz.
  // Solishtirish usuli tanlangan: o'nlab o'chirish joyining har birini qo'lda
  // belgilash kerak bo'lmaydi va yangi kod yozilganda ham o'zi ishlaydi.
  const prevIdsRef  = useRef(null);   // { [key]: Set<id> }
  const tombsRef    = useRef([]);     // [{ key, id, at }] — yuborilishi kutilayotgan
  const [saveRetry, setSaveRetry] = useState(0);
  // Serverga hali yozilmagan o'zgarish bormi (debounce kutayotgan yoki yuborilayotgan)
  const [dirty, setDirty] = useState(false);

  // ── Bildirishnoma (Telegram/SMS) holati ──────────────────────────────────
  const [tgContacts, setTgContacts] = useState([]);
  const [notifyMeta, setNotifyMeta] = useState({ botRunning: false, smsConfigured: false });
  const refreshTgContacts = async () => {
    try {
      const r = await api.getTgContacts();
      setTgContacts(r.contacts || []);
      setNotifyMeta({ botRunning: !!r.botRunning, smsConfigured: !!r.smsConfigured });
    } catch { /* backend o'chiq bo'lishi mumkin */ }
  };
  // Telefon (oxirgi 9 raqam) bo'yicha ulangan chatId topish
  const tgChatIdFor = (phone) => {
    const np = String(phone || '').replace(/\D/g, '').slice(-9);
    if (!np) return null;
    const c = tgContacts.find(x => String(x.phone || '').replace(/\D/g, '').slice(-9) === np);
    return c ? c.chatId : null;
  };
  // Telefon bo'yicha bot orqali yuborilgan joylashuv ({lat, lon}) topish
  const tgLocationFor = (phone) => {
    const np = String(phone || '').replace(/\D/g, '').slice(-9);
    if (!np) return null;
    const c = tgContacts.find(x => String(x.phone || '').replace(/\D/g, '').slice(-9) === np && x.lat != null && x.lon != null);
    return c ? { lat: c.lat, lon: c.lon } : null;
  };

  // Serverga sinxronlanadigan barcha bo'limlar (sessiya — currentUser — bunda yo'q)
  const STATE_SETTERS = {
    app_settings:       setAppSettings,
    warehouses:         setWarehouses,
    cash_opening:       setCashOpening,
    cash_rows:          setCashRows,
    bank_opening:       setBankOpening,
    bank_rows:          setBankRows,
    click_opening:      setClickOpening,
    click_rows:         setClickRows,
    cement_opening:     setCementOpening,
    income_rows:        setIncomeRows,
    expense_rows:       setExpenseRows,
    sold_rows:          setSoldRows,
    recv_rows:          setRecvRows,
    debt_rows:          setDebtRows,
    advance_rows:       setAdvanceRows,
    sales_rows:         setSalesRows,
    suppliers:          setSuppliers,
    supplier_payments:  setSupplierPayments,
    bank_income_rows:   setBankIncomeRows,
    bank_expense_rows:  setBankExpenseRows,
    bank_pending_rows:  setBankPendingRows,
    click_income_rows:  setClickIncomeRows,
    click_expense_rows: setClickExpenseRows,
    workers:            setWorkers,
    salary_payments:    setSalaryPayments,
    tg_orders:          setTgOrders,
    daily_work_rows:    setDailyWorkRows,
    customers:          setCustomers,
    drivers:            setDrivers,
    driver_trips:       setDriverTrips,
    driver_tariffs:     setDriverTariffs,
    sklad_rows:         setSkladRows,
    cement_types:       setCementTypes,
    tickets:            setTickets,
  };

  // Holatning joriy "suratini" yig'ish (serverga shu jo'natiladi)
  const snapshot = {
    app_settings:       appSettings,
    warehouses:         warehouses,
    cash_opening:       cashOpening,
    cash_rows:          cashRows,
    bank_opening:       bankOpening,
    bank_rows:          bankRows,
    click_opening:      clickOpening,
    click_rows:         clickRows,
    cement_opening:     cementOpening,
    income_rows:        incomeRows,
    expense_rows:       expenseRows,
    sold_rows:          soldRows,
    recv_rows:          recvRows,
    debt_rows:          debtRows,
    advance_rows:       advanceRows,
    sales_rows:         salesRows,
    suppliers:          suppliers,
    supplier_payments:  supplierPayments,
    bank_income_rows:   bankIncomeRows,
    bank_expense_rows:  bankExpenseRows,
    bank_pending_rows:  bankPendingRows,
    click_income_rows:  clickIncomeRows,
    click_expense_rows: clickExpenseRows,
    workers:            workers,
    salary_payments:    salaryPayments,
    tg_orders:          tgOrders,
    daily_work_rows:    dailyWorkRows,
    customers:          customers,
    drivers:            drivers,
    driver_trips:       driverTrips,
    driver_tariffs:     driverTariffs,
    sklad_rows:         skladRows,
    cement_types:       cementTypes,
    tickets:            tickets,
  };

  // Holatdagi har bir qatorli bo'lim uchun id to'plami
  const idMapOf = (state) => {
    const out = {};
    for (const [key, val] of Object.entries(state)) {
      if (Array.isArray(val) && val.every(x => x && typeof x === 'object' && x.id !== undefined)) {
        out[key] = new Set(val.map(x => x.id));
      }
    }
    return out;
  };

  // Oldingi holat bilan solishtirib, yo'qolgan (o'chirilgan) id larni yig'ish.
  // Natija tombsRef ga to'planadi va keyingi PUT bilan yuboriladi.
  const collectTombstones = (state) => {
    const now  = idMapOf(state);
    const prev = prevIdsRef.current;
    prevIdsRef.current = now;
    if (!prev) return;                       // birinchi marta — solishtiruv yo'q
    const at = Date.now();
    for (const [key, prevSet] of Object.entries(prev)) {
      const nowSet = now[key];
      if (!nowSet) continue;                 // bo'lim umuman yo'q — o'chirish deb hisoblamaymiz
      for (const id of prevSet) {
        if (!nowSet.has(id)) tombsRef.current.push({ key, id, at });
      }
    }
    // Ro'yxat cheksiz o'smasin (server ham 30 kundan eskisini tashlaydi)
    if (tombsRef.current.length > 2000) tombsRef.current = tombsRef.current.slice(-2000);
  };

  // 1) Tizimga kirilgach (token bor) — serverdan butun holatni yuklab olish
  useEffect(() => {
    if (!token) { hydratedRef.current = false; return; }
    let cancelled = false;
    (async () => {
      try {
        const remote = await api.getState();
        if (!cancelled && remote && typeof remote === 'object' && Object.keys(remote).length) {
          // Eskidan qolgan customers/workers uchun linkCode avtomatik berish
          const lc = () => Math.random().toString(36).slice(2, 10).toUpperCase();
          if (Array.isArray(remote.customers))
            remote.customers = remote.customers.map(c => c.linkCode ? c : { ...c, linkCode: lc() });
          if (Array.isArray(remote.workers))
            remote.workers = remote.workers.map(w => w.linkCode ? w : { ...w, linkCode: lc() });
          for (const [key, setter] of Object.entries(STATE_SETTERS)) {
            if (remote[key] !== undefined) setter(remote[key]);
          }
          baseVersionRef.current = remote.__updatedAt || 0;
          // Serverdan kelgan holat — o'chirishlarni solishtirish uchun boshlang'ich
          prevIdsRef.current = idMapOf(remote);
          tombsRef.current = [];
        }
        if (!cancelled) {
          setBackendOnline(true);
          // FAQAT muvaffaqiyatli yuklashdan keyin saqlashga ruxsat beramiz.
          setTimeout(() => { markHydrated(true); }, 0);
        }
      } catch (err) {
        // MUHIM: yuklash muvaffaqiyatsiz bo'lsa hydratedRef OCHILMAYDI.
        // Ilgari u `finally` da baribir true bo'lardi — natijada internet bir
        // lahzaga uzilsa, brauzerdagi ESKI lokal nusxa serverdagi TO'G'RI
        // ma'lumot ustiga yozilib, ishlangan kun butunlay yo'qolishi mumkin edi.
        console.warn("Backend bilan ulanib bo'lmadi — faqat o'qish rejimi:", err.message);
        if (!cancelled) setBackendOnline(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // 1b) Backend qayta ishga tushsa — avtomatik qayta urinish.
  // Yuklash muvaffaqiyatsiz bo'lgani uchun saqlash to'xtatilgan bo'lsa,
  // foydalanuvchi sahifani qayta yuklamasdan tiklanishi kerak.
  useEffect(() => {
    if (!token || backendOnline || hydratedRef.current) return;
    const t = setInterval(() => { setRetryTick(x => x + 1); }, 15000);
    return () => clearInterval(t);
  }, [token, backendOnline]);
  useEffect(() => {
    if (!retryTick || !token || hydratedRef.current) return;
    (async () => {
      try {
        const remote = await api.getState();
        if (remote && typeof remote === 'object' && Object.keys(remote).length) {
          for (const [key, setter] of Object.entries(STATE_SETTERS)) {
            if (remote[key] !== undefined) setter(remote[key]);
          }
          baseVersionRef.current = remote.__updatedAt || 0;
          prevIdsRef.current = idMapOf(remote);
          tombsRef.current = [];
        }
        setBackendOnline(true);
        setTimeout(() => { markHydrated(true); }, 0);
      } catch { /* keyingi urinishda */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryTick]);

  // 2) Har bir o'zgarishdan keyin — butun holatni serverga saqlash (debounce 800ms)
  useEffect(() => {
    if (!hydratedRef.current || !token) return;
    // "Saqlanmoqda…" ko'rsatkichi va sahifadan chiqish ogohlantirishi uchun.
    // Bu qasddan effekt ichida: belgi aynan holat o'zgarganda yonishi kerak.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      // Oldingi holat bilan solishtirib, o'chirilganlarni aniqlaymiz — server
      // birlashtirishda ularni qayta tiriltirmasligi uchun.
      collectTombstones(snapshot);
      // NUSXA olinadi: tombsRef.current ning o'ziga ishora qilinsa, so'rov
      // ketayotganda yangi o'chirish qo'shilishi bilan uzunlik ham o'zgarib,
      // quyidagi tozalash hali yuborilmagan yozuvni ham o'chirib yuborardi.
      const sentTombs = tombsRef.current.slice();
      const sentCount = sentTombs.length;
      // Server bilan to'qnashuvni aniqlash uchun ko'rgan versiyamizni yuboramiz
      api.saveState({
        ...snapshot,
        __baseVersion: baseVersionRef.current,
        ...(sentTombs.length ? { __deleted: sentTombs } : {}),
      })
        .then(async (r) => {
          setBackendOnline(true);
          setDirty(false);
          // Yuborilganlari serverda saqlandi — mahalliy navbatni tozalaymiz
          tombsRef.current = tombsRef.current.slice(sentCount);
          baseVersionRef.current = r?.updatedAt || 0;
          // Boshqa xodim bilan to'qnashuv birlashtirildi — uning yozuvlarini
          // biz ham ko'rishimiz uchun serverdan yangi holatni olamiz.
          if (r?.merged) {
            try {
              const remote = await api.getState();
              if (remote && typeof remote === 'object') {
                for (const [key, setter] of Object.entries(STATE_SETTERS)) {
                  if (remote[key] !== undefined) setter(remote[key]);
                }
                baseVersionRef.current = remote.__updatedAt || baseVersionRef.current;
                // Birlashtirilgan holat yangi asos bo'ladi: aks holda serverdan
                // kelgan (boshqa xodim qo'shgan) qatorlar keyingi solishtirishda
                // "o'chirilgan" deb qaralib, tombstone'ga tushib qolardi.
                prevIdsRef.current = idMapOf(remote);
              }
            } catch { /* keyingi saqlashda */ }
          }
        })
        .catch(() => {
          setBackendOnline(false);
          // Saqlash muvaffaqiyatsiz — 5 soniyadan keyin QAYTA urinamiz.
          // Ilgari urinish shu yerda tugardi: keyingi o'zgarish bo'lmasa (xodim
          // oxirgi yozuvni kiritib turib qolsa) o'sha yozuv hech qachon
          // serverga bormasdi va faqat brauzerda qolib ketardi.
          if (retryTimer.current) clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(() => setSaveRetry(x => x + 1), 5000);
        });
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    saveRetry,
    appSettings, cashOpening, cashRows, bankOpening, bankRows, clickOpening, clickRows,
    cementOpening, incomeRows, expenseRows, soldRows, recvRows, debtRows, advanceRows,
    salesRows, suppliers, supplierPayments, bankIncomeRows, bankExpenseRows, bankPendingRows, clickIncomeRows, clickExpenseRows,
    workers, salaryPayments, tgOrders, dailyWorkRows, customers, drivers, driverTrips, skladRows,
    tickets,
    // Bular snapshot'ga kiradi, lekin ilgari bu ro'yxatda yo'q edi — ya'ni sklad
    // qo'shish, sement turi qo'shish yoki tarif o'zgartirish serverga SAQLANMASDAN
    // qolib, boshqa qurilmada ochilganda yo'qolib ketardi.
    warehouses, driverTariffs, cementTypes,
  ]);

  // 2b) Saqlanmagan o'zgarish bilan sahifani yopishdan ogohlantirish.
  // Saqlash 800ms kechikish bilan ketadi va tarmoq sekin bo'lsa bir necha
  // soniya davom etadi — shu oraliqda tab yopilsa yozuv yo'qolardi.
  useEffect(() => {
    if (!dirty || !token) return;
    const onLeave = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty, token]);

  // Timerlarni tozalash (komponent yo'q qilinganda osilib qolmasin)
  useEffect(() => () => {
    if (saveTimer.current)  clearTimeout(saveTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, []);

  // 3) Telegram botiga tushgan yangi zakazlarni backend navbatidan o'qib olish
  useEffect(() => {
    if (!token) return;
    const poll = async () => {
      try {
        const orders = await api.getBotOrders();
        if (orders && orders.length) {
          let added = false;
          setTgOrders(prev => {
            const existing = new Set(prev.map(o => o.id));
            const fresh = orders.filter(o => !existing.has(o.id));
            if (!fresh.length) return prev;
            added = true;
            return [...prev, ...fresh];
          });
          if (added) beep();
          await api.clearBotOrders();
        }
      } catch { /* backend o'chiq bo'lishi mumkin — keyingi urinishda */ }
    };
    poll();
    const interval = setInterval(poll, 5000); // har 5 soniyada
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // 4) Telegram kontaktlari (ulangan raqamlar) — kirilganda + har 30s
  useEffect(() => {
    if (!token) return;
    refreshTgContacts();
    const id = setInterval(refreshTgContacts, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ─────────────────────────────────────────────────────────────────────────
  const value = {
    // Auth & Settings
    currentUser, token, login, signup, logout, currentWorker, setCurrentWorker,
    appSettings, updateAppSettings,
    backendOnline, hydrated, dirty,
    // Butun holat nusxasi — avtomatik arxiv JSON faylini yasashda ishlatiladi
    // (o'sha fayldan baza to'liq tiklanadi: Sozlamalar → Zaxira → Tiklash).
    snapshot,
    // Bildirishnoma (Telegram/SMS)
    tgContacts, notifyMeta, refreshTgContacts, tgChatIdFor, tgLocationFor,
    // 2. Naqd pul
    cashOpening, setCashOpening, cashRows, totalCashBalance, addCashRow, deleteCashRow, updateCashRow,
    // 3. Bank
    bankOpening, setBankOpening, bankRows, totalBankBalance, addBankRow, deleteBankRow, updateBankRow,
    // 4. Click
    clickOpening, setClickOpening, clickRows, totalClickBalance, addClickRow, deleteClickRow, updateClickRow,
    deleteTransfer,
    // 5. Sement
    cementOpening, setCementOpening, totalCementBalance, totalSoldTons, totalRecvTons, totalSalesTons,
    // Skladlar (omborlar)
    warehouses, addWarehouse, updateWarehouse, deleteWarehouse, whOf, whName, defaultWhId,
    cementByWarehouse, cementBalanceOf,
    // 7. Kirim
    incomeRows, addIncomeRow, deleteIncomeRow,
    // 8. Chiqim
    expenseRows, addExpenseRow, deleteExpenseRow,
    // 9. Sotilgan tonna
    soldRows, addSoldRow, deleteSoldRow,
    // 10. Olingan tonna
    recvRows, addRecvRow, updateRecvRow, deleteRecvRow, importRecvRows, verifyRecvRow, pendingRecvCount,
    pendingRecvTons,
    // 10b/10c. Yetkazib beruvchilar va ularga qarz/to'lovlar
    suppliers, addSupplier, updateSupplier, deleteSupplier,
    supplierPayments, paySupplier, deleteSupplierPayment,
    supplierList, supplierReceivedOf, supplierPaidOf, supplierDebtOf,
    totalSupplierDebt, totalSupplierReceived, totalSupplierPaid,
    // 11. Qarzlar
    debtRows, addDebtRow, payDebt, payCustomerDebt, payDebtFromAdvance, deleteDebtRow, importDebts, totalDebts, totalDebtsPaid, totalDebtsAll,
    // 12. Avanslar
    advanceRows, addAdvanceRow, deleteAdvanceRow, importAdvances, totalAdvances, totalAdvancesUsed, totalAdvancesAll, advanceBalanceOf,
    fixRowDates,
    // 13. Sotish
    salesRows, addSaleRow, updateSaleRow, deleteSaleRow,
    // 14. Kirim bank + Chiqim bank
    bankIncomeRows, addBankIncomeRow, deleteBankIncomeRow, totalBankIncome,
    importBankIncomeRows, verifyBankIncomeRow, pendingBankCount,
    bankExpenseRows, addBankExpenseRow, deleteBankExpenseRow, totalBankExpense,
    bankPendingRows, importOborotka, confirmBankPendingRow, deleteBankPendingRow,
    bankNetBalance,
    // 15. Kirim click + Chiqim click
    clickIncomeRows, addClickIncomeRow, deleteClickIncomeRow, totalClickIncome,
    clickExpenseRows, addClickExpenseRow, deleteClickExpenseRow, totalClickExpense,
    clickNetBalance,
    // 16. Ishchilar
    workers, addWorker, updateWorker, payWorker, deleteWorker, deleteSalaryPayment,
    salaryPayments,
    // 17. Telegram
    tgOrders, addTgOrder, setTgStatus, deleteTgOrder, totalTgTons,
    // 6. Kunlik ish
    dailyWorkRows, addDailyWorkRow, deleteDailyWorkRow,
    // Mijozlar bazasi
    customers, addCustomer, updateCustomer, deleteCustomer, importCustomers, setMonitor, custRef,
    // Haydovchilar
    drivers, addDriver, updateDriver, deleteDriver,
    driverTrips, addDriverTrip, deleteDriverTrip,
    driverTariffs, addDriverTariff, removeDriverTariff, renameDriverTariff, addPriceToTariff, removePriceFromTariff,
    // Asosiy sklad (kg — CHAKANA)
    skladRows, addSkladKirim, addSkladSotuv, totalSkladKg, updateSkladRow, deleteSkladSotuv,
    // Qaysi recvRow'lar chakana skladga o'tkazilganligi (Set<id>)
    skladSourceIds: _skladSourceIds,
    // Sement turlari
    cementTypes, addCementType, removeCementType,
    cementBalanceByType, skladKgByType, skladKgUntyped,
    // Tiketlar (zayavka uchun)
    tickets, addTicket, closeTicket, reopenTicket, deleteTicket,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
