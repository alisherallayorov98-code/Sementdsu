// ─────────────────────────────────────────────────────────────────────────────
// Sotuv cheki — mijozga beriladigan chek (chop etish).
// 80mm termal printer yoki oddiy A4/A5 varaqqa mos (tor, markazlashgan).
// printSaleReceipt(sale, opts) — yangi oynada ochib, chop etish oynasini chiqaradi.
// ─────────────────────────────────────────────────────────────────────────────

const fmt  = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtT = (n) => { const v = Number(n || 0); return v % 1 === 0 ? String(v) : v.toFixed(2); };

const CHANNEL = {
  naqd:   "Naqd pul",
  bank:   "Bank (o'tkazma)",
  click:  "Click",
  nasiya: "Nasiya (qarzga)",
};

const timeOf = (ts) => {
  if (!ts || ts < 1e10) return '';
  const d = new Date(ts);
  return [String(d.getHours()).padStart(2, '0'), String(d.getMinutes()).padStart(2, '0')].join(':');
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function printSaleReceipt(sale, opts = {}) {
  const { appName = 'SEMENT', phone = '', address = '', qolganQarz = null } = opts;

  const tons  = Number(sale.tons || 0);
  const price = Number(sale.pricePerTon || 0);
  const total = tons * price;
  const num   = String(sale.id || Date.now()).slice(-6);
  const channel = sale.paymentChannel || 'naqd';
  const isNasiya = channel === 'nasiya';

  const html = `<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8" />
<title>Chek #${num}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; color: #000; margin: 0; padding: 10px 12px; width: 300px; }
  .center { text-align: center; }
  .name { font-size: 16px; font-weight: bold; text-transform: uppercase; }
  .muted { color: #333; font-size: 11px; }
  .hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
  .title { font-size: 13px; font-weight: bold; letter-spacing: 1px; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; font-size: 12px; margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 4px 0; }
  th, td { text-align: left; padding: 3px 2px; }
  th { border-bottom: 1px solid #000; font-size: 11px; }
  td.r, th.r { text-align: right; }
  .total { font-size: 17px; font-weight: bold; }
  .pay { font-size: 13px; font-weight: bold; margin-top: 4px; }
  .nasiya { color: #000; background: #eee; padding: 4px 6px; font-weight: bold; text-align: center; border: 1px solid #000; }
  .foot { font-size: 11px; text-align: center; margin-top: 10px; }
  .sign { display: flex; justify-content: space-between; font-size: 11px; margin-top: 18px; }
  @media print { body { width: 80mm; } @page { margin: 4mm; } }
</style></head>
<body>
  <div class="center">
    <div class="name">${esc(appName)}</div>
    ${address ? `<div class="muted">${esc(address)}</div>` : ''}
    ${phone ? `<div class="muted">Tel: ${esc(phone)}</div>` : ''}
  </div>
  <hr class="hr" />
  <div class="center title">SOTUV CHEKI</div>
  <div class="row"><span>Chek №:</span><b>${num}</b></div>
  <div class="row"><span>Sana:</span><span>${esc(sale.date || '')} ${timeOf(sale.createdAt)}</span></div>
  <div class="row"><span>Mijoz:</span><b>${esc(sale.customer || '—')}</b></div>
  ${sale.worker ? `<div class="row"><span>Sotuvchi:</span><span>${esc(sale.worker)}</span></div>` : ''}
  <hr class="hr" />
  <table>
    <thead><tr><th>Mahsulot</th><th class="r">Miqdor</th><th class="r">Narx</th><th class="r">Summa</th></tr></thead>
    <tbody>
      <tr>
        <td>Sement${(sale.note || sale.izoh) ? `<br/><span class="muted">${esc(sale.note || sale.izoh)}</span>` : ''}</td>
        <td class="r">${fmtT(tons)} tn</td>
        <td class="r">${fmt(price)}</td>
        <td class="r">${fmt(total)}</td>
      </tr>
    </tbody>
  </table>
  <hr class="hr" />
  <div class="row total"><span>JAMI:</span><span>${fmt(total)} so'm</span></div>
  <div class="row pay"><span>To'lov turi:</span><span>${CHANNEL[channel] || channel}</span></div>
  ${isNasiya ? `<div class="nasiya">⚠ QARZGA YOZILDI: ${fmt(total)} so'm</div>` : ''}
  ${qolganQarz != null && qolganQarz > 0 ? `<div class="row" style="margin-top:6px"><span>Umumiy qolgan qarz:</span><b>${fmt(qolganQarz)} so'm</b></div>` : ''}
  <div class="foot">Xaridingiz uchun rahmat! 🙏</div>
  <div class="sign"><span>Sotuvchi: ______</span><span>Mijoz: ______</span></div>
</body></html>`;

  const win = window.open('', '_blank', 'width=380,height=640');
  if (!win) { alert("Chop etish oynasi ochilmadi. Brauzer 'popup' ruxsatini bering."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  // Kontent yuklangach chop etish
  setTimeout(() => { try { win.print(); } catch { /* ignore */ } }, 250);
}
