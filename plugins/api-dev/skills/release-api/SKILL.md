---
name: release-api
description: Deploy, configure or roll back a standalone Hono + Effect API on Cloudflare Workers across dev/stag/prod — wrangler.toml envs and vars, secrets per env, the Firebase service account, the rate-limit binding, smoke tests, logs, rollback — and troubleshoot config, auth, wrangler or Firestore setup errors. Use whenever the user asks to deploy, release, ship to an environment, set or rotate a secret, add an environment, roll back, read production logs, or set up CI for that kind of API — also phrased like "deploy lên dev", "đưa lên production", "thêm secret", "rollback". Use it BEFORE running wrangler deploy: it gates on the checks and confirms the env first. Not for a monorepo with turbo-driven deploys.
---

# Release API

Setup and commands: `${CLAUDE_PLUGIN_ROOT}/references/deploy.md`. Symptom → cause → fix: `${CLAUDE_PLUGIN_ROOT}/references/troubleshoot.md`. Env table: architecture §7.

## Deploying
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
