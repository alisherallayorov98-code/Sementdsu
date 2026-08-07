// State controller — dasturning butun holatini akkaunt bo'yicha o'qish/saqlash.
// Har bir foydalanuvchi FAQAT o'z akkauntining ma'lumotiga kiradi (req.user.account).
const db    = require('../db');
const audit = require('../services/audit.service');
const { hashPassword, isHashed } = require('../services/auth.service');

// Faqat ADMIN o'zgartira oladigan bo'limlar (rol ko'tarish, parol almashtirish,
// ochilish qoldig'ini yashirin o'zgartirishning oldini oladi).
const ADMIN_ONLY_KEYS = [
  'workers', 'app_settings', 'warehouses',
  'cash_opening', 'bank_opening', 'click_opening', 'cement_opening',
];

// Parol-hashlarni clientga umuman yubormaymiz
function stripPasswords(state) {
  if (!state || !Array.isArray(state.workers)) return state;
  return { ...state, workers: state.workers.map(({ password, ...w }) => w) };
}

// ─────────────────────────────────────────────────────────────────────────────
// BIR VAQTDA ISHLASH HIMOYASI
//
// Client butun holatni bitta PUT bilan yuboradi. Ikki xodim bir vaqtda ishlasa:
//   10:00  A va B holatni yuklab oladi
//   10:01  A sotuv qiladi  → PUT (A ning nusxasi)
//   10:02  B sotuv qiladi  → PUT (B ning nusxasida A ning sotuvi YO'Q)
// Natijada A ning sotuvi butunlay o'chib ketardi — hech qanday ogohlantirishsiz.
//
// Yechim: client o'zi ko'rgan versiyani (__baseVersion) qaytaradi. Server
// versiyasi undan farq qilsa — oradan boshqa birov yozgan; ustiga yozmaymiz,
// balki BIRLASHTIRAMIZ (services/stateMerge.js: qator + qator ichidagi to'lov
// ro'yxatlari + hosila yig'indilar).
//
// O'chirish esa tombstone (__deleted) orqali hurmat qilinadi — birlashtirish
// o'chirilgan yozuvni qayta tiriltirmaydi.
// ─────────────────────────────────────────────────────────────────────────────
const { mergeStates, mergeTombstones } = require('../services/stateMerge');

// Serverdagi (bot yozgan) maydonlarni saqlash: client qatorida qiymat bo'sh
// bo'lsa, serverdagi to'ldirilган qiymat qaytariladi. Client ataylab o'zgartirgan
// bo'lsa (qiymat bor) — clientniki qoladi.
function preserveServerFields(clientArr, serverArr, fields) {
  if (!Array.isArray(clientArr) || !Array.isArray(serverArr)) return clientArr;
  const byId = new Map(serverArr.map(r => [r.id, r]));
  const empty = (v) => v === undefined || v === null || v === '';
  return clientArr.map(r => {
    const srv = byId.get(r.id);
    if (!srv) return r;
    let patch = null;
    for (const f of fields) {
      if (empty(r[f]) && !empty(srv[f])) { (patch ||= {})[f] = srv[f]; }
    }
    return patch ? { ...r, ...patch } : r;
  });
}

// GET /api/state
exports.get = (req, res) => {
  // __deleted (o'chirilganlar tarixi) faqat server ichida kerak — client uni
  // ishlatmaydi, javobni esa bekorga kattalashtiradi.
  const { __deleted, ...rest } = db.getState(req.user.account);
  const state = stripPasswords(rest);
  // Versiya belgisi — client uni PUT da qaytaradi (to'qnashuvni aniqlash uchun)
  res.json({ ...state, __updatedAt: db.getUpdatedAt(req.user.account) });
};

