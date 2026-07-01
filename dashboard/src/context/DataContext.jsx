import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../api';

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
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

// Tonnani chiroyli ko'rsatish (butun bo'lsa kasrsiz)
const fmtTons = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };

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

// Avtomatik yaratilgan yozuvni qo'lda o'chirishdan himoya qilish.
const guardAutoDelete = (rows, id) => {
  const row = rows.find(r => r.id === id);
  if (row?.auto) {
    const src = row.sourceType;
    const msgs = {
      sale:         "Bu yozuv sotuvdan avtomatik yaratilgan.\nO'chirish uchun \"Sotish\" bo'limidan tegishli savdoni o'chiring.",
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
  const logout = () => {
    api.setToken(null);
    setTokenState(null);
    setCurrentUser(null);
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
    const id = 'wh' + Date.now();
    setWarehouses(p => [...p, { id, name: String(name).trim() || 'Sklad' }]);
    return id;
  };
  const updateWarehouse = (id, name) => setWarehouses(p => p.map(w => w.id === id ? { ...w, name } : w));
  const deleteWarehouse = (id) => setWarehouses(p => p.length > 1 ? p.filter(w => w.id !== id) : p);


  // ── 2. Naqd pul ──────────────────────────────────────────────────────────
  const [cashOpening, setCashOpening] = useState(() => load('cash_opening', { date: '', amount: 0 }));
  const [cashRows, setCashRows]       = useState(() => load('cash_rows', []));
  useEffect(() => save('cash_opening', cashOpening), [cashOpening]);
  useEffect(() => save('cash_rows',    cashRows),    [cashRows]);
  const _cashRowsSum = cashRows.reduce((s, r) => s + Number(r.amount), 0);
  const addCashRow   = (amount, desc, date = new Date().toLocaleDateString('ru-RU'), customer = '') => {
    const ts = Date.now();
    setCashRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date, amount: Number(amount), desc, customer: customer || '' }]);
  };
  const deleteCashRow    = (id) => setCashRows(p => guardAutoDelete(p, id));
  const updateCashRow    = (id, fields) => setCashRows(p => p.map(r => r.id === id ? { ...r, ...fields } : r));

  // ── 3. Bank ───────────────────────────────────────────────────────────────
  const [bankOpening, setBankOpening] = useState(() => load('bank_opening', { date: '', amount: 0 }));
  const [bankRows, setBankRows]       = useState(() => load('bank_rows', []));
  useEffect(() => save('bank_opening', bankOpening), [bankOpening]);
  useEffect(() => save('bank_rows',    bankRows),    [bankRows]);
  const _bankRowsSum = bankRows.reduce((s, r) => s + Number(r.amount), 0);
  const addBankRow   = (amount, desc, date = new Date().toLocaleDateString('ru-RU'), customer = '') => {
    const ts = Date.now();
    setBankRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date, amount: Number(amount), desc, customer: customer || '' }]);
  };
  const deleteBankRow    = (id) => setBankRows(p => guardAutoDelete(p, id));
  const updateBankRow    = (id, fields) => setBankRows(p => p.map(r => r.id === id ? { ...r, ...fields } : r));

  // ── 4. Click ──────────────────────────────────────────────────────────────
  const [clickOpening, setClickOpening] = useState(() => load('click_opening', { date: '', amount: 0 }));
  const [clickRows, setClickRows]       = useState(() => load('click_rows', []));
  useEffect(() => save('click_opening', clickOpening), [clickOpening]);
  useEffect(() => save('click_rows',    clickRows),    [clickRows]);
  const _clickRowsSum = clickRows.reduce((s, r) => s + Number(r.amount), 0);
  const addClickRow   = (amount, desc, date = new Date().toLocaleDateString('ru-RU'), customer = '') => {
    const ts = Date.now();
    setClickRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date, amount: Number(amount), desc, customer: customer || '' }]);
  };
  const deleteClickRow    = (id) => setClickRows(p => guardAutoDelete(p, id));
  const updateClickRow    = (id, fields) => setClickRows(p => p.map(r => r.id === id ? { ...r, ...fields } : r));

  // ── 5. Sement qoldig'i ────────────────────────────────────────────────────
  const [cementOpening, setCementOpening] = useState(() => load('cement_opening', { date: '25.04.2025', tons: 0 }));
  useEffect(() => save('cement_opening', cementOpening), [cementOpening]);

  // ── 7. Kirim (naqd) ───────────────────────────────────────────────────────
  const [incomeRows, setIncomeRows] = useState(() => load('income_rows', []));
  useEffect(() => save('income_rows', incomeRows), [incomeRows]);
  const addIncomeRow = (amount, desc, date = new Date().toLocaleDateString('ru-RU')) => {
    const ts = Date.now();
    setIncomeRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date, amount: Number(amount), desc }]);
  };
  const deleteIncomeRow = (id) => setIncomeRows(p => p.filter(r => r.id !== id));

  // ── 8. Chiqim (naqd) ──────────────────────────────────────────────────────
  const [expenseRows, setExpenseRows] = useState(() => load('expense_rows', []));
  useEffect(() => save('expense_rows', expenseRows), [expenseRows]);
  const addExpenseRow = (amount, desc, date = new Date().toLocaleDateString('ru-RU')) => {
    const ts = Date.now();
    setExpenseRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date, amount: Number(amount), desc }]);
  };
  const deleteExpenseRow = (id) => setExpenseRows(p => p.filter(r => r.id !== id));
  const _incomeSum  = incomeRows.reduce((s, r)  => s + Number(r.amount || 0), 0);
  const _expenseSum = expenseRows.reduce((s, r) => s + Number(r.amount || 0), 0);

  // ── 9. Sotilgan tonna ─────────────────────────────────────────────────────
  const [soldRows, setSoldRows] = useState(() => load('sold_rows', []));
  useEffect(() => save('sold_rows', soldRows), [soldRows]);
  const addSoldRow = (entry) => {
    const ts = Date.now();
    setSoldRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date: new Date().toLocaleDateString('ru-RU'), ...entry }]);
  };
  const deleteSoldRow = (id) => setSoldRows(p => p.filter(r => r.id !== id));
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
    const ts = Date.now();
    const today = new Date().toLocaleDateString('ru-RU');
    const ftDate = (() => { const d = new Date((entry.factoryTime || '').replace(' ', 'T')); return isNaN(d.getTime()) ? null : d.toLocaleDateString('ru-RU'); })();
    const row = {
      id: ts, createdAt: ts, worker: currentWorker, date: ftDate || today,
      source: entry.source || '', brand: entry.brand || '',
      vehicleNo: entry.vehicleNo || '', tons: entry.tons || 0,
      pricePerTon: entry.pricePerTon || 0,
      paymentChannel: entry.paymentChannel || 'naqd',
      cardName: entry.cardName || '', factoryTime: entry.factoryTime || '',
      izoh: entry.izoh || '',
      warehouseId: entry.warehouseId || defaultWhId,
      cementType: entry.cementType || '',
    };
    setRecvRows(p => [...p, row]);
    return row;
  };
  const updateRecvRow = (id, fields) => setRecvRows(p => p.map(r => r.id === id ? { ...r, ...fields } : r));
  const deleteRecvRow = (id) => {
    setRecvRows(p => p.filter(r => r.id !== id));
    // Cascade: eski versiyalarda yaratilgan auto chiqim yozuvlari bo'lsa ham o'chirish
    setCashRows(p  => p.filter(r => r.sourceId !== id));
    setBankRows(p  => p.filter(r => r.sourceId !== id));
    setClickRows(p => p.filter(r => r.sourceId !== id));
    // Shu recvRow'dan sklad kirim yozuvlari (taqsimlash orqali yaratilgan)
    setSkladRows(p => p.filter(r => !(r.type === 'kirim' && r.sourceId === id)));
  };
  // Excel'dan ko'plab "Olingan tonna" import — TEKSHIRILMAGAN (pending) holatda.
  // Pul (zavodga to'lov) tasdiqlangandagina yoziladi.
  const importRecvRows = (rows) => {
    const base = Date.now();
    setRecvRows(p => [...p, ...rows.map((r, i) => ({
      id: base + i, createdAt: base + i, worker: currentWorker,
      date: r.date || (() => { const d = new Date((r.factoryTime || '').replace(' ', 'T')); return isNaN(d.getTime()) ? new Date().toLocaleDateString('ru-RU') : d.toLocaleDateString('ru-RU'); })(),
      source: r.source || '', brand: r.brand || '', vehicleNo: r.vehicleNo || '',
      tons: Number(r.tons) || 0, pricePerTon: Number(r.pricePerTon) || 0,
      paymentChannel: r.paymentChannel || 'bank',
      cardName: r.cardName || '', factoryTime: r.factoryTime || '', izoh: r.izoh || '',
      warehouseId: r.warehouseId || defaultWhId,
      pending: true, // tekshirilmagan — sariq
    }))]);
  };
  // Tasdiqlash: maydonlarni yangilab, pending'ni olib tashlaydi.
  // Kassadan pul YECHILMAYDI — bu summa yetkazib beruvchi qarzimizga qo'shiladi.
  const verifyRecvRow = (id, patch = {}) => {
    const cur = recvRows.find(r => r.id === id);
    if (!cur || !cur.pending) return;
    const m = { ...cur, ...patch, pending: false };
    setRecvRows(p => p.map(r => r.id === id ? m : r));
  };
  const totalRecvTons = recvRows.reduce((s, r) => s + Number(r.tons || 0), 0);
  const pendingRecvCount = recvRows.filter(r => r.pending).length;

  // ── 10b. Yetkazib beruvchilar (manbaa) bazasi ─────────────────────────────
  // Mijozlar bazasiga o'xshash — autocomplete va saqlash uchun.
  const [suppliers, setSuppliers] = useState(() => load('suppliers', []));
  useEffect(() => save('suppliers', suppliers), [suppliers]);
  const addSupplier = ({ name, phone = '', note = '' }) => {
    const nm = String(name || '').trim();
    if (!nm) return;
    const ts = Date.now();
    setSuppliers(p => p.some(s => s.name.toLowerCase() === nm.toLowerCase())
      ? p
      : [...p, { id: ts, createdAt: ts, worker: currentWorker, name: nm, phone: String(phone).trim(), note }]);
  };
  const updateSupplier = (id, data) => setSuppliers(p => p.map(s => s.id === id ? { ...s, ...data } : s));
  const deleteSupplier = (id) => setSuppliers(p => p.filter(s => s.id !== id));

  // ── 10c. Yetkazib beruvchiga to'lovlar (qarzni uzish) ─────────────────────
  // Sement olganda pul yechilmaydi (qarzga). Bu yerda zavodga to'lov qilinganda
  // tegishli kassadan chiqim yoziladi.
  const [supplierPayments, setSupplierPayments] = useState(() => load('supplier_payments', []));
  useEffect(() => save('supplier_payments', supplierPayments), [supplierPayments]);
  const paySupplier = (supplier, amount, channel = 'naqd', note = '') => {
    const amt = Number(amount);
    if (!supplier || amt <= 0) return;
    const ts = Date.now();
    const today = new Date().toLocaleDateString('ru-RU');
    setSupplierPayments(p => [...p, {
      id: ts, createdAt: ts, worker: currentWorker, date: today,
      supplier, amount: amt, channel, note,
    }]);
    // ── INTEGRATSIYA: zavodga to'lov → tegishli kassadan chiqim ──────────────
    const tag  = `🔗 Yetkazib beruvchiga to'lov: ${supplier}`;
    const link = { auto: true, sourceType: 'supplier_payment', sourceId: ts, createdAt: ts, worker: currentWorker, date: today };
    if      (channel === 'naqd')  setCashRows(p  => [...p, { ...link, id: ts + 1, amount: -amt, desc: tag }]);
    else if (channel === 'bank')  setBankRows(p  => [...p, { ...link, id: ts + 1, amount: -amt, desc: tag }]);
    else if (channel === 'click') setClickRows(p => [...p, { ...link, id: ts + 1, amount: -amt, desc: tag }]);
  };
  const deleteSupplierPayment = (id) => {
    setSupplierPayments(p => p.filter(x => x.id !== id));
    const rm = (rows) => rows.filter(r => !(r.auto && r.sourceType === 'supplier_payment' && r.sourceId === id));
    setCashRows(rm); setBankRows(rm); setClickRows(rm);
  };

  // Yetkazib beruvchilar ro'yxati (recv manbalari + saqlanganlar + to'lovlar)
  const supplierList = [...new Set([
    ...recvRows.map(r => r.source).filter(Boolean),
    ...suppliers.map(s => s.name).filter(Boolean),
    ...supplierPayments.map(p => p.supplier).filter(Boolean),
  ])];
  // Tasdiqlangan (pending bo'lmagan) olingan sementning umumiy summasi = qarz
  const supplierReceivedOf = (name) => recvRows
    .filter(r => r.source === name && !r.pending)
    .reduce((s, r) => s + Number(r.tons || 0) * Number(r.pricePerTon || 0), 0);
  const supplierPaidOf = (name) => supplierPayments
    .filter(p => p.supplier === name)
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const supplierDebtOf = (name) => Math.max(0, supplierReceivedOf(name) - supplierPaidOf(name));
  const totalSupplierDebt    = supplierList.reduce((s, n) => s + supplierDebtOf(n), 0);
  const totalSupplierReceived = supplierList.reduce((s, n) => s + supplierReceivedOf(n), 0);
  const totalSupplierPaid     = supplierPayments.reduce((s, p) => s + Number(p.amount || 0), 0);

  // Sement qoldig'i = ochilish + olingan − (eski sotilgan + yangi sotuv)
  // Eslatma: yangi "Sotish" (salesRows) ham hisobga olinadi — pastda salesRows
  // e'lon qilingach hisoblanadi.

  // ── 11. Qarzlar ───────────────────────────────────────────────────────────
  const [debtRows, setDebtRows] = useState(() => load('debt_rows', []));
  useEffect(() => save('debt_rows', debtRows), [debtRows]);
  const addDebtRow = (customer, amount, note = '') => {
    const ts = Date.now();
    setDebtRows(p => [...p, {
      id: ts, createdAt: ts, worker: currentWorker,
      date: new Date().toLocaleDateString('ru-RU'),
      customer, amount: Number(amount), paid: 0, note,
      payments: [],
    }]);
  };
  const payDebt = (id, payAmount, payNote = '', channel = 'naqd') => {
    const ts = Date.now();
    const amt = Number(payAmount);
    const today = new Date().toLocaleDateString('ru-RU');
    // Mijoz ismini topamiz (description uchun)
    const debtRow = debtRows.find(r => r.id === id);
    const customer = debtRow?.customer || '';
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
    const link = { auto: true, sourceType: 'debt_payment', sourceId: `${id}_p${ts}`, createdAt: ts, worker: currentWorker, date: today };
    if      (channel === 'naqd')  setCashRows(p  => [...p, { ...link, id: ts + 1, amount:  amt, desc: tag }]);
    else if (channel === 'bank')  setBankRows(p  => [...p, { ...link, id: ts + 1, amount:  amt, desc: tag }]);
    else if (channel === 'click') setClickRows(p => [...p, { ...link, id: ts + 1, amount:  amt, desc: tag }]);
  };
  const deleteDebtRow = (id) => {
    setDebtRows(p => guardAutoDelete(p, id));
    // Ushbu qarzning to'lovlaridan yaratilgan auto kirim yozuvlarini ham o'chirish
    const prefix = `${id}_p`;
    setCashRows(p  => p.filter(r => !r.auto || !String(r.sourceId || '').startsWith(prefix)));
    setBankRows(p  => p.filter(r => !r.auto || !String(r.sourceId || '').startsWith(prefix)));
    setClickRows(p => p.filter(r => !r.auto || !String(r.sourceId || '').startsWith(prefix)));
  };
  // ── Mijoz qarzini bittada qabul qilish (kassir uchun — eng oson) ──────────
  // Summa mijozning qarzlariga ESKISIDAN boshlab taqsimlanadi, kassaga kirim
  // yoziladi. Natija: { applied (qarzga ketgan), leftover (ortiqcha) }.
  const payCustomerDebt = (customer, amount, channel = 'naqd', note = '') => {
    const base = Date.now();
    const today = new Date().toLocaleDateString('ru-RU');
    let left = Number(amount) || 0;
    if (left <= 0) return { applied: 0, leftover: 0 };

    // Eng eski qarzdan boshlab to'lash rejasi
    const plan = {};
    let applied = 0;
    debtRows
      .filter(r => r.customer === customer && Math.max(0, Number(r.amount) - Number(r.paid)) > 0)
      .sort((a, b) => (a.createdAt || a.id) - (b.createdAt || b.id))
      .forEach(r => {
        if (left <= 0) return;
        const rem = Math.max(0, Number(r.amount) - Number(r.paid));
        const pay = Math.min(rem, left);
        plan[r.id] = pay; left -= pay; applied += pay;
      });

    if (applied <= 0) return { applied: 0, leftover: Number(amount) || 0 };

    // Qarzlarni yangilash (har biriga to'lov yozuvi, kanal bilan)
    setDebtRows(p => p.map(r => {
      const pay = plan[r.id];
      if (!pay) return r;
      return {
        ...r,
        paid: Number(r.paid) + pay,
        payments: [...(r.payments || []), { id: base + (r.id % 100000), date: today, amount: pay, note: note || 'Kassaga to\'lov', worker: currentWorker, channel }],
      };
    }));

    // Kassaga bitta umumiy kirim (sotuvdan farqlash uchun sourceType: debt_payment)
    const tag  = `🔗 Qarz to'lovi: ${customer}`;
    const link = { auto: true, sourceType: 'debt_payment', sourceId: `${[customer]}_pc${base}`, createdAt: base, worker: currentWorker, date: today, customer };
    if      (channel === 'naqd')  setCashRows(p  => [...p, { ...link, id: base + 1, amount: applied, desc: tag }]);
    else if (channel === 'bank')  setBankRows(p  => [...p, { ...link, id: base + 1, amount: applied, desc: tag }]);
    else if (channel === 'click') setClickRows(p => [...p, { ...link, id: base + 1, amount: applied, desc: tag }]);

    return { applied, leftover: Math.max(0, (Number(amount) || 0) - applied) };
  };

  // Excel'dan ko'plab qarz import qilish (unikal id bilan)
  const importDebts = (rows) => {
    const base = Date.now();
    setDebtRows(p => [...p, ...rows.map((r, i) => ({
      id: base + i, createdAt: base + i, worker: currentWorker,
      date: r.date || new Date().toLocaleDateString('ru-RU'),
      customer: r.customer, amount: Number(r.amount) || 0, paid: 0,
      note: r.note || '', payments: [],
    }))]);
  };
  const totalDebts    = debtRows.reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.paid)), 0);
  const totalDebtsPaid = debtRows.reduce((s, r) => s + Number(r.paid), 0);
  const totalDebtsAll  = debtRows.reduce((s, r) => s + Number(r.amount), 0);

  // ── 12. Avanslar ──────────────────────────────────────────────────────────
  const [advanceRows, setAdvanceRows] = useState(() => load('advance_rows', []));
  useEffect(() => save('advance_rows', advanceRows), [advanceRows]);
  const addAdvanceRow = (customer, amount, note = '', channel = 'naqd') => {
    const ts = Date.now();
    const today = new Date().toLocaleDateString('ru-RU');
    setAdvanceRows(p => [...p, {
      id: ts, createdAt: ts, worker: currentWorker, date: today,
      customer, amount: Number(amount), used: 0, note, usages: [],
    }]);
    // ── INTEGRATSIYA: avans → tegishli kassaga kirim ─────────────────────────
    const sum = Number(amount);
    if (sum > 0) {
      const tag  = `🔗 Avans: ${customer}`;
      const link = { auto: true, sourceType: 'advance', sourceId: ts, createdAt: ts, worker: currentWorker, date: today, customer };
      if      (channel === 'naqd')  setCashRows(p  => [...p, { ...link, id: ts + 1, amount:  sum, desc: tag }]);
      else if (channel === 'bank')  setBankRows(p  => [...p, { ...link, id: ts + 1, amount:  sum, desc: tag }]);
      else if (channel === 'click') setClickRows(p => [...p, { ...link, id: ts + 1, amount:  sum, desc: tag }]);
    }
  };
  const useAdvance = (id, useAmount, useNote = '') => {
    const ts = Date.now();
    const amt = Number(useAmount);
    setAdvanceRows(p => p.map(r => {
      if (r.id !== id) return r;
      const newUsage = {
        id: ts,
        date: new Date().toLocaleDateString('ru-RU'),
        amount: amt,
        note: useNote,
        worker: currentWorker,
      };
      return {
        ...r,
        used: Number(r.used) + amt,
        usages: [...(r.usages || []), newUsage],
      };
    }));
  };
  const deleteAdvanceRow = (id) => {
    setAdvanceRows(p => p.filter(r => r.id !== id));
    setCashRows(p  => p.filter(r => r.sourceId !== id));
    setBankRows(p  => p.filter(r => r.sourceId !== id));
    setClickRows(p => p.filter(r => r.sourceId !== id));
  };
  const totalAdvances     = advanceRows.reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.used)), 0);
  const totalAdvancesUsed = advanceRows.reduce((s, r) => s + Number(r.used), 0);
  const totalAdvancesAll  = advanceRows.reduce((s, r) => s + Number(r.amount), 0);
  // Mijozning qoldiq avansi
  const advanceBalanceOf = (customer) => advanceRows
    .filter(r => r.customer === customer)
    .reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.used)), 0);
  // Sotuvda avansdan yechish — eng eski avansdan boshlab, sourceId (saleId) bilan
  // belgilab. Qaytarilgan: ishlatilgan summa.
  const consumeAdvance = (customer, amount, saleId) => {
    let left = Number(amount) || 0;
    if (left <= 0) return 0;
    const ts = Date.now();
    const today = new Date().toLocaleDateString('ru-RU');
    const plan = {};
    let applied = 0;
    advanceRows
      .filter(r => r.customer === customer && Math.max(0, Number(r.amount) - Number(r.used)) > 0)
      .sort((a, b) => (a.createdAt || a.id) - (b.createdAt || b.id))
      .forEach(r => {
        if (left <= 0) return;
        const rem = Math.max(0, Number(r.amount) - Number(r.used));
        const use = Math.min(rem, left);
        plan[r.id] = use; left -= use; applied += use;
      });
    if (applied <= 0) return 0;
    setAdvanceRows(p => p.map(r => {
      const use = plan[r.id];
      if (!use) return r;
      return { ...r, used: Number(r.used) + use,
        usages: [...(r.usages || []), { id: ts + (r.id % 100000), saleId, date: today, amount: use, note: 'Sotuvga ishlatildi', worker: currentWorker }] };
    }));
    return applied;
  };
  // Sotuv o'chirilsa — ishlatilgan avansni qaytarish (saleId bo'yicha)
  const restoreAdvanceForSale = (saleId) => {
    setAdvanceRows(p => p.map(r => {
      const mine = (r.usages || []).filter(u => u.saleId === saleId);
      if (!mine.length) return r;
      const back = mine.reduce((s, u) => s + Number(u.amount || 0), 0);
      return { ...r, used: Math.max(0, Number(r.used) - back), usages: (r.usages || []).filter(u => u.saleId !== saleId) };
    }));
  };

  // ── 13. Sotish ────────────────────────────────────────────────────────────
  const [salesRows, setSalesRows] = useState(() => load('sales_rows', []));
  useEffect(() => save('sales_rows', salesRows), [salesRows]);
  const addSaleRow = (entry) => {
    const ts = Date.now();
    const sale = { id: ts, createdAt: ts, worker: currentWorker, date: new Date().toLocaleDateString('ru-RU'), ...entry };

    // ── INTEGRATSIYA: savdo → tegishli bo'limga avtomatik yozuv ─────────────
    // Pul/qarz/qoldiq shu orqali yangilanadi. Avtomatik yozuvlar belgilanadi
    // (auto:true, sourceId) va faqat shu savdo o'chirilganda o'chiriladi.
    const sum = Number(sale.tons || 0) * Number(sale.pricePerTon || 0);
    if (sum > 0) {
      const tag  = `🔗 Sotuv: ${sale.customer} (${fmtTons(sale.tons)} tn)${sale.vehicleNo ? ` | 🚛 ${sale.vehicleNo}` : ''}`;
      const link = { auto: true, sourceType: 'sale', sourceId: ts, createdAt: ts, worker: currentWorker, date: sale.date };
      const channel = sale.paymentChannel || 'naqd';
      if (channel === 'naqd')        setCashRows(p  => [...p, { ...link, id: ts + 1, amount: sum, desc: tag }]);
      else if (channel === 'bank')   setBankRows(p  => [...p, { ...link, id: ts + 1, amount: sum, desc: tag }]);
      else if (channel === 'click')  setClickRows(p => [...p, { ...link, id: ts + 1, amount: sum, desc: tag }]);
      else if (channel === 'nasiya') setDebtRows(p  => [...p, { ...link, id: ts + 1, customer: sale.customer, amount: sum, paid: 0, note: tag, payments: [] }]);
      else if (channel === 'avans') {
        // Avansdan yechamiz (pul allaqachon kassada). Yetmasa — qolgani qarzga.
        const applied = consumeAdvance(sale.customer, sum, ts);
        sale.advanceUsed = applied;
        const rem = sum - applied;
        if (rem > 0) setDebtRows(p => [...p, { ...link, id: ts + 1, customer: sale.customer, amount: rem, paid: 0, note: `${tag} (avans yetmadi)`, payments: [] }]);
      }
    }
    setSalesRows(p => [...p, sale]);

    // ── Mijozga Telegram xabari (fire-and-forget) ────────────────────────────
    const cust = customers.find(c => c.name === sale.customer);
    const directChatId = cust?.telegramChatId || null;
    const custPhone    = cust?.phone || '';
    if (directChatId || custPhone) {
      const existingDebt = debtRows
        .filter(r => r.customer === sale.customer)
        .reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.paid)), 0);
      const newDebt = (sale.paymentChannel === 'nasiya') ? sum : 0;
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
  // Savdoni tahrirlash (faqat meta-maydonlar: customer, note, vehicleNo va h.k.)
  // Narx va tonna o'zgarsa — cashRow/debtRow lar manual yangilanishi kerak!
  const updateSaleRow = (id, fields) => setSalesRows(p => p.map(r => r.id === id ? { ...r, ...fields } : r));
  // Savdo o'chsa — u yaratgan barcha avtomatik yozuvlar ham o'chadi
  const deleteSaleRow = (id) => {
    const sale = salesRows.find(r => r.id === id);
    if (sale && sale.advanceUsed) restoreAdvanceForSale(id); // ishlatilgan avansni qaytarish
    setSalesRows(p  => p.filter(r => r.id !== id));
    setCashRows(p   => p.filter(r => r.sourceId !== id));
    setBankRows(p   => p.filter(r => r.sourceId !== id));
    setClickRows(p  => p.filter(r => r.sourceId !== id));
    setDebtRows(p   => p.filter(r => r.sourceId !== id));
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
  const removeCementType = (name) => setCementTypes(p => p.filter(t => t !== name));

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
  const _ulgurjiRecvTons = recvRows.reduce((s, r) => {
    const skladTons = (_skladKgByRecvId[r.id] || 0) / 1000;
    return s + Math.max(0, Number(r.tons || 0) - skladTons);
  }, 0);
  const totalCementBalance = Number(cementOpening.tons) + _ulgurjiRecvTons - totalSoldTons - totalSalesTons;

  const addSkladKirim = (recvRowId, kg, desc, cementType) => {
    const ts = Date.now();
    setSkladRows(p => [...p, {
      id: ts, createdAt: ts, date: new Date().toLocaleDateString('ru-RU'),
      type: 'kirim', kg: Number(kg), sourceId: recvRowId,
      desc: desc || 'Zavoddan kirim', worker: currentWorker,
      cementType: cementType || '',
    }]);
  };

  const addSkladSotuv = ({ customer, kg, pricePerKg, channel, note, cementType }) => {
    const ts = Date.now();
    const kgN  = Number(kg);
    const sum  = kgN * Number(pricePerKg);
    const td   = new Date().toLocaleDateString('ru-RU');
    const tag  = `🏗 Sklad: ${customer} (${kgN} kg)`;
    const link = { auto: true, sourceType: 'sklad_sale', sourceId: ts, createdAt: ts, worker: currentWorker, date: td, customer };
    if (sum > 0) {
      if      (channel === 'naqd')   setCashRows(p  => [...p, { ...link, id: ts + 1, amount: sum, desc: tag }]);
      else if (channel === 'bank')   setBankRows(p  => [...p, { ...link, id: ts + 1, amount: sum, desc: tag }]);
      else if (channel === 'click')  setClickRows(p => [...p, { ...link, id: ts + 1, amount: sum, desc: tag }]);
      else if (channel === 'nasiya') setDebtRows(p  => [...p, { ...link, id: ts + 1, customer, amount: sum, paid: 0, note: tag, payments: [] }]);
    }
    const row = { id: ts, createdAt: ts, date: td, type: 'chiqim', kg: -kgN, customer, pricePerKg: Number(pricePerKg), amount: sum, channel, note: note || '', worker: currentWorker, cementType: cementType || '' };
    setSkladRows(p => [...p, row]);
    return row;
  };

  const totalSkladKg = skladRows.reduce((s, r) => s + Number(r.kg || 0), 0);

  const updateSkladRow = (id, fields) => setSkladRows(p => p.map(r => r.id === id ? { ...r, ...fields } : r));

  const deleteSkladSotuv = (id) => {
    setSkladRows(p => p.filter(r => r.id !== id));
    const rm = (rows) => rows.filter(r => !(r.auto && r.sourceType === 'sklad_sale' && r.sourceId === id));
    setCashRows(rm); setBankRows(rm); setClickRows(rm);
    setDebtRows(p => p.filter(r => !(r.auto && r.sourceType === 'sklad_sale' && r.sourceId === id)));
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

  // ── Ulgurji sklad (ton) bo'yicha qoldiq ────────────────────────────────────
  // Chakana skladga (kg) o'tkazilgan recvRow'lar CHIQARIB TASHLANADI
  // chunki ularning hisobi totalSkladKg orqali alohida yuritiladi.
  const cementByWarehouse = warehouses.map(w => {
    const recv  = recvRows.filter(r => whOf(r) === w.id).reduce((s, r) => {
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
    const ts = Date.now();
    setBankIncomeRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date, amount: Number(amount), desc, customer }]);
  };
  const deleteBankIncomeRow = (id) => setBankIncomeRows(p => p.filter(r => r.id !== id));
  // Excel'dan bank o'tkazmalarini import — TEKSHIRILMAGAN (pending) holatda.
  // Xodim qaysi mijoz puli ekanini biriktirib tasdiqlaydi.
  const importBankIncomeRows = (rows) => {
    const base = Date.now();
    setBankIncomeRows(p => [...p, ...rows.map((r, i) => ({
      id: base + i, createdAt: base + i, worker: currentWorker,
      date: r.date || new Date().toLocaleDateString('ru-RU'),
      amount: Number(r.amount) || 0,
      desc: r.desc || '',
      customer: r.customer || '',
      pending: true, // tekshirilmagan — sariq
    }))]);
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
    const ts = Date.now();
    setBankExpenseRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date, amount: Number(amount), desc, customer }]);
  };
  const deleteBankExpenseRow = (id) => setBankExpenseRows(p => p.filter(r => r.id !== id));

  // ── 14c. Bank oborotka pending (kirim + chiqim aralash) ──────────────────
  const [bankPendingRows, setBankPendingRows] = useState(() => load('bank_pending_rows', []));
  useEffect(() => save('bank_pending_rows', bankPendingRows), [bankPendingRows]);

  const importOborotka = (rows) => {
    const base = Date.now();
    setBankPendingRows(p => [...p, ...rows.map((r, i) => ({
      id: base + i,
      date: r.date || new Date().toLocaleDateString('ru-RU'),
      orgName: r.orgName || '',
      amount: Number(r.amount) || 0,
      type: r.type, // 'kirim' | 'chiqim'
      naznachenie: r.naznachenie || '',
      customer: '',
      izoh: '',
    }))]);
  };

  const confirmBankPendingRow = (id, { customer = '', izoh = '' } = {}) => {
    const row = bankPendingRows.find(r => r.id === id);
    if (!row) return;
    const ts = Date.now();
    const desc = izoh || row.naznachenie || '';
    if (row.type === 'kirim') {
      setBankIncomeRows(p => [...p, { id: ts, createdAt: ts, date: row.date, amount: row.amount, desc, customer, worker: currentWorker }]);
    } else {
      setBankExpenseRows(p => [...p, { id: ts, createdAt: ts, date: row.date, amount: row.amount, desc, customer, worker: currentWorker }]);
    }
    setBankPendingRows(p => p.filter(r => r.id !== id));
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
    const ts = Date.now();
    setClickIncomeRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date, amount: Number(amount), desc }]);
  };
  const deleteClickIncomeRow = (id) => setClickIncomeRows(p => p.filter(r => r.id !== id));
  const totalClickIncome = clickIncomeRows.reduce((s, r) => s + Number(r.amount || 0), 0);

  // ── 15b. Chiqim click ────────────────────────────────────────────────────
  const [clickExpenseRows, setClickExpenseRows] = useState(() => load('click_expense_rows', []));
  useEffect(() => save('click_expense_rows', clickExpenseRows), [clickExpenseRows]);
  const addClickExpenseRow = (amount, desc, date = new Date().toLocaleDateString('ru-RU')) => {
    const ts = Date.now();
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
    const ts = Date.now();
    setWorkers(p => [...p, {
      id: ts, createdAt: ts, worker: currentWorker,
      name, salary: Number(salary), paid: 0,
      position: opts.position || '',
      phone:    opts.phone    || '',
      note:     opts.note     || '',
      role:     opts.role     || 'sotuvchi', // admin, kassir, sotuvchi, omborchi
      password: opts.password || '1234',     // Standart parol
      warehouseId: opts.warehouseId || null, // biriktirilgan sklad
      linkCode: genLinkCode(),
    }]);
  };

  const payWorker = (id, amount, note = '', channel = 'naqd') => {
    const ts = Date.now();
    const num = Number(amount);
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
      if      (channel === 'naqd')  setCashRows(p  => [...p, { ...link, id: ts + 1, amount: -num, desc: tag }]);
      else if (channel === 'bank')  setBankRows(p  => [...p, { ...link, id: ts + 1, amount: -num, desc: tag }]);
      else if (channel === 'click') setClickRows(p => [...p, { ...link, id: ts + 1, amount: -num, desc: tag }]);
    }
  };

  const updateWorker = (id, data) => setWorkers(p => p.map(w => w.id === id ? { ...w, ...data } : w));
  const deleteWorker = (id) => {
    setWorkers(p => p.filter(w => w.id !== id));
    setSalaryPayments(p => p.filter(x => x.workerId !== id));
  };

  // ── 17. Telegram zakaz ────────────────────────────────────────────────────
  const [tgOrders, setTgOrders] = useState(() => load('tg_orders', []));
  useEffect(() => save('tg_orders', tgOrders), [tgOrders]);

  const addTgOrder = (customer, tons, note = '', worker = currentWorker) => {
    const ts = Date.now();
    setTgOrders(p => [...p, { id: ts, createdAt: ts, worker: worker || currentWorker, date: new Date().toLocaleDateString('ru-RU'), customer, tons: Number(tons), status: 'kutilmoqda', note }]);
  };
  const setTgStatus   = (id, status) => setTgOrders(p => p.map(o => o.id === id ? { ...o, status } : o));
  const deleteTgOrder = (id) => setTgOrders(p => p.filter(o => o.id !== id));
  const totalTgTons   = tgOrders.reduce((s, o) => s + Number(o.tons), 0);

  // ── 6. Kunlik ish ─────────────────────────────────────────────────────────
  const [dailyWorkRows, setDailyWorkRows] = useState(() => load('daily_work_rows', []));
  useEffect(() => save('daily_work_rows', dailyWorkRows), [dailyWorkRows]);
  const addDailyWorkRow = (entry) => {
    const ts = Date.now();
    setDailyWorkRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date: new Date().toLocaleDateString('ru-RU'), ...entry }]);
  };
  const deleteDailyWorkRow = (id) => setDailyWorkRows(p => p.filter(r => r.id !== id));

  // ── Mijozlar bazasi ───────────────────────────────────────────────────────
  const [customers, setCustomers] = useState(() => load('customers', []));
  useEffect(() => save('customers', customers), [customers]);
  const genLinkCode = () => Math.random().toString(36).slice(2, 10).toUpperCase();
  const addCustomer = ({ name, address, phone, note = '' }) => {
    const ts = Date.now();
    setCustomers(p => [...p, {
      id: ts, createdAt: ts, worker: currentWorker,
      name: name.trim(), address: address.trim(), phone: phone.trim(), note,
      linkCode: genLinkCode(),
    }]);
  };
  const updateCustomer = (id, data) => setCustomers(p => p.map(c => c.id === id ? { ...c, ...data } : c));
  const deleteCustomer = (id) => setCustomers(p => p.filter(c => c.id !== id));
  // Mijozni nazoratga olish / olib tashlash (ixtiyoriy alohida muddat bilan)
  const setMonitor = (id, monitored, monitorDays = null) =>
    setCustomers(p => p.map(c => c.id === id ? { ...c, monitored, monitorDays: monitorDays || null } : c));
  // Excel'dan ko'plab mijoz import qilish (unikal id bilan)
  const importCustomers = (rows) => {
    const base = Date.now();
    setCustomers(p => [...p, ...rows.map((r, i) => ({
      id: base + i, createdAt: base + i, worker: currentWorker,
      name: (r.name || '').trim(), address: (r.address || '').trim(),
      phone: (r.phone || '').trim(), note: r.note || '',
      linkCode: Math.random().toString(36).slice(2, 10).toUpperCase(),
    }))]);
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
    const id = 'tk_' + Date.now();
    setTickets(p => [...p, {
      id, number: number.trim(), marka: marka.trim(),
      totalTonna: Number(totalTonna) || 0,
      usedTonna: 0, status: 'open', createdAt: Date.now(),
    }]);
  };
  const closeTicket  = (id) => setTickets(p => p.map(t => t.id === id ? { ...t, status: 'closed', closedAt: Date.now() } : t));
  const reopenTicket = (id) => setTickets(p => p.map(t => t.id === id ? { ...t, status: 'open', closedAt: null } : t));
  const deleteTicket = (id) => setTickets(p => p.filter(t => t.id !== id));
  // Bot usedTonna ni to'g'ridan-to'g'ri state ga yozadi (db.useTicketTonna).
  // Frontend keyingi sync da yangi qiymatni oladi.

  const addDriverTariff    = (name) => setDriverTariffs(p => [...p, { id: Date.now(), name: name.trim(), prices: [] }]);
  const removeDriverTariff = (id)   => setDriverTariffs(p => p.filter(t => t.id !== id));
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
    const ts = Date.now();
    setDrivers(p => [...p, { id: ts, name, carNumber, phone, tariffId }]);
  };
  const updateDriver = (id, data) => setDrivers(p => p.map(d => d.id === id ? { ...d, ...data } : d));
  const deleteDriver = (id) => {
    const tripIds = new Set(driverTrips.filter(t => t.driverId === id).map(t => t.id));
    setDrivers(p => p.filter(d => d.id !== id));
    setDriverTrips(p => p.filter(t => t.driverId !== id)); // haydovchi o'chsa qatnovlari ham o'chadi
    // Shu haydovchining to'lovlaridan yaratilgan kassa chiqimlarini ham o'chirish
    const rm = (rows) => rows.filter(r => !(r.auto && r.sourceType === 'driver' && tripIds.has(r.sourceId)));
    setCashRows(rm); setBankRows(rm); setClickRows(rm);
  };

  const addDriverTrip = (driverId, destination, price, isPayment = false, note = '', channel = 'naqd') => {
    const ts = Date.now();
    const amt = Number(price);
    const today = new Date().toLocaleDateString('ru-RU');
    setDriverTrips(p => {
      const updated = [...p, {
        id: ts, createdAt: ts, driverId, date: today,
        destination, price: amt, isPayment, note,
        channel: isPayment ? channel : undefined,
      }];
      // Haydovchiga bot xabari (avans berilib yoki qo'shimcha reys qo'shilsa)
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
      return updated;
    });
    // ── INTEGRATSIYA: haydovchiga to'lov → tegishli kassadan chiqim ─────────
    if (isPayment && amt > 0) {
      const drv = drivers.find(d => d.id === driverId);
      const tag  = `🔗 Haydovchi to'lovi: ${drv?.name || ''}`;
      const link = { auto: true, sourceType: 'driver', sourceId: ts, createdAt: ts, worker: currentWorker, date: today };
      if      (channel === 'naqd')  setCashRows(p  => [...p, { ...link, id: ts + 1, amount: -amt, desc: tag }]);
      else if (channel === 'bank')  setBankRows(p  => [...p, { ...link, id: ts + 1, amount: -amt, desc: tag }]);
      else if (channel === 'click') setClickRows(p => [...p, { ...link, id: ts + 1, amount: -amt, desc: tag }]);
    }
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
  const saveTimer   = useRef(null);

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
        }
        if (!cancelled) setBackendOnline(true);
      } catch (err) {
        console.warn("Backend bilan ulanib bo'lmadi — lokal nusxadan ishlaymiz:", err.message);
        if (!cancelled) setBackendOnline(false);
      } finally {
        // Yuklash tugagach saqlashga ruxsat (joriy render to'lqinidan keyin)
        setTimeout(() => { hydratedRef.current = true; }, 0);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // 2) Har bir o'zgarishdan keyin — butun holatni serverga saqlash (debounce 800ms)
  useEffect(() => {
    if (!hydratedRef.current || !token) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.saveState(snapshot)
        .then(() => setBackendOnline(true))
        .catch(() => setBackendOnline(false));
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    appSettings, cashOpening, cashRows, bankOpening, bankRows, clickOpening, clickRows,
    cementOpening, incomeRows, expenseRows, soldRows, recvRows, debtRows, advanceRows,
    salesRows, suppliers, supplierPayments, bankIncomeRows, bankExpenseRows, bankPendingRows, clickIncomeRows, clickExpenseRows,
    workers, salaryPayments, tgOrders, dailyWorkRows, customers, drivers, driverTrips, skladRows,
    tickets,
  ]);

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
    backendOnline,
    // Bildirishnoma (Telegram/SMS)
    tgContacts, notifyMeta, refreshTgContacts, tgChatIdFor, tgLocationFor,
    // 2. Naqd pul
    cashOpening, setCashOpening, cashRows, totalCashBalance, addCashRow, deleteCashRow, updateCashRow,
    // 3. Bank
    bankOpening, setBankOpening, bankRows, totalBankBalance, addBankRow, deleteBankRow, updateBankRow,
    // 4. Click
    clickOpening, setClickOpening, clickRows, totalClickBalance, addClickRow, deleteClickRow, updateClickRow,
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
    // 10b/10c. Yetkazib beruvchilar va ularga qarz/to'lovlar
    suppliers, addSupplier, updateSupplier, deleteSupplier,
    supplierPayments, paySupplier, deleteSupplierPayment,
    supplierList, supplierReceivedOf, supplierPaidOf, supplierDebtOf,
    totalSupplierDebt, totalSupplierReceived, totalSupplierPaid,
    // 11. Qarzlar
    debtRows, addDebtRow, payDebt, payCustomerDebt, deleteDebtRow, importDebts, totalDebts, totalDebtsPaid, totalDebtsAll,
    // 12. Avanslar
    advanceRows, addAdvanceRow, useAdvance, deleteAdvanceRow, totalAdvances, totalAdvancesUsed, totalAdvancesAll, advanceBalanceOf,
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
    workers, addWorker, updateWorker, payWorker, deleteWorker,
    salaryPayments,
    // 17. Telegram
    tgOrders, addTgOrder, setTgStatus, deleteTgOrder, totalTgTons,
    // 6. Kunlik ish
    dailyWorkRows, addDailyWorkRow, deleteDailyWorkRow,
    // Mijozlar bazasi
    customers, addCustomer, updateCustomer, deleteCustomer, importCustomers, setMonitor,
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
    cementBalanceByType, skladKgByType,
    // Tiketlar (zayavka uchun)
    tickets, addTicket, closeTicket, reopenTicket, deleteTicket,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
