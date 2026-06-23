import { useState } from 'react';
import { useData } from '../context/DataContext';

export default function Login() {
  const { workers, login, appSettings } = useData();
  const [name, setName]         = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !password) { setError("Ism va parolni kiriting."); return; }
    setError(''); setLoading(true);
    // Bitta korxona: tashkilot kiritilmaydi — doim shu bazaga ulanadi
    const ok = await login(name, password);
    setLoading(false);
    if (!ok) setError("Ism yoki parol noto'g'ri (yoki server bilan aloqa yo'q).");
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5', fontFamily: 'Tahoma, sans-serif' }}>
      <div style={{ background: '#fff', padding: 40, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '100%', maxWidth: 400 }}>
        <h2 style={{ textAlign: 'center', color: appSettings.themeColor, marginBottom: 8 }}>{appSettings.appName}</h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: 24 }}>Dasturga kirish</p>

        {error && (
          <div style={{ background: '#ffebee', color: '#c62828', padding: 10, borderRadius: 4, marginBottom: 16, textAlign: 'center', fontSize: 13, border: '1px solid #ef9a9a' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Xodimlar bo'lsa — ro'yxatdan tanlash; bo'lmasa (birinchi kirish) — ism kiritish */}
          {workers.length > 0 ? (
            <div>
              <label style={lbl}>Xodim (Kim kiryapti?)</label>
              <select value={name} onChange={e => setName(e.target.value)} style={inp}>
                <option value="">-- Tanlang --</option>
                {workers.map(w => <option key={w.id} value={w.name}>{w.name} ({w.role})</option>)}
              </select>
            </div>
          ) : (
            <div>
              <div style={{ background: '#e3f2fd', color: '#1565c0', padding: 10, borderRadius: 4, marginBottom: 12, fontSize: 12 }}>
                ℹ️ Tizimda hali xodimlar yo'q. Birinchi kirgan shaxs "Admin" bo'ladi.
              </div>
              <label style={lbl}>Ismingizni kiriting</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Masalan: Boshqaruvchi" style={inp} />
            </div>
          )}

          <div>
            <label style={lbl}>Parol</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Parolingiz" style={inp} />
            {workers.length > 0 && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>* Standart parol: 1234</div>}
          </div>

          <button type="submit" disabled={loading} style={{
            background: appSettings.themeColor, color: '#fff', border: 'none', padding: 12,
            borderRadius: 4, fontSize: 15, fontWeight: 'bold', cursor: loading ? 'wait' : 'pointer', marginTop: 8, opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Iltimos kuting...' : 'Kirish'}
          </button>
        </form>
      </div>
    </div>
  );
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 6 };
const inp = { width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' };
