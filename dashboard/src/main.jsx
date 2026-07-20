import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { DataProvider } from './context/DataContext.jsx';
import App from './App.jsx';
import SuperAdmin from './pages/SuperAdmin.jsx';
import './index.css';

// ─────────────────────────────────────────────────────────────────────────────
// /sa — SUPERADMIN PANELI.
//
// U DataProvider'dan TASHQARIDA render qilinadi. Sabab:
//   1) DataProvider ochilishi bilan tashkilot holatini serverdan yuklab,
//      localStorage'ga yozadi va har o'zgarishda saqlab turadi. Superadminga
//      bu ma'lumot kerak emas va unga tegishi ham noto'g'ri.
//   2) Ajratilgani uchun tashkilot seansi bilan aralashmaydi: superadmin
//      panelidan chiqish xodimning ochiq seansiga ta'sir qilmaydi.
//
// Marshrutizator ham kerak emas — panel bitta sahifadan iborat.
// ─────────────────────────────────────────────────────────────────────────────
const isSuperAdminRoute = window.location.pathname.replace(/\/+$/, '') === '/sa';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isSuperAdminRoute ? (
      <SuperAdmin />
    ) : (
      <DataProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </DataProvider>
    )}
  </React.StrictMode>,
);
