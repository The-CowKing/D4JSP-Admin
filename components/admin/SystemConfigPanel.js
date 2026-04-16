import { useState, useCallback, useEffect, useMemo } from 'react';

const G = '#D4AF37';

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

// ── Skeleton rows shown while config loads ────────────────────────────────
function ConfigSkeleton() {
  return (
    <div>
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{ marginBottom: 6, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(212,175,55,0.15)', animation: 'skel-pulse 1.6s ease-in-out infinite', flexShrink: 0 }} />
            <div style={{ flex: 1, height: 11, borderRadius: 4, background: 'rgba(212,175,55,0.06)', animation: 'skel-pulse 1.6s ease-in-out infinite', maxWidth: 120 }} />
            <div style={{ width: 20, height: 9, borderRadius: 3, background: 'rgba(255,255,255,0.04)', animation: 'skel-pulse 1.6s ease-in-out infinite' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Global system_config only. Per-tier limits live in subscription_tiers. ─
// Two-level UI: collapsible sections → row accordion (click key to edit).
export default function SystemConfigPanel({ token }) {
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

  if (loading) return <ConfigSkeleton />;

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
                                style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.06)', color: '#f87171', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 10, textTransform: 'uppercase', cursor: 'pointer', opacity: isResetting ? 0.6 : 1, letterSpacing: '.06em' }}
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
