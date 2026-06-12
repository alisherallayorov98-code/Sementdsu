import { useState } from 'react';
import { useData } from '../context/DataContext';

export default function Settings({ lang }) {
  const { workers, updateWorker, deleteWorker, addWorker, appSettings, updateAppSettings } = useData();
  const [tab, setTab] = useState('workers');

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
      </div>

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
                      <input type="text" value={w.password || '1234'} onChange={(e) => updateWorker(w.id, { password: e.target.value })} style={{ padding: 4, width: 80, borderRadius: 4, border: '1px solid #ccc' }} />
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

            <div>
              <label style={{ fontSize: 13, fontWeight: 'bold', color: '#444', marginBottom: 6, display: 'block' }}>Telegram Bot Token</label>
              <input type="text" value={appF.tgToken} onChange={e => setAppF({...appF, tgToken: e.target.value})} placeholder="123456789:AAHx..." style={inp} />
              <div style={{ fontSize: 12, color: '#666', marginTop: 8, background: '#e3f2fd', padding: 10, borderRadius: 4, border: '1px solid #bbdefb' }}>
                <strong style={{ color: '#1565c0' }}>Botni qanday ulaymiz?</strong>
                <ol style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  <li>Telegramga kirib <strong>@BotFather</strong> ni toping va <code>/newbot</code> ni bosing.</li>
                  <li>Botga ism va username bering.</li>
                  <li>U bergan <strong>HTTP API Token</strong> ni nusxalab shu yerga yozing.</li>
                  <li>Saqlashni bosing. Endi xohlagan odam telegramda botingizga yozsa (ichida raqami bo'lsa), dasturga <strong>Yangi Zakaz</strong> bo'lib tushadi! (Ovozli signal bilan)</li>
                </ol>
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
