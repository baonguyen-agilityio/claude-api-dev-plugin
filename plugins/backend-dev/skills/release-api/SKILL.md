---
name: release-api
description: Deploys, configures and rolls back a standalone Hono + Effect Worker API across dev, staging and production: runs the gates and the audit, checks each environment's variables, secrets and rate-limit binding, deploys with wrangler, smoke-tests, reads logs, rotates secrets, rolls back. Use this skill whenever the user wants the API shipped, promoted, released or restored, a secret or environment added or rotated, or production logs read, even if they just say push it live or that something broke right after a deploy. Not for monorepos deployed through turbo.
allowed-tools: Read, Glob, Grep, Bash(npm run typecheck*), Bash(npm test*), Bash(npm run check*), Bash(npm audit *), Bash(npx wrangler secret list *), Bash(npx wrangler tail *)
---

# Release API

Setup and commands: `${CLAUDE_PLUGIN_ROOT}/references/deploy.md`. Symptom → cause → fix: `${CLAUDE_PLUGIN_ROOT}/references/troubleshoot.md`. Env table: architecture §7.

## Deploying
`wrangler deploy`, `wrangler secret put` and `wrangler rollback` are not pre-approved on purpose: each one prompts, so a deploy never happens on the skill's own initiative.

1. **Confirm the env with the user.** Deploying is outward-facing; never pick `stag` or `prod` yourself.
2. Gates, output shown: `npm run typecheck && npm test && npm run check` and `npm audit --omit=dev` (a high/critical runtime advisory blocks stag/prod).
3. Config for that env: `[env.<env>]` has `name`, `FIREBASE_PROJECT_ID`, `CORS_ORIGINS` and its own `ratelimits` block; `npx wrangler secret list --env <env>` shows every secret the `Env` type needs. Bindings and vars are not inherited; a missing limiter silently means no limiting.
4. `npm run deploy:<env>`.
5. Smoke test what was deployed: `/api/v1/health`, then one authenticated read with a real token (**probe-endpoint**). A deploy that was not hit is not done.
6. Promote dev → stag → prod, repeating 4–5.

## Secrets
Rotate on a schedule (90 days is a sensible default) with `wrangler secret put` in each env, then redeploy and smoke-test. A credential that was ever committed, pasted in a log or shared is rotated now; deleting the commit does not make it secret again. Say in the report that it was rotated.

## Broken after a deploy
`npx wrangler tail --env <env>` while reproducing, then `troubleshoot.md`. If users are affected: `npx wrangler rollback --env <env>` first, fix afterwards.

## Report
`## Result` per `${CLAUDE_PLUGIN_ROOT}/rules/result-block.md`: env, the version/URL wrangler printed, gate outputs, smoke-test commands with status and body, secrets still missing in other envs.
