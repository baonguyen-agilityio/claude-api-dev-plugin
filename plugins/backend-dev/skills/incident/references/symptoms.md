# Symptom → usually → fix

| Symptom | Usually | Fix |
|---|---|---|
| 401 on everything with a fresh token | token from another Firebase project than that env's `FIREBASE_PROJECT_ID` | compare `aud` in the token with the env var; sign in against the right project |
| 401 only after a deploy | secret missing in that env (`wrangler secret list --env`) | `wrangler secret put` for that env; redeploy |
| 403 where 200 expected | `role` claim missing from the token; claims are as fresh as the token | set the claim, sign in again |
| 404 on a path just added | module not in `src/modules/index.ts`, or the `path` | register it |
| 200 where 401/403/404 expected | guard or ownership check not wired | security defect: fix, then check every sibling module and whether data was readable |
| 400 "Invalid cursor" on a valid cursor | cursor from another query shape | cursors are per filter set |
| 502 `UPSTREAM_ERROR` with a `firestore … 400` tail line | a value this API encoded wrongly (a string where Firestore expects an integer, an unsupported type) | the encoder or the schema; and map a 400 caused by our own value to a 500-class defect, not 502 |
| 502 with a `firestore … 403` line | IAM role missing on the service account, or the key's newlines mangled in the secret | `roles/datastore.user`; re-put the key as-is |
| `FAILED_PRECONDITION` in the firestore line | missing composite index in that project | add it to `firestore.indexes.json`, deploy indexes |
| 429 everywhere in prod | `ratelimits` namespace shared with another env, or the limit too low | unique `namespace_id` per env; review the limit |
| "approved twice" / two winners | read-then-update with no precondition in the service | `currentDocument.updateTime` precondition in the adapter, `FAILED_PRECONDITION` → `Conflict`, adapter test |
| a bare `500 Internal Server Error` with no envelope | a `throw` inside an Effect program (`Effect.either` does not catch defects) | find the throw; make it a tagged error |
| works on `wrangler dev`, fails deployed | var or binding declared only at the top level of `wrangler.toml` | declare it in every `[env.*]` block |
| `npm run check` fails on a Node built-in | not available on Workers | remove it, or confirm `nodejs_compat` covers it |
| flaky test | shared state across tests | isolate the fake, restore spies, no module-scope cache in tests |

Symptom fix versus cause fix:

| Symptom fix | Cause fix |
|---|---|
| `?? []` because a value is undefined | why it is undefined: wrong field name in the model, a decode that strips it |
| coerce `"7"` to 7 at the boundary | why the deployed build sent a string: the schema or encoder in that version; the contract decides whether strings are accepted |
| catch and return 200 | map it: tagged error + `toErrorResponse` |
| widen `PUBLIC_ROUTES` to clear a 401 | the token's project, or the route path |
| re-run a flaky test | fix shared state |

`git log -S '<expression>' -- src/` shows when a line appeared; `npx wrangler deployments list --env <env>` shows what is live.
