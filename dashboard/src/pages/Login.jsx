import { useState } from 'react';
import { useData } from '../context/DataContext';

export default function Login({ lang }) {
  const { workers, login, appSettings } = useData();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!name || !password) {
      setError("Ism va parolni kiriting.");
      return;
    }
    setError('');
    setLoading(true);
    const success = await login(name, password);
    setLoading(false);
    if (!success) {
      setError("Ism yoki parol noto'g'ri (yoki server bilan aloqa yo'q).");
    }
  };

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', background: '#f0f2f5', fontFamily: 'Tahoma, sans-serif'
    }}>
      <div style={{
        background: '#fff', padding: '40px', borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '100%', maxWidth: 400
      }}>
        <h2 style={{ textAlign: 'center', color: appSettings.themeColor, marginBottom: 8 }}>
          {appSettings.appName}
        </h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: 24 }}>
          Dasturga kirish uchun o'zingizni tanlang va parolni kiriting.
        </p>

        {error && (
          <div style={{ background: '#ffebee', color: '#c62828', padding: '10px', borderRadius: 4, marginBottom: 16, textAlign: 'center', fontSize: 13, border: '1px solid #ef9a9a' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {workers.length > 0 ? (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 6 }}>Xodim (Kim kiryapti?)</label>
              <select 
                value={name} onChange={e => setName(e.target.value)}
                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14 }}
              >
                <option value="">-- Tanlang --</option>
                {workers.map(w => (
                  <option key={w.id} value={w.name}>{w.name} ({w.role})</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <div style={{ background: '#e3f2fd', color: '#1565c0', padding: '10px', borderRadius: 4, marginBottom: 12, fontSize: 12 }}>
                ℹ️ Tizimda hali xodimlar yo'q. Birinchi kirgan shaxs avtomatik "Admin" bo'ladi.
              </div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 6 }}>Ismingizni kiriting</label>
              <input 
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Masalan: Boshqaruvchi"
                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 6 }}>Parol</label>
            <input 
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Parolingizni kiriting"
              style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }}
            />
            {workers.length > 0 && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>* Standart parol: 1234</div>
            )}
          </div>

          <button type="submit" disabled={loading} style={{
            background: appSettings.themeColor, color: '#fff', border: 'none', padding: '12px',
            borderRadius: 4, fontSize: 15, fontWeight: 'bold', cursor: loading ? 'wait' : 'pointer',
            marginTop: 8, opacity: loading ? 0.7 : 1
          }}>
            {loading ? 'Kirilmoqda...' : 'Kirish'}
          </button>
        </form>
      </div>
    </div>
  );
}
