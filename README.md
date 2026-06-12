# Sement Biznes Boshqaruvi

Sement savdosi biznesi uchun hisob-kitob dasturi: naqd/bank/click pul qoldig'i,
kirim-chiqim, qarzlar, avanslar, sotuv, olingan tonna, ishchilar oyligi, mijozlar
bazasi va Telegram orqali zakaz qabul qilish.

## Loyiha tuzilishi

```
SEMENT/
├── backend/        → Server (Node.js + Express). Ma'lumotlarni saqlaydi va Telegram botini boshqaradi.
│   ├── server.js   → Asosiy server
│   ├── db.js       → Ma'lumotlar bazasi (data/db.json fayli, avtomatik backup bilan)
│   └── data/       → Haqiqiy ma'lumotlar shu yerda (git'ga kirmaydi, backup oling!)
│
└── dashboard/      → Frontend (React + Vite). Foydalanuvchi ko'radigan dastur.
    └── src/
        ├── context/DataContext.jsx → Barcha ma'lumotlar mantig'i (backend bilan sinxron)
        ├── api.js                  → Backend bilan aloqa
        └── pages/                  → Har bir bo'lim (sahifa)
```

**Muhim:** Endi barcha ma'lumotlar **serverda** (`backend/data/db.json`) saqlanadi —
avval brauzer xotirasida (localStorage) edi. Shu tufayli:
- Ma'lumot bitta brauzer/kompyuterga bog'liq emas — bir nechta qurilmada bir xil.
- Har soatda avtomatik backup olinadi (`backend/data/backups/`).
- Brauzer keshi tozalansa ham ma'lumot yo'qolmaydi.

## Ishga tushirish

### 1. Backend (server)
```bash
cd backend
npm install            # faqat birinchi marta
npm start
```
Server `http://localhost:5000` da ishga tushadi.

Telegram botini ulash uchun `backend/.env` faylini yarating (namuna: `.env.example`):
```
TELEGRAM_BOT_TOKEN=@BotFather_bergan_token
PORT=5000
```
Token bo'lmasa ham dastur normal ishlaydi — faqat bot ishlamaydi.

### 2. Frontend (dashboard)
```bash
cd dashboard
npm install            # faqat birinchi marta
npm run dev            # ishlab chiqish rejimi (http://localhost:5173)
```

Tayyor versiyani qurish uchun:
```bash
npm run build          # natija: dashboard/dist/
npm run preview        # qurilgan versiyani sinab ko'rish
```

Agar backend boshqa kompyuterda bo'lsa, `dashboard/.env` faylida manzilni ko'rsating
(namuna: `.env.example`).

## Birinchi kirish
Tizimda hali xodim bo'lmasa, **birinchi kirgan odam avtomatik Admin** bo'ladi.
Keyin "Sozlamalar" bo'limidan boshqa xodimlarni (Sotuvchi, Omborchi) qo'shasiz.

## Xavfsizlik (Security)
Backend qatlamli va himoyalangan arxitekturada:
- **JWT autentifikatsiya** — barcha ma'lumot endpointlari token talab qiladi. Token'siz hech kim ma'lumotni o'qiy/o'zgartira olmaydi. Kirish `/api/auth/login` orqali, server tomonda tekshiriladi.
- **RBAC** — rollar (admin / sotuvchi / omborchi) middleware orqali (`authorize`).
- **helmet** — xavfsiz HTTP sarlavhalari (CSP, X-Frame-Options va h.k.).
- **Rate limiting** — umumiy API daqiqasiga 300 so'rov; login 15 daqiqada 20 urinish (brute-force'dan himoya).
- **CORS allowlist** — `.env`dagi `CORS_ORIGINS` orqali ruxsat etilgan manzillar.
- **Markaziy xato boshqaruvi** — server ichki tafsilotlari tashqariga sizmaydi.
- **Ko'p-akkaunt (SaaS-tayyor)** — har akkaunt izolyatsiyalangan: `data/accounts/<akkaunt>/db.json`.

`.env` sozlamalari uchun `backend/.env.example` ga qarang (`JWT_SECRET`, `JWT_EXPIRES`, `CORS_ORIGINS`).

> Eslatma: xodim parollari hozircha holat ichida ochiq saqlanadi (admin Sozlamalarda
> ko'radi). To'liq SaaS uchun keyingi qadam — parollarni hash qilish (bcrypt) va internetda
> faqat HTTPS orqali ishlatish.

## Ma'lumotlar xavfsizligi (backup)
- Haqiqiy ma'lumotlar: `backend/data/accounts/<akkaunt>/db.json`
- Avtomatik backuplar (soatlik): `backend/data/accounts/<akkaunt>/backups/`
- Qo'lda zaxira: Sozlamalar → "Zaxira (Backup)" → JSON yuklab olish.
- Vaqti-vaqti bilan butun `backend/data/` papkasini boshqa joyga (USB, bulut) nusxalang.
