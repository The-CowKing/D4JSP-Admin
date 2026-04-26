# Endpoints: misc

Operational + telemetry routes.

## Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/health` | GET | none | Status JSON: `{status, timestamp, version, git_sha, build_time}`. Currently `git_sha=unknown` because env var unset on KVM 4 (finding L-10). |
| `/api/boss-timer` | GET | none | Proxies `https://d4armory.io/api/events/recent` with 60s server cache. ([`../../pages/api/boss-timer.js`](../../pages/api/boss-timer.js)) |
| `/api/notification-count` | GET | Bearer JWT | Unread notification count. |
| `/api/push-subscribe` | POST | Bearer JWT | Register browser push subscription. |
| `/api/award-xp` | POST | Bearer JWT | Add XP for an action. Calls `lib/awardXp.js` → checks rank-up. |
| `/api/claim-referral` | POST | none | Rate-limited 1/day, 5/week per referrer. Awards XP. |
| `/api/generate-referral` | GET/POST | Bearer JWT | Get/generate user's referral code. |
| `/api/review` / `/api/reviews` / `/api/submit-review` / `/api/respond-review` | various | Bearer JWT | User reviews. |
| `/api/my-skills` / `/api/my-quests` | GET | Bearer JWT | User's effective grants and quest progress. |
| `/api/quest-catalog` / `/api/skill-catalog` / `/api/store` | GET | none | Public catalogs. |
| `/api/test-gemini` | POST | none | **410 Gone** stub (was a ship-blocker; cleaned up). |
| `/api/client-error` | POST | none | Sentry-lite: receives JS errors, writes `request_logs`. **No auth, no rate limit (finding M-10) — DoS surface.** ([`../../pages/api/client-error.js`](../../pages/api/client-error.js)) |
| `/api/forum-trolls` | GET/POST | mixed | See [`./quests-triggers.md`](./quests-triggers.md). |
| `/api/block-user` / `/api/friends/*` | POST | Bearer JWT | Social. |
| `/api/bots/activity` | POST | unclear | Bot activity tick. Called by `/api/admin/bots run_activity`. |
| `/api/save-build` | POST | Bearer JWT | Build Planner save. RLS by `user_builds` policy. |

## Related

- [`../audits/2026-04-26.md`](../audits/2026-04-26.md) — findings M-8, M-10, L-10
