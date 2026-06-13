// ─────────────────────────────────────────────────────────────────────────────
// AUDIT XIZMATI — o'zgarmas (append-only) nazorat jurnali.
//
// Maqsad: kassir firibgarligini aniqlash. Eng katta xavf — ORQAGA SANA bilan
// xarajat yozish (bugun yoziladi, lekin "sana" 3 oy oldin → bugungi qoldiq
// kamayadi, bugungi hisobotda ko'rinmaydi).
//
// Ishlash printsipi: har bir PUT /api/state'da server ESKI va YANGI holatni
// solishtiradi (diff). Har bir o'zgarish SERVER VAQTI bilan jurnalga yoziladi.
// Foydalanuvchi qaysi "sana"ni qo'ymasin, server haqiqiy vaqtni biladi —
// shu sababli orqaga sana darrov bilinadi.
//
// Jurnal alohida faylda (audit.jsonl), faqat qo'shiladi. Holat saqlash unga tegmaydi.
// ─────────────────────────────────────────────────────────────────────────────
const fs   = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');

// Kuzatiladigan to'plamlar (massiv ko'rinishidagi yozuvlar)
const COLLECTIONS = {
  cash_rows:          'Naqd qoldiq yozuvi',
  income_rows:        'Kirim (naqd)',
  expense_rows:       'Chiqim (naqd)',
  bank_rows:          'Bank qoldiq yozuvi',
  bank_income_rows:   'Kirim (bank)',
  bank_expense_rows:  'Chiqim (bank)',
  click_rows:         'Click qoldiq yozuvi',
  click_income_rows:  'Kirim (click)',
  click_expense_rows: 'Chiqim (click)',
  sales_rows:         'Sotuv',
  sold_rows:          'Sotilgan tonna (eski)',
  recv_rows:          'Olingan tonna',
  debt_rows:          'Qarz',
  advance_rows:       'Avans',
  salary_payments:    "Oylik to'lov",
  daily_work_rows:    'Kunlik ish',
  customers:          'Mijoz',
  workers:            'Xodim',
  drivers:            'Haydovchi',
  driver_trips:       'Haydovchi qatnovi',
};

// Pul chiqishi bilan bog'liq (yuqori xavf) to'plamlar
const MONEY_OUT = new Set(['expense_rows', 'bank_expense_rows', 'click_expense_rows', 'recv_rows', 'salary_payments']);

// Ochilish qoldig'i (obyekt) — to'g'ridan-to'g'ri qoldiqqa ta'sir qiladi, firibgarlik vektori
const OPENINGS = {
  cash_opening:   'Naqd ochilish qoldig\'i',
  bank_opening:   'Bank ochilish qoldig\'i',
  click_opening:  'Click ochilish qoldig\'i',
  cement_opening: 'Sement ochilish qoldig\'i',
};

const auditFile = (acc) => path.join(DATA_DIR, 'accounts', String(acc).replace(/[^a-zA-Z0-9_-]/g, '') || 'default', 'audit.jsonl');

const amountOf = (coll, r) => {
  if (['sales_rows', 'sold_rows', 'recv_rows'].includes(coll)) return Number(r.tons || 0) * Number(r.pricePerTon || 0);
  if (r.amount != null) return Number(r.amount);
  return 0;
};
const textOf = (r) => r.customer || r.desc || r.source || r.name || r.note || '';

// 'dd.mm.yyyy' -> kun timestamp (00:00)
const parseDate = (s) => {
  if (!s) return 0;
  const p = String(s).split('.');
  if (p.length !== 3) return 0;
  const [d, m, y] = p.map(Number);
  return new Date(y, m - 1, d).getTime();
};

// Bir yozuvda muhim maydonlardagi o'zgarishlar
function fieldChanges(oldR, newR) {
  const fields = ['amount', 'date', 'tons', 'pricePerTon', 'paid', 'role', 'password', 'status', 'customer', 'desc'];
  const ch = [];
  for (const f of fields) {
    if (String(oldR[f] ?? '') !== String(newR[f] ?? '')) ch.push({ field: f, from: oldR[f] ?? '', to: newR[f] ?? '' });
  }
  return ch;
}

function entry(user, action, coll, label, rec, extra = {}) {
  return {
    ts: Date.now(),                      // SERVER vaqti (ishonchli)
    userId: user?.sub ?? null,
    userName: user?.name || 'noma\'lum',
    role: user?.role || '—',
    action,                              // 'create' | 'update' | 'delete'
    coll, label,
    recordId: rec?.id ?? null,
    recordDate: rec?.date || '',         // foydalanuvchi qo'ygan sana
    clientCreatedAt: rec?.createdAt || null,
    amount: amountOf(coll, rec || {}),
    text: textOf(rec || {}),
    ...extra,
  };
}

function diffArrays(coll, label, oldArr, newArr, user, out) {
  const oldById = new Map((Array.isArray(oldArr) ? oldArr : []).map(r => [r.id, r]));
  const newById = new Map((Array.isArray(newArr) ? newArr : []).map(r => [r.id, r]));

  for (const [id, r] of newById) {
    if (r.auto) continue;                // sotuvdan avtomatik yaratilgan — alohida loglanmaydi
    if (!oldById.has(id)) out.push(entry(user, 'create', coll, label, r));
    else {
      const o = oldById.get(id);
      if (JSON.stringify(o) !== JSON.stringify(r)) {
        const changes = fieldChanges(o, r);
        if (changes.length) out.push(entry(user, 'update', coll, label, r, { changes }));
      }
    }
  }
  for (const [id, r] of oldById) {
    if (r.auto) continue;
    if (!newById.has(id)) out.push(entry(user, 'delete', coll, label, r));
  }
}

