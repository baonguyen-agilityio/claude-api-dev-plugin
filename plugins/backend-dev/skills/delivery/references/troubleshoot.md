# Troubleshooting

| Symptom | Usually | Fix |
|---|---|---|
| 401 on everything with a fresh token | token from another Firebase project than `FIREBASE_PROJECT_ID` of this env | sign in against the right project; compare `aud` in the token with the env var |
| 401 only after deploy | secret missing in that env (`wrangler secret list --env`) | `wrangler secret put` for that env, redeploy |
| 403 where 200 expected | `role` claim missing on the token; claims are only as fresh as the token | set the claim with the Admin SDK, sign in again |
| 404 on a path you just added | module not in `src/modules/index.ts`, or wrong `path` | register it; check `basePath` |
| 200 where 403/404 expected | guard or ownership check not wired | a security defect: fix it with the incident skill and check every sibling module |
| 400 "Invalid cursor" on a valid cursor | cursor from a different query shape | cursors are per query; do not reuse across filters |
| 502 `UPSTREAM_ERROR` | Firestore or OAuth failed | read the `firestore` line in `wrangler tail`; check IAM and the private key newlines |
| `FAILED_PRECONDITION` in the firestore log | missing composite index | add it to `firestore.indexes.json`, deploy indexes |
| 429 everywhere in prod | `ratelimits` namespace shared or limit too low | unique `namespace_id` per env; review the limit |
| `npm run check` fails on a Node built-in | not available on Workers | remove it, or confirm `nodejs_compat` covers it |
| works on `wrangler dev`, fails deployed | var or binding declared only at top level | declare it in every `[env.*]` block |
