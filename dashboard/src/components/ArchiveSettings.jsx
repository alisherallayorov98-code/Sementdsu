// ─────────────────────────────────────────────────────────────────────────────
// AVTOMATIK ARXIV sozlamalari — Sozlamalar → Zaxira bo'limida.
//
// Mijoz bir marta papkani tanlaydi (masalan D:\sementchi.uz), davrni belgilaydi
// va shundan keyin hech narsa qilmaydi: har ochilganda arxiv o'zi yoziladi.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import {
  isSupported, pickFolder, getFolder, hasFolder, folderName, forgetFolder,
} from '../lib/archiveWriter';
import { runArchive } from '../lib/archiveRun';
import {
  getPeriod, setPeriod, getLastTs, setLastTs, isEnabled, setEnabled,
} from '../hooks/useAutoArchive';

const PERIODS = [
  { v: 'daily',   label: 'Har kuni',   note: 'Eng xavfsiz — yo\'qotish nari borsa bir kunlik' },
  { v: 'weekly',  label: 'Har hafta',  note: 'Standart' },
  { v: 'monthly', label: 'Har oy',     note: 'Kamroq yozadi' },
];

const fmtTime = (ts) => ts ? new Date(ts).toLocaleString('ru-RU') : "hali olinmagan";

export default function ArchiveSettings({ themeColor = '#003366' }) {
  const data = useData();
  const [supported]  = useState(isSupported());
  const [folder,     setFolder]     = useState('');
  const [granted,    setGranted]    = useState(false);
  const [period,     setPeriodState] = useState(getPeriod());
  const [enabled,    setEnabledState] = useState(isEnabled());
  const [lastTs,     setLastTsState] = useState(getLastTs());
  const [busy,       setBusy]       = useState(false);
  const [progress,   setProgress]   = useState(null);
  const [msg,        setMsg]        = useState('');
  const [err,        setErr]        = useState('');

  // Papka holatini o'qish
  useEffect(() => {
    (async () => {
      if (!isSupported()) return;
      if (await hasFolder()) {
        setFolder(await folderName());
        setGranted(!!(await getFolder(false)));
      }
    })();
  }, []);

  const choose = async () => {
    setErr(''); setMsg('');
    try {
      const dir = await pickFolder();
      setFolder(dir.name);
      setGranted(true);
      setMsg(`Papka tanlandi: ${dir.name}`);
    } catch (e) {
      // Foydalanuvchi oynani yopsa — bu xato emas
      if (e?.name !== 'AbortError') setErr(e?.message || "Papka tanlanmadi");
    }
  };

  const runNow = async () => {
    setErr(''); setMsg(''); setBusy(true);
    try {
      // ask=true: bu foydalanuvchi bosgan tugma, brauzer ruxsat so'rashi mumkin
      const dir = await getFolder(true);
      if (!dir) { setErr("Papkaga ruxsat berilmadi. Qaytadan tanlang."); return; }
      setGranted(true);
      const res = await runArchive(dir, data, {
        onProgress: (done, total, label) => setProgress({ done, total, label }),
        fullState: data.snapshot || null,
      });
      const now = Date.now();
      setLastTs(now); setLastTsState(now);
      setMsg(
        `Tayyor: ${res.days} ta kun, ${res.months} ta oy, ${res.years} ta yil fayli yozildi` +
        (res.skipped ? ` (${res.skipped} ta kun o'zgarmagan — qayta yozilmadi)` : '')
      );
    } catch (e) {
      setErr(e?.message || 'Arxiv yozishda xato');
    } finally {
      setBusy(false); setProgress(null);
    }
  };

  const disconnect = async () => {
    if (!window.confirm("Arxiv papkasi uzilsinmi?\n\nDiskdagi fayllar o'chmaydi, faqat dastur unga yozishni to'xtatadi.")) return;
    await forgetFolder();
    setFolder(''); setGranted(false); setMsg('Papka uzildi.');
  };

  const box = { background: '#f9f9f9', padding: 24, borderRadius: 8, border: '1px solid #eee', marginBottom: 16 };
  const btn = { padding: '10px 18px', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13, color: '#fff', background: themeColor };

  return (
    <div style={box}>
      <h3 style={{ marginTop: 0, color: themeColor }}>💾 Avtomatik arxiv (kompyuterga)</h3>
      <p style={{ fontSize: 13, color: '#555', lineHeight: 1.7, marginTop: 0 }}>
        Butun tarix <b>sizning kompyuteringizdagi</b> papkaga Excel bo'lib yoziladi —
        yil, oy va kunlarga ajratilgan holda. Server bilan nimadir bo'lsa ham,
        hamma ma'lumot qo'lingizda qoladi.
        <br />
        Papkani bir marta tanlaysiz, keyin har ochilganda arxiv <b>o'zi</b> yoziladi.
      </p>

      {!supported ? (
        <div style={{ fontSize: 12.5, color: '#b71c1c', background: '#ffebee', border: '1px solid #ef9a9a', padding: 12, borderRadius: 4, lineHeight: 1.6 }}>
          ⚠️ Bu brauzer papkaga yozishni qo'llab-quvvatlamaydi.
          <br />
          <b>Chrome</b> yoki <b>Microsoft Edge</b> dan kiring — o'sha yerda ishlaydi.
          Hozircha yuqoridagi "Zaxirani yuklab olish" tugmasidan foydalaning.
        </div>
      ) : (
        <>
          {/* Papka */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
            <button onClick={choose} style={btn}>
              📁 {folder ? "Papkani o'zgartirish" : 'Papkani tanlash'}
            </button>
            {folder && (
              <>
                <span style={{ fontSize: 13, color: '#333' }}>
                  Tanlangan: <b>{folder}</b>
                  {granted
                    ? <span style={{ color: '#2e7d32', marginLeft: 8 }}>✓ ruxsat bor</span>
                    : <span style={{ color: '#e65100', marginLeft: 8 }}>⚠ ruxsat tasdiqlanishi kerak</span>}
                </span>
                <button onClick={disconnect}
                  style={{ ...btn, background: '#eceff1', color: '#555', fontWeight: 'normal' }}>
                  Uzish
                </button>
              </>
            )}
          </div>

          {!folder && (
            <div style={{ fontSize: 12.5, color: '#1565c0', background: '#e3f2fd', border: '1px solid #bbdefb', padding: 10, borderRadius: 4, marginBottom: 14, lineHeight: 1.6 }}>
              💡 Maslahat: D diskda <b>sementchi.uz</b> nomli papka ochib, o'shani tanlang.
            </div>
          )}

          {folder && !granted && (
            <div style={{ fontSize: 12.5, color: '#e65100', background: '#fff3e0', border: '1px solid #ffcc80', padding: 10, borderRadius: 4, marginBottom: 14, lineHeight: 1.6 }}>
              ⚠️ Brauzer papkaga yozish ruxsatini qayta so'rayapti (bu vaqti-vaqti bilan
              bo'ladi). <b>"Hozir arxivlash"</b> tugmasini bosing va ruxsatni tasdiqlang —
              shundan keyin avtomatik ishlashda davom etadi.
            </div>
          )}

          {/* Davr */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 6 }}>Qanchalik tez-tez:</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PERIODS.map(p => (
                <button key={p.v} onClick={() => { setPeriod(p.v); setPeriodState(p.v); }}
                  title={p.note}
                  style={{
                    padding: '8px 16px', cursor: 'pointer', borderRadius: 6, fontSize: 13,
                    border: `2px solid ${period === p.v ? themeColor : '#ccc'}`,
                    background: period === p.v ? themeColor : '#fff',
                    color: period === p.v ? '#fff' : '#555',
                    fontWeight: period === p.v ? 'bold' : 'normal',
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: '#888', marginTop: 5 }}>
              {PERIODS.find(p => p.v === period)?.note}
            </div>
          </div>

          {/* Yoqilgan / o'chirilgan */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#333', marginBottom: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={enabled}
              onChange={e => { setEnabled(e.target.checked); setEnabledState(e.target.checked); }} />
            Dastur ochilganda arxiv avtomatik yozilsin
          </label>

          {/* Amal */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={runNow} disabled={busy || !folder}
              style={{ ...btn, background: busy || !folder ? '#bbb' : '#2e7d32', cursor: busy || !folder ? 'default' : 'pointer' }}>
              {busy ? 'Yozilmoqda…' : '▶ Hozir arxivlash'}
            </button>
            <span style={{ fontSize: 12.5, color: '#666' }}>
              Oxirgi arxiv: <b>{fmtTime(lastTs)}</b>
            </span>
          </div>

          {busy && progress && (
            <div style={{ marginTop: 12 }}>
              <div style={{ height: 8, background: '#e0e0e0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round(progress.done / progress.total * 100)}%`, background: '#2e7d32', transition: 'width .2s' }} />
              </div>
              <div style={{ fontSize: 11.5, color: '#666', marginTop: 4 }}>
                {progress.done} / {progress.total} — {progress.label}
              </div>
            </div>
          )}

          {msg && <div style={{ marginTop: 12, fontSize: 12.5, color: '#1b5e20', background: '#e8f5e9', border: '1px solid #a5d6a7', padding: 10, borderRadius: 4 }}>✓ {msg}</div>}
          {err && <div style={{ marginTop: 12, fontSize: 12.5, color: '#b71c1c', background: '#ffebee', border: '1px solid #ef9a9a', padding: 10, borderRadius: 4 }}>⚠️ {err}</div>}

          {/* Nima yoziladi */}
          <details style={{ marginTop: 16, fontSize: 12.5, color: '#555' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: themeColor }}>
              Papkada nima paydo bo'ladi?
            </summary>
            <pre style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 4, padding: 12, marginTop: 8, fontSize: 11.5, lineHeight: 1.6, overflowX: 'auto' }}>
{`Tanlangan papka\\
├── 00-UMUMIY\\
│   ├── REYESTRLAR.xlsx      (mijozlar, xodimlar, haydovchilar…)
│   └── BAZA-2026-08-09.json (butun bazani tiklash uchun)
├── 2025\\
│   ├── 2025-YILLIK.xlsx
│   └── 04-Aprel\\
│       ├── 2025-04-OYLIK.xlsx
│       └── 25.04.2025.xlsx
└── 2026\\
    └── 08-Avgust\\
        ├── 2026-08-OYLIK.xlsx
        └── 09.08.2026.xlsx`}
            </pre>
            <div style={{ lineHeight: 1.7 }}>
              Har bir Excel faylda bo'limlar <b>alohida varaqlarda</b>: Kassa, Bank,
              Click, Sotuv, Olingan tonna, Qarzlar, Qarz to'lovlari, Avanslar,
              Sklad, Zavodga to'lov, Oylik, Haydovchi, Zakazlar. Birinchi varaq —
              XULOSA (qaysi bo'limda nechta yozuv va qancha summa).
              <br /><br />
              Eski kunlar <b>qayta yozilmaydi</b> (faqat oxirgi 7 kun yangilanadi) —
              shuning uchun kundalik arxiv bir necha soniyada tugaydi.
              Eski fayllarni xohlaganingizda o'zingiz o'chirasiz, dastur ularga tegmaydi.
            </div>
          </details>
        </>
      )}
    </div>
  );
}
