# Admin: Bots tab

CRUD on `bot_configs`, plus run-activity + seed-threads controls.

## Endpoint
`POST /api/admin/bots` ([`../../pages/api/admin/bots.js`](../../pages/api/admin/bots.js))

Actions:
- `update_config { bot_user_id, ...fields }` — edit one bot's config
- `set_global { enabled, freq_multiplier }` — `site_config` flags
- `create_bot { name, avatar_url, personality }` — new bot user
- `delete_bot { bot_user_id }` — remove (won't delete hardcoded UUIDs)
- `run_activity` — fire `/api/bots/activity` (the bots' actual runtime)
- `seed_threads` — fire `/api/admin/seed-bot-threads` (**which has no auth — finding C-1**)

## 10 hardcoded bot ids

`KNOWN_BOT_IDS` at [`../../pages/api/admin/bots.js:11-22`](../../pages/api/admin/bots.js): Tyrael, Nephalem, Azmodan, Adria, Zoltun Kulle, Deckard Cain, Covetous Shen, Leah, Haedrig Eamon, Maghda. Inline list — finding M-1; should source from `bot_configs` only.

## Related

- [`../endpoints/admin.md`](../endpoints/admin.md)
- [`../audits/2026-04-26.md`](../audits/2026-04-26.md) finding C-1
