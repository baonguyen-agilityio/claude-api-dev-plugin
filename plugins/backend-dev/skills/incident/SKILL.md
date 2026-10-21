---
name: incident
description: "Handles defects and incidents in a Cloudflare Workers + Firestore API: triages, establishes which version is live, reproduces first, pins the bug with a failing test, finds the cause and its blast radius, fixes it in the shared place, proves the fix and writes the postmortem; includes the leaked-credential response. Use when something is broken, misbehaving or exposed, or when an error, log line, alert or security scan finding is pasted, even if the cause has already been guessed or the fix looks obvious."
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(npm run typecheck*), Bash(npm test*), Bash(npm run check*), Bash(npx vitest*), Bash(npx wrangler tail*), Bash(npx wrangler deployments*), Bash(npx wrangler versions list*), Bash(npx wrangler secret list*), Bash(git log*), Bash(git status*), Bash(git diff*), Bash(curl *), Bash(jq *)
---

# Incident

Problem this solves: something is broken, misbehaving or exposed, and the first fix that comes to mind is a theory about a bug nobody has reproduced on the version that is live. The answer is cause, fix, blast radius, proof and a short postmortem; for a leaked credential, the runbook in `references/leaked-credential.md`. Symptom → cause table: `references/symptoms.md`. Rolling back is a `wrangler rollback` that prompts. Works on its own or as a step of the process.

## Procedure

1. **Triage in one line:** which env, since when, who is affected, is data exposed or corrupted. Users affected and a previous good version → rollback first (`wrangler rollback`), investigate second. A credential exposed → the runbook, before anything else.
2. **Establish what is live before reading code.** `npx wrangler deployments list --env <env>` (or `versions list`) for the deployed version and its source SHA; `git log -1` for the checkout. A checkout that cannot produce the logged error is not wrong, it is a different version; say so and get the right one.
3. **Reproduce** with the exact request (method, path, body, role, env) against `wrangler dev` with that env's project, or against the env with `npx wrangler tail --env` open. Not reproducible: say so and stop; a speculative fix cannot be shown to work.
4. **Pin it with a failing test** at the lowest layer that shows it (adapter for an encoding or mapping fault, service for logic, route for a guard). Run it on the unfixed code and keep the failure output.
5. **Cause, not symptom.** Read the table in the reference before touching code. A Firestore 400 caused by a value this API sent is this API's defect, and surfacing it as 502 `UPSTREAM_ERROR` is a second defect in the mapping. A coercion at the boundary (`"7"` → 7) that makes the symptom vanish is a contract decision (who may send strings), not a fix.
6. **Blast radius:** grep every module for the same pattern (`git grep` the expression); a 200 where 401/403/404 was expected is checked in every sibling and reported with whether data could have been read.
7. **Fix in the shared place:** `core/firestore.ts`, `core/run.ts`, `authMiddleware`, the model; never the one route in the report. The failing test passes; no assertion loosened.
8. **Prove:** `npm run typecheck && npm test && npm run check`; the original request re-run with the new status and body pasted; on a deployed env, the `tail` line that used to show the error.
9. **Postmortem,** short, in the reply: timeline, cause, fix, blast radius, what would have caught it (a test, a review item, a gate), what changes so it does not recur.

## Gotchas seen on this stack

- The no-skill run noticed the checkout could not produce the logged request (`"7"` as `integer_value`) and refused to guess; it then had no way to find the deployed version. Step 2 exists because of that.
- It proposed accepting numeric strings for `qty` as the fix. That changes the contract to hide a symptom; the defect was a build that encoded a string as an integer, and a 502 mapping that blamed Firestore.
- The leaked-key run rotated first and matched the key by `private_key_id`, and then guessed an env name (`--env production`) without opening `wrangler.toml`. Envs are `dev`, `stag`, `prod` (and whatever the file says); the key is rotated in every env that holds it.
- `decide()` in the template is read-then-update: "approved twice" reports are the race, not a client bug; the fix is a precondition in the adapter plus an adapter test.
- A 401 on everything after a deploy is almost always the token's `aud` versus that env's `FIREBASE_PROJECT_ID` or a secret missing in that env; check `wrangler secret list --env` before reading auth code.
- `FAILED_PRECONDITION` in the `firestore` tail line is a missing composite index, not a permissions problem.
- A flaky test is shared state (one fake reused across writes, a `vi.spyOn` without restore, module-scope cache); re-running is not a fix.

## Output

```markdown
## Result
**Verdict:** FIXED | MITIGATED (rolled back, cause open) | NOT REPRODUCED | BLOCKED
**Live version:** <env → version id → SHA>, checkout <SHA>
**Cause:** <one sentence, at the layer where it lives>
**Fix:** <path → what changed>
**Blast radius:** <siblings checked → clean | same defect at <path>; data exposure yes/no>
**Proof:** <failing test output before, passing after; original request re-run with status and body; tail line>
**Still open:** <anything not proven>

## Postmortem
**Timeline:** <first report → mitigation → fix → verified>
**Cause / Fix / Would have caught it / Prevention:** <one line each>
```
