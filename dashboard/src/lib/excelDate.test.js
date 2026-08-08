// Excel sana konvertatsiyasi testlari — cd dashboard && npm test
//
// Sana xatosi jimgina o'tadi: yozuv ro'yxatda ko'rinadi, lekin noto'g'ri kunga
// tushadi va kunlik hisobot mos kelmaydi. Shuning uchun asosiy holatlar
// (jumladan haqiqiy .xlsx fayl orqali) qoplangan.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { excelDateToStr } from './excelDate.js';

test('Excel seriya raqami to\'g\'ri sanaga aylanadi', () => {
  // 46209 = 06.07.2026 (Excel epoxasi 1899-12-30)
  assert.strictEqual(excelDateToStr(46209), '06.07.2026');
  assert.strictEqual(excelDateToStr(25569), '01.01.1970');
  assert.strictEqual(excelDateToStr(1),     '31.12.1899');
});

test('natija vaqt zonasiga bog\'liq emas', () => {
  // Asosiy nuqta: sana mahalliy metodlar bilan o'qilsa, manfiy offsetli
  // zonada kun ORQAGA surilardi. Vaqt zonasini shu jarayonda o'zgartirib
  // bo'lmaydi (V8 uni keshlaydi), shuning uchun har zona uchun alohida
  // Node jarayoni ishga tushiriladi — bu haqiqiy tekshiruv.
  const file = fileURLToPath(new URL('./excelDate.js', import.meta.url));
  const code = `import('${pathToFileURL(file).href}').then(m => console.log(m.excelDateToStr(46209)))`;

  for (const tz of ['UTC', 'Asia/Tashkent', 'America/New_York', 'Pacific/Kiritimati']) {
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', code], {
      env: { ...process.env, TZ: tz },
      encoding: 'utf8',
    }).trim();
    assert.strictEqual(out, '06.07.2026', `${tz} zonasida sana surilib ketdi`);
  }
});

test('kun ichidagi vaqt ulushi (1 dan kichik) sana emas', () => {
  assert.strictEqual(excelDateToStr(0.5), '0.5');
});

test('matn ko\'rinishidagi sanalar', () => {
  assert.strictEqual(excelDateToStr('06.07.2026'), '06.07.2026');
  assert.strictEqual(excelDateToStr('6.7.2026'), '06.07.2026');
  assert.strictEqual(excelDateToStr('06.07.2026 14:30'), '06.07.2026');
  assert.strictEqual(excelDateToStr('2026-07-06'), '06.07.2026');
  assert.strictEqual(excelDateToStr('06/07/2026'), '06.07.2026');
});

test('2 xonali yil 20xx deb o\'qiladi (1926 emas)', () => {
  assert.strictEqual(excelDateToStr('06.07.26'), '06.07.2026');
});

test('bo\'sh qiymatlar bo\'sh satr beradi', () => {
  assert.strictEqual(excelDateToStr(''), '');
  assert.strictEqual(excelDateToStr(null), '');
  assert.strictEqual(excelDateToStr(undefined), '');
});

test('tanib bo\'lmagan matn o\'zgarishsiz qoladi', () => {
  assert.strictEqual(excelDateToStr('kelishuvga ko\'ra'), 'kelishuvga ko\'ra');
});

test('Date obyekti mahalliy sana sifatida o\'qiladi', () => {
  assert.strictEqual(excelDateToStr(new Date(2026, 6, 6)), '06.07.2026');
});

// ── Uchidan-uchiga: haqiqiy .xlsx fayl orqali ────────────────────────────────
test('haqiqiy xlsx faylidan o\'qilgan sana to\'g\'ri chiqadi', async () => {
  const XLSX = (await import('xlsx')).default ?? (await import('xlsx'));

  // Foydalanuvchi faylidagi kabi: sana katagi 46209 seriyasi bilan
  const ws = XLSX.utils.aoa_to_sheet([['Mijoz', 'Sana'], ['Ibrat aka', null]]);
  ws['B2'] = { t: 'n', v: 46209, z: 'dd.mm.yyyy' };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Qarzlar');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // ExcelImport bilan bir xil o'qish rejimi
  const wb2  = XLSX.read(buf, { type: 'buffer', cellDates: false });
  const rows = XLSX.utils.sheet_to_json(wb2.Sheets['Qarzlar'], { defval: '' });

  assert.strictEqual(excelDateToStr(rows[0].Sana), '06.07.2026');
});
