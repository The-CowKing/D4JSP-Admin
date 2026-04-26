# Feature: Realtime channels

Supabase Realtime fans out Postgres changes via WebSocket. Add a table to the publication with `ALTER PUBLICATION supabase_realtime ADD TABLE <name>` (run in SQL editor; commit the SQL as a migration).

## Active channels

| Channel | Tables | Subscribers |
|---|---|---|
| `forum-trolls-global` | `forum_trolls` | [`../../components/AppShell.js:671-682`](../../components/AppShell.js) — drives gem pressed state + banner |

## Adding a new channel

1. Confirm the table is in the publication: `SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime'`.
2. If not, write a migration: `migrations/NNN_<table>_realtime.sql` with `ALTER PUBLICATION supabase_realtime ADD TABLE public.<name>;`.
3. Subscribe client-side:
   ```js
   supabase.channel('<channel-name>')
     .on('postgres_changes', { event: '*', schema: 'public', table: '<name>' }, payload => {...})
     .subscribe();
   ```
4. Add a fallback poll for WS drops (see AppShell.js for the 2-min poll example).
5. Document the channel here.

## Migration 038

`forum_trolls` was added to the publication on 2026-04-26 via [`../../migrations/038_forum_trolls_realtime.sql`](../../migrations/038_forum_trolls_realtime.sql). Without this, the gem-pressed/banner UI never updated until the 2-min poll fired.

## Related

- [`./forum-troll-gem.md`](./forum-troll-gem.md)
- [`../data-model/forum-trolls.md`](../data-model/forum-trolls.md)
- [`../infra/supabase.md`](../infra/supabase.md)
