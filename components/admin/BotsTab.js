// Admin → Bots tab
// Full bot management panel: list, create, per-bot controls, activity log, seed controls.
import { useState, useEffect, useCallback } from 'react';

const G = '#D4AF37';
const RED = '#f87171';
const GREEN = '#4ade80';
const BLUE = '#60a5fa';

const PERSONALITIES = [
  { value: 'neutral',    label: 'Neutral' },
  { value: 'angelic',    label: 'Angelic' },
  { value: 'villainous', label: 'Villainous' },
  { value: 'sinister',   label: 'Sinister' },
  { value: 'arcane',     label: 'Arcane' },
  { value: 'scholarly',  label: 'Scholarly' },
  { value: 'gleeful',    label: 'Gleeful' },
  { value: 'curious',    label: 'Curious' },
  { value: 'crafted',    label: 'Crafted' },
  { value: 'terse',      label: 'Terse' },
];

// ── Shared primitives ─────────────────────────────────────────────────────────
function SectionHead({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 11, color: G, letterSpacing: 2, textTransform: 'uppercase' }}>{children}</div>
      {action}
    </div>
  );
}

function Btn({ onClick, children, color = G, disabled, small }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'none',
        border: `1px solid ${color}`,
        color,
        borderRadius: 8,
        padding: small ? '5px 12px' : '7px 16px',
        fontFamily: "'Barlow Condensed',sans-serif",
        fontWeight: 700,
        fontSize: small ? 11 : 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        letterSpacing: '.06em',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >{children}</button>
  );
}

function Toggle({ on, onChange, disabled }) {
  return (
    <div
      onClick={() => !disabled && onChange(!on)}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: on ? G : 'rgba(255,255,255,0.08)',
        border: `1px solid ${on ? G : 'rgba(255,255,255,0.12)'}`,
        position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background .2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 2,
        left: on ? 18 : 2,
        width: 14, height: 14, borderRadius: '50%',
        background: on ? '#080608' : 'rgba(255,255,255,0.3)',
        transition: 'left .2s',
      }} />
    </div>
  );
}

