import { useState } from 'react';
import { useData } from '../context/DataContext';

export default function Login() {
  const { workers, login, signup, appSettings } = useData();
  const [mode, setMode]     = useState('login'); // 'login' | 'signup'
  const [name, setName]     = useState('');
  const [password, setPassword] = useState('');
  const [account, setAccount]   = useState(''); // tashkilot (SaaS uchun; bo'sh = lokal)
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !password) { setError("Ism va parolni kiriting."); return; }
    if (mode === 'signup' && !account) { setError("Tashkilot nomini kiriting (lotin harf/raqam)."); return; }
    setError(''); setLoading(true);

    if (mode === 'signup') {
      const res = await signup(account, name, password);
      setLoading(false);
      if (!res.ok) setError(res.error || "Ro'yxatdan o'tib bo'lmadi.");
    } else {
      const ok = await login(name, password, account);
      setLoading(false);
      if (!ok) setError("Ism yoki parol noto'g'ri (yoki server bilan aloqa yo'q).");
    }
  };

  const isSignup = mode === 'signup';

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5', fontFamily: 'Tahoma, sans-serif' }}>
      <div style={{ background: '#fff', padding: 40, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '100%', maxWidth: 400 }}>
        <h2 style={{ textAlign: 'center', color: appSettings.themeColor, marginBottom: 8 }}>{appSettings.appName}</h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: 24 }}>
          {isSignup ? "Yangi tashkilot ochish" : "Dasturga kirish"}
        </p>

        {error && (
          <div style={{ background: '#ffebee', color: '#c62828', padding: 10, borderRadius: 4, marginBottom: 16, textAlign: 'center', fontSize: 13, border: '1px solid #ef9a9a' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tashkilot — signup'da majburiy; login'da ixtiyoriy (bo'sh = lokal/asosiy) */}
          {(isSignup || account || workers.length === 0) && (
            <div>
              <label style={lbl}>Tashkilot {isSignup ? '*' : '(ixtiyoriy)'}</label>
              <input type="text" value={account} onChange={e => setAccount(e.target.value)}
                placeholder="masalan: sement_korxona (lotin, bo'sh joysiz)"
                style={inp} />
            </div>
          )}

          {/* Login rejimida xodimlar bo'lsa — ro'yxatdan tanlash */}
          {!isSignup && workers.length > 0 ? (
            <div>
              <label style={lbl}>Xodim (Kim kiryapti?)</label>
              <select value={name} onChange={e => setName(e.target.value)} style={inp}>
                <option value="">-- Tanlang --</option>
                {workers.map(w => <option key={w.id} value={w.name}>{w.name} ({w.role})</option>)}
              </select>
            </div>
          ) : (
            <div>
              {!isSignup && (
                <div style={{ background: '#e3f2fd', color: '#1565c0', padding: 10, borderRadius: 4, marginBottom: 12, fontSize: 12 }}>
                  ℹ️ Tizimda hali xodimlar yo'q. Birinchi kirgan shaxs "Admin" bo'ladi.
                </div>
              )}
              <label style={lbl}>{isSignup ? 'Admin ismi' : 'Ismingizni kiriting'}</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Masalan: Boshqaruvchi" style={inp} />
            </div>
          )}

          <div>
            <label style={lbl}>Parol</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Parolingiz" style={inp} />
            {!isSignup && workers.length > 0 && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>* Standart parol: 1234</div>}
          </div>

          <button type="submit" disabled={loading} style={{
            background: appSettings.themeColor, color: '#fff', border: 'none', padding: 12,
            borderRadius: 4, fontSize: 15, fontWeight: 'bold', cursor: loading ? 'wait' : 'pointer', marginTop: 8, opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Iltimos kuting...' : (isSignup ? "Ro'yxatdan o'tish" : 'Kirish')}
          </button>
        </form>

        {/* Rejim almashtirish */}
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12 }}>
          {isSignup ? (
            <button onClick={() => { setMode('login'); setError(''); }} style={linkBtn}>← Kirishga qaytish</button>
          ) : (
            <button onClick={() => { setMode('signup'); setError(''); setName(''); }} style={linkBtn}>+ Yangi tashkilot ochish</button>
          )}
        </div>
      </div>
    </div>
  );
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 6 };
const inp = { width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' };
const linkBtn = { background: 'none', border: 'none', color: '#1565c0', cursor: 'pointer', textDecoration: 'underline', fontSize: 12 };
