// ─────────────────────────────────────────────────────────────────────────────
// Mijozga xabar yuborish oynasi — Telegram va/yoki SMS, + bir bosishda qo'ng'iroq.
// Props: name, phone, defaultText, onClose
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../context/DataContext';
import { api } from '../api';

export default function NotifyModal({ name = '', phone = '', defaultText = '', onClose }) {
  const { tgChatIdFor, notifyMeta } = useData();

  const tgLinked = !!tgChatIdFor(phone);
  const tgAvailable = notifyMeta.botRunning && tgLinked;
  const smsAvailable = notifyMeta.smsConfigured && !!phone;

  const [text, setText]   = useState(defaultText);
  const [useTg, setUseTg] = useState(tgAvailable);
  const [useSms, setUseSms] = useState(!tgAvailable && smsAvailable);
  const [busy, setBusy]   = useState(false);
  const [result, setResult] = useState(null);

  const send = async () => {
    const channels = [];
    if (useTg) channels.push('telegram');
    if (useSms) channels.push('sms');
    if (!channels.length) { alert('Kamida bitta kanal tanlang.'); return; }
    if (!text.trim()) { alert('Xabar matnini yozing.'); return; }
    setBusy(true); setResult(null);
    try {
      const r = await api.notify({ phone, text, channels });
      setResult(r.result || {});
    } catch (e) {
      setResult({ _error: e.message });
    } finally {
      setBusy(false);
    }
  };

  const Channel = ({ on, set, label, available, hint, checked }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, border: `1px solid ${checked ? '#1565c0' : '#ddd'}`, background: checked ? '#e3f2fd' : '#fafafa', cursor: available ? 'pointer' : 'not-allowed', opacity: available ? 1 : 0.55 }}>
      <input type="checkbox" checked={checked} disabled={!available} onChange={e => set(e.target.checked)} />
      <span>
        <b>{label}</b>
        <span style={{ display: 'block', fontSize: 11, color: '#777' }}>{hint}</span>
      </span>
    </label>
  );

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 440, fontFamily: 'Tahoma, sans-serif' }}>
        <div style={{ background: '#003366', color: '#fff', padding: '12px 16px', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b>✉️ Xabar yuborish</b>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 14, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ marginBottom: 10, fontSize: 13 }}>
            <b>{name || 'Mijoz'}</b>{' '}
            {phone
              ? <a href={`tel:${phone}`} style={{ color: '#1565c0', textDecoration: 'none' }}>📞 {phone}</a>
              : <span style={{ color: '#c62828' }}>(telefon yo'q)</span>}
          </div>

          {/* Kanallar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            <Channel checked={useTg} set={setUseTg} available={tgAvailable} label="📱 Telegram"
              hint={!notifyMeta.botRunning ? 'Bot ishlamayapti (token kiritilmagan)' : (tgLinked ? 'Ulangan ✓ — bepul' : 'Mijoz raqamini ulamagan')} />
            <Channel checked={useSms} set={setUseSms} available={smsAvailable} label="✉️ SMS"
              hint={!notifyMeta.smsConfigured ? 'SMS sozlanmagan (Eskiz)' : (phone ? 'Eskiz orqali' : 'Telefon yo\'q')} />
          </div>

          <textarea value={text} onChange={e => setText(e.target.value)} rows={5}
            placeholder="Xabar matni..."
            style={{ width: '100%', boxSizing: 'border-box', padding: 10, fontSize: 13, border: '1px solid #ccc', borderRadius: 6, resize: 'vertical', fontFamily: 'Tahoma, sans-serif' }} />
          <div style={{ fontSize: 11, color: '#999', textAlign: 'right', marginTop: 2 }}>{text.length} belgi</div>

          {/* Natija */}
          {result && (
            <div style={{ margin: '8px 0', fontSize: 12 }}>
              {result._error && <div style={{ color: '#c62828' }}>Xato: {result._error}</div>}
              {result.telegram && <div style={{ color: result.telegram.ok ? '#2e7d32' : '#c62828' }}>📱 Telegram: {result.telegram.ok ? 'yuborildi ✓' : result.telegram.error}</div>}
              {result.sms && <div style={{ color: result.sms.ok ? '#2e7d32' : '#c62828' }}>✉️ SMS: {result.sms.ok ? 'yuborildi ✓' : result.sms.error}</div>}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={send} disabled={busy} style={{ flex: 1, padding: '9px 0', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: busy ? 'wait' : 'pointer' }}>
              {busy ? 'Yuborilmoqda...' : '✓ Yuborish'}
            </button>
            {phone && (
              <a href={`tel:${phone}`} style={{ padding: '9px 16px', background: '#1565c0', color: '#fff', borderRadius: 6, fontWeight: 'bold', textDecoration: 'none' }}>📞 Qo'ng'iroq</a>
            )}
            <button onClick={onClose} style={{ padding: '9px 16px', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer' }}>Yopish</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
