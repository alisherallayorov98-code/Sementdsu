// ─────────────────────────────────────────────────────────────────────────────
// SUPERADMIN PANELI (sayt egasi uchun)
//
// DIQQAT: bu sahifa DataProvider'dan TASHQARIDA ishlaydi (main.jsx ga qarang).
// Ya'ni tashkilotlarning savdo/kassa ma'lumoti bu yerga umuman yuklanmaydi —
// panel faqat o'z API'si bilan gaplashadi.
//
// Ikki bosqichli himoya:
//   parol      — panelga kirish uchun
//   o'chirish kaliti — ma'lumot o'chiradigan amallar uchun ALOHIDA
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { saApi } from '../api';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmtDate = (ts) => ts ? new Date(ts).toLocaleString('ru-RU') : '—';

const C = {
  bg: '#0f172a', card: '#1e293b', border: '#334155',
  text: '#e2e8f0', dim: '#94a3b8',
  accent: '#38bdf8', danger: '#f87171', ok: '#4ade80', warn: '#fbbf24',
};

const inp = {
  padding: '9px 12px', fontSize: 13, borderRadius: 6,
  border: `1px solid ${C.border}`, background: '#0b1220', color: C.text,
  fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
};
const btn = (bg, fg = '#0f172a') => ({
  padding: '9px 16px', fontSize: 13, fontWeight: 'bold', borderRadius: 6,
  border: 'none', background: bg, color: fg, cursor: 'pointer',
});

// ═════════════════════════════════════════════════════════════════════════════
export default function SuperAdmin() {
  const [token, setToken]   = useState(() => saApi.getToken());
  const [info, setInfo]     = useState(null);
  const [checking, setChecking] = useState(true);

  // Saqlangan token hali yaroqlimi — tekshiramiz
  useEffect(() => {
    if (!token) { setChecking(false); return; }
    saApi.me()
      .then(r => { setInfo(r.info); setChecking(false); })
      .catch(() => { saApi.setToken(null); setToken(null); setChecking(false); });
  }, [token]);

  const onLogin = (tok, inf) => { saApi.setToken(tok); setToken(tok); setInfo(inf); };
  const onLogout = () => { saApi.setToken(null); setToken(null); setInfo(null); };

  if (checking) {
    return <Shell><div style={{ color: C.dim, textAlign: 'center', padding: 40 }}>Tekshirilmoqda…</div></Shell>;
  }
  if (!token) return <Shell><LoginBox onLogin={onLogin} /></Shell>;
  return <Panel info={info} onLogout={onLogout} />;
}

// ── Umumiy qobiq ─────────────────────────────────────────────────────────────
function Shell({ children }) {
  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text,
      fontFamily: 'Tahoma, Verdana, Arial, sans-serif',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      {children}
    </div>
  );
}

// ── Kirish ───────────────────────────────────────────────────────────────────
function LoginBox({ onLogin }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const r = await saApi.login(name, password);
      onLogin(r.token, r.info);
    } catch (e2) {
      setErr(e2.message);
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: 32, width: 380, boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <div style={{ fontSize: 34, marginBottom: 8 }}>🛡</div>
        <div style={{ fontSize: 19, fontWeight: 'bold' }}>Superadmin</div>
        <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>Sayt egasi uchun boshqaruv paneli</div>
      </div>

      <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 5 }}>Ism</label>
      <input value={name} onChange={e => setName(e.target.value)} style={{ ...inp, marginBottom: 14 }} autoFocus autoComplete="username" />

      <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 5 }}>Parol</label>
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ ...inp, marginBottom: 18 }} autoComplete="current-password" />

      {err && (
        <div style={{ background: '#7f1d1d', color: '#fecaca', padding: '9px 12px', borderRadius: 6, fontSize: 12, marginBottom: 14 }}>
          {err}
        </div>
      )}

      <button type="submit" disabled={busy} style={{ ...btn(C.accent), width: '100%', opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Tekshirilmoqda…' : 'Kirish'}
      </button>

      <div style={{ marginTop: 18, fontSize: 11, color: C.dim, textAlign: 'center', lineHeight: 1.6 }}>
        Bu bo'lim tashkilotlar ma'lumotidan ajratilgan.<br />
        Tashkilot admini bu yerga kira olmaydi.
      </div>
    </form>
  );
}

