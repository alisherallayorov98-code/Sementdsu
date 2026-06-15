# SEMENT — Joylashtirish (Deploy) qo'llanmasi

Bu hujjat dasturni **(1) lokal/LAN** va **(2) internet (SaaS)** uchun ishga
tushirishni tushuntiradi.

---

## 1. Lokal / LAN (do'kon/ofis ichida) — eng oddiy

Bitta kompyuter "server" bo'ladi, qolganlar shu tarmoqdan kiradi.

1. **Server kompyuterda** `start.bat` ni ishga tushiring (backend + dashboard ochiladi).
2. Server IP manzilini bilib oling: `ipconfig` → masalan `192.168.1.50`.
3. Boshqa qurilmalar brauzerda: `http://192.168.1.50:5173`
4. Chek printeri uchun: `chek-rejim.bat` (Chrome kiosk-printing).

> Ma'lumotlar `backend/data/` da, har soatda avtomatik zaxira. Vaqti-vaqti
> bilan Sozlamalar → Zaxira orqali faylga yuklab, USB/Telegram'ga saqlang.

---

## 2. Internet (SaaS) — bir nechta tashkilot uchun

### Tayyorgarlik
1. Server (VPS) — Ubuntu, Node.js 20+, Nginx.
2. Domen (masalan `sement.example.uz`) → server IP'ga yo'naltiring.

### Backend sozlamasi (`backend/.env`)
`cp backend/.env.example backend/.env` va to'ldiring:
```
NODE_ENV=production
JWT_SECRET=<kuchli tasodifiy — node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
CORS_ORIGINS=https://sement.example.uz
TELEGRAM_BOT_TOKEN=<ixtiyoriy>
ESKIZ_EMAIL=<ixtiyoriy>  ESKIZ_PASSWORD=<...>  ESKIZ_FROM=<tasdiqlangan nom>
```

### Frontendni build qilish
```
cd dashboard && npm install && npm run build      # natija: dashboard/dist
```

### Backendni doimiy ishlatish (PM2)
```
cd backend && npm install --production
npm i -g pm2
pm2 start server.js --name sement-api
pm2 save && pm2 startup        # qayta yoqilganda avtomatik ishga tushadi
```

### Nginx + HTTPS
1. `nginx.conf.example` ni serverga moslang (domen, yo'llar).
2. SSL (bepul): `sudo certbot --nginx -d sement.example.uz`
3. `sudo nginx -t && sudo systemctl reload nginx`

### Yangi tashkilot ochish
Login sahifasida **"+ Yangi tashkilot ochish"** → tashkilot nomi + admin ismi +
parol. Har tashkilot ma'lumoti `backend/data/accounts/<nom>/` da alohida,
boshqasiga ko'rinmaydi (token ichida `account`).

---

## Xavfsizlik eslatmalari (internet uchun)
- ✅ Parollar bcrypt bilan hash; tokenlar imzolangan; tashkilotlar ajratilgan.
- ⚠️ `JWT_SECRET` ni albatta kuchli qo'ying (yoki avtomatik yaratilganini saqlang).
- ⚠️ `CORS_ORIGINS` ni faqat o'z domeningizga cheklang (`*` qo'ymang).
- ⚠️ Server `backend/data/` papkasini muntazam zaxiralang (cron + tashqi disk/bulut).
- ℹ️ **Telegram bot** hozir bitta tokenga (bitta tashkilotga) bog'langan. Har
  tashkilotga alohida bot kerak bo'lsa — har akkauntga token biriktirish kerak
  (kelajakdagi takomil).
