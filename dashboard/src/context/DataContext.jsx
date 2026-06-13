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
  const login = async (name, password) => {
    try {
      const res = await api.login(name, password);
      if (!res?.token) return false;
      api.setToken(res.token);
      setTokenState(res.token);
      setCurrentUser(res.user);
      return true;
    } catch {
      return false;
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
  }));
  useEffect(() => save('app_settings', appSettings), [appSettings]);
  const updateAppSettings = (data) => setAppSettings(p => ({ ...p, ...data }));


  // ── 2. Naqd pul ──────────────────────────────────────────────────────────
  const [cashOpening, setCashOpening] = useState(() => load('cash_opening', { date: '25.04.2025', amount: 20000000 }));
  const [cashRows, setCashRows]       = useState(() => load('cash_rows', [
    { id: 1, amount: 5000000,  desc: 'botir aka'          },
    { id: 2, amount: 6000000,  desc: 'alisher aka'        },
    { id: 3, amount: 7000000,  desc: 'ganisher aka'       },
    { id: 4, amount: 8000000,  desc: 'sharofidin'         },
    { id: 5, amount: 500000,   desc: 'salox'              },
    { id: 6, amount: 200000,   desc: 'qosim'              },
    { id: 7, amount: 700000,   desc: '1-tn sement qoplik' },
    { id: 8, amount: 250000,   desc: '500-kg sement rosqp'},
  ]));
  useEffect(() => save('cash_opening', cashOpening), [cashOpening]);
  useEffect(() => save('cash_rows',    cashRows),    [cashRows]);
  const _cashRowsSum = cashRows.reduce((s, r) => s + Number(r.amount), 0);
  const addCashRow   = (amount, desc) => {
    const ts = Date.now();
    setCashRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, amount: Number(amount), desc }]);
  };
  const deleteCashRow    = (id) => setCashRows(p => guardAutoDelete(p, id));

  // ── 3. Bank ───────────────────────────────────────────────────────────────
  const [bankOpening, setBankOpening] = useState(() => load('bank_opening', { date: '25.04.2025', amount: 20000000 }));
  const [bankRows, setBankRows]       = useState(() => load('bank_rows', [
    { id: 1, amount: 5000000, desc: 'asia'     },
    { id: 2, amount: 6000000, desc: 'memor'    },
    { id: 3, amount: 7000000, desc: 'anvarjon' },
  ]));
  useEffect(() => save('bank_opening', bankOpening), [bankOpening]);
  useEffect(() => save('bank_rows',    bankRows),    [bankRows]);
  const _bankRowsSum = bankRows.reduce((s, r) => s + Number(r.amount), 0);
  const addBankRow   = (amount, desc) => {
    const ts = Date.now();
    setBankRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, amount: Number(amount), desc }]);
  };
  const deleteBankRow    = (id) => setBankRows(p => guardAutoDelete(p, id));

  // ── 4. Click ──────────────────────────────────────────────────────────────
  const [clickOpening, setClickOpening] = useState(() => load('click_opening', { date: '25.04.2025', amount: 5000000 }));
  const [clickRows, setClickRows]       = useState(() => load('click_rows', []));
  useEffect(() => save('click_opening', clickOpening), [clickOpening]);
  useEffect(() => save('click_rows',    clickRows),    [clickRows]);
  const _clickRowsSum = clickRows.reduce((s, r) => s + Number(r.amount), 0);
  const addClickRow   = (amount, desc) => {
    const ts = Date.now();
    setClickRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, amount: Number(amount), desc }]);
  };
  const deleteClickRow    = (id) => setClickRows(p => guardAutoDelete(p, id));

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
  // To'liq Naqd balansi = ochilish + cashRows (auto+manual) + incomeRows − expenseRows
  const totalCashBalance = Number(cashOpening.amount) + _cashRowsSum
    + incomeRows.reduce((s, r)  => s + Number(r.amount || 0), 0)
    - expenseRows.reduce((s, r) => s + Number(r.amount || 0), 0);

  // ── 9. Sotilgan tonna ─────────────────────────────────────────────────────
  const [soldRows, setSoldRows] = useState(() => load('sold_rows', []));
  useEffect(() => save('sold_rows', soldRows), [soldRows]);
  const addSoldRow = (entry) => {
    const ts = Date.now();
    setSoldRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date: new Date().toLocaleDateString('ru-RU'), ...entry }]);
  };
  const deleteSoldRow = (id) => setSoldRows(p => p.filter(r => r.id !== id));
  const totalSoldTons = soldRows.reduce((s, r) => s + Number(r.tons || 0), 0);

  // ── 10. Olingan tonna ─────────────────────────────────────────────────────
  const [recvRows, setRecvRows] = useState(() => load('recv_rows', []));
  useEffect(() => save('recv_rows', recvRows), [recvRows]);
  const addRecvRow = (entry) => {
    const ts = Date.now();
    const today = new Date().toLocaleDateString('ru-RU');
    const row = {
      id: ts, createdAt: ts, worker: currentWorker, date: today,
      source: entry.source || '', brand: entry.brand || '',
      vehicleNo: entry.vehicleNo || '', tons: entry.tons || 0,
      pricePerTon: entry.pricePerTon || 0,
      paymentChannel: entry.paymentChannel || 'naqd',
      cardName: entry.cardName || '', factoryTime: entry.factoryTime || '',
      izoh: entry.izoh || '',
    };
    setRecvRows(p => [...p, row]);

    // ── INTEGRATSIYA: sement olish → tegishli kassadan chiqim ──────────────
    const sum = Number(row.tons || 0) * Number(row.pricePerTon || 0);
    if (sum > 0) {
      const tag  = `🔗 Sement olish: ${row.source || ''} (${fmtTons(row.tons)} tn)`;
      const link = { auto: true, sourceType: 'recv', sourceId: ts, createdAt: ts, worker: currentWorker, date: today };
      const channel = row.paymentChannel || 'naqd';
      // Manfiy summa → kassadan chiqim
      if      (channel === 'naqd')  setCashRows(p  => [...p, { ...link, id: ts + 2, amount: -sum, desc: tag }]);
      else if (channel === 'bank')  setBankRows(p  => [...p, { ...link, id: ts + 2, amount: -sum, desc: tag }]);
      else if (channel === 'click') setClickRows(p => [...p, { ...link, id: ts + 2, amount: -sum, desc: tag }]);
    }
  };
  const deleteRecvRow = (id) => {
    setRecvRows(p => p.filter(r => r.id !== id));
    // Cascade: shu yetkazmadan yaratilgan chiqim yozuvini ham o'chirish
    setCashRows(p  => p.filter(r => r.sourceId !== id));
    setBankRows(p  => p.filter(r => r.sourceId !== id));
    setClickRows(p => p.filter(r => r.sourceId !== id));
  };
  const totalRecvTons = recvRows.reduce((s, r) => s + Number(r.tons || 0), 0);

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
      const link = { auto: true, sourceType: 'advance', sourceId: ts, createdAt: ts, worker: currentWorker, date: today };
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

  // ── 13. Sotish ────────────────────────────────────────────────────────────
  const [salesRows, setSalesRows] = useState(() => load('sales_rows', []));
  useEffect(() => save('sales_rows', salesRows), [salesRows]);
  const addSaleRow = (entry) => {
    const ts = Date.now();
    const sale = { id: ts, createdAt: ts, worker: currentWorker, date: new Date().toLocaleDateString('ru-RU'), ...entry };
    setSalesRows(p => [...p, sale]);

    // ── INTEGRATSIYA: savdo → tegishli bo'limga avtomatik yozuv ─────────────
    // Pul/qarz/qoldiq shu orqali yangilanadi. Avtomatik yozuvlar belgilanadi
    // (auto:true, sourceId) va faqat shu savdo o'chirilganda o'chiriladi.
    const sum = Number(sale.tons || 0) * Number(sale.pricePerTon || 0);
    if (sum > 0) {
      const tag  = `🔗 Sotuv: ${sale.customer} (${fmtTons(sale.tons)} tn)`;
      const link = { auto: true, sourceType: 'sale', sourceId: ts, createdAt: ts, worker: currentWorker, date: sale.date };
      const channel = sale.paymentChannel || 'naqd';
      if (channel === 'naqd')        setCashRows(p  => [...p, { ...link, id: ts + 1, amount: sum, desc: tag }]);
      else if (channel === 'bank')   setBankRows(p  => [...p, { ...link, id: ts + 1, amount: sum, desc: tag }]);
      else if (channel === 'click')  setClickRows(p => [...p, { ...link, id: ts + 1, amount: sum, desc: tag }]);
      else if (channel === 'nasiya') setDebtRows(p  => [...p, { ...link, id: ts + 1, customer: sale.customer, amount: sum, paid: 0, note: tag, payments: [] }]);
    }
  };
  // Savdo o'chsa — u yaratgan barcha avtomatik yozuvlar ham o'chadi
  const deleteSaleRow = (id) => {
    setSalesRows(p  => p.filter(r => r.id !== id));
    setCashRows(p   => p.filter(r => r.sourceId !== id));
    setBankRows(p   => p.filter(r => r.sourceId !== id));
    setClickRows(p  => p.filter(r => r.sourceId !== id));
    setDebtRows(p   => p.filter(r => r.sourceId !== id));
  };
  const totalSalesTons = salesRows.reduce((s, r) => s + Number(r.tons || 0), 0);
  // Sement qoldig'i = ochilish + olingan − (eski sotilgan + yangi sotuv)
  const totalCementBalance = Number(cementOpening.tons) + totalRecvTons - totalSoldTons - totalSalesTons;

  const [bankIncomeRows, setBankIncomeRows] = useState(() => load('bank_income_rows', []));
  useEffect(() => save('bank_income_rows', bankIncomeRows), [bankIncomeRows]);
  const addBankIncomeRow = (amount, desc, date = new Date().toLocaleDateString('ru-RU')) => {
    const ts = Date.now();
    setBankIncomeRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date, amount: Number(amount), desc }]);
  };
  const deleteBankIncomeRow = (id) => setBankIncomeRows(p => p.filter(r => r.id !== id));
  const totalBankIncome = bankIncomeRows.reduce((s, r) => s + Number(r.amount || 0), 0);

  // ── 14b. Chiqim bank ─────────────────────────────────────────────────────
  const [bankExpenseRows, setBankExpenseRows] = useState(() => load('bank_expense_rows', []));
  useEffect(() => save('bank_expense_rows', bankExpenseRows), [bankExpenseRows]);
  const addBankExpenseRow = (amount, desc, date = new Date().toLocaleDateString('ru-RU')) => {
    const ts = Date.now();
    setBankExpenseRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date, amount: Number(amount), desc }]);
  };
  const deleteBankExpenseRow = (id) => setBankExpenseRows(p => p.filter(r => r.id !== id));
  const totalBankExpense = bankExpenseRows.reduce((s, r) => s + Number(r.amount || 0), 0);
  // Bank sof balansi (faqat Kirim/Chiqim Bank sahifasi uchun)
  const bankNetBalance   = Number(bankOpening.amount) + totalBankIncome - totalBankExpense;
  // To'liq Bank balansi = ochilish + bankRows (auto+manual) + bankIncomeRows − bankExpenseRows
  const totalBankBalance = Number(bankOpening.amount) + _bankRowsSum + totalBankIncome - totalBankExpense;

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
  // To'liq Click balansi = ochilish + clickRows (auto+manual) + clickIncomeRows − clickExpenseRows
  const totalClickBalance = Number(clickOpening.amount) + _clickRowsSum + totalClickIncome - totalClickExpense;

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
      role:     opts.role     || 'sotuvchi', // admin, sotuvchi, omborchi
      password: opts.password || '1234',     // Standart parol
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

  const addTgOrder = (customer, tons, note = '') => {
    const ts = Date.now();
    setTgOrders(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date: new Date().toLocaleDateString('ru-RU'), customer, tons: Number(tons), status: 'kutilmoqda', note }]);
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
  const addCustomer = ({ name, address, phone, note = '' }) => {
    const ts = Date.now();
    setCustomers(p => [...p, {
      id: ts, createdAt: ts, worker: currentWorker,
      name: name.trim(), address: address.trim(), phone: phone.trim(), note,
    }]);
  };
  const updateCustomer = (id, data) => setCustomers(p => p.map(c => c.id === id ? { ...c, ...data } : c));
  const deleteCustomer = (id) => setCustomers(p => p.filter(c => c.id !== id));
  // Excel'dan ko'plab mijoz import qilish (unikal id bilan)
  const importCustomers = (rows) => {
    const base = Date.now();
    setCustomers(p => [...p, ...rows.map((r, i) => ({
      id: base + i, createdAt: base + i, worker: currentWorker,
      name: (r.name || '').trim(), address: (r.address || '').trim(),
      phone: (r.phone || '').trim(), note: r.note || '',
    }))]);
  };

  // ── 18. Haydovchilar va Qatnovlar ─────────────────────────────────────────
  const [drivers, setDrivers] = useState(() => load('drivers', []));
  const [driverTrips, setDriverTrips] = useState(() => load('driver_trips', []));
  useEffect(() => save('drivers', drivers), [drivers]);
  useEffect(() => save('driver_trips', driverTrips), [driverTrips]);

  const addDriver = (name, carNumber, phone = '') => {
    const ts = Date.now();
    setDrivers(p => [...p, { id: ts, name, carNumber, phone }]);
  };
  const updateDriver = (id, data) => setDrivers(p => p.map(d => d.id === id ? { ...d, ...data } : d));
  const deleteDriver = (id) => {
    setDrivers(p => p.filter(d => d.id !== id));
    setDriverTrips(p => p.filter(t => t.driverId !== id)); // haydovchi o'chsa qatnovlari ham o'chadi
  };

  const addDriverTrip = (driverId, destination, price, isPayment = false, note = '') => {
    const ts = Date.now();
    setDriverTrips(p => [...p, {
      id: ts, createdAt: ts, driverId,
      date: new Date().toLocaleDateString('ru-RU'),
      destination, price: Number(price), isPayment, note
    }]);
  };
  const deleteDriverTrip = (id) => setDriverTrips(p => p.filter(t => t.id !== id));

  // ═══════════════════════════════════════════════════════════════════════════
  // BACKEND SINXRONIZATSIYASI
  // ═══════════════════════════════════════════════════════════════════════════
  const [backendOnline, setBackendOnline] = useState(true);
  const hydratedRef = useRef(false); // backenddan yuklanmaguncha saqlamaymiz
  const saveTimer   = useRef(null);

  // Serverga sinxronlanadigan barcha bo'limlar (sessiya — currentUser — bunda yo'q)
  const STATE_SETTERS = {
    app_settings:       setAppSettings,
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
    bank_income_rows:   setBankIncomeRows,
    bank_expense_rows:  setBankExpenseRows,
    click_income_rows:  setClickIncomeRows,
    click_expense_rows: setClickExpenseRows,
    workers:            setWorkers,
    salary_payments:    setSalaryPayments,
    tg_orders:          setTgOrders,
    daily_work_rows:    setDailyWorkRows,
    customers:          setCustomers,
    drivers:            setDrivers,
    driver_trips:       setDriverTrips,
  };

  // Holatning joriy "suratini" yig'ish (serverga shu jo'natiladi)
  const snapshot = {
    app_settings:       appSettings,
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
    bank_income_rows:   bankIncomeRows,
    bank_expense_rows:  bankExpenseRows,
    click_income_rows:  clickIncomeRows,
    click_expense_rows: clickExpenseRows,
    workers:            workers,
    salary_payments:    salaryPayments,
    tg_orders:          tgOrders,
    daily_work_rows:    dailyWorkRows,
    customers:          customers,
    drivers:            drivers,
    driver_trips:       driverTrips,
  };

  // 1) Tizimga kirilgach (token bor) — serverdan butun holatni yuklab olish
  useEffect(() => {
    if (!token) { hydratedRef.current = false; return; }
    let cancelled = false;
    (async () => {
      try {
        const remote = await api.getState();
        if (!cancelled && remote && typeof remote === 'object' && Object.keys(remote).length) {
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
    salesRows, bankIncomeRows, bankExpenseRows, clickIncomeRows, clickExpenseRows,
    workers, salaryPayments, tgOrders, dailyWorkRows, customers, drivers, driverTrips,
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
          if (added) {
            try { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play(); } catch { /* ovoz ixtiyoriy */ }
          }
          await api.clearBotOrders();
        }
      } catch { /* backend o'chiq bo'lishi mumkin — keyingi urinishda */ }
    };
    poll();
    const interval = setInterval(poll, 5000); // har 5 soniyada
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ─────────────────────────────────────────────────────────────────────────
  const value = {
    // Auth & Settings
    currentUser, token, login, logout, currentWorker, setCurrentWorker,
    appSettings, updateAppSettings,
    backendOnline,
    // 2. Naqd pul
    cashOpening, setCashOpening, cashRows, totalCashBalance, addCashRow, deleteCashRow,
    // 3. Bank
    bankOpening, setBankOpening, bankRows, totalBankBalance, addBankRow, deleteBankRow,
    // 4. Click
    clickOpening, setClickOpening, clickRows, totalClickBalance, addClickRow, deleteClickRow,
    // 5. Sement
    cementOpening, setCementOpening, totalCementBalance, totalSoldTons, totalRecvTons,
    // 7. Kirim
    incomeRows, addIncomeRow, deleteIncomeRow,
    // 8. Chiqim
    expenseRows, addExpenseRow, deleteExpenseRow,
    // 9. Sotilgan tonna
    soldRows, addSoldRow, deleteSoldRow,
    // 10. Olingan tonna
    recvRows, addRecvRow, deleteRecvRow,
    // 11. Qarzlar
    debtRows, addDebtRow, payDebt, deleteDebtRow, importDebts, totalDebts, totalDebtsPaid, totalDebtsAll,
    // 12. Avanslar
    advanceRows, addAdvanceRow, useAdvance, deleteAdvanceRow, totalAdvances, totalAdvancesUsed, totalAdvancesAll,
    // 13. Sotish
    salesRows, addSaleRow, deleteSaleRow,
    // 14. Kirim bank + Chiqim bank
    bankIncomeRows, addBankIncomeRow, deleteBankIncomeRow, totalBankIncome,
    bankExpenseRows, addBankExpenseRow, deleteBankExpenseRow, totalBankExpense,
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
    customers, addCustomer, updateCustomer, deleteCustomer, importCustomers,
    // Haydovchilar
    drivers, addDriver, updateDriver, deleteDriver,
    driverTrips, addDriverTrip, deleteDriverTrip,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
