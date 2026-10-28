---
name: incident
description: "Handles defects and incidents in a Cloudflare Workers + Firestore API: triages, establishes which version is live, reproduces first, pins the bug with a failing test, finds the cause and its blast radius, fixes it in the shared place, proves the fix and writes the postmortem; includes the leaked-credential response. Use when something is broken, misbehaving or exposed, or when an error, log line, alert or security scan finding is pasted, even if the cause has already been guessed or the fix looks obvious."
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(npm run typecheck*), Bash(npm test*), Bash(npm run check*), Bash(npx vitest*), Bash(npx wrangler tail*), Bash(npx wrangler deployments*), Bash(npx wrangler versions list*), Bash(npx wrangler secret list*), Bash(git log*), Bash(git status*), Bash(git diff*), Bash(curl *), Bash(jq *)
---

# Incident

Problem this solves: something is broken, misbehaving or exposed, and the first fix that comes to mind is a theory about a bug nobody has reproduced on the version that is live. The answer is cause, fix, blast radius, proof and a short postmortem; for a leaked credential, the runbook in `references/leaked-credential.md`. Symptom → cause table: `references/symptoms.md`. Rolling back is a `wrangler rollback` that prompts. Works on its own or as a step of the process.

Before anything else, follow the project profile: the `backend-dev:profile` block in the repo's `CLAUDE.md`. Where it differs from the defaults below (commands, layering, error style, git and CI conventions), the profile wins. No profile: the defaults below are the template's (`${CLAUDE_PLUGIN_ROOT}/references/project-profile.md`); say in the result that `/backend-dev:kit-setup` has not been run.

**Stack.** The steps, gotchas and references below are written for the kit's default stack (Cloudflare Workers, Hono, Firestore, Firebase Auth). When the profile's **Stack** entry for the app this change touches names another stack, read `${CLAUDE_PLUGIN_ROOT}/references/stacks.md` before step 1: it says which steps hold on any stack and where that stack's guide lives. No guide for it: keep the stack-neutral steps, follow the repo's own architecture note and code for the rest, and say so in the result; never carry Firestore, Wrangler or Firebase advice into a repo that does not use them.

## Procedure

1. **Triage in one line:** which env, since when, who is affected, is data exposed or corrupted. Open the incident record (below) with Status `open` and this line as Impact; update it after every later step. Users affected and a previous good version → rollback first (`wrangler rollback`), investigate second. A credential exposed → the runbook, before anything else.
2. **Establish what is live before reading code.** `npx wrangler deployments list --env <env>` (or `versions list`) for the deployed version and its source SHA; `git log -1` for the checkout. A checkout that cannot produce the logged error is not wrong, it is a different version; say so and get the right one.
3. **Reproduce** with the exact request (method, path, body, role, env) against `wrangler dev` with that env's project, or against the env with `npx wrangler tail --env` open. Not reproducible: say so and stop; a speculative fix cannot be shown to work.
4. **Pin it with a failing test** at the lowest layer that shows it (adapter for an encoding or mapping fault, service for logic, route for a guard). Run it on the unfixed code and keep the failure output.
5. **Cause, not symptom.** Read the table in the reference before touching code. A Firestore 400 caused by a value this API sent is this API's defect, and surfacing it as 502 `UPSTREAM_ERROR` is a second defect in the mapping. A coercion at the boundary (`"7"` → 7) that makes the symptom vanish is a contract decision (who may send strings), not a fix.
6. **Blast radius:** grep every module for the same pattern (`git grep` the expression); a 200 where 401/403/404 was expected is checked in every sibling and reported with whether data could have been read.
7. **Fix in the shared place** (the profile names it: the adapter or repository, the error mapper, the auth middleware, the model; in the template `core/firestore.ts`, `core/run.ts`, `authMiddleware`); never the one route in the report. The failing test passes; no assertion loosened.
8. **Prove:** the profile's gates (template: `npm run typecheck && npm test && npm run check`); the original request re-run with the new status and body pasted; on a deployed env, the `tail` line that used to show the error.
9. **Postmortem:** finish the incident record (Timeline, Prevention, Status) and give the short version in the reply. A run that stops early (not reproduced, blocked, rolled back with the cause open) still leaves the record with what was tried and what is open.

## Incident record

The reply is gone after the session; the record is what the team keeps. One markdown file per incident, committed with the fix (or on its own when there is no fix yet):
- run as a step of a ticket (`/backend-dev:plan` and `/backend-dev:build`): `docs/tickets/<id>/incident.md`, next to the ticket's `intent.md`, `spec.md` and `plan.md`;
- otherwise: `docs/incidents/<YYYY-MM-DD>-<short-slug>.md`, dated by the first report, the slug from the symptom (`2026-10-27-orders-502-on-qty`).

It holds facts as they were established, each section written out in full ("see above" is a hole), each only once its step ran. **Never a secret value**, in any section: a key is named by its variable, service account and key id, a token by its type and owner.

```markdown
# <YYYY-MM-DD> · <the symptom in one line>
Status: open | mitigated | fixed | verified | not reproduced  ·  Ticket: <link | none>

## Impact
<env, since when, who is affected, requests failing, data exposed or corrupted: yes/no and what>
## Timeline
- <YYYY-MM-DD HH:MM> <event>   (first report, triage, rollback, cause found, fix merged, deployed, verified)
## Live version
<env → version id → SHA>; checkout <SHA>
## Reproduction
<method, path, role, env, body> → <status and body seen>   (or: not reproduced, and what was tried)
## Cause
<one paragraph, at the layer where it lives, and why it got through>
## Blast radius
<pattern searched> → <paths checked> → clean | same defect at <path>; data exposure: yes/no
## Fix
<path → what changed>; failing test `<file>`: <name> (failed before, passes after)
## Proof
<gates, one line each>; <original request re-run → status and body>; <tail line>
## Prevention
- <what would have caught it> → <action> (<ticket or owner>)
```

A leaked credential uses the same file with Reproduction, Cause and Fix replaced by: **Exposure** (where it appeared, when, how long, who could see it), **Rotation** (each env, time rotated, the old key deleted by id), **Audit** (the window reviewed, what was found), **Notifications** (who was told, when).

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
**Incident record:** `<path>` (Status: <status>)

## Postmortem
**Timeline:** <first report → mitigation → fix → verified>
**Cause / Fix / Would have caught it / Prevention:** <one line each>
**Next:** review-and-secure on the fix, live-verify on the affected environment, then the prevention items as tickets.
```