function diffOpenings(oldState, newState, user, out) {
  for (const [key, label] of Object.entries(OPENINGS)) {
    const o = oldState[key], n = newState[key];
    if (o && n && JSON.stringify(o) !== JSON.stringify(n)) {
      const changes = fieldChanges(o, n);
      out.push({
        ts: Date.now(), userId: user?.sub ?? null, userName: user?.name || 'noma\'lum', role: user?.role || '—',
        action: 'update', coll: key, label, recordId: null, recordDate: n.date || '',
        amount: Number(n.amount ?? n.tons ?? 0), text: 'Ochilish qoldig\'i o\'zgartirildi', changes,
      });
    }
  }
}

// ── Ommaviy: diff va yozish ──────────────────────────────────────────────────
function recordChanges(account, oldState, newState, user) {
  try {
    const out = [];
    for (const [coll, label] of Object.entries(COLLECTIONS)) {
      diffArrays(coll, label, oldState[coll], newState[coll], user, out);
    }
    diffOpenings(oldState || {}, newState || {}, user, out);
    if (out.length === 0) return 0;

    const file = auditFile(account);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, out.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf8');
    return out.length;
  } catch (err) {
    console.error('[AUDIT] yozishda xato:', err.message);
    return 0;          // audit xatosi hech qachon holat saqlashni buzmasligi kerak
  }
}

// ── Shubha tahlili (o'qishda hisoblanadi) ────────────────────────────────────
const DAY = 24 * 60 * 60 * 1000;

function analyze(e) {
  const flags = [];
  const serverDay = new Date(e.ts); serverDay.setHours(0, 0, 0, 0);
  const recDay = parseDate(e.recordDate);
  const gapDays = recDay ? Math.round((serverDay.getTime() - recDay) / DAY) : 0;

  // 1) ORQAGA SANA: yozuv bugun yaratildi, lekin sanasi o'tmishda
  if (e.action === 'create' && recDay && gapDays > 1) {
    flags.push({
      type: 'backdate',
      severity: MONEY_OUT.has(e.coll) ? 'high' : (gapDays > 7 ? 'high' : 'medium'),
      text: `Orqaga sana: ${gapDays} kun oldingi sana bilan kiritildi`,
    });
  }
  // 2) ESKI YOZUVNI TAHRIRLASH/O'CHIRISH
  if ((e.action === 'update' || e.action === 'delete') && recDay && gapDays > 2) {
    flags.push({
      type: e.action === 'delete' ? 'old-delete' : 'old-edit',
      severity: MONEY_OUT.has(e.coll) ? 'high' : 'medium',
      text: e.action === 'delete'
        ? `Eski yozuv o'chirildi (${gapDays} kun oldingi)`
        : `Eski yozuv o'zgartirildi (${gapDays} kun oldingi)`,
    });
  }
  // 3) Pul kirimi yoki sotuvni o'chirish (yashirish vektori)
  if (e.action === 'delete' && ['income_rows', 'bank_income_rows', 'click_income_rows', 'sales_rows', 'sold_rows'].includes(e.coll)) {
    flags.push({ type: 'income-delete', severity: 'high', text: 'Pul kirimi / sotuv o\'chirildi' });
  }
  // 4) Summani kamaytirish tomon tahrirlash
  if (e.action === 'update' && e.changes) {
    const amt = e.changes.find(c => c.field === 'amount');
    if (amt && Number(amt.to) < Number(amt.from)) {
      flags.push({ type: 'amount-down', severity: 'medium', text: `Summa kamaytirildi: ${amt.from} → ${amt.to}` });
    }
    const dt = e.changes.find(c => c.field === 'date');
    if (dt) flags.push({ type: 'date-changed', severity: 'high', text: `Sana o'zgartirildi: ${dt.from} → ${dt.to}` });
  }
  // 5) Xavfsizlik: rol yoki parol o'zgarishi
  if (e.coll === 'workers' && e.changes) {
    if (e.changes.find(c => c.field === 'role'))     flags.push({ type: 'security', severity: 'high', text: 'Xodim roli o\'zgartirildi' });
    if (e.changes.find(c => c.field === 'password')) flags.push({ type: 'security', severity: 'medium', text: 'Xodim paroli o\'zgartirildi' });
  }
  // 6) Ochilish qoldig'ini o'zgartirish
  if (e.coll.endsWith('_opening')) {
    flags.push({ type: 'opening', severity: 'high', text: 'Ochilish (boshlang\'ich) qoldiq o\'zgartirildi' });
  }
  return flags;
}

function read(account, { limit = 1000 } = {}) {
  try {
    const file = auditFile(account);
    if (!fs.existsSync(file)) return [];
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    entries.reverse(); // eng yangisi birinchi
    const sliced = entries.slice(0, limit);
    return sliced.map(e => ({ ...e, flags: analyze(e) }));
  } catch (err) {
    console.error('[AUDIT] o\'qishda xato:', err.message);
    return [];
  }
}

module.exports = { recordChanges, read };
