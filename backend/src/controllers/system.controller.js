// ─────────────────────────────────────────────────────────────────────────────
// System controller — server resurslari (FAQAT admin uchun).
// Disk band/bo'sh joy, ma'lumot bazasi hajmi, backuplar, RAM holatini qaytaradi.
// Mijoz "server to'lib qolmaydimi?" deb xavotir bo'lganda shu sahifadan ko'radi.
// ─────────────────────────────────────────────────────────────────────────────
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { DATA_DIR } = require('../config');

// Papka hajmini rekursiv hisoblash (bayt + fayllar soni)
function dirSize(dir) {
  let bytes = 0, files = 0;
  const stack = [dir];
  while (stack.length) {
    let entries;
    try { entries = fs.readdirSync(stack.pop(), { withFileTypes: true }); }
    catch { continue; }
    for (const e of entries) {
      const full = path.join(e.parentPath || dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else { try { bytes += fs.statSync(full).size; files++; } catch { /* o'tkazib yuborish */ } }
    }
  }
  return { bytes, files };
}

// Disk hajmi (data papkasi joylashgan fayl tizimi bo'yicha)
function diskInfo(p) {
  try {
    const s = fs.statfsSync(p); // Node 18.15+
    const total = s.blocks * s.bsize;
    const free  = s.bavail * s.bsize; // amalda mavjud bo'sh joy (rezerv chiqarib)
    return { total, free, used: total - free };
  } catch { return null; }
}

const accId = (acc) => String(acc || 'default').replace(/[^a-zA-Z0-9_-]/g, '') || 'default';

// GET /api/system  — server resurslari holati
exports.status = (req, res) => {
  const accDir  = path.join(DATA_DIR, 'accounts', accId(req.user.account));
  const dbFile  = path.join(accDir, 'db.json');

  let dbBytes = 0;
  try { dbBytes = fs.statSync(dbFile).size; } catch { /* hali yo'q */ }

  res.json({
    ok: true,
    disk:    diskInfo(DATA_DIR),                              // { total, free, used } bayt
    ram:     { total: os.totalmem(), free: os.freemem() },
    data:    dirSize(DATA_DIR),                               // butun data papka { bytes, files }
    db:      { bytes: dbBytes },                              // shu akkaunt asosiy bazasi
    backups: dirSize(path.join(accDir, 'backups')),           // backuplar { bytes, files }
    uptimeSec:  Math.round(os.uptime()),
    serverTime: Date.now(),
  });
};