function FreqDial({ label, value, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 9, color: 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase', letterSpacing: '.1em' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          min={5} max={1440} step={5}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          disabled={disabled}
          style={{
            width: 56, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,175,55,0.15)',
            borderRadius: 6, padding: '4px 8px', color: disabled ? 'var(--mt)' : '#fff',
            fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", textAlign: 'center', outline: 'none',
          }}
        />
        <span style={{ fontSize: 9, color: 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif" }}>min</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const active = status === 'active';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: active ? 'rgba(74,222,128,.08)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${active ? 'rgba(74,222,128,.25)' : 'rgba(255,255,255,0.1)'}`,
      color: active ? GREEN : 'var(--mt)',
      borderRadius: 20, padding: '2px 8px', fontSize: 9,
      fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '.1em',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: active ? GREEN : 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
      {active ? 'Active' : 'Paused'}
    </span>
  );
}

function timeAgo(ts) {
  if (!ts) return 'Never';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'Just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Bot card ──────────────────────────────────────────────────────────────────
function BotCard({ bot, token, onSaved, onDeleted }) {
  const [cfg, setCfg] = useState({
    status:             bot.status,
    auto_reply:         bot.auto_reply,
    auto_post:          bot.auto_post,
    view_bump:          bot.view_bump,
    reply_freq_minutes: bot.reply_freq_minutes,
    post_freq_minutes:  bot.post_freq_minutes,
    bump_freq_minutes:  bot.bump_freq_minutes,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  async function save() {
    setSaving(true);
    const r = await fetch('/api/admin/bots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'update_config', bot_user_id: bot.bot_user_id, ...cfg }),
    });
    setSaving(false);
    if (r.ok) { setSaved(true); onSaved(); setTimeout(() => setSaved(false), 2000); }
  }

  async function deletBot() {
    const r = await fetch('/api/admin/bots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'delete_bot', bot_user_id: bot.bot_user_id }),
    });
    if (r.ok) onDeleted(bot.bot_user_id);
  }

  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  return (
    <div style={{
      background: 'linear-gradient(135deg,#0e0c10,#111018)',
      border: `1px solid ${cfg.status === 'active' ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.05)'}`,
      borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>
          {bot.avatar_url
            ? <img src={bot.avatar_url} alt={bot.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
            : '🤖'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 13, color: '#fff', lineHeight: 1.2 }}>{bot.name}</div>
          <div style={{ fontSize: 9, color: 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif", marginTop: 2, textTransform: 'capitalize' }}>{bot.personality}</div>
        </div>
        <StatusBadge status={cfg.status} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16 }}>
        {[
          { label: 'Replies', value: bot.total_replies, color: BLUE },
          { label: 'Posts',   value: bot.total_posts,   color: G },
          { label: 'Last',    value: timeAgo(bot.last_activity), color: 'var(--sub)' },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontSize: 13, fontWeight: 700, color: s.color, fontFamily: "'Barlow Condensed',sans-serif" }}>{s.value}</div>
            <div style={{ fontSize: 8, color: 'var(--mt)', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: "'Barlow Condensed',sans-serif" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Active/Paused toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Toggle on={cfg.status === 'active'} onChange={v => set('status', v ? 'active' : 'paused')} />
        <span style={{ fontSize: 11, color: 'var(--sub)', fontFamily: "'Barlow Condensed',sans-serif" }}>
          {cfg.status === 'active' ? 'Active' : 'Paused'}
        </span>
      </div>

      {/* Behaviour toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { key: 'auto_reply', label: 'Auto Reply',     freqKey: 'reply_freq_minutes' },
          { key: 'auto_post',  label: 'Auto Post',      freqKey: 'post_freq_minutes' },
          { key: 'view_bump',  label: 'View Bumping',   freqKey: 'bump_freq_minutes' },
        ].map(({ key, label, freqKey }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Toggle on={cfg[key]} onChange={v => set(key, v)} />
            <span style={{ fontSize: 11, color: cfg[key] ? 'var(--sub)' : 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif", flex: '1 1 80px' }}>{label}</span>
            {cfg[key] && (
              <FreqDial
                label="Every"
                value={cfg[freqKey]}
                onChange={v => set(freqKey, v)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 }}>
        {confirmDel ? (
          <>
            <span style={{ fontSize: 10, color: RED, fontFamily: "'Barlow Condensed',sans-serif" }}>Sure?</span>
            <Btn small onClick={() => setConfirmDel(false)} color="rgba(255,255,255,0.2)">No</Btn>
            <Btn small onClick={deletBot} color={RED}>Delete</Btn>
          </>
        ) : (
          <Btn small onClick={() => setConfirmDel(true)} color="rgba(255,255,255,0.15)">Delete</Btn>
        )}
        <Btn small onClick={save} disabled={saving} color={saved ? GREEN : G}>
          {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save'}
        </Btn>
      </div>
    </div>
  );
}

// ── Create Bot form ───────────────────────────────────────────────────────────
function CreateBotForm({ token, onCreated }) {
  const [name, setName]               = useState('');
  const [personality, setPersonality] = useState('neutral');
  const [avatarUrl, setAvatarUrl]     = useState('');
  const [loading, setLoading]         = useState(false);
  const [err, setErr]                 = useState('');

  async function submit() {
    if (!name.trim()) { setErr('Name required'); return; }
    setLoading(true); setErr('');
    const r = await fetch('/api/admin/bots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'create_bot', name: name.trim(), personality, avatar_url: avatarUrl || null }),
    });
    const j = await r.json();
    setLoading(false);
    if (!r.ok) { setErr(j.error || 'Failed'); return; }
    setName(''); setPersonality('neutral'); setAvatarUrl('');
    onCreated();
  }

  return (
    <div style={{ background: 'rgba(212,175,55,0.03)', border: '1px solid rgba(212,175,55,0.1)', borderRadius: 14, padding: '18px 20px' }}>
      <SectionHead>Create Bot</SectionHead>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 160px' }}>
          <div style={{ fontSize: 9, color: 'var(--mt)', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 4 }}>Name</div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Baal"
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <div style={{ fontSize: 9, color: 'var(--mt)', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 4 }}>Personality</div>
          <select
            value={personality}
            onChange={e => setPersonality(e.target.value)}
            style={{ width: '100%', background: '#0e0c10', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", outline: 'none', boxSizing: 'border-box' }}
          >
            {PERSONALITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div style={{ flex: '2 1 200px' }}>
          <div style={{ fontSize: 9, color: 'var(--mt)', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 4 }}>Avatar URL (optional)</div>
          <input
            value={avatarUrl}
            onChange={e => setAvatarUrl(e.target.value)}
            placeholder="https://…/avatar.png"
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <Btn onClick={submit} disabled={loading || !name.trim()}>
          {loading ? 'Creating…' : '+ Create Bot'}
        </Btn>
      </div>
      {err && <div style={{ color: RED, fontSize: 11, marginTop: 8, fontFamily: "'Barlow Condensed',sans-serif" }}>{err}</div>}
    </div>
  );
}

// ── Seed Controls ─────────────────────────────────────────────────────────────
function SeedControls({ token, showToast }) {
  const [seeding, setSeeding]           = useState(false);
  const [running, setRunning]           = useState(false);
  const [seedResult, setSeedResult]     = useState(null);
  const [activityResult, setActivity]   = useState(null);

  async function doSeed() {
    setSeeding(true); setSeedResult(null);
    const r = await fetch('/api/admin/bots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'seed_threads' }),
    });
    const j = await r.json();
    setSeeding(false);
    setSeedResult(r.ok ? `Seeded ${j.seeded} threads` : (j.error || 'Failed'));
  }

  async function doActivity() {
    setRunning(true); setActivity(null);
    const r = await fetch('/api/admin/bots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'run_activity' }),
    });
    const j = await r.json();
    setRunning(false);
    setActivity(r.ok ? `${j.replies || 0} replies · ${j.viewBumps || 0} view bumps` : (j.reason || j.error || 'Failed'));
  }

  return (
    <div style={{ background: 'rgba(212,175,55,0.03)', border: '1px solid rgba(212,175,55,0.1)', borderRadius: 14, padding: '18px 20px' }}>
      <SectionHead>Controls</SectionHead>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--sub)', fontFamily: "'Barlow Condensed',sans-serif" }}>Seed bot listing threads into the forum</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Btn onClick={doSeed} disabled={seeding}>
              {seeding ? 'Seeding…' : 'Seed Threads'}
            </Btn>
            {seedResult && <span style={{ fontSize: 11, color: GREEN, fontFamily: "'Barlow Condensed',sans-serif" }}>{seedResult}</span>}
          </div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--sub)', fontFamily: "'Barlow Condensed',sans-serif" }}>Trigger one round of bot replies + view bumps now</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Btn onClick={doActivity} disabled={running} color={BLUE}>
              {running ? 'Running…' : 'Run Activity'}
            </Btn>
            {activityResult && <span style={{ fontSize: 11, color: BLUE, fontFamily: "'Barlow Condensed',sans-serif" }}>{activityResult}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Activity Log ──────────────────────────────────────────────────────────────
const ACTION_COLOR = { reply: BLUE, post: G, view_bump: '#a78bfa', seed: '#fb923c' };
const ACTION_ICON  = { reply: '💬', post: '📋', view_bump: '👁', seed: '🌱' };

function ActivityLog({ logs, loading }) {
  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--mt)', fontSize: 12 }}>Loading…</div>;
  if (!logs.length) return <div style={{ padding: 20, color: 'var(--mt)', fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif" }}>No activity yet.</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Bot', 'Action', 'Thread', 'Content', 'When'].map(h => (
              <th key={h} style={{ padding: '6px 10px', fontSize: 9, color: 'var(--mt)', textTransform: 'uppercase', letterSpacing: '.12em', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, borderBottom: '1px solid rgba(212,175,55,0.12)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log, i) => (
            <tr key={log.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <td style={{ padding: '7px 10px', fontSize: 11, color: '#fff', fontFamily: "'Barlow Condensed',sans-serif", whiteSpace: 'nowrap' }}>{log.bot_name || '—'}</td>
              <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: ACTION_COLOR[log.action_type] || 'var(--sub)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>
                  <span>{ACTION_ICON[log.action_type] || '•'}</span>
                  {log.action_type}
                </span>
              </td>
              <td style={{ padding: '7px 10px', fontSize: 10, color: 'var(--sub)', fontFamily: "'Barlow Condensed',sans-serif", maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.thread_title || (log.thread_id ? log.thread_id.slice(0, 8) + '…' : '—')}
              </td>
              <td style={{ padding: '7px 10px', fontSize: 10, color: 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif", maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.content ? `"${log.content.slice(0, 80)}${log.content.length > 80 ? '…' : ''}"` : '—'}
              </td>
              <td style={{ padding: '7px 10px', fontSize: 10, color: 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif", whiteSpace: 'nowrap' }}>
                {log.created_at ? timeAgo(log.created_at) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Global Controls bar ───────────────────────────────────────────────────────
function GlobalControls({ global: g, token, onChange }) {
  const [enabled, setEnabled]   = useState(g?.enabled !== false);
  const [mult, setMult]         = useState(g?.freq_multiplier ?? 1.0);
  const [saving, setSaving]     = useState(false);

  async function save(newEnabled, newMult) {
    setSaving(true);
    await fetch('/api/admin/bots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'set_global', enabled: newEnabled, freq_multiplier: newMult }),
    });
    setSaving(false);
    onChange({ enabled: newEnabled, freq_multiplier: newMult });
  }

  function toggleEnabled(v) {
    setEnabled(v);
    save(v, mult);
  }

  function applyMult() {
    save(enabled, mult);
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg,rgba(212,175,55,0.06),rgba(212,175,55,0.02))',
      border: '1px solid rgba(212,175,55,0.2)',
      borderRadius: 14, padding: '16px 20px',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24,
    }}>
      {/* Master switch */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Toggle on={enabled} onChange={toggleEnabled} />
        <div>
          <div style={{ fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 12, color: enabled ? G : 'var(--mt)' }}>
            Bot Activity {enabled ? 'ENABLED' : 'PAUSED'}
          </div>
          <div style={{ fontSize: 9, color: 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif", marginTop: 2 }}>
            {enabled ? 'Bots will reply and bump threads' : 'All bot activity is suspended'}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.06)' }} />

      {/* Frequency multiplier */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--mt)', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 4 }}>Global Freq Multiplier</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number" min={0.1} max={10} step={0.1}
              value={mult}
              onChange={e => setMult(parseFloat(e.target.value) || 1)}
              style={{ width: 64, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 6, padding: '5px 8px', color: '#fff', fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", textAlign: 'center', outline: 'none' }}
            />
            <span style={{ fontSize: 10, color: 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif" }}>×</span>
            <Btn small onClick={applyMult} disabled={saving}>{saving ? '…' : 'Apply'}</Btn>
          </div>
        </div>
        <div style={{ fontSize: 9, color: 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif", maxWidth: 120 }}>
          Scales all per-bot frequencies.<br />1.0 = normal · 2.0 = twice as often
        </div>
      </div>
    </div>
  );
}

// ── Main BotsTab ──────────────────────────────────────────────────────────────
export default function BotsTab({ token }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await fetch('/api/admin/bots', { headers: { Authorization: 'Bearer ' + token } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      setData(j);
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function handleBotDeleted(bot_user_id) {
    setData(d => d ? { ...d, bots: d.bots.filter(b => b.bot_user_id !== bot_user_id) } : d);
  }

  if (loading) return (
    <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--mt)', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13 }}>
      Loading bots…
    </div>
  );

  if (err) return (
    <div style={{ color: RED, background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 12, padding: '16px 20px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>{err}</span>
      <Btn small onClick={load}>Retry</Btn>
    </div>
  );

  const { bots = [], logs = [], global: globalCfg } = data || {};
  const activeBots  = bots.filter(b => b.status === 'active').length;
  const pausedBots  = bots.length - activeBots;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Global Controls */}
      <GlobalControls
        global={globalCfg}
        token={token}
        onChange={g => setData(d => d ? { ...d, global: g } : d)}
      />

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'Total Bots',   value: bots.length, color: G },
          { label: 'Active',       value: activeBots,  color: GREEN },
          { label: 'Paused',       value: pausedBots,  color: 'var(--mt)' },
          { label: 'Log Entries',  value: logs.length, color: BLUE },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: 'var(--c2)', border: '1px solid var(--bd2)', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 8, color: 'var(--mt)', textTransform: 'uppercase', letterSpacing: '.15em', fontFamily: "'Barlow Condensed',sans-serif", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bot List */}
      <div>
        <SectionHead>
          Bot Roster
          <Btn small onClick={load}>↻ Refresh</Btn>
        </SectionHead>
        {bots.length === 0 ? (
          <div style={{ color: 'var(--mt)', fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", padding: '20px 0' }}>No bots yet. Create one below.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {bots.map(bot => (
              <BotCard
                key={bot.bot_user_id}
                bot={bot}
                token={token}
                onSaved={load}
                onDeleted={handleBotDeleted}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Bot + Seed Controls side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <CreateBotForm token={token} onCreated={load} />
        <SeedControls token={token} />
      </div>

      {/* Activity Log */}
      <div>
        <SectionHead>
          Activity Log
          <Btn small onClick={load}>↻ Refresh</Btn>
        </SectionHead>
        <div style={{ background: 'var(--c2)', border: '1px solid var(--bd2)', borderRadius: 14, overflow: 'hidden' }}>
          <ActivityLog logs={logs} loading={false} />
        </div>
      </div>

    </div>
  );
}
