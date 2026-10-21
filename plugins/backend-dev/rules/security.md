# Security

Applies to `add-endpoint`, `debug-endpoint`, `probe-endpoint`, `release-api`. Role matrix and the 404-not-403 rule: `${CLAUDE_PLUGIN_ROOT}/references/architecture.md` §6.

| Risk | Rule | Template |
|---|---|---|
| Broken access control | deny by default; only `PUBLIC_ROUTES` skip auth; role and ownership are separate checks | shipped |
| Enumeration | another user's record answers 404, never 403 | shipped in `timeOffRequests` |
| Mass assignment | DTOs list writable fields; `id`, `ownerId`, `status`, timestamps are server-owned | shipped |
| Injection | Firestore structured queries take field names from an allow-list in the model, never from the caller; ids URL-encoded | shipped |
| Oversized input | 1 MB body limit → 413; `limit` ≤ 100 on lists | shipped |
| CORS | allow-list from `CORS_ORIGINS`; `cors()` with no options is a finding | shipped |
| Headers | `secureHeaders()`; `/docs` loads Swagger from a CDN | shipped |
| Rate limiting | Workers Rate Limiting binding per uid; absent binding = no limiting, so every env declares one | shipped |
| Error leakage | `{ code, message }` only; 502 is generic | shipped |
| SSRF | outbound URLs fixed in code or config; if any part is caller-controlled: https only, host allow-list, `redirect: "manual"` | rule only |
| Secrets | `wrangler secret put` per env, `.dev.vars` locally; a leaked credential is rotated, not deleted from history | shipped |
| Supply chain | lockfile committed, `npm ci`, `npm audit --omit=dev` before a release | release-api runs it |

Before calling an endpoint done, answer in the Result block: who may call it, which check enforces that, what the caller controls, and the worst a valid-but-hostile caller can do. A 200 where 401/403/404 was expected is a security defect; look for the same gap in sibling modules.
