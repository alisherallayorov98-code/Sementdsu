// ─────────────────────────────────────────────────────────────────────────────
// "?focus=<id>" — boshqa oynadan (masalan mijoz kartochkasidagi "manba"
// oynasidan) kelinganda kerakli qatorni topib, uni ajratib ko'rsatish.
//
// Sahifalash bor bo'lgani uchun qator boshqa sahifada qolishi mumkin — shuning
// uchun hook kerakli sahifaga o'zi o'tkazadi va qatorni ekranga suradi.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useFocusId() {
  const [sp] = useSearchParams();
  const raw = sp.get('focus');
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return isFinite(n) && String(n) === raw ? n : raw;
}

/**
 * @param {Array}    rows     — filtrlangan (ko'rinadigan) qatorlar, tartibda
 * @param {number}   pageSize
 * @param {function} setPage
 * @returns {{ focusId, rowRef, isFocused }}
 *   rowRef — mos qatorga qo'yiladigan ref (scroll uchun)
 */
export function useFocusRow(rows, pageSize, setPage) {
  const focusId  = useFocusId();
  const jumped   = useRef(false);
  const scrolled = useRef(false);

  // Kerakli sahifaga o'tish (bir marta — foydalanuvchi keyin o'zi varaqlashi mumkin)
  useEffect(() => {
    if (focusId == null || jumped.current) return;
    const idx = (rows || []).findIndex(r => r && r.id === focusId);
    if (idx < 0) return;
    jumped.current = true;
    if (setPage && pageSize) setPage(Math.floor(idx / pageSize) + 1);
  }, [focusId, rows, pageSize, setPage]);

  // Qatorni ekranga surish. useRef emas, CALLBACK ref: qator DOMga ulangan
  // paytda chaqiriladi. Oddiy ref bilan effekt qator paydo bo'lishidan oldin
  // ishlab, hech qachon surmasdi (sahifa almashgach qator keyin chiziladi).
  const rowRef = (node) => {
    if (!node || scrolled.current) return;
    scrolled.current = true;
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  return { focusId, rowRef, isFocused: (id) => focusId != null && id === focusId };
}

// Ajratilgan qator uchun stil (barcha bo'limlarda bir xil ko'rinsin)
export const FOCUS_STYLE = {
  background: '#fff59d',
  outline: '2px solid #f9a825',
  outlineOffset: '-2px',
};
