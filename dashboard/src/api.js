// ─────────────────────────────────────────────────────────────────────────────
// Backend bilan aloqa qatlami (JWT auth bilan).
// Backend manzili:
//   1) .env'dagi VITE_API_URL bo'lsa — o'sha.
//   2) Aks holda — brauzer ochilgan kompyuter manzili + :5000 (LAN'da ishlaydi).
// Har bir himoyalangan so'rovga Authorization: Bearer <token> qo'shiladi.
// Token muddati tugasa (401) — avtomatik chiqib, login oynasiga qaytadi.
// ─────────────────────────────────────────────────────────────────────────────
const defaultApi =
  typeof window !== 'undefined' && window.location?.hostname
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : 'http://localhost:5000';

const API_URL = (import.meta.env.VITE_API_URL || defaultApi).replace(/\/$/, '');
const TOKEN_KEY = 'auth_token';

const getToken = () => localStorage.getItem(TOKEN_KEY);
const setToken = (t) => { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); };

async function req(path, options = {}, { auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // Token yaroqsiz/muddati tugagan — chiqib, login oynasiga
  if (res.status === 401 && auth) {
    setToken(null);
    if (typeof window !== 'undefined') window.location.reload();
    throw new Error('Avtorizatsiya muddati tugadi');
  }
  if (!res.ok) {
    let msg = `API xatosi (${res.status})`;
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (name, password, account = '') => req('/api/auth/login', { method: 'POST', body: JSON.stringify({ name, password, account }) }, { auth: false }),
  signup: (account, name, password) => req('/api/auth/signup', { method: 'POST', body: JSON.stringify({ account, name, password }) }, { auth: false }),
  getToken,
  setToken,

  // Holat
  getState: () => req('/api/state'),
  // Holatni saqlash. Baza tozalangan bo'lsa server 409 { reload:true } qaytaradi —
  // bunda eski (stale) holatni qayta yozmaymiz, balki sahifani yangilaymiz.
  saveState: async (state) => {
    const token = getToken();
    const res = await fetch(`${API_URL}/api/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(state),
    });
    const body = await res.json().catch(() => null);
    if (res.status === 409 && body?.reload) {
      if (typeof window !== 'undefined') {
        alert('Baza yangilangan (tozalangan). Sahifa yangilanadi.');
        window.location.reload();
      }
      return { ok: false, reload: true };
    }
    if (res.status === 401) { setToken(null); if (typeof window !== 'undefined') window.location.reload(); throw new Error('Avtorizatsiya muddati tugadi'); }
    if (!res.ok) throw new Error(body?.error || `API xatosi (${res.status})`);
    return body;
  },

  // Telegram navbati
  getBotOrders: () => req('/api/new_bot_orders'),
  clearBotOrders: () => req('/api/clear_bot_orders', { method: 'POST' }),

  // Audit / Nazorat jurnali (admin)
  getAudit: (limit = 1000) => req(`/api/audit?limit=${limit}`),

  // Server holati / resurslar (admin)
  getSystem: () => req('/api/system'),

  // Bildirishnoma (Telegram / SMS)
  getTgContacts: () => req('/api/tg_contacts'),
  notify: (payload) => req('/api/notify', { method: 'POST', body: JSON.stringify(payload) }),
  notifySale: (payload) => req('/api/notify_sale', { method: 'POST', body: JSON.stringify(payload) }),
  notifyOrderDone: (payload) => req('/api/notify_order_done', { method: 'POST', body: JSON.stringify(payload) }),

  health: () => req('/api/health', {}, { auth: false }),

  // Haydovchi pending reyslari
  getPendingDriverTrips: () => req('/api/driver_trips/pending'),
  approveDriverTrip: (id) => req(`/api/driver_trips/approve/${id}`, { method: 'POST' }),
  rejectDriverTrip:  (id, reason = '') => req(`/api/driver_trips/reject/${id}`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getDriverPhotoUrl: (fileId) => req(`/api/driver_trips/photo_url/${encodeURIComponent(fileId)}`),

  // Zayavka bot
  getZayavkaConfig: () => req('/api/zayavka_config'),
  saveZayavkaConfig: (cfg) => req('/api/zayavka_config', { method: 'PUT', body: JSON.stringify(cfg) }),
  getZayavkaLog: (limit = 50) => req(`/api/zayavka_log?limit=${limit}`),
  getTicketLog: (ticketId) => req(`/api/ticket_log/${encodeURIComponent(ticketId)}`),
  regenerateInvite: (revokeUsers = false) => req('/api/zayavka_config/regenerate_invite', { method: 'POST', body: JSON.stringify({ revokeUsers }) }),
  getBotInfo: () => req('/api/bot_info'),
  notifyDriverPayment: (driverName, amount, channel) =>
    req('/api/driver_payment_notify', { method: 'POST', body: JSON.stringify({ driverName, amount, channel }) }),
  notifyCustomerSale: (customerName, kg, cementType, pricePerKg, channel, totalDebt, tons, pricePerTon) =>
    req('/api/notify_customer_sale', { method: 'POST', body: JSON.stringify({ customerName, kg, cementType, pricePerKg, channel, totalDebt, tons, pricePerTon }) }),
  notifyCustomerPayment: (customerName, amount, channel, totalDebt, isEdit = false) =>
    req('/api/notify_customer_payment', { method: 'POST', body: JSON.stringify({ customerName, amount, channel, totalDebt, isEdit }) }),
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPERADMIN API (sayt egasi)
//
// Tokeni ALOHIDA kalitda saqlanadi (sa_token). Tashkilot tokeni bilan
// aralashtirilmaydi: superadmin panelidan chiqish tashkilot seansiga ta'sir
// qilmaydi va aksincha. 401 da sahifa qayta yuklanmaydi — panel o'zi
// kirish oynasini ko'rsatadi.
// ─────────────────────────────────────────────────────────────────────────────
const SA_TOKEN_KEY = 'sa_token';
const saGetToken = () => localStorage.getItem(SA_TOKEN_KEY);
const saSetToken = (t) => { if (t) localStorage.setItem(SA_TOKEN_KEY, t); else localStorage.removeItem(SA_TOKEN_KEY); };

async function saReq(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = saGetToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  let body = null;
  try { body = await res.json(); } catch { /* bo'sh javob */ }
  if (!res.ok) {
    const err = new Error(body?.error || `Xatolik (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body;
}

export const saApi = {
  getToken: saGetToken,
  setToken: saSetToken,
  login: (name, password) =>
    saReq('/api/sa/login', { method: 'POST', body: JSON.stringify({ name, password }) }),
  me: () => saReq('/api/sa/me'),
  listAccounts: () => saReq('/api/sa/accounts'),
  createAccount: (account, adminName, password) =>
    saReq('/api/sa/accounts', { method: 'POST', body: JSON.stringify({ account, adminName, password }) }),
  setAccountPassword: (acc, workerName, password) =>
    saReq(`/api/sa/accounts/${encodeURIComponent(acc)}/password`, { method: 'POST', body: JSON.stringify({ workerName, password }) }),
  setStatus: (acc, disabled) =>
    saReq(`/api/sa/accounts/${encodeURIComponent(acc)}/status`, { method: 'POST', body: JSON.stringify({ disabled }) }),
  wipeAccount: (acc, resetKey, opts = {}) =>
    saReq(`/api/sa/accounts/${encodeURIComponent(acc)}/wipe`, { method: 'POST', body: JSON.stringify({ resetKey, ...opts }) }),
  deleteAccount: (acc, resetKey) =>
    saReq(`/api/sa/accounts/${encodeURIComponent(acc)}/delete`, { method: 'POST', body: JSON.stringify({ resetKey }) }),
  changePassword: (current, next) =>
    saReq('/api/sa/password', { method: 'POST', body: JSON.stringify({ current, next }) }),
  changeResetKey: (password, next) =>
    saReq('/api/sa/reset-key', { method: 'POST', body: JSON.stringify({ password, next }) }),
};

export { API_URL };
