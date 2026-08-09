// ─────────────────────────────────────────────────────────────────────────────
// ARXIVNI YURGIZISH — qaysi fayllar yozilishi kerakligini hal qiladi.
//
// TEZLIK MASALASI: 2 yillik tarixda ~700 kun bo'ladi. Har safar hammasini
// qaytadan yasash uzoq davom etardi. Shuning uchun:
//   · o'tgan kunlar fayli BOR bo'lsa qayta yozilmaydi;
//   · oxirgi RECENT_DAYS kun HAR DOIM qayta yoziladi — yaqin o'tmishdagi
//     yozuv tahrirlanishi mumkin (kassir kechagi xatoni tuzatadi);
//   · oylik/yillik fayl faqat o'sha davrga tegishli kun o'zgargan bo'lsa
//     qayta yasaladi.
// Natijada kundalik arxiv bir necha soniyada tugaydi.
//
// Sof qism (qaysi kunlar yozilishi kerak) — planArchive(), test bilan.
// Fayl tizimi bilan ishlash — runArchive(), brauzerda.
// ─────────────────────────────────────────────────────────────────────────────
import {
  allDays, splitDate, daySheets, monthSheets, yearSheets, registrySheets,
  yearFolder, monthFolder, dayFile, monthFile, yearFile, REGISTRY_FOLDER,
} from './archiveData.js';
import { buildWorkbook } from './archiveExcel.js';
import { sub, writeFile } from './archiveWriter.js';

// Oxirgi shuncha kun har doim yangilanadi (tahrir qilingan bo'lishi mumkin)
export const RECENT_DAYS = 7;

const dayTs = (day) => {
  const p = splitDate(day);
  return p ? new Date(p.y, p.m - 1, p.d).getTime() : 0;
};

/**
 * Qaysi kunlarni yozish kerak.
 * @param {string[]} days      — ma'lumotdagi barcha kunlar
 * @param {Set<string>} exists — allaqachon fayli bor kunlar
 * @param {number} nowTs       — hozirgi vaqt (test uchun beriladi)
 * @returns {{ days: string[], months: string[], years: number[] }}
 *   months — "y-m" ko'rinishida
 */
export function planArchive(days, exists, nowTs = Date.now()) {
  const recentFrom = nowTs - RECENT_DAYS * 86400000;
  const todo = days.filter(d => !exists.has(d) || dayTs(d) >= recentFrom);

  const months = new Set(), years = new Set();
  for (const d of todo) {
    const p = splitDate(d);
    if (!p) continue;
    months.add(`${p.y}-${p.m}`);
    years.add(p.y);
  }
  return { days: todo, months: [...months], years: [...years] };
}

/**
 * Arxivni papkaga yozadi.
 * @param {FileSystemDirectoryHandle} dir
 * @param {object} data     — DataContext qiymatlari
 * @param {object} opts     — { onProgress(done, total, label), fullState }
 * @returns {{ days:number, months:number, years:number, skipped:number }}
 */
