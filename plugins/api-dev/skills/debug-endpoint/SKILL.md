---
name: debug-endpoint
description: Diagnose and fix a defect in a standalone Hono + Effect + Firestore API on Cloudflare Workers — reproduce with curl, pin it with a failing test, find the real cause, fix it in the shared place, prove it is gone. Use whenever the user reports an endpoint returning the wrong status or body, a 500, a 401/403 that should not happen, missing or wrong data, something that fails only after deploy, a failing or flaky test, or pastes an error from wrangler, vitest or the logs — also phrased like "API bị lỗi", "endpoint trả sai", "deploy xong thì hỏng", "test bị fail". Use it even when the user already guessed the cause or the fix looks like one line. Not for a multi-app monorepo that has its own bug workflow.
---

# Debug endpoint

The first fix that comes to mind is a theory about a bug you have not seen yet. Reproduce, pin, explain, fix the cause, prove.

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

If you cannot explain why it happens, you have not found the cause; say that instead of shipping a guard. `git log -S '<expression>' -- src/` shows when the code appeared.

## 4. Fix in the shared place, check the blast radius
Fix `run`, `authMiddleware`, `core/firestore.ts` or the model, not the one route in the report. Then grep every module for the same pattern; a defect copied from `items` usually has siblings.

## 5. Prove
The test passes; no assertion loosened; `npm run typecheck && npm test && npm run check` green; the original curl re-run with the new status and body pasted.

## Report
`## Result` per `${CLAUDE_PLUGIN_ROOT}/rules/result-block.md`, leading with **Cause**, **Fix** (path, what changed), **Blast radius** (siblings fixed / none found), **Proof** (failing-before, passing-after, re-run curl), **Still open**.
