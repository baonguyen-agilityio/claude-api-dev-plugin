---
name: delivery
description: Sets up and operates delivery for a Cloudflare Workers + Firestore API: CI gates, environments with their vars, secrets and bindings, wrangler deploy and rollback, smoke tests after a deploy, logs, cost and limits. Use when the API has to be shipped, promoted, restored or given a new environment, secret or pipeline, even if the user only says push it live.
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(npm run typecheck*), Bash(npm test*), Bash(npm run check*), Bash(npm audit*), Bash(npx wrangler secret list*), Bash(npx wrangler deployments*), Bash(npx wrangler versions list*), Bash(npx wrangler tail*), Bash(git status*), Bash(git log*)
---

# Delivery

Scope: stage 7 of the backend process. `wrangler deploy`, `wrangler secret put` and `wrangler rollback` are not pre-approved on purpose: each prompts, so nothing ships on the skill's own initiative. A broken deployment with a cause to find goes to incident; proving the deployment works is live-verify.

Environments, secrets, commands: `references/environments.md`. Pipeline shape and the runbook: `references/pipeline-and-runbook.md`. Symptom table after a deploy: `references/troubleshoot.md`.

## Procedure

1. **Confirm the target with the user.** Deploying is outward-facing; never pick `stag` or `prod` yourself. A new environment gets a name, a Worker name, its own Firebase project id, its own `CORS_ORIGINS`, its own `ratelimits` namespace, and its own two secrets.
2. **Gates, output shown:** `npm run typecheck && npm test && npm run check`, then `npm audit --omit=dev`; a high or critical runtime advisory blocks `stag` and `prod`.
3. **Env block complete:** `[env.<name>]` has `name`, `vars.FIREBASE_PROJECT_ID`, `vars.CORS_ORIGINS`, its `[[env.<name>.ratelimits]]` with a unique `namespace_id`; bindings and vars are not inherited from the top level, and a missing limiter is silently no limiting. `npx wrangler secret list --env <name>` shows every secret the `Env` type needs.
4. **Indexes before code:** `firestore.indexes.json` is deployed to that env's Firebase project with the Firebase CLI and its own credential; the Workers pipeline cannot do it. A query whose index is missing answers 502 after an otherwise green deploy.
5. **Deploy, then smoke with a real token:** `/health` only proves the Worker boots; one authenticated read through Firestore proves the secrets, the project id and the indexes. Hand the full status pass to live-verify.
6. **Promote `dev` → `stag` → `prod`** one step at a time, each with its smoke; `testing` (QA) deploys on demand, not in the chain.
7. **Pipeline:** gates on every pull request; deploy to `dev` on merge; `stag` and `prod` behind GitHub Environments with required reviewers (the YAML only names the environment; without reviewers configured in the repository settings it deploys unattended); one `CLOUDFLARE_API_TOKEN` per environment so the `dev` token cannot touch `prod`; `workflow_dispatch` with an environment input for redeploying a known-good SHA.
8. **Observe after a deploy:** `npx wrangler tail --env <name>` for ten minutes; error rate and 502s in the Cloudflare dashboard; the symptom table for anything new.
9. **Rollback path:** `npx wrangler rollback --env <name>` to the previous version, or redeploy a known-good SHA through the dispatch workflow; rollback does not undo secrets, indexes or data, say which of those the release changed.
10. **Secrets rotation** on a schedule and on any exposure: `wrangler secret put` in every env that used the credential, redeploy, smoke, then revoke the old key. A credential that was committed, pasted or logged is rotated now (incident owns the response).

## Gotchas seen on this stack

- The no-skill run produced a correct env block, three workflows and a runbook, and chained `dev → stag → prod` automatically on every merge with only `/health` between steps; the approval it relied on lives in GitHub Environment settings it could not create. Step 7 names both.
- Indexes are deployed with a Firebase credential, not the Cloudflare token; the pipeline in the run left it as a manual step and said why. Keep it a manual step, written down.
- `/health` does not touch Firestore; a deploy with a wrong private key passes it.
- Secrets are per env: a rotated key in `dev` leaves `stag` on the leaked one.
- `wrangler secret put` creates a new deployment on its own; sequence it after the code deploy or expect two deployments.
- `wrangler rollback` restores code only; a release that added an index or a secret needs those handled separately.
- A `ratelimits` namespace shared between envs shares the counters: 429s in `prod` caused by `stag` traffic.
- The free plan's CPU and subrequest limits differ from paid; a Worker that passes `dev` on a paid account can fail `prod` on a free one.

## Output

```markdown
## Result
**Verdict:** DONE | DONE-WITH-GAPS | BLOCKED
**Target:** <env>, Worker <name>, project <id>
**Gates:** <typecheck / test / check / audit output>
**Config:** <env block fields present; secrets listed; limiter namespace>
**Deployed:** <version id and URL wrangler printed, or "not deployed: <why>">
**Smoke:** <health + one authenticated read, status and body>
**Pipeline:** <workflows added or changed; environments and reviewers still to configure>
**Rollback:** <command and what it does not undo>
**Manual steps left:** <Firebase project, indexes, secrets, environment reviewers>
```
