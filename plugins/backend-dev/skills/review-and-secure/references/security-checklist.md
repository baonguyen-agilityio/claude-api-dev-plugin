# Security checklist for a Workers + Firestore API

| Risk | Rule | Template status | What to look at |
|---|---|---|---|
| Broken access control | deny by default; only `PUBLIC_ROUTES` skip auth; role and ownership are separate checks | shipped | a route added outside the chain; a `current` fetched and never compared; `requireRole` missing on an admin action |
| Enumeration | another user's record answers 404, never 403, for hidden resources | shipped in `timeOffRequests` | a new module returning `Forbidden` on a resource the caller should not know exists |
| Mass assignment | DTOs list writable fields; `id`, `ownerId`, `status`, decision fields, timestamps are server-owned | shipped | `ownerId`/`status` in a `New*` schema; `{ ownerId: uid, ...data }` (body wins) |
| Injection | query field names from the model's allow-list, never from the caller; ids URL-encoded | shipped | `where` built from `c.req.query()` keys |
| Oversized input | 1 MB body → 413; `limit` ≤ 100 | shipped | `PageQuery` edited; a module query without `PageQuery.fields` |
| Amplification | reads per request bounded by `limit`; no `get` per row | rule | `Effect.forEach(docs, db.get)`, a second list, a lookup per item |
| CORS | allow-list from `CORS_ORIGINS`; `cors()` without options is a finding | shipped | `security.ts`; a module mounting its own `cors()` |
| Headers | `secureHeaders()` in the chain | shipped | the chain in `app.ts` |
| Rate limiting | `ratelimits` binding per env; absent binding = no limiting | shipped | `wrangler.toml` env blocks |
| Error leakage | `{ code, message }` only; 502 generic | shipped | a handler calling `c.json(err)`; a message built from the upstream body |
| Defects | a `throw` in a service is a 500 with no envelope (`Effect.either` does not catch defects) | rule | code that can throw inside an Effect program: JSON parsing, `new URL`, `encode` of an unknown type |
| SSRF | outbound URLs fixed in code or config | rule only | any caller-controlled part of a URL |
| Secrets | `wrangler secret put` per env; `.dev.vars` local; a leaked credential is rotated, not deleted from history | shipped | credentials in tests, fixtures, `api.http`, logs |
| Supply chain | lockfile committed; `npm ci` / `pnpm install --frozen-lockfile`; `npm audit --omit=dev` before a release | delivery runs it | a new dependency with a postinstall script |

Before a merge the Result answers for every endpoint touched: who may call it, which check enforces that, what the caller controls, and the worst a valid-but-hostile caller can do.
