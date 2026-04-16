import { useState } from 'react';

const G = '#D4AF37';
const cell = { padding: '8px 10px', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'var(--sub)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 };
const hcell = { ...cell, color: 'var(--mt)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.12em', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, borderBottom: '1px solid rgba(212,175,55,0.12)' };

// ── Activity Tab ───────────────────────────────────────────────────────────
// Site-wide observability + moderation. Forum sub-tab shows existing threads
// data; all other sub-tabs are staked as placeholders for later build-out.
export default function ActivityTab({ token, data, loading }) {
  void token;
  const [subTab, setSubTab] = useState('forum');
  const ACTIVITY_TABS = [
    { id: 'forum',          label: 'Forum' },
    { id: 'trades',         label: 'Trades' },
    { id: 'escrows',        label: 'Escrows' },
    { id: 'disputes',       label: 'Disputes' },
    { id: 'listings',       label: 'Listings' },
    { id: 'feed',           label: 'Activity Feed' },
    { id: 'trade_settings', label: 'Trade Settings' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(212,175,55,0.08)', marginBottom: 20, overflowX: 'auto', whiteSpace: 'nowrap', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        {ACTIVITY_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: subTab === t.id ? '2px solid ' + G : '2px solid transparent', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 10, textTransform: 'uppercase', color: subTab === t.id ? G : '#6a6078', cursor: 'pointer', letterSpacing: '.1em', flexShrink: 0 }}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'forum' && (
        loading
          ? <div style={{ padding: 40, textAlign: 'center' }}><div className="spin" style={{ margin: '0 auto' }} /></div>
          : <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Title', 'Price', 'Status', 'Created'].map(h => <th key={h} style={hcell}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {(data?.threads || []).map(t => (
                    <tr key={t.id}>
                      <td style={{ ...cell, maxWidth: 300 }}>{t.title}</td>
                      <td style={{ ...cell, color: '#4ade80' }}>{t.price ? t.price.toLocaleString() + ' FG' : '—'}</td>
                      <td style={{ ...cell, color: t.status === 'active' ? '#4ade80' : 'var(--mt)' }}>{t.status || '—'}</td>
                      <td style={cell}>{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data?.threads?.length ?? 0) === 0 && <div style={{ color: 'var(--mt)', fontSize: 12, padding: 20 }}>No threads found.</div>}
            </div>
      )}

      {subTab !== 'forum' && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mt)', fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif" }}>
          Coming soon
        </div>
      )}
    </div>
  );
}
