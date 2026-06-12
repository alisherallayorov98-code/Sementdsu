import { createContext, useContext, useState, useEffect } from 'react';

const DataContext = createContext();
export const useData = () => useContext(DataContext);

// LocalStorage yordamchi funksiyalari
const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
};
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

export function DataProvider({ children }) {

  // ── Faol xodim (RBAC) ───────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(() => load('current_user', null));
  useEffect(() => save('current_user', currentUser), [currentUser]);

  // Faol xodimning ismi (Eski kodlar buzilmasligi uchun)
  const currentWorker = currentUser ? currentUser.name : '';

  const login = (name, password) => {
    // Agar umuman ishchi bo'lmasa, birinchi kirgan odam admin bo'ladi
    if (workers.length === 0) {
      const ts = Date.now();
      const newAdmin = { id: ts, createdAt: ts, name, password, role: 'admin', salary: 0, paid: 0, position: 'Boshqaruvchi', phone: '', note: '' };
      setWorkers([newAdmin]);
      setCurrentUser({ id: ts, name, role: 'admin' });
      return true;
    }
    const w = workers.find(x => x.name.toLowerCase() === name.toLowerCase() && String(x.password) === String(password));
    if (w) {
      setCurrentUser({ id: w.id, name: w.name, role: w.role || 'sotuvchi' });
      return true;
    }
    return false;
  };
  const logout = () => setCurrentUser(null);

  // ── Dastur Sozlamalari ──────────────────────────────────────────────────
  const [appSettings, setAppSettings] = useState(() => load('app_settings', {
    appName: 'Sement Biznes Boshqaruvi',
    currency: "so'm",
    themeColor: '#003366',
    tgToken: '',
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
  const totalCashBalance = Number(cashOpening.amount) + cashRows.reduce((s, r) => s + Number(r.amount), 0);
  const addCashRow       = (amount, desc) => {
    const ts = Date.now();
    setCashRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, amount: Number(amount), desc }]);
  };
  const deleteCashRow    = (id) => setCashRows(p => p.filter(r => r.id !== id));

  // ── 3. Bank ───────────────────────────────────────────────────────────────
  const [bankOpening, setBankOpening] = useState(() => load('bank_opening', { date: '25.04.2025', amount: 20000000 }));
  const [bankRows, setBankRows]       = useState(() => load('bank_rows', [
    { id: 1, amount: 5000000, desc: 'asia'     },
    { id: 2, amount: 6000000, desc: 'memor'    },
    { id: 3, amount: 7000000, desc: 'anvarjon' },
  ]));
  useEffect(() => save('bank_opening', bankOpening), [bankOpening]);
  useEffect(() => save('bank_rows',    bankRows),    [bankRows]);
  const totalBankBalance = Number(bankOpening.amount) + bankRows.reduce((s, r) => s + Number(r.amount), 0);
  const addBankRow       = (amount, desc) => {
    const ts = Date.now();
    setBankRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, amount: Number(amount), desc }]);
  };
  const deleteBankRow    = (id) => setBankRows(p => p.filter(r => r.id !== id));

  // ── 4. Click ──────────────────────────────────────────────────────────────
  const [clickOpening, setClickOpening] = useState(() => load('click_opening', { date: '25.04.2025', amount: 5000000 }));
  const [clickRows, setClickRows]       = useState(() => load('click_rows', []));
  useEffect(() => save('click_opening', clickOpening), [clickOpening]);
  useEffect(() => save('click_rows',    clickRows),    [clickRows]);
  const totalClickBalance = Number(clickOpening.amount) + clickRows.reduce((s, r) => s + Number(r.amount), 0);
  const addClickRow       = (amount, desc) => {
    const ts = Date.now();
    setClickRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, amount: Number(amount), desc }]);
  };
  const deleteClickRow    = (id) => setClickRows(p => p.filter(r => r.id !== id));

  // ── 5. Sement qoldig'i ────────────────────────────────────────────────────
  const [cementOpening, setCementOpening] = useState(() => load('cement_opening', { date: '25.04.2025', tons: 0 }));

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
    setRecvRows(p => [...p, {
      id: ts, createdAt: ts, worker: currentWorker,
      date: new Date().toLocaleDateString('ru-RU'),
      source: entry.source || '',
      brand: entry.brand || '',
      vehicleNo: entry.vehicleNo || '',
      tons: entry.tons || 0,
      pricePerTon: entry.pricePerTon || 0,
      paymentChannel: entry.paymentChannel || 'naqd',
      cardName: entry.cardName || '',
      factoryTime: entry.factoryTime || '',
      izoh: entry.izoh || '',
    }]);
  };
  const deleteRecvRow = (id) => setRecvRows(p => p.filter(r => r.id !== id));
  const totalRecvTons = recvRows.reduce((s, r) => s + Number(r.tons || 0), 0);

  // Sement qoldig'i = ochilish + olingan - sotilgan
  const totalCementBalance = Number(cementOpening.tons) + totalRecvTons - totalSoldTons;

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
  const payDebt = (id, payAmount, payNote = '') => {
    const ts = Date.now();
    const amt = Number(payAmount);
    setDebtRows(p => p.map(r => {
      if (r.id !== id) return r;
      const newPayment = {
        id: ts,
        date: new Date().toLocaleDateString('ru-RU'),
        amount: amt,
        note: payNote,
        worker: currentWorker,
      };
      return {
        ...r,
        paid: Number(r.paid) + amt,
        payments: [...(r.payments || []), newPayment],
      };
    }));
  };
  const deleteDebtRow = (id) => setDebtRows(p => p.filter(r => r.id !== id));
  const totalDebts    = debtRows.reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.paid)), 0);
  const totalDebtsPaid = debtRows.reduce((s, r) => s + Number(r.paid), 0);
  const totalDebtsAll  = debtRows.reduce((s, r) => s + Number(r.amount), 0);

  // ── 12. Avanslar ──────────────────────────────────────────────────────────
  const [advanceRows, setAdvanceRows] = useState(() => load('advance_rows', []));
  useEffect(() => save('advance_rows', advanceRows), [advanceRows]);
  const addAdvanceRow = (customer, amount, note = '') => {
    const ts = Date.now();
    setAdvanceRows(p => [...p, {
      id: ts, createdAt: ts, worker: currentWorker,
      date: new Date().toLocaleDateString('ru-RU'),
      customer, amount: Number(amount), used: 0, note,
      usages: [],
    }]);
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
  const deleteAdvanceRow = (id) => setAdvanceRows(p => p.filter(r => r.id !== id));
  const totalAdvances     = advanceRows.reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.used)), 0);
  const totalAdvancesUsed = advanceRows.reduce((s, r) => s + Number(r.used), 0);
  const totalAdvancesAll  = advanceRows.reduce((s, r) => s + Number(r.amount), 0);

  // ── 13. Sotish ────────────────────────────────────────────────────────────
  const [salesRows, setSalesRows] = useState(() => load('sales_rows', []));
  useEffect(() => save('sales_rows', salesRows), [salesRows]);
  const addSaleRow = (entry) => {
    const ts = Date.now();
    setSalesRows(p => [...p, { id: ts, createdAt: ts, worker: currentWorker, date: new Date().toLocaleDateString('ru-RU'), ...entry }]);
  };
  const deleteSaleRow = (id) => setSalesRows(p => p.filter(r => r.id !== id));

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
  // Bank sof balansi = ochilish + kirim − chiqim
  const bankNetBalance = Number(bankOpening.amount) + totalBankIncome - totalBankExpense;

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
  // Click sof balansi = ochilish + kirim − chiqim
  const clickNetBalance = Number(clickOpening.amount) + totalClickIncome - totalClickExpense;

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

  const payWorker = (id, amount, note = '') => {
    const ts = Date.now();
    const num = Number(amount);
    setWorkers(p => p.map(w => w.id === id ? { ...w, paid: Number(w.paid) + num } : w));
    setSalaryPayments(p => [...p, {
      id: ts, createdAt: ts,
      workerId: id,
      amount: num,
      date: new Date().toLocaleDateString('ru-RU'),
      note,
      paidBy: currentWorker,
    }]);
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

  // ── Telegram botdan real vaqtda yangi zakazlarni qabul qilish ──────────
  useEffect(() => {
    if (!appSettings.tgToken) return;

    const fetchBotOrders = async () => {
      try {
        const lastId = load('tg_last_update_id', 0);
        const res = await fetch(`https://api.telegram.org/bot${appSettings.tgToken}/getUpdates?offset=${lastId + 1}&timeout=5`);
        const data = await res.json();
        
        if (data.ok && data.result.length > 0) {
          let maxId = lastId;
          const newOrders = [];

          for (const update of data.result) {
            if (update.update_id > maxId) maxId = update.update_id;
            
            if (update.message && update.message.text) {
              const msg = update.message;
              const text = msg.text;
              
              // Tonnani qidirib topish (birinchi uchragan raqam)
              let tons = 0;
              const match = text.match(/(\d+(?:\.\d+)?)/);
              if (match) tons = Number(match[1]);

              const customerName = msg.from.first_name + (msg.from.last_name ? ' ' + msg.from.last_name : '');
              const ts = Date.now() + newOrders.length; // id unikal bo'lishi uchun
              
              newOrders.push({
                id: ts,
                createdAt: ts,
                worker: 'Telegram Bot',
                date: new Date().toLocaleDateString('ru-RU'),
                customer: customerName,
                tons: tons,
                status: 'kutilmoqda',
                note: text,
              });
            }
          }

          if (newOrders.length > 0) {
            setTgOrders(prev => [...prev, ...newOrders]);
            // Ovozli signal chalinishi
            try { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play(); } catch(e){}
          }
          save('tg_last_update_id', maxId);
        }
      } catch (err) {
        console.error("Telegram bot error:", err);
      }
    };

    const interval = setInterval(fetchBotOrders, 5000); // Har 5 soniyada
    return () => clearInterval(interval);
  }, [appSettings.tgToken]);

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

  // ─────────────────────────────────────────────────────────────────────────
  const value = {
    // Auth & Settings
    currentUser, login, logout, currentWorker,
    appSettings, updateAppSettings,
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
    debtRows, addDebtRow, payDebt, deleteDebtRow, totalDebts, totalDebtsPaid, totalDebtsAll,
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
    customers, addCustomer, updateCustomer, deleteCustomer,
    // Haydovchilar
    drivers, addDriver, updateDriver, deleteDriver,
    driverTrips, addDriverTrip, deleteDriverTrip,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