// ── Asosiy panel ─────────────────────────────────────────────────────────────
function Panel({ info, onLogout }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [tab, setTab]           = useState('accounts');
  const [toast, setToast]       = useState('');

  const notify = (m) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await saApi.listAccounts();
      setAccounts(r.accounts || []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Tahoma, Verdana, Arial, sans-serif' }}>
      {/* Sarlavha */}
      <div style={{
        background: C.card, borderBottom: `1px solid ${C.border}`,
        padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 17, fontWeight: 'bold' }}>🛡 Superadmin</div>
        <div style={{ fontSize: 12, color: C.dim }}>{info?.name}</div>
        {!info?.resetKeySet && (
          <div style={{ fontSize: 11, background: '#78350f', color: '#fcd34d', padding: '4px 10px', borderRadius: 12 }}>
            ⚠ O'chirish kaliti sozlanmagan — tozalash yopiq
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {[['accounts', '🏢 Tashkilotlar'], ['security', '🔑 Xavfsizlik']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              ...btn(tab === k ? C.accent : 'transparent', tab === k ? '#0f172a' : C.dim),
              border: tab === k ? 'none' : `1px solid ${C.border}`,
            }}>{l}</button>
          ))}
          <button onClick={onLogout} style={{ ...btn('transparent', C.dim), border: `1px solid ${C.border}` }}>Chiqish</button>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        {toast && (
          <div style={{ background: '#064e3b', color: '#a7f3d0', padding: '11px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            {toast}
          </div>
        )}
        {err && (
          <div style={{ background: '#7f1d1d', color: '#fecaca', padding: '11px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            {err}
          </div>
        )}

        {tab === 'accounts' && (
          <AccountsTab accounts={accounts} loading={loading} reload={load} notify={notify} resetKeySet={info?.resetKeySet} />
        )}
        {tab === 'security' && <SecurityTab info={info} notify={notify} />}
      </div>
    </div>
  );
}

// ── Tashkilotlar ─────────────────────────────────────────────────────────────
function AccountsTab({ accounts, loading, reload, notify, resetKeySet }) {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ account: '', adminName: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [action, setAction] = useState(null); // { type, acc }

  const create = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await saApi.createAccount(form.account, form.adminName, form.password);
      notify(`✅ "${form.account}" ochildi. Login: ${form.adminName}`);
      setForm({ account: '', adminName: '', password: '' });
      setShowNew(false);
      reload();
    } catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  };

  const toggleStatus = async (acc, disabled) => {
    try {
      await saApi.setStatus(acc, disabled);
      notify(disabled ? `⏸ "${acc}" to'xtatildi` : `▶ "${acc}" yoqildi`);
      reload();
    } catch (e) { notify(`❌ ${e.message}`); }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 'bold' }}>Tashkilotlar ({accounts.length})</div>
        <button onClick={reload} style={{ ...btn('transparent', C.dim), border: `1px solid ${C.border}`, padding: '6px 12px' }}>↻</button>
        <button onClick={() => setShowNew(v => !v)} style={{ ...btn(C.ok), marginLeft: 'auto' }}>
          {showNew ? '✕ Yopish' : '+ Yangi tashkilot'}
        </button>
      </div>

      {showNew && (
        <form onSubmit={create} style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: 20, marginBottom: 20,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 5 }}>
                Tashkilot nomi (manzilda ishlatiladi)
              </label>
              <input value={form.account} required placeholder="alfa-beton"
                onChange={e => setForm({ ...form, account: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                style={inp} />
              <div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>Faqat lotin harflari, raqam, - va _</div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 5 }}>Admin ismi (login)</label>
              <input value={form.adminName} required placeholder="Bobur"
                onChange={e => setForm({ ...form, adminName: e.target.value })} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 5 }}>Parol (kamida 6 belgi)</label>
              <input value={form.password} required minLength={6}
                onChange={e => setForm({ ...form, password: e.target.value })} style={inp} />
              <div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>Mijozga shu parolni yetkazasiz</div>
            </div>
          </div>
          {err && <div style={{ background: '#7f1d1d', color: '#fecaca', padding: '9px 12px', borderRadius: 6, fontSize: 12, marginTop: 14 }}>{err}</div>}
          <button type="submit" disabled={busy} style={{ ...btn(C.ok), marginTop: 16, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Ochilmoqda…' : '✓ Tashkilot ochish'}
          </button>
        </form>
      )}

      {loading ? (
        <div style={{ color: C.dim, padding: 30, textAlign: 'center' }}>Yuklanmoqda…</div>
      ) : !accounts.length ? (
        <div style={{ color: C.dim, padding: 30, textAlign: 'center' }}>Hali tashkilot yo'q.</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {accounts.map(a => (
            <div key={a.account} style={{
              background: C.card, border: `1px solid ${a.disabled ? '#7f1d1d' : C.border}`,
              borderRadius: 10, padding: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 'bold' }}>{a.account}</div>
                {a.disabled && (
                  <span style={{ fontSize: 11, background: '#7f1d1d', color: '#fecaca', padding: '3px 10px', borderRadius: 12 }}>
                    ⏸ To'xtatilgan
                  </span>
                )}
                <span style={{ fontSize: 11, color: C.dim }}>
                  Admin: {a.admins.join(', ') || '—'}
                </span>
                <span style={{ fontSize: 11, color: C.dim, marginLeft: 'auto' }}>
                  Oxirgi o'zgarish: {fmtDate(a.updatedAt)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12, color: C.dim, marginBottom: 14 }}>
                <span>👥 Xodim: <b style={{ color: C.text }}>{a.workers}</b></span>
                <span>🏢 Mijoz: <b style={{ color: C.text }}>{a.customers}</b></span>
                <span>📦 Sotuv: <b style={{ color: C.text }}>{a.sales}</b></span>
                <span>🚛 Qabul: <b style={{ color: C.text }}>{a.recv}</b></span>
                <span>💰 Qarz: <b style={{ color: a.debtTotal > 0 ? C.warn : C.text }}>{fmt(a.debtTotal)}</b></span>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setAction({ type: 'password', acc: a })}
                  style={{ ...btn('transparent', C.accent), border: `1px solid ${C.border}`, padding: '6px 12px', fontSize: 12 }}>
                  🔑 Parol berish
                </button>
                <button onClick={() => toggleStatus(a.account, !a.disabled)}
                  style={{ ...btn('transparent', a.disabled ? C.ok : C.warn), border: `1px solid ${C.border}`, padding: '6px 12px', fontSize: 12 }}>
                  {a.disabled ? '▶ Yoqish' : "⏸ To'xtatish"}
                </button>
                <button onClick={() => setAction({ type: 'wipe', acc: a })} disabled={!resetKeySet}
                  title={resetKeySet ? '' : "O'chirish kaliti sozlanmagan"}
                  style={{ ...btn('transparent', C.danger), border: `1px solid ${C.border}`, padding: '6px 12px', fontSize: 12, marginLeft: 'auto', opacity: resetKeySet ? 1 : 0.4, cursor: resetKeySet ? 'pointer' : 'not-allowed' }}>
                  🗑 Bazani tozalash
                </button>
                <button onClick={() => setAction({ type: 'delete', acc: a })} disabled={!resetKeySet}
                  style={{ ...btn('transparent', C.danger), border: `1px solid ${C.danger}`, padding: '6px 12px', fontSize: 12, opacity: resetKeySet ? 1 : 0.4, cursor: resetKeySet ? 'pointer' : 'not-allowed' }}>
                  ✕ Tashkilotni o'chirish
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {action && (
        <ActionModal action={action} onClose={() => setAction(null)}
          onDone={(msg) => { setAction(null); notify(msg); reload(); }} />
      )}
    </>
  );
}

