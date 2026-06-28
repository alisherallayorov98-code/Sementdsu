import { useState } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useData } from './context/DataContext';
import GlobalSearch from './components/GlobalSearch';

// Pages
import Login         from './pages/Login';
import Settings      from './pages/Settings';
import Dashboard     from './pages/Dashboard';
import Reports       from './pages/Reports';
import Audit         from './pages/Audit';
import ServerStatus  from './pages/ServerStatus';
import Monitoring    from './pages/Monitoring';
import Distribution  from './pages/Distribution';
import MapPage       from './pages/MapPage';

import UmumiyMalumot from './pages/UmumiyMalumot';
import Income        from './pages/Income';
import Expense       from './pages/Expense';
import SoldTons      from './pages/SoldTons';
import RecvTons      from './pages/RecvTons';
import Debts         from './pages/Debts';
import Advances      from './pages/Advances';
import IncomeBank    from './pages/IncomeBank';
import IncomeClick   from './pages/IncomeClick';
import WorkerSalary  from './pages/WorkerSalary';
import TelegramOrder from './pages/TelegramOrder';
import OverallReport from './pages/OverallReport';
import Customers     from './pages/Customers';
import DayBalance    from './pages/DayBalance';
import Kassir       from './pages/Kassir';
import Tiketlar     from './pages/Tiketlar';

// ─── Menyu ro'yxati ──────────────────────────────────────────────────────────
const FULL_MENU = [
  { path: '/',               latn: "🏠 Bosh sahifa",        cyrl: "🏠 Бош саҳифа",        roles: ['admin', 'sotuvchi', 'omborchi'] },
  { path: '/gen_info',       latn: "📊 Umumiy ma'lumot",     cyrl: "📊 Умумий маълумот",    roles: ['admin', 'sotuvchi', 'omborchi'] },
  { path: '/sold_tons',      latn: "Sotilgan tonna (Eski)", cyrl: "Сотилган тонна (Эски)",roles: ['admin'] },
  { path: '/recv_tons',      latn: "Olingan tonna",         cyrl: "Олинган тонна",        roles: ['admin', 'omborchi'] },
  { path: '/debts',          latn: "Qarzlar",               cyrl: "Қарзлар",              roles: ['admin', 'sotuvchi'] },
  { path: '/kassir',         latn: "💼 Kassir",             cyrl: "💼 Кассир",             roles: ['admin', 'sotuvchi', 'kassir'] },
  { path: '/tiketlar',       latn: "🎫 Tiketlar",             cyrl: "🎫 Тикетлар",            roles: ['admin', 'sotuvchi'] },
  { path: '/distribution',   latn: "🚛 Yuk taqsimlash",      cyrl: "🚛 Юк тақсимлаш",       roles: ['admin', 'sotuvchi', 'omborchi'] },
  { path: '/income_bank',    latn: "Kirim/Chiqim (Bank)",   cyrl: "Кирим/Чиқим (Банк)",   roles: ['admin', 'sotuvchi'] },
  { path: '/income_click',   latn: "Kirim/Chiqim (Click)",  cyrl: "Кирим/Чиқим (Клик)",   roles: ['admin', 'sotuvchi'] },
  { path: '/worker_salary',  latn: "Ishchilar oyligi",      cyrl: "Ишчилар ойлиги",       roles: ['admin'] },
  { path: '/tg_order',       latn: "Telegram zakaz tonna",  cyrl: "Телеграм заказ тонна", roles: ['admin', 'sotuvchi'] },
  { path: '/reports',        latn: "📊 Hisobotlar",          cyrl: "📊 Ҳисоботлар",         roles: ['admin'] },
  { path: '/overall_report', latn: "Hammasidan hisobot",    cyrl: "Ҳаммасидан ҳисобот",   roles: ['admin'] },
  { path: '/customers',      latn: "Mijozlar bazasi",       cyrl: "Мижозлар базаси",      roles: ['admin', 'sotuvchi'] },
  { path: '/monitoring',     latn: "🔔 Mijoz nazorati",      cyrl: "🔔 Мижоз назорати",     roles: ['admin', 'sotuvchi'] },
  { path: '/map',            latn: "🗺 Xarita",              cyrl: "🗺 Харита",             roles: ['admin', 'sotuvchi', 'omborchi'] },
  { path: '/day_balance',    latn: "Sana bo'yicha qoldiq",  cyrl: "Сана бўйича қолдиқ",   roles: ['admin', 'sotuvchi'] },
  { path: '/audit',          latn: "🔒 Nazorat (Audit)",     cyrl: "🔒 Назорат (Аудит)",    roles: ['admin'] },
  { path: '/server',         latn: "🖥 Server holati",       cyrl: "🖥 Сервер ҳолати",      roles: ['admin'] },
  { path: '/settings',       latn: "Sozlamalar (Admin)",    cyrl: "Созламалар (Админ)",   roles: ['admin'] },
];

