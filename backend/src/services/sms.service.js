// ─────────────────────────────────────────────────────────────────────────────
// SMS xizmati — Eskiz.uz (O'zbekiston). Sozlamalar .env'da:
//   ESKIZ_EMAIL, ESKIZ_PASSWORD, ESKIZ_FROM (tasdiqlangan nick yoki '4546')
// Token xotirada saqlanadi, 401 bo'lsa qayta login qilinadi.
// Sozlanmagan bo'lsa — xato qaytaradi (qolgan tizim normal ishlayveradi).
// ─────────────────────────────────────────────────────────────────────────────
const { ESKIZ_EMAIL, ESKIZ_PASSWORD, ESKIZ_FROM, ESKIZ_BASE } = require('../config');

let token = null;

const isConfigured = () => Boolean(ESKIZ_EMAIL && ESKIZ_PASSWORD);

// Telefonni 998XXXXXXXXX ko'rinishiga keltirish
function normMobile(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 9) d = '998' + d;            // 901234567 → 998901234567
  if (d.length === 12 && d.startsWith('998')) return d;
  return d; // boshqa davlat — bor holicha
}

async function login() {
  const res = await fetch(`${ESKIZ_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ESKIZ_EMAIL, password: ESKIZ_PASSWORD }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j?.data?.token) {
    throw new Error('Eskiz login muvaffaqiyatsiz: ' + (j?.message || res.status));
  }
  token = j.data.token;
  return token;
}

async function sendOnce(mobile, message) {
  const res = await fetch(`${ESKIZ_BASE}/message/sms/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mobile_phone: mobile, message, from: ESKIZ_FROM }),
  });
  return res;
}

// SMS yuborish (kerak bo'lsa avtomatik login/qayta urinish)
async function sendSms(phone, message) {
  if (!isConfigured()) throw new Error('SMS sozlanmagan (ESKIZ_EMAIL/PASSWORD .env\'da yo\'q).');
  const mobile = normMobile(phone);
  if (mobile.length < 12) throw new Error('Telefon raqami noto\'g\'ri.');

  if (!token) await login();
  let res = await sendOnce(mobile, message);
  if (res.status === 401) { await login(); res = await sendOnce(mobile, message); }

  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('SMS yuborilmadi: ' + (j?.message || res.status));
  return { ok: true, id: j?.id || j?.data?.id || null };
}

module.exports = { sendSms, isConfigured, normMobile };
