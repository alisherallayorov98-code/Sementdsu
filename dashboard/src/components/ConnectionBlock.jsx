// ─────────────────────────────────────────────────────────────────────────────
// Server bilan aloqa yo'q ekranidagi to'siq.
//
// Nega butun ilova bloklanadi: dastur butun holatni bitta PUT bilan saqlaydi va
// serverdan yuklab bo'lmagan bo'lsa saqlash ham to'xtatiladi (aks holda eski
// lokal nusxa serverdagi to'g'ri ma'lumot ustiga yozilardi). Bunday holatda
// ishlashga ruxsat berish = yozuvlarni yo'qotish: aloqa tiklangan zahoti holat
// serverdagi nusxa bilan almashtiriladi va kiritilganlar ketadi.
//
// Aloqa avtomatik qayta urinib turiladi (DataContext, 15 soniyada bir marta) —
// tiklangach bu ekran o'zi yo'qoladi, foydalanuvchi hech nima qilmaydi.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';

export default function ConnectionBlock({ themeColor = '#003366', onLogout }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#f4f5f7',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      fontFamily: 'Tahoma, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 8, maxWidth: 480, width: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)', overflow: 'hidden',
      }}>
        <div style={{ background: themeColor, color: '#fff', padding: '14px 20px', fontWeight: 'bold', fontSize: 15 }}>
          ⚠ Server bilan aloqa yo'q
        </div>
        <div style={{ padding: 22, fontSize: 13.5, color: '#333', lineHeight: 1.7 }}>
          <p style={{ marginTop: 0 }}>
            Ma'lumotlar serverdan yuklanmadi. <strong>Ma'lumot kiritish vaqtincha to'xtatildi</strong> —
            aks holda yozganlaringiz saqlanmay yo'qolib ketardi.
          </p>
          <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 6, padding: '10px 14px', fontSize: 12.5, color: '#6d4c41' }}>
            Ulanish avtomatik qayta urinilmoqda ({secs} soniya). Aloqa tiklanishi bilan
            dastur o'zi ochiladi — sahifani yangilash shart emas.
          </div>
          <p style={{ fontSize: 12.5, color: '#666', marginBottom: 0 }}>
            Uzoq davom etsa: internetni tekshiring yoki server ishlayotganiga ishonch hosil qiling.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '8px 16px', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', fontSize: 13, background: themeColor, color: '#fff' }}
            >
              🔄 Qayta urinish
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 13, background: '#fff', color: '#555' }}
              >
                Chiqish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
