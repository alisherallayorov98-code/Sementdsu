// ─────────────────────────────────────────────────────────────────────────────
// AVTOMATIK ARXIV — mijoz ertalab saytga kirganda o'zi ishlaydi.
//
// Xodim hech narsa bosmaydi: dastur ochilgach, ma'lumot serverdan to'liq
// yuklanishini kutadi, keyin belgilangan davr (kunlik/haftalik/oylik)
// kelgan bo'lsa arxivni D diskdagi papkaga yozadi.
//
// EHTIYOT CHORALARI:
//   · faqat ma'lumot yuklangandan keyin — yarim yuklangan holatni yozib,
//     to'g'ri arxivni ustiga bosib yuborish mumkin emas;
//   · bir sessiyada bir marta — sahifa qayta chizilganda takrorlanmaydi;
//   · papka ruxsati "prompt" holatida bo'lsa avtomatik ishlamaydi (brauzer
//     foydalanuvchi harakatisiz so'ramaydi) — Sozlamalarda ogohlantiriladi.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { getFolder } from '../lib/archiveWriter';
import { runArchive, isArchiveDue } from '../lib/archiveRun';

const LS_LAST   = 'archive_last_ts';
const LS_PERIOD = 'archive_period';     // 'daily' | 'weekly' | 'monthly'
const LS_ON     = 'archive_enabled';

export const getPeriod  = () => localStorage.getItem(LS_PERIOD) || 'weekly';
export const setPeriod  = (p) => localStorage.setItem(LS_PERIOD, p);
export const getLastTs  = () => Number(localStorage.getItem(LS_LAST)) || null;
export const setLastTs  = (t) => localStorage.setItem(LS_LAST, String(t));
export const isEnabled  = () => localStorage.getItem(LS_ON) !== '0';
export const setEnabled = (v) => localStorage.setItem(LS_ON, v ? '1' : '0');

/**
 * @param {object} data    — DataContext qiymatlari
 * @param {boolean} ready  — ma'lumot serverdan yuklandimi
 * @returns {{ busy, progress, result, error }}
 */
export function useAutoArchive(data, ready) {
  const started = useRef(false);
  const [busy, setBusy]         = useState(false);
  const [progress, setProgress] = useState(null);  // { done, total, label }
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!ready || started.current || !isEnabled()) return;
    started.current = true;

    let cancelled = false;
    (async () => {
      try {
        if (!isArchiveDue(getPeriod(), getLastTs())) return;
        // ask=false: avtomatik ishda brauzer ruxsat so'ramaydi. Ruxsat
        // yo'qolgan bo'lsa jimgina chiqamiz — Sozlamalar buni ko'rsatadi.
        const dir = await getFolder(false);
        if (!dir || cancelled) return;

        setBusy(true);
        const res = await runArchive(dir, data, {
          onProgress: (done, total, label) => { if (!cancelled) setProgress({ done, total, label }); },
          fullState: data.snapshot || null,
        });
        if (cancelled) return;
        setLastTs(Date.now());
        setResult(res);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Arxiv yozishda xato');
      } finally {
        if (!cancelled) { setBusy(false); setProgress(null); }
      }
    })();

    return () => { cancelled = true; };
    // data ataylab bog'liqlikda yo'q: arxiv sessiyada bir marta, boshlanish
    // paytidagi holat bilan ishlaydi (har o'zgarishda qayta yozmaydi).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return { busy, progress, result, error };
}