// PUT /api/state
exports.put = async (req, res) => {
  let body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ ok: false, error: "Holat obyekt ko'rinishida bo'lishi kerak" });
  }

  const oldState   = db.getState(req.user.account);
  const oldWorkers = Array.isArray(oldState.workers) ? oldState.workers : [];

  // ── To'qnashuv nazorati (yuqoridagi izohga qarang) ───────────────────────
  const baseVersion    = Number(body.__baseVersion || 0);
  const currentVersion = Number(db.getUpdatedAt(req.user.account) || 0);
  // O'chirilgan yozuvlar ro'yxati: client shu safar o'chirganlari + serverda
  // saqlangan tarix (boshqa xodimning eski nusxasi ularni qaytarmasin).
  const tombstones = mergeTombstones(oldState.__deleted, body.__deleted);
  delete body.__baseVersion;
  delete body.__updatedAt;

  // ── Tozalashdan keyingi eski (stale) saqlashni rad etish ─────────────────
  // Baza tozalanganidan OLDIN yuklab olgan brauzer saqlashга urinsa, uni
  // birlashtirmaymiz (aks holda eski ma'lumot qaytib, tozalash bekor bo'lardi).
  // 409 qaytaramiz — client sahifani yangilab, toza holatni oladi.
  const wipedAt = Number(oldState.__wipedAt || 0);
  if (wipedAt && baseVersion && baseVersion < wipedAt) {
    return res.status(409).json({
      ok: false, reload: true,
      error: "Baza yangilangan (tozalangan). Sahifani yangilang.",
    });
  }

  let merged = false;
  if (baseVersion > 0 && currentVersion > 0 && baseVersion !== currentVersion) {
    body = mergeStates(oldState, body, tombstones);
    merged = true;
    console.warn(`[state] To'qnashuv birlashtirildi (akkaunt: ${req.user.account}, base=${baseVersion}, joriy=${currentVersion})`);
  }

  // ── XAVFSIZLIK: xodimlarni tasodifan yo'q qilishdan himoya ────────────────
  // setState butun holatni ALMASHTIRADI. Agar so'rovda `workers` bo'lmasa,
  // barcha xodimlar (parollari bilan) o'chib ketardi va tashkilotga hech kim
  // kira olmay qolardi — qaytarib bo'lmaydigan holat. Kelmagan bo'lsa eskisini
  // saqlab qolamiz.
  if (!Array.isArray(body.workers) && oldWorkers.length) {
    body.workers = oldWorkers;
  }

  // ── Ichki (xizmat) kalitlari faqat superadmin nazoratida ──────────────────
  // `__disabled` kabi bayroqlarni tashkilot o'zi o'zgartira olmasligi kerak.
  // Aks holda to'xtatilgan tashkilotning navbatdagi saqlashi bayroqni o'chirib,
  // o'zini o'zi qayta yoqib yuborardi.
  for (const k of Object.keys(body)) {
    if (k.startsWith('__')) delete body[k];
  }
  for (const [k, v] of Object.entries(oldState)) {
    if (k.startsWith('__')) body[k] = v;
  }
  // O'chirilganlar tarixi — yuqoridagi tozalashdan KEYIN yoziladi (u ham `__`
  // bilan boshlanadi, aks holda eski qiymat bilan qayta tiklanib qolardi).
  // 30 kundan eskilari mergeTombstones ichida tashlab yuboriladi.
  if (tombstones.length) body.__deleted = tombstones;
  else delete body.__deleted;

  // ── Tiket "usedTonna" — faqat bot (backend) yangilaydi ────────────────────
  // Zayavka bot haydovchi jo'natilganda ticket.usedTonna ni to'g'ridan-to'g'ri
  // oshiradi. Frontend butun holatni PUT qilganda esa o'zidagi ESKI usedTonna
  // (odatda 0) bilan kelib, bot yangilanishini ustiga yozib yuborardi
  // (merge ham qatorni id bo'yicha birlashtirib, client qiymatini afzal ko'radi).
  // Shuning uchun har doim serverdagi joriy usedTonna'ni saqlab qolamiz.
  if (Array.isArray(body.tickets) && Array.isArray(oldState.tickets)) {
    const usedById = new Map(oldState.tickets.map(t => [t.id, t.usedTonna]));
    body.tickets = body.tickets.map(t =>
      usedById.has(t.id) ? { ...t, usedTonna: usedById.get(t.id) } : t
    );
  }

  // ── Bot biriktirgan maydonlarni saqlash (telegramChatId, joylashuv) ───────
  // Bot deep link orqali mijoz/xodim/haydovchining telegramChatId sini o'rnatadi
  // (bildirishnomalar shu orqali boradi). Frontend butun holatni PUT qilganда
  // o'zidа bu qiymat bo'lmasa, uni O'CHIRIB yuborardi — Telegram ulanishи
  // yo'qolib, xabarlar bormay qolardi. Client qiymati bo'sh bo'lsa, serverdagini
  // saqlaymiz (client ataylab o'zgartirgan bo'lsa — client qiymati qoladi).
  body.customers = preserveServerFields(body.customers, oldState.customers, ['telegramChatId', 'lat', 'lon']);
  body.drivers   = preserveServerFields(body.drivers,   oldState.drivers,   ['telegramChatId']);
  body.workers   = preserveServerFields(body.workers,   oldState.workers,   ['telegramChatId']);

  if (req.user.role !== 'admin') {
    // ── XAVFSIZLIK: admin bo'lmaganlar config/xodim/ochilish bo'limlariga tegolmaydi.
    // Ular serverdagi eski qiymatda qoladi (savdo/kassa/qarz esa yoziladi).
    for (const k of ADMIN_ONLY_KEYS) {
      if (oldState[k] !== undefined) body[k] = oldState[k];
      else delete body[k];
    }
  } else if (Array.isArray(body.workers)) {
    // ── ADMIN: parollarni boshqarish.
    // GET parolni olib tashlagani uchun kelgan workers'da parol bo'lmaydi —
    // eski hashni saqlaymiz. Yangi ochiq parol kelsa — hash qilamiz.
    const oldById = new Map(oldWorkers.map(w => [w.id, w]));
    for (const w of body.workers) {
      if (!w.password) {
        const prev = oldById.get(w.id);
        if (prev && prev.password) w.password = prev.password;
      } else if (!isHashed(w.password)) {
        w.password = await hashPassword(w.password);
      }
    }
  }

  // Saqlashdan OLDIN eski holatni olib, o'zgarishlarni audit jurnaliga yozamiz
  audit.recordChanges(req.user.account, oldState, body, req.user);

  const updatedAt = db.setState(req.user.account, body);
  // merged=true bo'lsa client boshqa xodimning yozuvlarini ham olishi uchun
  // holatni qayta yuklab olishi kerak.
  res.json({ ok: true, updatedAt, merged });
};
