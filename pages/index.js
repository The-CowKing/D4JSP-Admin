import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';

const AdminView = dynamic(() => import('../components/AdminView'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#080608', color: '#D4AF37', fontFamily: "'Cinzel', serif", fontSize: 18, letterSpacing: 2 }}>
      Loading Admin Panel…
    </div>
  ),
});

const GOLD = '#D4AF37';
const DARK = '#080608';

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1a1720', border: `1px solid ${GOLD}`, color: '#e8e0f0', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 14, padding: '10px 20px', borderRadius: 8, zIndex: 99999, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
      {message}
    </div>
  );
}

export default function AdminPage() {
  const { user, userData, loading, isAdmin, signInGoogle, logOut } = useAuth();
  const [toast, setToast] = useState(null);

  const showToast = (msg) => setToast(msg);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: DARK, color: GOLD, fontFamily: "'Cinzel', serif", fontSize: 18, letterSpacing: 2 }}>
        Authenticating…
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: DARK, color: '#e8e0f0', gap: 24, fontFamily: "'Barlow Condensed', sans-serif" }}>
        <h1 style={{ fontFamily: "'Cinzel', serif", color: GOLD, fontSize: 28, letterSpacing: 4, margin: 0 }}>D4JSP Admin</h1>
        <p style={{ color: 'rgba(232,224,240,0.5)', fontSize: 14, margin: 0 }}>Sign in with your admin account to continue.</p>
        <button
          onClick={signInGoogle}
          style={{ background: GOLD, color: '#000', border: 'none', borderRadius: 8, padding: '12px 32px', fontFamily: "'Cinzel', serif", fontSize: 14, fontWeight: 700, letterSpacing: 2, cursor: 'pointer' }}
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: DARK, color: '#e8e0f0', gap: 16, fontFamily: "'Barlow Condensed', sans-serif" }}>
        <h1 style={{ fontFamily: "'Cinzel', serif", color: '#8B0000', fontSize: 24, letterSpacing: 3, margin: 0 }}>Access Denied</h1>
        <p style={{ color: 'rgba(232,224,240,0.5)', fontSize: 14, margin: 0 }}>
          Signed in as <strong style={{ color: '#e8e0f0' }}>{user.email}</strong> — not an admin account.
        </p>
        <button
          onClick={logOut}
          style={{ background: 'transparent', color: 'rgba(239,68,68,0.8)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 24px', fontFamily: "'Cinzel', serif", fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: 'pointer' }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: DARK }}>
      <AdminView showToast={showToast} />
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