function App() {
  const [lang, setLang] = useState('latn');
  const location = useLocation();
  const { currentUser, token, logout, appSettings, backendOnline } = useData();

  // Token (yoki foydalanuvchi) bo'lmasa — kirish oynasi
  if (!currentUser || !token) {
    return <Login lang={lang} />;
  }

  // Rollarga qarab menyuni filtrlash.
  // "kassir" — sotuvchi bilan bir xil ko'rinishga ega (kassa, savdo, ombor).
  const effectiveRole = currentUser.role === 'kassir' ? 'sotuvchi' : currentUser.role;
  const myMenu = FULL_MENU.filter(m => m.roles.includes(effectiveRole));

  const currentItem = myMenu.find(item => item.path === location.pathname);
  const pageTitle   = currentItem ? currentItem[lang] : "Xush Kelibsiz";

  return (
    <>
      <div className="header" style={{ background: appSettings.themeColor || '#003366', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <h1 style={{ whiteSpace: 'nowrap' }}>{appSettings.appName}</h1>

        {/* Umumiy qidiruv */}
        <GlobalSearch />

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Kesh tozalash (Ctrl+Shift+R) */}
          <button
            onClick={() => { window.location.reload(true); }}
            title="Sahifani yangilash — keshni tozalab qayta yuklash (Ctrl+Shift+R)"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            🔄 <span style={{ fontSize: 10, opacity: 0.85 }}>Ctrl+Shift+R</span>
          </button>

          {/* Server bilan aloqa holati */}
          {!backendOnline && (
            <div title="Server bilan aloqa yo'q. O'zgarishlar vaqtincha faqat shu qurilmada saqlanmoqda." style={{ color: '#fff', fontSize: 12, background: '#c62828', padding: '4px 10px', borderRadius: 12, fontWeight: 'bold' }}>
              ⚠ Server o'chiq
            </div>
          )}
          {/* Xodim profili */}
          <div style={{ color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.2)', padding: '4px 12px', borderRadius: 16 }}>
            <span style={{ fontSize: 16 }}>👤</span>
            <span style={{ fontWeight: 'bold' }}>{currentUser.name}</span>
            <span style={{ opacity: 0.8, fontSize: 11, background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: 4 }}>
              {currentUser.role.toUpperCase()}
            </span>
            <button onClick={logout} style={{ background: 'transparent', border: 'none', color: '#ffcdd2', cursor: 'pointer', marginLeft: 8, fontWeight: 'bold' }}>
              Chiqish
            </button>
          </div>

          <div className="lang-switch">
            <button className={lang === 'latn' ? 'active' : ''} onClick={() => setLang('latn')}>Lotin</button>
            <button className={lang === 'cyrl' ? 'active' : ''} onClick={() => setLang('cyrl')}>Кирилл</button>
          </div>
        </div>
      </div>

      <div className="container">
        {/* ── Sidebar ── */}
        <div className="sidebar">
          <div className="menu-header">Bo'limlar</div>
          <ul className="menu-list">
            {myMenu.map((item, idx) => (
              <li key={item.path} className={location.pathname === item.path ? 'active' : ''}>
                <NavLink to={item.path} end={item.path === '/'}>{idx + 1}. {item[lang]}</NavLink>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Asosiy kontent ── */}
        <div className="main-content">
          <div className="content-header"><h2>{pageTitle}</h2></div>
          <div className="content-body">
            <Routes>
              <Route path="/"               element={<Dashboard />} />
              <Route path="/gen_info"       element={<UmumiyMalumot  lang={lang} />} />
              <Route path="/income"         element={<Income         lang={lang} />} />
              <Route path="/expense"        element={<Expense        lang={lang} />} />
              <Route path="/sold_tons"      element={<SoldTons       lang={lang} />} />
              <Route path="/recv_tons"      element={<RecvTons       lang={lang} />} />
              <Route path="/debts"          element={<Debts          lang={lang} />} />
              <Route path="/advances"       element={<Advances       lang={lang} />} />
              <Route path="/kassir"         element={<Kassir         lang={lang} />} />
              <Route path="/tiketlar"       element={<Tiketlar />} />
              <Route path="/distribution"   element={<Distribution />} />
              <Route path="/income_bank"    element={<IncomeBank     lang={lang} />} />
              <Route path="/income_click"   element={<IncomeClick    lang={lang} />} />
              <Route path="/worker_salary"  element={<WorkerSalary   lang={lang} />} />
              <Route path="/tg_order"       element={<TelegramOrder  lang={lang} />} />
              <Route path="/reports"        element={<Reports />} />
              <Route path="/overall_report" element={<OverallReport  lang={lang} />} />
              <Route path="/customers"      element={<Customers      lang={lang} />} />
              <Route path="/monitoring"     element={<Monitoring />} />
              <Route path="/map"            element={<MapPage />} />
              <Route path="/day_balance"    element={<DayBalance     lang={lang} />} />
              <Route path="/audit"          element={<Audit />} />
              <Route path="/server"         element={<ServerStatus />} />
              <Route path="/settings"       element={<Settings       lang={lang} />} />
            </Routes>
          </div>
        </div>
      </div>
    </>
  );
}
export default App;