// ── Xavfli amallar oynasi ────────────────────────────────────────────────────
function ActionModal({ action, onClose, onDone }) {
  const { type, acc } = action;
  const [resetKey, setResetKey] = useState('');
  const [workerName, setWorkerName] = useState(acc.admins[0] || '');
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [keepRefs, setKeepRefs] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const isDestructive = type === 'wipe' || type === 'delete';
  const needWord = type === 'delete' ? 'O\'CHIRISH' : 'TOZALASH';

  const run = async () => {
    setErr(''); setBusy(true);
    try {
      if (type === 'password') {
        await saApi.setAccountPassword(acc.account, workerName, password);
        onDone(`🔑 "${workerName}" paroli almashtirildi`);
      } else if (type === 'wipe') {
        const r = await saApi.wipeAccount(acc.account, resetKey, { keepAdmin: true, keepRefs });
        onDone(`🗑 "${acc.account}" tozalandi. Zaxira: ${r.backupFile}`);
      } else if (type === 'delete') {
        const r = await saApi.deleteAccount(acc.account, resetKey);
        onDone(`✕ "${acc.account}" arxivga ko'chirildi: ${r.archivedTo}`);
      }
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const canRun = type === 'password'
    ? (workerName && password.length >= 6)
    : (resetKey.length > 0 && confirmText === needWord);

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: C.card, border: `1px solid ${isDestructive ? C.danger : C.border}`,
        borderRadius: 12, padding: 24, width: 460, maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 6 }}>
          {type === 'password' && '🔑 Parol berish'}
          {type === 'wipe'     && '🗑 Bazani tozalash'}
          {type === 'delete'   && '✕ Tashkilotni o\'chirish'}
        </div>
        <div style={{ fontSize: 13, color: C.dim, marginBottom: 18 }}>{acc.account}</div>

        {type === 'password' && (
          <>
            <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 5 }}>Xodim ismi</label>
            <input value={workerName} onChange={e => setWorkerName(e.target.value)} style={{ ...inp, marginBottom: 14 }} />
            <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 5 }}>Yangi parol (kamida 6 belgi)</label>
            <input value={password} onChange={e => setPassword(e.target.value)} style={{ ...inp, marginBottom: 8 }} />
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 16 }}>
              Bu parolni mijozga o'zingiz yetkazasiz.
            </div>
          </>
        )}

        {isDestructive && (
          <>
            <div style={{
              background: '#450a0a', border: `1px solid ${C.danger}`, borderRadius: 8,
              padding: 14, marginBottom: 18, fontSize: 12, lineHeight: 1.7,
            }}>
              {type === 'wipe' ? (
                <>
                  <b style={{ color: C.danger }}>Nima o'chadi:</b><br />
                  Barcha savdo, kassa, qarz, avans, sklad, reys, oylik to'lovlari,
                  zakaz va tiketlar.<br />
                  {!keepRefs && <>Mijozlar, yetkazib beruvchilar, haydovchilar ham o'chadi.<br /></>}
                  <b style={{ color: C.ok }}>Qoladi:</b> admin hisobi (kirish uchun), sozlamalar.<br />
                  <span style={{ color: C.dim }}>Tozalashdan oldin avtomatik zaxira olinadi.</span>
                </>
              ) : (
                <>
                  <b style={{ color: C.danger }}>Tashkilot butunlay o'chiriladi.</b><br />
                  Papka arxivga ko'chiriladi — xato bo'lsa serverdan qaytarish mumkin,
                  lekin ilovada ko'rinmay qoladi.
                </>
              )}
            </div>

            {type === 'wipe' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.dim, marginBottom: 16, cursor: 'pointer' }}>
                <input type="checkbox" checked={keepRefs} onChange={e => setKeepRefs(e.target.checked)} />
                Mijozlar / yetkazib beruvchilar / haydovchilar bazasi saqlansin
              </label>
            )}

            <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 5 }}>
              O'chirish kaliti
            </label>
            <input type="password" value={resetKey} onChange={e => setResetKey(e.target.value)}
              placeholder="Ikkinchi parol" style={{ ...inp, marginBottom: 14 }} autoFocus />

            <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 5 }}>
              Tasdiqlash uchun <b style={{ color: C.danger }}>{needWord}</b> deb yozing
            </label>
            <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
              style={{ ...inp, marginBottom: 16 }} />
          </>
        )}

        {err && (
          <div style={{ background: '#7f1d1d', color: '#fecaca', padding: '9px 12px', borderRadius: 6, fontSize: 12, marginBottom: 14 }}>
            {err}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={run} disabled={!canRun || busy}
            style={{ ...btn(isDestructive ? C.danger : C.accent), flex: 1, opacity: (!canRun || busy) ? 0.4 : 1, cursor: (!canRun || busy) ? 'not-allowed' : 'pointer' }}>
            {busy ? 'Bajarilmoqda…' : 'Tasdiqlash'}
          </button>
          <button onClick={onClose} style={{ ...btn('transparent', C.dim), border: `1px solid ${C.border}` }}>
            Bekor
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Xavfsizlik ───────────────────────────────────────────────────────────────
function SecurityTab({ info, notify }) {
  const [pw, setPw] = useState({ current: '', next: '', repeat: '' });
  const [rk, setRk] = useState({ password: '', next: '', repeat: '' });
  const [pwErr, setPwErr] = useState('');
  const [rkErr, setRkErr] = useState('');

  const changePw = async (e) => {
    e.preventDefault(); setPwErr('');
    if (pw.next !== pw.repeat) { setPwErr('Yangi parollar mos kelmadi'); return; }
    try {
      await saApi.changePassword(pw.current, pw.next);
      setPw({ current: '', next: '', repeat: '' });
      notify('🔑 Superadmin paroli almashtirildi');
    } catch (e2) { setPwErr(e2.message); }
  };

  const changeRk = async (e) => {
    e.preventDefault(); setRkErr('');
    if (rk.next !== rk.repeat) { setRkErr('Yangi kalitlar mos kelmadi'); return; }
    try {
      await saApi.changeResetKey(rk.password, rk.next);
      setRk({ password: '', next: '', repeat: '' });
      notify("🗝 O'chirish kaliti almashtirildi");
    } catch (e2) { setRkErr(e2.message); }
  };

  const box = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 20 };
  const lbl = { fontSize: 12, color: C.dim, display: 'block', marginBottom: 5 };

  return (
    <div style={{ maxWidth: 480 }}>
      <form onSubmit={changePw} style={box}>
        <div style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 6 }}>🔑 Panel paroli</div>
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 16 }}>
          Superadmin paneliga kirish uchun ishlatiladi.
        </div>
        <label style={lbl}>Joriy parol</label>
        <input type="password" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} style={{ ...inp, marginBottom: 12 }} required />
        <label style={lbl}>Yangi parol (kamida 8 belgi)</label>
        <input type="password" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} style={{ ...inp, marginBottom: 12 }} required minLength={8} />
        <label style={lbl}>Yangi parolni takrorlang</label>
        <input type="password" value={pw.repeat} onChange={e => setPw({ ...pw, repeat: e.target.value })} style={{ ...inp, marginBottom: 14 }} required />
        {pwErr && <div style={{ background: '#7f1d1d', color: '#fecaca', padding: '9px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>{pwErr}</div>}
        <button type="submit" style={btn(C.accent)}>Parolni almashtirish</button>
      </form>

      <form onSubmit={changeRk} style={{ ...box, border: `1px solid ${C.danger}44` }}>
        <div style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 6 }}>🗝 O'chirish kaliti</div>
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 16, lineHeight: 1.6 }}>
          Bazani tozalash va tashkilotni o'chirish uchun talab qilinadigan{' '}
          <b style={{ color: C.warn }}>ikkinchi parol</b>. Panel paroli o'g'irlansa ham,
          bu kalitsiz ma'lumot o'chirilmaydi.
          <br />
          Holati:{' '}
          <b style={{ color: info?.resetKeySet ? C.ok : C.warn }}>
            {info?.resetKeySet ? 'sozlangan' : "sozlanmagan — o'chirish yopiq"}
          </b>
        </div>
        <label style={lbl}>Panel paroli (tasdiqlash uchun)</label>
        <input type="password" value={rk.password} onChange={e => setRk({ ...rk, password: e.target.value })} style={{ ...inp, marginBottom: 12 }} required />
        <label style={lbl}>Yangi o'chirish kaliti (kamida 8 belgi)</label>
        <input type="password" value={rk.next} onChange={e => setRk({ ...rk, next: e.target.value })} style={{ ...inp, marginBottom: 12 }} required minLength={8} />
        <label style={lbl}>Takrorlang</label>
        <input type="password" value={rk.repeat} onChange={e => setRk({ ...rk, repeat: e.target.value })} style={{ ...inp, marginBottom: 14 }} required />
        {rkErr && <div style={{ background: '#7f1d1d', color: '#fecaca', padding: '9px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>{rkErr}</div>}
        <button type="submit" style={btn(C.danger)}>Kalitni almashtirish</button>
      </form>
    </div>
  );
}
