// ─────────────────────────────────────────────────────────────────────────────
// Backend bilan aloqa qatlami.
// Backend manzili .env (VITE_API_URL) orqali sozlanadi, aks holda localhost:5000.
// ─────────────────────────────────────────────────────────────────────────────
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

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
