---
name: delivery
description: "Sets up and operates delivery for a Cloudflare Workers + Firestore API: CI gates, environments with their vars, secrets and bindings, wrangler deploy and rollback, smoke tests after a deploy, logs, cost and limits. Use when the API has to be shipped, promoted or restored, when an environment or pipeline is added, or when a secret is created, rotated or removed, even if the user only says push it live."
user-invocable: false
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(npm run typecheck*), Bash(npm test*), Bash(npm run check*), Bash(pnpm typecheck*), Bash(pnpm test*), Bash(pnpm check*), Bash(pnpm --filter *), Bash(npm audit*), Bash(npx wrangler secret list*), Bash(npx wrangler deployments*), Bash(npx wrangler versions list*), Bash(npx wrangler tail*), Bash(git status*), Bash(git log*)
---

# Delivery

Problem this solves: shipping this stack safely means per-environment vars, secrets and bindings that are not inherited, indexes deployed with a different credential than the code, approvals that live in repository settings, and a rollback that restores code only. `wrangler deploy`, `wrangler secret put` and `wrangler rollback` are not pre-approved on purpose: each prompts, so nothing ships on the skill's own initiative. Works on its own or as a step of the process.

Before anything else, follow the project profile: the `backend-dev:profile` block in the repo's `CLAUDE.md`. Where it differs from the defaults below (commands, layering, error style, git and CI conventions), the profile wins. No profile: the defaults below are the template's (`${CLAUDE_PLUGIN_ROOT}/references/project-profile.md`); say in the result that `/backend-dev:kit-setup` has not been run.

**Stack.** The steps, gotchas and references below are written for the kit's default stack (Cloudflare Workers, Hono, Firestore, Firebase Auth). When the profile's **Stack** entry for the app this change touches names another stack, read `${CLAUDE_PLUGIN_ROOT}/references/stacks.md` before step 1: it says which steps hold on any stack and where that stack's guide lives. No guide for it: keep the stack-neutral steps, follow the repo's own architecture note and code for the rest, and say so in the result; never carry Firestore, Wrangler or Firebase advice into a repo that does not use them.

Environments, secrets, commands: `references/environments.md`. Pipeline shape and the runbook: `references/pipeline-and-runbook.md`. Symptom table after a deploy: `references/troubleshoot.md`.

## Procedure

1. **Confirm the target with the user.** Deploying is outward-facing; never pick `stag` or `prod` yourself. A new environment gets a name, a Worker name, its own Firebase project id, its own `CORS_ORIGINS`, its own `ratelimits` namespace, and its own two secrets. Wrangler runs in the API app's folder (`cd apps/api` in the template; the profile's API app elsewhere), where its config and local binary are.
2. **Gates, output shown:** the profile's gates (template: `pnpm typecheck && pnpm test && pnpm check`), then the package manager's audit (`npm audit --omit=dev`, `pnpm audit --prod`); a high or critical runtime advisory blocks `stag` and `prod`.
3. **Env block complete:** `[env.<name>]` has `name`, `vars.FIREBASE_PROJECT_ID`, `vars.CORS_ORIGINS`, its `[[env.<name>.ratelimits]]` with a unique `namespace_id`; bindings and vars are not inherited from the top level, and a missing limiter is silently no limiting. `npx wrangler secret list --env <name>` shows every secret the `Env` type needs.
4. **Indexes before code:** `firestore.indexes.json` is deployed to that env's Firebase project with the Firebase CLI and its own credential; the Workers pipeline cannot do it. A query whose index is missing answers 502 after an otherwise green deploy.
5. **Deploy, then smoke with a real token:** `/health` only proves the Worker boots; one authenticated read through Firestore proves the secrets, the project id and the indexes. A full pass over every declared status is its own job (the live-verify skill); the authenticated read is part of every deploy.
6. **Promote `dev` → `stag` → `prod`** one step at a time, each with its smoke; `testing` (QA) deploys on demand, not in the chain.
7. **Pipeline, on the CI provider the profile names** (GitHub Actions or GitLab CI): gates on every pull or merge request; deploy to `dev` on merge; `stag` and `prod` behind GitHub Environments with required reviewers (the YAML only names the environment; without reviewers configured in the repository settings it deploys unattended); one `CLOUDFLARE_API_TOKEN` per environment so the `dev` token cannot touch `prod`; `workflow_dispatch` with an environment input for redeploying a known-good SHA.
8. **Observe after a deploy:** `npx wrangler tail --env <name>` for ten minutes; error rate and 502s in the Cloudflare dashboard; the symptom table for anything new.
9. **Rollback path:** `npx wrangler rollback --env <name>` to the previous version, or redeploy a known-good SHA through the dispatch workflow; rollback does not undo secrets, indexes or data, say which of those the release changed.
10. **Secrets rotation** on a schedule and on any exposure: `wrangler secret put` in every env that used the credential, redeploy, smoke, then revoke the old key. A credential that was committed, pasted or logged is rotated now; the full response to an exposure is the leaked-credential runbook in the incident skill.

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
**Next:** live-verify on the deployed environment, then promote to the next one.
```
