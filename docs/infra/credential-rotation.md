# Infra: Credential Rotation

Per-secret rotation procedure. Never echo values into transcripts.

## Recommended rotation order (blast-radius descending)

1. **Supabase service role key** + revoke legacy JWT anon + rotate publishable anon key.
2. **VAPID private key** + remove `.env.production` from git tracking.
3. **GitHub PAT** — gates pushes; everything else depends on being able to deploy.
4. **Hostinger panel password + VPS root SSH.**
5. **Battle.net OAuth client secret.**
6. **Resend API key.**
7. **Supabase JWT secret** — only if session token leakage suspected; logs everyone out.
8. *(deferred)* **Stripe keys** — after live testing.

## Generic procedure

For any secret:
1. Generate new value at provider (Supabase / Stripe / Resend / GitHub / etc.).
2. Capture into 1Password and `keyz/` (one source per spec).
3. Update Hostinger Node.js env on the relevant VPS (hPanel → Websites → Node.js → Environment variables) AND/OR pm2 ecosystem `env_production`.
4. Reload: `pm2 reload d4jsp` (cluster) or `pm2 restart d4jsp-admin`.
5. Validate via `pm2 logs <app>` (no auth errors) AND a smoke test (purchase test FG package, log in, call `/api/admin/test-email`).
6. Revoke old value at provider.

## Per-secret notes

### Supabase service role key
- **Rotate:** Dashboard → Project Settings → API → Reset service role key.
- **Update env on:** KVM 4 + KVM 2 (also legacy alias `SUPABASE_SERVICE_KEY` for OCR/tooltip).
- **Risk if missed:** admin endpoints fail; VPS tooltip uploads break.
- **If leaked:** full DB read/write bypassing RLS.

### Supabase anon key + revoke legacy JWT
- **Rotate:** Dashboard → API → rotate publishable key.
- **Then:** Project Settings → API → Legacy JWT-based API keys → Revoke.
- **Update env:** main + admin apps + 8 source files containing the legacy JWT fallback.
- **Source files with legacy JWT** (per `CREDENTIAL_ROTATION_INVENTORY.md` archived locally): `lib/supabase.js:4`, `lib/debug-context.js:18`, `lib/supabase-rest.js:9`, `components/AdminView.js:36, 946`, `public/d4jsp-auth-bounce.html:24`, `scripts/test-sell-pipeline.js:27`, `D4JSP-Admin/lib/supabase.js:4`, `D4JSP-Admin/next.config.js:37`.

### VAPID private key
- **Rotate:** `npx web-push generate-vapid-keys` locally.
- **Update env on:** KVM 4. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`.
- **Remove from `.env.production`:** `git rm --cached .env.production`, add `.env*` to `.gitignore`.
- **Side effect:** all existing push subscriptions invalidated; users re-subscribe on next visit.

### GitHub PAT
- **Rotate:** github.com → Settings → Developer settings → Fine-grained PATs → revoke + regenerate.
- **Update local:** `keyz/github-pat.txt` + 1Password vault.
- **Risk if missed:** pushes fail; deploys break.

### Stripe (deferred)
- Test keys today (`sk_test_...`, `pk_test_...`, `whsec_...`). Rotate to live keys after live billing test.
- **When rotating:** dashboard regenerates → update Hostinger env → verify webhook endpoint URL still matches.

### Resend
- **Rotate:** resend.com → API Keys → revoke + create.
- **Update env on:** KVM 4. `RESEND_API_KEY`.
- **Risk if missed:** grant/notification emails silently fail.

### Battle.net
- **Rotate:** develop.battle.net → application → regenerate client secret.
- **Update env:** `.env.local` + Hostinger.
- **Verify:** `BATTLENET_REDIRECT_URI` still matches `https://trade.d4jsp.org/api/auth/callback/battlenet`.

### Hostinger account password
- **Rotate:** hpanel.hostinger.com → Account → Security.
- **Risk if missed:** full account takeover — DNS, billing, env vars, VPS root.

### VPS root SSH
- **Rotate:** SSH in → `ssh-keygen` new pair → append new pubkey to `~/.ssh/authorized_keys` → remove old.
- **Disable password auth:** `/etc/ssh/sshd_config` `PasswordAuthentication no` → `systemctl reload sshd`.

## Related

- [`./credentials.md`](./credentials.md)
- [`./deploy.md`](./deploy.md)
- [`../audits/2026-04-26.md`](../audits/2026-04-26.md) findings H-1, H-2
