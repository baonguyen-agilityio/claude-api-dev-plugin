---
name: debug-endpoint
description: This skill should be used when the user reports that an endpoint "returns 500", "returns the wrong status", "returns 200 when it should be 403", "fails only after deploy", "any website can call our API", "the CORS header says *", or pastes a wrangler, vitest or log error from a standalone Hono + Effect Worker API, including when they only want the cause and the fix without edits. Reproduces with curl before explaining. Not for a multi-app monorepo with its own bug workflow.
---

# Debug endpoint

The first fix that comes to mind is a theory about a bug nobody has reproduced yet. Reproduce, pin, explain, fix the cause, prove.

## 1. Reproduce
- Exact request: method, path, body, which user/role, which env, the response received.
- Drive it with curl (**probe-endpoint**) against `npm run dev`; if it only happens deployed, use that env's URL and `npx wrangler tail --env <env>`, and check that env's vars and secrets first (architecture §7).
- Read the body: `{ code, message }` is a mapped error; Hono's plain `Internal Server Error` is a throw or defect; `{ data: [] }` where data should exist is often a query or index problem.
- A 200 where 401/403/404 was expected is a security defect: check sibling modules for the same gap and say in the report whether data could have been exposed.
- Cannot reproduce: say so and stop. A speculative fix cannot be shown to work.

## 2. Pin it with a failing test
Lowest layer that shows it (`${CLAUDE_PLUGIN_ROOT}/rules/testing.md`). Run it on the unfixed code and keep the failure output. Name it for the behaviour, not the ticket.

## 3. Cause, not symptom
| Symptom fix | Cause fix |
|---|---|
| `?? []` because a value is undefined | why it is undefined: wrong field name in the model, a decode that strips it |
| catch and return 200 | map it: tagged error + `toErrorResponse` |
| widen `PUBLIC_ROUTES` to clear a 401 | token from the wrong Firebase project, or the route path |
| re-run a flaky test | fix shared state |

When the cause cannot be explained, it has not been found; say so instead of shipping a guard. `git log -S '<expression>' -- src/` shows when the code appeared.

## 4. Fix in the shared place, check the blast radius
Fix `run`, `authMiddleware`, `core/firestore.ts` or the model, not the one route in the report. Then grep every module for the same pattern; a defect copied from `items` usually has siblings.

## 5. Prove
The test passes; no assertion loosened; `npm run typecheck && npm test && npm run check` green; the original curl re-run with the new status and body pasted.

## Report
`## Result` per `${CLAUDE_PLUGIN_ROOT}/rules/result-block.md`, leading with **Cause**, **Fix** (path, what changed), **Blast radius** (siblings fixed / none found), **Proof** (failing-before, passing-after, re-run curl), **Still open**.
