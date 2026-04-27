import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { RANKS } from '../lib/rankEngine';
import AdminImageUpload from './AdminImageUpload';

// Tab skeleton — shown while a tab's data is loading
function TabSkeleton({ rows = 5 }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <style>{`@keyframes skel-pulse { 0%,100%{opacity:.35} 50%{opacity:.65} }`}</style>
      {[...Array(rows)].map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(212,175,55,0.07)', animation: 'skel-pulse 1.6s ease-in-out infinite', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ height: 12, borderRadius: 4, background: 'rgba(212,175,55,0.06)', animation: 'skel-pulse 1.6s ease-in-out infinite', width: `${40 + (i * 13) % 40}%` }} />
            <div style={{ height: 9, borderRadius: 3, background: 'rgba(255,255,255,0.04)', animation: 'skel-pulse 1.6s ease-in-out infinite', width: `${55 + (i * 7) % 30}%` }} />
          </div>
          <div style={{ width: 60, height: 22, borderRadius: 6, background: 'rgba(212,175,55,0.05)', animation: 'skel-pulse 1.6s ease-in-out infinite', flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

// Lazy-loaded tab panels — only their JS loads when the tab is first activated
const ActivityTab       = dynamic(() => import('./admin/ActivityTab'),       { ssr: false, loading: () => <TabSkeleton rows={6} /> });
const SystemConfigPanel = dynamic(() => import('./admin/SystemConfigPanel'), { ssr: false, loading: () => <TabSkeleton rows={8} /> });
const BotsTab           = dynamic(() => import('./admin/BotsTab'),           { ssr: false, loading: () => <TabSkeleton rows={8} /> });

const G = '#D4AF37';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REWARD_TYPE_IDS = new Set(['fg_gift', 'gems', 'gift', 'fg_bonus', 'xp_boost', 'extra_posts', 'raffle_ticket', 'name_change']);
// Raw REST fetch — bypasses GoTrue auth-mutex that causes indefinite hangs on getSession()
const _SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzamtkYm1meHB4dXVsb3Fvc2liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDk4MDcsImV4cCI6MjA5MDIyNTgwN30.UdzV7PkGnEo0jgnViPzif13kaS88MeAnhHYsbbg2ugA';
const _SB_REST = 'https://isjkdbmfxpxuuloqosib.supabase.co/rest/v1';
const sbFetch = (path) => fetch(`${_SB_REST}/${path}`, { headers: { apikey: _SB_ANON, Authorization: 'Bearer ' + _SB_ANON } });

const cell = { padding: '8px 10px', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'var(--sub)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 };
const hcell = { ...cell, color: 'var(--mt)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.12em', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, borderBottom: '1px solid rgba(212,175,55,0.12)' };

const TABS = [
  { id: 'overview',  label: 'Overview' },
  { id: 'users',     label: 'Users' },
  { id: 'requests',  label: 'Requests' },
  { id: 'activity',  label: 'Activity' },
  { id: 'features',  label: 'Features' },
  { id: 'gold',      label: 'Currency' },
  { id: 'bots',      label: 'Bots' },
  { id: 'config',    label: 'Config' },
];

const DASH_STATS = [
  { label: 'Total Users',         value: '—', color: G,         icon: '👥', desc: 'Registered accounts' },
  { label: 'Active Listings',     value: '—', color: '#60a5fa', icon: '📋', desc: 'Open trade threads' },
  { label: 'FG in Circulation',   value: '—', color: '#facc15', icon: '🪙', desc: 'Total fg_balance sum' },
  { label: 'Trades Completed',    value: '—', color: '#4ade80', icon: '✅', desc: 'Closed escrow records' },
  { label: 'Escrow Volume (FG)',  value: '—', color: '#a78bfa', icon: '🔒', desc: 'Total FG held in escrow' },
  { label: 'New Users (7d)',      value: '—', color: '#38bdf8', icon: '🆕', desc: 'Signups last 7 days' },
  { label: 'Revenue',             value: '$—', color: '#4ade80', icon: '💰', desc: 'Total USD via Stripe' },
  { label: 'Subscribers',         value: '—', color: '#f472b6', icon: '💎', desc: 'Paid membership count' },
  { label: 'Open Disputes',       value: '—', color: '#f87171', icon: '⚖', desc: 'Unresolved disputes' },
  { label: 'Raffle Pot (FG)',     value: '—', color: G,         icon: '🎲', desc: 'Current daily pot' },
  { label: 'Messages',            value: '—', color: '#94a3b8', icon: '💬', desc: 'Total DMs sent' },
  { label: 'Reviews',             value: '—', color: '#fb923c', icon: '⭐', desc: 'Total trade reviews' },
];

// ── UI-only badge — shows on any attach point not yet persisted to backend ──
// Remove the badge when backend wiring is complete for that endpoint.
function UIOnlyBadge({ label = 'UI only' }) {
  return (
    <span title="Config stored in local state only — backend wiring pending. Remove this badge when the endpoint is wired." style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '1px 6px', fontSize: 7, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '.08em', whiteSpace: 'nowrap', flexShrink: 0 }}>
      ⚠ {label}
    </span>
  );
}

// ── Shared modal backdrop ──────────────────────────────────────────────────
function Modal({ onClose, children, width = 420 }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#0e0c10', border: '1px solid rgba(212,175,55,0.18)', borderRadius: 16, padding: '24px 24px 20px', width: '100%', maxWidth: width, maxHeight: '80vh', overflowY: 'auto' }}
      >
        {children}
      </div>
    </div>
  );
}

function ModalTitle({ children }) {
  return (
    <div className="cinzel" style={{ fontSize: 15, color: G, marginBottom: 18, letterSpacing: 1 }}>{children}</div>
  );
}

function Btn({ onClick, children, color = G, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ background: 'none', border: `1px solid ${color}`, color, borderRadius: 8, padding: '7px 16px', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, letterSpacing: '.06em' }}
    >
      {children}
    </button>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", outline: 'none', boxSizing: 'border-box' }}
    />
  );
}

// ── Ban Modal ──────────────────────────────────────────────────────────────
function BanModal({ user, token, onClose, onSuccess }) {
  const [byIp, setByIp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function doban() {
    setLoading(true);
    setErr('');
    try {
      const r = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: 'banUser', userId: user.id, banByIp: byIp }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      onSuccess();
      onClose();
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <Modal onClose={onClose} width={360}>
      <ModalTitle>Ban User</ModalTitle>
      <div style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 16 }}>
        <span style={{ color: G }}>{user.display_name || user.email}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {[{ val: false, label: 'Ban by username only' }, { val: true, label: 'Ban by IP address (all accounts)' }].map(opt => (
          <label key={String(opt.val)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: byIp === opt.val ? G : 'var(--sub)', fontFamily: "'Barlow Condensed',sans-serif" }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${byIp === opt.val ? G : 'rgba(255,255,255,0.2)'}`, background: byIp === opt.val ? G : 'transparent', flexShrink: 0 }} onClick={() => setByIp(opt.val)} />
            {opt.label}
          </label>
        ))}
      </div>
      {byIp && user.ip_address && <div style={{ fontSize: 11, color: 'var(--mt)', marginBottom: 14 }}>IP: <span style={{ color: '#f87171' }}>{user.ip_address}</span></div>}
      {err && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn onClick={onClose} color="rgba(255,255,255,0.2)">Cancel</Btn>
        <Btn onClick={doban} color="#f87171" disabled={loading}>{loading ? 'Banning…' : 'Confirm Ban'}</Btn>
      </div>
    </Modal>
  );
}

// ── Edit Name Modal ────────────────────────────────────────────────────────
function EditNameModal({ user, token, onClose, onSuccess }) {
  const [name, setName] = useState(user.display_name || '');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setLoading(true); setErr('');
    try {
      const r = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: 'setDisplayName', userId: user.id, display_name: name }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      onSuccess(name);
      onClose();
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <Modal onClose={onClose} width={360}>
      <ModalTitle>Edit Display Name</ModalTitle>
      <div style={{ marginBottom: 16 }}><Input value={name} onChange={setName} placeholder="Display name" /></div>
      {err && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn onClick={onClose} color="rgba(255,255,255,0.2)">Cancel</Btn>
        <Btn onClick={save} disabled={loading || !name.trim()}>{loading ? 'Saving…' : 'Save'}</Btn>
      </div>
    </Modal>
  );
}

// ── Edit Gold Modal ────────────────────────────────────────────────────────
function EditGoldModal({ user, token, onClose, onSuccess }) {
  const [amount, setAmount] = useState(String(user.fg_balance || 0));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setLoading(true); setErr('');
    try {
      const r = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: 'setGold', userId: user.id, amount }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      onSuccess(parseInt(amount, 10));
      onClose();
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <Modal onClose={onClose} width={320}>
      <ModalTitle>Set FG Balance</ModalTitle>
      <div style={{ marginBottom: 6, fontSize: 11, color: 'var(--mt)' }}>Current: <span style={{ color: G }}>{(user.fg_balance || 0).toLocaleString()} FG</span></div>
      <div style={{ marginBottom: 16 }}><Input value={amount} onChange={setAmount} placeholder="New FG amount" type="number" /></div>
      {err && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn onClick={onClose} color="rgba(255,255,255,0.2)">Cancel</Btn>
        <Btn onClick={save} disabled={loading}>{loading ? 'Saving…' : 'Set Balance'}</Btn>
      </div>
    </Modal>
  );
}

// ── Edit Badge Modal ───────────────────────────────────────────────────────
const BADGE_OPTIONS = ['none', 'admin', 'legendary', 'premium', 'verified'];

function EditBadgeModal({ user, token, onClose, onSuccess }) {
  const [badge, setBadge] = useState(() => {
    if (user.role === 'admin') return 'admin';
    if (user.membership === 'legendary') return 'legendary';
    if (['premium', 'basic', 'verified'].includes(user.membership) || user.verified) return 'premium';
    return 'none';
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setLoading(true); setErr('');
    try {
      // Map badge selection to actual DB fields
      const updates = { membership: user.membership, role: user.role, verified: user.verified };
      if (badge === 'admin') {
        updates.role = 'admin';
      } else {
        if (user.role === 'admin') updates.role = 'user';
        if (badge === 'legendary') updates.membership = 'legendary';
        else if (badge === 'premium') updates.membership = 'premium';
        else if (badge === 'verified') { updates.membership = 'verified'; updates.verified = true; }
        else { updates.membership = 'free'; updates.verified = false; }
      }
      const r = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: 'setBadge', userId: user.id, ...updates }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      onSuccess(updates);
      onClose();
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <Modal onClose={onClose} width={360}>
      <ModalTitle>Set Badge</ModalTitle>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {BADGE_OPTIONS.map(b => (
          <button key={b} onClick={() => setBadge(b)} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${badge === b ? G : 'rgba(255,255,255,0.1)'}`, background: badge === b ? 'rgba(212,175,55,0.12)' : 'none', color: badge === b ? G : 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 11, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            {b === 'admin' ? '🛡 Admin' : b === 'legendary' ? '👑 Legendary' : b === 'premium' ? '💎 Premium' : b === 'verified' ? '✓ Verified' : '— None'}
          </button>
        ))}
      </div>
      {err && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn onClick={onClose} color="rgba(255,255,255,0.2)">Cancel</Btn>
        <Btn onClick={save} disabled={loading}>{loading ? 'Saving…' : 'Save'}</Btn>
      </div>
    </Modal>
  );
}

// ── Edit Membership Modal ──────────────────────────────────────────────────
const TIERS = ['free', 'premium', 'vip', 'lifetime'];

function EditMembershipModal({ user, token, onClose, onSuccess }) {
  const [tier, setTier] = useState(user.membership || 'free');
  const [expiry, setExpiry] = useState(user.membership_expiry ? user.membership_expiry.slice(0, 10) : '');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setLoading(true); setErr('');
    try {
      const r = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: 'setMembership', userId: user.id, membership: tier, membership_expiry: expiry || null }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      onSuccess(tier, expiry);
      onClose();
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <Modal onClose={onClose} width={360}>
      <ModalTitle>Set Membership</ModalTitle>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {TIERS.map(t => (
          <button key={t} onClick={() => setTier(t)} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${tier === t ? G : 'rgba(255,255,255,0.1)'}`, background: tier === t ? 'rgba(212,175,55,0.12)' : 'none', color: tier === t ? G : 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 11, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            {t}
          </button>
        ))}
      </div>
      <div style={{ marginBottom: 6, fontSize: 11, color: 'var(--mt)' }}>Expiry date (leave blank = never)</div>
      <div style={{ marginBottom: 16 }}><Input value={expiry} onChange={setExpiry} type="date" /></div>
      {err && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn onClick={onClose} color="rgba(255,255,255,0.2)">Cancel</Btn>
        <Btn onClick={save} disabled={loading}>{loading ? 'Saving…' : 'Save'}</Btn>
      </div>
    </Modal>
  );
}

// ── Records Modal (disputes / escrow) ─────────────────────────────────────
function RecordsModal({ title, token, userId, type, onClose }) {
  const [records, setRecords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/admin/tabs?type=${type}&userId=${userId}`, {
          headers: { Authorization: 'Bearer ' + token },
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Failed');
        setRecords(j.records);
      } catch (e) { setErr(e.message); }
      setLoading(false);
    })();
  }, []);

  return (
    <Modal onClose={onClose} width={520}>
      <ModalTitle>{title}</ModalTitle>
      {loading && <div style={{ textAlign: 'center', padding: 30 }}><div className="spin" style={{ margin: '0 auto' }} /></div>}
      {err && <div style={{ color: '#f87171', fontSize: 12 }}>{err}</div>}
      {records && records.length === 0 && <div style={{ color: 'var(--mt)', fontSize: 12, padding: '10px 0' }}>No records found.</div>}
      {records && records.map(r => (
        <div key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '10px 0' }}>
          <div style={{ fontSize: 12, color: 'var(--sub)' }}>{r.title || ('Escrow #' + r.id.slice(0, 8))}</div>
          {(r.buyer_name || r.seller_name) && (
            <div style={{ fontSize: 10, color: 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif", marginTop: 2 }}>
              {r.buyer_name && <span>Buyer: <span style={{ color: 'var(--sub)' }}>{r.buyer_name}</span></span>}
              {r.buyer_name && r.seller_name && <span style={{ margin: '0 6px', opacity: 0.3 }}>·</span>}
              {r.seller_name && <span>Seller: <span style={{ color: 'var(--sub)' }}>{r.seller_name}</span></span>}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            {r.status && <span style={{ fontSize: 10, color: r.status === 'disputed' ? '#f87171' : '#4ade80', fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase', letterSpacing: '.08em' }}>{r.status}</span>}
            {r.fg_amount != null && <span style={{ fontSize: 10, color: G, fontFamily: "'Barlow Condensed',sans-serif" }}>{r.fg_amount.toLocaleString()} FG</span>}
            {r.price != null && <span style={{ fontSize: 10, color: G, fontFamily: "'Barlow Condensed',sans-serif" }}>{r.price.toLocaleString()} FG</span>}
            <span style={{ fontSize: 10, color: 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif" }}>{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</span>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Btn onClick={onClose} color="rgba(255,255,255,0.2)">Close</Btn>
      </div>
    </Modal>
  );
}

// ── Pill badge ─────────────────────────────────────────────────────────────
function Pill({ children, color = 'rgba(255,255,255,0.12)', textColor = 'var(--sub)', onClick }) {
  return (
    <span
      onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, background: color, color: textColor, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 10, letterSpacing: '.05em', cursor: onClick ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}
    >
      {children}
    </span>
  );
}

// ── Single user card ───────────────────────────────────────────────────────
function UserCard({ user: initialUser, token, currentUserId, onRefresh, onSelect }) {
  const [user, setUser] = useState(initialUser);
  const [modal, setModal] = useState(null); // 'ban'|'editName'|'editGold'|'editMembership'|'editBadge'|'disputes'|'escrow'

  const membershipColor = { free: 'rgba(255,255,255,0.08)', premium: 'rgba(212,175,55,0.15)', vip: 'rgba(168,85,247,0.18)', lifetime: 'rgba(239,68,68,0.15)' };
  const membershipText = { free: 'var(--mt)', premium: G, vip: '#c084fc', lifetime: '#f87171' };
  const tier = user.membership || 'free';

  return (
    <>
      <div
        onClick={() => onSelect && onSelect(user.id)}
        style={{ background: user.banned ? 'rgba(139,0,0,0.08)' : 'linear-gradient(135deg,#0e0c10,#111018)', border: `1px solid ${user.banned ? 'rgba(220,38,38,0.18)' : 'rgba(212,175,55,0.06)'}`, borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start', position: 'relative', cursor: onSelect ? 'pointer' : 'default' }}
      >

        {/* Avatar + name + IP — clicking here drills into detail view */}
        <div onClick={() => onSelect && onSelect(user.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 56 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${user.banned ? 'rgba(220,38,38,0.4)' : 'rgba(212,175,55,0.2)'}`, flexShrink: 0, background: '#1a1820', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {user.photo_url
              ? <img src={user.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
              : <span style={{ fontSize: 18, opacity: 0.4 }}>👤</span>
            }
          </div>
          <div
            style={{ fontSize: 11, color: G, fontFamily: "'Cinzel',serif", fontWeight: 700, textAlign: 'center', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {user.display_name || '(no name)'}
          </div>
          {user.ip_address && (
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: "'Barlow Condensed',sans-serif", textAlign: 'center', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={user.ip_address}>
              {user.ip_address}
            </div>
          )}
        </div>

        {/* Main content — stop propagation so pill clicks don't trigger drill-in */}
        <div onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1: pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <Pill
              color={membershipColor[tier]}
              textColor={membershipText[tier]}
              onClick={() => setModal('editMembership')}
            >
              💎 {tier.toUpperCase()}
            </Pill>
            {user.verified && <Pill color="rgba(74,222,128,0.12)" textColor="#4ade80">✓ VERIFIED</Pill>}
            {user.banned && <Pill color="rgba(220,38,38,0.15)" textColor="#f87171">⛔ BANNED</Pill>}
            {user.role === 'admin' && <Pill color="rgba(239,68,68,0.15)" textColor="#f87171">ADMIN</Pill>}
            <Pill color="rgba(139,92,246,0.12)" textColor="#a78bfa" onClick={() => setModal('editBadge')}>🎖 BADGE</Pill>
            <Pill
              color="rgba(212,175,55,0.1)"
              textColor={G}
              onClick={() => setModal('editGold')}
            >
              🪙 {(user.fg_balance || 0).toLocaleString()} FG
            </Pill>
          </div>

          {/* Row 2: disputes / escrow / email */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Pill
              color={user.dispute_count > 0 ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.05)'}
              textColor={user.dispute_count > 0 ? '#f87171' : 'var(--mt)'}
              onClick={() => setModal('disputes')}
            >
              ⚖ {user.dispute_count} DISPUTE{user.dispute_count !== 1 ? 'S' : ''}
            </Pill>
            <Pill
              color="rgba(167,139,250,0.1)"
              textColor="#a78bfa"
              onClick={() => setModal('escrow')}
            >
              🔒 {user.escrow_count} ESCROW{user.escrow_fg_total > 0 ? ` · ${user.escrow_fg_total.toLocaleString()} FG` : ''}
            </Pill>
            <Pill
              color="rgba(96,165,250,0.1)"
              textColor="#60a5fa"
              onClick={() => setModal('posts')}
            >
              📋 POSTS
            </Pill>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', fontFamily: "'Barlow Condensed',sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }} title={user.email}>
              {user.email}
            </span>
          </div>
        </div>

        {/* BAN button + drill-in arrow — hidden for the currently logged-in admin */}
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {user.id !== currentUserId && (
            <button
              onClick={() => setModal('ban')}
              style={{ background: user.banned ? 'rgba(255,255,255,0.06)' : 'rgba(220,38,38,0.1)', border: `1px solid ${user.banned ? 'rgba(255,255,255,0.1)' : 'rgba(220,38,38,0.3)'}`, borderRadius: 8, color: user.banned ? 'var(--mt)' : '#f87171', fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: '.08em', padding: '6px 10px', cursor: 'pointer', textTransform: 'uppercase' }}
            >
              {user.banned ? 'Banned' : 'Ban'}
            </button>
          )}
          {onSelect && (
            <span style={{ fontSize: 14, color: 'rgba(212,175,55,0.4)', userSelect: 'none' }}>›</span>
          )}
        </div>
      </div>

      {/* Modals */}
      {modal === 'ban' && (
        <BanModal
          user={user}
          token={token}
          onClose={() => setModal(null)}
          onSuccess={() => setUser(u => ({ ...u, banned: true }))}
        />
      )}
      {modal === 'editName' && (
        <EditNameModal
          user={user}
          token={token}
          onClose={() => setModal(null)}
          onSuccess={name => setUser(u => ({ ...u, display_name: name }))}
        />
      )}
      {modal === 'editGold' && (
        <EditGoldModal
          user={user}
          token={token}
          onClose={() => setModal(null)}
          onSuccess={amount => setUser(u => ({ ...u, fg_balance: amount }))}
        />
      )}
      {modal === 'editMembership' && (
        <EditMembershipModal
          user={user}
          token={token}
          onClose={() => setModal(null)}
          onSuccess={(tier, expiry) => setUser(u => ({ ...u, membership: tier, membership_expiry: expiry }))}
        />
      )}
      {modal === 'editBadge' && (
        <EditBadgeModal
          user={user}
          token={token}
          onClose={() => setModal(null)}
          onSuccess={updates => setUser(u => ({ ...u, ...updates }))}
        />
      )}
      {modal === 'disputes' && (
        <RecordsModal
          title={`Disputes — ${user.display_name || user.email}`}
          token={token}
          userId={user.id}
          type="user-disputes"
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'escrow' && (
        <RecordsModal
          title={`Escrow — ${user.display_name || user.email}`}
          token={token}
          userId={user.id}
          type="user-escrow"
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'posts' && (
        <RecordsModal
          title={`Posts — ${user.display_name || user.email}`}
          token={token}
          userId={user.id}
          type="user-posts"
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

// ── Shared skill display-config editor (migration 023 fields) ─────────────
// Renders the new columns below the existing name/description fields.
// Used in catalog, rewards, and rewards_catalog edit panels.
// configFields: live list from DB (or MASTER_CONFIG_FIELDS as fallback).
function SkillDisplayConfigFields({ editForm, setEditForm, inputStyle, configFields = MASTER_CONFIG_FIELDS }) {
  const G2 = '#D4AF37';
  const label = (text) => (
    <label style={{ fontSize: 9, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3, display: 'block' }}>{text}</label>
  );
  const Toggle = ({ field, children }) => (
    <button
      type="button"
      onClick={() => setEditForm(f => ({ ...f, [field]: !f[field] }))}
      style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${editForm[field] ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.08)'}`, background: editForm[field] ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.02)', color: editForm[field] ? '#22c55e' : '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', cursor: 'pointer', letterSpacing: '.08em', whiteSpace: 'nowrap' }}
    >
      {editForm[field] ? '✓ ' : ''}{children}
    </button>
  );

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(212,175,55,0.08)' }}>
      <div style={{ fontSize: 8, color: '#4a4058', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.18em', marginBottom: 10 }}>Display Config</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          {label('Icon (emoji or key)')}
          <input value={editForm.icon || ''} onChange={e => setEditForm(f => ({ ...f, icon: e.target.value }))} placeholder="e.g. ⚔️ or avatar_glow" style={inputStyle} />
        </div>
        <div>
          {label('Display Order')}
          <input type="number" value={editForm.display_order ?? 0} onChange={e => setEditForm(f => ({ ...f, display_order: e.target.value }))} style={inputStyle} />
        </div>
        <div>
          {label('Store Label (override)')}
          <input value={editForm.endpoint_label || ''} onChange={e => setEditForm(f => ({ ...f, endpoint_label: e.target.value }))} placeholder="e.g. +Avatar Glow (7 days)" style={inputStyle} />
        </div>
        <div>
          {label('Tier Color (hex)')}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="color"
              value={editForm.tier_color || '#D4AF37'}
              onChange={e => setEditForm(f => ({ ...f, tier_color: e.target.value }))}
              style={{ width: 36, height: 28, padding: 2, borderRadius: 4, border: '1px solid rgba(212,175,55,0.2)', background: 'transparent', cursor: 'pointer' }}
            />
            <input value={editForm.tier_color || ''} onChange={e => setEditForm(f => ({ ...f, tier_color: e.target.value }))} placeholder="#D4AF37" style={{ ...inputStyle, flex: 1 }} />
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        {label('Requirements Text (shown to users)')}
        <input value={editForm.requirements_text || ''} onChange={e => setEditForm(f => ({ ...f, requirements_text: e.target.value }))} placeholder="e.g. Reach Rank 10 or purchase Premium" style={inputStyle} />
      </div>
      <div style={{ marginBottom: 10 }}>
        {label('Completion Celebration (emoji / animation key)')}
        <input value={editForm.completion_celebration || ''} onChange={e => setEditForm(f => ({ ...f, completion_celebration: e.target.value }))} placeholder="e.g. 🎉 or confetti" style={inputStyle} />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 8, color: '#4a4058', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', alignSelf: 'center', marginRight: 4 }}>Show on:</span>
        <Toggle field="show_on_profile">Profile</Toggle>
        <Toggle field="show_on_store">Store</Toggle>
        <Toggle field="show_on_ranks">Ranks</Toggle>
      </div>

      <ConfigFieldsPicker configFields={configFields} editForm={editForm} setEditForm={setEditForm} />
    </div>
  );
}

// ── Skills Tab ─────────────────────────────────────────────────────────────
const SKILL_TYPES = [
  // Cosmetics
  'avatar_glow', 'post_glow', 'badge', 'title', 'banner_shoutout', 'border', 'effect', 'banner_message',
  // Perks (functional)
  'extra_referrals', 'bonus_posts', 'priority_listing', 'larger_stash', 'extended_escrow', 'early_access', 'fee_discount',
  // Build Planner perks
  'build_notifications', 'saved_maps', 'build_queue_slots',
  'other',
];
const SKILL_SOURCES = ['manual', 'rank', 'raffle', 'purchase', 'achievement', 'fg_shop'];
const TYPE_COLORS = {
  // Cosmetics
  avatar_glow: '#a855f7', post_glow: '#f59e0b', badge: '#3b82f6', title: '#22c55e', banner_shoutout: '#ec4899', border: '#06b6d4', effect: '#f43f5e', banner_message: '#fbbf24',
  // Perks
  extra_referrals: '#14b8a6', bonus_posts: '#8b5cf6', priority_listing: '#f97316', larger_stash: '#0ea5e9', extended_escrow: '#84cc16', early_access: '#e879f9', fee_discount: '#fb923c',
  // Build Planner perks
  build_notifications: '#f472b6', saved_maps: '#34d399', build_queue_slots: '#a78bfa',
  other: '#6b7280',
};
const PERK_TYPES = new Set(['extra_referrals', 'bonus_posts', 'priority_listing', 'larger_stash', 'extended_escrow', 'early_access', 'fee_discount', 'build_notifications', 'saved_maps', 'build_queue_slots']);
const PERK_CONFIG_LABELS = {
  extra_referrals: { field: 'amount', label: 'Extra Referral Codes / Week', placeholder: 'e.g. 3' },
  bonus_posts: { field: 'amount', label: 'Extra Auction Posts / Day', placeholder: 'e.g. 2' },
  priority_listing: { field: 'boost', label: 'Listing Priority Boost %', placeholder: 'e.g. 25' },
  larger_stash: { field: 'slots', label: 'Extra Stash Slots', placeholder: 'e.g. 10' },
  extended_escrow: { field: 'hours', label: 'Extra Escrow Hours', placeholder: 'e.g. 24' },
  early_access: { field: 'days', label: 'Early Access Days', placeholder: 'e.g. 7' },
  fee_discount: { field: 'percent', label: 'Fee Discount %', placeholder: 'e.g. 15' },
  build_notifications: { field: 'enabled', label: 'Build Notifications Enabled', placeholder: '1 = on' },
  saved_maps: { field: 'slots', label: 'Max Saved Maps', placeholder: 'e.g. 3' },
  build_queue_slots: { field: 'slots', label: 'Max Build Queue Slots', placeholder: 'e.g. 1' },
};

// Wired status: tracks whether each skill type has frontend rendering + backend enforcement
// 'green' = fully wired to user_skills table, 'yellow' = old system (membership tier), 'red' = not wired
const WIRED_STATUS = {
  // Cosmetics
  avatar_glow:      { status: 'red',    note: 'Rank 50 sets users.glowing_avatar but no UI renders it. Needs migration to user_skills.' },
  post_glow:        { status: 'yellow', note: 'Working via old membership tier system (threads.is_glowing). Not yet on user_skills.' },
  badge:            { status: 'yellow', note: 'Working via users.badges[] array + membership detection. Not yet on user_skills.' },
  title:            { status: 'red',    note: 'No rendering code exists. Need to build title display on profiles/posts.' },
  banner_shoutout:  { status: 'red',    note: 'No rendering code exists. Need to build banner shoutout system.' },
  border:           { status: 'red',    note: 'No rendering code exists. Need to build border system for cards/profiles.' },
  effect:           { status: 'red',    note: 'No rendering code exists. Need to build particle/animation effects.' },
  banner_message:   { status: 'red',    note: 'No rendering code exists. Need to build banner message display.' },
  // Perks
  extra_referrals:  { status: 'red',    note: 'No enforcement code. Referral system doesn\'t check user_skills.' },
  bonus_posts:      { status: 'red',    note: 'No enforcement code. Trade limits use membership tier, not user_skills.' },
  priority_listing: { status: 'red',    note: 'No enforcement code. Listing sort doesn\'t check user_skills.' },
  larger_stash:     { status: 'red',    note: 'No enforcement code. Stash size is not limited yet.' },
  extended_escrow:  { status: 'red',    note: 'No enforcement code. Escrow uses fixed timeouts.' },
  early_access:     { status: 'red',    note: 'No enforcement code. No feature gating exists.' },
  fee_discount:     { status: 'red',    note: 'No enforcement code. Fees don\'t check user_skills.' },
  // Build Planner perks
  build_notifications: { status: 'red', note: 'Build Planner not yet integrated. Will notify when matching items are listed.' },
  saved_maps:       { status: 'red',    note: 'Map save/load not yet wired to user_skills. Perk controls max saved maps.' },
  build_queue_slots: { status: 'red',   note: 'Build queue not yet implemented. Perk controls how many builds can queue for notifications.' },
  other:            { status: 'red',    note: 'Custom type — wire manually.' },
};
const WIRED_COLORS = { green: '#22c55e', yellow: '#facc15', red: '#ef4444' };
const WIRED_LABELS = { green: 'Live', yellow: 'Old System', red: 'Not Wired' };

const SKILL_TAGS = [
  { id: 'fg_purchase', label: 'FG Purchase', color: '#facc15' },
  { id: 'sub_purchase', label: 'Sub Purchase', color: '#a855f7' },
  { id: 'gold_bonus', label: 'Gold Bonus', color: '#f59e0b' },
  { id: 'raffle_award', label: 'Raffle Award', color: '#3b82f6' },
  { id: 'rank_reward', label: 'Rank Reward', color: '#22c55e' },
  { id: 'achievement', label: 'Achievement', color: '#ec4899' },
  { id: 'manual_grant', label: 'Manual Grant', color: '#6b7280' },
];

const TRIGGER_TYPES = ['gem_clicks', 'daily_draw', 'weekly_troll', 'monthly_raffle'];
const TRIGGER_SCHEDULES = ['daily', 'weekly', 'monthly', 'custom'];

// ── Per-assignment config fields driven by skill type ─────────────────────
// These are the dials you set when *attaching* a skill to a tier/rank/package.
// Keys match config object fields stored in the assignment.
const SKILL_ASSIGN_FIELDS = {
  post_glow:           [{ key: 'uses', label: 'Glow Tokens', type: 'number', placeholder: 'e.g. 3', unlimitedAllowed: true }],
  avatar_glow:         [{ key: 'duration_minutes', label: 'Duration (min)', type: 'number', placeholder: 'e.g. 10080', unlimitedAllowed: true }],
  badge:               [],
  title:               [{ key: 'title_text', label: 'Title Text', type: 'text', placeholder: 'e.g. Legendary Trader' }],
  banner_shoutout:     [{ key: 'uses', label: 'Uses', type: 'number', placeholder: 'e.g. 1', unlimitedAllowed: true }, { key: 'duration_minutes', label: 'Duration (min)', type: 'number', placeholder: 'e.g. 60', unlimitedAllowed: true }],
  border:              [{ key: 'duration_minutes', label: 'Duration (min)', type: 'number', placeholder: 'e.g. 10080', unlimitedAllowed: true }],
  effect:              [{ key: 'duration_minutes', label: 'Duration (min)', type: 'number', placeholder: 'e.g. 10080', unlimitedAllowed: true }],
  banner_message:      [{ key: 'duration_minutes', label: 'Duration (min)', type: 'number', placeholder: 'e.g. 1440', unlimitedAllowed: true }],
  extra_referrals:     [{ key: 'amount', label: 'Extra Referrals/Week', type: 'number', placeholder: 'e.g. 3', unlimitedAllowed: true }],
  bonus_posts:         [{ key: 'amount', label: 'Extra Posts/Day', type: 'number', placeholder: 'e.g. 2', unlimitedAllowed: true }],
  priority_listing:    [{ key: 'boost', label: 'Priority Boost %', type: 'number', placeholder: 'e.g. 25' }],
  larger_stash:        [{ key: 'slots', label: 'Extra Stash Slots', type: 'number', placeholder: 'e.g. 10', unlimitedAllowed: true }],
  extended_escrow:     [{ key: 'hours', label: 'Extra Escrow Hours', type: 'number', placeholder: 'e.g. 24', unlimitedAllowed: true }],
  early_access:        [{ key: 'days', label: 'Early Access Days', type: 'number', placeholder: 'e.g. 7', unlimitedAllowed: true }],
  fee_discount:        [{ key: 'percent', label: 'Fee Discount %', type: 'number', placeholder: 'e.g. 15' }],
  build_notifications: [{ key: 'enabled', label: 'Enabled', type: 'toggle' }],
  saved_maps:          [{ key: 'slots', label: 'Max Saved Maps', type: 'number', placeholder: 'e.g. 3', unlimitedAllowed: true }],
  build_queue_slots:   [{ key: 'slots', label: 'Max Build Queue Slots', type: 'number', placeholder: 'e.g. 1', unlimitedAllowed: true }],
  other:               [{ key: 'value', label: 'Value', type: 'text', placeholder: '' }],
};

// ── Master list of generic config fields available for any skill ──────────
// Admin ticks these in the Catalogue edit form → stored in dials.fields
// → endpoint rank/store cards render them as inputs.
// "Tokens" is universal: for gambling skills it means tickets.
const MASTER_CONFIG_FIELDS = [
  { key: 'duration_minutes', label: 'Duration (minutes)',  type: 'number',  default: null,  nullable: true,  nullable_label: 'Permanent'   },
  { key: 'tokens',           label: 'Tokens',              type: 'number',  default: null,  nullable: true,  nullable_label: 'Unlimited'   },
  { key: 'cooldown_minutes', label: 'Cooldown (minutes)',  type: 'number',  default: null,  nullable: true,  nullable_label: 'No Cooldown' },
  { key: 'max_uses_per_day', label: 'Max Uses Per Day',    type: 'number',  default: null,  nullable: true,  nullable_label: 'Unlimited'   },
  { key: 'boost_percent',    label: 'Boost Percentage',    type: 'number',  default: null,  nullable: false                                },
  { key: 'stack_limit',      label: 'Stack Limit',         type: 'number',  default: null,  nullable: true,  nullable_label: 'Unlimited'   },
  { key: 'priority_level',   label: 'Priority Level',      type: 'number',  default: 0,     nullable: false                                },
  { key: 'charges',          label: 'Charges',             type: 'number',  default: null,  nullable: true,  nullable_label: 'Unlimited'   },
  { key: 'radius',           label: 'Radius / Range',      type: 'number',  default: null,  nullable: false                                },
  { key: 'multiplier',       label: 'Multiplier',          type: 'number',  default: 1,     nullable: false                                },
  { key: 'threshold',        label: 'Threshold',           type: 'number',  default: null,  nullable: false                                },
  { key: 'expiry_date',      label: 'Expiry Date',         type: 'date',    default: null,  nullable: true,  nullable_label: 'Never'       },
  { key: 'auto_renew',       label: 'Auto-Renew',          type: 'boolean', default: false, nullable: false                                },
];

// ── ConfigFieldsPicker ────────────────────────────────────────────────────
// Reusable checkbox grid for selecting which config fields a catalogue item
// exposes when attached to an endpoint (rank, store tier, etc.).
// configFields = live array from DB (falls back to MASTER_CONFIG_FIELDS shape).
// "New" fields (key not in the hardcoded seed set) get an amber dot warning.
const SEED_KEYS = new Set(MASTER_CONFIG_FIELDS.map(f => f.key));
function ConfigFieldsPicker({ configFields, editForm, setEditForm }) {
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(212,175,55,0.08)' }}>
      <div style={{ fontSize: 8, color: '#4a4058', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.18em', marginBottom: 6 }}>Config Fields (dials)</div>
      <div style={{ fontSize: 9, color: '#4a4058', marginBottom: 8, lineHeight: 1.5 }}>
        Tick the fields endpoint cards should show when this item is attached to a rank or subscription.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
        {configFields.map(f => {
          const checked = (editForm.dials_fields || []).includes(f.key);
          const isNew = !SEED_KEYS.has(f.key);
          return (
            <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '5px 7px', borderRadius: 5, background: checked ? 'rgba(212,175,55,0.06)' : 'rgba(255,255,255,0.01)', border: `1px solid ${checked ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.04)'}` }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={e => {
                  const cur = editForm.dials_fields || [];
                  setEditForm(form => ({
                    ...form,
                    dials_fields: e.target.checked
                      ? [...cur, f.key]
                      : cur.filter(k => k !== f.key),
                  }));
                }}
                style={{ width: 11, height: 11, accentColor: '#D4AF37', cursor: 'pointer', flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, color: checked ? '#D4AF37' : '#9a8eb0', fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1.2 }}>{f.label}</span>
                  {isNew && !checked && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', flexShrink: 0, display: 'inline-block' }} title="New config type — not yet applied to any items" />}
                </div>
                <div style={{ fontSize: 7, color: '#4a4058', textTransform: 'uppercase', letterSpacing: '.05em' }}>{f.type}{f.nullable ? ' · nullable' : ''}</div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// Returns a compact summary string for a skill assignment config (for matrix cells)
function skillConfigSummary(skillType, config) {
  if (!config) return '\u2713';
  const fields = SKILL_ASSIGN_FIELDS[skillType] || [];
  const parts = fields.filter(f => config[f.key] !== undefined && config[f.key] !== '').map(f => {
    if (f.type === 'toggle') return config[f.key] ? '\u2713' : '';
    if (f.unlimitedAllowed && config[f.key] === null) return '\u221e'; // ∞
    const v = String(config[f.key]);
    if (f.key === 'duration_minutes') {
      const m = parseInt(v);
      if (!m) return '';
      if (m < 60) return m + 'm';
      if (m < 1440) return (m / 60) + 'h';
      if (m < 10080) return (m / 1440) + 'd';
      return (m / 10080) + 'w';
    }
    return v;
  }).filter(Boolean);
  return parts.length > 0 ? parts.join('\u00b7') : '\u2713';
}

// ── Skill field input with optional Unlimited/nullable checkbox ────────────
// Supports both legacy `f.unlimitedAllowed` and new `f.nullable` / `f.nullable_label` schema.
function SkillFieldInput({ f, value, tc, onChange }) {
  const canBeNull = f.nullable || f.unlimitedAllowed;
  const nullLabel = f.nullable_label || 'Unlimited';
  const isUnlimited = canBeNull && value === null;
  if (f.type === 'toggle') {
    return (
      <button onClick={() => onChange(f.key, !value)}
        style={{ width: 44, height: 22, borderRadius: 4, border: value ? `1px solid ${tc}40` : '1px solid rgba(255,255,255,0.08)', background: value ? tc + '20' : 'rgba(255,255,255,0.03)', color: value ? tc : '#6a6078', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
        {value ? '✓' : '—'}
      </button>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {isUnlimited ? (
          <div style={{ width: 70, height: 24, borderRadius: 4, border: `1px solid ${tc}30`, background: 'rgba(10,8,12,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tc, fontSize: 13, fontWeight: 900 }}>∞</div>
        ) : (
          <input type={f.type} value={value ?? ''} onChange={e => onChange(f.key, e.target.value)} placeholder={f.placeholder}
            style={{ background: 'rgba(10,8,12,0.6)', border: `1px solid ${tc}30`, borderRadius: 4, padding: '3px 7px', color: tc, fontSize: 11, fontWeight: 900, outline: 'none', width: 70, fontFamily: "'Barlow Condensed',sans-serif" }} />
        )}
      </div>
      {canBeNull && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
          <input type="checkbox" checked={isUnlimited} onChange={e => onChange(f.key, e.target.checked ? null : '')}
            style={{ width: 10, height: 10, accentColor: tc, cursor: 'pointer' }} />
          <span style={{ fontSize: 7, color: isUnlimited ? tc : '#6a6078', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{nullLabel}</span>
        </label>
      )}
    </div>
  );
}

// Normalise a skill entry that may be a raw ID string or {id, config} object
function normaliseSkillEntry(entry) {
  if (typeof entry === 'string') return { id: entry, config: {} };
  return entry;
}

// ── Shared hook: live assignment data for the catalog matrix ──────────────
// Loads subscription_tiers + fg_packages from Supabase.
// Returns { tiers, packages, loading, reload }
function useAssignmentMatrix() {
  const [tiers, setTiers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tiersRes, pkgsRes] = await Promise.all([
        supabase.from('subscription_tiers').select('id, name, color, skills, permissions, rewards').order('sort_order'),
        supabase.from('fg_packages').select('id, name, color, skills, permissions, rewards').order('sort_order'),
      ]);
      setTiers(tiersRes.data || []);
      setPackages(pkgsRes.data || []);
    } catch (e) { console.error('[useAssignmentMatrix]', e); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  return { tiers, packages, loading, reload: load };
}

// ── Permissions Panel (tap-to-edit) ────────────────────────────────────────
const DEFAULT_PERM_GROUPS = [
  { id: 'trading', label: 'Trading', color: '#4ade80', items: [
    { id: 'trades_per_window', name: 'Trades per Hour', desc: 'Maximum trades allowed per time window', hasValue: true, valueLabel: 'Count', window: 1, windowUnit: 'hours', defaults: { free: 10, verified: 20, basic: 30, premium: 50, legendary: '\u221E' } },
    { id: 'max_auctions', name: 'Active Auction Slots', desc: 'Maximum concurrent auctions', hasValue: true, valueLabel: 'Slots', defaults: { free: 2, verified: 10, basic: 5, premium: 15, legendary: '\u221E' } },
    { id: 'zero_fees', name: 'Zero Market Fees', desc: 'No FG fee on marketplace trades', hasValue: false, defaults: { free: '\u2014', verified: '\u2014', basic: '\u2014', premium: '\u2014', legendary: '\u2713' } },
    { id: 'reduced_escrow', name: 'Reduced Escrow Hold', desc: 'Shorter escrow hold time before release', hasValue: true, valueLabel: 'Hours', defaults: { free: 24, verified: 24, basic: 12, premium: 6, legendary: 1 } },
  ]},
  { id: 'economy', label: 'Economy', color: '#facc15', items: [
    { id: 'fg_bonus_pct', name: 'FG Bonus %', desc: 'Extra FG on all earned amounts', hasValue: true, valueLabel: '%', defaults: { free: 0, verified: 0, basic: 5, premium: 10, legendary: 25 } },
    { id: 'monthly_fg', name: 'Monthly FG Gift', desc: 'Free FG deposited on billing cycle', hasValue: true, valueLabel: 'FG', defaults: { free: 0, verified: 0, basic: 50, premium: 200, legendary: 1000 } },
    { id: 'priority_search', name: 'Priority Search', desc: 'Listings appear higher in search results', hasValue: false, defaults: { free: '\u2014', verified: '\u2014', basic: '\u2014', premium: '\u2713', legendary: '\u2713' } },
  ]},
  { id: 'access', label: 'Access', color: '#60a5fa', items: [
    { id: 'early_access', name: 'Early Access Features', desc: 'Beta features before public release', hasValue: false, defaults: { free: '\u2014', verified: '\u2014', basic: '\u2014', premium: '\u2713', legendary: '\u2713' } },
    { id: 'exclusive_raffles', name: 'Exclusive Raffles', desc: 'Access to tier-only raffle events', hasValue: false, defaults: { free: '\u2014', verified: '\u2014', basic: '\u2713', premium: '\u2713', legendary: '\u2713' } },
    { id: 'ad_free', name: 'Ad-Free Experience', desc: 'No promotional banners', hasValue: false, defaults: { free: '\u2014', verified: '\u2713', basic: '\u2713', premium: '\u2713', legendary: '\u2713' } },
  ]},
];
const PERM_TIERS = ['free', 'verified', 'basic', 'premium', 'legendary'];
const PERM_TIER_COLORS = { free: '#9ca3af', verified: '#22c55e', basic: '#6b7280', premium: '#D4AF37', legendary: '#a855f7' };
const GROUP_COLORS = ['#4ade80', '#facc15', '#60a5fa', '#f472b6', '#a78bfa', '#fb923c'];

// Shared hook — loads permissions from Supabase admin_permissions table.
// Uses raw REST fetch (not supabase-js) to avoid GoTrue auth-mutex hangs
// when the main client is mid-token-refresh (multiple GoTrueClient warning).
// admin_permissions has "Anyone can read" RLS policy, so anon key is enough.
function useDbPerms() {
  const [perms, setPerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://isjkdbmfxpxuuloqosib.supabase.co') + '/rest/v1/admin_permissions?select=*&order=sort_order';
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzamtkYm1meHB4dXVsb3Fvc2liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDk4MDcsImV4cCI6MjA5MDIyNTgwN30.UdzV7PkGnEo0jgnViPzif13kaS88MeAnhHYsbbg2ugA';
      const res = await fetch(url, { headers: { apikey: anon, Authorization: 'Bearer ' + anon } });
      if (!res.ok) {
        const body = await res.text();
        throw new Error('HTTP ' + res.status + ': ' + body.slice(0, 120));
      }
      const data = await res.json();
      setPerms(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) {
      console.error('[useDbPerms] load failed:', e);
      setError(e.message || String(e));
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  // Group perms by group_id for display
  const grouped = useMemo(() => {
    const map = {};
    perms.forEach(p => {
      if (!map[p.group_id]) map[p.group_id] = { id: p.group_id, label: p.group_label, color: p.group_color, items: [] };
      map[p.group_id].items.push({ id: p.id, name: p.name, desc: p.description, hasValue: p.has_value, valueLabel: p.value_label, window: p.time_window, windowUnit: p.window_unit, defaults: p.defaults || {} });
    });
    return Object.values(map);
  }, [perms]);
  // Flat list for subscription tab
  const flat = useMemo(() => perms.map(p => ({ id: p.id, name: p.name, desc: p.description, hasValue: p.has_value, groupColor: p.group_color, groupLabel: p.group_label, defaults: p.defaults || {} })), [perms]);
  return { perms, grouped, flat, loading, error, reload: load };
}

function PermissionsPanel() {
  const { grouped: permGroups, loading: permLoading, error: permError, reload: reloadPerms } = useDbPerms();
  const { tiers: matrixTiers, packages: matrixPackages } = useAssignmentMatrix();
  const [editingPerm, setEditingPerm] = useState(null);
  const [editingMeta, setEditingMeta] = useState(null);
  const [metaForm, setMetaForm] = useState({ name: '', desc: '' });
  const [showAddPerm, setShowAddPerm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', desc: '', group: 'trading', hasValue: true, window: '', windowUnit: 'hours' });

  const STD_TIERS = ['free', 'verified', 'basic', 'premium', 'legendary'];
  const tierCols = STD_TIERS.map(tid => matrixTiers.find(t => t.id === tid)).filter(Boolean);
  const tierColors = { free: '#9ca3af', verified: '#22c55e', basic: '#6b7280', premium: '#D4AF37', legendary: '#a855f7' };

  // Build usage map from matrix data (same as before but derived from matrixTiers/Packages)
  const usage = useMemo(() => {
    const map = {};
    const push = (permId, entry) => { (map[permId] = map[permId] || []).push(entry); };
    matrixTiers.forEach(t => {
      Object.entries(t.permissions || {}).forEach(([pid, val]) => {
        if (val && val !== '0' && val !== '\u2014' && val !== '') push(pid, { source: 'sub', name: t.name, color: t.color || '#a855f7', value: val });
      });
    });
    matrixPackages.forEach(p => {
      Object.entries(p.permissions || {}).forEach(([pid, val]) => {
        if (val && val !== '0' && val !== '\u2014' && val !== '') push(pid, { source: 'fg', name: p.name, color: p.color || '#facc15', value: val });
      });
    });
    return map;
  }, [matrixTiers, matrixPackages]);

  const permApi = async (action, body) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const r = await fetch('/api/admin/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action, ...body }),
    });
    return r.json();
  };

  const deletePerm = async (groupId, permId) => {
    await permApi('delete_permission', { id: permId });
    reloadPerms();
    if (editingPerm === permId) setEditingPerm(null);
  };

  const addPerm = async () => {
    if (!addForm.name.trim()) return;
    const id = addForm.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const groupColors = { trading: { label: 'Trading', color: '#4ade80' }, access: { label: 'Access', color: '#60a5fa' }, rewards: { label: 'Rewards', color: '#facc15' }, social: { label: 'Social', color: '#a855f7' } };
    const groupInfo = permGroups.find(g => g.id === addForm.group) || groupColors[addForm.group] || { label: addForm.group, color: '#6b7280' };
    const defaults = { free: '\u2014', verified: '\u2014', basic: '\u2014', premium: '\u2014', legendary: '\u2713' };
    const { error } = await permApi('add_permission', {
      id, name: addForm.name.trim(), description: addForm.desc.trim(),
      group_id: addForm.group, group_label: groupInfo.label, group_color: groupInfo.color,
      has_value: false, value_label: null,
      time_window: null, window_unit: null,
      defaults, sort_order: 99,
    });
    if (error) { console.error('[addPerm]', error); return; }
    reloadPerms();
    setAddForm({ name: '', desc: '', group: 'trading', hasValue: true, window: '', windowUnit: 'hours' });
    setShowAddPerm(false);
  };

  const updatePermWindow = async (groupId, permId, field, val) => {
    const dbField = field === 'window' ? 'time_window' : 'window_unit';
    const dbVal = field === 'window' ? (parseInt(val) || null) : val;
    const update = { id: permId, [dbField]: dbVal };
    // Auto-update name to reflect new window if it matches "X per [unit]" pattern
    const grp = permGroups.find(g => g.id === groupId);
    const perm = grp?.items.find(p => p.id === permId);
    if (perm && /\bper\s+(minute|hour|day|minutes|hours|days)\b/i.test(perm.name)) {
      const newWindow = field === 'window' ? (parseInt(val) || null) : perm.window;
      const newUnit = field === 'windowUnit' ? val : perm.windowUnit;
      if (newWindow && newUnit) {
        const singular = { minutes: 'Minute', hours: 'Hour', days: 'Day' }[newUnit] || newUnit;
        const plural = { minutes: 'Minutes', hours: 'Hours', days: 'Days' }[newUnit] || newUnit;
        const unitWord = newWindow === 1 ? singular : plural;
        const replacement = newWindow === 1 ? `per ${unitWord}` : `per ${newWindow} ${unitWord}`;
        update.name = perm.name.replace(/\bper\s+\d*\s*(minute|hour|day|minutes|hours|days)\b/i, replacement);
      }
    }
    await permApi('update_permission', update);
    reloadPerms();
  };

  const saveMeta = async (groupId, permId) => {
    await permApi('update_permission', { id: permId, name: metaForm.name, description: metaForm.desc });
    reloadPerms();
    setEditingMeta(null);
  };

  const permInputStyle = { background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 4, padding: '3px 6px', color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 900, outline: 'none', width: '100%', textAlign: 'center' };
  const metaInputStyle = { background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 4, padding: '4px 8px', color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 700, outline: 'none', width: '100%' };

  return (
    <div>
      {/* Header + Add button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 9, color: '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.15em' }}>Permissions — define types here, assign them in Subscriptions / FG Bundles / Ranks</div>
        <button onClick={() => setShowAddPerm(!showAddPerm)} style={{ background: showAddPerm ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 6, padding: '4px 12px', color: '#D4AF37', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'Barlow Condensed',sans-serif" }}>
          {showAddPerm ? '\u2715 Cancel' : '+ Add Permission'}
        </button>
      </div>

      {/* Add permission form */}
      {showAddPerm && (
        <div style={{ background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#D4AF37', fontWeight: 700, marginBottom: 8, fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase', letterSpacing: '.1em' }}>New Permission</div>
          <input placeholder="Permission name" value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} style={{ ...metaInputStyle, marginBottom: 6 }} />
          <input placeholder="Description" value={addForm.desc} onChange={e => setAddForm(p => ({ ...p, desc: e.target.value }))} style={{ ...metaInputStyle, marginBottom: 8, fontSize: 10 }} />
          <div style={{ marginBottom: 8 }}>
            <select value={addForm.group} onChange={e => setAddForm(p => ({ ...p, group: e.target.value }))} style={{ ...metaInputStyle, width: '100%', fontSize: 10 }}>
              {(() => {
                const defaults = [
                  { id: 'trading', label: 'Trading', color: '#4ade80' },
                  { id: 'access', label: 'Access', color: '#60a5fa' },
                  { id: 'rewards', label: 'Rewards', color: '#facc15' },
                  { id: 'social', label: 'Social', color: '#a855f7' },
                ];
                const seen = new Set(permGroups.map(g => g.id));
                const merged = [...permGroups, ...defaults.filter(d => !seen.has(d.id))];
                return merged.map(g => <option key={g.id} value={g.id}>{g.label}</option>);
              })()}
            </select>
          </div>
          <button onClick={addPerm} style={{ background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 6, padding: '6px 16px', color: '#D4AF37', fontSize: 11, fontWeight: 700, cursor: 'pointer', width: '100%', fontFamily: "'Barlow Condensed',sans-serif" }}>Add Permission</button>
        </div>
      )}

      {permLoading && (
        <div style={{ textAlign: 'center', padding: '30px 20px', color: '#6a6078', fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif" }}>Loading permissions...</div>
      )}

      {!permLoading && permError && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Failed to load permissions</div>
          <div style={{ fontSize: 10, color: '#e8e0f0', wordBreak: 'break-all' }}>{permError}</div>
          <button onClick={reloadPerms} style={{ marginTop: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '4px 12px', color: '#ef4444', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {!permLoading && !permError && permGroups.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(212,175,55,0.15)', borderRadius: 12 }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 16, color: '#4a4058', marginBottom: 8 }}>No permissions yet</div>
          <div style={{ fontSize: 11, color: '#6a6078' }}>Click "+ Add Permission" to create your first one.</div>
        </div>
      )}

      {/* Permissions matrix table */}
      {!permLoading && !permError && permGroups.length > 0 && (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
            <thead>
              <tr>
                <th style={{ ...hcell, width: 180, position: 'sticky', left: 0, background: '#0a0810', zIndex: 2 }}>Permission</th>
                {tierCols.map(t => (
                  <th key={t.id} style={{ ...hcell, textAlign: 'center', color: tierColors[t.id] || '#9ca3af' }}>{t.name || t.id}</th>
                ))}
                <th style={{ ...hcell, textAlign: 'center', color: '#a855f7' }}>Sub</th>
                <th style={{ ...hcell, width: 52 }}></th>
              </tr>
            </thead>
            <tbody>
              {permGroups.map(grp => [
                <tr key={grp.id + '_hdr'}>
                  <td colSpan={tierCols.length + 3} style={{ padding: '12px 10px 4px', background: 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: grp.color }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: grp.color }} />
                      {grp.label}
                    </div>
                  </td>
                </tr>,
                ...grp.items.map(perm => {
                  const isEditing = editingPerm === perm.id;
                  const isEditingMeta = editingMeta === perm.id;
                  const pkgUsage = (usage[perm.id] || []).filter(u => u.source === 'fg');
                  return [
                    <tr key={perm.id} onClick={() => { if (!isEditingMeta) setEditingPerm(isEditing ? null : perm.id); }} style={{ cursor: 'pointer', background: isEditing ? 'rgba(212,175,55,0.03)' : 'transparent' }}>
                      <td style={{ ...cell, position: 'sticky', left: 0, background: isEditing ? '#0c0a0e' : '#080608', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: grp.color, flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: '#e8e0f0', fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif" }}>{perm.name}</div>
                          </div>
                        </div>
                      </td>
                      {tierCols.map(t => {
                        const val = (t.permissions || {})[perm.id];
                        const tc = tierColors[t.id] || '#9ca3af';
                        const display = val && val !== '0' && val !== '\u2014' ? val : null;
                        return (
                          <td key={t.id} style={{ ...cell, textAlign: 'center' }}>
                            {display ? <span style={{ color: tc, fontWeight: 900, fontSize: 10 }}>{display}</span> : <span style={{ color: '#2a2438' }}>—</span>}
                          </td>
                        );
                      })}
                      <td style={{ ...cell, textAlign: 'center' }}>
                        {(() => {
                          const subUsage = (usage[perm.id] || []).filter(u => u.source === 'sub');
                          return subUsage.length > 0
                            ? <span style={{ color: '#a855f7', fontWeight: 700, fontSize: 9 }} title={subUsage.map(u => u.name).join(', ')}>{subUsage.length > 2 ? subUsage.slice(0, 2).map(u => u.name).join(', ') + '…' : subUsage.map(u => u.name).join(', ')}</span>
                            : <span style={{ color: '#2a2438' }}>—</span>;
                        })()}
                      </td>
                      <td style={{ ...cell, textAlign: 'right' }}>
                        <span style={{ fontSize: 9, color: '#4a4058' }}>{isEditing ? '▲' : '▼'}</span>
                      </td>
                    </tr>,
                    isEditing && (
                      <tr key={perm.id + '_edit'}>
                        <td colSpan={tierCols.length + 3} style={{ padding: '0 14px 12px', background: 'rgba(212,175,55,0.02)', borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
                          {isEditingMeta ? (
                            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8, maxWidth: 360 }}>
                              <input value={metaForm.name} onChange={e => setMetaForm(p => ({ ...p, name: e.target.value }))} style={{ ...metaInputStyle }} placeholder="Name" />
                              <input value={metaForm.desc} onChange={e => setMetaForm(p => ({ ...p, desc: e.target.value }))} style={{ ...metaInputStyle, fontSize: 10 }} placeholder="Description" />
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => saveMeta(grp.id, perm.id)} style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 4, padding: '4px 14px', color: '#4ade80', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                                <button onClick={() => setEditingMeta(null)} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '4px 14px', color: '#6a6078', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ paddingTop: 8 }}>
                              {perm.desc && <div style={{ fontSize: 10, color: '#6a6078', marginBottom: 8 }}>{perm.desc}</div>}
                              {perm.window !== undefined && (
                                <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                                  <span style={{ fontSize: 9, color: '#6a6078', fontWeight: 700, whiteSpace: 'nowrap' }}>Window:</span>
                                  <input type="number" value={perm.window} onChange={e => updatePermWindow(grp.id, perm.id, 'window', e.target.value)} style={{ ...permInputStyle, width: 50, flex: '0 0 50px' }} />
                                  <select value={perm.windowUnit || 'hours'} onChange={e => updatePermWindow(grp.id, perm.id, 'windowUnit', e.target.value)} style={{ ...permInputStyle, width: 70, flex: '0 0 70px', fontSize: 10 }}>
                                    <option value="minutes">min</option>
                                    <option value="hours">hours</option>
                                    <option value="days">days</option>
                                  </select>
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                                <button onClick={() => { setMetaForm({ name: perm.name, desc: perm.desc }); setEditingMeta(perm.id); }} style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 4, padding: '4px 12px', color: '#60a5fa', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>Rename</button>
                                <button onClick={() => { if (confirm('Delete "' + perm.name + '"?')) deletePerm(grp.id, perm.id); }} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, padding: '4px 12px', color: '#ef4444', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                                <button onClick={() => setEditingPerm(null)} style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 4, padding: '4px 14px', color: '#4ade80', fontSize: 9, fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}>Close</button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ),
                  ];
                }),
              ])}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// GOLD TAB — Vault dashboard, FG supply, exchange rates, analytics
// ═══════════════════════════════════════════════════════
function GoldTab({ token }) {
  const [goldSubTab, setGoldSubTab] = useState('gold');
  const [vault, setVault] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRates, setEditingRates] = useState(false);
  const [rateForm, setRateForm] = useState({ fg_per_usd: '', fg_per_cad: '' });
  // #80B/#92 — pending-migration trigger state. One result per migration.
  const [migrationRunning, setMigrationRunning] = useState(null); // '044' | '045' | null
  const [migrationResults, setMigrationResults] = useState({}); // { '044': {ok, ...}, ... }
  // Gems state
  const [gemPrices, setGemPrices] = useState([]);
  const [gemRates, setGemRates] = useState([]);
  const [gemLedger, setGemLedger] = useState([]);
  const [editingGemPrice, setEditingGemPrice] = useState(null);
  const [editingGemRate, setEditingGemRate] = useState(null);
  // Exchange state
  const [exchSettings, setExchSettings] = useState(null);
  const [exchRequests, setExchRequests] = useState([]);
  const [exchStats, setExchStats] = useState(null);
  const [editingExchSettings, setEditingExchSettings] = useState(false);
  const [exchSettingsForm, setExchSettingsForm] = useState({});

  const GOLD_SUBS = [
    { id: 'gold', label: 'Gold' },
    { id: 'gems', label: 'Gems' },
    { id: 'exchange', label: 'Exchange' },
  ];

  const loadVaultData = useCallback(async () => {
    setLoading(true);
    try {
      const [vaultRes, ledgerRes, priceRes, gemPriceRes, gemRateRes, gemLedgerRes, exchSettRes, exchReqRes, exchStatRes] = await Promise.all([
        supabase.from('fg_vault').select('*').limit(1).single(),
        supabase.from('fg_ledger').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('fg_price_history').select('*').order('snapshot_at', { ascending: true }).limit(90),
        supabase.from('gem_prices').select('*').order('gem_cost', { ascending: true }),
        supabase.from('gem_exchange_rates').select('*'),
        supabase.from('gem_ledger').select('*').order('created_at', { ascending: false }).limit(30),
        supabase.from('exchange_settings').select('*').limit(1).single(),
        supabase.from('exchange_requests').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('exchange_stats').select('*').order('date', { ascending: false }).limit(1).single(),
      ]);
      if (vaultRes.data) setVault(vaultRes.data);
      if (ledgerRes.data) setLedger(ledgerRes.data);
      if (priceRes.data) setPriceHistory(priceRes.data);
      if (gemPriceRes.data) setGemPrices(gemPriceRes.data);
      if (gemRateRes.data) setGemRates(gemRateRes.data);
      if (gemLedgerRes.data) setGemLedger(gemLedgerRes.data);
      if (exchSettRes.data) setExchSettings(exchSettRes.data);
      if (exchReqRes.data) setExchRequests(exchReqRes.data);
      if (exchStatRes.data) setExchStats(exchStatRes.data);
    } catch (e) { console.error('Vault load error:', e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadVaultData(); }, [loadVaultData]);

  const formatBig = (n) => {
    if (n === null || n === undefined) return '—';
    const num = Number(n);
    if (!Number.isFinite(num)) return '—';
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  // #80B/#92 — trigger an admin-gated migration runner on the trade app.
  // Calls POST /api/admin/apply-migration with the admin's JWT. Server
  // verifies role=admin, opens a pg.Client to DATABASE_URL, runs the SQL
  // file. Result (rowsAffected / error / stage) bubbles back into UI.
  const runMigration = async (id) => {
    if (migrationRunning) return;
    if (!token) {
      setMigrationResults(p => ({ ...p, [id]: { ok: false, error: 'no admin token' } }));
      return;
    }
    setMigrationRunning(id);
    try {
      const res = await fetch('/api/admin/apply-migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ migrationId: id }),
      });
      const body = await res.json().catch(() => ({}));
      setMigrationResults(p => ({
        ...p,
        [id]: { ok: !!(res.ok && body?.ok), ...body, status: res.status, ranAt: new Date().toISOString() },
      }));
      // Refresh vault stats so the IN VAULT / CIRCULATING numbers reflect the
      // backfill immediately.
      try { await loadVaultData(); } catch (_) { /* noop */ }
    } catch (e) {
      setMigrationResults(p => ({ ...p, [id]: { ok: false, error: e?.message || String(e) } }));
    } finally {
      setMigrationRunning(null);
    }
  };

  const saveRates = async () => {
    if (!vault) return;
    const usd = parseFloat(rateForm.fg_per_usd);
    const cad = parseFloat(rateForm.fg_per_cad);
    if (!usd || !cad) return;
    await supabase.from('fg_vault').update({ fg_per_usd: usd, fg_per_cad: cad, last_rate_update: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', vault.id);
    // Snapshot to price history
    await supabase.from('fg_price_history').insert({ fg_per_usd: usd, fg_per_cad: cad, circulating: vault.circulating, volume_24h: 0 });
    setEditingRates(false);
    loadVaultData();
  };

  const TX_COLORS = { mint: '#4ade80', transfer: '#60a5fa', burn: '#ef4444', trade: '#D4AF37', reward: '#a855f7', purchase: '#facc15', escrow_lock: '#f97316', escrow_release: '#22d3ee', refund: '#f472b6' };
  const TX_ICONS = { mint: '\u26CF', transfer: '\u2192', burn: '\uD83D\uDD25', trade: '\u2694', reward: '\u2B50', purchase: '\uD83D\uDCB0', escrow_lock: '\uD83D\uDD12', escrow_release: '\uD83D\uDD13', refund: '\u21A9' };

  const cardStyle = { background: 'rgba(10,8,12,0.5)', border: '1px solid rgba(212,175,55,0.08)', borderRadius: 12, padding: 16 };
  const labelStyle = { fontSize: 9, color: '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em' };
  const bigNumStyle = { fontSize: 22, fontWeight: 900, color: '#D4AF37', fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1.1 };

  if (loading) return <TabSkeleton rows={6} />;

  return (
    <div>
      {/* Sub-tabs: Gold | Gems */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid rgba(212,175,55,0.1)', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        {GOLD_SUBS.map(s => (
          <button key={s.id} onClick={() => setGoldSubTab(s.id)} style={{ padding: '8px 18px', background: 'none', border: 'none', borderBottom: goldSubTab === s.id ? '2px solid #D4AF37' : '2px solid transparent', color: goldSubTab === s.id ? '#D4AF37' : '#6a6078', fontSize: 11, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase', letterSpacing: '.12em', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all .15s' }}>{s.label}</button>
        ))}
      </div>

      {goldSubTab === 'gold' && vault && (
        <div>
          {/* ── VAULT CARD ── */}
          <div style={{ ...cardStyle, marginBottom: 16, background: 'linear-gradient(135deg, rgba(10,8,12,0.7), rgba(212,175,55,0.04))', border: '1px solid rgba(212,175,55,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <img src="/assets/fg-coin.png" alt="FG" style={{ width: 32, height: 32 }} />
              <div>
                <div style={{ fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 16, color: '#D4AF37' }}>THE VAULT</div>
                <div style={labelStyle}>Forum Gold Supply Control</div>
              </div>
            </div>

            {/* Supply stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
              <div style={cardStyle}>
                <div style={labelStyle}>Total Supply</div>
                <div style={bigNumStyle}>{formatBig(vault.total_supply)}</div>
                <div style={{ fontSize: 8, color: '#4ade80', marginTop: 2 }}>100,000,000,000 coins</div>
              </div>
              {(() => {
                // #90: when in_vault is just below total_supply (e.g. 99,999,994,900
                // with 5,100 circulating), formatBig rounds to "100.00B" — looks
                // identical to TOTAL SUPPLY and Adam reads it as broken. Show
                // higher precision (5 dp on B-scale) to surface the gap, plus
                // exact toLocaleString underneath as the source of truth.
                const inVault = Math.max(0,
                  (Number(vault.total_supply) || 0)
                  - (Number(vault.circulating) || 0)
                  - (Number(vault.burned) || 0)
                  - (Number(vault.reserved) || 0)
                );
                const display = inVault >= 1e9
                  ? (inVault / 1e9).toFixed(5).replace(/\.?0+$/, '') + 'B'
                  : formatBig(inVault);
                return (
                  <div style={cardStyle}>
                    <div style={labelStyle}>In Vault</div>
                    <div style={{ ...bigNumStyle, color: '#60a5fa' }}>{display}</div>
                    <div style={{ fontSize: 8, color: '#6a6078', marginTop: 2 }}>Unminted · {inVault.toLocaleString()}</div>
                  </div>
                );
              })()}
              <div style={cardStyle}>
                <div style={labelStyle}>Circulating</div>
                <div style={{ ...bigNumStyle, color: '#4ade80' }}>{formatBig(Number(vault.circulating) || 0)}</div>
                <div style={{ fontSize: 8, color: '#6a6078', marginTop: 2 }}>In user wallets</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Burned</div>
                <div style={{ ...bigNumStyle, color: '#ef4444' }}>{formatBig(Number(vault.burned) || 0)}</div>
                <div style={{ fontSize: 8, color: '#6a6078', marginTop: 2 }}>Permanently destroyed</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Reserved</div>
                <div style={{ ...bigNumStyle, color: '#f97316' }}>{formatBig(Number(vault.reserved) || 0)}</div>
                <div style={{ fontSize: 8, color: '#6a6078', marginTop: 2 }}>Escrow / rewards / system</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Serials</div>
                <div style={{ ...bigNumStyle, color: '#a855f7', fontSize: 14 }}>FG-1 → FG-100B</div>
                <div style={{ fontSize: 8, color: '#6a6078', marginTop: 2 }}>Sequentially numbered</div>
              </div>
            </div>

            {/* Exchange Rates */}
            <div style={{ ...cardStyle, marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={labelStyle}>Exchange Rates</div>
                <button onClick={() => { if (editingRates) { saveRates(); } else { setRateForm({ fg_per_usd: vault.fg_per_usd, fg_per_cad: vault.fg_per_cad }); setEditingRates(true); } }} style={{ background: editingRates ? 'rgba(74,222,128,0.12)' : 'rgba(212,175,55,0.08)', border: editingRates ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(212,175,55,0.2)', borderRadius: 4, padding: '3px 10px', color: editingRates ? '#4ade80' : '#D4AF37', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>{editingRates ? 'Save' : 'Edit'}</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 9, color: '#6a6078', fontWeight: 700, marginBottom: 4 }}>FG per 1 USD</div>
                  {editingRates ? (
                    <input type="number" value={rateForm.fg_per_usd} onChange={e => setRateForm(p => ({ ...p, fg_per_usd: e.target.value }))} style={{ background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 4, padding: '6px 10px', color: '#D4AF37', fontSize: 18, fontWeight: 900, fontFamily: "'Barlow Condensed',sans-serif", outline: 'none', width: '100%' }} />
                  ) : (
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#4ade80', fontFamily: "'Barlow Condensed',sans-serif" }}>{Number(vault.fg_per_usd).toLocaleString()} FG</div>
                  )}
                  <div style={{ fontSize: 8, color: '#6a6078', marginTop: 2 }}>$1 USD = {Number(vault.fg_per_usd).toLocaleString()} FG</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#6a6078', fontWeight: 700, marginBottom: 4 }}>FG per 1 CAD</div>
                  {editingRates ? (
                    <input type="number" value={rateForm.fg_per_cad} onChange={e => setRateForm(p => ({ ...p, fg_per_cad: e.target.value }))} style={{ background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 4, padding: '6px 10px', color: '#D4AF37', fontSize: 18, fontWeight: 900, fontFamily: "'Barlow Condensed',sans-serif", outline: 'none', width: '100%' }} />
                  ) : (
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#facc15', fontFamily: "'Barlow Condensed',sans-serif" }}>{Number(vault.fg_per_cad).toLocaleString()} FG</div>
                  )}
                  <div style={{ fontSize: 8, color: '#6a6078', marginTop: 2 }}>$1 CAD = {Number(vault.fg_per_cad).toLocaleString()} FG</div>
                </div>
              </div>
              {vault.last_rate_update && (
                <div style={{ fontSize: 8, color: '#3a3048', marginTop: 8, textAlign: 'right' }}>Last updated: {new Date(vault.last_rate_update).toLocaleString()}</div>
              )}
            </div>
          </div>

          {/* ── PENDING MIGRATIONS ─────────────────────────────────────
              #80B/#92 — bot-shipped SQL migrations triggered from here.
              Admin-only POST to /api/admin/apply-migration runs the file
              server-side via pg.Client (using PM2's DATABASE_URL — never
              touches the bot's transcript). Atomic per migration; on
              error the file's BEGIN/COMMIT rolls back. */}
          <div style={{ ...cardStyle, marginBottom: 16, border: '1px solid rgba(245,158,11,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ ...labelStyle, color: '#fbbf24' }}>Pending Migrations</div>
              <div style={{ fontSize: 8, color: '#6a6078' }}>Admin-triggered, server-runs</div>
            </div>
            {[
              { id: '044', title: 'Phantom-FG Backfill', desc: 'Allocates fg_serial_ranges for every users.fg_balance > 0 (humans + bots). Reconciles fg_vault aggregate from truth. Idempotent — re-runs only fill gaps.' },
              { id: '045', title: 'GODLY avatar_glow Perk', desc: 'Inserts avatar_glow into the skills catalog and attaches it to the GODLY tier\'s subscription_tiers.skills array. Idempotent.' },
              { id: '046', title: 'Reconcile Escrow Vault', desc: 'Sets fg_vault.reserved = SUM(escrow.fg_amount WHERE status=held) and adjusts circulating to match. Backfills fg_ledger audit rows for held escrows that pre-date the chokepoint helpers. Idempotent — re-runs are no-ops once aggregates match.' },
              { id: '047', title: 'Builder Save/Load Schema', desc: 'Extends user_builds with slot_number (1-3 pinned + null = named saves), build_data jsonb, and is_pinned. Backfills build_data from legacy columns. Adds partial unique index on (user_id, slot_number) WHERE not null. Required for /builder save/load (#110). Idempotent.' },
              { id: '048', title: 'Boss Rotations (Map)', desc: 'Creates public.boss_rotations + RLS public-read + seeds 6 D4 endgame bosses on a 30-min stagger + pg_cron tick that advances expired rows by 180 min. Powers the Map iframe rotation dock + boss markers. Idempotent — seed only fires when the table is empty, cron job re-registers cleanly.' },
              { id: '049', title: 'Bot Isolation (#99)', desc: 'Phase 1 of the bot system. Creates public.bots (separate id namespace from users), public.bot_actions audit log, and adds threads.posted_by_bot + threads.author_bot_id with a CHECK constraint that user-threads and bot-threads can never be mixed. Anon SELECT policy on bots WHERE status=active. Endpoint guards (initiate-escrow, threads feed) ship in the same commit. Idempotent — re-runs just no-op via IF NOT EXISTS / pg_constraint check.' },
              { id: '050', title: 'Stripe Event Dedup (#123b)', desc: 'Real-money fix. Creates public.stripe_events_processed(event_id PK, event_type, livemode, payment_intent_id, session_id, processed_at) so the webhook handler can dedup at the door before running the FG mint chain. Closes the race where two concurrent deliveries of the same Stripe event raced past transactions.stripe_payment_id UNIQUE and minted duplicate fg_serial_ranges (observed for pi_3TQqhv1yvt9tJ9bP06tUeLpN). Idempotent.' },
              { id: '051', title: 'Rank Grant Backfill (#121)', desc: 'Wallet sub-tab was empty for users who reached their rank BEFORE the milestone-grant chokepoint shipped (#102). Adds users.rank_grants_backfilled_to int marker, then for every user with rank_level >= 5 sums up RANK_SKILL_REWARDS for each milestone above their backfill mark and upserts into user_skills (capped at 20). Idempotent — re-runs only top up users whose rank advanced since last run. Adam at rank 19 should land 15 priority_listing + 13 raffle_reward + 1 avatar_glow + 1 banner_message.' },
            ].map(m => {
              const result = migrationResults[m.id];
              const running = migrationRunning === m.id;
              const ok = result?.ok === true;
              const failed = result && result.ok === false;
              return (
                <div key={m.id} style={{ background: 'rgba(10,8,12,0.4)', border: '1px solid rgba(212,175,55,0.06)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                    <div>
                      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 12, color: ok ? '#4ade80' : failed ? '#ef4444' : '#D4AF37' }}>
                        {m.id} — {m.title}
                      </div>
                      <div style={{ fontSize: 9, color: '#6a6078', marginTop: 2 }}>{m.desc}</div>
                    </div>
                    <button
                      onClick={() => runMigration(m.id)}
                      disabled={running || !!migrationRunning}
                      style={{
                        background: running ? 'rgba(245,158,11,0.15)' : ok ? 'rgba(74,222,128,0.10)' : 'rgba(212,175,55,0.10)',
                        border: '1px solid ' + (running ? 'rgba(245,158,11,0.3)' : ok ? 'rgba(74,222,128,0.3)' : 'rgba(212,175,55,0.25)'),
                        borderRadius: 6,
                        padding: '6px 14px',
                        color: running ? '#fbbf24' : ok ? '#4ade80' : '#D4AF37',
                        fontSize: 10,
                        fontWeight: 900,
                        fontFamily: "'Barlow Condensed',sans-serif",
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        cursor: (running || migrationRunning) ? 'default' : 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {running ? 'Running…' : ok ? 'Re-run' : 'Apply'}
                    </button>
                  </div>
                  {result && (
                    <div style={{ marginTop: 6, padding: '6px 8px', background: ok ? 'rgba(74,222,128,0.06)' : 'rgba(239,68,68,0.06)', borderRadius: 4, fontSize: 9, fontFamily: 'monospace', color: ok ? '#86efac' : '#fca5a5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {ok
                        ? `OK · ${result.rowsAffected ?? 0} rows · last cmd: ${result.lastCommand || '—'} · ${result.ranAt ? new Date(result.ranAt).toLocaleTimeString() : ''}`
                        : `FAIL [${result.stage || 'unknown'}] ${result.code ? '(' + result.code + ') ' : ''}${result.error || 'unknown error'}`}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ fontSize: 8, color: '#6a6078', marginTop: 4 }}>
              Verified-flip rule: re-check IN VAULT &amp; CIRCULATING above after running 044 — they should reconcile to{' '}
              <code style={{ color: '#D4AF37' }}>SUM(users.fg_balance)</code>.
            </div>
          </div>

          {/* ── PRICE CHART ── */}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={labelStyle}>FG Value — USD</div>
              <div style={{ fontSize: 9, color: '#3a3048' }}>{priceHistory.length} data point{priceHistory.length !== 1 ? 's' : ''}</div>
            </div>
            {priceHistory.length > 1 ? (
              <div style={{ position: 'relative', height: 120, background: 'rgba(0,0,0,0.2)', borderRadius: 8, overflow: 'hidden', padding: '8px 4px' }}>
                <svg width="100%" height="100%" viewBox={`0 0 ${Math.max(priceHistory.length * 10, 300)} 100`} preserveAspectRatio="none" style={{ display: 'block' }}>
                  {(() => {
                    const vals = priceHistory.map(p => 1 / Number(p.fg_per_usd));
                    const mn = Math.min(...vals), mx = Math.max(...vals);
                    const range = mx - mn || 1;
                    const w = Math.max(priceHistory.length * 10, 300);
                    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${100 - ((v - mn) / range) * 80 - 10}`).join(' ');
                    const fill = `0,100 ${pts} ${w},100`;
                    return (
                      <>
                        <defs><linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D4AF37" stopOpacity="0.3" /><stop offset="100%" stopColor="#D4AF37" stopOpacity="0" /></linearGradient></defs>
                        <polygon points={fill} fill="url(#chartGrad)" />
                        <polyline points={pts} fill="none" stroke="#D4AF37" strokeWidth="2" />
                      </>
                    );
                  })()}
                </svg>
                <div style={{ position: 'absolute', bottom: 4, left: 8, fontSize: 8, color: '#D4AF37', fontWeight: 700 }}>
                  1 FG = ${(1 / Number(vault.fg_per_usd)).toFixed(6)} USD
                </div>
              </div>
            ) : (
              <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: '#3a3048' }}>Chart populates as exchange rates are updated over time</div>
              </div>
            )}
          </div>

          {/* ── RECENT LEDGER ── */}
          <div style={{ ...cardStyle }}>
            <div style={labelStyle}>Ledger — Recent Transactions</div>
            {ledger.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#3a3048', fontSize: 11 }}>No transactions yet — genesis mint recorded</div>
            ) : (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ledger.map(tx => (
                  <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: 6 }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{TX_ICONS[tx.tx_type] || '\u2022'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 8, color: TX_COLORS[tx.tx_type] || '#6a6078', background: `${TX_COLORS[tx.tx_type] || '#6a6078'}15`, padding: '1px 6px', borderRadius: 3, fontWeight: 700, textTransform: 'uppercase' }}>{tx.tx_type}</span>
                        <span style={{ fontSize: 10, color: '#e8e0f0', fontWeight: 700 }}>{formatBig(tx.amount)} FG</span>
                      </div>
                      <div style={{ fontSize: 8, color: '#6a6078', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.from_entity === 'genesis' ? 'Genesis' : tx.from_entity === 'vault' ? 'Vault' : tx.from_entity.slice(0, 8) + '...'} → {tx.to_entity === 'vault' ? 'Vault' : tx.to_entity === 'burn' ? 'Burned' : tx.to_entity.slice(0, 8) + '...'}
                      </div>
                      {tx.memo && <div style={{ fontSize: 8, color: '#3a3048', marginTop: 1, fontStyle: 'italic' }}>{tx.memo}</div>}
                    </div>
                    {tx.serial_start && (
                      <div style={{ fontSize: 7, color: '#a855f7', textAlign: 'right', flexShrink: 0 }}>
                        #{tx.serial_start.toLocaleString()}—#{tx.serial_end.toLocaleString()}
                      </div>
                    )}
                    <div style={{ fontSize: 7, color: '#3a3048', textAlign: 'right', flexShrink: 0, minWidth: 45 }}>
                      {new Date(tx.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {goldSubTab === 'gems' && (
        <div>
          {/* ── GEMS OVERVIEW CARD ── */}
          <div style={{ ...cardStyle, marginBottom: 16, background: 'linear-gradient(135deg, rgba(10,8,12,0.7), rgba(96,165,250,0.04))', border: '1px solid rgba(96,165,250,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 28 }}>{'\uD83D\uDC8E'}</div>
              <div>
                <div style={{ fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 16, color: '#60a5fa' }}>GEM SYSTEM</div>
                <div style={labelStyle}>Cross-trade currency for subscriptions & FG</div>
              </div>
            </div>

            {/* How it works */}
            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 12, marginBottom: 14 }}>
              <div style={{ ...labelStyle, color: '#60a5fa', marginBottom: 8 }}>How Gems Work</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, flexShrink: 0 }}>{'\uD83D\uDD04'}</span>
                  <span style={{ fontSize: 10, color: '#e8e0f0' }}>Users trade D2JSP/D3JSP currency in Exchange tab → earn Gems (dollar-for-dollar)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, flexShrink: 0 }}>{'\uD83C\uDFC5'}</span>
                  <span style={{ fontSize: 10, color: '#e8e0f0' }}>Users earn Gems by ranking up — free path to subscriptions</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, flexShrink: 0 }}>{'\uD83D\uDC8E'}</span>
                  <span style={{ fontSize: 10, color: '#e8e0f0' }}>Gems buy subscriptions ONLY (Verified → Legendary) at 50% FG bonus</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, flexShrink: 0 }}>{'\uD83D\uDCB3'}</span>
                  <span style={{ fontSize: 10, color: '#e8e0f0' }}>$1 credit card charge to claim — auto-renews at full price</span>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 2 }}>Sub Tiers</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#60a5fa' }}>{gemPrices.filter(p => p.category === 'subscription').length}</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 2 }}>Rank Rewards</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#a855f7' }}>{gemPrices.filter(p => p.category === 'rank_reward').length}</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 2 }}>Exchange Sources</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#4ade80' }}>{gemRates.length}</div>
              </div>
            </div>
          </div>

          {/* ── EXCHANGE RATES ── */}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ ...labelStyle, color: '#4ade80', marginBottom: 10 }}>Exchange Rates — Gems per $1 of Cross-Trade Currency</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {gemRates.map(rate => (
                <div key={rate.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: rate.active ? '#4ade80' : '#ef4444', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#e8e0f0' }}>{rate.source_currency}</div>
                    <div style={{ fontSize: 8, color: '#6a6078' }}>ID: {rate.id}</div>
                  </div>
                  {editingGemRate === rate.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <input type="number" defaultValue={rate.gems_per_dollar} id={'rate_' + rate.id}
                        style={{ background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 4, padding: '3px 8px', color: '#4ade80', fontSize: 14, fontWeight: 900, outline: 'none', width: 70, textAlign: 'center', fontFamily: "'Barlow Condensed',sans-serif" }} />
                      <span style={{ fontSize: 9, color: '#6a6078' }}>gems/$1</span>
                      <button onClick={async () => {
                        const val = parseFloat(document.getElementById('rate_' + rate.id).value);
                        if (val > 0) { await supabase.from('gem_exchange_rates').update({ gems_per_dollar: val, updated_at: new Date().toISOString() }).eq('id', rate.id); setEditingGemRate(null); loadVaultData(); }
                      }} style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 4, padding: '2px 8px', color: '#4ade80', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={() => setEditingGemRate(rate.id)}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#4ade80', fontFamily: "'Barlow Condensed',sans-serif" }}>{Number(rate.gems_per_dollar)}</div>
                      <span style={{ fontSize: 8, color: '#6a6078' }}>gems/$1</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── SUBSCRIPTION GEM PRICING ── */}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ ...labelStyle, color: '#a855f7', marginBottom: 10 }}>Subscription Gem Pricing</div>
            <div style={{ fontSize: 9, color: '#6a6078', marginBottom: 10 }}>Subscriptions purchased with Gems receive <span style={{ color: '#f59e0b', fontWeight: 700 }}>50%</span> of the normal FG monthly bonus.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {gemPrices.filter(p => p.category === 'subscription').map(price => (
                <div key={price.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                  <div style={{ fontSize: 16, flexShrink: 0 }}>{'\uD83D\uDC8E'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif" }}>{price.name}</div>
                    <div style={{ fontSize: 8, color: '#6a6078' }}>FG bonus: {price.fg_bonus_pct}% of normal</div>
                  </div>
                  {editingGemPrice === price.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="number" defaultValue={price.gem_cost} id={'gp_' + price.id}
                        style={{ background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 4, padding: '3px 8px', color: '#a855f7', fontSize: 14, fontWeight: 900, outline: 'none', width: 70, textAlign: 'center', fontFamily: "'Barlow Condensed',sans-serif" }} />
                      <button onClick={async () => {
                        const val = parseInt(document.getElementById('gp_' + price.id).value);
                        if (val > 0) { await supabase.from('gem_prices').update({ gem_cost: val }).eq('id', price.id); setEditingGemPrice(null); loadVaultData(); }
                      }} style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 4, padding: '2px 8px', color: '#a855f7', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                    </div>
                  ) : (
                    <div style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => setEditingGemPrice(price.id)}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#a855f7', fontFamily: "'Barlow Condensed',sans-serif" }}>{price.gem_cost.toLocaleString()}</div>
                      <div style={{ fontSize: 8, color: '#6a6078' }}>gems/mo</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── RANK GEM REWARDS ── */}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ ...labelStyle, color: '#a855f7', marginBottom: 10 }}>Rank Gem Rewards</div>
            <div style={{ fontSize: 9, color: '#6a6078', marginBottom: 10 }}>Users earn gems when they rank up — a free path to gem-bought subscriptions.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {gemPrices.filter(p => p.category === 'rank_reward').map(price => (
                <div key={price.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{'\uD83C\uDFC5'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif" }}>{price.name}</div>
                  </div>
                  {editingGemPrice === price.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="number" defaultValue={price.gem_cost} id={'gp_' + price.id}
                        style={{ background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 4, padding: '3px 8px', color: '#a855f7', fontSize: 14, fontWeight: 900, outline: 'none', width: 70, textAlign: 'center', fontFamily: "'Barlow Condensed',sans-serif" }} />
                      <button onClick={async () => {
                        const val = parseInt(document.getElementById('gp_' + price.id).value);
                        if (val > 0) { await supabase.from('gem_prices').update({ gem_cost: val }).eq('id', price.id); setEditingGemPrice(null); loadVaultData(); }
                      }} style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 4, padding: '2px 8px', color: '#a855f7', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                    </div>
                  ) : (
                    <div style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => setEditingGemPrice(price.id)}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#a855f7', fontFamily: "'Barlow Condensed',sans-serif" }}>{price.gem_cost}</div>
                      <div style={{ fontSize: 8, color: '#6a6078' }}>gems</div>
                    </div>
                  )}
                </div>
              ))}
              {gemPrices.filter(p => p.category === 'rank_reward').length === 0 && (
                <div style={{ padding: 12, textAlign: 'center', color: '#3a3048', fontSize: 10 }}>No rank rewards configured yet — add gem_prices rows with category 'rank_reward'</div>
              )}
            </div>
          </div>

          {/* ── $1 CLAIM NOTE ── */}
          <div style={{ ...cardStyle, marginBottom: 16, background: 'linear-gradient(135deg, rgba(10,8,12,0.5), rgba(239,68,68,0.03))', border: '1px solid rgba(239,68,68,0.12)' }}>
            <div style={{ ...labelStyle, color: '#ef4444', marginBottom: 6 }}>Subscription Claim Rules</div>
            <div style={{ fontSize: 10, color: '#e8e0f0', lineHeight: 1.5 }}>
              Gem-bought subs require a <span style={{ color: '#4ade80', fontWeight: 700 }}>$1.00 credit card charge</span> to activate.{' '}
              Auto-renews at <span style={{ color: '#ef4444', fontWeight: 700 }}>full price</span> next billing cycle if not cancelled.{' '}
              Gem subs get <span style={{ color: '#D4AF37', fontWeight: 700 }}>50%</span> of normal FG monthly bonus.
            </div>
          </div>

          {/* ── RECENT GEM TRANSACTIONS ── */}
          <div style={{ ...cardStyle }}>
            <div style={{ ...labelStyle, marginBottom: 10 }}>Recent Gem Transactions</div>
            {gemLedger.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#3a3048', fontSize: 11 }}>No gem transactions yet — system is ready for cross-trade exchanges</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {gemLedger.map(tx => (
                  <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: 6 }}>
                    <span style={{ fontSize: 12, flexShrink: 0 }}>{tx.direction === 'credit' ? '\uD83D\uDC8E' : '\u2796'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 8, color: tx.direction === 'credit' ? '#4ade80' : '#ef4444', background: tx.direction === 'credit' ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: 3, fontWeight: 700, textTransform: 'uppercase' }}>{tx.tx_type.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: 10, color: '#e8e0f0', fontWeight: 700, marginLeft: 6 }}>{tx.direction === 'credit' ? '+' : '-'}{tx.amount} gems</span>
                      {tx.memo && <div style={{ fontSize: 8, color: '#3a3048', marginTop: 1 }}>{tx.memo}</div>}
                    </div>
                    <div style={{ fontSize: 7, color: '#3a3048', flexShrink: 0 }}>{new Date(tx.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ EXCHANGE SUB-TAB ═══ */}
      {goldSubTab === 'exchange' && (
        <div>
          {/* ── STATUS & CONTROLS ── */}
          <div style={{ ...cardStyle, marginBottom: 16, background: exchSettings?.is_open ? 'linear-gradient(135deg, rgba(10,8,12,0.7), rgba(74,222,128,0.04))' : 'linear-gradient(135deg, rgba(10,8,12,0.7), rgba(239,68,68,0.04))', border: `1px solid ${exchSettings?.is_open ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>{'\uD83D\uDD04'}</span>
                <div>
                  <div style={{ fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 16, color: exchSettings?.is_open ? '#4ade80' : '#ef4444' }}>EXCHANGE</div>
                  <div style={labelStyle}>Cross-trade currency → Gems conversion</div>
                </div>
              </div>
              <button onClick={async () => {
                if (!exchSettings) return;
                await supabase.from('exchange_settings').update({ is_open: !exchSettings.is_open, updated_at: new Date().toISOString() }).eq('id', exchSettings.id);
                loadVaultData();
              }} style={{ background: exchSettings?.is_open ? 'rgba(239,68,68,0.12)' : 'rgba(74,222,128,0.12)', border: `1px solid ${exchSettings?.is_open ? 'rgba(239,68,68,0.3)' : 'rgba(74,222,128,0.3)'}`, borderRadius: 6, padding: '6px 14px', color: exchSettings?.is_open ? '#ef4444' : '#4ade80', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase' }}>
                {exchSettings?.is_open ? 'Pause Exchange' : 'Open Exchange'}
              </button>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 2 }}>Pending</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#f59e0b' }}>{exchRequests.filter(r => r.status === 'pending').length}</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 2 }}>Approved Today</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#4ade80' }}>{exchStats?.total_approved || 0}</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 2 }}>Gems Issued Today</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#60a5fa' }}>{exchStats?.total_gems_issued?.toLocaleString() || 0}</div>
              </div>
            </div>
          </div>

          {/* ── EXCHANGE SETTINGS ── */}
          {exchSettings && (
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={labelStyle}>Exchange Settings</div>
                <button onClick={() => {
                  if (editingExchSettings) {
                    // Save
                    supabase.from('exchange_settings').update({ ...exchSettingsForm, updated_at: new Date().toISOString() }).eq('id', exchSettings.id).then(() => { setEditingExchSettings(false); loadVaultData(); });
                  } else {
                    setExchSettingsForm({ min_per_tx: exchSettings.min_per_tx, max_per_tx: exchSettings.max_per_tx, daily_limit_per_user: exchSettings.daily_limit_per_user, monthly_limit_per_user: exchSettings.monthly_limit_per_user, fee_pct: exchSettings.fee_pct, notice_text: exchSettings.notice_text || '' });
                    setEditingExchSettings(true);
                  }
                }} style={{ background: editingExchSettings ? 'rgba(74,222,128,0.12)' : 'rgba(212,175,55,0.08)', border: editingExchSettings ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(212,175,55,0.2)', borderRadius: 4, padding: '3px 10px', color: editingExchSettings ? '#4ade80' : '#D4AF37', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>{editingExchSettings ? 'Save' : 'Edit'}</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {[
                  { key: 'min_per_tx', label: 'Min per TX', prefix: '$', color: '#60a5fa' },
                  { key: 'max_per_tx', label: 'Max per TX', prefix: '$', color: '#60a5fa' },
                  { key: 'daily_limit_per_user', label: 'Daily Limit/User', prefix: '$', color: '#facc15' },
                  { key: 'monthly_limit_per_user', label: 'Monthly Limit/User', prefix: '$', color: '#facc15' },
                  { key: 'fee_pct', label: 'Fee %', prefix: '', suffix: '%', color: '#ef4444' },
                ].map(f => (
                  <div key={f.key} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>{f.label}</div>
                    {editingExchSettings ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        {f.prefix && <span style={{ color: '#6a6078', fontSize: 11 }}>{f.prefix}</span>}
                        <input type="number" step="0.01" value={exchSettingsForm[f.key] ?? ''} onChange={e => setExchSettingsForm(p => ({ ...p, [f.key]: parseFloat(e.target.value) || 0 }))}
                          style={{ background: 'rgba(10,8,12,0.6)', border: `1px solid ${f.color}30`, borderRadius: 4, padding: '3px 6px', color: f.color, fontSize: 14, fontWeight: 900, outline: 'none', width: '100%', fontFamily: "'Barlow Condensed',sans-serif" }} />
                        {f.suffix && <span style={{ color: '#6a6078', fontSize: 11 }}>{f.suffix}</span>}
                      </div>
                    ) : (
                      <div style={{ fontSize: 16, fontWeight: 900, color: f.color, fontFamily: "'Barlow Condensed',sans-serif" }}>{f.prefix}{Number(exchSettings[f.key])}{f.suffix || ''}</div>
                    )}
                  </div>
                ))}
              </div>
              {editingExchSettings && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Notice Text (shown to users)</div>
                  <input value={exchSettingsForm.notice_text} onChange={e => setExchSettingsForm(p => ({ ...p, notice_text: e.target.value }))} placeholder="e.g. Exchange paused for maintenance..."
                    style={{ background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 4, padding: '6px 10px', color: '#e8e0f0', fontSize: 11, outline: 'none', width: '100%', fontFamily: "'Barlow Condensed',sans-serif" }} />
                </div>
              )}
            </div>
          )}

          {/* ── PENDING REQUESTS ── */}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ ...labelStyle, color: '#f59e0b', marginBottom: 10 }}>Pending Exchange Requests</div>
            {exchRequests.filter(r => r.status === 'pending').length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#3a3048', fontSize: 11 }}>No pending requests</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {exchRequests.filter(r => r.status === 'pending').map(req => (
                  <div key={req.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#e8e0f0' }}>#{req.id} — {req.source_currency}</div>
                        <div style={{ fontSize: 9, color: '#6a6078' }}>User: {req.user_id.slice(0, 8)}... | {new Date(req.created_at).toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 900, color: '#facc15' }}>${Number(req.source_amount).toFixed(2)}</div>
                        <div style={{ fontSize: 9, color: '#60a5fa' }}>{'\u2192'} {req.gems_to_award.toLocaleString()} gems</div>
                      </div>
                    </div>
                    {req.proof_url && <div style={{ fontSize: 8, color: '#60a5fa', marginBottom: 4 }}>Proof: {req.proof_url}</div>}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={async () => {
                        await supabase.from('exchange_requests').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', req.id);
                        loadVaultData();
                      }} style={{ flex: 1, background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 6, padding: '6px 0', color: '#4ade80', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase' }}>Approve</button>
                      <button onClick={async () => {
                        await supabase.from('exchange_requests').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', req.id);
                        loadVaultData();
                      }} style={{ flex: 1, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '6px 0', color: '#ef4444', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase' }}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── EXCHANGE HISTORY ── */}
          <div style={{ ...cardStyle }}>
            <div style={{ ...labelStyle, marginBottom: 10 }}>Exchange History</div>
            {exchRequests.filter(r => r.status !== 'pending').length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#3a3048', fontSize: 11 }}>No exchange history yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {exchRequests.filter(r => r.status !== 'pending').map(req => (
                  <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: req.status === 'approved' ? '#4ade80' : '#ef4444', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 8, color: req.status === 'approved' ? '#4ade80' : '#ef4444', background: req.status === 'approved' ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: 3, fontWeight: 700, textTransform: 'uppercase' }}>{req.status}</span>
                        <span style={{ fontSize: 10, color: '#e8e0f0', fontWeight: 700 }}>${Number(req.source_amount).toFixed(2)} {req.source_currency}</span>
                        <span style={{ fontSize: 9, color: '#60a5fa' }}>{'\u2192'} {req.gems_to_award.toLocaleString()} gems</span>
                      </div>
                      <div style={{ fontSize: 8, color: '#3a3048', marginTop: 1 }}>User: {req.user_id.slice(0, 8)}... {req.admin_note ? '| ' + req.admin_note : ''}</div>
                    </div>
                    <div style={{ fontSize: 7, color: '#3a3048', flexShrink: 0 }}>{new Date(req.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Features nav constants ─────────────────────────────────────────────────
const CATALOGUE_TABS = [
  { id: 'catalog',         label: 'Badges' },
  { id: 'permissions',     label: 'Permissions' },
  { id: 'rewards',         label: 'Skills' },
  { id: 'rewards_catalog', label: 'Rewards' },
  { id: 'triggers',        label: 'Triggers' },
  { id: 'configs',         label: 'Configs' },
  { id: 'badges_db',       label: 'Award Badges' },
];
const ENDPOINTS_TABS = [
  { id: 'store',    label: 'Store' },
  { id: 'ranks',    label: 'Ranks' },
  { id: 'gamble',   label: 'Gamble' },
  { id: 'specials', label: 'Specials' },
  { id: 'quests',   label: 'Quests' },
  { id: 'email',    label: 'Email' },
];
const ENDPOINTS_IDS = new Set(ENDPOINTS_TABS.map(t => t.id));

// ── GambleTab ─────────────────────────────────────────────────────────────────
// Drill-in: events list → selectedEventId → detail sections (Config/Entries/Quests/Triggers/Winner)
function GambleTab({ token }) {
  const [events,    setEvents]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [msg,       setMsg]       = useState('');
  const [listView,  setListView]  = useState('events'); // 'events' | 'results'

  // Drill-in state
  const [selectedId, setSelectedId] = useState(null);
  const [section,    setSection]    = useState('config');

  // Per-detail data
  const [entries,   setEntries]   = useState([]);
  const [pool,      setPool]      = useState(null);
  const [triggers,  setTriggers]  = useState([]);
  const [allQuests, setAllQuests] = useState([]);

  // Create event form
  const [creating,    setCreating]    = useState(false);
  const [createForm,  setCreateForm]  = useState({ name: '', description: '', icon: '🎲', event_type: 'one_shot', prize_pool: '', prize_type: 'fg', payment_methods: '[]', starts_at: '', ends_at: '', draw_at: '', draw_method: 'rng' });

  // Config edit form
  const [editingCfg,  setEditingCfg]  = useState(false);
  const [cfgForm,     setCfgForm]     = useState({});

  // Attach forms
  const [attachTrigger,   setAttachTrigger]   = useState('');
  const [attachTriggerQty, setAttachTriggerQty] = useState(1);
  const [attachQuest,     setAttachQuest]     = useState('');
  const [attachQuestRole, setAttachQuestRole] = useState('reward');
  const [attachQuestQty,  setAttachQuestQty]  = useState(1);

  // Admin grant form
  const [grantUserId,  setGrantUserId]  = useState('');
  const [grantQty,     setGrantQty]     = useState(1);
  const [grantNote,    setGrantNote]    = useState('');

  // Shared draw state
  const [drawing, setDrawing] = useState(false);

  const api = useCallback(async (method, body, query = '') => {
    const opts = { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } };
    if (method === 'POST') { opts.method = 'POST'; opts.body = JSON.stringify(body); }
    const r = await fetch('/api/admin/gamble' + query, opts);
    return r.json();
  }, [token]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const [evtRes, trRes, qRes] = await Promise.all([
        api('GET', null),
        api('GET', null, '?view=triggers'),
        api('GET', null, '?view=quests'),
      ]);
      if (evtRes.events) setEvents(evtRes.events);
      if (trRes.triggers) setTriggers(trRes.triggers);
      if (qRes.quests)    setAllQuests(qRes.quests);
    } catch (e) {
      setMsg('Load failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const loadEntries = useCallback(async (eid) => {
    const [eRes, pRes] = await Promise.all([
      api('GET', null, '?view=entries&event_id=' + eid),
      api('GET', null, '?view=pool&event_id=' + eid),
    ]);
    if (eRes.entries) setEntries(eRes.entries);
    if (pRes.stats)   setPool(pRes);
  }, [api]);

  const doPost = useCallback(async (body, successMsg) => {
    const j = await api('POST', body);
    if (j.ok || j.id) {
      setMsg(successMsg || 'Done');
      await loadEvents();
      return true;
    }
    setMsg('Error: ' + (j.error || 'Failed'));
    return false;
  }, [api, loadEvents]);

  const selectEvent = useCallback((id) => {
    setSelectedId(id);
    setSection('config');
    setEntries([]);
    setPool(null);
    setMsg('');
  }, []);

  // ── input / button style helpers (same as FeaturesTab) ──
  const inp = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', color: '#e0d8f0', fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", width: '100%', boxSizing: 'border-box' };
  const btn = (color = G) => ({ padding: '5px 14px', borderRadius: 6, border: `1px solid ${color}44`, background: `${color}18`, color, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, textTransform: 'uppercase', cursor: 'pointer', letterSpacing: '.08em' });
  const STATUS_COLOR = { draft: '#6a6078', active: '#4ade80', drawing: '#facc15', completed: '#60a5fa', cancelled: '#f87171' };

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  if (!selectedId) {
    const activeEvents    = events.filter(e => !['completed','cancelled'].includes(e.status));
    const completedEvents = events.filter(e => ['completed','cancelled'].includes(e.status));
    const showEvents      = listView === 'events' ? activeEvents : completedEvents;

    return (
      <div>
        {msg && <div style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 16, color: G, fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{msg}</div>}

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 0 }}>
            {[{ id: 'events', label: 'Events' }, { id: 'results', label: 'Results' }].map(v => (
              <button key={v.id} onClick={() => setListView(v.id)}
                style={{ padding: '6px 16px', background: 'none', border: 'none', borderBottom: listView === v.id ? '2px solid ' + G : '2px solid transparent', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 10, textTransform: 'uppercase', color: listView === v.id ? G : '#6a6078', cursor: 'pointer', letterSpacing: '.1em' }}>
                {v.label}
              </button>
            ))}
          </div>
          {!creating && (
            <button onClick={() => setCreating(true)} style={btn(G)}>+ New Event</button>
          )}
        </div>

        {/* Create form */}
        {creating && (
          <div style={{ background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 10, padding: '16px', marginBottom: 20 }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em', color: G, marginBottom: 12 }}>New Event</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              {[
                ['Name *', 'name', 'text', createForm.name],
                ['Icon', 'icon', 'text', createForm.icon],
                ['Description', 'description', 'text', createForm.description],
                ['Prize Pool (FG)', 'prize_pool', 'number', createForm.prize_pool],
                ['Starts At', 'starts_at', 'datetime-local', createForm.starts_at],
                ['Ends At', 'ends_at', 'datetime-local', createForm.ends_at],
                ['Draw At', 'draw_at', 'datetime-local', createForm.draw_at],
              ].map(([label, key, type, val]) => (
                <div key={key}>
                  <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3 }}>{label}</div>
                  <input type={type} value={val} onChange={e => setCreateForm(f => ({ ...f, [key]: e.target.value }))} style={inp} />
                </div>
              ))}
              <div>
                <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3 }}>Event Type</div>
                <select value={createForm.event_type} onChange={e => setCreateForm(f => ({ ...f, event_type: e.target.value }))} style={{ ...inp }}>
                  {['one_shot','weekly','monthly','yearly','repeating'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3 }}>Draw Method</div>
                <select value={createForm.draw_method} onChange={e => setCreateForm(f => ({ ...f, draw_method: e.target.value }))} style={{ ...inp }}>
                  {['rng','weighted','admin_pick'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3 }}>Payment Methods (JSON array — e.g. [&#123;"method":"fg","cost":100&#125;])</div>
              <textarea value={createForm.payment_methods} onChange={e => setCreateForm(f => ({ ...f, payment_methods: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btn(G)} onClick={async () => {
                let pm;
                try { pm = JSON.parse(createForm.payment_methods || '[]'); } catch { setMsg('payment_methods: invalid JSON'); return; }
                const ok = await doPost({ action: 'create_event', ...createForm, payment_methods: pm });
                if (ok) setCreating(false);
              }}>Create</button>
              <button style={btn('#6a6078')} onClick={() => setCreating(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Events table */}
        {loading ? <div style={{ padding: 40, textAlign: 'center' }}><div className="spin" style={{ margin: '0 auto' }} /></div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>
                  {['Name', 'Type', 'Status', 'Pool', 'Ends At', 'Winner'].map(h => <th key={h} style={hcell}>{h}</th>)}
                  <th style={hcell}></th>
                </tr>
              </thead>
              <tbody>
                {showEvents.map(evt => (
                  <tr key={evt.id} style={{ cursor: 'pointer' }} onClick={() => selectEvent(evt.id)}>
                    <td style={{ ...cell, fontWeight: 700, color: '#e0d8f0', maxWidth: 180 }}>{evt.icon} {evt.name}</td>
                    <td style={{ ...cell, color: '#a78bfa' }}>{evt.event_type}</td>
                    <td style={cell}><span style={{ color: STATUS_COLOR[evt.status] || 'var(--mt)', fontWeight: 700 }}>{evt.status}</span></td>
                    <td style={{ ...cell, color: '#facc15' }}>{(evt.prize_pool || 0).toLocaleString()} FG</td>
                    <td style={cell}>{evt.ends_at ? new Date(evt.ends_at).toLocaleDateString() : '—'}</td>
                    <td style={{ ...cell, maxWidth: 120 }}>{evt.winner_id ? <span style={{ color: '#4ade80', fontSize: 9 }}>✓ drawn</span> : '—'}</td>
                    <td style={cell}><button style={{ ...btn(G), padding: '3px 10px' }} onClick={e => { e.stopPropagation(); selectEvent(evt.id); }}>Open →</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {showEvents.length === 0 && <div style={{ color: 'var(--mt)', fontSize: 12, padding: 20 }}>No events.</div>}
          </div>
        )}
      </div>
    );
  }

  // ── DETAIL VIEW ───────────────────────────────────────────────────────────
  const evt = events.find(e => e.id === selectedId);
  const SECTIONS = ['config', 'entries', 'quests', 'triggers', 'winner'];

  return (
    <div>
      {msg && <div style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 12, color: G, fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{msg}</div>}

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button onClick={() => { setSelectedId(null); setMsg(''); }} style={{ ...btn('#6a6078'), padding: '4px 12px' }}>← Back</button>
        <span style={{ color: 'var(--mt)', fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif" }}>Events</span>
        <span style={{ color: 'var(--mt)', fontSize: 10 }}>/</span>
        <span style={{ color: G, fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{evt?.icon} {evt?.name}</span>
        {evt && <span style={{ marginLeft: 4, color: STATUS_COLOR[evt.status] || 'var(--mt)', fontSize: 9, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase' }}>{evt.status}</span>}
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(212,175,55,0.08)', marginBottom: 20, overflowX: 'auto', whiteSpace: 'nowrap', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        {SECTIONS.map(s => (
          <button key={s} onClick={() => { setSection(s); if (s === 'entries') loadEntries(selectedId); }}
            style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: section === s ? '2px solid ' + G : '2px solid transparent', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 10, textTransform: 'uppercase', color: section === s ? G : '#6a6078', cursor: 'pointer', letterSpacing: '.1em', flexShrink: 0 }}>
            {s}
          </button>
        ))}
      </div>

      {/* ── Config ── */}
      {section === 'config' && evt && (
        <div>
          {!editingCfg ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                  ['Name', evt.name], ['Type', evt.event_type], ['Status', evt.status],
                  ['Prize Pool', (evt.prize_pool || 0).toLocaleString() + ' FG'],
                  ['Draw Method', evt.draw_method], ['Linked Trigger', evt.trigger_id || '—'],
                  ['Starts', evt.starts_at ? new Date(evt.starts_at).toLocaleString() : '—'],
                  ['Ends', evt.ends_at ? new Date(evt.ends_at).toLocaleString() : '—'],
                  ['Draw At', evt.draw_at ? new Date(evt.draw_at).toLocaleString() : '—'],
                  ['Max Entries/User', evt.max_entries_per_user ?? 'Unlimited'],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4 }}>{k}</div>
                    <div style={{ fontSize: 12, color: '#e0d8f0', fontFamily: "'Barlow Condensed',sans-serif" }}>{String(v)}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4 }}>Payment Methods</div>
                <pre style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: 10, fontSize: 10, color: '#a78bfa', overflowX: 'auto', margin: 0 }}>{JSON.stringify(evt.payment_methods, null, 2)}</pre>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btn(G)} onClick={() => {
                  setCfgForm({ name: evt.name, description: evt.description || '', icon: evt.icon || '🎲', event_type: evt.event_type, prize_pool: String(evt.prize_pool || 0), prize_type: evt.prize_type, payment_methods: JSON.stringify(evt.payment_methods || [], null, 2), starts_at: evt.starts_at?.slice(0, 16) || '', ends_at: evt.ends_at?.slice(0, 16) || '', draw_at: evt.draw_at?.slice(0, 16) || '', draw_method: evt.draw_method, trigger_id: evt.trigger_id || '', max_entries_per_user: String(evt.max_entries_per_user ?? '') });
                  setEditingCfg(true);
                }}>Edit Config</button>
                {['draft','active','cancelled'].includes(evt.status) && (
                  <select defaultValue="" style={{ ...inp, width: 'auto', padding: '5px 10px' }}
                    onChange={async e => {
                      if (!e.target.value) return;
                      await doPost({ action: 'set_status', id: selectedId, status: e.target.value });
                      e.target.value = '';
                    }}>
                    <option value="" disabled>Set status…</option>
                    {['draft','active','drawing','completed','cancelled'].filter(s => s !== evt.status).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                {[['Name','name','text'],['Icon','icon','text'],['Description','description','text'],['Prize Pool (FG)','prize_pool','number'],['Linked Trigger ID','trigger_id','text'],['Max Entries/User','max_entries_per_user','number'],['Starts At','starts_at','datetime-local'],['Ends At','ends_at','datetime-local'],['Draw At','draw_at','datetime-local']].map(([label, key, type]) => (
                  <div key={key}>
                    <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3 }}>{label}</div>
                    <input type={type} value={cfgForm[key] || ''} onChange={e => setCfgForm(f => ({ ...f, [key]: e.target.value }))} style={inp} />
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3 }}>Event Type</div>
                  <select value={cfgForm.event_type || 'one_shot'} onChange={e => setCfgForm(f => ({ ...f, event_type: e.target.value }))} style={inp}>
                    {['one_shot','weekly','monthly','yearly','repeating'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3 }}>Draw Method</div>
                  <select value={cfgForm.draw_method || 'rng'} onChange={e => setCfgForm(f => ({ ...f, draw_method: e.target.value }))} style={inp}>
                    {['rng','weighted','admin_pick'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3 }}>Payment Methods (JSON)</div>
                <textarea value={cfgForm.payment_methods || '[]'} onChange={e => setCfgForm(f => ({ ...f, payment_methods: e.target.value }))} rows={4} style={{ ...inp, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btn(G)} onClick={async () => {
                  let pm;
                  try { pm = JSON.parse(cfgForm.payment_methods || '[]'); } catch { setMsg('payment_methods: invalid JSON'); return; }
                  const patch = { ...cfgForm, payment_methods: pm, prize_pool: parseInt(cfgForm.prize_pool, 10) || 0, max_entries_per_user: cfgForm.max_entries_per_user ? parseInt(cfgForm.max_entries_per_user, 10) : null };
                  const ok = await doPost({ action: 'update_event', id: selectedId, ...patch });
                  if (ok) setEditingCfg(false);
                }}>Save</button>
                <button style={btn('#6a6078')} onClick={() => setEditingCfg(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Entries ── */}
      {section === 'entries' && (
        <div>
          {pool && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              {[['Total Tickets', pool.stats?.totalTickets ?? '—'], ['Unique Users', pool.stats?.uniqueUsers ?? '—'], ['Prize Pool', ((pool.event?.prize_pool || 0)).toLocaleString() + ' FG']].map(([k, v]) => (
                <div key={k} style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.12)', borderRadius: 8, padding: '10px 16px', textAlign: 'center', minWidth: 100 }}>
                  <div className="cinzel" style={{ fontSize: 18, color: G }}>{v}</div>
                  <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginTop: 4 }}>{k}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
              <thead><tr>{['User', 'Method', 'Qty', 'FG Paid', 'Date'].map(h => <th key={h} style={hcell}>{h}</th>)}</tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td style={{ ...cell, maxWidth: 160 }}>{e.users?.username || e.user_id?.slice(0, 8) + '…'}</td>
                    <td style={{ ...cell, color: '#a78bfa' }}>{e.entry_method}</td>
                    <td style={{ ...cell, color: '#facc15' }}>{e.quantity}</td>
                    <td style={{ ...cell, color: '#4ade80' }}>{e.fg_paid ? e.fg_paid.toLocaleString() : '—'}</td>
                    <td style={cell}>{new Date(e.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entries.length === 0 && <div style={{ color: 'var(--mt)', fontSize: 12, padding: 20 }}>No entries yet.</div>}
          </div>
        </div>
      )}

      {/* ── Quests ── */}
      {section === 'quests' && evt && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--mt)', marginBottom: 10 }}>Attached Quests</div>
            {(evt.event_quests || []).length === 0 && <div style={{ color: 'var(--mt)', fontSize: 11, marginBottom: 12 }}>None attached.</div>}
            {(evt.event_quests || []).map(eq => (
              <div key={eq.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, marginBottom: 6 }}>
                <span style={{ flex: 1, fontSize: 11, color: '#e0d8f0' }}>{eq.quests?.name || eq.quests?.title || eq.quest_id}</span>
                <span style={{ fontSize: 9, color: '#a78bfa', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{eq.role} · ×{eq.entries_granted}</span>
                <button style={{ ...btn('#f87171'), padding: '3px 8px' }} onClick={() => doPost({ action: 'detach_quest', event_id: selectedId, quest_id: eq.quest_id }, 'Quest detached')}>×</button>
              </div>
            ))}
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 14 }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--mt)', marginBottom: 10 }}>Attach Quest</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 2 }}>
                <select value={attachQuest} onChange={e => setAttachQuest(e.target.value)} style={inp}>
                  <option value="">Select quest…</option>
                  {allQuests.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                </select>
              </div>
              <div>
                <select value={attachQuestRole} onChange={e => setAttachQuestRole(e.target.value)} style={{ ...inp, width: 'auto' }}>
                  <option value="reward">reward</option>
                  <option value="gate">gate</option>
                </select>
              </div>
              <div style={{ width: 70 }}>
                <input type="number" min={1} value={attachQuestQty} onChange={e => setAttachQuestQty(Number(e.target.value))} style={inp} placeholder="qty" />
              </div>
              <button style={btn(G)} onClick={() => {
                if (!attachQuest) return;
                doPost({ action: 'attach_quest', event_id: selectedId, quest_id: attachQuest, role: attachQuestRole, entries_granted: attachQuestQty }, 'Quest attached');
              }}>Attach</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Triggers ── */}
      {section === 'triggers' && evt && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--mt)', marginBottom: 10 }}>Attached Triggers</div>
            {(evt.event_triggers || []).length === 0 && <div style={{ color: 'var(--mt)', fontSize: 11, marginBottom: 12 }}>None attached.</div>}
            {(evt.event_triggers || []).map(et => (
              <div key={et.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, marginBottom: 6 }}>
                <span style={{ flex: 1, fontSize: 11, color: '#e0d8f0', fontFamily: 'monospace' }}>{et.trigger_id}</span>
                <span style={{ fontSize: 9, color: '#4ade80', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>×{et.entries_granted} entries</span>
                <button style={{ ...btn('#f87171'), padding: '3px 8px' }} onClick={() => doPost({ action: 'detach_trigger', event_id: selectedId, trigger_id: et.trigger_id }, 'Trigger detached')}>×</button>
              </div>
            ))}
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 14 }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--mt)', marginBottom: 10 }}>Attach Trigger</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 2 }}>
                <select value={attachTrigger} onChange={e => setAttachTrigger(e.target.value)} style={inp}>
                  <option value="">Select trigger…</option>
                  {triggers.map(t => <option key={t.id} value={t.id}>{t.id} — {t.name}</option>)}
                </select>
              </div>
              <div style={{ width: 70 }}>
                <input type="number" min={1} value={attachTriggerQty} onChange={e => setAttachTriggerQty(Number(e.target.value))} style={inp} placeholder="qty" />
              </div>
              <button style={btn(G)} onClick={() => {
                if (!attachTrigger) return;
                doPost({ action: 'attach_trigger', event_id: selectedId, trigger_id: attachTrigger, entries_granted: attachTriggerQty }, 'Trigger attached');
              }}>Attach</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Winner ── */}
      {section === 'winner' && evt && (
        <div>
          {evt.winner_id ? (
            <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: '#4ade80', marginBottom: 8 }}>Winner Drawn</div>
              <div style={{ fontSize: 13, color: '#e0d8f0', marginBottom: 4 }}>User ID: <span style={{ fontFamily: 'monospace', color: '#4ade80' }}>{evt.winner_id}</span></div>
              <div style={{ fontSize: 11, color: 'var(--mt)' }}>Prize: {(evt.prize_pool || 0).toLocaleString()} FG · Drawn: {evt.drawn_at ? new Date(evt.drawn_at).toLocaleString() : '—'}</div>
            </div>
          ) : (
            <div style={{ marginBottom: 20 }}>
              {['active', 'drawing'].includes(evt.status) ? (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--mt)', marginBottom: 16, fontFamily: "'Barlow Condensed',sans-serif" }}>
                    Draw a winner from all current entries. This action is irreversible.
                  </div>
                  <button style={{ ...btn('#f59e0b'), padding: '10px 24px', fontSize: 12 }}
                    disabled={drawing}
                    onClick={async () => {
                      setDrawing(true);
                      const ok = await doPost({ action: 'draw_winner', id: selectedId }, 'Winner drawn! FG credited.');
                      setDrawing(false);
                    }}>
                    {drawing ? 'Drawing…' : '🎲 Draw Winner'}
                  </button>
                </div>
              ) : (
                <div style={{ color: 'var(--mt)', fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif" }}>
                  Event must be <strong style={{ color: '#4ade80' }}>active</strong> or <strong style={{ color: '#facc15' }}>drawing</strong> to draw a winner. Current: <strong>{evt.status}</strong>.
                </div>
              )}
            </div>
          )}

          {/* Admin Grant */}
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 14 }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--mt)', marginBottom: 10 }}>Admin Grant — Add Entry Slots</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 2 }}>
                <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3 }}>User ID (UUID)</div>
                <input value={grantUserId} onChange={e => setGrantUserId(e.target.value)} placeholder="user uuid" style={inp} />
              </div>
              <div style={{ width: 70 }}>
                <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3 }}>Qty</div>
                <input type="number" min={1} value={grantQty} onChange={e => setGrantQty(Number(e.target.value))} style={inp} />
              </div>
              <div style={{ flex: 2 }}>
                <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3 }}>Note (optional)</div>
                <input value={grantNote} onChange={e => setGrantNote(e.target.value)} placeholder="reason" style={inp} />
              </div>
              <button style={btn(G)} onClick={() => {
                if (!UUID_RE.test(grantUserId)) { setMsg('Invalid UUID'); return; }
                doPost({ action: 'admin_grant', event_id: selectedId, user_id: grantUserId, quantity: grantQty, note: grantNote }, 'Entries granted');
              }}>Grant</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FeaturesTab({ token, rankRewards = {}, setRankRewards }) {
  const [subTab, setSubTab] = useState('catalog');
  const [skills, setSkills] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [editingSkillId, setEditingSkillId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // DB-backed config fields (fallback to hardcoded MASTER_CONFIG_FIELDS until loaded)
  const [configFields, setConfigFields] = useState(MASTER_CONFIG_FIELDS);

  // Create form — name + type + description only
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Assign form
  const [assignUserId, setAssignUserId] = useState('');
  const [assignSkillId, setAssignSkillId] = useState('');
  const [assignSource, setAssignSource] = useState('manual');
  const [assignDuration, setAssignDuration] = useState('');
  const [assignDurationUnit, setAssignDurationUnit] = useState('hours');

  // Live assignment matrix for catalog grid
  const { tiers: matrixTiers, packages: matrixPackages, reload: reloadMatrix } = useAssignmentMatrix();

  const api = useCallback(async (method, body, query = '') => {
    const opts = { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } };
    if (method === 'POST') { opts.method = 'POST'; opts.body = JSON.stringify(body); }
    const r = await fetch('/api/admin/skills' + query, opts);
    return r.json();
  }, [token]);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogRes, assignedRes] = await Promise.all([
        api('GET', null),
        api('GET', null, '?view=assigned'),
      ]);
      if (catalogRes.skills) setSkills(catalogRes.skills);
      if (assignedRes.assigned) setAssigned(assignedRes.assigned);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [api]);

  useEffect(() => { if (token) loadSkills(); }, [token, loadSkills]);

  const loadConfigFields = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch('/api/admin/config-fields', { headers: { Authorization: 'Bearer ' + token } });
      const j = await r.json();
      if (j.fields && j.fields.length > 0) {
        setConfigFields(j.fields.map(f => ({
          _id: f.id,
          key: f.key,
          label: f.label,
          type: f.type,
          default: f.default_val ?? null,
          nullable: !!f.nullable,
          ...(f.nullable_label ? { nullable_label: f.nullable_label } : {}),
          sort_order: f.sort_order || 0,
        })));
      }
    } catch {}
  }, [token]);

  useEffect(() => { loadConfigFields(); }, [loadConfigFields]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const durationToMinutes = (val, unit) => {
    const n = parseInt(val);
    if (!n || n <= 0) return null;
    if (unit === 'minutes') return n;
    if (unit === 'hours') return n * 60;
    if (unit === 'days') return n * 1440;
    if (unit === 'weeks') return n * 10080;
    return n;
  };

  const formatDuration = (minutes) => {
    if (!minutes) return 'Permanent';
    if (minutes < 60) return minutes + 'm';
    if (minutes < 1440) return (minutes / 60) + 'h';
    if (minutes < 10080) return (minutes / 1440) + 'd';
    return (minutes / 10080) + 'w';
  };

  const createSkill = async () => {
    if (!newName.trim()) return flash('Name required');
    const res = await api('POST', { action: 'create_skill', name: newName.trim(), type: newType, description: newDesc, source: 'manual', config: {} });
    if (res.error) return flash('Error: ' + res.error);
    flash('Skill created');
    setNewName(''); setNewDesc('');
    setSubTab('catalog');
    loadSkills();
    reloadMatrix();
  };

  const deleteSkill = async (id, name) => {
    if (!confirm('Delete skill "' + name + '"? This will also remove all assignments.')) return;
    await api('POST', { action: 'delete_skill', id });
    flash('Deleted');
    loadSkills();
  };

  const assignSkill = async () => {
    if (!assignUserId.trim() || !assignSkillId) return flash('Select a user ID and skill');
    // Compute expires_at: use manual duration if set, else skill's default
    let durMin = durationToMinutes(assignDuration, assignDurationUnit);
    if (!durMin) {
      const skill = skills.find(s => s.id === assignSkillId);
      durMin = skill?.config?.default_duration_minutes || null;
    }
    const expires_at = durMin ? new Date(Date.now() + durMin * 60000).toISOString() : null;
    const res = await api('POST', { action: 'assign_skill', user_id: assignUserId.trim(), skill_id: assignSkillId, source: assignSource, expires_at });
    if (res.error) return flash('Error: ' + res.error);
    flash(expires_at ? `Assigned (expires in ${formatDuration(durMin)})` : 'Assigned (permanent)');
    setAssignUserId(''); setAssignDuration('');
    loadSkills();
  };

  const revokeSkill = async (userId, skillId) => {
    await api('POST', { action: 'revoke_skill', user_id: userId, skill_id: skillId });
    flash('Revoked');
    loadSkills();
  };

  const toggleActive = async (skill) => {
    await api('POST', { action: 'update_skill', id: skill.id, active: !skill.active });
    loadSkills();
  };

  const startEdit = (s) => {
    if (editingSkillId === s.id) { setEditingSkillId(null); return; }
    setEditingSkillId(s.id);
    setEditForm({
      name: s.name,
      description: s.description || '',
      type: s.type,
      active: s.active,
      // Display config (migration 023)
      icon: s.icon || '',
      display_order: s.display_order ?? 0,
      show_on_profile: s.show_on_profile !== false,
      show_on_store: s.show_on_store || false,
      show_on_ranks: s.show_on_ranks || false,
      endpoint_label: s.endpoint_label || '',
      requirements_text: s.requirements_text || '',
      tier_color: s.tier_color || '',
      completion_celebration: s.completion_celebration || '',
      // Config fields picker — which configFields are active for this skill
      dials_raw: s.dials || {},
      dials_fields: (s.dials?.fields || []).map(f => f.key).filter(k => configFields.some(m => m.key === k)),
    });
  };

  const saveEdit = async (id) => {
    const checkedFields = (editForm.dials_fields || [])
      .map(k => configFields.find(m => m.key === k))
      .filter(Boolean);
    const res = await api('POST', {
      action: 'update_skill', id,
      name: editForm.name,
      description: editForm.description,
      type: editForm.type,
      active: editForm.active,
      // Display config fields
      icon: editForm.icon || null,
      display_order: Number(editForm.display_order) || 0,
      show_on_profile: !!editForm.show_on_profile,
      show_on_store: !!editForm.show_on_store,
      show_on_ranks: !!editForm.show_on_ranks,
      endpoint_label: editForm.endpoint_label || null,
      requirements_text: editForm.requirements_text || null,
      tier_color: editForm.tier_color || null,
      completion_celebration: editForm.completion_celebration || null,
      // Merge updated fields list into dials (preserve any other dials keys)
      dials: { ...(editForm.dials_raw || {}), fields: checkedFields },
    });
    if (res.error) return flash('Error: ' + res.error);
    flash('Skill updated');
    setEditingSkillId(null);
    loadSkills();
  };

  const inputStyle = { background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 6, padding: '6px 10px', color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, outline: 'none', width: '100%' };
  const selectStyle = { ...inputStyle, appearance: 'none', cursor: 'pointer' };
  const btnStyle = { padding: '6px 16px', borderRadius: 6, border: '1px solid rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.1)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 11, textTransform: 'uppercase', cursor: 'pointer', color: G, letterSpacing: '.08em' };

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><div className="spin" style={{ margin: '0 auto' }} /></div>;

  return (
    <div>
      {msg && <div style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 16, color: G, fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{msg}</div>}

      {/* Sub-tabs — group selector + item tabs */}
      <div style={{ marginBottom: 20 }}>
        {/* Row 1: Catalogue / Endpoints group */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(212,175,55,0.04)' }}>
          {[{ id: 'catalogue', label: 'Catalogue', first: 'catalog' }, { id: 'endpoints', label: 'Endpoints', first: 'store' }].map(g => {
            const isActive = (g.id === 'endpoints') === ENDPOINTS_IDS.has(subTab);
            return (
              <button key={g.id} onClick={() => setSubTab(g.first)}
                style={{ padding: '6px 18px', background: isActive ? 'rgba(212,175,55,0.06)' : 'none', border: 'none', borderBottom: isActive ? '2px solid ' + G : '2px solid transparent', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: isActive ? G : '#6a6078', cursor: 'pointer' }}>
                {g.label}
              </button>
            );
          })}
        </div>
        {/* Row 2: item tabs for active group */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(212,175,55,0.08)', overflowX: 'auto', whiteSpace: 'nowrap', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
          {(ENDPOINTS_IDS.has(subTab) ? ENDPOINTS_TABS : CATALOGUE_TABS).map(t => (
            <button key={t.id} onClick={() => setSubTab(t.id)}
              style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: subTab === t.id ? '2px solid ' + G : '2px solid transparent', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 10, textTransform: 'uppercase', color: subTab === t.id ? G : '#6a6078', cursor: 'pointer', letterSpacing: '.1em', flexShrink: 0 }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Badges catalog (badge-type skills only) ── */}
      {subTab === 'catalog' && (() => {
        const badgeCatalog = skills.filter(s => s.type === 'badge');
        // Build tier column order: use standard 5 IDs, fall back to whatever's in DB
        const STD_TIERS = ['free', 'verified', 'basic', 'premium', 'legendary'];
        const tierCols = STD_TIERS.map(tid => matrixTiers.find(t => t.id === tid)).filter(Boolean);
        const tierColors = { free: '#9ca3af', verified: '#22c55e', basic: '#6b7280', premium: '#D4AF37', legendary: '#a855f7' };

        // Build a map: skillId → { tierId: configSummary, subs: [tierName,...], pkgIds: [...], rankNums: [...] }
        const skillMatrix = {};
        badgeCatalog.forEach(s => { skillMatrix[s.id] = { tiers: {}, subs: [], pkgs: [], ranks: [] }; });
        tierCols.forEach(t => {
          const tierSkills = (t.skills || []).map(normaliseSkillEntry);
          tierSkills.forEach(({ id, config }) => {
            if (skillMatrix[id]) skillMatrix[id].tiers[t.id] = skillConfigSummary(skills.find(s => s.id === id)?.type, config);
          });
        });
        matrixTiers.forEach(t => {
          (t.skills || []).map(normaliseSkillEntry).forEach(({ id }) => {
            if (skillMatrix[id]) skillMatrix[id].subs.push(t.name || t.id);
          });
        });
        matrixPackages.forEach(p => {
          (p.skills || []).map(normaliseSkillEntry).forEach(({ id }) => {
            if (skillMatrix[id]) skillMatrix[id].pkgs.push(p.name);
          });
        });
        Object.entries(rankRewards).forEach(([rank, entries]) => {
          (Array.isArray(entries) ? entries : []).map(normaliseSkillEntry).forEach(({ id }) => {
            if (skillMatrix[id]) skillMatrix[id].ranks.push(Number(rank));
          });
        });

        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.15em' }}>{badgeCatalog.length} badges — tap row to edit</div>
              <button onClick={() => setSubTab('create')} style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.08)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, textTransform: 'uppercase', cursor: 'pointer', color: G, letterSpacing: '.08em' }}>+ New Badge</button>
            </div>

            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 540 }}>
                <thead>
                  <tr>
                    <th style={{ ...hcell, width: 160, position: 'sticky', left: 0, background: '#0a0810', zIndex: 2 }}>Skill</th>
                    {tierCols.map(t => (
                      <th key={t.id} style={{ ...hcell, textAlign: 'center', color: tierColors[t.id] || '#9ca3af' }}>{t.name || t.id}</th>
                    ))}
                    <th style={{ ...hcell, textAlign: 'center', color: '#a855f7' }}>Sub</th>
                    <th style={{ ...hcell, textAlign: 'center', color: '#a78bfa' }}>Ranks</th>
                    <th style={{ ...hcell, width: 48 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {badgeCatalog.map(s => {
                    const isEditing = editingSkillId === s.id;
                    // DB-backed items: green if active, gray if disabled
                    const wireColor = s.active ? WIRED_COLORS.green : '#6b7280';
                    const typeColor = TYPE_COLORS[s.type] || '#6b7280';
                    const mx = skillMatrix[s.id] || { tiers: {}, subs: [], pkgs: [], ranks: [] };
                    const isGlow = s.type === 'post_glow';
                    return [
                      <tr key={s.id} onClick={() => startEdit(s)} style={{ cursor: 'pointer', background: isGlow ? 'rgba(245,158,11,0.04)' : 'transparent' }}>
                        <td style={{ ...cell, position: 'sticky', left: 0, background: isGlow ? '#0b0907' : '#080608', zIndex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: wireColor, flexShrink: 0, boxShadow: `0 0 5px ${wireColor}60` }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, color: isGlow ? '#f59e0b' : '#e8e0f0', fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", whiteSpace: 'nowrap' }}>
                                {s.name}{isGlow && ' ⚡'}
                              </div>
                              <span style={{ background: typeColor + '18', color: typeColor, padding: '1px 6px', borderRadius: 3, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>{s.type.replace(/_/g, ' ')}</span>
                            </div>
                          </div>
                        </td>
                        {tierCols.map(t => {
                          const val = mx.tiers[t.id];
                          const tc = tierColors[t.id] || '#9ca3af';
                          return (
                            <td key={t.id} style={{ ...cell, textAlign: 'center' }}>
                              {val ? <span style={{ color: tc, fontWeight: 900, fontSize: 10 }}>{val}</span> : <span style={{ color: '#2a2438' }}>—</span>}
                            </td>
                          );
                        })}
                        <td style={{ ...cell, textAlign: 'center' }}>
                          {mx.subs.length > 0
                            ? <span style={{ color: '#a855f7', fontWeight: 700, fontSize: 9 }} title={mx.subs.join(', ')}>{mx.subs.length > 2 ? mx.subs.slice(0, 2).join(', ') + '…' : mx.subs.join(', ')}</span>
                            : <span style={{ color: '#2a2438' }}>—</span>}
                        </td>
                        <td style={{ ...cell, textAlign: 'center' }}>
                          {mx.ranks.length > 0
                            ? <span style={{ color: '#a78bfa', fontWeight: 900, fontSize: 10 }}>{mx.ranks.sort((a, b) => a - b).slice(0, 4).join(', ')}{mx.ranks.length > 4 ? '…' : ''}</span>
                            : <span style={{ color: '#2a2438' }}>—</span>}
                        </td>
                        <td style={{ ...cell, textAlign: 'right' }}>
                          <span style={{ fontSize: 9, color: '#4a4058' }}>{isEditing ? '▲' : '▼'}</span>
                        </td>
                      </tr>,
                      isEditing && (
                        <tr key={s.id + '_edit'}>
                          <td colSpan={tierCols.length + 4} style={{ padding: '0 14px 14px', background: isGlow ? 'rgba(245,158,11,0.04)' : 'rgba(212,175,55,0.02)', borderBottom: '1px solid rgba(212,175,55,0.12)' }}>
                            {isGlow && (
                              <div style={{ padding: '8px 0 6px', fontSize: 9, color: '#f59e0b', fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase', letterSpacing: '.1em' }}>
                                ⚡ Post Glow — config: duration {formatDuration(s.config?.default_duration_minutes)} · uses {s.config?.default_uses ?? 'unlimited'}
                              </div>
                            )}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 0 8px', fontSize: 9, color: '#9a8eb0' }}>
                              <span>Assigned to <b style={{ color: G }}>{s.assigned_count}</b> users</span>
                              <span>Active: <b style={{ color: s.active ? '#22c55e' : '#f87171' }}>{s.active ? 'Yes' : 'No'}</b></span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10, maxWidth: 460 }}>
                              <div>
                                <label style={{ fontSize: 9, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3, display: 'block' }}>Name</label>
                                <input value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
                              </div>
                              <div>
                                <label style={{ fontSize: 9, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3, display: 'block' }}>Description</label>
                                <input value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} style={inputStyle} />
                              </div>
                              <SkillDisplayConfigFields editForm={editForm} setEditForm={setEditForm} inputStyle={inputStyle} configFields={configFields} />
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => saveEdit(s.id)} style={{ ...btnStyle }}>Save</button>
                              <button onClick={(e) => { e.stopPropagation(); toggleActive(s); }} style={{ ...btnStyle, color: s.active ? '#f87171' : '#22c55e', borderColor: s.active ? 'rgba(220,38,38,0.3)' : 'rgba(34,197,94,0.3)', background: s.active ? 'rgba(220,38,38,0.08)' : 'rgba(34,197,94,0.08)' }}>
                                {s.active ? 'Disable' : 'Enable'}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); deleteSkill(s.id, s.name); }} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.4)', background: 'rgba(220,38,38,0.12)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 11, textTransform: 'uppercase', cursor: 'pointer', color: '#f87171' }}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
            {badgeCatalog.length === 0 && <div style={{ color: '#6a6078', fontSize: 12, padding: 20, textAlign: 'center' }}>No badges yet. Click "+ New Badge" to add one.</div>}
          </div>
        );
      })()}

      {/* ── Configs — DB-backed master config field types ── */}
      {subTab === 'configs' && (
        <ConfigsTab token={token} configFields={configFields} onReload={loadConfigFields} />
      )}

      {/* ── Create New (name + type + description only) ── */}
      {subTab === 'create' && (
        <div style={{ maxWidth: 420 }}>
          <div style={{ fontSize: 9, color: '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.15em', marginBottom: 14 }}>
            Define the skill name and type here. Duration, uses, and per-assignment values are set when you attach this skill in Store → Subscriptions, Store → FG Bundles, or Ranks.
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: G, marginBottom: 4 }}>Skill Name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Golden Avatar Glow" style={inputStyle} />
            </div>
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: G, marginBottom: 4 }}>Type</label>
              <input
                value={newType}
                onChange={e => setNewType(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                placeholder="e.g. avatar_glow, badge, xp_boost…"
                list="skill-type-suggestions"
                style={inputStyle}
              />
              <datalist id="skill-type-suggestions">
                {Array.from(new Set([...SKILL_TYPES, ...skills.map(s => s.type)])).sort().map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </datalist>
              <div style={{ fontSize: 9, color: '#4a4058', marginTop: 3 }}>Free-text — type a new type or pick an existing one from the list</div>
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: G, marginBottom: 4 }}>Description (optional)</label>
              <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What does this skill do?" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createSkill} style={btnStyle}>Create Skill</button>
              <button onClick={() => setSubTab('catalog')} style={{ ...btnStyle, color: '#6a6078', borderColor: 'rgba(255,255,255,0.08)', background: 'transparent' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign to User ── */}
      {/* ── Perks ── */}
      {/* ── Permissions ── */}
      {subTab === 'permissions' && (
        <PermissionsPanel />
      )}

      {/* ── Skills catalog (category='skill') ── */}
      {subTab === 'rewards' && (() => {
        // Filter by category if present, fall back to type-based exclusion for older rows
        const funcCatalog = skills.filter(s => s.category ? s.category === 'skill' : (s.type !== 'badge' && !REWARD_TYPE_IDS.has(s.type)));
        const skillTierMap = {};
        matrixTiers.forEach(t => { (t.skills || []).map(normaliseSkillEntry).forEach(({ id }) => { (skillTierMap[id] = skillTierMap[id] || []).push(t.name || t.id); }); });
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.15em' }}>
                {funcCatalog.length} skills — tap to edit · attach in Store → Subscriptions / FG Bundles
              </div>
              <button onClick={() => setSubTab('create')} style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.08)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, textTransform: 'uppercase', cursor: 'pointer', color: G, letterSpacing: '.08em' }}>+ Create Skill</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {funcCatalog.map(s => {
                const isEditing = editingSkillId === s.id;
                // DB-backed items: green if active, gray if disabled
                const wireColor = s.active ? WIRED_COLORS.green : '#6b7280';
                const typeColor = TYPE_COLORS[s.type] || '#6b7280';
                const subNames = skillTierMap[s.id] || [];
                return [
                  <div key={s.id} onClick={() => startEdit(s)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderRadius: 8, background: isEditing ? 'rgba(168,85,247,0.06)' : 'rgba(255,255,255,0.01)', border: isEditing ? '1px solid rgba(168,85,247,0.2)' : '1px solid transparent' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: wireColor, flexShrink: 0, boxShadow: `0 0 5px ${wireColor}60` }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#e8e0f0', fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif" }}>{s.name}</div>
                      {s.description && <div style={{ fontSize: 9, color: '#6a6078', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.description}</div>}
                    </div>
                    {subNames.length > 0 && <span style={{ color: '#a855f7', fontWeight: 700, fontSize: 9, flexShrink: 0, whiteSpace: 'nowrap' }} title={subNames.join(', ')}>{subNames.length > 2 ? subNames.slice(0, 2).join(', ') + '…' : subNames.join(', ')}</span>}
                    <span style={{ background: typeColor + '18', color: typeColor, padding: '1px 6px', borderRadius: 3, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>{s.type.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: 9, color: '#4a4058', flexShrink: 0 }}>{isEditing ? '▲' : '▼'}</span>
                  </div>,
                  isEditing && (
                    <div key={s.id + '_edit'} style={{ padding: '4px 12px 14px', background: 'rgba(168,85,247,0.04)', borderRadius: '0 0 8px 8px', border: '1px solid rgba(168,85,247,0.2)', borderTop: 'none', marginTop: -2 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10, maxWidth: 460 }}>
                        <div>
                          <label style={{ fontSize: 9, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3, display: 'block' }}>Name</label>
                          <input value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
                        </div>
                        <div>
                          <label style={{ fontSize: 9, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3, display: 'block' }}>Description</label>
                          <input value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} style={inputStyle} />
                        </div>
                        <SkillDisplayConfigFields editForm={editForm} setEditForm={setEditForm} inputStyle={inputStyle} configFields={configFields} />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => saveEdit(s.id)} style={{ ...btnStyle }}>Save</button>
                        <button onClick={(e) => { e.stopPropagation(); toggleActive(s); }} style={{ ...btnStyle, color: s.active ? '#f87171' : '#22c55e', borderColor: s.active ? 'rgba(220,38,38,0.3)' : 'rgba(34,197,94,0.3)', background: s.active ? 'rgba(220,38,38,0.08)' : 'rgba(34,197,94,0.08)' }}>
                          {s.active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteSkill(s.id, s.name); }} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.4)', background: 'rgba(220,38,38,0.12)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 11, textTransform: 'uppercase', cursor: 'pointer', color: '#f87171' }}>Delete</button>
                      </div>
                    </div>
                  ),
                ];
              })}
            </div>
            {funcCatalog.length === 0 && <div style={{ color: '#6a6078', fontSize: 12, padding: 20, textAlign: 'center' }}>No skills yet. Click "+ Create Skill" to add one.</div>}
          </div>
        );
      })()}

      {/* ── Rewards catalog (category='reward') ── */}
      {subTab === 'rewards_catalog' && (() => {
        // Filter by category if present, fall back to type set for older rows
        const rewardCatalog = skills.filter(s => s.category ? s.category === 'reward' : REWARD_TYPE_IDS.has(s.type));
        const rewardTierMap = {};
        matrixTiers.forEach(t => { (t.skills || []).map(normaliseSkillEntry).forEach(({ id }) => { (rewardTierMap[id] = rewardTierMap[id] || []).push(t.name || t.id); }); });
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.15em' }}>
                {rewardCatalog.length} rewards — tap to edit · attach in Store → Subscriptions
              </div>
              <button onClick={() => setSubTab('create')} style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.08)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, textTransform: 'uppercase', cursor: 'pointer', color: G, letterSpacing: '.08em' }}>+ Create Reward</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {rewardCatalog.map(s => {
                const isEditing = editingSkillId === s.id;
                const typeColor = TYPE_COLORS[s.type] || '#facc15';
                const subNames = rewardTierMap[s.id] || [];
                return [
                  <div key={s.id} onClick={() => startEdit(s)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderRadius: 8, background: isEditing ? 'rgba(250,204,21,0.06)' : 'rgba(255,255,255,0.01)', border: isEditing ? '1px solid rgba(250,204,21,0.2)' : '1px solid transparent' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#e8e0f0', fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif" }}>{s.name}</div>
                      {s.description && <div style={{ fontSize: 9, color: '#6a6078', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.description}</div>}
                    </div>
                    <span style={{ background: typeColor + '18', color: typeColor, padding: '1px 6px', borderRadius: 3, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>{s.type.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: 9, color: '#4a4058', flexShrink: 0 }}>{isEditing ? '▲' : '▼'}</span>
                  </div>,
                  isEditing && (
                    <div key={s.id + '_edit'} style={{ padding: '4px 12px 14px', background: 'rgba(250,204,21,0.04)', borderRadius: '0 0 8px 8px', border: '1px solid rgba(250,204,21,0.2)', borderTop: 'none', marginTop: -2 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10, maxWidth: 460 }}>
                        <div>
                          <label style={{ fontSize: 9, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3, display: 'block' }}>Name</label>
                          <input value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
                        </div>
                        <div>
                          <label style={{ fontSize: 9, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3, display: 'block' }}>Description</label>
                          <input value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} style={inputStyle} />
                        </div>
                        <SkillDisplayConfigFields editForm={editForm} setEditForm={setEditForm} inputStyle={inputStyle} configFields={configFields} />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => saveEdit(s.id)} style={{ ...btnStyle }}>Save</button>
                        <button onClick={(e) => { e.stopPropagation(); toggleActive(s); }} style={{ ...btnStyle, color: s.active ? '#f87171' : '#22c55e', borderColor: s.active ? 'rgba(220,38,38,0.3)' : 'rgba(34,197,94,0.3)', background: s.active ? 'rgba(220,38,38,0.08)' : 'rgba(34,197,94,0.08)' }}>
                          {s.active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteSkill(s.id, s.name); }} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.4)', background: 'rgba(220,38,38,0.12)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 11, textTransform: 'uppercase', cursor: 'pointer', color: '#f87171' }}>Delete</button>
                      </div>
                    </div>
                  ),
                ];
              })}
            </div>
            {rewardCatalog.length === 0 && <div style={{ color: '#6a6078', fontSize: 12, padding: 20, textAlign: 'center' }}>No rewards yet. Click "+ Create Reward" to add one.</div>}
          </div>
        );
      })()}

      {/* ── Award Badges DB ── */}
      {subTab === 'badges_db' && <BadgesDbPanel token={token} configFields={configFields} />}

      {/* ── Quests ── */}
      {subTab === 'quests' && (
        <QuestsPanel token={token} skills={skills} />
      )}

      {subTab === 'triggers' && <TriggersSubTab token={token} />}

      {/* ── Endpoints panels ── */}
      {subTab === 'store'    && <StoreTab token={token} />}
      {subTab === 'ranks'    && <RanksTab token={token} rankRewards={rankRewards} setRankRewards={setRankRewards} />}
      {subTab === 'gamble'   && <GambleTab token={token} />}
      {subTab === 'specials' && <SpecialsTab token={token} />}
      {subTab === 'email'    && <EmailSubTab token={token} />}
    </div>
  );
}

// ── Email sub-tab (inside Features → Endpoints) ───────────────────────────
// Test-fire button for the Resend grant email system.
// Sends a sample rank_up email to the logged-in admin's own address.
function EmailSubTab({ token }) {
  const [status, setStatus] = useState(null); // null | 'sending' | {ok, note, emailTo}

  const sendTest = async () => {
    if (status === 'sending') return;
    setStatus('sending');
    try {
      const r = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      });
      const json = await r.json();
      setStatus({ ok: json.ok, note: json.note, emailTo: json.emailTo });
    } catch (err) {
      setStatus({ ok: false, note: err.message, emailTo: null });
    }
  };

  const sending = status === 'sending';
  const result = status && status !== 'sending' ? status : null;

  return (
    <div style={{ padding: '24px 0', maxWidth: 500 }}>
      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.15em', color: '#6a6078', marginBottom: 16 }}>
        Grant Email System
      </div>

      {/* Status pill */}
      <div style={{ marginBottom: 20, padding: '10px 14px', background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.12)', borderRadius: 8, fontSize: 12, color: '#a09060', fontFamily: "'Barlow Condensed',sans-serif" }}>
        {result
          ? result.ok
            ? <span style={{ color: '#4ade80' }}>✓ {result.note}{result.emailTo ? ` (${result.emailTo})` : ''}</span>
            : <span style={{ color: '#f87171' }}>✗ {result.note}</span>
          : sending
            ? <span style={{ color: '#D4AF37' }}>Sending…</span>
            : <span>Fires a sample rank-up email to your account address via Resend.</span>
        }
      </div>

      <button
        onClick={sendTest}
        disabled={sending}
        style={{
          padding: '10px 22px',
          background: sending ? 'rgba(212,175,55,0.06)' : 'rgba(212,175,55,0.12)',
          border: '1px solid rgba(212,175,55,0.25)',
          borderRadius: 8,
          fontFamily: "'Barlow Condensed',sans-serif",
          fontWeight: 900,
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: '.1em',
          color: sending ? '#6a5f7a' : G,
          cursor: sending ? 'not-allowed' : 'pointer',
        }}
      >
        {sending ? 'Sending…' : 'Send Test Email'}
      </button>

      {result && (
        <button
          onClick={() => setStatus(null)}
          style={{ marginLeft: 10, padding: '10px 16px', background: 'none', border: '1px solid #2a2030', borderRadius: 8, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 11, color: '#6a6078', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.08em' }}
        >
          Reset
        </button>
      )}

      <div style={{ marginTop: 24, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid #1a1520', borderRadius: 8 }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: '#4a4258', marginBottom: 6 }}>Notes</div>
        <div style={{ fontSize: 11, color: '#4a4258', fontFamily: "'Barlow',sans-serif", lineHeight: 1.6 }}>
          Requires <code style={{ background: '#1a1520', padding: '1px 4px', borderRadius: 3, color: '#a09060' }}>RESEND_API_KEY</code> in Hostinger env vars.
          Without it, sends return <code style={{ background: '#1a1520', padding: '1px 4px', borderRadius: 3, color: '#a09060' }}>no_api_key</code> and grant logic is unaffected.
        </div>
      </div>
    </div>
  );
}

// ── Triggers sub-tab (inside Features) ────────────────────────────────────
// Catalog of all trigger IDs + wired status toggle + "Fire as user" debug tool.
function TriggersSubTab({ token }) {
  const [triggers, setTriggers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // Fire-modal state
  const [fireTrigger, setFireTrigger] = useState(null); // trigger row or null
  const [userQ, setUserQ] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [ctx, setCtx] = useState('');
  const [showCtx, setShowCtx] = useState(false);
  const [firing, setFiring] = useState(false);
  const [fireResult, setFireResult] = useState(null);
  const userSearchTimer = useRef(null);

  // Config-modal state
  const [cfgTrigger,      setCfgTrigger]      = useState(null); // trigger row being configured
  const [cfgType,         setCfgType]         = useState('event');
  const [cfgFields,       setCfgFields]       = useState({}); // flat k/v for the dynamic form
  const [cfgAllowedSubs,  setCfgAllowedSubs]  = useState([]); // [] = all tiers; otherwise only listed tiers
  const [cfgExpiresAfter, setCfgExpiresAfter] = useState(''); // '', '7d', '30d', '90d', 'custom'
  const [cfgCustomDays,   setCfgCustomDays]   = useState(''); // only used when cfgExpiresAfter === 'custom'
  const [cfgSaving,       setCfgSaving]       = useState(false);
  const [cfgMsg,          setCfgMsg]          = useState('');
  const [cfgLinked,       setCfgLinked]       = useState(null); // { quests: [], specials: [] } or null while loading

  const SUB_TIERS = [
    { id: 'free',      label: 'Free',      color: '#9ca3af' },
    { id: 'verified',  label: 'Verified',  color: '#22c55e' },
    { id: 'basic',     label: 'Basic',     color: '#6b7280' },
    { id: 'premium',   label: 'Premium',   color: '#D4AF37' },
    { id: 'legendary', label: 'Legendary', color: '#a855f7' },
  ];

  const TRIGGER_MECHANIC_TYPES = [
    { id: 'event',           label: 'Event (no mechanic)' },
    { id: 'gem_click',       label: 'Gem Click' },
    { id: 'forum_troll_kill',label: 'Forum Troll Kill' },
  ];
  const TRIGGER_CONFIG_FIELDS = {
    gem_click: [
      { key: 'click_range_min', label: 'Min Clicks', type: 'number', default: 1 },
      { key: 'click_range_max', label: 'Max Clicks', type: 'number', default: 10 },
    ],
    forum_troll_kill: [
      { key: 'troll_count',           label: 'Trolls to Kill',       type: 'number', default: 1 },
      { key: 'clicks_to_kill',        label: 'HP per Troll',         type: 'number', default: 3 },
      { key: 'despawn_after_seconds', label: 'Despawn After (secs)', type: 'number', default: 1800 },
    ],
  };

  const openConfig = (t) => {
    setCfgTrigger(t);
    setCfgType(t.type || 'event');
    // Populate form from existing config
    const existingCfg = t.config || {};
    const fields = TRIGGER_CONFIG_FIELDS[t.type || 'event'] || [];
    const defaults = {};
    fields.forEach(f => { defaults[f.key] = existingCfg[f.key] ?? f.default; });
    setCfgFields(defaults);
    // Load subscription gating
    setCfgAllowedSubs(existingCfg.allowed_subscriptions || []);
    // Load expiry
    const ea = existingCfg.expires_after;
    if (!ea) { setCfgExpiresAfter(''); setCfgCustomDays(''); }
    else if (['7d', '30d', '90d'].includes(ea)) { setCfgExpiresAfter(ea); setCfgCustomDays(''); }
    else { setCfgExpiresAfter('custom'); setCfgCustomDays(ea.replace('d', '')); }
    // Merge on_expiry + recurring into cfgFields so the selects bind correctly
    defaults._on_expiry = existingCfg.on_expiry || 'deactivate';
    defaults._recurring = !!existingCfg.recurring;
    setCfgMsg('');
    setCfgLinked(null);
    // Fetch linked quests + specials for this trigger
    Promise.all([
      fetch(`/api/admin/quests`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()).catch(() => ({ quests: [] })),
      fetch(`/api/admin/specials`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()).catch(() => ({ specials: [] })),
    ]).then(([qRes, sRes]) => {
      const linkedQuests   = (qRes.quests   || []).filter(q => q.trigger_id === t.id);
      const linkedSpecials = (sRes.specials || []).filter(s => s.trigger_id === t.id);
      setCfgLinked({ quests: linkedQuests, specials: linkedSpecials });
    });
  };
  const closeConfig = () => { setCfgTrigger(null); setCfgMsg(''); setCfgLinked(null); };

  const saveConfig = async () => {
    if (!cfgTrigger) return;
    setCfgSaving(true);
    setCfgMsg('');
    try {
      // Build config object from form fields (skip _-prefixed UI-only keys)
      const fields = TRIGGER_CONFIG_FIELDS[cfgType] || [];
      const config = {};
      fields.forEach(f => {
        const v = cfgFields[f.key];
        config[f.key] = f.type === 'number' ? Number(v) : v;
      });
      // Subscription gating — empty array = all users allowed
      config.allowed_subscriptions = cfgAllowedSubs;
      // Expiry
      if (cfgExpiresAfter && cfgExpiresAfter !== '') {
        config.expires_after = cfgExpiresAfter === 'custom'
          ? (cfgCustomDays ? `${cfgCustomDays}d` : null)
          : cfgExpiresAfter;
        config.on_expiry = cfgFields._on_expiry || 'deactivate';
        config.recurring = !!cfgFields._recurring;
      } else {
        config.expires_after = null;
        config.on_expiry = null;
        config.recurring = false;
      }
      const r = await fetch('/api/admin/trigger-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ id: cfgTrigger.id, type: cfgType, config }),
      });
      const j = await r.json();
      if (j.ok) {
        // Update local triggers list
        setTriggers(prev => prev.map(t => t.id === cfgTrigger.id ? { ...t, type: cfgType, config } : t));
        setCfgMsg('Saved!');
        setTimeout(() => { closeConfig(); }, 900);
      } else {
        setCfgMsg('Error: ' + (j.error || 'Failed'));
      }
    } catch (e) {
      setCfgMsg('Error: ' + e.message);
    }
    setCfgSaving(false);
  };

  useEffect(() => {
    fetch('/api/admin/specials?view=triggers', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => { setTriggers(d.triggers || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  const toggleTrigger = async (id, enabled) => {
    setTriggers(prev => prev.map(t => t.id === id ? { ...t, enabled } : t));
    const r = await fetch('/api/admin/specials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'toggle_trigger', id, enabled }),
    });
    const j = await r.json();
    if (!j.ok) { setMsg('Error: ' + (j.error || 'Failed')); setTriggers(prev => prev.map(t => t.id === id ? { ...t, enabled: !enabled } : t)); }
    else { setMsg(''); }
  };

  const openFire = (t) => {
    setFireTrigger(t);
    setUserQ(''); setUserResults([]); setSelectedUser(null);
    setCtx(''); setShowCtx(false); setFireResult(null);
  };
  const closeFire = () => { setFireTrigger(null); setFireResult(null); };

  const searchUsers = (q) => {
    setUserQ(q);
    setSelectedUser(null);
    clearTimeout(userSearchTimer.current);
    if (!q.trim()) { setUserResults([]); return; }
    userSearchTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/tabs?type=users_search&q=${encodeURIComponent(q)}`, {
          headers: { Authorization: 'Bearer ' + token },
        });
        const j = await r.json();
        setUserResults(j.users || []);
      } catch (_) { setUserResults([]); }
    }, 300);
  };

  const doFire = async () => {
    if (!fireTrigger || !selectedUser || firing) return;
    let ctxParsed = {};
    if (ctx.trim()) {
      try { ctxParsed = JSON.parse(ctx); }
      catch { setFireResult({ error: 'Invalid JSON in ctx field' }); return; }
    }
    setFiring(true);
    setFireResult(null);
    try {
      const r = await fetch('/api/admin/triggers/emit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ trigger_id: fireTrigger.id, user_id: selectedUser.id, ctx: ctxParsed }),
      });
      setFireResult(await r.json());
    } catch (e) {
      setFireResult({ error: e.message });
    }
    setFiring(false);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spin" style={{ margin: '0 auto' }} /></div>;

  const inputSt = { background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 6, padding: '6px 10px', color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' };

  return (
    <div>
      {msg && <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 14, color: '#f87171', fontSize: 11 }}>{msg}</div>}
      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.2em', color: 'var(--mt)', marginBottom: 14 }}>
        Trigger Catalog — enabled = emit point wired in code
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>{['ID', 'Name', 'Description', 'Type', 'Wired', 'Actions'].map(h => <th key={h} style={hcell}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {triggers.map(t => (
            <tr key={t.id} onClick={() => openConfig(t)} style={{ cursor: 'pointer' }}>
              <td style={{ ...cell, fontFamily: 'monospace', color: '#a78bfa' }}>{t.id}</td>
              <td style={cell}>{t.name}</td>
              <td style={{ ...cell, maxWidth: 200, color: 'var(--mt)' }}>{t.description}</td>
              <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                {t.type && t.type !== 'event'
                  ? <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#c084fc', background: 'rgba(192,132,252,0.08)', border: '1px solid rgba(192,132,252,0.2)', borderRadius: 4, padding: '1px 6px' }}>{t.type}</span>
                  : <span style={{ color: '#3a3048', fontSize: 9 }}>—</span>
                }
              </td>
              <td style={cell} onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => toggleTrigger(t.id, !t.enabled)}
                  style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: t.enabled ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.04)', color: t.enabled ? '#4ade80' : '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', cursor: 'pointer', letterSpacing: '.06em' }}
                >{t.enabled ? 'Wired' : 'Stub'}</button>
              </td>
              <td style={{ ...cell, whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button
                    onClick={() => openConfig(t)}
                    style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid rgba(192,132,252,0.25)', background: 'rgba(192,132,252,0.07)', color: '#c084fc', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', cursor: 'pointer', letterSpacing: '.06em' }}
                  >⚙ Config</button>
                  <button
                    onClick={() => openFire(t)}
                    style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid rgba(212,175,55,0.25)', background: 'rgba(212,175,55,0.07)', color: G, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', cursor: 'pointer', letterSpacing: '.06em' }}
                  >⚡ Fire</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {triggers.length === 0 && <div style={{ color: 'var(--mt)', fontSize: 12 }}>No triggers found.</div>}

      {/* ── Fire-as-user modal ─────────────────────────────────────────── */}
      {fireTrigger && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) closeFire(); }}
        >
          <div style={{ background: '#100c14', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 12, padding: 24, width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: "'Cinzel',serif", color: G, fontSize: 14, fontWeight: 700 }}>Fire Trigger</div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#a78bfa', marginTop: 3 }}>{fireTrigger.id}</div>
                <div style={{ fontSize: 10, color: 'var(--mt)', marginTop: 2 }}>{fireTrigger.name}</div>
              </div>
              <button onClick={closeFire} style={{ background: 'none', border: 'none', color: 'var(--mt)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 2 }}>✕</button>
            </div>

            {/* User picker */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--mt)', marginBottom: 6 }}>Target User</div>
              {selectedUser ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                  <div>
                    <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif" }}>{selectedUser.display_name || '(no name)'}</span>
                    {selectedUser.email && <span style={{ color: 'var(--mt)', fontSize: 10, marginLeft: 8 }}>{selectedUser.email}</span>}
                  </div>
                  <button onClick={() => { setSelectedUser(null); setUserQ(''); setUserResults([]); setFireResult(null); }} style={{ background: 'none', border: 'none', color: 'var(--mt)', cursor: 'pointer', fontSize: 13, padding: 2 }}>✕</button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input
                    autoFocus
                    type="text"
                    value={userQ}
                    onChange={e => searchUsers(e.target.value)}
                    placeholder="Search by name or email…"
                    style={inputSt}
                  />
                  {userResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1420', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, zIndex: 100, maxHeight: 180, overflowY: 'auto', marginTop: 3 }}>
                      {userResults.map(u => (
                        <div
                          key={u.id}
                          onClick={() => { setSelectedUser(u); setUserResults([]); }}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, background: 'transparent', transition: 'background 0.1s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.08)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <span style={{ color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{u.display_name || '(no name)'}</span>
                          {u.email && <span style={{ color: 'var(--mt)', fontSize: 10, marginLeft: 8 }}>{u.email}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {userQ.trim() && userResults.length === 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1420', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 8, zIndex: 100, padding: '10px 12px', marginTop: 3, fontSize: 11, color: 'var(--mt)' }}>
                      No users found
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Optional ctx JSON */}
            <div style={{ marginBottom: 20 }}>
              <button
                onClick={() => setShowCtx(p => !p)}
                style={{ background: 'none', border: 'none', color: 'var(--mt)', cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', padding: 0 }}
              >
                {showCtx ? '▾' : '▸'} Context JSON (optional)
              </button>
              {showCtx && (
                <textarea
                  value={ctx}
                  onChange={e => setCtx(e.target.value)}
                  placeholder='{"thread_id":"..."}'
                  rows={3}
                  style={{ ...inputSt, marginTop: 8, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
                />
              )}
            </div>

            {/* Fire button */}
            <button
              onClick={doFire}
              disabled={!selectedUser || firing}
              style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: `1px solid ${(!selectedUser || firing) ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.4)'}`, background: (!selectedUser || firing) ? 'rgba(212,175,55,0.03)' : 'rgba(212,175,55,0.1)', color: (!selectedUser || firing) ? 'rgba(212,175,55,0.3)' : G, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', cursor: (!selectedUser || firing) ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
            >
              {firing ? 'Firing…' : `⚡ Fire ${fireTrigger.id}${selectedUser ? ' as ' + (selectedUser.display_name || selectedUser.email || '—') : ''}`}
            </button>

            {/* Result panel */}
            {fireResult && (
              <div style={{ marginTop: 16, background: 'rgba(8,6,10,0.9)', border: `1px solid ${fireResult.ok ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`, borderRadius: 8, padding: 16 }}>
                {fireResult.error ? (
                  <div style={{ color: '#f87171', fontSize: 12 }}>✗ {fireResult.error}</div>
                ) : (
                  <>
                    <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: '#4ade80', marginBottom: 12 }}>✓ Fired</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px', marginBottom: 12, fontSize: 11 }}>
                      <span style={{ color: 'var(--mt)' }}>Trigger</span>
                      <span style={{ fontFamily: 'monospace', color: '#a78bfa' }}>{fireResult.trigger_id}</span>
                      <span style={{ color: 'var(--mt)' }}>User</span>
                      <span style={{ color: '#e8e0f0' }}>{fireResult.user_display_name}</span>
                      <span style={{ color: 'var(--mt)' }}>Specials fired</span>
                      <span style={{ color: fireResult.specials_fired?.length ? '#4ade80' : 'var(--mt)' }}>{fireResult.specials_fired?.length ?? 0}</span>
                      <span style={{ color: 'var(--mt)' }}>FG granted</span>
                      <span style={{ color: G, fontWeight: 700 }}>{(fireResult.total_fg || 0).toLocaleString()}</span>
                    </div>

                    {(fireResult.specials_fired?.length > 0) && (
                      <>
                        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--mt)', marginBottom: 6 }}>Specials</div>
                        {fireResult.specials_fired.map(s => (
                          <div key={s.special_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11 }}>
                            <span style={{ color: '#e8e0f0' }}>{s.special_icon} {s.special_name} <span style={{ color: 'var(--mt)', fontSize: 10 }}>#{s.special_id}</span></span>
                            {s.fg_granted > 0 && <span style={{ color: G, fontWeight: 700 }}>+{s.fg_granted.toLocaleString()} FG</span>}
                          </div>
                        ))}
                      </>
                    )}

                    {fireResult.specials_fired?.length === 0 && (
                      <div style={{ color: 'var(--mt)', fontSize: 11 }}>
                        No specials fired — trigger has no enabled specials, or user already claimed all of them.
                      </div>
                    )}

                    {!fireResult.trigger_wired && (
                      <div style={{ marginTop: 10, padding: '6px 10px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, color: '#f59e0b', fontSize: 10 }}>
                        ⚠ This trigger is marked Stub (not wired in prod code) — specials still fire via admin emit.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Trigger Config modal ──────────────────────────────────────────── */}
      {cfgTrigger && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) closeConfig(); }}
        >
          <div style={{ background: '#100c14', border: '1px solid rgba(192,132,252,0.25)', borderRadius: 12, padding: 24, width: 400, maxWidth: '95vw', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: "'Cinzel',serif", color: '#c084fc', fontSize: 14, fontWeight: 700 }}>Configure Trigger</div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#a78bfa', marginTop: 3 }}>{cfgTrigger.id}</div>
              </div>
              <button onClick={closeConfig} style={{ background: 'none', border: 'none', color: 'var(--mt)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 2 }}>✕</button>
            </div>

            {/* Type selector */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--mt)', marginBottom: 6 }}>Mechanic Type</div>
              <select
                value={cfgType}
                onChange={e => {
                  const t = e.target.value;
                  setCfgType(t);
                  const fields = TRIGGER_CONFIG_FIELDS[t] || [];
                  const defaults = {};
                  fields.forEach(f => { defaults[f.key] = cfgTrigger.config?.[f.key] ?? f.default; });
                  setCfgFields(defaults);
                }}
                style={{ background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(192,132,252,0.2)', borderRadius: 6, padding: '6px 10px', color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, outline: 'none', width: '100%' }}
              >
                {TRIGGER_MECHANIC_TYPES.map(mt => <option key={mt.id} value={mt.id}>{mt.label}</option>)}
              </select>
            </div>

            {/* Dynamic config fields */}
            {(TRIGGER_CONFIG_FIELDS[cfgType] || []).map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--mt)', marginBottom: 4 }}>{f.label}</div>
                <input
                  type={f.type}
                  value={cfgFields[f.key] ?? f.default}
                  onChange={e => setCfgFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(192,132,252,0.2)', borderRadius: 6, padding: '6px 10px', color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            {(TRIGGER_CONFIG_FIELDS[cfgType] || []).length === 0 && (
              <div style={{ color: 'var(--mt)', fontSize: 11, marginBottom: 12 }}>No configurable fields for this mechanic type.</div>
            )}

            {/* Required Subscriptions */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--mt)', marginBottom: 6 }}>Required Subscription <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(none = all users)</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SUB_TIERS.map(tier => {
                  const checked = cfgAllowedSubs.includes(tier.id);
                  return (
                    <label key={tier.id} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', padding: '4px 10px', borderRadius: 6, border: `1px solid ${checked ? tier.color : 'rgba(255,255,255,0.1)'}`, background: checked ? `${tier.color}22` : 'transparent', transition: 'all 0.12s' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setCfgAllowedSubs(prev => checked ? prev.filter(x => x !== tier.id) : [...prev, tier.id])}
                        style={{ accentColor: tier.color, width: 12, height: 12 }}
                      />
                      <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 11, color: checked ? tier.color : 'var(--mt)' }}>{tier.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Expiry */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--mt)', marginBottom: 6 }}>Expires After</div>
              <select
                value={cfgExpiresAfter}
                onChange={e => { setCfgExpiresAfter(e.target.value); if (e.target.value !== 'custom') setCfgCustomDays(''); }}
                style={{ background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(192,132,252,0.2)', borderRadius: 6, padding: '6px 10px', color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, outline: 'none', width: '100%' }}
              >
                <option value="">Never</option>
                <option value="7d">1 Week</option>
                <option value="30d">1 Month</option>
                <option value="90d">3 Months</option>
                <option value="custom">Custom (days)</option>
              </select>
              {cfgExpiresAfter === 'custom' && (
                <input
                  type="number"
                  min="1"
                  placeholder="Number of days"
                  value={cfgCustomDays}
                  onChange={e => setCfgCustomDays(e.target.value)}
                  style={{ marginTop: 6, background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(192,132,252,0.2)', borderRadius: 6, padding: '6px 10px', color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' }}
                />
              )}
              {cfgExpiresAfter && (
                <>
                  <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--mt)', marginTop: 10, marginBottom: 6 }}>On Expiry</div>
                  <select
                    value={cfgFields._on_expiry || 'deactivate'}
                    onChange={e => setCfgFields(prev => ({ ...prev, _on_expiry: e.target.value }))}
                    style={{ background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(192,132,252,0.2)', borderRadius: 6, padding: '6px 10px', color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, outline: 'none', width: '100%' }}
                  >
                    <option value="deactivate">Deactivate (turn off trigger)</option>
                    <option value="auto_fire">Auto-fire (self-trigger if nobody hit it)</option>
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!cfgFields._recurring}
                      onChange={e => setCfgFields(prev => ({ ...prev, _recurring: e.target.checked }))}
                      style={{ accentColor: '#c084fc', width: 13, height: 13 }}
                    />
                    <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, color: '#e8e0f0' }}>Recurring — reset cycle after expiry/fire</span>
                  </label>
                </>
              )}
            </div>

            {cfgMsg && <div style={{ marginBottom: 12, fontSize: 11, color: cfgMsg.startsWith('Error') ? '#f87171' : '#4ade80', fontFamily: "'Barlow Condensed',sans-serif" }}>{cfgMsg}</div>}

            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button
                onClick={saveConfig}
                disabled={cfgSaving}
                style={{ padding: '6px 18px', borderRadius: 6, border: '1px solid rgba(192,132,252,0.3)', background: cfgSaving ? 'rgba(192,132,252,0.05)' : 'rgba(192,132,252,0.12)', color: '#c084fc', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, textTransform: 'uppercase', cursor: cfgSaving ? 'wait' : 'pointer', letterSpacing: '.08em' }}
              >{cfgSaving ? 'Saving…' : 'Save'}</button>
              <button onClick={closeConfig} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
            </div>

            {/* Linked to section */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--mt)', marginBottom: 10 }}>Linked To</div>
              {cfgLinked === null ? (
                <div style={{ fontSize: 10, color: '#555' }}>Loading…</div>
              ) : (cfgLinked.quests.length === 0 && cfgLinked.specials.length === 0) ? (
                <div style={{ fontSize: 10, color: '#444' }}>Nothing linked to this trigger.</div>
              ) : (
                <>
                  {cfgLinked.quests.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 8, color: '#a78bfa', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 5 }}>Quests</div>
                      {cfgLinked.quests.map(q => (
                        <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.12)', borderRadius: 6, marginBottom: 4, fontSize: 11 }}>
                          <span style={{ fontSize: 14, lineHeight: 1 }}>{q.icon || '🗺'}</span>
                          <div>
                            <span style={{ color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{q.name}</span>
                            {q.description && <span style={{ color: 'var(--mt)', fontSize: 10, marginLeft: 6 }}>{q.description}</span>}
                          </div>
                          <span style={{ marginLeft: 'auto', fontSize: 9, color: q.active ? '#4ade80' : '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: 'uppercase' }}>{q.active ? 'Active' : 'Inactive'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {cfgLinked.specials.length > 0 && (
                    <div>
                      <div style={{ fontSize: 8, color: '#facc15', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 5 }}>Specials</div>
                      {cfgLinked.specials.map(s => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'rgba(250,204,21,0.04)', border: '1px solid rgba(250,204,21,0.1)', borderRadius: 6, marginBottom: 4, fontSize: 11 }}>
                          <span style={{ fontSize: 14, lineHeight: 1 }}>{s.icon || '⚡'}</span>
                          <div>
                            <span style={{ color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{s.name}</span>
                            {s.description && <span style={{ color: 'var(--mt)', fontSize: 10, marginLeft: 6 }}>{s.description}</span>}
                          </div>
                          <span style={{ marginLeft: 'auto', fontSize: 9, color: s.enabled ? '#4ade80' : '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: 'uppercase' }}>{s.enabled ? 'On' : 'Off'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── FG Packages Admin Tab ─────────────────────────────────────────────────
function FGPackagesSubTab({ token }) {
  const [packages, setPackages] = useState([]);
  const [editing, setEditing] = useState(null);
  const [expandedSection, setExpandedSection] = useState({});
  const [msg, setMsg] = useState('');
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pkgsError, setPkgsError] = useState(null);
  const [dirtyPkgs, setDirtyPkgs] = useState(new Set());
  const [savingPkg, setSavingPkg] = useState(null);
  const { flat: allPerms } = useDbPerms();

  const markPkgDirty = (id) => setDirtyPkgs(prev => new Set([...prev, id]));
  const markPkgClean = (id) => setDirtyPkgs(prev => { const n = new Set(prev); n.delete(id); return n; });

  const pkgsInFlight = useRef(false);

  const loadPackages = useCallback(async () => {
    if (pkgsInFlight.current) return;
    pkgsInFlight.current = true;
    setPkgsError(null);
    try {
      // Raw REST fetch — avoids GoTrue auth-mutex hangs (same pattern as useDbPerms)
      const res = await sbFetch('fg_packages?select=*&order=sort_order');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error(data?.message || 'Unexpected response');
      const normalised = data.map(p => {
        const rawSkills = p.skills || [];
        const skillIds = rawSkills.map(e => (typeof e === 'string' ? e : e.id));
        const initCfgs = {};
        rawSkills.forEach(e => { if (typeof e === 'object' && e.id) initCfgs[e.id] = e.config || {}; });
        return { ...p, fg: p.fg_amount, permissions: p.permissions || {}, rewards: p.rewards || {}, skills: skillIds, _initCfgs: initCfgs };
      });
      setPackages(normalised);
      const cfgMap = {};
      normalised.forEach(p => { if (Object.keys(p._initCfgs).length) cfgMap[p.id] = p._initCfgs; });
      setPkgSkillConfigs(prev => ({ ...cfgMap, ...prev }));
    } catch (e) {
      setPkgsError(e.message || 'Load failed');
    } finally {
      pkgsInFlight.current = false;
      setLoading(false);
    }
  }, []);

  const skillsApi = useCallback(async () => {
    const r = await fetch('/api/admin/skills', { headers: { Authorization: 'Bearer ' + token } });
    const data = await r.json();
    if (data.skills) setSkills(data.skills);
  }, [token]);

  useEffect(() => { loadPackages(); if (token) skillsApi(); }, [token, skillsApi, loadPackages]);

  const inputStyle = { background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 6, padding: '6px 10px', color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, outline: 'none' };
  const btnStyle = { padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.1)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, textTransform: 'uppercase', cursor: 'pointer', color: G, letterSpacing: '.08em' };
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const updatePkg = (id, field, value) => {
    setPackages(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    markPkgDirty(id);
  };

  const savePkg = (pkgId) => {
    setSavingPkg(pkgId);
    setPackages(prev => {
      const pkg = prev.find(p => p.id === pkgId);
      if (!pkg) { setSavingPkg(null); return prev; }
      const pkgCfgs = pkgSkillConfigs[pkgId] || {};
      const skillsWithConfig = (pkg.skills || []).map(sid => {
        const id = typeof sid === 'string' ? sid : sid.id;
        return { id, config: pkgCfgs[id] || {} };
      });
      supabase.from('fg_packages').update({
        name: pkg.name, price: pkg.price, fg_amount: pkg.fg, color: pkg.color || '#facc15', blurb: pkg.blurb || '',
        permissions: pkg.permissions || {}, rewards: pkg.rewards || {}, skills: skillsWithConfig,
        updated_at: new Date().toISOString(),
      }).eq('id', pkgId).then(({ error }) => {
        setSavingPkg(null);
        if (error) { flash('Save failed: ' + error.message); return; }
        markPkgClean(pkgId);
        flash('✓ Saved');
      });
      return prev;
    });
  };

  const addPackage = async () => {
    const id = 'fg_' + Date.now();
    await supabase.from('fg_packages').insert({ id, name: 'New Package', price: 0, fg_amount: 0, color: '#facc15', sort_order: packages.length });
    loadPackages();
    setEditing(id);
  };

  const deletePkg = async (id) => {
    await supabase.from('fg_packages').delete().eq('id', id);
    loadPackages();
    if (editing === id) setEditing(null);
    flash('Package deleted');
  };

  const [pkgSkillConfigs, setPkgSkillConfigs] = useState({});

  const updatePkgSkillConfig = (pkgId, skillId, field, val) => {
    setPkgSkillConfigs(prev => ({
      ...prev,
      [pkgId]: { ...(prev[pkgId] || {}), [skillId]: { ...(prev[pkgId]?.[skillId] || {}), [field]: val } },
    }));
    markPkgDirty(pkgId);
  };

  const toggleSkillForPkg = (pkgId, skillId) => {
    setPackages(prev => prev.map(p => {
      if (p.id !== pkgId) return p;
      const cur = (p.skills || []).map(e => (typeof e === 'string' ? e : e.id));
      return { ...p, skills: cur.includes(skillId) ? cur.filter(s => s !== skillId) : [...cur, skillId] };
    }));
    markPkgDirty(pkgId);
  };

  const updatePermission = (pkgId, permId, val) => {
    setPackages(prev => prev.map(p => p.id === pkgId ? { ...p, permissions: { ...p.permissions, [permId]: val } } : p));
    markPkgDirty(pkgId);
  };

  const updateReward = (pkgId, rewardId, val) => {
    setPackages(prev => prev.map(p => p.id === pkgId ? { ...p, rewards: { ...p.rewards, [rewardId]: val } } : p));
    markPkgDirty(pkgId);
  };

  const toggleSection = (pkgId, section) => {
    setExpandedSection(prev => ({ ...prev, [pkgId]: prev[pkgId] === section ? null : section }));
  };

  const sectionBtn = (pkgId, section, label, color, count) => (
    <button onClick={() => toggleSection(pkgId, section)} style={{ flex: '1 1 0', padding: '8px 6px', background: expandedSection[pkgId] === section ? color + '15' : 'rgba(0,0,0,0.2)', border: expandedSection[pkgId] === section ? `1px solid ${color}40` : '1px solid rgba(255,255,255,0.04)', borderRadius: 8, cursor: 'pointer', textAlign: 'center', transition: 'all .15s' }}>
      <div style={{ fontSize: 8, color: expandedSection[pkgId] === section ? color : '#6a6078', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 900, color: expandedSection[pkgId] === section ? color : '#4a4058', marginTop: 2 }}>{count}</div>
    </button>
  );

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><div className="spin" /></div>;

  return (
    <div>
      {msg && <div style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 16, color: G, fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{msg}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 9, color: '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.15em' }}>FG Packages</div>
        <button onClick={addPackage} style={{ ...btnStyle, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}>+ Add Package</button>
      </div>

      {pkgsError && (
        <div style={{ textAlign: 'center', padding: '32px 20px', background: 'rgba(239,68,68,0.04)', border: '1px dashed rgba(239,68,68,0.25)', borderRadius: 12 }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 14, color: '#f87171', marginBottom: 6 }}>Couldn't load packages</div>
          <div style={{ fontSize: 10, color: '#6a6078', marginBottom: 14 }}>{pkgsError}</div>
          <button onClick={loadPackages} style={{ padding: '6px 18px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 11, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.08em' }}>Retry</button>
        </div>
      )}
      {!pkgsError && packages.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(212,175,55,0.15)', borderRadius: 12 }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 16, color: '#4a4058', marginBottom: 8 }}>No FG packages yet</div>
          <div style={{ fontSize: 11, color: '#6a6078' }}>Click "+ Add Package" to create your first FG bundle.</div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        {packages.map(pkg => {
          const pkgPerms = pkg.permissions || {};
          const pkgRewards = pkg.rewards || {};
          const pkgSkillIds = pkg.skills || [];
          const activePerms = Object.values(pkgPerms).filter(v => v && v !== '0' && v !== '\u2014').length;
          const activeRewards = Object.values(pkgRewards).filter(v => v && v !== '0').length;
          const expanded = expandedSection[pkg.id];

          const isPkgDirty = dirtyPkgs.has(pkg.id);
          return (
            <div key={pkg.id} style={{ background: 'rgba(212,175,55,0.03)', border: `1px solid ${isPkgDirty ? 'rgba(245,158,11,0.35)' : 'rgba(250,204,21,0.15)'}`, borderRadius: 12, padding: 16 }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src="/assets/fg-coin.png" alt="FG" style={{ width: 20, height: 20 }} />
                  {editing === pkg.id ? (
                    <input value={pkg.name} onChange={e => updatePkg(pkg.id, 'name', e.target.value)} style={{ ...inputStyle, width: 140, fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 14 }} />
                  ) : (
                    <span style={{ fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 14, color: '#facc15' }}>{pkg.name}</span>
                  )}
                  {isPkgDirty && <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700, letterSpacing: '.04em' }}>● unsaved</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEditing(editing === pkg.id ? null : pkg.id)} style={btnStyle}>
                    {editing === pkg.id ? 'Done' : 'Edit'}
                  </button>
                  {editing === pkg.id && (
                    <button onClick={() => deletePkg(pkg.id)} style={{ ...btnStyle, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>Delete</button>
                  )}
                </div>
              </div>

              {/* Blurb */}
              {editing === pkg.id && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4 }}>Description / Blurb</div>
                  <input value={pkg.blurb || ''} onChange={e => updatePkg(pkg.id, 'blurb', e.target.value)} placeholder="e.g. Best value for hardcore traders" style={{ ...inputStyle, width: '100%', fontSize: 11 }} />
                </div>
              )}
              {!editing && pkg.blurb && <div style={{ fontSize: 10, color: '#6a6078', marginBottom: 10, fontStyle: 'italic' }}>{pkg.blurb}</div>}

              {/* Price / FG Amount */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4 }}>Price</div>
                  {editing === pkg.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#6a6078', fontSize: 12 }}>$</span>
                      <input type="number" step="0.01" value={pkg.price} onChange={e => updatePkg(pkg.id, 'price', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, width: 60, fontSize: 14, fontWeight: 900 }} />
                    </div>
                  ) : (
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#4ade80' }}>${pkg.price}</div>
                  )}
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4 }}>FG Amount</div>
                  {editing === pkg.id ? (
                    <input type="number" value={pkg.fg} onChange={e => updatePkg(pkg.id, 'fg', parseInt(e.target.value) || 0)} style={{ ...inputStyle, width: 70, fontSize: 14, fontWeight: 900 }} />
                  ) : (
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#facc15' }}>{(pkg.fg || 0).toLocaleString()}</div>
                  )}
                </div>
              </div>

              {/* Section toggle buttons: Skills | Permissions | Rewards */}
              <div style={{ display: 'flex', gap: 6, marginBottom: expanded ? 12 : 0 }}>
                {sectionBtn(pkg.id, 'skills', 'Skills', '#a855f7', pkgSkillIds.length)}
                {sectionBtn(pkg.id, 'permissions', 'Permissions', '#4ade80', activePerms)}
                {sectionBtn(pkg.id, 'rewards', 'Rewards', '#facc15', activeRewards)}
              </div>

              {/* SKILLS PANEL (pick + configure) */}
              {expanded === 'skills' && (() => {
                const activeSkills = skills.filter(s => s.active);
                const unassigned = activeSkills.filter(s => !pkgSkillIds.includes(s.id));
                return (
                  <div style={{ padding: '10px 12px', background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.15)', borderRadius: 8 }}>
                    <div style={{ fontSize: 9, color: '#a855f7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>Skills for this package — configure each assignment</div>
                    {activeSkills.length === 0 && <div style={{ fontSize: 10, color: '#6a6078' }}>No active skills. Create them in Features → Skills first.</div>}
                    {pkgSkillIds.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                        {pkgSkillIds.map(sid => {
                          const s = skills.find(sk => sk.id === sid);
                          if (!s) return null;
                          const tc = TYPE_COLORS[s.type] || '#6b7280';
                          const fields = s.dials?.fields || [];
                          const cfg = pkgSkillConfigs[pkg.id]?.[sid] || {};
                          return (
                            <div key={sid} style={{ background: tc + '0a', border: `1px solid ${tc}25`, borderRadius: 8, padding: '8px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: fields.length ? 8 : 0 }}>
                                <span style={{ color: tc, fontWeight: 700, fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif" }}>{s.name}</span>
                                <button onClick={() => toggleSkillForPkg(pkg.id, sid)} style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 4, padding: '2px 8px', color: '#f87171', fontSize: 8, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
                              </div>
                              {fields.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                  {fields.map(f => (
                                    <div key={f.key}>
                                      <div style={{ fontSize: 7, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{f.label}</div>
                                      <SkillFieldInput f={f} value={cfg[f.key] ?? ''} tc={tc} onChange={(key, val) => updatePkgSkillConfig(pkg.id, sid, key, val)} />
                                    </div>
                                  ))}
                                </div>
                              )}
                              {fields.length === 0 && <div style={{ fontSize: 9, color: '#6a6078' }}>Auto-applies with package — set dials in Catalogue to add config fields.</div>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {unassigned.length > 0 && (
                      <div>
                        <div style={{ fontSize: 8, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Add a skill:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {unassigned.map(s => {
                            const tc = TYPE_COLORS[s.type] || '#6b7280';
                            return (
                              <button key={s.id} onClick={() => toggleSkillForPkg(pkg.id, s.id)}
                                style={{ padding: '3px 10px', borderRadius: 12, border: `1px solid ${tc}30`, background: 'transparent', color: tc + 'aa', fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif" }}>
                                + {s.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* PERMISSIONS PANEL */}
              {expanded === 'permissions' && (
                <div style={{ padding: '10px 12px', background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, color: '#4ade80', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10 }}>Set permission values for this package</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {allPerms.map(p => {
                      const val = pkgPerms[p.id] ?? '';
                      return (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.groupColor, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0, fontSize: 10, color: '#e8e0f0', fontWeight: 600 }}>{p.name}</div>
                          {p.hasValue ? (
                            <input value={val} placeholder="0" onChange={e => updatePermission(pkg.id, p.id, e.target.value)}
                              style={{ background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 4, padding: '3px 8px', color: '#4ade80', fontSize: 11, fontWeight: 900, outline: 'none', width: 60, textAlign: 'center', fontFamily: "'Barlow Condensed',sans-serif" }} />
                          ) : (
                            <button onClick={() => updatePermission(pkg.id, p.id, val === '\u2713' ? '' : '\u2713')}
                              style={{ width: 32, height: 24, borderRadius: 4, border: val === '\u2713' ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,255,255,0.08)', background: val === '\u2713' ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.03)', color: val === '\u2713' ? '#4ade80' : '#3a3048', fontSize: 12, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {val === '\u2713' ? '\u2713' : '\u2014'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* REWARDS PANEL */}
              {expanded === 'rewards' && (
                <div style={{ padding: '10px 12px', background: 'rgba(250,204,21,0.04)', border: '1px solid rgba(250,204,21,0.15)', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, color: '#facc15', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10 }}>Set reward amounts for this package</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {REWARD_CATALOG.map(r => {
                      const val = pkgRewards[r.id] ?? '';
                      return (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                          <span style={{ fontSize: 14, flexShrink: 0, width: 22, textAlign: 'center' }}>{r.icon}</span>
                          <div style={{ flex: 1, minWidth: 0, fontSize: 10, color: '#e8e0f0', fontWeight: 600 }}>{r.name}</div>
                          <input value={val} placeholder="0" onChange={e => updateReward(pkg.id, r.id, e.target.value)}
                            style={{ background: 'rgba(10,8,12,0.6)', border: `1px solid ${r.color}30`, borderRadius: 4, padding: '3px 8px', color: r.color, fontSize: 11, fontWeight: 900, outline: 'none', width: 60, textAlign: 'center', fontFamily: "'Barlow Condensed',sans-serif" }} />
                          {r.unit && <span style={{ fontSize: 8, color: '#6a6078', width: 35, flexShrink: 0 }}>{r.unit}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Summary chips when collapsed */}
              {!expanded && (pkgSkillIds.length > 0 || activePerms > 0 || activeRewards > 0) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 8 }}>
                  {pkgSkillIds.map(sid => {
                    const s = skills.find(sk => sk.id === sid);
                    if (!s) return null;
                    const tc = TYPE_COLORS[s.type] || '#6b7280';
                    return <span key={sid} style={{ background: tc + '18', color: tc, padding: '1px 8px', borderRadius: 4, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>{s.name}</span>;
                  })}
                  {Object.entries(pkgPerms).filter(([, v]) => v && v !== '0' && v !== '\u2014').map(([k, v]) => {
                    const p = allPerms.find(pp => pp.id === k);
                    return p ? <span key={k} style={{ background: 'rgba(74,222,128,0.08)', color: '#4ade80', padding: '1px 8px', borderRadius: 4, fontSize: 8, fontWeight: 700 }}>{p.name}: {v}</span> : null;
                  })}
                  {Object.entries(pkgRewards).filter(([, v]) => v && v !== '0').map(([k, v]) => {
                    const r = REWARD_CATALOG.find(rr => rr.id === k);
                    return r ? <span key={k} style={{ background: r.color + '15', color: r.color, padding: '1px 8px', borderRadius: 4, fontSize: 8, fontWeight: 700 }}>{r.icon} {v}</span> : null;
                  })}
                </div>
              )}

              {/* Save button — only when dirty */}
              {isPkgDirty && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(245,158,11,0.2)' }}>
                  <button
                    onClick={() => savePkg(pkg.id)}
                    disabled={savingPkg === pkg.id}
                    style={{ width: '100%', padding: '10px', background: savingPkg === pkg.id ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 8, color: '#f59e0b', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', cursor: savingPkg === pkg.id ? 'not-allowed' : 'pointer' }}
                  >
                    {savingPkg === pkg.id ? 'Saving…' : '💾 Save Changes'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Store Tab (sub-tabs: Subscriptions + FG Bundles) ─────────────────────
function StoreTab({ token }) {
  const [subTab, setSubTab] = useState('subscriptions');
  const subTabs = [
    { id: 'subscriptions', label: 'Subscriptions' },
    { id: 'fg_bundles', label: 'FG Bundles' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid rgba(212,175,55,0.08)' }}>
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            style={{ padding: '8px 18px', background: 'none', border: 'none', borderBottom: subTab === t.id ? '2px solid ' + G : '2px solid transparent', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: subTab === t.id ? G : 'var(--mt)', cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>
      {subTab === 'subscriptions' && <SubscriptionsTab token={token} />}
      {subTab === 'fg_bundles' && <FGPackagesSubTab token={token} />}
    </div>
  );
}

// ── Subscriptions Tab ─────────────────────────────────────────────────────
const TIER_COLORS = ['#22c55e', '#6b7280', '#D4AF37', '#a855f7', '#f472b6', '#60a5fa', '#f59e0b', '#ef4444'];

const REWARD_CATALOG = [
  { id: 'fg_bonus', name: 'FG Bonus', icon: '\uD83D\uDCB0', unit: 'FG', color: '#facc15' },
  { id: 'xp_boost', name: 'XP Boost', icon: '\u2B50', unit: '%', color: '#a855f7' },
  { id: 'extra_posts', name: 'Extra Posts/day', icon: '\uD83D\uDCDD', unit: 'posts', color: '#60a5fa' },
  { id: 'free_glow', name: 'Free Glow Posts/mo', icon: '\u2728', unit: 'posts', color: '#f472b6' },
  { id: 'escrow_skip', name: 'Escrow Skips/mo', icon: '\uD83D\uDD13', unit: 'skips', color: '#22d3ee' },
  { id: 'raffle_tickets', name: 'Raffle Tickets/mo', icon: '\uD83C\uDFB2', unit: 'tickets', color: '#4ade80' },
  { id: 'name_change', name: 'Free Name Change', icon: '\u270F\uFE0F', unit: '', color: '#f59e0b' },
];

const INITIAL_TIERS = [
  { id: 'free',      name: 'Free',      price: 0,     fg_monthly: 0,    color: '#9ca3af', blurb: '', permissions: {}, rewards: {}, skills: [] },
  { id: 'verified',  name: 'Verified',  price: 2.99,  fg_monthly: 0,    color: '#22c55e', blurb: '', permissions: {}, rewards: {}, skills: [] },
  { id: 'basic',     name: 'Basic',     price: 4.99,  fg_monthly: 0,    color: '#6b7280', blurb: '', permissions: {}, rewards: {}, skills: [] },
  { id: 'premium',   name: 'Premium',   price: 14.99, fg_monthly: 0,    color: '#D4AF37', blurb: '', permissions: {}, rewards: {}, skills: [] },
  { id: 'legendary', name: 'Legendary', price: 49.99, fg_monthly: 0,    color: '#a855f7', blurb: '', permissions: {}, rewards: {}, skills: [] },
];

function SubscriptionsTab({ token }) {
  const [tiers, setTiers] = useState([]);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [tiersError, setTiersError] = useState(null);
  const [skills, setSkills] = useState([]);
  const [editing, setEditing] = useState(null);
  const [expandedSection, setExpandedSection] = useState({}); // { [tierId]: 'skills'|'permissions'|'rewards' }
  const [msg, setMsg] = useState('');
  const [skillConfigs, setSkillConfigs] = useState({});
  const [dirtyTiers, setDirtyTiers] = useState(new Set());
  const [saving, setSaving] = useState(null);

  const markDirty = (tierId) => setDirtyTiers(prev => new Set([...prev, tierId]));
  const markClean = (tierId) => setDirtyTiers(prev => { const n = new Set(prev); n.delete(tierId); return n; });

  const tiersInFlight = useRef(false);

  const loadTiers = useCallback(async () => {
    if (tiersInFlight.current) return; // already loading — don't stack another request
    tiersInFlight.current = true;
    setTiersError(null);
    try {
      // Raw REST fetch — avoids GoTrue auth-mutex hangs (same pattern as useDbPerms)
      const res = await sbFetch('subscription_tiers?select=*&order=sort_order');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error(data?.message || 'Unexpected response');
      setTiers(data.map(t => ({
        ...t,
        fg_monthly: t.fg_monthly || 0,
        // skills column is text[] — elements come back as plain UUID strings.
        // Accept UUID strings directly; also accept {id,config} objects for
        // forward-compat. Drop anything that isn't a valid UUID.
        skills: (t.skills || []).filter(e => {
          const id = typeof e === 'string' ? e : e?.id;
          if (!id || !UUID_RE.test(id)) { console.warn('[loadTiers] dropping non-UUID skill in tier', t.id, e); return false; }
          return true;
        }).map(e => typeof e === 'string' ? e : e.id),
      })));
      // Load skills_config jsonb (per-skill per-tier config). Fall back to legacy
      // {id,config} objects in the skills text[] for older rows.
      const cfgMap = {};
      data.forEach(t => {
        const cfgs = {};
        // Primary: skills_config jsonb column
        if (t.skills_config && typeof t.skills_config === 'object') {
          Object.assign(cfgs, t.skills_config);
        }
        // Legacy fallback: {id,config} objects mixed into skills array
        (t.skills || []).forEach(e => { if (typeof e === 'object' && e?.id && UUID_RE.test(e.id)) cfgs[e.id] = { ...cfgs[e.id], ...e.config }; });
        if (Object.keys(cfgs).length) cfgMap[t.id] = cfgs;
      });
      setSkillConfigs(prev => ({ ...cfgMap, ...prev }));
    } catch (e) {
      setTiersError(e.message || 'Load failed');
    } finally {
      tiersInFlight.current = false;
      setTiersLoading(false);
    }
  }, []);

  useEffect(() => { loadTiers(); }, [loadTiers]);

  useEffect(() => {
    if (token) fetch('/api/admin/skills', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(d => { if (d.skills) setSkills(d.skills); });
  }, [token]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const saveTier = (tierId) => {
    // Read latest state synchronously, then fire async request outside setTiers
    setSaving(tierId);
    setTiers(prev => {
      const tier = prev.find(t => t.id === tierId);
      if (!tier) { setSaving(null); return prev; }
      // skills column is text[] — store plain UUID strings (no config wrapping).
      // Per-tier skill config (tokens, durations, etc) is saved in skills_config jsonb column.
      const skillIds = (tier.skills || []).map(sid => typeof sid === 'string' ? sid : sid?.id).filter(id => id && UUID_RE.test(id));
      if (skillIds.length !== (tier.skills || []).length) {
        console.warn('[saveTier] dropped non-UUID entries before save', tier.skills);
      }
      // Route through admin API (uses adminDb/service-role — bypasses RLS)
      const tierSkillConfigs = skillConfigs[tierId] || {};
      fetch('/api/admin/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          action: 'save_tier',
          tier: {
            id: tierId,
            name: tier.name, price: tier.price, fg_monthly: tier.fg_monthly,
            color: tier.color, blurb: tier.blurb || '',
            image_url: tier.image_url || null,
            permissions: tier.permissions || {}, rewards: tier.rewards || {},
            skills: skillIds, skills_config: tierSkillConfigs,
            sort_order: tier.sort_order ?? 99,
          },
        }),
      }).then(r => r.json()).then(({ tier: data, error }) => {
        setSaving(null);
        if (error) { flash('Save failed: ' + error); return; }
        if (data) {
          setTiers(p => p.map(t => t.id === tierId
            ? { ...data, fg_monthly: data.fg_monthly || 0, skills: (data.skills || []).filter(e => typeof e === 'string' && UUID_RE.test(e)) }
            : t));
          if (data.skills_config) setSkillConfigs(prev => ({ ...prev, [tierId]: data.skills_config }));
        }
        markClean(tierId);
        flash('✓ Saved');
      }).catch(e => { setSaving(null); flash('Save failed: ' + e.message); });
      return prev;
    });
  };

  const updateTier = (id, field, value) => {
    setTiers(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    markDirty(id);
  };

  const updateSkillConfig = (tierId, skillId, field, val) => {
    setSkillConfigs(prev => ({
      ...prev,
      [tierId]: { ...(prev[tierId] || {}), [skillId]: { ...(prev[tierId]?.[skillId] || {}), [field]: val } },
    }));
    markDirty(tierId);
  };

  const toggleSkillForTier = (tierId, skillId) => {
    setTiers(prev => prev.map(t => {
      if (t.id !== tierId) return t;
      const cur = t.skills || [];
      return { ...t, skills: cur.includes(skillId) ? cur.filter(s => s !== skillId) : [...cur, skillId] };
    }));
    markDirty(tierId);
  };

  const updatePermission = (tierId, permId, val) => {
    setTiers(prev => prev.map(t => t.id === tierId ? { ...t, permissions: { ...t.permissions, [permId]: val } } : t));
    markDirty(tierId);
  };

  const updateReward = (tierId, rewardId, val) => {
    setTiers(prev => prev.map(t => t.id === tierId ? { ...t, rewards: { ...t.rewards, [rewardId]: val } } : t));
    markDirty(tierId);
  };

  const toggleSection = (tierId, section) => {
    setExpandedSection(prev => ({ ...prev, [tierId]: prev[tierId] === section ? null : section }));
  };

  const inputStyle = { background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 6, padding: '6px 10px', color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, outline: 'none' };
  const btnStyle = { padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.1)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, textTransform: 'uppercase', cursor: 'pointer', color: G, letterSpacing: '.08em' };

  const addTier = () => {
    const id = 'tier_' + Date.now();
    const colorIdx = tiers.length % TIER_COLORS.length;
    setTiers(prev => [...prev, { id, name: 'New Tier', price: 0, fg_monthly: 0, color: TIER_COLORS[colorIdx], permissions: {}, rewards: {}, skills: [] }]);
    setEditing(id);
  };

  const removeTier = (id) => {
    setTiers(prev => prev.filter(t => t.id !== id));
    if (editing === id) setEditing(null);
    flash('Tier removed');
  };

  // Gather all permissions from Supabase (synced with Permissions tab)
  const { flat: allPerms } = useDbPerms();

  const sectionBtn = (tierId, section, label, color, count) => (
    <button onClick={() => toggleSection(tierId, section)} style={{ flex: '1 1 0', padding: '8px 6px', background: expandedSection[tierId] === section ? color + '15' : 'rgba(0,0,0,0.2)', border: expandedSection[tierId] === section ? `1px solid ${color}40` : '1px solid rgba(255,255,255,0.04)', borderRadius: 8, cursor: 'pointer', textAlign: 'center', transition: 'all .15s' }}>
      <div style={{ fontSize: 8, color: expandedSection[tierId] === section ? color : '#6a6078', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 900, color: expandedSection[tierId] === section ? color : '#4a4058', marginTop: 2 }}>{count}</div>
    </button>
  );

  if (tiersLoading) return <div style={{ textAlign: 'center', padding: 40, color: '#6a6078', fontSize: 11 }}>Loading tiers…</div>;

  return (
    <div>
      {msg && <div style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 16, color: G, fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{msg}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 9, color: '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.15em' }}>Subscription Tiers</div>
        <button onClick={addTier} style={{ ...btnStyle, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}>+ Add Tier</button>
      </div>

      {tiersError && (
        <div style={{ textAlign: 'center', padding: '32px 20px', background: 'rgba(239,68,68,0.04)', border: '1px dashed rgba(239,68,68,0.25)', borderRadius: 12 }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 14, color: '#f87171', marginBottom: 6 }}>Couldn't load tiers</div>
          <div style={{ fontSize: 10, color: '#6a6078', marginBottom: 14 }}>{tiersError}</div>
          <button onClick={loadTiers} style={{ padding: '6px 18px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 11, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.08em' }}>Retry</button>
        </div>
      )}
      {!tiersError && tiers.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(212,175,55,0.15)', borderRadius: 12 }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 16, color: '#4a4058', marginBottom: 8 }}>No subscription tiers yet</div>
          <div style={{ fontSize: 11, color: '#6a6078' }}>Click "+ Add Tier" to create your first subscription package.</div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        {tiers.map(tier => {
          const tierPerms = tier.permissions || {};
          const tierSkillIds = tier.skills || [];
          const badgeIds = tierSkillIds.filter(sid => skills.find(s => s.id === sid)?.type === 'badge');
          const rewardIds = tierSkillIds.filter(sid => { const s = skills.find(sk => sk.id === sid); return s && REWARD_TYPE_IDS.has(s.type); });
          const functionalSkillIds = tierSkillIds.filter(sid => { const s = skills.find(sk => sk.id === sid); return s && s.type !== 'badge' && !REWARD_TYPE_IDS.has(s.type); });
          const activePerms = Object.values(tierPerms).filter(v => v && v !== '0' && v !== '\u2014').length;
          const expanded = expandedSection[tier.id];
          const isDirty = dirtyTiers.has(tier.id);

          return (
            <div key={tier.id} style={{ background: 'rgba(212,175,55,0.03)', border: `1px solid ${isDirty ? 'rgba(245,158,11,0.35)' : tier.color + '30'}`, borderRadius: 12, padding: 16 }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: tier.color }} />
                  {editing === tier.id ? (
                    <input value={tier.name} onChange={e => updateTier(tier.id, 'name', e.target.value)} style={{ ...inputStyle, width: 120, fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 14 }} />
                  ) : (
                    <span style={{ fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 14, color: tier.color }}>{tier.name}</span>
                  )}
                  {isDirty && <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700, letterSpacing: '.04em' }}>● unsaved</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEditing(editing === tier.id ? null : tier.id)} style={btnStyle}>
                    {editing === tier.id ? 'Done' : 'Edit'}
                  </button>
                  {editing === tier.id && (
                    <button onClick={() => removeTier(tier.id)} style={{ ...btnStyle, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>Delete</button>
                  )}
                </div>
              </div>

              {/* Blurb / description + image upload */}
              {editing === tier.id && (
                <div style={{ marginBottom: 10, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <AdminImageUpload
                    currentUrl={tier.image_url || null}
                    onUpload={(url) => updateTier(tier.id, 'image_url', url)}
                    token={token}
                    bucket="assets"
                    path={`tiers/${tier.id}`}
                    label="Badge Image"
                    size={70}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4 }}>Tier Description / Blurb</div>
                    <input value={tier.blurb || ''} onChange={e => updateTier(tier.id, 'blurb', e.target.value)} placeholder="e.g. For serious traders who want the best perks" style={{ ...inputStyle, width: '100%', fontSize: 11 }} />
                  </div>
                </div>
              )}
              {!editing && tier.blurb && (
                <div style={{ fontSize: 10, color: '#6a6078', marginBottom: 10, fontStyle: 'italic' }}>{tier.blurb}</div>
              )}

              {/* Price / FG row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4 }}>Monthly Price</div>
                  {editing === tier.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#6a6078', fontSize: 12 }}>$</span>
                      <input type="number" step="0.01" value={tier.price} onChange={e => updateTier(tier.id, 'price', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, width: 60, fontSize: 14, fontWeight: 900 }} />
                    </div>
                  ) : (
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#e8e0f0' }}>{tier.price === 0 ? 'Free' : '$' + tier.price}</div>
                  )}
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4 }}>FG / Month</div>
                  {editing === tier.id ? (
                    <input type="number" value={tier.fg_monthly} onChange={e => updateTier(tier.id, 'fg_monthly', parseInt(e.target.value) || 0)} style={{ ...inputStyle, width: 70, fontSize: 14, fontWeight: 900 }} />
                  ) : (
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#facc15' }}>{tier.fg_monthly.toLocaleString()}</div>
                  )}
                </div>
              </div>

              {/* Section toggle buttons: Badges | Permissions | Skills */}
              <div style={{ display: 'flex', gap: 6, marginBottom: expanded ? 12 : 0 }}>
                {sectionBtn(tier.id, 'badges', 'Badges', '#22c55e', badgeIds.length)}
                {sectionBtn(tier.id, 'permissions', 'Permissions', '#4ade80', activePerms)}
                {sectionBtn(tier.id, 'skills', 'Skills', '#a855f7', functionalSkillIds.length)}
                {sectionBtn(tier.id, 'rewards', 'Rewards', '#facc15', rewardIds.length)}
              </div>

              {/* ── BADGES PANEL (badge-type skills only) ── */}
              {expanded === 'badges' && (() => {
                const activeBadges = skills.filter(s => s.active && s.type === 'badge');
                const assignedBadgeIds = badgeIds.map(e => (typeof e === 'string' ? e : e.id));
                const unassignedBadges = activeBadges.filter(s => !assignedBadgeIds.includes(s.id));
                return (
                  <div style={{ padding: '10px 12px', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 8 }}>
                    <div style={{ fontSize: 9, color: '#22c55e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>Badges for this tier — auto-applies with subscription</div>
                    {activeBadges.length === 0 && <div style={{ fontSize: 10, color: '#6a6078' }}>No badges defined. Create badge-type skills in Features → Badges first.</div>}
                    {assignedBadgeIds.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {assignedBadgeIds.map(sid => {
                          const s = skills.find(sk => sk.id === sid);
                          if (!s) return null;
                          return (
                            <div key={sid} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, padding: '4px 10px' }}>
                              <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif" }}>{s.name}</span>
                              <button onClick={() => toggleSkillForTier(tier.id, sid)} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 10, cursor: 'pointer', padding: 0 }}>✕</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {unassignedBadges.length > 0 && (
                      <div>
                        <div style={{ fontSize: 8, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Add badge:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {unassignedBadges.map(s => (
                            <button key={s.id} onClick={() => toggleSkillForTier(tier.id, s.id)}
                              style={{ padding: '3px 10px', borderRadius: 12, border: '1px solid rgba(34,197,94,0.3)', background: 'transparent', color: '#22c55eaa', fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif" }}>
                              + {s.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── SKILLS PANEL (non-badge: Avatar Glow, Post Glow, Priority Listing, etc.) ── */}
              {expanded === 'skills' && (() => {
                const activeFuncSkills = skills.filter(s => s.active && s.type !== 'badge' && !REWARD_TYPE_IDS.has(s.type));
                const assignedFuncIds = functionalSkillIds.map(e => (typeof e === 'string' ? e : e.id));
                const unassignedFuncs = activeFuncSkills.filter(s => !assignedFuncIds.includes(s.id));
                return (
                  <div style={{ padding: '10px 12px', background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.15)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <div style={{ fontSize: 9, color: '#a855f7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em' }}>Skills for this tier — configure each assignment</div>
                    </div>
                    {activeFuncSkills.length === 0 && <div style={{ fontSize: 10, color: '#6a6078' }}>No skills defined. Create them in Features → Skills first.</div>}
                    {assignedFuncIds.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                        {assignedFuncIds.map(sid => {
                          const s = skills.find(sk => sk.id === sid);
                          if (!s) return null;
                          const tc = TYPE_COLORS[s.type] || '#6b7280';
                          const fields = s.dials?.fields || [];
                          const cfg = skillConfigs[tier.id]?.[sid] || {};
                          return (
                            <div key={sid} style={{ background: tc + '0a', border: `1px solid ${tc}25`, borderRadius: 8, padding: '8px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: fields.length ? 8 : 0 }}>
                                <span style={{ color: tc, fontWeight: 700, fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif" }}>{s.name}</span>
                                <button onClick={() => toggleSkillForTier(tier.id, sid)} style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 4, padding: '2px 8px', color: '#f87171', fontSize: 8, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
                              </div>
                              {fields.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
                                  {fields.map(f => (
                                    <div key={f.key}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                                        <div style={{ fontSize: 7, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase' }}>{f.label}</div>
                                      </div>
                                      <SkillFieldInput f={f} value={cfg[f.key] ?? ''} tc={tc} onChange={(key, val) => updateSkillConfig(tier.id, sid, key, val)} />
                                    </div>
                                  ))}
                                </div>
                              )}
                              {fields.length === 0 && (
                                <div style={{ fontSize: 9, color: '#6a6078' }}>Auto-applies with tier — set dials in Catalogue to add config fields.</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {unassignedFuncs.length > 0 && (
                      <div>
                        <div style={{ fontSize: 8, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Add a skill:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {unassignedFuncs.map(s => {
                            const tc = TYPE_COLORS[s.type] || '#6b7280';
                            return (
                              <button key={s.id} onClick={() => toggleSkillForTier(tier.id, s.id)}
                                style={{ padding: '3px 10px', borderRadius: 12, border: `1px solid ${tc}30`, background: 'transparent', color: tc + 'aa', fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif" }}>
                                + {s.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── REWARDS PANEL (reward-type skills: fg_bonus, xp_boost, etc.) ── */}
              {expanded === 'rewards' && (() => {
                const activeRewards = skills.filter(s => s.active && REWARD_TYPE_IDS.has(s.type));
                const assignedRewardIds = rewardIds.map(e => (typeof e === 'string' ? e : e.id));
                const unassignedRewards = activeRewards.filter(s => !assignedRewardIds.includes(s.id));
                return (
                  <div style={{ padding: '10px 12px', background: 'rgba(250,204,21,0.04)', border: '1px solid rgba(250,204,21,0.15)', borderRadius: 8 }}>
                    <div style={{ fontSize: 9, color: '#facc15', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>Rewards for this tier — auto-applies with subscription</div>
                    {activeRewards.length === 0 && <div style={{ fontSize: 10, color: '#6a6078' }}>No rewards defined. Create reward-type skills in Features → Rewards first.</div>}
                    {assignedRewardIds.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {assignedRewardIds.map(sid => {
                          const s = skills.find(sk => sk.id === sid);
                          if (!s) return null;
                          return (
                            <div key={sid} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.2)', borderRadius: 6, padding: '4px 10px' }}>
                              <span style={{ color: '#facc15', fontWeight: 700, fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif" }}>{s.name}</span>
                              <button onClick={() => toggleSkillForTier(tier.id, sid)} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 10, cursor: 'pointer', padding: 0 }}>✕</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {unassignedRewards.length > 0 && (
                      <div>
                        <div style={{ fontSize: 8, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Add reward:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {unassignedRewards.map(s => (
                            <button key={s.id} onClick={() => toggleSkillForTier(tier.id, s.id)}
                              style={{ padding: '3px 10px', borderRadius: 12, border: '1px solid rgba(250,204,21,0.3)', background: 'transparent', color: '#facc15aa', fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif" }}>
                              + {s.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── PERMISSIONS PANEL ── */}
              {expanded === 'permissions' && (
                <div style={{ padding: '10px 12px', background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, color: '#4ade80', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10 }}>Set permission values for this tier</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {allPerms.map(p => {
                      const val = tierPerms[p.id] ?? '';
                      return (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.groupColor, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0, fontSize: 10, color: '#e8e0f0', fontWeight: 600 }}>{p.name}</div>
                          {p.hasValue ? (
                            <input value={val} placeholder={p.defaults[tier.id] ?? '0'} onChange={e => updatePermission(tier.id, p.id, e.target.value)}
                              style={{ background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 4, padding: '3px 8px', color: '#4ade80', fontSize: 11, fontWeight: 900, outline: 'none', width: 60, textAlign: 'center', fontFamily: "'Barlow Condensed',sans-serif" }} />
                          ) : (
                            <button onClick={() => updatePermission(tier.id, p.id, val === '\u2713' ? '' : '\u2713')}
                              style={{ width: 32, height: 24, borderRadius: 4, border: val === '\u2713' ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,255,255,0.08)', background: val === '\u2713' ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.03)', color: val === '\u2713' ? '#4ade80' : '#3a3048', fontSize: 12, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {val === '\u2713' ? '\u2713' : '\u2014'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Summary chips when collapsed */}
              {!expanded && (tierSkillIds.length > 0 || activePerms > 0) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 8 }}>
                  {tierSkillIds.map(sid => {
                    const s = skills.find(sk => sk.id === sid);
                    if (!s) return null;
                    const tc = TYPE_COLORS[s.type] || '#6b7280';
                    return <span key={sid} style={{ background: tc + '18', color: tc, padding: '1px 8px', borderRadius: 4, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>{s.name}</span>;
                  })}
                  {Object.entries(tierPerms).filter(([, v]) => v && v !== '0' && v !== '\u2014').map(([k, v]) => {
                    const p = allPerms.find(pp => pp.id === k);
                    return p ? <span key={k} style={{ background: 'rgba(74,222,128,0.08)', color: '#4ade80', padding: '1px 8px', borderRadius: 4, fontSize: 8, fontWeight: 700 }}>{p.name}: {v}</span> : null;
                  })}
                </div>
              )}

              {/* Save button — only when dirty */}
              {isDirty && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(245,158,11,0.2)' }}>
                  <button
                    onClick={() => saveTier(tier.id)}
                    disabled={saving === tier.id}
                    style={{ width: '100%', padding: '10px', background: saving === tier.id ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 8, color: '#f59e0b', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', cursor: saving === tier.id ? 'not-allowed' : 'pointer' }}
                  >
                    {saving === tier.id ? 'Saving…' : '💾 Save Changes'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Quests Tab ────────────────────────────────────────────────────────────
const QUEST_TYPES = [
  { id: 'daily',    label: 'Daily',    color: '#4ade80' },
  { id: 'weekly',   label: 'Weekly',   color: '#60a5fa' },
  { id: 'seasonal', label: 'Seasonal', color: '#a855f7' },
  { id: 'one_time', label: 'One-Time', color: '#f59e0b' },
];

const QUEST_WIRED = {
  // Quest type tracking
  daily:    { status: 'red', note: 'No cron/reset logic. Need daily quest reset + progress tracking.' },
  weekly:   { status: 'red', note: 'No cron/reset logic. Need weekly quest reset + progress tracking.' },
  seasonal: { status: 'red', note: 'No season system. Need season dates + quest progress tracking.' },
  one_time: { status: 'red', note: 'No completion tracking. Need user_quests table + completion check.' },
};

const REQUIREMENT_TYPES = [
  { id: 'sell_items',      label: 'Sell Items',       unit: 'items',     placeholder: '5',   wired: 'yellow', note: 'Escrow completion tracked but not wired to quest progress.' },
  { id: 'buy_items',       label: 'Buy Items',        unit: 'items',     placeholder: '3',   wired: 'yellow', note: 'Escrow completion tracked but not wired to quest progress.' },
  { id: 'complete_trades', label: 'Complete Trades',   unit: 'trades',    placeholder: '10',  wired: 'yellow', note: 'Escrow close events exist but not wired to quest progress.' },
  { id: 'earn_fg',         label: 'Earn FG',           unit: 'FG',        placeholder: '500', wired: 'yellow', note: 'fg_balance tracked in users table, but no delta event for quests.' },
  { id: 'spend_fg',        label: 'Spend FG',          unit: 'FG',        placeholder: '200', wired: 'red',    note: 'No spend tracking. FG deductions happen but no event emitted.' },
  { id: 'reach_rank',      label: 'Reach Rank',        unit: 'rank',      placeholder: '5',   wired: 'green',  note: 'Rank calculated from rankEngine. Can check on quest eval.' },
  { id: 'leave_reviews',   label: 'Leave Reviews',     unit: 'reviews',   placeholder: '3',   wired: 'yellow', note: 'Reviews table exists but no insert event for quest tracking.' },
  { id: 'refer_users',     label: 'Refer Users',       unit: 'users',     placeholder: '1',   wired: 'yellow', note: 'Referral system exists, referral_count tracked. Not wired to quests.' },
  { id: 'login_streak',    label: 'Login Streak',      unit: 'days',      placeholder: '7',   wired: 'red',    note: 'No login streak tracking. Need last_login + streak counter.' },
  { id: 'list_items',      label: 'List Items',        unit: 'listings',  placeholder: '5',   wired: 'yellow', note: 'Thread creation exists but no event emitted for quest tracking.' },
  { id: 'use_escrow',      label: 'Use Escrow',        unit: 'times',     placeholder: '3',   wired: 'yellow', note: 'Escrow table exists. Need insert trigger for quest progress.' },
  { id: 'send_messages',   label: 'Send Messages',     unit: 'messages',  placeholder: '10',  wired: 'red',    note: 'Messages table exists but no counter per user per period.' },
  { id: 'kill_forum_troll', label: 'Kill Forum Troll',  unit: 'trolls',    placeholder: '1',   wired: 'red',    note: 'Need troll encounter system — spawn trolls on flagged posts, user clicks to slay.' },
  { id: 'trigger_forum_troll', label: 'Trigger Forum Troll', unit: 'spawns', placeholder: '1',  wired: 'red',    note: 'Admin/gem spawns a troll encounter. Need gem button hook + troll spawn endpoint.' },
];

const REWARD_TYPES = [
  { id: 'fg',         label: 'Forum Gold',     color: '#facc15', placeholder: '100',           wired: 'green',  note: 'Credits fg_balance via API. Exists in DB.' },
  { id: 'xp',         label: 'XP',             color: '#D4AF37', placeholder: '50',            wired: 'green',  note: 'XP field exists in users table. Exists in DB.' },
  { id: 'skill',      label: 'Skill Unlock',   color: '#a855f7', placeholder: 'skill name',    wired: 'green',  note: 'user_skills table exists. Can assign via API.' },
  { id: 'badge',      label: 'Badge',          color: '#22c55e', placeholder: 'badge name',    wired: 'green',  note: 'Badge system exists. Can assign via API.' },
  { id: 'glow',       label: 'Post Glow',      color: '#f472b6', placeholder: 'duration (hrs)', wired: 'green',  note: 'Post glow works via API.' },
  { id: 'title',      label: 'Custom Title',   color: '#60a5fa', placeholder: 'title text',    wired: 'red',    note: 'No title rendering code. Need profile title display.' },
  { id: 'trade_slots',label: 'Trade Slots',    color: '#f59e0b', placeholder: '5',             wired: 'red',    note: 'Trade limits use tier system. No per-user slot override.' },
];

const questInputStyle = { background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 6, padding: '6px 10px', color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, outline: 'none', width: '100%' };

function QuestWireDot({ status, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} title={note || ''}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: WIRED_COLORS[status] || WIRED_COLORS.red, boxShadow: `0 0 4px ${WIRED_COLORS[status] || WIRED_COLORS.red}50`, flexShrink: 0 }} />
      <span style={{ fontSize: 7, color: WIRED_COLORS[status] || WIRED_COLORS.red, fontWeight: 700, textTransform: 'uppercase' }}>{WIRED_LABELS[status] || 'N/A'}</span>
    </div>
  );
}

function QuestReqRow({ req, idx, onUpdate, onRemove, editable = true }) {
  const rt = REQUIREMENT_TYPES.find(r => r.id === req.type);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '3px 0' }}>
      <QuestWireDot status={rt?.wired} note={rt?.note} />
      {editable ? (
        <>
          <select value={req.type} onChange={e => onUpdate(idx, 'type', e.target.value)} style={{ ...questInputStyle, width: 'auto', flex: 1, cursor: 'pointer', fontSize: 10, padding: '4px 6px' }}>
            {REQUIREMENT_TYPES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <input type="number" value={req.value} onChange={e => onUpdate(idx, 'value', e.target.value)} placeholder={rt?.placeholder || '0'} style={{ ...questInputStyle, width: 60, textAlign: 'center', fontSize: 10, padding: '4px 6px' }} />
          <span style={{ fontSize: 8, color: '#6a6078', minWidth: 30 }}>{rt?.unit || ''}</span>
          <button onClick={() => onRemove(idx)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 11, padding: '0 3px' }}>✕</button>
        </>
      ) : (
        <>
          <span style={{ fontSize: 10, color: '#9a8eb0', flex: 1 }}>{rt?.label || req.type}</span>
          <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 900 }}>{req.value} {rt?.unit || ''}</span>
        </>
      )}
    </div>
  );
}

function QuestRewRow({ rew, idx, onUpdate, onRemove, editable = true, skills = [] }) {
  // Resolve reward type from REWARD_TYPES (core) or live skills catalog
  const coreType = REWARD_TYPES.find(r => r.id === rew.type);
  const catalogSkill = !coreType ? skills.find(s => s.id === rew.type) : null;
  const rt = coreType || (catalogSkill ? {
    id: catalogSkill.id, label: catalogSkill.name,
    color: TYPE_COLORS[catalogSkill.type] || '#a855f7',
    wired: catalogSkill.active ? 'green' : 'yellow',
    note: catalogSkill.description || catalogSkill.type,
    placeholder: '',
  } : null);
  const isSkill = rew.type === 'skill';  // legacy picker
  const isBadge = rew.type === 'badge';  // legacy picker
  const funcSkills = skills.filter(s => s.type !== 'badge');
  const badgeSkills = skills.filter(s => s.type === 'badge');
  // dials.fields from catalogue skill (non-badge catalogue items only)
  const dialFields = (catalogSkill && catalogSkill.type !== 'badge') ? (catalogSkill.dials?.fields || []) : [];
  const tc = catalogSkill ? (TYPE_COLORS[catalogSkill.type] || '#a855f7') : '#22c55e';
  const rewConfig = rew.config || {};
  return (
    <div style={{ padding: '3px 0' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <QuestWireDot status={rt?.wired} note={rt?.note} />
        {editable ? (
          <>
            <select value={rew.type} onChange={e => onUpdate(idx, 'type', e.target.value)} style={{ ...questInputStyle, width: 'auto', flex: 1, cursor: 'pointer', fontSize: 10, padding: '4px 6px' }}>
              <optgroup label="Core">
                {REWARD_TYPES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </optgroup>
              {funcSkills.length > 0 && (
                <optgroup label="Skills">
                  {funcSkills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>
              )}
              {badgeSkills.length > 0 && (
                <optgroup label="Badges">
                  {badgeSkills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>
              )}
            </select>
            {isSkill ? (
              <select value={rew.value} onChange={e => onUpdate(idx, 'value', e.target.value)} style={{ ...questInputStyle, width: 110, cursor: 'pointer', fontSize: 10, padding: '4px 6px' }}>
                <option value="">— pick skill —</option>
                {funcSkills.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            ) : isBadge ? (
              <select value={rew.value} onChange={e => onUpdate(idx, 'value', e.target.value)} style={{ ...questInputStyle, width: 110, cursor: 'pointer', fontSize: 10, padding: '4px 6px' }}>
                <option value="">— pick badge —</option>
                {badgeSkills.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            ) : catalogSkill ? null : (
              <input value={rew.value} onChange={e => onUpdate(idx, 'value', e.target.value)} placeholder={rt?.placeholder || ''} style={{ ...questInputStyle, width: 80, textAlign: 'center', fontSize: 10, padding: '4px 6px' }} />
            )}
            <button onClick={() => onRemove(idx)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 11, padding: '0 3px' }}>✕</button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 10, color: '#9a8eb0', flex: 1 }}>{rt?.label || rew.type}</span>
            <span style={{ fontSize: 10, color: rt?.color || '#22c55e', fontWeight: 900 }}>{rew.value}</span>
          </>
        )}
      </div>
      {/* dials.fields config inputs — same pattern as RanksTab attachment cards */}
      {editable && dialFields.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6, paddingLeft: 14, paddingBottom: 2 }}>
          {dialFields.map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 7, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{f.label}</div>
              <SkillFieldInput f={f} value={rewConfig[f.key] ?? ''} tc={tc}
                onChange={(key, val) => onUpdate(idx, 'config', { ...rewConfig, [key]: val })} />
            </div>
          ))}
        </div>
      )}
      {editable && catalogSkill && catalogSkill.type !== 'badge' && dialFields.length === 0 && (
        <div style={{ fontSize: 9, color: '#4a4058', paddingLeft: 14, marginTop: 3 }}>Auto-grants — no extra config needed.</div>
      )}
    </div>
  );
}

function QuestsPanel({ token, skills = [] }) {
  const [quests, setQuests] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [dbAvailable, setDbAvailable] = useState(true);
  const [availableTriggers, setAvailableTriggers] = useState([]);

  const qApi = async (method, body) => {
    const opts = { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch('/api/admin/quests', opts);
    return r.json();
  };

  // Load from DB on mount; fall back to localStorage if table not ready
  useEffect(() => {
    (async () => {
      try {
        const res = await qApi('GET');
        if (res.quests) {
          setQuests(res.quests);
          setDbAvailable(true);
          // Migrate localStorage quests to DB if any exist
          try {
            const stored = localStorage.getItem('d4jsp_admin_quests');
            if (stored) {
              const local = JSON.parse(stored);
              if (local.length > 0 && res.quests.length === 0) {
                // Migrate old localStorage quests to DB
                for (const q of local) {
                  await qApi('POST', { action: 'create_quest', name: q.name, description: q.description, type: q.type, requirements: q.requirements || [], rewards: q.rewards || [], active: q.active !== false });
                }
                const migrated = await qApi('GET');
                if (migrated.quests) setQuests(migrated.quests);
                localStorage.removeItem('d4jsp_admin_quests');
              }
            }
          } catch {}
        } else {
          // Table probably doesn't exist yet — fall back to localStorage
          setDbAvailable(false);
          try {
            const stored = localStorage.getItem('d4jsp_admin_quests');
            if (stored) setQuests(JSON.parse(stored));
          } catch {}
        }
      } catch {
        setDbAvailable(false);
        try {
          const stored = localStorage.getItem('d4jsp_admin_quests');
          if (stored) setQuests(JSON.parse(stored));
        } catch {}
      }
      setLoading(false);
      // Load available triggers for trigger_id picker
      try {
        const tr = await fetch('/api/admin/specials?view=triggers', { headers: { Authorization: 'Bearer ' + token } });
        const tj = await tr.json();
        if (tj.triggers) setAvailableTriggers(tj.triggers);
      } catch {}
    })();
  }, []);

  // localStorage fallback persistence when DB not available
  useEffect(() => {
    if (!dbAvailable) {
      try { localStorage.setItem('d4jsp_admin_quests', JSON.stringify(quests)); } catch {}
    }
  }, [quests, dbAvailable]);

  // New quest form state
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState('daily');
  const [newRequirements, setNewRequirements] = useState([]);
  const [newRewards, setNewRewards] = useState([]);
  const [newActive, setNewActive] = useState(true);
  const [newIcon, setNewIcon] = useState('');
  const [newCompletionText, setNewCompletionText] = useState('');
  const [newRankRequired, setNewRankRequired] = useState('');

  const btnStyle = { padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.1)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, textTransform: 'uppercase', cursor: 'pointer', color: G, letterSpacing: '.08em' };

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  // Requirement helpers (shared between create form and edit mode)
  const addReqTo = (setter) => setter(prev => [...prev, { type: 'sell_items', value: '' }]);
  const updateReqIn = (setter, idx, field, val) => setter(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  const removeReqFrom = (setter, idx) => setter(prev => prev.filter((_, i) => i !== idx));

  const addRewTo = (setter) => setter(prev => [...prev, { type: 'fg', value: '' }]);
  const updateRewIn = (setter, idx, field, val) => setter(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  const removeRewFrom = (setter, idx) => setter(prev => prev.filter((_, i) => i !== idx));

  const createQuest = async () => {
    if (!newName.trim()) return flash('Quest name required');
    const extraFields = {
      icon: newIcon || null,
      completion_text: newCompletionText || null,
      rank_required: newRankRequired ? Number(newRankRequired) : null,
    };
    if (dbAvailable) {
      const res = await qApi('POST', { action: 'create_quest', name: newName.trim(), description: newDesc.trim(), type: newType, requirements: newRequirements.filter(r => r.value), rewards: newRewards.filter(r => r.value), active: newActive, ...extraFields });
      if (res.error) return flash('Error: ' + res.error);
      setQuests(prev => [res.quest, ...prev]);
    } else {
      const quest = { id: 'quest_' + Date.now(), name: newName.trim(), description: newDesc.trim(), type: newType, requirements: newRequirements.filter(r => r.value), rewards: newRewards.filter(r => r.value), active: newActive, created_at: new Date().toISOString(), completions: 0, ...extraFields };
      setQuests(prev => [quest, ...prev]);
    }
    flash('Quest created: ' + newName.trim());
    resetForm();
  };

  const resetForm = () => {
    setNewName(''); setNewDesc(''); setNewType('daily');
    setNewRequirements([]); setNewRewards([]); setNewActive(true);
    setNewIcon(''); setNewCompletionText(''); setNewRankRequired('');
    setCreating(false);
  };

  const deleteQuest = async (id) => {
    if (dbAvailable) {
      const res = await qApi('POST', { action: 'delete_quest', id });
      if (res.error) return flash('Error: ' + res.error);
    }
    setQuests(prev => prev.filter(q => q.id !== id));
    if (editing === id) setEditing(null);
    flash('Quest deleted');
  };

  const toggleActive = async (id) => {
    const q = quests.find(q => q.id === id);
    if (!q) return;
    if (dbAvailable) {
      await qApi('POST', { action: 'update_quest', id, active: !q.active });
    }
    setQuests(prev => prev.map(q => q.id === id ? { ...q, active: !q.active } : q));
  };

  const saveQuest = async (id) => {
    const q = quests.find(q => q.id === id);
    if (!q) return;
    if (dbAvailable) {
      const res = await qApi('POST', { action: 'update_quest', id, name: q.name, description: q.description, type: q.type, requirements: q.requirements, rewards: q.rewards, active: q.active, trigger_id: q.trigger_id || null, config: q.config || {} });
      if (res.error) return flash('Error: ' + res.error);
    }
    flash('Quest saved');
    setEditing(null);
  };

  const updateQuest = (id, field, val) => {
    setQuests(prev => prev.map(q => q.id === id ? { ...q, [field]: val } : q));
  };

  const updateQuestReqs = (id) => (fn) => {
    setQuests(prev => prev.map(q => q.id === id ? { ...q, requirements: typeof fn === 'function' ? fn(q.requirements || []) : fn } : q));
  };

  const updateQuestRews = (id) => (fn) => {
    setQuests(prev => prev.map(q => q.id === id ? { ...q, rewards: typeof fn === 'function' ? fn(q.rewards || []) : fn } : q));
  };

  const filtered = filterType === 'all' ? quests : quests.filter(q => q.type === filterType);

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><div className="spin" style={{ margin: '0 auto' }} /></div>;

  return (
    <div>
      {msg && <div style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 16, color: G, fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{msg}</div>}
      {!dbAvailable && <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 12, color: '#f59e0b', fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>⚠ quests table not found — storing locally. Run migration in Supabase SQL editor to persist to DB.</div>}

      {/* Header + filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 9, color: '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.15em' }}>{quests.length} Quests</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button onClick={() => setFilterType('all')} style={{ ...btnStyle, fontSize: 8, padding: '2px 8px', background: filterType === 'all' ? 'rgba(212,175,55,0.2)' : 'transparent', border: filterType === 'all' ? '1px solid rgba(212,175,55,0.4)' : '1px solid rgba(255,255,255,0.06)' }}>All</button>
            {QUEST_TYPES.map(qt => (
              <button key={qt.id} onClick={() => setFilterType(qt.id)} style={{ ...btnStyle, fontSize: 8, padding: '2px 8px', color: filterType === qt.id ? qt.color : '#6a6078', background: filterType === qt.id ? qt.color + '20' : 'transparent', border: `1px solid ${filterType === qt.id ? qt.color + '40' : 'rgba(255,255,255,0.06)'}` }}>{qt.label}</button>
            ))}
          </div>
        </div>
        <button onClick={() => { setCreating(!creating); if (creating) resetForm(); }} style={{ ...btnStyle, background: creating ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', border: creating ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(34,197,94,0.3)', color: creating ? '#ef4444' : '#22c55e' }}>
          {creating ? 'Cancel' : '+ New Quest'}
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div style={{ background: 'rgba(212,175,55,0.03)', border: '1px solid rgba(212,175,55,0.12)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div className="cinzel" style={{ fontSize: 13, color: G, letterSpacing: 1, marginBottom: 14 }}>Create Quest</div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4 }}>Quest Name</div>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. First Blood" style={questInputStyle} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em' }}>Type</div>
                <QuestWireDot status={QUEST_WIRED[newType]?.status} note={QUEST_WIRED[newType]?.note} />
              </div>
              <select value={newType} onChange={e => setNewType(e.target.value)} style={{ ...questInputStyle, cursor: 'pointer' }}>
                {QUEST_TYPES.map(qt => <option key={qt.id} value={qt.id}>{qt.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4 }}>Description</div>
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What the player needs to do..." style={questInputStyle} />
          </div>

          {/* Requirements */}
          <div style={{ marginBottom: 14, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: '#f59e0b', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em' }}>Requirements</div>
              <button onClick={() => addReqTo(setNewRequirements)} style={{ ...btnStyle, fontSize: 8, padding: '2px 8px' }}>+ Add</button>
            </div>
            {newRequirements.length === 0 && <div style={{ fontSize: 10, color: '#4a4058', fontStyle: 'italic' }}>No requirements — click Add</div>}
            {newRequirements.map((req, idx) => (
              <QuestReqRow key={idx} req={req} idx={idx}
                onUpdate={(i, f, v) => updateReqIn(setNewRequirements, i, f, v)}
                onRemove={(i) => removeReqFrom(setNewRequirements, i)} />
            ))}
          </div>

          {/* Rewards */}
          <div style={{ marginBottom: 14, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.1)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: '#22c55e', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em' }}>Rewards</div>
              <button onClick={() => addRewTo(setNewRewards)} style={{ ...btnStyle, fontSize: 8, padding: '2px 8px' }}>+ Add</button>
            </div>
            {newRewards.length === 0 && <div style={{ fontSize: 10, color: '#4a4058', fontStyle: 'italic' }}>No rewards — click Add</div>}
            {newRewards.map((rew, idx) => (
              <QuestRewRow key={idx} rew={rew} idx={idx} skills={skills}
                onUpdate={(i, f, v) => updateRewIn(setNewRewards, i, f, v)}
                onRemove={(i) => removeRewFrom(setNewRewards, i)} />
            ))}
          </div>

          {/* Extra fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4 }}>Min Rank Required</div>
              <input type="number" value={newRankRequired} onChange={e => setNewRankRequired(e.target.value)} placeholder="any" style={questInputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4 }}>Icon (emoji)</div>
              <input value={newIcon} onChange={e => setNewIcon(e.target.value)} placeholder="⚔️" style={questInputStyle} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4 }}>Completion Text</div>
              <input value={newCompletionText} onChange={e => setNewCompletionText(e.target.value)} placeholder="You completed your first trade!" style={questInputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={createQuest} style={{ ...btnStyle, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', padding: '6px 16px' }}>Create Quest</button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 10, color: '#6a6078' }}>
              <input type="checkbox" checked={newActive} onChange={e => setNewActive(e.target.checked)} style={{ accentColor: G }} />
              Active on create
            </label>
          </div>
        </div>
      )}

      {/* Quest list */}
      {filtered.length === 0 && !creating && (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(212,175,55,0.15)', borderRadius: 12 }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 16, color: '#4a4058', marginBottom: 8 }}>{quests.length === 0 ? 'No quests yet' : 'No matching quests'}</div>
          <div style={{ fontSize: 11, color: '#6a6078' }}>{quests.length === 0 ? 'Click "+ New Quest" to create your first quest.' : 'Try a different filter.'}</div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {filtered.map(quest => {
          const qt = QUEST_TYPES.find(t => t.id === quest.type);
          const isEdit = editing === quest.id;
          const qw = QUEST_WIRED[quest.type];
          return (
            <div key={quest.id} style={{ background: 'rgba(212,175,55,0.03)', border: `1px solid ${quest.active ? (qt?.color || G) + '25' : 'rgba(255,255,255,0.04)'}`, borderRadius: 12, padding: 16, opacity: quest.active ? 1 : 0.6 }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ background: (qt?.color || '#6b7280') + '20', color: qt?.color || '#6b7280', padding: '2px 8px', borderRadius: 4, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>{qt?.label || quest.type}</span>
                    <QuestWireDot status={qw?.status} note={qw?.note} />
                    {!quest.active && <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '2px 6px', borderRadius: 4, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>Inactive</span>}
                  </div>
                  {isEdit ? (
                    <input value={quest.name} onChange={e => updateQuest(quest.id, 'name', e.target.value)} style={{ ...questInputStyle, fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 14, width: '100%', background: 'rgba(10,8,12,0.8)' }} />
                  ) : (
                    <div style={{ fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 14, color: '#e8e0f0' }}>{quest.name}</div>
                  )}
                  {isEdit ? (
                    <input value={quest.description} onChange={e => updateQuest(quest.id, 'description', e.target.value)} style={{ ...questInputStyle, marginTop: 4, fontSize: 10 }} placeholder="Quest description..." />
                  ) : (
                    quest.description && <div style={{ fontSize: 10, color: '#6a6078', marginTop: 2 }}>{quest.description}</div>
                  )}
                  {isEdit && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 2 }}>Type</div>
                      <select value={quest.type} onChange={e => updateQuest(quest.id, 'type', e.target.value)} style={{ ...questInputStyle, width: 'auto', cursor: 'pointer', fontSize: 10, padding: '4px 8px' }}>
                        {QUEST_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, marginLeft: 8, flexShrink: 0 }}>
                  <button onClick={() => toggleActive(quest.id)} style={{ ...btnStyle, fontSize: 8, padding: '2px 6px' }}>{quest.active ? 'Off' : 'On'}</button>
                  {isEdit
                    ? <button onClick={() => saveQuest(quest.id)} style={{ ...btnStyle, fontSize: 8, padding: '2px 6px', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.1)' }}>Save</button>
                    : <button onClick={() => setEditing(quest.id)} style={{ ...btnStyle, fontSize: 8, padding: '2px 6px' }}>Edit</button>}
                  <button onClick={() => deleteQuest(quest.id)} style={{ ...btnStyle, fontSize: 8, padding: '2px 6px', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)' }}>✕</button>
                </div>
              </div>

              {/* Requirements + Rewards side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {/* Requirements */}
                <div style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 8, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 700 }}>Requirements</div>
                    {isEdit && <button onClick={() => addReqTo(updateQuestReqs(quest.id))} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}>+ Add</button>}
                  </div>
                  {(quest.requirements || []).map((req, i) => (
                    <QuestReqRow key={i} req={req} idx={i} editable={isEdit}
                      onUpdate={(idx, f, v) => updateReqIn(updateQuestReqs(quest.id), idx, f, v)}
                      onRemove={(idx) => removeReqFrom(updateQuestReqs(quest.id), idx)} />
                  ))}
                  {(quest.requirements || []).length === 0 && <div style={{ fontSize: 9, color: '#4a4058' }}>None</div>}
                </div>

                {/* Rewards */}
                <div style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.1)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 8, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 700 }}>Rewards</div>
                    {isEdit && <button onClick={() => addRewTo(updateQuestRews(quest.id))} style={{ background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}>+ Add</button>}
                  </div>
                  {(quest.rewards || []).map((rew, i) => (
                    <QuestRewRow key={i} rew={rew} idx={i} editable={isEdit} skills={skills}
                      onUpdate={(idx, f, v) => updateRewIn(updateQuestRews(quest.id), idx, f, v)}
                      onRemove={(idx) => removeRewFrom(updateQuestRews(quest.id), idx)} />
                  ))}
                  {(quest.rewards || []).length === 0 && <div style={{ fontSize: 9, color: '#4a4058' }}>None</div>}
                </div>
              </div>

              {/* Trigger wire row */}
              <div style={{ marginTop: 10, padding: '8px 10px', background: quest.trigger_id ? 'rgba(192,132,252,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${quest.trigger_id ? 'rgba(192,132,252,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 8, color: quest.trigger_id ? '#c084fc' : '#4a4058', textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif" }}>Trigger</div>
                  {!isEdit && (
                    quest.trigger_id
                      ? <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#c084fc', background: 'rgba(192,132,252,0.1)', border: '1px solid rgba(192,132,252,0.25)', borderRadius: 4, padding: '1px 8px' }}>{quest.trigger_id}</span>
                      : <span style={{ fontSize: 9, color: '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, padding: '1px 8px', fontWeight: 700 }}>NOT WIRED</span>
                  )}
                  {isEdit && (
                    <select
                      value={quest.trigger_id || ''}
                      onChange={e => updateQuest(quest.id, 'trigger_id', e.target.value || null)}
                      style={{ background: 'rgba(10,8,12,0.7)', border: '1px solid rgba(192,132,252,0.25)', borderRadius: 5, padding: '3px 8px', color: '#e0d8f0', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, cursor: 'pointer', outline: 'none', maxWidth: 220 }}
                    >
                      <option value="">— not wired —</option>
                      {availableTriggers.map(t => (
                        <option key={t.id} value={t.id}>{t.id} — {t.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Troll Spawn Config — shown on quests wired to forum_troll_spawned */}
              {quest.trigger_id === 'forum_troll_spawned' && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 8 }}>
                  <div style={{ fontSize: 8, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 700, marginBottom: 8 }}>🧌 Troll Spawn Config</div>
                  {isEdit ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 3 }}>HP (clicks to kill)</div>
                        <input
                          type="number" min={1}
                          value={(quest.config || {}).clicks_to_kill ?? 3}
                          onChange={e => updateQuest(quest.id, 'config', { ...(quest.config || {}), clicks_to_kill: Number(e.target.value) })}
                          style={{ ...questInputStyle, fontSize: 10 }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 3 }}>Despawn (minutes)</div>
                        <input
                          type="number" min={1}
                          value={(quest.config || {}).despawn_minutes ?? 30}
                          onChange={e => updateQuest(quest.id, 'config', { ...(quest.config || {}), despawn_minutes: Number(e.target.value) })}
                          style={{ ...questInputStyle, fontSize: 10 }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 8, color: '#6a6078', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 3 }}>Spawn Location</div>
                        <select
                          value={(quest.config || {}).spawn_location ?? 'any'}
                          onChange={e => updateQuest(quest.id, 'config', { ...(quest.config || {}), spawn_location: e.target.value })}
                          style={{ ...questInputStyle, fontSize: 10, cursor: 'pointer', width: '100%' }}
                        >
                          <option value="any">Any Thread</option>
                          <option value="ladder">Ladder Forums Only</option>
                          <option value="eternal">Eternal / Non-Ladder Only</option>
                          <option value="d4">Diablo 4 Only</option>
                          <option value="d2r">D2R Only</option>
                          <option value="d3">Diablo 3 Only</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 16, fontSize: 9, color: '#a78bfa' }}>
                      <span>HP: <strong>{(quest.config || {}).clicks_to_kill ?? 3}</strong></span>
                      <span>Despawn: <strong>{(quest.config || {}).despawn_minutes ?? 30}m</strong></span>
                      <span>Spawn: <strong>{{any:'Any Thread',ladder:'Ladder Only',eternal:'Eternal Only',d4:'D4 Only',d2r:'D2R Only',d3:'D3 Only'}[(quest.config || {}).spawn_location] || 'Any Thread'}</strong></span>
                    </div>
                  )}
                </div>
              )}

              {/* Stats footer */}
              <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 9, color: '#4a4058' }}>
                <span>Completions: <span style={{ color: G, fontWeight: 900 }}>{quest.completions || 0}</span></span>
                <span>Created: {new Date(quest.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
      </div>

      {dbAvailable && (
        <div style={{ marginTop: 20, padding: '10px 14px', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: 8, fontSize: 10, color: '#4a6a50', lineHeight: 1.5 }}>
          ✓ Quests persist to database. Progress tracking engine not yet wired — each quest shows completion count once tracking is live.
        </div>
      )}
    </div>
  );
}

// ── Ranks Tab ─────────────────────────────────────────────────────────────
const RANK_TIER_COLORS = ['#9ca3af', '#60a5fa', '#a855f7', '#f59e0b', '#D4AF37'];

// ── XpSettingsPanel ──────────────────────────────────────────────────────────
function XpSettingsPanel({ token }) {
  const [rules, setRules] = useState([]);
  const [saving, setSaving] = useState(null);
  const [msg, setMsg] = useState('');

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/xp-rules', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => { if (d.rules) setRules(d.rules); });
  }, [token]);

  const saveRule = async (rule) => {
    setSaving(rule.id);
    try {
      const r = await fetch('/api/admin/xp-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: 'update_rule', id: rule.id, xp_amount: rule.xp_amount, enabled: rule.enabled, label: rule.label }),
      });
      const d = await r.json();
      if (d.ok) flash('Saved');
      else flash('Error: ' + (d.error || 'unknown'));
    } catch (e) { flash('Error: ' + e.message); }
    setSaving(null);
  };

  const update = (id, field, val) => setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));

  return (
    <div>
      {msg && <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 6, fontSize: 11, color: '#4ade80' }}>{msg}</div>}
      {rules.length === 0 && <div style={{ fontSize: 11, color: '#6a6078' }}>No XP rules found. Create the xp_rules table and seed rows to configure XP.</div>}
      {rules.map(rule => (
        <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(212,175,55,0.04)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', minWidth: 18 }}>
            <input type="checkbox" checked={rule.enabled} onChange={e => update(rule.id, 'enabled', e.target.checked)} style={{ accentColor: '#D4AF37' }} />
          </label>
          <input value={rule.label || rule.action_type} onChange={e => update(rule.id, 'label', e.target.value)}
            style={{ flex: 1, background: 'rgba(20,18,24,0.8)', border: '1px solid rgba(212,175,55,0.06)', borderRadius: 6, padding: '4px 8px', color: '#e8e0f0', fontSize: 11, fontFamily: "'Barlow',sans-serif" }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" value={rule.xp_amount} min={0} onChange={e => update(rule.id, 'xp_amount', parseInt(e.target.value) || 0)}
              style={{ width: 64, background: 'rgba(20,18,24,0.8)', border: '1px solid rgba(212,175,55,0.06)', borderRadius: 6, padding: '4px 8px', color: '#D4AF37', fontSize: 11, fontFamily: "'Barlow',sans-serif", textAlign: 'right' }} />
            <span style={{ fontSize: 9, color: '#6a6078' }}>XP</span>
          </div>
          <button onClick={() => saveRule(rule)} disabled={saving === rule.id}
            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(212,175,55,0.2)', background: 'rgba(212,175,55,0.06)', color: '#D4AF37', fontSize: 9, fontWeight: 900, cursor: 'pointer', opacity: saving === rule.id ? 0.5 : 1 }}>
            {saving === rule.id ? '…' : 'Save'}
          </button>
        </div>
      ))}
      <div style={{ marginTop: 12, fontSize: 9, color: '#4a4058' }}>Changes take effect within 60 seconds (cache TTL).</div>
    </div>
  );
}

// ── RankDataEditor ─────────────────────────────────────────────────────────
// Inline editor for all 50 rank rows in the `ranks` DB table.
// Exposes: name, xp_required, min_sales, min_posts, min_referrals,
//          min_fg_earned, fg_reward, special_reward.
function RankDataEditor({ token }) {
  const [dbRanks, setDbRanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/ranks', { headers: { Authorization: 'Bearer ' + token } });
    const j = await r.json();
    if (j.ranks) {
      setDbRanks(j.ranks);
      const init = {};
      j.ranks.forEach(rk => { init[rk.id] = { ...rk }; });
      setEdits(init);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const flash = (m, ok = false) => { setMsg({ text: m, ok }); setTimeout(() => setMsg(''), 4000); };

  const save = async (id) => {
    setSaving(id);
    const e = edits[id];
    const payload = {
      action: 'update', id,
      name: e.name,
      xp_required: Number(e.xp_required),
      min_sales: Number(e.min_sales),
      min_posts: Number(e.min_posts),
      min_referrals: Number(e.min_referrals),
      min_fg_earned: Number(e.min_fg_earned),
      fg_reward: Number(e.fg_reward),
      special_reward: e.special_reward || null,
    };
    const r = await fetch('/api/admin/ranks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!j.ok) flash('Error: ' + (j.error || 'Save failed'));
    else { flash('Rank ' + id + ' saved', true); setExpandedId(null); setDbRanks(prev => prev.map(rk => rk.id === id ? { ...rk, ...payload } : rk)); }
    setSaving(null);
  };

  const upd = (id, field, val) => setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));

  const iS = { background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(212,175,55,0.12)', borderRadius: 5, padding: '4px 8px', color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, outline: 'none', width: '100%' };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spin" style={{ margin: '0 auto' }} /></div>;

  return (
    <div>
      {msg && <div style={{ background: msg.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${msg.ok ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`, borderRadius: 8, padding: '8px 14px', marginBottom: 14, color: msg.ok ? '#4ade80' : '#f87171', fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{msg.text}</div>}
      <div style={{ fontSize: 9, color: '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.15em', marginBottom: 14 }}>
        Rank Data (1–{dbRanks.length}) — tap a row to edit properties
      </div>
      {dbRanks.length === 0 && <div style={{ color: '#6a6078', fontSize: 12 }}>Ranks table not found or empty. Run 001_full_system.sql.</div>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>{['#', 'Name', 'XP Req', 'Min Sales', 'FG Reward', 'Special', ''].map(h => <th key={h} style={hcell}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {dbRanks.map(rk => {
              const e = edits[rk.id] || rk;
              const isOpen = expandedId === rk.id;
              return [
                <tr key={rk.id} onClick={() => setExpandedId(isOpen ? null : rk.id)} style={{ cursor: 'pointer', background: isOpen ? 'rgba(212,175,55,0.04)' : 'transparent' }}>
                  <td style={{ ...cell, fontWeight: 900, color: G, width: 30 }}>{rk.id}</td>
                  <td style={{ ...cell, fontWeight: 700, color: '#e8e0f0' }}>{rk.name}</td>
                  <td style={{ ...cell, color: '#a78bfa' }}>{Number(rk.xp_required).toLocaleString()}</td>
                  <td style={cell}>{rk.min_sales}</td>
                  <td style={{ ...cell, color: '#facc15' }}>+{rk.fg_reward} FG</td>
                  <td style={{ ...cell, color: '#6a6078', fontSize: 9 }}>{rk.special_reward || '—'}</td>
                  <td style={{ ...cell, textAlign: 'right', width: 24 }}><span style={{ color: '#4a4058', fontSize: 9 }}>{isOpen ? '▲' : '▼'}</span></td>
                </tr>,
                isOpen && (
                  <tr key={rk.id + '_edit'}>
                    <td colSpan={7} style={{ padding: '0 14px 14px', background: 'rgba(212,175,55,0.03)', borderBottom: '1px solid rgba(212,175,55,0.08)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 10, marginBottom: 10, maxWidth: 600 }}>
                        {[
                          { f: 'name',          lbl: 'Name',             type: 'text'   },
                          { f: 'xp_required',   lbl: 'XP Required',      type: 'number' },
                          { f: 'fg_reward',     lbl: 'FG Reward',        type: 'number' },
                          { f: 'min_sales',     lbl: 'Min Sales',        type: 'number' },
                          { f: 'min_posts',     lbl: 'Min Posts',        type: 'number' },
                          { f: 'min_referrals', lbl: 'Min Referrals',    type: 'number' },
                          { f: 'min_fg_earned', lbl: 'Min FG Earned',    type: 'number' },
                          { f: 'special_reward',lbl: 'Special Reward',   type: 'text'   },
                        ].map(({ f, lbl, type }) => (
                          <div key={f}>
                            <div style={{ fontSize: 8, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 3 }}>{lbl}</div>
                            <input type={type} value={e[f] ?? ''} onChange={ev => upd(rk.id, f, ev.target.value)} style={iS} />
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={(ev) => { ev.stopPropagation(); save(rk.id); }}
                        disabled={saving === rk.id}
                        style={{ padding: '5px 16px', borderRadius: 6, border: '1px solid rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.1)', color: G, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, textTransform: 'uppercase', cursor: 'pointer', opacity: saving === rk.id ? 0.6 : 1, letterSpacing: '.08em' }}
                      >
                        {saving === rk.id ? 'Saving…' : 'Save Rank ' + rk.id}
                      </button>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// #97: skills.dials is stored as an array of dial keys (e.g.
// ["amount", "duration"]). The admin's SkillFieldInput expects full field
// objects with key/label/type/etc. This map converts dial keys → field
// specs. Adding a new dial key to a skill in the catalog = adding it here.
// Defaults align with the wallet-card cap rules (default 1, max 20 from
// Adam's #77 cap).
const RANK_DIAL_SPECS = {
  amount: {
    key: 'amount',
    label: 'Amount',
    type: 'number',
    placeholder: '1',
    min: 1,
    max: 20,
  },
  charges: {
    key: 'charges',
    label: 'Charges',
    type: 'number',
    placeholder: '1',
    min: 1,
    max: 20,
  },
  duration: {
    key: 'duration',
    label: 'Duration (min)',
    type: 'number',
    placeholder: '1440',
    min: 1,
  },
  duration_minutes: {
    key: 'duration_minutes',
    label: 'Duration (min)',
    type: 'number',
    placeholder: '1440',
    min: 1,
  },
  expires_at: {
    key: 'expires_at',
    label: 'Expires',
    type: 'date',
  },
  status: {
    key: 'status',
    label: 'Status',
    type: 'text',
    placeholder: 'charge',
  },
};

function RanksTab({ token, rankRewards, setRankRewards }) {
  const [skills, setSkills] = useState([]);
  const [expandedRank, setExpandedRank] = useState(null);
  const [rankSubTab, setRankSubTab] = useState('rewards');
  // Per-assignment skill configs for ranks: { [rank]: { [skillId]: configObj } }
  const [rankSkillConfigs, setRankSkillConfigs] = useState({});

  const api = useCallback(async (method, body, query = '') => {
    const opts = { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } };
    if (method === 'POST') { opts.method = 'POST'; opts.body = JSON.stringify(body); }
    const r = await fetch('/api/admin/skills' + query, opts);
    return r.json();
  }, [token]);

  useEffect(() => {
    if (token) api('GET', null).then(r => { if (r.skills) setSkills(r.skills); });
  }, [token, api]);

  const updateRankSkillConfig = (rank, skillId, field, val) => {
    setRankSkillConfigs(prev => ({
      ...prev,
      [rank]: { ...(prev[rank] || {}), [skillId]: { ...(prev[rank]?.[skillId] || {}), [field]: val } },
    }));
  };

  const toggleSkillForRank = (rank, skillId) => {
    setRankRewards(prev => {
      const current = (prev[rank] || []).map(e => (typeof e === 'string' ? e : e.id));
      return { ...prev, [rank]: current.includes(skillId) ? current.filter(s => s !== skillId) : [...current, skillId] };
    });
    // #97: seed amount=1 default into rankSkillConfigs when adding a new
    // skill so the chip header immediately reads "× 1" + the inline amount
    // input pre-fills with 1. If the skill is being removed (already in
    // current), this is a no-op overwrite — harmless.
    setRankSkillConfigs(prev => {
      const existingCfg = prev[rank]?.[skillId];
      if (existingCfg && existingCfg.amount) return prev; // already configured
      return {
        ...prev,
        [rank]: { ...(prev[rank] || {}), [skillId]: { ...(existingCfg || {}), amount: 1 } },
      };
    });
  };

  // Group RANKS into tiers of 10 using the first rank name as header
  const rankTiers = [
    { label: `${RANKS[0].name} → ${RANKS[9].name}`, range: [1, 10], color: RANK_TIER_COLORS[0] },
    { label: `${RANKS[10].name} → ${RANKS[19].name}`, range: [11, 20], color: RANK_TIER_COLORS[1] },
    { label: `${RANKS[20].name} → ${RANKS[29].name}`, range: [21, 30], color: RANK_TIER_COLORS[2] },
    { label: `${RANKS[30].name} → ${RANKS[39].name}`, range: [31, 40], color: RANK_TIER_COLORS[3] },
    { label: `${RANKS[40].name} → ${RANKS[49].name}`, range: [41, 50], color: RANK_TIER_COLORS[4] },
  ];

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[['rewards', 'Rank Rewards'], ['xp_settings', 'XP Settings'], ['rank_data', 'Rank Data']].map(([st, lbl]) => (
          <button key={st} onClick={() => setRankSubTab(st)} style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${rankSubTab === st ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.06)'}`, background: rankSubTab === st ? 'rgba(212,175,55,0.08)' : 'transparent', color: rankSubTab === st ? '#D4AF37' : '#6a6078', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em', cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif" }}>
            {lbl}
          </button>
        ))}
      </div>

      {rankSubTab === 'xp_settings' && <XpSettingsPanel token={token} />}
      {rankSubTab === 'rank_data' && <RankDataEditor token={token} />}

      {rankSubTab === 'rewards' && <>
      <div style={{ fontSize: 9, color: '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.15em', marginBottom: 16 }}>Rank Rewards (1–50)</div>

      {rankTiers.map(rt => (
        <div key={rt.label} style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 12, color: rt.color, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: rt.color }} />
            {rt.label} (Rank {rt.range[0]}–{rt.range[1]})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
            {Array.from({ length: rt.range[1] - rt.range[0] + 1 }, (_, i) => rt.range[0] + i).map(rank => {
              const rewards = rankRewards[rank] || [];
              const isExpanded = expandedRank === rank;
              const rankData = RANKS[rank - 1];
              return (
                <div key={rank}>
                  <button onClick={() => setExpandedRank(isExpanded ? null : rank)}
                    style={{ width: '100%', padding: '6px 4px', borderRadius: 8, border: `1px solid ${rewards.length > 0 ? rt.color + '40' : 'rgba(255,255,255,0.04)'}`, background: rewards.length > 0 ? rt.color + '10' : 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: rewards.length > 0 ? rt.color : '#4a4058' }}>{rank}</div>
                    <div style={{ fontSize: 8, color: rt.color, marginTop: 1, fontWeight: 700, fontFamily: "'Cinzel',serif", opacity: 0.8 }}>{rankData?.name || ''}</div>
                    <div style={{ fontSize: 7, color: '#6a6078', marginTop: 1 }}>{rewards.length > 0 ? `${rewards.length} skill${rewards.length > 1 ? 's' : ''}` : '—'}</div>
                    {rankData?.fgReward > 0 && <div style={{ fontSize: 7, color: '#facc15', marginTop: 1 }}>+{rankData.fgReward} FG</div>}
                  </button>
                </div>
              );
            })}
          </div>
          {/* Expanded rank skill picker */}
          {expandedRank >= rt.range[0] && expandedRank <= rt.range[1] && (() => {
            const rd = RANKS[expandedRank - 1];
            // #97 (Adam): "the subscription badges can be removed off there
            // too only rewards and skills and permissions". Tier badges
            // (Verified / Member / Premium / Elite / Legendary / Godly) are
            // tied to subscription tier purchases, not rank-up. Drop them
            // from BOTH the assigned-list rendering (in case any rank had
            // a badge added pre-this-fix) and the picker.
            const assignedIds = (rankRewards[expandedRank] || [])
              .map(e => (typeof e === 'string' ? e : e.id))
              .filter(sid => {
                const s = skills.find(sk => sk.id === sid);
                return s && s.type !== 'badge';
              });
            const activeSkills = skills.filter(s => s.active && s.type !== 'badge');
            const unassigned = activeSkills.filter(s => !assignedIds.includes(s.id));
            return (
              <div style={{ marginTop: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 12, border: `1px solid ${rt.color}20` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 12, color: rt.color, fontWeight: 700, fontFamily: "'Cinzel',serif" }}>Rank {expandedRank}: {rd?.name}</div>
                    <UIOnlyBadge />
                  </div>
                  <div style={{ fontSize: 9, color: '#6a6078' }}>{rd?.xp?.toLocaleString()} XP · +{rd?.fgReward} FG</div>
                </div>
                {activeSkills.length === 0 && <div style={{ fontSize: 10, color: '#6a6078', marginTop: 8 }}>No active skills. Create some in Features → Skills first.</div>}
                {assignedIds.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, marginBottom: 8 }}>
                    {assignedIds.map(sid => {
                      const s = skills.find(sk => sk.id === sid);
                      if (!s) return null;
                      const tc = TYPE_COLORS[s.type] || '#6b7280';
                      // #97 — Schema-driven: skills.dials is stored in DB as
                      // an array of dial keys (e.g. ["amount", "duration"]).
                      // Convert each key to a full field object via
                      // RANK_DIAL_SPECS. Backward-compat: if a skill has
                      // legacy `dials.fields` object form, read that.
                      // If a skill has no dials at all, default to ["amount"]
                      // so admin can always specify a quantity per rank.
                      let dialKeys = [];
                      if (Array.isArray(s.dials)) dialKeys = s.dials;
                      else if (Array.isArray(s.dials?.fields)) dialKeys = s.dials.fields.map(f => f.key || f);
                      else if (s.type !== 'badge') dialKeys = ['amount']; // Adam #97: every grantable skill needs an amount
                      const fields = s.type === 'badge'
                        ? []
                        : dialKeys.map(k => (typeof k === 'string' ? RANK_DIAL_SPECS[k] : k)).filter(Boolean);
                      const cfg = rankSkillConfigs[expandedRank]?.[sid] || {};
                      return (
                        <div key={sid} style={{ background: tc + '0a', border: `1px solid ${tc}25`, borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: fields.length ? 6 : 0 }}>
                            <span style={{ color: tc, fontWeight: 700, fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif" }}>
                              {s.name}
                              {/* #97: surface the configured amount in the chip header so admins see the effective grant at a glance */}
                              {cfg.amount && Number(cfg.amount) > 0 && (
                                <span style={{ marginLeft: 6, color: tc, opacity: 0.7, fontWeight: 900 }}>× {cfg.amount}</span>
                              )}
                            </span>
                            <button onClick={() => toggleSkillForRank(expandedRank, sid)} style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 4, padding: '2px 8px', color: '#f87171', fontSize: 8, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
                          </div>
                          {fields.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {fields.map(f => (
                                <div key={f.key}>
                                  <div style={{ fontSize: 7, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{f.label}</div>
                                  <SkillFieldInput f={f} value={cfg[f.key] ?? ''} tc={tc} onChange={(key, val) => updateRankSkillConfig(expandedRank, sid, key, val)} />
                                </div>
                              ))}
                            </div>
                          )}
                          {fields.length === 0 && <div style={{ fontSize: 9, color: '#6a6078' }}>Auto-grants at rank-up — no extra config needed.</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
                {unassigned.length > 0 && (
                  <div>
                    <div style={{ fontSize: 8, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Add a skill:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {unassigned.map(s => {
                        const tc = TYPE_COLORS[s.type] || '#6b7280';
                        return (
                          <button key={s.id} onClick={() => toggleSkillForRank(expandedRank, s.id)}
                            style={{ padding: '3px 10px', borderRadius: 12, border: `1px solid ${tc}30`, background: 'transparent', color: tc + 'aa', fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif" }}>
                            + {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      ))}

      <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)', borderRadius: 8, fontSize: 11, color: '#9a8eb0', lineHeight: 1.5 }}>
        Rank rewards are stored locally for now. Once finalized, they'll persist to the database and auto-grant when players rank up. Each rank already awards FG (shown on tiles).
      </div>
      </>}
    </div>
  );
}

// ── Full-page user detail view ─────────────────────────────────────────────
// Single scrollable panel — all sections load in parallel, no sub-tabs.

// Shared styles used throughout the detail view panels
const detailInp = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', color: '#e0d8f0', fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", width: '100%', boxSizing: 'border-box' };
const detailBtn = (color = G) => ({ padding: '6px 14px', borderRadius: 6, border: `1px solid ${color}44`, background: `${color}18`, color, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, textTransform: 'uppercase', cursor: 'pointer', letterSpacing: '.08em' });
const MEMBERSHIP_COLOR = { free: 'var(--mt)', premium: G, vip: '#c084fc', lifetime: '#f87171' };

// ── Layout helpers ─────────────────────────────────────────────────────────────
function UDSection({ title, icon, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
        {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
        <div className="cinzel" style={{ fontSize: 12, color: G, letterSpacing: 1.2 }}>{title}</div>
      </div>
      {children}
    </div>
  );
}

function UDField({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.18em', color: 'var(--mt)', marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function UDReadRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'flex-start' }}>
      <div style={{ width: 140, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--mt)', flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--sub)', wordBreak: 'break-all' }}>{value ?? <span style={{ opacity: 0.3 }}>—</span>}</div>
    </div>
  );
}

function UDStat({ label, value, color = 'var(--sub)' }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 70 }}>
      <div style={{ fontSize: 20, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, fontFamily: "'Barlow Condensed',sans-serif", color: 'var(--mt)', textTransform: 'uppercase', letterSpacing: '.12em', marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── 1. Header ──────────────────────────────────────────────────────────────────
function UDHeaderSection({ user }) {
  if (!user) return null;
  const tier = user.membership || 'free';
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 24, background: 'linear-gradient(135deg,#0e0c10,#121020)', border: '1px solid rgba(212,175,55,0.14)', borderRadius: 16, padding: '22px 24px' }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: '3px solid rgba(212,175,55,0.25)', background: '#1a1820', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {user.photo_url
          ? <img src={user.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
          : <span style={{ fontSize: 34, opacity: 0.35 }}>👤</span>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="cinzel" style={{ fontSize: 22, color: G, marginBottom: 4, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.display_name || '(no name)'}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 12 }}>{user.email}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <Pill color="rgba(212,175,55,0.1)" textColor={MEMBERSHIP_COLOR[tier] || 'var(--mt)'}>{tier.toUpperCase()}</Pill>
          {user.role === 'admin' && <Pill color="rgba(239,68,68,0.15)"  textColor="#f87171">🛡 ADMIN</Pill>}
          {user.banned           && <Pill color="rgba(220,38,38,0.15)"  textColor="#f87171">⛔ BANNED</Pill>}
          {user.trading_locked   && <Pill color="rgba(234,179,8,0.15)"  textColor="#facc15">🔒 TRADING LOCKED</Pill>}
          {user.monitored        && <Pill color="rgba(251,191,36,0.15)" textColor="#fbbf24">👁 MONITORED</Pill>}
          <Pill color="rgba(168,85,247,0.1)" textColor="#c084fc">Rank {user.rank_level || 1} · {user.rank_name || 'Scavenger'}</Pill>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', fontFamily: "'Barlow Condensed',sans-serif" }}>
          Member since {user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
          {user.ip_address && <span> · IP: {user.ip_address}</span>}
          <span style={{ fontFamily: 'monospace', fontSize: 10, marginLeft: 8, opacity: 0.6 }}>{user.id?.slice(0, 16)}…</span>
        </div>
      </div>
    </div>
  );
}

// ── 2. Account Controls ────────────────────────────────────────────────────────
function UDAccountControlsSection({ user, userId, onAction, currentUserId, flash }) {
  const [editName,   setEditName]   = useState('');
  const [newRole,    setNewRole]    = useState('user');
  const [editTier,   setEditTier]   = useState('free');
  const [editExpiry, setEditExpiry] = useState('');
  const [byIp,       setByIp]       = useState(false);
  const [saving,     setSaving]     = useState('');

  useEffect(() => {
    if (user) {
      setEditName(user.display_name || '');
      setNewRole(user.role || 'user');
      setEditTier(user.membership || 'free');
      setEditExpiry(user.membership_expiry ? user.membership_expiry.slice(0, 10) : '');
    }
  }, [user]);

  if (!user) return null;
  const isSelf = userId === currentUserId;

  const act = async (action, params, label) => {
    setSaving(label);
    try { await onAction(action, params); flash('✓ Saved'); }
    catch (e) { flash('Error: ' + e.message, false); }
    setSaving('');
  };

  return (
    <UDSection title="Account Controls" icon="⚙">
      <UDField label="Display Name">
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={editName} onChange={e => setEditName(e.target.value)} style={{ ...detailInp, flex: 1 }} />
          <button onClick={() => act('setDisplayName', { display_name: editName }, 'name')} disabled={!!saving || !editName.trim()} style={detailBtn()}>
            {saving === 'name' ? '…' : 'Save'}
          </button>
        </div>
      </UDField>

      <UDField label="Read-Only Info">
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '2px 12px' }}>
          <UDReadRow label="User ID"    value={<span style={{ fontFamily: 'monospace', fontSize: 11 }}>{user.id}</span>} />
          <UDReadRow label="Email"      value={user.email} />
          <UDReadRow label="BattleTag"  value={user.battletag} />
          <UDReadRow label="Joined"     value={user.created_at ? new Date(user.created_at).toLocaleString() : null} />
          <UDReadRow label="Last Login" value={user.updated_at ? new Date(user.updated_at).toLocaleString() : null} />
          <UDReadRow label="IP Address" value={user.ip_address} />
        </div>
      </UDField>

      {!isSelf && (
        <UDField label="Role">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {['user', 'admin'].map(r => (
              <button key={r} onClick={() => setNewRole(r)} style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${newRole === r ? G : 'rgba(255,255,255,0.1)'}`, background: newRole === r ? 'rgba(212,175,55,0.12)' : 'none', color: newRole === r ? G : 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 10, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                {r === 'admin' ? '🛡 Admin' : '👤 User'}
              </button>
            ))}
            <button onClick={() => act('setRole', { role: newRole }, 'role')} disabled={!!saving || newRole === user.role} style={detailBtn('#a78bfa')}>
              {saving === 'role' ? '…' : 'Set Role'}
            </button>
            <span style={{ fontSize: 10, color: 'var(--mt)' }}>Current: <b style={{ color: 'var(--sub)' }}>{user.role}</b></span>
          </div>
        </UDField>
      )}

      <UDField label="Membership Tier">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {['free', 'premium', 'vip', 'lifetime'].map(t => (
            <button key={t} onClick={() => setEditTier(t)} style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${editTier === t ? G : 'rgba(255,255,255,0.1)'}`, background: editTier === t ? 'rgba(212,175,55,0.12)' : 'none', color: editTier === t ? G : 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 10, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {t}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" value={editExpiry} onChange={e => setEditExpiry(e.target.value)} style={{ ...detailInp, width: 160, flex: 'none' }} />
          <span style={{ fontSize: 10, color: 'var(--mt)', whiteSpace: 'nowrap' }}>expiry (blank = never)</span>
          <button onClick={() => act('setMembership', { membership: editTier, membership_expiry: editExpiry || null }, 'mem')} disabled={!!saving} style={detailBtn()}>
            {saving === 'mem' ? '…' : 'Save'}
          </button>
        </div>
      </UDField>

      {!isSelf && (
        <UDField label="Ban / Unban">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: 'var(--sub)', fontFamily: "'Barlow Condensed',sans-serif" }}>
              <input type="checkbox" checked={byIp} onChange={e => setByIp(e.target.checked)} style={{ accentColor: '#f87171' }} />
              Include IP ban
            </label>
            {user.banned
              ? <button onClick={() => act('unbanUser', {}, 'unban')} disabled={!!saving} style={detailBtn('#4ade80')}>{saving === 'unban' ? '…' : '✓ Unban User'}</button>
              : <button onClick={() => act('banUser', { byIp }, 'ban')}   disabled={!!saving} style={detailBtn('#f87171')}>{saving === 'ban'   ? '…' : byIp ? '⛔ Ban by IP' : '⛔ Ban User'}</button>
            }
            {user.ip_address && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', fontFamily: "'Barlow Condensed',sans-serif" }}>IP: {user.ip_address}</span>}
          </div>
        </UDField>
      )}

      {!isSelf && (
        <UDField label="Flags">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => act('setTradingLocked', { locked: !user.trading_locked }, 'tl')} disabled={!!saving} style={detailBtn(user.trading_locked ? '#4ade80' : '#facc15')}>
              {saving === 'tl' ? '…' : user.trading_locked ? '🔓 Unlock Trading' : '🔒 Lock Trading'}
            </button>
            <button onClick={() => act('setMonitored', { monitored: !user.monitored }, 'mon')} disabled={!!saving} style={detailBtn(user.monitored ? '#4ade80' : '#60a5fa')}>
              {saving === 'mon' ? '…' : user.monitored ? '✓ Remove Monitor' : '👁 Add Monitor'}
            </button>
            <button onClick={() => flash('Password reset not yet implemented — use Supabase dashboard.', false)} style={detailBtn('rgba(255,255,255,0.25)')}>
              🔑 Reset Password
            </button>
          </div>
        </UDField>
      )}
    </UDSection>
  );
}

// ── 3. Economy ─────────────────────────────────────────────────────────────────
function UDEconomySection({ user, userId, onAction, flash }) {
  const [fgGrant, setFgGrant] = useState('');
  const [fgNote,  setFgNote]  = useState('');
  const [xpGrant, setXpGrant] = useState('');
  const [xpNote,  setXpNote]  = useState('');
  const [rankLvl, setRankLvl] = useState('');
  const [saving,  setSaving]  = useState('');

  useEffect(() => { if (user) setRankLvl(String(user.rank_level || 1)); }, [user]);

  if (!user) return null;

  const act = async (action, params, label) => {
    setSaving(label);
    try { await onAction(action, params); flash('✓ Done'); }
    catch (e) { flash('Error: ' + e.message, false); }
    setSaving('');
  };

  return (
    <UDSection title="Economy" icon="🪙">
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 20, background: 'rgba(212,175,55,0.04)', borderRadius: 10, padding: '14px 18px', border: '1px solid rgba(212,175,55,0.1)' }}>
        <UDStat label="FG Balance"   value={(user.fg_balance     || 0).toLocaleString()} color={G} />
        <UDStat label="Total Earned" value={(user.total_fg_earned || 0).toLocaleString()} color="rgba(212,175,55,0.6)" />
        <UDStat label="XP"           value={(user.xp             || 0).toLocaleString()} color="#60a5fa" />
        <UDStat label="Rank"         value={`${user.rank_level || 1}`}                   color="#a78bfa" />
        {user.gem_balance != null && <UDStat label="Gems" value={(user.gem_balance || 0).toLocaleString()} color="#34d399" />}
      </div>

      <UDField label="Grant Forum Gold">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={fgGrant} onChange={e => setFgGrant(e.target.value)} placeholder="Amount" type="number" min="1" style={{ ...detailInp, width: 110 }} />
          <input value={fgNote}  onChange={e => setFgNote(e.target.value)}  placeholder="Reason / note" style={{ ...detailInp, flex: 1, minWidth: 120 }} />
          <button onClick={() => act('grantFg', { amount: fgGrant, note: fgNote }, 'fg')} disabled={!!saving || !fgGrant} style={detailBtn()}>
            {saving === 'fg' ? '…' : 'Grant FG'}
          </button>
        </div>
      </UDField>

      <UDField label="Award XP">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={xpGrant} onChange={e => setXpGrant(e.target.value)} placeholder="Amount" type="number" min="1" style={{ ...detailInp, width: 110 }} />
          <input value={xpNote}  onChange={e => setXpNote(e.target.value)}  placeholder="Reason / note" style={{ ...detailInp, flex: 1, minWidth: 120 }} />
          <button onClick={() => act('awardXp', { amount: xpGrant, note: xpNote }, 'xp')} disabled={!!saving || !xpGrant} style={detailBtn('#60a5fa')}>
            {saving === 'xp' ? '…' : 'Award XP'}
          </button>
        </div>
      </UDField>

      <UDField label="Set Rank">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={rankLvl} onChange={e => setRankLvl(e.target.value)} placeholder="1–50" type="number" min="1" max="50" style={{ ...detailInp, width: 80 }} />
          <button onClick={() => {
            const rank = RANKS.find(r => r.id === parseInt(rankLvl, 10));
            act('setRank', { rankLevel: rankLvl, rankName: rank?.name || `Rank ${rankLvl}` }, 'rank');
          }} disabled={!!saving || !rankLvl} style={detailBtn('#a78bfa')}>
            {saving === 'rank' ? '…' : 'Set Rank'}
          </button>
          <span style={{ fontSize: 10, color: 'var(--mt)' }}>Current: Rank {user.rank_level || 1} · {user.rank_name || 'Scavenger'}</span>
        </div>
      </UDField>
    </UDSection>
  );
}

// ── 4. Trades ─────────────────────────────────────────────────────────────────
function UDTradesSection({ listings, escrow, listingsLoading }) {
  const lRecs    = listings?.records || [];
  const eRecs    = escrow?.records   || [];
  const completed = lRecs.filter(r => r.status === 'sold').length;
  const activeEsc = eRecs.filter(r => ['held','pending'].includes(r.status)).length;
  const totalVol  = eRecs.reduce((sum, r) => sum + (r.fg_amount || 0), 0);
  const STATUS_C  = { active: '#4ade80', sold: '#60a5fa', disputed: '#f87171', cancelled: '#6a6078', pending: G };

  return (
    <UDSection title="Trades" icon="📋">
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16, background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.1)', borderRadius: 10, padding: '14px 18px' }}>
        <UDStat label="Listings"  value={lRecs.length}               />
        <UDStat label="Completed" value={completed}                   color="#4ade80" />
        <UDStat label="Escrow"    value={activeEsc}                   color="#a78bfa" />
        <UDStat label="Vol (FG)"  value={totalVol.toLocaleString()}   color={G} />
      </div>
      {listingsLoading && !listings ? (
        <div style={{ color: 'var(--mt)', fontSize: 11 }}>Loading…</div>
      ) : lRecs.length === 0 ? (
        <div style={{ color: 'var(--mt)', fontSize: 12 }}>No listings.</div>
      ) : lRecs.slice(0, 15).map((r, i) => (
        <div key={r.id || i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
          <div style={{ flex: 1, fontSize: 12, color: 'var(--sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title || 'Untitled'}</div>
          <span style={{ fontSize: 9, color: STATUS_C[r.status] || 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase', letterSpacing: '.06em', flexShrink: 0 }}>{r.status}</span>
          {r.price > 0 && <span style={{ fontSize: 11, color: G, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, flexShrink: 0 }}>{r.price.toLocaleString()} FG</span>}
          <span style={{ fontSize: 10, color: 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif", flexShrink: 0 }}>{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</span>
        </div>
      ))}
    </UDSection>
  );
}

// ── 5. Disputes ───────────────────────────────────────────────────────────────
function UDDisputesSection({ data, loading }) {
  const records = data?.records || [];
  return (
    <UDSection title="Disputes" icon="⚖">
      {loading && !data ? (
        <div style={{ color: 'var(--mt)', fontSize: 11 }}>Loading…</div>
      ) : records.length === 0 ? (
        <div style={{ color: 'var(--mt)', fontSize: 12 }}>No disputes.</div>
      ) : records.map((r, i) => (
        <div key={r.id || i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
          <div style={{ flex: 1, fontSize: 12, color: '#f87171', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title || 'Dispute'}</div>
          <span style={{ fontSize: 9, color: '#f87171', fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase', flexShrink: 0 }}>{r.status}</span>
          {r.price > 0 && <span style={{ fontSize: 11, color: G, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, flexShrink: 0 }}>{r.price.toLocaleString()} FG</span>}
        </div>
      ))}
    </UDSection>
  );
}

// ── 6. Reviews ────────────────────────────────────────────────────────────────
function UDReviewsSection({ profileData }) {
  const rc = profileData?.review_count;
  return (
    <UDSection title="Reviews" icon="⭐">
      {rc != null ? (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', background: 'rgba(251,146,60,0.04)', border: '1px solid rgba(251,146,60,0.1)', borderRadius: 10, padding: '14px 18px' }}>
          <UDStat label="Total Reviews" value={rc} color="#fb923c" />
          <UDStat label="Completed Trades" value={profileData?.trade_count ?? '—'} color="#4ade80" />
        </div>
      ) : (
        <div style={{ background: 'rgba(255,165,0,0.06)', border: '1px solid rgba(255,165,0,0.15)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: '#fbbf24' }}>⚠ Reviews table not yet created — positive/negative review score will appear here once the reviews system is built.</div>
        </div>
      )}
    </UDSection>
  );
}

// ── 7. Badges ─────────────────────────────────────────────────────────────────
function UDBadgesSection({ data, userId, onAction, flash, loading }) {
  const allBadges  = data?.all_badges  || [];
  const userBadges = new Set((data?.user_badges || []).map(b => b.badge_id));
  const [saving, setSaving] = useState('');

  const act = async (action, params, label) => {
    setSaving(label);
    try { await onAction(action, params); flash('✓ Done'); }
    catch (e) { flash('Error: ' + e.message, false); }
    setSaving('');
  };

  return (
    <UDSection title="Badges" icon="🎖">
      {loading && !data ? (
        <div style={{ color: 'var(--mt)', fontSize: 11 }}>Loading…</div>
      ) : allBadges.length === 0 ? (
        <div style={{ color: 'var(--mt)', fontSize: 12 }}>No badges in catalog.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {allBadges.map(b => {
            const has = userBadges.has(b.id);
            return (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: has ? 'rgba(74,222,128,0.04)' : 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px solid ${has ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)'}` }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: has ? '#4ade80' : 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: has ? '#4ade80' : 'var(--sub)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{b.name}</span>
                  {b.description && <span style={{ fontSize: 10, color: 'var(--mt)', marginLeft: 8 }}>{b.description}</span>}
                </div>
                {has
                  ? <button onClick={() => act('removeBadge', { badgeId: b.id }, 'rb_' + b.id)} disabled={!!saving} style={detailBtn('#f87171')}>Remove</button>
                  : <button onClick={() => act('grantBadge', { badgeId: b.id }, 'gb_' + b.id)} disabled={!!saving} style={detailBtn()}>Grant</button>
                }
              </div>
            );
          })}
        </div>
      )}
    </UDSection>
  );
}

// ── 8. Subscriptions ──────────────────────────────────────────────────────────
function UDSubscriptionsSection({ user }) {
  if (!user) return null;
  const tier = user.membership || 'free';
  return (
    <UDSection title="Subscriptions" icon="💎">
      <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '2px 12px' }}>
        <UDReadRow label="Membership" value={<span style={{ color: MEMBERSHIP_COLOR[tier] || 'var(--mt)', fontWeight: 700, textTransform: 'uppercase' }}>{tier}</span>} />
        <UDReadRow label="Expires"    value={user.membership_expiry ? new Date(user.membership_expiry).toLocaleDateString() : 'Never'} />
        <UDReadRow label="Stripe ID"  value={user.stripe_customer_id || null} />
        <UDReadRow label="Sub Status" value={user.stripe_subscription_status || null} />
      </div>
    </UDSection>
  );
}

// ── 9. Activity ───────────────────────────────────────────────────────────────
function UDActivitySection({ data, loading }) {
  const events   = data?.events || [];
  const KIND_COLOR = { fg_received: '#4ade80', fg_sent: '#f87171', special_claim: G, event_entry: '#a78bfa', badge_grant: '#60a5fa', listing: 'var(--sub)' };
  return (
    <UDSection title="Activity" icon="📊">
      {loading && !data ? (
        <div style={{ color: 'var(--mt)', fontSize: 11 }}>Loading…</div>
      ) : events.length === 0 ? (
        <div style={{ color: 'var(--mt)', fontSize: 12 }}>No activity.</div>
      ) : events.slice(0, 30).map((e, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 16, width: 22, flexShrink: 0, textAlign: 'center' }}>{e.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: KIND_COLOR[e.kind] || 'var(--sub)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{e.label}</div>
            {e.note && <div style={{ fontSize: 10, color: 'var(--mt)', marginTop: 2 }}>{e.note}</div>}
          </div>
          <div style={{ fontSize: 10, color: 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif", flexShrink: 0, whiteSpace: 'nowrap' }}>
            {e.ts ? new Date(e.ts).toLocaleDateString() : ''}
          </div>
        </div>
      ))}
    </UDSection>
  );
}

// ── 10. Tokens & Tickets ──────────────────────────────────────────────────────
function UDTokensSection({ user }) {
  if (!user) return null;
  const hasTokens = user.raffle_tickets != null || user.skill_tokens != null;
  return (
    <UDSection title="Tokens & Tickets" icon="🎟">
      {hasTokens ? (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.1)', borderRadius: 10, padding: '14px 18px' }}>
          {user.raffle_tickets != null && <UDStat label="Raffle Tickets" value={user.raffle_tickets} color="#c084fc" />}
          {user.skill_tokens   != null && <UDStat label="Skill Tokens"   value={user.skill_tokens}   color="#a78bfa" />}
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--mt)' }}>Raffle ticket and skill token columns not yet in schema — will appear here once added.</div>
        </div>
      )}
    </UDSection>
  );
}

// ── 11. Admin Notes ───────────────────────────────────────────────────────────
function UDNotesSection({ user, userId, onAction, flash }) {
  const [notes,  setNotes]  = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user) setNotes(user.admin_notes || ''); }, [user]);

  if (!user) return null;

  const save = async () => {
    setSaving(true);
    try { await onAction('setAdminNotes', { admin_notes: notes }); flash('✓ Notes saved'); }
    catch (e) { flash('Error: ' + e.message, false); }
    setSaving(false);
  };

  return (
    <UDSection title="Admin Notes" icon="📝">
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Internal admin notes about this user…"
        rows={4}
        style={{ ...detailInp, resize: 'vertical', lineHeight: 1.6, fontSize: 12 }}
      />
      {user.admin_notes === undefined && (
        <div style={{ fontSize: 10, color: '#fbbf24', marginTop: 6 }}>⚠ admin_notes column pending — run migration 024 to enable.</div>
      )}
      <div style={{ marginTop: 8 }}>
        <button onClick={save} disabled={saving} style={detailBtn()}>
          {saving ? 'Saving…' : 'Save Notes'}
        </button>
      </div>
    </UDSection>
  );
}

// ── 12. Admin Action Log ──────────────────────────────────────────────────────
function UDAdminLogSection({ data, loading }) {
  const records  = data?.records || [];
  const ACTION_C = {
    grantFg: '#4ade80', grantBadge: '#60a5fa', removeBadge: '#f87171',
    setRole: '#a78bfa', banUser: '#f87171', banByIp: '#ef4444',
    unbanUser: '#4ade80', setMembership: G, setRank: '#a78bfa',
    awardXp: '#60a5fa', setDisplayName: 'var(--sub)',
    setAdminNotes: 'var(--mt)', setTradingLocked: '#facc15', setMonitored: '#60a5fa',
  };
  return (
    <UDSection title="Admin Action Log" icon="🔍">
      {data?.pending_migration && (
        <div style={{ background: 'rgba(255,165,0,0.06)', border: '1px solid rgba(255,165,0,0.15)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: '#fbbf24' }}>⚠ Migration 022 (admin_action_log) not yet applied — log will populate after apply.</div>
        </div>
      )}
      {loading && !data ? (
        <div style={{ color: 'var(--mt)', fontSize: 11 }}>Loading…</div>
      ) : records.length === 0 && !data?.pending_migration ? (
        <div style={{ color: 'var(--mt)', fontSize: 12 }}>No admin actions recorded.</div>
      ) : records.map((r, i) => (
        <div key={r.id || i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 12, color: ACTION_C[r.action] || 'var(--sub)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{r.action}</span>
            {r.details && Object.keys(r.details).length > 0 && (
              <div style={{ fontSize: 10, color: 'var(--mt)', marginTop: 2, fontFamily: "'Barlow Condensed',sans-serif" }}>
                {Object.entries(r.details).map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </div>
            )}
            {r.admin_name && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 1 }}>by {r.admin_name}</div>}
          </div>
          <div style={{ fontSize: 10, color: 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif", flexShrink: 0, whiteSpace: 'nowrap' }}>
            {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
          </div>
        </div>
      ))}
    </UDSection>
  );
}

// ── Main drill-in container (full-page, single scroll) ────────────────────────
function UserDetailView({ userId, token, currentUserId, onBack }) {
  const [data,    setData]    = useState({});
  const [pending, setPending] = useState(new Set());
  const [msg,     setMsg]     = useState(null); // { text, ok }

  const loadType = useCallback(async (type) => {
    const apiType = type === 'admin' ? 'admin-log' : type;
    setPending(s => new Set([...s, type]));
    try {
      const r = await fetch(`/api/admin/user-detail?type=${apiType}&userId=${userId}`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      const j = await r.json();
      setData(d => ({ ...d, [type]: j }));
    } catch (e) {
      setData(d => ({ ...d, [type]: { error: e.message } }));
    }
    setPending(s => { const n = new Set(s); n.delete(type); return n; });
  }, [userId, token]);

  useEffect(() => {
    ['profile', 'grants', 'activity', 'escrow', 'disputes', 'listings', 'admin'].forEach(loadType);
  }, [loadType]);

  const doAction = useCallback(async (action, params) => {
    const r = await fetch('/api/admin/user-detail', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId, ...params }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    const toRefresh = ['admin'];
    if (['setDisplayName','setMembership','banUser','unbanUser','setRole','awardXp','setRank','setAdminNotes','setTradingLocked','setMonitored'].includes(action)) toRefresh.push('profile');
    if (['grantFg','awardXp','setRank','grantBadge','removeBadge'].includes(action)) toRefresh.push('grants');
    if (['grantFg'].includes(action)) toRefresh.push('activity');
    toRefresh.forEach(loadType);
    return j;
  }, [token, userId, loadType]);

  const flash = useCallback((text, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  }, []);

  const user = data.profile?.user;

  const backBtnStyle = { background: 'none', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, color: G, padding: '6px 12px', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 11, cursor: 'pointer', letterSpacing: '.06em', marginBottom: 20, display: 'inline-block' };

  if (pending.has('profile') && !user) {
    return (
      <div>
        <button onClick={onBack} style={backBtnStyle}>← Users</button>
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spin" style={{ margin: '0 auto' }} /></div>
      </div>
    );
  }

  if (data.profile?.error) {
    return (
      <div>
        <button onClick={onBack} style={backBtnStyle}>← Users</button>
        <div style={{ color: '#f87171', padding: 20 }}>Error: {data.profile.error}</div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack} style={backBtnStyle}>← Users</button>

      {msg && (
        <div style={{ background: msg.ok ? 'rgba(74,222,128,0.08)' : 'rgba(220,38,38,0.08)', border: `1px solid ${msg.ok ? 'rgba(74,222,128,0.2)' : 'rgba(220,38,38,0.2)'}`, borderRadius: 8, padding: '8px 14px', marginBottom: 20, color: msg.ok ? '#4ade80' : '#f87171', fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
        </div>
      )}

      <UDHeaderSection          user={user} />
      <UDAccountControlsSection user={user} userId={userId} onAction={doAction} currentUserId={currentUserId} flash={flash} />
      <UDEconomySection         user={user} userId={userId} onAction={doAction} flash={flash} />
      <UDTradesSection          listings={data.listings} escrow={data.escrow} listingsLoading={pending.has('listings')} />
      <UDDisputesSection        data={data.disputes} loading={pending.has('disputes')} />
      <UDReviewsSection         profileData={data.profile} />
      <UDBadgesSection          data={data.grants} userId={userId} onAction={doAction} flash={flash} loading={pending.has('grants')} />
      <UDSubscriptionsSection   user={user} />
      <UDActivitySection        data={data.activity} loading={pending.has('activity')} />
      <UDTokensSection          user={user} />
      <UDNotesSection           user={user} userId={userId} onAction={doAction} flash={flash} />
      <UDAdminLogSection        data={data.admin} loading={pending.has('admin')} />
    </div>
  );
}

// ── Users Tab ──────────────────────────────────────────────────────────────
// ── Requests Tab (Waitlist) ────────────────────────────────────────────────
function RequestsTab({ token }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [approving, setApproving] = useState({}); // userId → true while in-flight
  const [waitlistMode, setWaitlistMode] = useState(null); // null = unknown
  const [modeLoading, setModeLoading] = useState(false);

  const totalPages = Math.ceil(total / 10);

  // Load waitlist_mode from system_config (public read)
  useEffect(() => {
    supabase
      .from('system_config')
      .select('value')
      .eq('key', 'access.waitlist_mode')
      .single()
      .then(({ data }) => {
        const val = data?.value;
        setWaitlistMode(val === true || val === 'true');
      })
      .catch(() => setWaitlistMode(null));
  }, []);

  const load = useCallback(async (p) => {
    setLoading(true); setErr('');
    try {
      const r = await fetch(`/api/admin/tabs?type=waitlist&page=${p}`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setUsers(j.users || []);
      setTotal(j.total || 0);
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(page); }, [load, page]);

  async function grantAccess(userId) {
    setApproving(prev => ({ ...prev, [userId]: true }));
    try {
      const r = await fetch('/api/admin/approve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ userId }),
      });
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      // Remove from list immediately
      setUsers(prev => prev.filter(u => u.id !== userId));
      setTotal(prev => Math.max(0, prev - 1));
    } catch (e) {
      alert('Failed: ' + e.message);
    }
    setApproving(prev => { const n = { ...prev }; delete n[userId]; return n; });
  }

  // #67-redo (Adam): "requests still doesn't allow to click user and show
  // options to let them in". Per-row Reject calls the existing admin/action
  // endpoint to ban-or-mark the user so they don't sit in the queue forever.
  // Same pattern as banUser elsewhere.
  async function rejectRequest(userId, displayName) {
    if (!confirm(`Reject ${displayName || 'user'}? They stay on the waitlist (approved=false) AND get marked banned so they can't retry from the same account.`)) return;
    setApproving(prev => ({ ...prev, [userId]: true }));
    try {
      const r = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: 'banUser', userId, banByIp: false }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
      setTotal(prev => Math.max(0, prev - 1));
    } catch (e) {
      alert('Reject failed: ' + e.message);
    }
    setApproving(prev => { const n = { ...prev }; delete n[userId]; return n; });
  }

  async function approveAll() {
    if (!confirm('Approve ALL waitlisted users? They will immediately gain full access.')) return;
    try {
      const r = await fetch('/api/admin/approve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ approveAll: true }),
      });
      if (!r.ok) { const j = await r.json(); throw new Error(j.error); }
      setUsers([]);
      setTotal(0);
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  }

  async function toggleWaitlistMode(newVal) {
    setModeLoading(true);
    try {
      const r = await fetch('/api/admin/approve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ waitlistMode: newVal }),
      });
      if (!r.ok) { const j = await r.json(); throw new Error(j.error); }
      setWaitlistMode(newVal);
    } catch (e) {
      alert('Failed: ' + e.message);
    }
    setModeLoading(false);
  }

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div>
      {/* Header controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <div className="cinzel" style={{ fontSize: 13, color: G, letterSpacing: 1 }}>Waitlist Requests</div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--mt)', marginTop: 2 }}>
            {total} pending signup{total !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Waitlist mode toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 14px' }}>
            <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--mt)' }}>
              Waitlist mode
            </span>
            <button
              onClick={() => toggleWaitlistMode(!waitlistMode)}
              disabled={modeLoading || waitlistMode === null}
              style={{
                width: 42, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                background: waitlistMode ? '#D4AF37' : 'rgba(255,255,255,0.12)',
                position: 'relative', transition: 'background .2s', flexShrink: 0,
                opacity: modeLoading ? 0.5 : 1,
              }}
              title={waitlistMode ? 'Waitlist ON — click to open site to all' : 'Waitlist OFF — site is open'}
            >
              <span style={{
                position: 'absolute', top: 3, left: waitlistMode ? 22 : 3,
                width: 16, height: 16, borderRadius: '50%',
                background: waitlistMode ? '#080608' : 'rgba(255,255,255,0.5)',
                transition: 'left .2s',
              }} />
            </button>
            <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, color: waitlistMode ? G : 'rgba(255,255,255,0.35)', letterSpacing: '.08em' }}>
              {waitlistMode === null ? '…' : waitlistMode ? 'ON' : 'OFF'}
            </span>
          </div>
          {/* Approve all */}
          {total > 0 && (
            <button
              onClick={approveAll}
              style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 8, color: G, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', padding: '8px 16px', cursor: 'pointer' }}
            >
              Approve All ({total})
            </button>
          )}
        </div>
      </div>

      {loading && <TabSkeleton rows={5} />}
      {!loading && err && (
        <div style={{ color: '#f87171', background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 12, padding: '14px 18px', fontSize: 13 }}>
          Error: {err}
        </div>
      )}

      {!loading && !err && users.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase' }}>
          No pending signups
        </div>
      )}

      {!loading && !err && users.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Username', 'Email', 'Signed Up', 'Status', ''].map(h => (
                  <th key={h} style={{ ...hcell, textAlign: 'left', paddingBottom: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}
                    onClick={(e) => {
                      // #67-redo: click anywhere on the row (except the
                      // action buttons) opens the user-detail panel for
                      // vetting before approve/reject.
                      if (e.target.closest('button')) return;
                      if (typeof window !== 'undefined') {
                        window.location.assign(`/admin-panel/?userDetail=${u.id}`);
                      }
                    }}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <td style={{ ...cell, color: 'var(--fg)', fontWeight: 600, maxWidth: 160 }}>{u.display_name || '—'}</td>
                  <td style={{ ...cell, maxWidth: 220 }}>
                    {u.email || '—'}
                    {u.email?.endsWith('@auth.d4jsp.local') && (
                      <span style={{ marginLeft: 6, fontSize: 8, padding: '1px 6px', borderRadius: 4, background: 'rgba(0,116,224,0.12)', border: '1px solid rgba(0,116,224,0.3)', color: '#60a5fa', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em' }}>BNet</span>
                    )}
                  </td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>{fmtDate(u.created_at)}</td>
                  <td style={cell}>
                    <span style={{ display: 'inline-block', background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.2)', borderRadius: 5, padding: '2px 8px', fontSize: 9, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em', color: '#facc15' }}>
                      Waiting
                    </span>
                  </td>
                  <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => grantAccess(u.id)}
                      disabled={!!approving[u.id]}
                      style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 7, color: '#4ade80', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap', opacity: approving[u.id] ? 0.5 : 1, marginRight: 6 }}
                    >
                      {approving[u.id] ? '…' : '✓ Approve'}
                    </button>
                    <button
                      onClick={() => rejectRequest(u.id, u.display_name)}
                      disabled={!!approving[u.id]}
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, color: '#f87171', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap', opacity: approving[u.id] ? 0.5 : 1 }}
                    >
                      ✗ Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ background: 'none', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 6, color: G, padding: '5px 12px', cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 11 }}>Prev</button>
              <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, color: 'var(--mt)' }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ background: 'none', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 6, color: G, padding: '5px 12px', cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 11 }}>Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UsersTab({ token, currentUserId }) {
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Drill-in: render detail view inside the container when a user is selected
  if (selectedUserId) {
    return (
      <UserDetailView
        userId={selectedUserId}
        token={token}
        currentUserId={currentUserId}
        onBack={() => setSelectedUserId(null)}
      />
    );
  }

  return <UsersListView token={token} currentUserId={currentUserId} onSelect={setSelectedUserId} />;
}

// Extracted list view so UsersTab state reset is clean on drill-in/out
// XP thresholds for rank filter groups derived from RANKS
const RANK_XP = {
  'rank_1_10':  { xp_min: 0,     xp_max: 19899  },
  'rank_11_25': { xp_min: 24700, xp_max: 51199  },
  'rank_26_50': { xp_min: 59800, xp_max: undefined },
};

// Account-age ISO strings relative to now
function ageParam(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

const AGE_OPTIONS = [
  { value: 'any',    label: 'Any age' },
  { value: '7',     label: '< 1 week' },
  { value: '30',    label: '< 1 month' },
  { value: '90',    label: '< 3 months' },
  { value: '365',   label: '< 1 year' },
  { value: 'old',   label: '1+ year' },
];

function UsersListView({ token, currentUserId, onSelect }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ gold: 'any', rank: 'any', age: 'any', membership: 'any' });

  const totalPages = Math.ceil(total / 10);
  const activeFilterCount = Object.values(filters).filter(v => v !== 'any').length;

  function buildFilterParams(f) {
    const p = new URLSearchParams();
    if (f.gold === 'zero')   { p.set('fg_max', '0'); }
    if (f.gold === '1_999')  { p.set('fg_min', '1'); p.set('fg_max', '999'); }
    if (f.gold === '1k_9k')  { p.set('fg_min', '1000'); p.set('fg_max', '9999'); }
    if (f.gold === '10k_plus') { p.set('fg_min', '10000'); }
    if (f.rank !== 'any' && RANK_XP[f.rank]) {
      const r = RANK_XP[f.rank];
      p.set('xp_min', String(r.xp_min));
      if (r.xp_max !== undefined) p.set('xp_max', String(r.xp_max));
    }
    if (f.membership !== 'any') p.set('membership', f.membership);
    if (f.age !== 'any') {
      if (f.age === 'old') {
        p.set('joined_before', ageParam(365));
      } else {
        p.set('joined_after', ageParam(parseInt(f.age, 10)));
      }
    }
    return p.toString() ? '&' + p.toString() : '';
  }

  const load = useCallback(async (p, f) => {
    setLoading(true); setErr('');
    try {
      let authToken = token;
      if (!authToken) throw new Error('No auth token — reload the page');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let r;
      try {
        r = await fetch(`/api/admin/tabs?type=users&page=${p}${buildFilterParams(f)}`, {
          headers: { Authorization: 'Bearer ' + authToken },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      console.log('[UsersTab] page', p, 'loaded', j.total, 'total');
      setUsers(j.users || []);
      setTotal(j.total || 0);
    } catch (e) {
      const msg = e.name === 'AbortError' ? 'Request timed out after 10s' : e.message;
      console.error('[UsersTab] load failed:', e);
      setErr(msg);
    }
    setLoading(false);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(page, filters); }, [load, page, filters]);

  function setFilter(key, val) {
    setFilters(prev => {
      const next = { ...prev, [key]: val };
      setPage(1);
      return next;
    });
  }

  function clearFilters() {
    setFilters({ gold: 'any', rank: 'any', age: 'any', membership: 'any' });
    setPage(1);
  }

  const selectStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(212,175,55,0.18)',
    borderRadius: 8,
    color: '#fff',
    fontSize: 11,
    fontFamily: "'Barlow Condensed',sans-serif",
    fontWeight: 700,
    padding: '5px 8px',
    cursor: 'pointer',
    outline: 'none',
    flex: 1,
    minWidth: 0,
  };

  if (loading) return <TabSkeleton rows={8} />;
  if (err) return (
    <div style={{ color: '#f87171', background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 12, padding: '16px 20px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span>{err}</span>
      <button onClick={() => load(page, filters)} style={{ background: 'none', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 8, color: '#f87171', padding: '6px 14px', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '.06em' }}>
        Retry
      </button>
    </div>
  );

  const filtered = search.trim()
    ? users.filter(u => {
        const q = search.toLowerCase();
        return (u.display_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
      })
    : users;

  return (
    <div>
      {/* Search bar + filter button */}
      <div style={{ display: 'flex', gap: 8, marginBottom: filterOpen ? 8 : 16 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, opacity: 0.4, pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 10, padding: '9px 12px 9px 36px', color: '#fff', fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", outline: 'none' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--mt)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 4 }}>✕</button>
          )}
        </div>
        <button
          onClick={() => setFilterOpen(o => !o)}
          style={{
            background: filterOpen || activeFilterCount > 0 ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${activeFilterCount > 0 ? 'rgba(212,175,55,0.4)' : 'rgba(212,175,55,0.15)'}`,
            borderRadius: 10,
            color: activeFilterCount > 0 ? G : 'var(--mt)',
            fontSize: 13,
            fontFamily: "'Barlow Condensed',sans-serif",
            fontWeight: 700,
            padding: '9px 14px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            letterSpacing: '.04em',
            flexShrink: 0,
          }}
        >
          ⚙ Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      {/* Filter panel */}
      {filterOpen && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.12)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 90 }}>
              <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 9, fontWeight: 900, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--mt)' }}>Gold (FG)</span>
              <select value={filters.gold} onChange={e => setFilter('gold', e.target.value)} style={selectStyle}>
                <option value="any">Any amount</option>
                <option value="zero">0 FG</option>
                <option value="1_999">1 – 999</option>
                <option value="1k_9k">1k – 9,999</option>
                <option value="10k_plus">10,000+</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 90 }}>
              <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 9, fontWeight: 900, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--mt)' }}>Rank</span>
              <select value={filters.rank} onChange={e => setFilter('rank', e.target.value)} style={selectStyle}>
                <option value="any">Any rank</option>
                <option value="rank_1_10">1–10 (Novice)</option>
                <option value="rank_11_25">11–25 (Mid)</option>
                <option value="rank_26_50">26–50 (Elite)</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 90 }}>
              <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 9, fontWeight: 900, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--mt)' }}>Account Age</span>
              <select value={filters.age} onChange={e => setFilter('age', e.target.value)} style={selectStyle}>
                {AGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 90 }}>
              <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 9, fontWeight: 900, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--mt)' }}>Subscription</span>
              <select value={filters.membership} onChange={e => setFilter('membership', e.target.value)} style={selectStyle}>
                <option value="any">Any tier</option>
                <option value="free">Free</option>
                <option value="premium">Premium</option>
                <option value="vip">VIP</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </div>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} style={{ background: 'none', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, color: '#f87171', fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, padding: '5px 12px', cursor: 'pointer', letterSpacing: '.06em', flexShrink: 0, alignSelf: 'flex-end' }}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.2em', color: 'var(--mt)' }}>
          {search ? `${filtered.length} match${filtered.length !== 1 ? 'es' : ''} on page` : `${total.toLocaleString()} users · page ${page} of ${totalPages || 1}`}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(u => (
          <UserCard key={u.id} user={u} token={token} currentUserId={currentUserId} onRefresh={() => load(page)} onSelect={onSelect} />
        ))}
        {filtered.length === 0 && <div style={{ color: 'var(--mt)', fontSize: 12, padding: 20 }}>{search ? 'No users match that search.' : 'No users found.'}</div>}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(212,175,55,0.08)' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ background: 'none', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, color: page <= 1 ? 'rgba(255,255,255,0.15)' : G, padding: '7px 18px', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 12, cursor: page <= 1 ? 'not-allowed' : 'pointer', letterSpacing: '.06em' }}
          >
            ← Prev
          </button>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 11, color: 'var(--mt)', letterSpacing: '.1em' }}>
            {page} / {totalPages}
          </div>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ background: 'none', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, color: page >= totalPages ? 'rgba(255,255,255,0.15)' : G, padding: '7px 18px', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 12, cursor: page >= totalPages ? 'not-allowed' : 'pointer', letterSpacing: '.06em' }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ── AI Key Usage Card ──────────────────────────────────────────────────────
const PROVIDERS = ['gemini'];

function AiUsageCard({ token }) {
  const [usage, setUsage] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch('/api/admin/ai-usage', { headers: { Authorization: 'Bearer ' + token } });
      if (r.ok) setUsage(await r.json());
    } catch {}
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div style={{ background: 'linear-gradient(135deg,#0e0c10,#111018)', border: '1px solid rgba(212,175,55,0.12)', borderRadius: 16, padding: '20px 20px 18px', marginBottom: 28 }}>
      <div className="cinzel" style={{ fontSize: 13, color: G, letterSpacing: 1.5, marginBottom: 16 }}>AI Key Usage</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {PROVIDERS.map(p => {
          const limit = usage?.limits?.[p] ?? 0;
          const used  = usage?.[p] ?? 0;
          const pct   = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
          const bar   = pct < 60 ? '#4ade80' : pct < 85 ? '#facc15' : '#f87171';
          return (
            <div key={p}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--sub)' }}>{p}</span>
                {limit === 0
                  ? <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Not configured</span>
                  : <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, color: bar }}>{used.toLocaleString()} / {limit.toLocaleString()}</span>
                }
              </div>
              <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                {limit > 0 && (
                  <div style={{ height: '100%', width: pct + '%', borderRadius: 4, background: bar, transition: 'width .4s ease' }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SpecialsTab ────────────────────────────────────────────────────────────
// Top-level admin tab. Lists all specials with toggle + progress + create form.
function SpecialsTab({ token }) {
  const [specials, setSpecials] = useState([]);
  const [triggers, setTriggers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form state
  const [form, setForm] = useState({ name: '', description: '', icon: '🎁', trigger_id: '', target_count: '', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [spRes, trRes] = await Promise.all([
      fetch('/api/admin/specials', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
      fetch('/api/admin/specials?view=triggers', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
    ]);
    setSpecials(spRes.specials || []);
    setTriggers(trRes.triggers || []);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const flash = (m, ok = false) => { setMsg({ text: m, ok }); setTimeout(() => setMsg(''), 4000); };

  const toggleSpecial = async (id, enabled) => {
    setSpecials(prev => prev.map(s => s.id === id ? { ...s, enabled } : s));
    const r = await fetch('/api/admin/specials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'update', id, enabled }),
    });
    const j = await r.json();
    if (!j.ok) { flash('Error: ' + (j.error || 'Failed')); setSpecials(prev => prev.map(s => s.id === id ? { ...s, enabled: !enabled } : s)); }
  };

  const deleteSpecial = async (id, name) => {
    if (!confirm(`Soft-delete special "${name}"? Existing claims are preserved.`)) return;
    const r = await fetch('/api/admin/specials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'delete', id }),
    });
    const j = await r.json();
    if (j.ok) { flash('Deleted', true); setSpecials(prev => prev.filter(s => s.id !== id)); }
    else flash('Error: ' + (j.error || 'Failed'));
  };

  const createSpecial = async () => {
    if (!form.name.trim()) return flash('Name required');
    if (!form.trigger_id) return flash('Select a trigger');
    setCreating(true);
    const r = await fetch('/api/admin/specials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        action: 'create',
        name: form.name.trim(),
        description: form.description.trim() || null,
        icon: form.icon.trim() || '🎁',
        trigger_id: form.trigger_id,
        target_count: form.target_count ? parseInt(form.target_count, 10) : null,
        notes: form.notes.trim() || null,
      }),
    });
    const j = await r.json();
    setCreating(false);
    if (!j.ok) return flash('Error: ' + (j.error || 'Failed'));
    flash('Special created', true);
    setForm({ name: '', description: '', icon: '🎁', trigger_id: '', target_count: '', notes: '' });
    setShowCreate(false);
    load();
  };

  const inputS = { background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 6, padding: '6px 10px', color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' };
  const selectS = { ...inputS, appearance: 'none', cursor: 'pointer' };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spin" style={{ margin: '0 auto' }} /></div>;

  return (
    <div>
      {msg && (
        <div style={{ background: msg.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${msg.ok ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`, borderRadius: 8, padding: '8px 14px', marginBottom: 14, color: msg.ok ? '#4ade80' : '#f87171', fontSize: 11 }}>{msg.text}</div>
      )}

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.2em', color: 'var(--mt)' }}>
          Specials — named grant bundles fired by trigger events
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(212,175,55,0.3)', background: showCreate ? 'rgba(212,175,55,0.12)' : 'none', color: G, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, textTransform: 'uppercase', cursor: 'pointer', letterSpacing: '.06em' }}
        >{showCreate ? 'Cancel' : '+ New Special'}</button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.12)', borderRadius: 12, padding: '16px 18px', marginBottom: 18 }}>
          <div className="cinzel" style={{ fontSize: 11, color: G, marginBottom: 14, letterSpacing: 1 }}>Create Special</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 9, color: 'var(--mt)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Name *</div>
              <input style={inputS} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Founders, Holiday Bonus…" />
            </div>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 9, color: 'var(--mt)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Icon</div>
              <input style={{ ...inputS, width: 60 }} value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="🎁" />
            </div>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 9, color: 'var(--mt)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Trigger *</div>
              <select style={selectS} value={form.trigger_id} onChange={e => setForm(f => ({ ...f, trigger_id: e.target.value }))}>
                <option value="">— select trigger —</option>
                {triggers.map(t => <option key={t.id} value={t.id}>{t.id} — {t.name}{!t.enabled ? ' (stub)' : ''}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 9, color: 'var(--mt)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Cap (blank = unlimited)</div>
              <input style={inputS} type="number" min="1" value={form.target_count} onChange={e => setForm(f => ({ ...f, target_count: e.target.value }))} placeholder="100" />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 9, color: 'var(--mt)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Description</div>
            <input style={inputS} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description shown to users" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 9, color: 'var(--mt)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Notes (internal)</div>
            <input style={inputS} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Admin notes…" />
          </div>
          <div style={{ fontSize: 10, color: 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 14 }}>
            Grants are added as rules via SQL after creation. Add {'{type:"badge",id:"veterans"}'} or {'{type:"skill",id:"<uuid>"}'} entries.
          </div>
          <button
            onClick={createSpecial}
            disabled={creating}
            style={{ padding: '7px 20px', borderRadius: 8, border: `1px solid ${G}`, background: 'rgba(212,175,55,0.1)', color: G, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 11, textTransform: 'uppercase', cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.6 : 1, letterSpacing: '.08em' }}
          >{creating ? 'Creating…' : 'Create Special'}</button>
        </div>
      )}

      {/* Specials list */}
      {specials.length === 0 && !showCreate && (
        <div style={{ color: 'var(--mt)', fontSize: 12, padding: '20px 0' }}>No specials yet. Create one above.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {specials.map(sp => {
          const capReached = sp.target_count !== null && sp.claimed_count >= sp.target_count;
          const progress = sp.target_count ? `${sp.claimed_count} / ${sp.target_count}` : `${sp.claimed_count} claimed`;
          const grants = (sp.special_rules || []).flatMap(r => r.grants || []);
          return (
            <div key={sp.id} style={{ background: 'rgba(10,8,12,0.5)', border: `1px solid ${sp.enabled && !capReached ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>{sp.icon || '🎁'}</span>
                    <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 13, color: sp.enabled ? G : '#6a6078' }}>{sp.name}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#a78bfa', background: 'rgba(167,139,250,0.08)', borderRadius: 4, padding: '1px 5px' }}>{sp.trigger_id}</span>
                    {capReached && <span style={{ fontSize: 9, color: '#f87171', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, textTransform: 'uppercase' }}>CAPPED</span>}
                  </div>
                  {sp.description && <div style={{ fontSize: 11, color: 'var(--sub)', marginBottom: 4 }}>{sp.description}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, color: capReached ? '#f87171' : '#4ade80' }}>{progress}</span>
                    {grants.length > 0 && (
                      <span style={{ fontFamily: 'monospace', fontSize: 9, color: 'var(--mt)' }}>
                        {grants.map((g, i) => <span key={i} style={{ marginRight: 6 }}>{g.type}:{g.id?.slice(0, 8) || g.id}</span>)}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => toggleSpecial(sp.id, !sp.enabled)}
                    style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: sp.enabled ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.04)', color: sp.enabled ? '#4ade80' : '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', cursor: 'pointer', letterSpacing: '.06em' }}
                  >{sp.enabled ? 'On' : 'Off'}</button>
                  <button
                    onClick={() => deleteSpecial(sp.id, sp.name)}
                    style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'rgba(248,113,113,0.06)', color: '#f87171', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', cursor: 'pointer', letterSpacing: '.04em' }}
                  >Del</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ActivityTab → moved to components/admin/ActivityTab.js (dynamic import at top)
// SystemConfigPanel → moved to components/admin/SystemConfigPanel.js (dynamic import at top)

// ── SystemConfigPanel ─────────────────────────────────────────────────────
// Moved to components/admin/SystemConfigPanel.js — dynamically imported above.
// Renamed below to avoid naming conflict with the dynamic import.
// Global system_config only. Per-tier limits live in subscription_tiers.
// Two-level UI: collapsible sections → row accordion (click key to edit).
const CATEGORY_LABELS = {
  escrow:       { label: 'Escrow',        color: '#a78bfa' },
  trade:        { label: 'Trade',         color: '#60a5fa' },
  account:      { label: 'Account',       color: '#4ade80' },
  currency:     { label: 'Currency',      color: '#facc15' },
  raffle:       { label: 'Raffle',        color: '#f472b6' },
  xp:           { label: 'XP',            color: '#fb923c' },
  rate_limit:   { label: 'Rate Limits',   color: '#f87171' },
  ai:           { label: 'AI',            color: '#38bdf8' },
  penalty:      { label: 'Penalties',     color: '#f87171' },
  auction:      { label: 'Auction',       color: '#38bdf8' },
  fee:          { label: 'Fees',          color: '#facc15' },
  dispute:      { label: 'Disputes',      color: '#f472b6' },
  moderation:   { label: 'Moderation',    color: '#94a3b8' },
  item_rules:   { label: 'Item Rules',    color: '#60a5fa' },
  notification: { label: 'Notifications', color: '#34d399' },
  maintenance:  { label: 'Maintenance',   color: '#ef4444' },
};
// Per-tier settings live in subscription_tiers — exclude from global panel.
const PER_TIER_CATEGORIES = new Set(['trust']);

function _SystemConfigPanelLegacy({ token }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [edits, setEdits] = useState({});
  const [msg, setMsg] = useState('');
  // sections collapsed by default; openRow = key of currently open row accordion
  const [openSections, setOpenSections] = useState({});
  const [openRow, setOpenRow] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/config', { headers: { Authorization: 'Bearer ' + token } });
      const j = await r.json();
      if (j.config) {
        setRows(j.config);
        const init = {};
        j.config.forEach(row => { init[row.key] = JSON.stringify(row.value); });
        setEdits(init);
      }
    } catch (e) { console.error('[SystemConfig] load failed', e); }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const flash = (m, ok = false) => { setMsg({ text: m, ok }); setTimeout(() => setMsg(''), 4000); };

  const save = async (key, valueType) => {
    setSaving(s => ({ ...s, [key]: true }));
    try {
      let parsed;
      const raw = edits[key];
      if (valueType === 'boolean') {
        parsed = raw === 'true' || raw === true;
      } else if (valueType === 'number') {
        parsed = Number(raw);
        if (isNaN(parsed)) { flash(`${key}: invalid number`); setSaving(s => ({ ...s, [key]: false })); return; }
      } else if (valueType === 'json') {
        try { parsed = JSON.parse(raw); } catch { flash(`${key}: invalid JSON`); setSaving(s => ({ ...s, [key]: false })); return; }
      } else {
        parsed = raw;
      }
      const r = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: 'set', key, value: parsed }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'Save failed');
      flash(key + ' saved', true);
      setRows(prev => prev.map(row => row.key === key ? { ...row, value: parsed } : row));
    } catch (e) { flash(key + ': ' + e.message); }
    setSaving(s => ({ ...s, [key]: false }));
  };

  const reset = async (key) => {
    setSaving(s => ({ ...s, [key + '_reset']: true }));
    try {
      const r = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: 'reset', key }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'Reset failed');
      flash(key + ' reset to default', true);
      load();
    } catch (e) { flash(key + ': ' + e.message); }
    setSaving(s => ({ ...s, [key + '_reset']: false }));
  };

  // Group rows by category, skipping per-tier categories
  const grouped = useMemo(() => {
    const map = {};
    rows.forEach(r => {
      if (PER_TIER_CATEGORIES.has(r.category)) return;
      if (!map[r.category]) map[r.category] = [];
      map[r.category].push(r);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const inputS = {
    background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(212,175,55,0.15)',
    borderRadius: 6, padding: '6px 10px', color: '#e8e0f0',
    fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, outline: 'none',
    maxWidth: 320, width: '100%', boxSizing: 'border-box',
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spin" style={{ margin: '0 auto' }} /></div>;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div className="cinzel" style={{ fontSize: 15, color: G, letterSpacing: 1, marginBottom: 4 }}>System Config</div>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 9, color: 'var(--mt)', textTransform: 'uppercase', letterSpacing: '.2em' }}>
          {rows.length} global settings — changes live within 60s. All writes logged.
        </div>
      </div>

      {msg && (
        <div style={{ background: msg.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${msg.ok ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`, borderRadius: 8, padding: '8px 14px', marginBottom: 16, color: msg.ok ? '#4ade80' : '#f87171', fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>
          {msg.text}
        </div>
      )}

      {grouped.map(([category, catRows]) => {
        const catMeta = CATEGORY_LABELS[category] || { label: category, color: '#9ca3af' };
        const isOpen = !!openSections[category];
        return (
          <div key={category} style={{ marginBottom: 6, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, overflow: 'hidden' }}>
            {/* Section header — click to expand/collapse */}
            <button
              onClick={() => setOpenSections(s => ({ ...s, [category]: !s[category] }))}
              style={{ width: '100%', background: isOpen ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)', border: 'none', padding: '11px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
            >
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: catMeta.color, flexShrink: 0 }} />
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, color: catMeta.color, fontWeight: 700, letterSpacing: 1, flex: 1 }}>{catMeta.label}</div>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 9, color: 'var(--mt)', textTransform: 'uppercase', marginRight: 6 }}>{catRows.length}</div>
              <div style={{ color: 'var(--mt)', fontSize: 9 }}>{isOpen ? '▲' : '▼'}</div>
            </button>

            {isOpen && (
              <div>
                {catRows.map(row => {
                  const isRowOpen = openRow === row.key;
                  const editVal = edits[row.key] ?? JSON.stringify(row.value);
                  const isDirty = editVal !== JSON.stringify(row.value);
                  const isDefault = JSON.stringify(row.value) === JSON.stringify(row.ship_default);
                  const isSaving = saving[row.key];
                  const isResetting = saving[row.key + '_reset'];
                  return (
                    <div key={row.key} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      {/* Row header — click to open accordion */}
                      <button
                        onClick={() => setOpenRow(isRowOpen ? null : row.key)}
                        style={{ width: '100%', background: isRowOpen ? 'rgba(255,255,255,0.025)' : isDirty ? 'rgba(212,175,55,0.03)' : 'transparent', border: 'none', padding: '9px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
                      >
                        <span style={{ fontFamily: 'monospace', fontSize: 10, color: isDirty ? G : catMeta.color, flex: 1 }}>{row.key}</span>
                        {isDirty && <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 8, color: G, textTransform: 'uppercase', fontWeight: 900 }}>unsaved</span>}
                        {!isDefault && !isDirty && <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 8, color: '#6a6078', textTransform: 'uppercase' }}>modified</span>}
                        <span style={{ color: 'var(--mt)', fontSize: 8, marginLeft: 4 }}>{isRowOpen ? '▲' : '▼'}</span>
                      </button>

                      {/* Expanded — value editor */}
                      {isRowOpen && (
                        <div style={{ padding: '10px 16px 14px', background: 'rgba(0,0,0,0.2)' }}>
                          {row.label && <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 11, color: '#c0b8d0', marginBottom: 3 }}>{row.label}</div>}
                          {row.description && <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, color: '#6a6078', marginBottom: 10 }}>{row.description}</div>}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                            {row.value_type === 'boolean' ? (
                              <button
                                onClick={() => setEdits(e => ({ ...e, [row.key]: editVal === 'true' ? 'false' : 'true' }))}
                                style={{ padding: '5px 14px', borderRadius: 6, border: `1px solid ${editVal === 'true' ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.08)'}`, background: editVal === 'true' ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.02)', color: editVal === 'true' ? '#4ade80' : '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 11, textTransform: 'uppercase', cursor: 'pointer' }}
                              >
                                {editVal === 'true' ? 'Enabled' : 'Disabled'}
                              </button>
                            ) : (
                              <input
                                value={editVal}
                                onChange={e => setEdits(prev => ({ ...prev, [row.key]: e.target.value }))}
                                style={inputS}
                              />
                            )}
                            <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 8, color: '#4a4058', textTransform: 'uppercase' }}>{row.value_type}</span>
                            {!isDefault && <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#4a4058' }}>default: {JSON.stringify(row.ship_default)}</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => save(row.key, row.value_type)}
                              disabled={isSaving || !isDirty}
                              style={{ padding: '5px 14px', borderRadius: 6, border: `1px solid ${isDirty ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.06)'}`, background: isDirty ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.02)', color: isDirty ? G : '#4a4058', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, textTransform: 'uppercase', cursor: isDirty ? 'pointer' : 'default', opacity: isSaving ? 0.6 : 1, letterSpacing: '.06em' }}
                            >
                              {isSaving ? '…' : 'Save'}
                            </button>
                            {!isDefault && (
                              <button
                                onClick={() => reset(row.key)}
                                disabled={isResetting}
                                style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.06)', color: '#f87171', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, textTransform: 'uppercase', cursor: 'pointer', opacity: isResetting ? 0.6 : 1 }}
                              >
                                {isResetting ? '…' : 'Reset'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {rows.length === 0 && (
        <div style={{ color: '#6a6078', fontSize: 12, padding: 40, textAlign: 'center' }}>
          No config rows found. Run migration 016_system_config.sql to seed defaults.
        </div>
      )}
    </div>
  );
}
// ── ConfigsTab ────────────────────────────────────────────────────────────
// DB-backed CRUD for the config_fields table.
// Each row is one configurable field type (duration_minutes, tokens, etc.)
// that appears as a checkbox option in every catalogue item's dials picker.
// Usage count = # skills + # badges that have selected this field in dials.fields.
function ConfigsTab({ token, configFields, onReload }) {
  const [showCreate, setShowCreate] = useState(false);
  const [msg, setMsg] = useState('');
  const [usageCounts, setUsageCounts] = useState({}); // { key: count }
  const [createForm, setCreateForm] = useState({ key: '', label: '', type: 'number', nullable: false, nullable_label: '', sort_order: 0 });

  const api = useCallback(async (method, body) => {
    const opts = { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch('/api/admin/config-fields', opts);
    return r.json();
  }, [token]);

  const flash = (m, ok = false) => { setMsg({ text: m, ok }); setTimeout(() => setMsg(''), 4000); };

  // Load usage counts by scanning skills + badges dials.fields
  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch('/api/admin/skills', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()).catch(() => ({})),
      fetch('/api/admin/badges', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()).catch(() => ({})),
    ]).then(([skillsRes, badgesRes]) => {
      const counts = {};
      const items = [...(skillsRes.skills || []), ...(badgesRes.badges || [])];
      items.forEach(item => {
        const fields = item.dials?.fields || [];
        fields.forEach(f => { counts[f.key] = (counts[f.key] || 0) + 1; });
      });
      setUsageCounts(counts);
    });
  }, [token, configFields]);

  const createField = async () => {
    if (!createForm.key.trim()) return flash('Key required');
    if (!createForm.label.trim()) return flash('Label required');
    const j = await api('POST', { action: 'create', ...createForm });
    if (j.error) return flash('Error: ' + j.error);
    flash('Config field added', true);
    setShowCreate(false);
    setCreateForm({ key: '', label: '', sort_order: 0, type: 'number', nullable: false, nullable_label: '' });
    onReload();
  };

  const deleteField = async (id, key) => {
    if (!confirm(`Delete config field "${key}"? Existing dials data using this key is preserved but the field won't appear in pickers.`)) return;
    const j = await api('POST', { action: 'delete', id });
    if (j.error) return flash('Error: ' + j.error);
    flash('Deleted', true);
    onReload();
  };

  const iS = { background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 6, padding: '6px 10px', color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' };
  const bS = { padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.08)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, textTransform: 'uppercase', cursor: 'pointer', color: G, letterSpacing: '.08em' };
  const lbl = (t) => <div style={{ fontSize: 9, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3 }}>{t}</div>;

  return (
    <div>
      {msg && <div style={{ background: msg.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${msg.ok ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`, borderRadius: 8, padding: '8px 14px', marginBottom: 14, color: msg.ok ? '#4ade80' : '#f87171', fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{msg.text}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 9, color: '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.15em' }}>
          {configFields.length} config field types · shown in all catalogue item dials pickers
        </div>
        <button onClick={() => setShowCreate(v => !v)} style={bS}>{showCreate ? 'Cancel' : '+ Add Field'}</button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.12)', borderRadius: 12, padding: '16px 18px', marginBottom: 18 }}>
          <div className="cinzel" style={{ fontSize: 11, color: G, marginBottom: 14, letterSpacing: 1 }}>New Config Field Type</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>{lbl('Key (snake_case)')}<input style={iS} value={createForm.key} onChange={e => setCreateForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))} placeholder="e.g. cooldown_minutes" /></div>
            <div>{lbl('Label')}<input style={iS} value={createForm.label} onChange={e => setCreateForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Cooldown (minutes)" /></div>
            <div>{lbl('Type')}
              <select style={{ ...iS, appearance: 'none', cursor: 'pointer' }} value={createForm.type} onChange={e => setCreateForm(f => ({ ...f, type: e.target.value }))}>
                <option value="number">number</option>
                <option value="boolean">boolean</option>
                <option value="date">date</option>
                <option value="text">text</option>
              </select>
            </div>
            <div>{lbl('Sort Order')}<input type="number" style={iS} value={createForm.sort_order} onChange={e => setCreateForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 14 }}>
              <input type="checkbox" id="cf-nullable" checked={createForm.nullable} onChange={e => setCreateForm(f => ({ ...f, nullable: e.target.checked }))} style={{ width: 14, height: 14, accentColor: G }} />
              <label htmlFor="cf-nullable" style={{ fontSize: 11, color: '#9a8eb0', fontFamily: "'Barlow Condensed',sans-serif", cursor: 'pointer' }}>Nullable (supports ∞/none)</label>
            </div>
            {createForm.nullable && (
              <div>{lbl('Null Label (e.g. Unlimited)')}<input style={iS} value={createForm.nullable_label} onChange={e => setCreateForm(f => ({ ...f, nullable_label: e.target.value }))} placeholder="Unlimited" /></div>
            )}
          </div>
          <button onClick={createField} style={bS}>Create</button>
        </div>
      )}

      {/* Fields table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Key', 'Label', 'Type', 'Nullable', 'Null Label', 'Sort', 'Used by', ''].map(h => (
                <th key={h} style={hcell}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {configFields.map(f => {
              const count = usageCounts[f.key] || 0;
              const isNew = !SEED_KEYS.has(f.key);
              return (
                <tr key={f._id || f.key}>
                  <td style={{ ...cell, fontFamily: 'monospace', color: G }}>
                    {f.key}
                    {isNew && <span style={{ marginLeft: 5, width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', verticalAlign: 'middle' }} title="New field — not in original seed" />}
                  </td>
                  <td style={cell}>{f.label}</td>
                  <td style={cell}>{f.type}</td>
                  <td style={cell}>{f.nullable ? '✓' : '—'}</td>
                  <td style={{ ...cell, color: '#6a6078' }}>{f.nullable_label || '—'}</td>
                  <td style={cell}>{f.sort_order ?? 0}</td>
                  <td style={{ ...cell, color: count > 0 ? '#4ade80' : '#6a6078' }}>{count > 0 ? count : '—'}</td>
                  <td style={cell}>
                    {f._id && (
                      <button onClick={() => deleteField(f._id, f.key)}
                        style={{ padding: '2px 8px', borderRadius: 4, border: 'none', background: 'rgba(248,113,113,0.08)', color: '#f87171', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 9, textTransform: 'uppercase', cursor: 'pointer' }}>Del</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── BadgesDbPanel ─────────────────────────────────────────────────────────
// Full CRUD for the `badges` table (award badges like "Veteran").
// Distinct from the badge-type cosmetic skills — these are named achievement badges.
function BadgesDbPanel({ token, configFields = MASTER_CONFIG_FIELDS }) {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ id: '', name: '', description: '', icon_url: '', color: '#D4AF37', category: 'general', dials_raw: {}, dials_fields: [] });

  const api = useCallback(async (method, body) => {
    const opts = { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch('/api/admin/badges', opts);
    return r.json();
  }, [token]);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await api('GET');
    if (j.badges) setBadges(j.badges);
    setLoading(false);
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const flash = (m, ok = false) => { setMsg({ text: m, ok }); setTimeout(() => setMsg(''), 4000); };

  const startEdit = (b) => {
    if (editingId === b.id) { setEditingId(null); return; }
    setEditingId(b.id);
    setEditForm({
      name: b.name,
      description: b.description || '',
      icon_url: b.icon_url || '',
      color: b.color || '#D4AF37',
      category: b.category || 'general',
      dials_raw: b.dials || {},
      dials_fields: (b.dials?.fields || []).map(f => f.key).filter(k => configFields.some(m => m.key === k)),
    });
  };

  const saveEdit = async (id) => {
    const checkedFields = (editForm.dials_fields || [])
      .map(k => configFields.find(m => m.key === k))
      .filter(Boolean);
    const j = await api('POST', {
      action: 'update', id,
      name: editForm.name,
      description: editForm.description,
      icon_url: editForm.icon_url,
      color: editForm.color,
      category: editForm.category,
      dials: { ...(editForm.dials_raw || {}), fields: checkedFields },
    });
    if (j.error) return flash('Error: ' + j.error);
    flash('Badge updated', true);
    setEditingId(null);
    load();
  };

  const deleteBadge = async (id, name) => {
    if (!confirm(`Delete badge "${name}"? This also removes it from all users.`)) return;
    const j = await api('POST', { action: 'delete', id });
    if (j.error) return flash('Error: ' + j.error);
    flash('Badge deleted', true);
    setBadges(prev => prev.filter(b => b.id !== id));
  };

  const createBadge = async () => {
    if (!createForm.id.trim()) return flash('Slug (id) required');
    if (!createForm.name.trim()) return flash('Name required');
    const checkedFields = (createForm.dials_fields || [])
      .map(k => configFields.find(m => m.key === k))
      .filter(Boolean);
    const j = await api('POST', {
      action: 'create',
      id: createForm.id,
      name: createForm.name,
      description: createForm.description,
      icon_url: createForm.icon_url,
      color: createForm.color,
      category: createForm.category,
      dials: { fields: checkedFields },
    });
    if (j.error) return flash('Error: ' + j.error);
    flash('Badge created', true);
    setShowCreate(false);
    setCreateForm({ id: '', name: '', description: '', icon_url: '', color: '#D4AF37', category: 'general', dials_raw: {}, dials_fields: [] });
    load();
  };

  const iS = { background: 'rgba(10,8,12,0.6)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 6, padding: '6px 10px', color: '#e8e0f0', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' };
  const bS = { padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.08)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, textTransform: 'uppercase', cursor: 'pointer', color: G, letterSpacing: '.08em' };
  const lbl = (t) => <label style={{ display: 'block', fontSize: 9, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3 }}>{t}</label>;

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spin" style={{ margin: '0 auto' }} /></div>;

  return (
    <div>
      {msg && <div style={{ background: msg.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${msg.ok ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`, borderRadius: 8, padding: '8px 14px', marginBottom: 14, color: msg.ok ? '#4ade80' : '#f87171', fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{msg.text}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 9, color: '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.15em' }}>
          {badges.length} award badge{badges.length !== 1 ? 's' : ''} — tap to edit
        </div>
        <button onClick={() => setShowCreate(v => !v)} style={bS}>{showCreate ? 'Cancel' : '+ New Badge'}</button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.12)', borderRadius: 12, padding: '16px 18px', marginBottom: 18 }}>
          <div className="cinzel" style={{ fontSize: 11, color: G, marginBottom: 14, letterSpacing: 1 }}>New Award Badge</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              {lbl('Slug / ID (lowercase, no spaces)')}
              <input style={iS} value={createForm.id} onChange={e => setCreateForm(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s+/g, '_') }))} placeholder="e.g. veteran" />
            </div>
            <div>
              {lbl('Display Name')}
              <input style={iS} value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Veteran" />
            </div>
            <div>
              {lbl('Category')}
              <input style={iS} list="badge-cats" value={createForm.category} onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))} placeholder="general" />
              <datalist id="badge-cats"><option value="general" /><option value="exclusive" /><option value="achievement" /><option value="seasonal" /><option value="rank" /></datalist>
            </div>
            <div>
              {lbl('Color (hex)')}
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="color" value={createForm.color} onChange={e => setCreateForm(f => ({ ...f, color: e.target.value }))} style={{ width: 36, height: 32, padding: 2, borderRadius: 4, border: '1px solid rgba(212,175,55,0.2)', background: 'transparent', cursor: 'pointer' }} />
                <input style={{ ...iS, flex: 1 }} value={createForm.color} onChange={e => setCreateForm(f => ({ ...f, color: e.target.value }))} placeholder="#D4AF37" />
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            {lbl('Description')}
            <input style={iS} value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="What did the user do to earn this?" />
          </div>
          <div style={{ marginBottom: 14 }}>
            {lbl('Icon URL (or leave blank, upload later)')}
            <input style={iS} value={createForm.icon_url} onChange={e => setCreateForm(f => ({ ...f, icon_url: e.target.value }))} placeholder="https://…" />
          </div>
          <ConfigFieldsPicker configFields={configFields} editForm={createForm} setEditForm={setCreateForm} />
          <div style={{ marginTop: 14 }}>
            <button onClick={createBadge} style={bS}>Create Badge</button>
          </div>
        </div>
      )}

      {/* Badge list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {badges.map(b => {
          const isEditing = editingId === b.id;
          return [
            <div key={b.id} onClick={() => startEdit(b)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderRadius: 8, background: isEditing ? 'rgba(212,175,55,0.04)' : 'rgba(255,255,255,0.01)', border: isEditing ? '1px solid rgba(212,175,55,0.2)' : '1px solid transparent' }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: b.color + '20', border: `1px solid ${b.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {b.icon_url ? <img src={b.icon_url} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} /> : <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, color: b.color }}>{b.name[0]}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#e8e0f0', fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif" }}>{b.name}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#6a6078' }}>{b.id}</span>
                  <span style={{ background: b.color + '18', color: b.color, padding: '1px 5px', borderRadius: 3, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>{b.category}</span>
                  {b.holder_count > 0 && <span style={{ fontSize: 9, color: '#a78bfa' }}>{b.holder_count} holders</span>}
                </div>
              </div>
              <span style={{ fontSize: 9, color: '#4a4058', flexShrink: 0 }}>{isEditing ? '▲' : '▼'}</span>
            </div>,
            isEditing && (
              <div key={b.id + '_edit'} style={{ padding: '4px 12px 14px', background: 'rgba(212,175,55,0.03)', borderRadius: '0 0 8px 8px', border: '1px solid rgba(212,175,55,0.12)', borderTop: 'none', marginTop: -2 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxWidth: 460, marginBottom: 10 }}>
                  <div><div style={{ fontSize: 9, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Name</div><input value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={iS} /></div>
                  <div>
                    <div style={{ fontSize: 9, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Color</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input type="color" value={editForm.color || '#D4AF37'} onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))} style={{ width: 30, height: 28, padding: 2, borderRadius: 4, border: '1px solid rgba(212,175,55,0.2)', background: 'transparent', cursor: 'pointer' }} />
                      <input value={editForm.color || ''} onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))} style={{ ...iS, flex: 1 }} placeholder="#D4AF37" />
                    </div>
                  </div>
                  <div><div style={{ fontSize: 9, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Category</div><input list="badge-cats" value={editForm.category || ''} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} style={iS} /></div>
                  <div><div style={{ fontSize: 9, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Icon URL</div><input value={editForm.icon_url || ''} onChange={e => setEditForm(f => ({ ...f, icon_url: e.target.value }))} style={iS} placeholder="https://…" /></div>
                  <div style={{ gridColumn: '1 / -1' }}><div style={{ fontSize: 9, color: '#6a6078', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Description</div><input value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} style={iS} /></div>
                </div>
                <ConfigFieldsPicker configFields={configFields} editForm={editForm} setEditForm={setEditForm} />
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => saveEdit(b.id)} style={bS}>Save</button>
                  <button onClick={(e) => { e.stopPropagation(); deleteBadge(b.id, b.name); }} style={{ ...bS, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.08)' }}>Delete</button>
                </div>
              </div>
            ),
          ];
        })}
      </div>
      {badges.length === 0 && !showCreate && (
        <div style={{ color: '#6a6078', fontSize: 12, padding: 20, textAlign: 'center' }}>No award badges yet. Click "+ New Badge" to create the first one.</div>
      )}
    </div>
  );
}

// ── Main AdminView ─────────────────────────────────────────────────────────
export default function AdminView({ showToast }) {
  const { accessToken, user: ctxUser } = useAuth();
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [token, setToken] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  // Lifted state — shared between RanksTab (editor) and FeaturesTab (matrix display)
  const [rankRewards, setRankRewards] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      // Use auth context token — already loaded, no getSession() call needed
      if (!accessToken) throw new Error('Not authenticated');
      setToken(accessToken);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let res;
      try {
        res = await fetch('/api/admin/data', {
          headers: { Authorization: 'Bearer ' + accessToken },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      console.log('[AdminView] data loaded', json);
      setData(json);
    } catch (e) {
      const msg = e.name === 'AbortError' ? 'Request timed out after 10s' : e.message;
      console.error('[AdminView] load failed:', e);
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [accessToken]); // ctxUser removed — new object reference on every auth re-render caused loadData to re-fire, briefly hiding !loading tabs (including Gold)

  useEffect(() => { loadData(); }, [loadData]);
  // Track currentUserId separately so ctxUser object-reference churn doesn't re-trigger loadData
  useEffect(() => { setCurrentUserId(ctxUser?.uid || ctxUser?.id || ''); }, [ctxUser]);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div className="cinzel" style={{ fontSize: 28, color: G, letterSpacing: 3 }}>Admin Console</div>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.3em', color: 'var(--mt)', marginTop: 4 }}>D4JSP.ORG Management</div>
      </div>

      {/* Tab bar — horizontally scrollable */}
      <div style={{ overflowX: 'auto', borderBottom: '1px solid rgba(212,175,55,0.1)', marginBottom: 28, msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        <div style={{ display: 'flex', gap: 0, minWidth: 'max-content' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{ display: 'inline-block', padding: '10px 20px', background: 'none', border: 'none', borderBottom: tab === t.id ? '2px solid ' + G : '2px solid transparent', fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 11, color: tab === t.id ? G : 'var(--mt)', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* States — only show loading/error for data-dependent tabs */}
      {loading && ['overview','users','activity'].includes(tab) && <TabSkeleton rows={8} />}
      {!loading && err && ['overview','users','activity'].includes(tab) && (
        <div style={{ color: '#f87171', background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 12, padding: '16px 20px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span>Error: {err}</span>
          <button onClick={loadData} style={{ background: 'none', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 8, color: '#f87171', padding: '6px 14px', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '.06em' }}>
            Retry
          </button>
        </div>
      )}

      {/* ── Overview ── */}
      {!loading && !err && data && tab === 'overview' && (
        <div>
          {/* Live count cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 28 }}>
            {[
              { label: 'Users',    value: data.users?.length ?? 0,   color: G },
              { label: 'Threads',  value: data.threads?.length ?? 0, color: '#60a5fa' },
              { label: 'Escrow',   value: data.escrowCount ?? 0,     color: '#a78bfa' },
              { label: 'Messages', value: data.messageCount ?? 0,    color: '#4ade80' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--c2)', border: '1px solid var(--bd2)', borderRadius: 14, padding: '20px 16px', textAlign: 'center' }}>
                <div className="cinzel" style={{ fontSize: 32, color: s.color, fontWeight: 900 }}>{s.value.toLocaleString()}</div>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: 'var(--mt)', marginTop: 6 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <AiUsageCard token={token} />

          {/* Placeholder stat cards */}
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.2em', color: 'var(--mt)', marginBottom: 16 }}>Platform Stats — placeholders, wire up individually</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {DASH_STATS.map(s => (
              <div key={s.label} style={{ background: 'linear-gradient(135deg,#0e0c10,#111018)', border: '1px solid rgba(212,175,55,0.07)', borderRadius: 16, padding: '18px 16px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 18, opacity: 0.18 }}>{s.icon}</div>
                <div className="cinzel" style={{ fontSize: 26, color: s.color, fontWeight: 900, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--mt)', marginTop: 6 }}>{s.label}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 3, fontFamily: "'Barlow Condensed',sans-serif" }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Users ── */}
      {!loading && !err && data && token && tab === 'users' && (
        <UsersTab token={token} currentUserId={currentUserId} />
      )}

      {/* ── Requests (Waitlist) ── */}
      {tab === 'requests' && token && (
        <RequestsTab token={token} />
      )}

      {/* ── Activity (Forum / Trades / Escrows / Disputes / Listings / Feed) ── */}
      {tab === 'activity' && token && (
        <ActivityTab token={token} data={data} loading={loading} />
      )}

      {/* ── Features (Catalogue: Badges/Perms/Skills/Rewards/Quests/Triggers/Assigned; Endpoints: Store/Ranks/Gamble/Specials) ── */}
      {!loading && tab === 'features' && token && (
        <FeaturesTab token={token} rankRewards={rankRewards} setRankRewards={setRankRewards} />
      )}

      {/* ── Currency (Vault + Gems) ── */}
      {!loading && tab === 'gold' && token && (
        <GoldTab token={token} />
      )}

      {/* ── Bots (bot management panel) ── */}
      {tab === 'bots' && token && (
        <BotsTab token={token} />
      )}

      {/* ── Config (system_config full surface) ── */}
      {tab === 'config' && token && (
        <SystemConfigPanel token={token} />
      )}
    </div>
  );
}
