# Infra: Credentials

The full credential lookup. Names + purposes + where to find — never the secret values themselves.

## 1Password (canonical)

- **Vault:** `Personal` at `my.1password.com` (`adam87lewis@gmail.com`).
- **CLI:** `op` v2.34.0. Biometric unlock; each invocation prompts. Falls back to `keyz/` if `op` times out.
- **Pattern:** `op read 'op://Personal/<item>/<field>'`.

| Item | Field | What it is |
|---|---|---|
| `GitHub PAT - D4JSP` | `credential` | Fine-grained PAT, all repos R/W, monthly rotation (current expiry 2026-05-25) |
| `D4JSP KVM 4 SSH (Claude)` | `private_key` | ed25519 root key for KVM 4 |
| `D4JSP KVM 2 SSH (Claude)` | `private_key` | ed25519 root key for KVM 2 |
| `D4JSP Cloud SSH (Claude)` | `private_key` | ed25519 key for Hostinger Cloud |

## `keyz/` (`C:\Users\Owner\Desktop\keyz\`) — plaintext mirror

Mounted for Cowork. Mirror of 1Password. Names + purposes only:

| File | Purpose |
|---|---|
| `github-pat.txt` | Mirror of `GitHub PAT - D4JSP` |
| `hostinger_ssh` + `.pub` | Original shared SSH key. Authorized only on Cloud now. |
| `d4jsp_kvm4_claude` + `.pub` | Dedicated KVM 4 key, no passphrase |
| `d4jsp_kvm2_claude` + `.pub` | Dedicated KVM 2 key, no passphrase |
| `d4jsp_cloud_claude` + `.pub` | Dedicated Cloud key, no passphrase |
| `kvm4 passwords.txt` | Line 1 = root pw, Line 2 blank, Line 3 = SSH key passphrase |
| `CLOUD.txt` | Hostinger Cloud SFTP/SSH password — whole file IS the password |
| `godaddy_api.txt` | GoDaddy DNS API key+secret |
| `google_oauth_secret.txt` | Google OAuth client secret (also pasted into Supabase Auth) |
| `keys/` | Anthropic API tokens |

## `.env*` matrix

| File | Tracked? | Lives | Contents |
|---|---|---|---|
| `.env.production` | **YES (finding H-1)** | repo + KVM 4 build | Public Supabase URL/anon, NEXT_PUBLIC_SITE_URL placeholder, **VAPID_PRIVATE_KEY committed (rotate)** |
| `.env.production.kvm4` | NO | local disk only | Full live secrets (Stripe sk_test, Resend, service role, Battle.net, VAPID) |
| `.env.production.from-cloud` | NO | local snapshot | Old Cloud env values |
| `.env.local` | gitignored | dev | Stripe test, Battle.net dev |
| KVM 4 production env | n/a | `/opt/d4jsp/.env` or pm2 ecosystem | Real production values |

## Required production env vars (server-only)

- `SUPABASE_SERVICE_ROLE_KEY` (HIGH — RLS bypass)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (HIGH — financial)
- `RESEND_API_KEY` (medium — email)
- `BATTLENET_CLIENT_ID`, `BATTLENET_CLIENT_SECRET`, `BATTLENET_REDIRECT_URI`
- `VAPID_PRIVATE_KEY` + `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `PADDLE_OCR_URL`, `VPS_TOOLTIP_URL` (KVM 2 service URLs)
- `ADMIN_APP_URL` (KVM 2 admin URL)

## Quick lookups

| Need | Command |
|---|---|
| GitHub PAT | `op read 'op://Personal/GitHub PAT - D4JSP/credential'` or `cat keyz/github-pat.txt` |
| KVM 4 SSH | `ssh -i C:/Users/Owner/Desktop/keyz/d4jsp_kvm4_claude root@177.7.32.128` |
| KVM 2 SSH | `ssh -i C:/Users/Owner/Desktop/keyz/d4jsp_kvm2_claude root@187.124.239.213` |
| Cloud SSH | `ssh -i C:/Users/Owner/Desktop/keyz/d4jsp_cloud_claude -p 65002 u704061244@82.29.193.20` |

## Push pattern (PAT-in-URL, never persisted)

```bash
PAT=$(cat "C:/Users/Owner/Desktop/keyz/github-pat.txt" | tr -d '\r\n')
ORIGIN=$(git remote get-url origin)
git push "https://x-access-token:${PAT}@${ORIGIN#https://}" HEAD:main
unset PAT
```

## Hard rules

- **Never echo passwords/PATs/private keys** into transcripts or commit messages.
- **Never commit anything from `keyz/`.**
- **Never push to remote with PAT persisted in URL.**

## Not yet captured (TODO)

- Hostinger account login (only with Adam)
- Stripe rotation deferred until live billing test
- Battle.net keys "ok as-is" per Adam; don't rotate
- Telegram bot tokens — possibly unused
- Cloudflare/DNS API tokens — DNS at GoDaddy

## Related

- [`./credential-rotation.md`](./credential-rotation.md) — per-secret rotation
- [`./deploy.md`](./deploy.md)
- [`../auth/providers.md`](../auth/providers.md)
