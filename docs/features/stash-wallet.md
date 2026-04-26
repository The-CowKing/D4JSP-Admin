# Stash > Wallet card

**Status:** design + restoration plan. Skeleton in `components/ProfileView.js` Stash tab today shows ONLY the FG Balance card. The Wallet card (counts of consumables / tokens / gems / raffle tickets / skill charges) needs to be added next to it.

Adam's spec across multiple messages (consolidated):
- *"anything that needs a count for a player should be in a wallet in stash under a separate card from fg"*
- *"monthly raffle tickets monthly , gems , all the skills"*
- *"some skills have monthly or perm status sometimes in which case they would override the wallet"*
- *"but not destroy their count either"*
- *"like I said I think that's all built it just never surfaces from previous bot"*

## Card layout (sibling to existing FG card)

```
┌─────────────────────────┐  ┌─────────────────────────┐
│ FG BALANCE              │  │ WALLET                  │
│   [coin]  3,400  FG     │  │ ────────────────────    │
│                         │  │ Currencies              │
│                         │  │   Gems         12       │
│                         │  │ ────────────────────    │
│                         │  │ Tickets                 │
│                         │  │   Monthly Raffle: 3     │
│                         │  │ ────────────────────    │
│                         │  │ Skills                  │
│                         │  │   Priority Post  5/20   │
│                         │  │   Avatar Glow    1/20   │
│                         │  │   Banner Message Permanent │
│                         │  │   Custom Title   Monthly (2026-05-26) │
└─────────────────────────┘  └─────────────────────────┘
```

## Display rules per row

| User-skill state | Display | Source |
|---|---|---|
| `status='charge'` (default) | `<charges> / <skill.cap_per_user>` | `user_skills.charges` + `skills.cap_per_user` |
| `status='monthly'` and not expired | `Monthly (<expires_at-formatted>)` | `user_skills.status` + `expires_at` |
| `status='perm'` | `Permanent` | `user_skills.status` |

**Hard rule (#77 cap):** `cap_per_user` is enforced server-side. Default 20. When a rank reward would push past the cap, excess is dropped (see #78 ladder).

**Hard rule (charge preservation, Adam: "but not destroy their count either"):** monthly/perm status does NOT zero out `user_skills.charges`. Status flips override the DISPLAY only; charges are preserved. When status expires, the display reverts to the charge count and consumes from there.

## Skill source matrix

| Source | Effect | Status mode |
|---|---|---|
| Godly subscription | unlimited use on covered skills | `perm` while active |
| Lower subs (Verified / Member) | granted skills/charges per tier config | `monthly` (expires next billing cycle) or `charge` |
| Rank rewards (milestones) | mint charges into wallet, capped at 20 | `charge` |
| Admin grant | manual mint or status set | varies |
| Stripe direct purchase | charge mint | `charge` |

## Auto-render rule

Wallet renders **every** active row from `skills` catalog where the user has a corresponding `user_skills` entry. New skills the admin adds in Catalogs > Skills appear automatically — no code change. Same for new gem types or raffle ticket types if those are extended.

## API contract (security per Adam: "xp too nothing available to client")

Vault internals + raw skill ownership are server-side. Client fetches the wallet via:

```
GET /api/me/wallet
→ {
    fg_balance: 3400,
    gems: 12,
    raffle_tickets: { monthly: 3 },
    skills: [
      { type:'priority_post', name:'Priority Post', display:'5 / 20',  charges:5, cap:20, status:'charge' },
      { type:'avatar_glow',   name:'Avatar Glow',   display:'1 / 20',  charges:1, cap:20, status:'charge' },
      { type:'banner_message',name:'Banner Message',display:'Permanent', charges:0, cap:1, status:'perm', expires_at:null },
    ]
  }
```

`/api/my-skills` exists today (`pages/api/my-skills.js`); needs an extension to (a) join `gems` + `raffle_entries` totals and (b) include the `display` string per skill. `/api/me/wallet` can be a thin wrapper that reuses my-skills' core query.

## What's already built (verify-not-rebuild)

Per Adam: *"like I said I think that's all built it just never surfaces from previous bot"*. Inventory of existing pieces:

| Piece | Path | State |
|---|---|---|
| `skills` catalog table | DB | ✓ exists; populated with avatar_glow, banner_message, fg_bonus, change_name, title, badge, etc. |
| `user_skills` table | DB | ✓ exists; empty system-wide today |
| `/api/my-skills` GET / POST | `pages/api/my-skills.js` | ✓ exists; joins skills via FK; filters expired |
| Admin Catalogs > Skills tab | `components/AdminView.js` (REWARD_TYPES) | ✓ exists |
| Stash tab in ProfileView | `components/ProfileView.js:1843` | ✓ exists; only renders FG card today |
| `gems` system | DB tables `gem_balances`, `gem_ledger`, `gem_prices` | ✓ table exists; admin Currency tab references it |
| `raffles` | `raffle_entries_archive`, `raffles_archive` | ✓ archive tables exist; live raffle tables presence not yet verified |
| `user_skills.status / expires_at` columns | DB | needs schema verification — likely missing the perm/monthly status column |
| Rank-reward mint into user_skills | `lib/rankEngine.js` + `lib/awardXp.js` | needs trace — currently rank-up grants FG bonus but skill mint is unclear |
| Stash > Wallet card render | NOT EXISTS | new render code; reads from `/api/me/wallet` |

## Implementation plan (#76 / #76b)

1. **Verify `user_skills` schema.** Add migration if `status` (text 'charge'/'monthly'/'perm') or `expires_at` (timestamptz) columns are missing. Default `status='charge'`.
2. **Extend `/api/my-skills`** (or new `/api/me/wallet`) to compute `display` per skill and include gems + raffle ticket counts.
3. **Add Wallet card** to `components/ProfileView.js` Stash tab next to the existing FG card. Auto-render any skill with `user_skills.charges > 0` OR `user_skills.status` in ('monthly','perm').
4. **Cap enforcement (#77).** In rank-reward grant code path, refuse to push past `skills.cap_per_user`. Document in Catalogs > Skills doc.
5. **Charge preservation (Adam: "but not destroy their count either").** When subscription grants `monthly` or `perm` status, preserve `charges`. When subscription ends, status reverts and charge count is intact.
6. **Rank ladder configuration (#78).** Configure `ranks` rows with reward arrays — milestone ranks (5, 10, 15, 20, 25, ...) grant +5 priority posts / +1 avatar glow up to caps. Non-milestone ranks grant FG/XP only. Surface in admin > Catalogs > Ranks for tuning.

## DO NOT BREAK

- **Charges are sticky.** Never zero `user_skills.charges` on subscription change.
- **Monthly/perm overrides display only.** Consume during active period costs nothing; charges preserved.
- **Cap is per-user per-skill.** Default 20. Enforced server-side. Rank reward overflow drops.
- **Wallet is server-driven.** Client never reads `user_skills` directly; always via API endpoint.

## Cross-references

- [`../catalogs/skills.md`](../catalogs/skills.md) — skill catalog rows + cap_per_user
- [`./priority-post.md`](./priority-post.md) — priority post specifics (TBD)
- [`./avatar-glow.md`](./avatar-glow.md) — avatar glow render contract (TBD)
- [`../numbered-fg-vault.md`](../numbered-fg-vault.md) — FG card source of truth
- [`../_batch-log.md`](../_batch-log.md) — #75 / #76 / #76b / #77 / #78 / #79 entries
