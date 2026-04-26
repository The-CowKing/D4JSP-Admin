# Infra: DNS + TLS

DNS hosted at GoDaddy. TLS via Hostinger / Let's Encrypt.

## Domains

19 total domains under one GoDaddy account. 6 active satellites + hub + trade subdomain (per `start.md` history).

| Domain | Points to | Purpose |
|---|---|---|
| `d4jsp.org` | Cloud `82.29.193.20` | WordPress hub |
| `trade.d4jsp.org` | KVM 4 `177.7.32.128` | Main trade app |
| `diablo4marketplace.com` | Cloud (via Mercator) | Marketplace satellite |
| `diablo4mods.com` | Cloud | Mods satellite |
| `diablo4clans.com` | Cloud | Clans satellite |
| `diablo4calculator.com` | Cloud | Calculator satellite |
| `diablo4guides.com` | Cloud | Guides satellite |
| `diablo4tools.com` | Cloud | Tools satellite |

## DNS management

- Provider: GoDaddy.
- API key+secret: `keyz/godaddy_api.txt`.
- Adam logs into GoDaddy directly for record edits. Cloudflare not in use.

## TLS

- KVM 4 + KVM 2: Let's Encrypt via certbot. Auto-renew via systemd timer (verify with `systemctl list-timers | grep certbot`).
- Cloud: Hostinger-managed certs, auto-issued.

## Mercator (WordPress domain mapping)

Subsite domains are NOT subdomains of `d4jsp.org`. They are separate `.com` TLDs mapped to WordPress subsites via the Mercator plugin. Forum links etc. use the mapped public domain.

## Verifying

```bash
# Resolve
dig +short trade.d4jsp.org

# TLS expiry
echo | openssl s_client -servername trade.d4jsp.org -connect trade.d4jsp.org:443 2>/dev/null | openssl x509 -noout -enddate
```

## Related

- [`./cloud.md`](./cloud.md)
- [`./kvm-4.md`](./kvm-4.md)
- [`./connected-systems.md`](./connected-systems.md)
