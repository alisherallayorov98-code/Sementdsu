// ─────────────────────────────────────────────────────────────────────────────
// ARXIVNI DISKKA YOZISH — mijozning o'z kompyuteridagi papkaga.
//
// NEGA: server bilan nimadir bo'lsa ham, butun tarix mijozning D diskida
// Excel fayllarda yotadi. Eng yomon holatda yo'qotish bir kunlik bo'ladi.
//
// QANDAY: brauzer xohlagan papkaga o'zi yoza olmaydi (xavfsizlik). Lekin
// File System Access API bor: foydalanuvchi BIR MARTA papkani tanlab ruxsat
// beradi, ruxsat IndexedDB da saqlanadi va keyin dastur o'sha papkaga
// yozaveradi. Chrome/Edge da ishlaydi; Firefox/Safari da yo'q — u yerda
// zaxira yo'l sifatida oddiy "yuklab olish" ishlatiladi.
//
// Papka tuzilmasi (ofis xodimi qo'lda ajratganidek):
//   D:\sementchi.uz\
//     00-UMUMIY\        — mijozlar, xodimlar, haydovchilar + BAZA...json
//     2025\
//       2025-YILLIK.xlsx
//       04-Aprel\
//         2025-04-OYLIK.xlsx
//         25.04.2025.xlsx
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME  = 'sement-archive';
const STORE    = 'handles';
const KEY_DIR  = 'archiveDir';

export const isSupported = () =>
  typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

// ── IndexedDB: papka "handle"ini saqlash ─────────────────────────────────────
// localStorage faqat matn saqlaydi, papka handle esa obyekt — shuning uchun
// IndexedDB. Aks holda brauzer har ochilganda papkani qayta so'rardi.
function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbSet(key, val) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror    = () => reject(tx.error);
  });
}

async function idbGet(key) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const rq = tx.objectStore(STORE).get(key);
    rq.onsuccess = () => resolve(rq.result || null);
    rq.onerror   = () => reject(rq.error);
  });
}

async function idbDel(key) {
  const db = await idb();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror    = () => resolve(false);
  });
}

// ── Papka tanlash / ruxsat ───────────────────────────────────────────────────

/** Foydalanuvchidan papka so'raydi va saqlaydi. Faqat tugma bosilganda! */
export async function pickFolder() {
  if (!isSupported()) throw new Error('unsupported');
  const dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'sement-archive' });
  await idbSet(KEY_DIR, dir);
  return dir;
}

/**
 * Saqlangan papkani qaytaradi.
 * @param {boolean} ask — ruxsat so'ralsa bo'ladimi (faqat foydalanuvchi
 *   harakatidan keyin true bo'lishi mumkin; avtomatik ishda false).
 * @returns {FileSystemDirectoryHandle|null}
 */
export async function getFolder(ask = false) {
  if (!isSupported()) return null;
  const dir = await idbGet(KEY_DIR);
  if (!dir) return null;
  // Brauzer qayta ochilganda ruxsat "prompt" holatiga tushishi mumkin.
  let perm = await dir.queryPermission({ mode: 'readwrite' });
  if (perm === 'granted') return dir;
  if (perm === 'prompt' && ask) {
    perm = await dir.requestPermission({ mode: 'readwrite' });
    if (perm === 'granted') return dir;
  }
  return null;
}

/** Papka tanlanganmi (ruxsat holatidan qat'i nazar) */
export async function hasFolder() {
  return !!(await idbGet(KEY_DIR));
}

export async function folderName() {
  const dir = await idbGet(KEY_DIR);
  return dir?.name || '';
}

export async function forgetFolder() {
  return idbDel(KEY_DIR);
}

// ── Fayl va papka amallari ───────────────────────────────────────────────────

/** Ichma-ich papka ochadi/yaratadi: sub(dir, '2026', '08-Avgust') */
export async function sub(dir, ...parts) {
  let cur = dir;
  for (const p of parts) cur = await cur.getDirectoryHandle(p, { create: true });
  return cur;
}

/** Papkada shu nomli fayl bormi */
export async function fileExists(dir, name) {
  try { await dir.getFileHandle(name); return true; }
  catch { return false; }
}

/** Blob ni faylga yozadi (bor bo'lsa ustiga) */
export async function writeFile(dir, name, blob) {
  const fh = await dir.getFileHandle(name, { create: true });
  const w  = await fh.createWritable();
  await w.write(blob);
  await w.close();
  return true;
}

/** Fayl tizimisiz zaxira yo'l: oddiy yuklab olish */
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
