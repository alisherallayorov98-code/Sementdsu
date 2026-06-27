import { useData } from '../context/DataContext';
import ExcelExport from '../components/ExcelExport';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');

export default function OverallReport() {
  const {
    // Pullar (to'liq balans — auto-yozuvlar bilan)
    totalCashBalance, totalBankBalance, totalClickBalance,
    // Sement
    totalCementBalance, totalSoldTons, totalRecvTons, totalSalesTons,
    // Moliya naqd
    incomeRows, expenseRows, cashRows, bankRows, clickRows,
    // Moliya bank
    totalBankIncome, totalBankExpense,
    // Moliya click
    totalClickIncome, totalClickExpense,
    // Sotish
    salesRows, soldRows,
    // Qarz va avans
    totalDebts, totalAdvances,
    // Xodimlar
    workers,
    // Haydovchilar
    drivers, driverTrips,
    // Telegram
    tgOrders
  } = useData();

  // ── Hisob-kitoblar ────────────────────────────────────────────────────────
  const kassirKirim  = (arr) => arr.filter(r => !r.auto && Number(r.amount) > 0).reduce((s, r) => s + Number(r.amount), 0);
  const kassirChiqim = (arr) => arr.filter(r => !r.auto && Number(r.amount) < 0).reduce((s, r) => s - Number(r.amount), 0);
  const totalIncome   = incomeRows.reduce((s, r) => s + Number(r.amount), 0) + kassirKirim(cashRows);
  const totalExpense  = expenseRows.reduce((s, r) => s + Number(r.amount), 0) + kassirChiqim(cashRows);
  const totalBankIncomeAll  = Number(totalBankIncome)  + kassirKirim(bankRows);
  const totalBankExpenseAll = Number(totalBankExpense) + kassirChiqim(bankRows);
  const totalClickIncomeAll  = Number(totalClickIncome)  + kassirKirim(clickRows);
  const totalClickExpenseAll = Number(totalClickExpense) + kassirChiqim(clickRows);
  const totalSalesSum = [...salesRows, ...soldRows].reduce((s, r) => s + (Number(r.tons||0) * Number(r.pricePerTon||0)), 0);
  const totalSoldAll  = Number(totalSoldTons || 0) + Number(totalSalesTons || 0);
  
  // Xodimlar qarzi
  const totalWDebt = workers.reduce((s, w) => s + Math.max(0, Number(w.salary) - Number(w.paid)), 0);

  // Haydovchilar qarzi
  const totalDriverDebt = drivers.reduce((sum, d) => {
    const trips = driverTrips.filter(t => t.driverId === d.id);
    const earnings = trips.filter(t => !t.isPayment).reduce((s, t) => s + Number(t.price), 0);
    const paid     = trips.filter(t => t.isPayment).reduce((s, t) => s + Number(t.price), 0);
    return sum + Math.max(0, earnings - paid);
  }, 0);

  // Telegram zakazlar
  const pendingTgTons = tgOrders.filter(o => o.status === 'kutilmoqda').reduce((s, o) => s + Number(o.tons), 0);
  const totalTgTons   = tgOrders.reduce((s, o) => s + Number(o.tons), 0);

  // Jami aktivlar (O'zimizdagi barcha pullar + Odamlarning bizdan qarzi)
  const totalAssets = Number(totalCashBalance) + Number(totalBankBalance) + Number(totalClickBalance) + Number(totalDebts);
  
  // Jami passivlar (Bizning birovlardan qarzimiz)
  const totalLiabilities = Number(totalAdvances) + Number(totalWDebt) + Number(totalDriverDebt);

  // Sof kapital (Aktiv - Passiv)
  const netCapital = totalAssets - totalLiabilities;

  // ── Excel uchun barcha ko'rsatkichlar ──
  const reportRows = [
    { k: "Sof kapital (o'z pulimiz)", v: netCapital, b: "so'm" },
    { k: 'Jami aktivlar', v: totalAssets, b: "so'm" },
    { k: 'Jami majburiyatlar', v: totalLiabilities, b: "so'm" },
    { k: "Naqd pul qoldig'i", v: Number(totalCashBalance || 0), b: "so'm" },
    { k: 'Bank qoldig\'i', v: Number(totalBankBalance || 0), b: "so'm" },
    { k: 'Click qoldig\'i', v: Number(totalClickBalance || 0), b: "so'm" },
    { k: 'Mijozlar bizga qarzi (debitor)', v: Number(totalDebts || 0), b: "so'm" },
    { k: 'Biz olgan avanslar', v: Number(totalAdvances || 0), b: "so'm" },
    { k: 'Ishchilardan qarzimiz', v: totalWDebt, b: "so'm" },
    { k: 'Haydovchilardan qarzimiz', v: totalDriverDebt, b: "so'm" },
    { k: 'Jami naqd kirim', v: totalIncome, b: "so'm" },
    { k: 'Jami naqd chiqim', v: totalExpense, b: "so'm" },
    { k: 'Bank orqali kirim', v: totalBankIncomeAll, b: "so'm" },
    { k: 'Bank orqali chiqim', v: totalBankExpenseAll, b: "so'm" },
    { k: 'Click orqali kirim', v: totalClickIncomeAll, b: "so'm" },
    { k: 'Click orqali chiqim', v: totalClickExpenseAll, b: "so'm" },
    { k: "Joriy sement qoldig'i", v: Number(totalCementBalance || 0), b: 'tn' },
    { k: 'Sotilgan jami sement', v: totalSoldAll, b: 'tn' },
    { k: 'Olingan jami sement', v: Number(totalRecvTons || 0), b: 'tn' },
    { k: 'Barcha savdolar summasi', v: totalSalesSum, b: "so'm" },
    { k: 'Kutilayotgan zakazlar', v: pendingTgTons, b: 'tn' },
    { k: 'Jami tushgan zakazlar', v: totalTgTons, b: 'tn' },
  ];

  return (
    <div style={{ fontFamily: 'Tahoma, Verdana, Arial, sans-serif', paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e3f2fd', paddingBottom: 10, marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ color: '#1565c0', margin: 0 }}>
          Umumiy Moliyaviy Holat (Xulosa)
        </h2>
        <ExcelExport
          filename="Umumiy_hisobot"
          sheetName="Umumiy holat"
          title="Umumiy moliyaviy holat (xulosa)"
          columns={[
            { header: "Ko'rsatkich", key: 'k' },
            { header: 'Qiymat', key: 'v' },
            { header: 'Birlik', key: 'b' },
          ]}
          rows={reportRows}
        />
      </div>

      {/* ── 1. ASOSIY KAPITAL ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 30 }}>
        <MainCard title="Sof Kapital (O'z pulimiz)" value={netCapital} color="#1565c0" bg="#e3f2fd" info="Jami aktivlar - Jami qarzlarimiz" />
        <MainCard title="Jami Aktivlar" value={totalAssets} color="#2e7d32" bg="#e8f5e9" info="Kassa, bank, click + Mijozlar qarzi" />
        <MainCard title="Jami Majburiyatlar" value={totalLiabilities} color="#c62828" bg="#ffebee" info="Olingan avanslar + Ishchi va Haydovchilarga qarzimiz" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        
        {/* ── PULLAR ──────────────────────────────────────────────────────── */}
        <Section title="💰 Kassa va Hisoblar" color="#1a237e">
          <Row label="Naqd pul qoldig'i" val={totalCashBalance} color="#000" bold />
          <Row label="Bank (Karta/Hisob)" val={totalBankBalance} color="#000" bold />
          <Row label="Click (Elektron)" val={totalClickBalance} color="#000" bold />
          <div style={{ height: 1, background: '#ccc', margin: '8px 0' }} />
          <Row label="Hozirgi mavjud barcha pul" val={Number(totalCashBalance) + Number(totalBankBalance) + Number(totalClickBalance)} color="#1565c0" bold />
        </Section>

        {/* ── MOLIYA VA QARZLAR ───────────────────────────────────────────── */}
        <Section title="⚖️ Debitor / Kreditor" color="#bf360c">
          <Row label="Mijozlar bizga qarzi (Debitor)" val={totalDebts} color="#2e7d32" bold />
          <div style={{ height: 1, background: '#ccc', margin: '8px 0' }} />
          <Row label="Biz olingan avanslar" val={totalAdvances} color="#c62828" bold />
          <Row label="Ishchilardan qarzimiz" val={totalWDebt} color="#c62828" bold />
          <Row label="Haydovchilardan qarzimiz" val={totalDriverDebt} color="#c62828" bold />
        </Section>

        {/* ── KIRIM / CHIQIM ──────────────────────────────────────────────── */}
        <Section title="🔄 Aylanma harakatlar" color="#004d40">
          <Row label="Jami naqd kirim" val={totalIncome} color="#2e7d32" />
          <Row label="Jami naqd chiqim" val={totalExpense} color="#c62828" />
          <div style={{ height: 1, background: '#ccc', margin: '8px 0' }} />
          <Row label="Bank orqali kirim" val={totalBankIncomeAll} color="#2e7d32" />
          <Row label="Bank orqali chiqim" val={totalBankExpenseAll} color="#c62828" />
          <div style={{ height: 1, background: '#ccc', margin: '8px 0' }} />
          <Row label="Click orqali kirim" val={totalClickIncomeAll} color="#2e7d32" />
          <Row label="Click orqali chiqim" val={totalClickExpenseAll} color="#c62828" />
        </Section>

        {/* ── SEMENT VA SAVDO ─────────────────────────────────────────────── */}
        <Section title="🏗 Sement va Savdo" color="#ff6f00">
          <Row label="Joriy sement qoldig'i" val={totalCementBalance} unit="tn" color="#ff6f00" bold />
          <Row label="Sotilgan jami sement" val={totalSoldAll} unit="tn" color="#000" />
          <Row label="Olingan jami sement" val={totalRecvTons} unit="tn" color="#000" />
          <div style={{ height: 1, background: '#ccc', margin: '8px 0' }} />
          <Row label="Barcha savdolar summasi" val={totalSalesSum} color="#1565c0" bold />
        </Section>

        {/* ── TELEGRAM ────────────────────────────────────────────────────── */}
        <Section title="📱 Telegram Buyurtmalar" color="#0288d1">
          <Row label="Kutilayotgan zakazlar" val={pendingTgTons} unit="tn" color="#f57f17" bold />
          <Row label="Jami tushgan zakazlar" val={totalTgTons} unit="tn" color="#0288d1" bold />
        </Section>

      </div>
    </div>
  );
}

// ─── Komponentlar ─────────────────────────────────────────────────────────────

function MainCard({ title, value, color, bg, info }) {
  return (
    <div style={{ background: bg, padding: '20px', borderRadius: 8, borderLeft: `6px solid ${color}`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold', color, fontFamily: 'monospace' }}>
        {fmt(value)} <span style={{ fontSize: 14 }}>so'm</span>
      </div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 8, fontStyle: 'italic' }}>ℹ {info}</div>
    </div>
  );
}

function Section({ title, color, children }) {
  return (
    <div style={{ border: `1px solid #e0e0e0`, borderRadius: 6, overflow: 'hidden', background: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
      <div style={{ background: color, color: '#fff', padding: '10px 14px', fontWeight: 'bold', fontSize: 14 }}>
        {title}
      </div>
      <div style={{ padding: '4px 14px 14px 14px' }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, val, unit = "so'm", color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed #eee', fontSize: 13 }}>
      <div style={{ color: '#555' }}>{label}</div>
      <div style={{ fontWeight: bold ? 'bold' : 'normal', color: color || '#333', fontFamily: 'monospace', fontSize: 14 }}>
        {fmt(val)} <span style={{ fontSize: 11, color: '#888' }}>{unit}</span>
      </div>
    </div>
  );
}
