// ─────────────────────────────────────────────────────────────────────────────
// Backend bilan aloqa qatlami.
// Backend manzili:
//   1) Agar .env'da VITE_API_URL ko'rsatilgan bo'lsa — o'sha.
//   2) Aks holda — brauzer ochilgan kompyuterning IP/manzili + :5000.
//      Shu tufayli boshqa kompyuterdan http://192.168.x.x:5173 ochilsa,
//      server ham avtomatik http://192.168.x.x:5000 deb topiladi (LAN'da ishlaydi).
// ─────────────────────────────────────────────────────────────────────────────
const defaultApi =
  typeof window !== 'undefined' && window.location?.hostname
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : 'http://localhost:5000';

const API_URL = (import.meta.env.VITE_API_URL || defaultApi).replace(/\/$/, '');

async function req(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${path} -> ${res.status}`);
  return res.json();
}

export const api = {
  // Butun dastur holatini olish
  getState: () => req('/api/state'),

  // Butun dastur holatini saqlash
  saveState: (state) => req('/api/state', {
    method: 'PUT',
    body: JSON.stringify(state),
  }),

  // Telegram botiga tushgan yangi zakazlar
  getBotOrders: () => req('/api/new_bot_orders'),

  // Navbatni tozalash (zakazlar qabul qilingach)
  clearBotOrders: () => req('/api/clear_bot_orders', { method: 'POST' }),

  health: () => req('/api/health'),
};

export { API_URL };
