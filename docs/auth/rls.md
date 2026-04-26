# Auth: RLS (auth-side)

How RLS gates user-side access. Companion to [`../data-model/rls.md`](../data-model/rls.md) which is the per-table inventory.

## Identity sources in policies

- `auth.uid()` — Supabase function, returns `users.id` for the JWT subject.
- `auth.role()` — `'anon'` / `'authenticated'` / `'service_role'`.

## Common patterns

```sql
-- Owner-only read
USING (auth.uid() = user_id)

-- Author-only write, immutable id
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id)

-- Sensitive-column guard (migration 019 pattern)
WITH CHECK (
  auth.uid() = id
  AND role IS NOT DISTINCT FROM (SELECT role FROM public.users WHERE id = auth.uid())
  AND fg_balance IS NOT DISTINCT FROM (SELECT fg_balance FROM public.users WHERE id = auth.uid())
  -- ...
)

-- Admin-only read
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
```

## Service-role bypass

`adminDb` uses the service-role key. Bypasses ALL RLS unconditionally. Use it for legitimate server-side admin work; never expose service-role-fetched data to a client.

## Anon vs authenticated

- Public reads (e.g. `/api/widget/latest-trades`) can use `adminDb` to bypass RLS, returning a sanitized whitelist. Or use anon client + a `USING (true)` SELECT policy.
- For per-user reads, prefer `supabaseAuthed(token)` factory in [`../../lib/supabase.js:130-135`](../../lib/supabase.js) — passes Bearer header so RLS filters correctly.

## Known gaps

- `threads` UPDATE policy lacks `WITH CHECK` on `author_id` (W-04).
- Most tables' RLS state is dashboard-only (H-9). Audit each.
- Storage buckets `assets`, `tooltip-snapshots` need ownership-aware DELETE policies (W-05/W-06).

## Related

- [`../data-model/rls.md`](../data-model/rls.md)
- [`../data-model/migrations.md`](../data-model/migrations.md) — `019` is the canonical hardening pattern
- [`../audits/2026-04-26.md`](../audits/2026-04-26.md) findings W-04..W-12