export async function runArchive(dir, data, { onProgress, fullState } = {}) {
  const days = allDays(data);

  // Qaysi kun fayli allaqachon bor. HAR KUN uchun alohida papka ochish
  // 2 yillik tarixda 700 ta chaqiruv bo'lardi — oylar bo'yicha guruhlab,
  // har oy papkasini BIR MARTA ochamiz va ichini bir o'tishda ro'yxatlaymiz.
  // Papka create QILINMAYDI: yo'q bo'lsa demak fayl ham yo'q.
  const byMonth = new Map();                       // "y-m" → [kun...]
  for (const day of days) {
    const p = splitDate(day);
    if (!p) continue;
    const k = `${p.y}-${p.m}`;
    const arr = byMonth.get(k);
    if (arr) arr.push(day); else byMonth.set(k, [day]);
  }

  const exists = new Set();
  for (const [key, list] of byMonth) {
    const [y, m] = key.split('-').map(Number);
    try {
      const yDir = await dir.getDirectoryHandle(yearFolder(y));
      const mDir = await yDir.getDirectoryHandle(monthFolder(m));
      const names = new Set();
      for await (const name of mDir.keys()) names.add(name);
      for (const day of list) if (names.has(dayFile(day))) exists.add(day);
    } catch { /* yil yoki oy papkasi hali yo'q — hech narsa yozilmagan */ }
  }

  const plan = plansOf(days, exists);
  const total = plan.days.length + plan.months.length + plan.years.length + 1;
  let done = 0;
  const step = (label) => { done++; if (onProgress) onProgress(done, total, label); };

  // ── Kunlik fayllar ────────────────────────────────────────────────────────
  for (const day of plan.days) {
    const p = splitDate(day);
    const mDir = await sub(dir, yearFolder(p.y), monthFolder(p.m));
    const blob = buildWorkbook(daySheets(data, day), { title: `KUNLIK ARXIV — ${day}` });
    if (blob) await writeFile(mDir, dayFile(day), blob);
    step(day);
  }

  // ── Oylik jamlanmalar ─────────────────────────────────────────────────────
  for (const key of plan.months) {
    const [y, m] = key.split('-').map(Number);
    const mDir = await sub(dir, yearFolder(y), monthFolder(m));
    const blob = buildWorkbook(monthSheets(data, y, m), { title: `OYLIK ARXIV — ${monthFolder(m)} ${y}` });
    if (blob) await writeFile(mDir, monthFile(y, m), blob);
    step(`${monthFolder(m)} ${y}`);
  }

  // ── Yillik jamlanmalar ────────────────────────────────────────────────────
  for (const y of plan.years) {
    const yDir = await sub(dir, yearFolder(y));
    const blob = buildWorkbook(yearSheets(data, y), { title: `YILLIK ARXIV — ${y}` });
    if (blob) await writeFile(yDir, yearFile(y), blob);
    step(`${y} yil`);
  }

  // ── Reyestrlar + to'liq baza (tiklash uchun) ──────────────────────────────
  const uDir = await sub(dir, REGISTRY_FOLDER);
  const regBlob = buildWorkbook(registrySheets(data), { title: 'UMUMIY REYESTRLAR' });
  if (regBlob) await writeFile(uDir, 'REYESTRLAR.xlsx', regBlob);

  // JSON — shu fayldan butun baza qaytarib tiklanadi (Sozlamalar → Zaxira).
  // Excel odam o'qishi uchun, JSON dastur tiklashi uchun.
  if (fullState) {
    const stamp = new Date().toISOString().slice(0, 10);
    const json = new Blob([JSON.stringify(fullState, null, 2)], { type: 'application/json' });
    await writeFile(uDir, `BAZA-${stamp}.json`, json);
  }
  step('Umumiy');

  return {
    days: plan.days.length,
    months: plan.months.length,
    years: plan.years.length,
    skipped: days.length - plan.days.length,
  };
}

// planArchive ni nowTs siz chaqirish uchun kichik o'ram
const plansOf = (days, exists) => planArchive(days, exists);

// ── Davr: keyingi arxiv qachon kerak ────────────────────────────────────────
/**
 * @param {string} period — 'daily' | 'weekly' | 'monthly'
 * @param {number|null} lastTs — oxirgi arxiv vaqti
 * @returns {boolean} hozir arxiv kerakmi
 */
export function isArchiveDue(period, lastTs, nowTs = Date.now()) {
  if (!lastTs) return true;                       // hech qachon olinmagan
  const last = new Date(lastTs), now = new Date(nowTs);
  const sameDay = last.toDateString() === now.toDateString();
  if (period === 'daily')   return !sameDay;
  if (period === 'monthly') return last.getFullYear() !== now.getFullYear() || last.getMonth() !== now.getMonth();
  // haftalik (standart): 7 kundan ko'p o'tgan bo'lsa
  return (nowTs - lastTs) >= 7 * 86400000;
}
