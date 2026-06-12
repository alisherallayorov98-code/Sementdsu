// ─────────────────────────────────────────────────────────────────────────────
// Markaziy xato boshqaruvi:
//   asyncHandler — async controllerlardagi xatolarni avtomatik ushlaydi.
//   notFound — mavjud bo'lmagan yo'l.
//   errorHandler — barcha xatolarni xavfsiz JSON sifatida qaytaradi (server
//   ichki tafsilotlari production'da sizib chiqmaydi).
// ─────────────────────────────────────────────────────────────────────────────
const { NODE_ENV } = require('../config');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const notFound = (req, res) => res.status(404).json({ ok: false, error: 'Topilmadi' });

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[ERROR]', err.stack || err.message);
  res.status(status).json({
    ok: false,
    error: status === 500 ? 'Serverda xato yuz berdi' : err.message,
    ...(NODE_ENV !== 'production' && status === 500 ? { detail: err.message } : {}),
  });
};

module.exports = { asyncHandler, notFound, errorHandler };
