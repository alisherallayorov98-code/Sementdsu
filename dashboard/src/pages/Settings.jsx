import { useState } from 'react';
import { useData } from '../context/DataContext';
import { api } from '../api';
import ExcelImport from '../components/ExcelImport';

const normName = (s) => String(s ?? '').trim().toLowerCase();
const parseAmount = (v) => Number(String(v ?? '').replace(/\s/g, '').replace(/,/g, '')) || 0;

// Parol yacheykasi: yangi parolni kiriting, eski hashni ko'rsatmaydi
function PasswordCell({ workerId, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  if (!editing) return (
    <button onClick={() => { setVal(''); setEditing(true); }}
      style={{ padding:'3px 10px', cursor:'pointer', background:'#e3f2fd', border:'1px solid #90caf9', borderRadius:4, fontSize:12 }}>
      🔑 O'zgartirish
    </button>
  );
  return (
    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
      <input type="password" value={val} onChange={e => setVal(e.target.value)}
        placeholder="Yangi parol" autoFocus
        style={{ padding:'3px 6px', width:90, borderRadius:3, border:'1px solid #ccc', fontSize:12 }} />
      <button onClick={() => { if (val.trim()) { onSave(val.trim()); setEditing(false); } }}
        style={{ padding:'3px 8px', cursor:'pointer', background:'#2e7d32', color:'#fff', border:'none', borderRadius:3, fontSize:12 }}>✓</button>
      <button onClick={() => setEditing(false)}
        style={{ padding:'3px 8px', cursor:'pointer', background:'#ffcccc', border:'1px solid #c00', borderRadius:3, fontSize:12 }}>✕</button>
    </div>
  );
}

export default function Settings({ lang }) {
  const {
    workers, updateWorker, deleteWorker, addWorker, appSettings, updateAppSettings,
    customers, importCustomers, importDebts,
  } = useData();
  const [tab, setTab] = useState('workers');

  // ── Excel import: Mijozlar ────────────────────────────────────────────────
  const importCustomersHandler = (rows) => {
    const existing = new Set(customers.map(c => normName(c.name)));
    const clean = [];
    let skipped = 0;
    rows.forEach(r => {
      const name = String(r.name || '').trim();
      if (!name || existing.has(normName(name))) { skipped++; return; }
      existing.add(normName(name));
      clean.push({ name, phone: r.phone, address: r.address, note: r.note });
    });
    importCustomers(clean);
    return { added: clean.length, skipped };
  };

  // ── Excel import: Qarzlar ─────────────────────────────────────────────────
  const importDebtsHandler = (rows) => {
    const clean = [];
    let skipped = 0;
    rows.forEach(r => {
      const customer = String(r.customer || '').trim();
      const amount = parseAmount(r.amount);
      if (!customer || amount <= 0) { skipped++; return; }
      clean.push({ customer, amount, note: r.note, date: r.date });
    });
    importDebts(clean);
    return { added: clean.length, skipped };
  };

  // ── Zaxira (backup) funksiyalari ──────────────────────────────────────────
  const handleExport = async () => {
    try {
      const state = await api.getState();
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `sement-zaxira-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Zaxira olishda xato. Server ishlayotganini tekshiring.");
    }
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm("DIQQAT! Tiklash hozirgi BARCHA ma'lumotni zaxiradagi ma'lumotga almashtiradi. Davom etamizmi?")) {
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        await api.saveState(parsed);
        alert("Ma'lumotlar tiklandi! Dastur yangilanadi.");
        window.location.reload();
      } catch {
        alert("Fayl noto'g'ri yoki buzilgan. Tiklab bo'lmadi.");
      }
    };
    reader.readAsText(file);
  };

  // Xodim qo'shish formasi
  const [newW, setNewW] = useState({ name: '', role: 'sotuvchi', password: '1234', position: '' });
  
  // App sozlamalari formasi
  const [appF, setAppF] = useState(appSettings);

  const handleAddWorker = (e) => {
    e.preventDefault();
    if (newW.name) {
      addWorker(newW.name, 0, newW);
      setNewW({ name: '', role: 'sotuvchi', password: '1234', position: '' });
    }
  };

  const handleSaveApp = (e) => {
    e.preventDefault();
    updateAppSettings(appF);
    alert("Saqlandi! Tizim ranglari va nomlari o'zgardi.");
  };

  const inp = { padding: '8px 12px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4, width: '100%', boxSizing: 'border-box' };
  const btn = { padding: '8px 16px', background: appSettings.themeColor, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' };

  return (
    <div style={{ fontFamily: 'Tahoma, sans-serif' }}>
      
      {/* TABS */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '2px solid #eee', marginBottom: 20 }}>
        <button 
          onClick={() => setTab('workers')} 
          style={{ padding: '10px 20px', background: tab === 'workers' ? appSettings.themeColor : 'transparent', color: tab === 'workers' ? '#fff' : '#555', border: 'none', borderRadius: '4px 4px 0 0', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Xodimlar va Rollar
        </button>
        <button 
          onClick={() => setTab('app')} 
          style={{ padding: '10px 20px', background: tab === 'app' ? appSettings.themeColor : 'transparent', color: tab === 'app' ? '#fff' : '#555', border: 'none', borderRadius: '4px 4px 0 0', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Dastur Sozlamalari
        </button>
        <button
          onClick={() => setTab('import')}
          style={{ padding: '10px 20px', background: tab === 'import' ? appSettings.themeColor : 'transparent', color: tab === 'import' ? '#fff' : '#555', border: 'none', borderRadius: '4px 4px 0 0', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Excel Import
        </button>
        <button
          onClick={() => setTab('backup')}
          style={{ padding: '10px 20px', background: tab === 'backup' ? appSettings.themeColor : 'transparent', color: tab === 'backup' ? '#fff' : '#555', border: 'none', borderRadius: '4px 4px 0 0', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Zaxira (Backup)
        </button>
      </div>

      {/* EXCEL IMPORT TABI */}
      {tab === 'import' && (
        <div style={{ maxWidth: 760 }}>
          <div style={{ fontSize: 13, color: '#555', background: '#e3f2fd', border: '1px solid #bbdefb', padding: 12, borderRadius: 6, marginBottom: 16, lineHeight: 1.6 }}>
            <strong style={{ color: '#1565c0' }}>MoySklad yoki boshqa joydan ma'lumot ko'chirish:</strong>
            <ol style={{ margin: '6px 0 0 18px', padding: 0 }}>
              <li>Kerakli bo'lim shablonini yuklab oling.</li>
              <li>Excel'da ustunlarga ma'lumotni to'ldiring (sarlavha qatorini o'zgartirmang).</li>
              <li>Faylni qaytadan shu yerga yuklang va "Import qilish"ni bosing.</li>
            </ol>
          </div>

          <ExcelImport
            title="👥 Mijozlar bazasini import qilish"
            color="#00695c"
            sheetName="Mijozlar"
            templateName="mijozlar-shablon.xlsx"
            hint="Bir xil ismli mijoz allaqachon bo'lsa, qayta qo'shilmaydi (o'tkazib yuboriladi)."
            columns={[
              { key: 'name',    header: 'Ism',     aliases: ['nomi', 'mijoz', 'name', 'фио', 'наименование'], required: true },
              { key: 'phone',   header: 'Telefon', aliases: ['tel', 'phone', 'телефон'] },
              { key: 'address', header: 'Manzil',  aliases: ['address', 'adres', 'адрес'] },
              { key: 'note',    header: 'Izoh',    aliases: ['note', 'eslatma', 'комментарий'] },
            ]}
            onImport={importCustomersHandler}
          />

          <ExcelImport
            title="💳 Qarzlar ro'yxatini import qilish"
            color="#c62828"
            sheetName="Qarzlar"
            templateName="qarzlar-shablon.xlsx"
            hint="Summa raqam bo'lishi kerak (masalan: 1500000). Bo'sh yoki noto'g'ri summa o'tkazib yuboriladi."
            columns={[
              { key: 'customer', header: 'Mijoz',        aliases: ['ism', 'name', 'контрагент'], required: true },
              { key: 'amount',   header: 'Qarz summasi', aliases: ['summa', 'qarz', 'amount', 'сумма', 'долг'], required: true },
              { key: 'note',     header: 'Izoh',         aliases: ['note', 'комментарий'] },
              { key: 'date',     header: 'Sana',         aliases: ['date', 'дата'] },
            ]}
            onImport={importDebtsHandler}
          />
        </div>
      )}

      {/* ZAXIRA TABI */}
      {tab === 'backup' && (
        <div style={{ maxWidth: 640 }}>
          <div style={{ background: '#f9f9f9', padding: 24, borderRadius: 8, border: '1px solid #eee' }}>
            <h3 style={{ marginTop: 0, color: appSettings.themeColor }}>Ma'lumotlar zaxirasi</h3>
            <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
              Barcha ma'lumotlar serverda saqlanadi va har soatda avtomatik zaxiralanadi.
              Qo'shimcha xavfsizlik uchun vaqti-vaqti bilan zaxirani faylga yuklab oling
              va USB yoki bulutga (Telegram, Google Drive) saqlab qo'ying.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
              <button onClick={handleExport} style={{ ...btn, padding: '12px 20px' }}>
                ⬇️ Zaxirani yuklab olish (JSON)
              </button>

              <label style={{ ...btn, padding: '12px 20px', background: '#455a64', display: 'inline-block' }}>
                ⬆️ Zaxiradan tiklash (fayldan)
                <input type="file" accept="application/json,.json" onChange={handleImport} style={{ display: 'none' }} />
              </label>
            </div>

            <div style={{ fontSize: 12, color: '#b71c1c', background: '#ffebee', border: '1px solid #ef9a9a', padding: 10, borderRadius: 4, marginTop: 16 }}>
              ⚠️ <strong>Diqqat:</strong> "Tiklash" hozirgi barcha ma'lumotni faylga almashtiradi.
              Faqat ishonchli zaxira fayli bilan ishlating.
            </div>
          </div>
        </div>
      )}

      {/* XODIMLAR TABI */}
      {tab === 'workers' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
          
          {/* Yangi qo'shish */}
          <div style={{ background: '#f9f9f9', padding: 20, borderRadius: 8, border: '1px solid #eee', alignSelf: 'start' }}>
            <h3 style={{ marginTop: 0, color: appSettings.themeColor }}>Yangi xodim qo'shish</h3>
            <form onSubmit={handleAddWorker} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Ism (Login nomi)</label>
                <input type="text" value={newW.name} onChange={e => setNewW({...newW, name: e.target.value})} style={inp} required />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Roli (Ruxsatlari)</label>
                <select value={newW.role} onChange={e => setNewW({...newW, role: e.target.value})} style={inp}>
                  <option value="admin">Admin (Hamma joyga ruxsat)</option>
                  <option value="sotuvchi">Sotuvchi (Kassa, Savdo, Ombor)</option>
                  <option value="omborchi">Omborchi (Faqat Ombor va Yuk qabul qilish)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Parol (Kirish uchun)</label>
                <input type="text" value={newW.password} onChange={e => setNewW({...newW, password: e.target.value})} style={inp} required />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Lavozimi (Izoh)</label>
                <input type="text" value={newW.position} onChange={e => setNewW({...newW, position: e.target.value})} style={inp} />
              </div>
              <button type="submit" style={btn}>+ Qo'shish</button>
            </form>
          </div>

          {/* Mavjud xodimlar ro'yxati */}
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ background: appSettings.themeColor, color: '#fff' }}>
                <tr>
                  <th style={{ padding: 12 }}>Ism (Login)</th>
                  <th style={{ padding: 12 }}>Rol</th>
                  <th style={{ padding: 12 }}>Parol</th>
                  <th style={{ padding: 12 }}>Lavozim</th>
                  <th style={{ padding: 12 }}>Boshqarish</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w, i) => (
                  <tr key={w.id} style={{ borderBottom: '1px solid #eee', background: i % 2 === 0 ? '#fff' : '#fcfcfc' }}>
                    <td style={{ padding: 12, fontWeight: 'bold' }}>{w.name}</td>
                    <td style={{ padding: 12 }}>
                      <select value={w.role || 'sotuvchi'} onChange={(e) => updateWorker(w.id, { role: e.target.value })} style={{ padding: 4, borderRadius: 4, border: '1px solid #ccc' }}>
                        <option value="admin">Admin</option>
                        <option value="sotuvchi">Sotuvchi</option>
                        <option value="omborchi">Omborchi</option>
                      </select>
                    </td>
                    <td style={{ padding: 12 }}>
                      <PasswordCell workerId={w.id} onSave={(newPwd) => updateWorker(w.id, { password: newPwd })} />
                    </td>
                    <td style={{ padding: 12, fontSize: 13, color: '#555' }}>{w.position || '—'}</td>
                    <td style={{ padding: 12 }}>
                      <button onClick={() => { if(window.confirm("Rostdan ham o'chirasizmi?")) deleteWorker(w.id) }} style={{ background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: 4, cursor: 'pointer', padding: '4px 8px' }}>
                        O'chirish
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: 12, fontSize: 12, color: '#666', background: '#fff9c4' }}>
              ℹ️ Izoh: Rolni yoki parolni o'zgartirganingiz zahoti saqlanadi. Xodim yangi paroli bilan kirishi kerak bo'ladi.
            </div>
          </div>

        </div>
      )}

      {/* APP SOZLAMALARI TABI */}
      {tab === 'app' && (
        <div style={{ maxWidth: 600 }}>
          <form onSubmit={handleSaveApp} style={{ background: '#f9f9f9', padding: 24, borderRadius: 8, border: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 'bold', color: '#444', marginBottom: 6, display: 'block' }}>Dastur nomi (Tepada chiqadigan yozuv)</label>
              <input type="text" value={appF.appName} onChange={e => setAppF({...appF, appName: e.target.value})} style={inp} />
            </div>
            
            <div>
              <label style={{ fontSize: 13, fontWeight: 'bold', color: '#444', marginBottom: 6, display: 'block' }}>Dastur Asosiy Rangi (Theme Color)</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="color" value={appF.themeColor} onChange={e => setAppF({...appF, themeColor: e.target.value})} style={{ width: 50, height: 40, cursor: 'pointer' }} />
                <span style={{ fontFamily: 'monospace' }}>{appF.themeColor}</span>
              </div>
            </div>

            {/* Chek (sotuv cheki) uchun ma'lumotlar */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 'bold', color: '#1565c0', marginBottom: 8 }}>🧾 Chekda chiqadigan korxona ma'lumotlari</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#555', marginBottom: 4, display: 'block' }}>Korxona telefoni (chek tepasida)</label>
                  <input type="text" placeholder="+998 90 000 00 00" value={appF.companyPhone || ''} onChange={e => setAppF({...appF, companyPhone: e.target.value})} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#555', marginBottom: 4, display: 'block' }}>Korxona manzili (chek tepasida)</label>
                  <input type="text" placeholder="Shahar, ko'cha..." value={appF.companyAddress || ''} onChange={e => setAppF({...appF, companyAddress: e.target.value})} style={inp} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#444', cursor: 'pointer', background: '#fff', border: '1px solid #c5e1a5', borderRadius: 6, padding: '8px 10px' }}>
                  <input type="checkbox" checked={appF.autoPrintReceipt !== false} onChange={e => setAppF({...appF, autoPrintReceipt: e.target.checked})} />
                  <span><b>Sotuvdan keyin chek avtomatik chiqsin</b><br/><span style={{ fontSize: 11, color: '#777' }}>Kassa sotuvida har bir sotuvdan so'ng chek darrov chop etiladi (majburiy rejim).</span></span>
                </label>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 'bold', color: '#444', marginBottom: 6, display: 'block' }}>Telegram Bot</label>
              <div style={{ fontSize: 12, color: '#666', background: '#e3f2fd', padding: 10, borderRadius: 4, border: '1px solid #bbdefb' }}>
                <strong style={{ color: '#1565c0' }}>Bot endi serverda (backend) boshqariladi.</strong>
                <p style={{ margin: '6px 0' }}>
                  Xavfsizlik uchun bot tokeni brauzerda emas, balki serverda — <code>backend/.env</code> faylida saqlanadi.
                  Botni ulash uchun:
                </p>
                <ol style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  <li>Telegramda <strong>@BotFather</strong> ni toping, <code>/newbot</code> ni bosing va token oling.</li>
                  <li><code>backend/.env</code> faylida <code>TELEGRAM_BOT_TOKEN=...</code> qatoriga tokenni yozing.</li>
                  <li>Backend serverini qayta ishga tushiring.</li>
                  <li>Endi botga yozilgan zakazlar avtomatik <strong>Telegram zakaz</strong> bo'limiga tushadi (ovozli signal bilan).</li>
                </ol>
              </div>
            </div>

            {/* Mijozga xabar yuborish — qo'llanma */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 'bold', color: '#444', marginBottom: 6, display: 'block' }}>📨 Mijozga xabar yuborish (Telegram / SMS)</label>
              <div style={{ fontSize: 12, color: '#666', background: '#f1f8e9', padding: 10, borderRadius: 4, border: '1px solid #c5e1a5' }}>
                <p style={{ margin: '0 0 6px' }}><strong style={{ color: '#2e7d32' }}>📱 Telegram (bepul):</strong> Mijoz botingizga kirib <code>/ulash</code> yozadi va "📱 Raqamni ulashish" tugmasini bosadi. Shundan so'ng uning kartochkasida "Telegram ulangan ✓" chiqadi va siz kompyuterdan xabar yuborasiz.</p>
                <p style={{ margin: '0 0 6px' }}><strong style={{ color: '#1565c0' }}>✉️ SMS (Eskiz.uz):</strong> <code>backend/.env</code> fayliga <code>ESKIZ_EMAIL</code>, <code>ESKIZ_PASSWORD</code> va <code>ESKIZ_FROM</code> (tasdiqlangan nom) yozing va backendni qayta ishga tushiring. SMS pullik — Eskiz balansingizdan yechiladi.</p>
                <p style={{ margin: 0 }}><strong style={{ color: '#6a1b9a' }}>📞 Qo'ng'iroq:</strong> Mijoz telefoni yonidagi 📞 tugmasi (mobil/planshetda) dialerni ochadi.</p>
                <p style={{ margin: '6px 0 0', fontStyle: 'italic' }}>Xabar yuborish: mijoz kartochkasi, "Sotish" yoki "Qarzlar" sahifasidagi ✉️ tugmasi orqali.</p>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px dashed #ccc', margin: '10px 0' }} />

            <button type="submit" style={{ ...btn, padding: '12px', fontSize: 16 }}>💾 Saqlash va Qo'llash</button>
          </form>
        </div>
      )}

    </div>
  );
}
