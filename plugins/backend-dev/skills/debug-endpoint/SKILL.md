---
name: debug-endpoint
description: Diagnoses and fixes defects in a standalone Hono + Effect + Firestore Worker API by reproducing them before explaining: wrong status codes or bodies, 500s, requests that should be rejected but succeed, auth, permission, CORS and header problems, missing or wrong data, failures that appear only after a deploy, failing or flaky tests. Use this skill whenever the user says the API misbehaves or pastes an error, even if they have already guessed the cause, propose a one-line fix, or only want to know why. Not for a monorepo that has its own bug workflow.
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(curl *), Bash(npm run typecheck*), Bash(npm test*), Bash(npm run check*), Bash(npx wrangler tail *), Bash(git log *)
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
