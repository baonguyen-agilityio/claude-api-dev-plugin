# Environments, secrets, commands

| | local (`wrangler dev`) | `dev` | `testing` (QA, optional) | `stag` | `prod` |
|---|---|---|---|---|---|
| Worker name | `<name>` | `dev-<name>` | `testing-<name>` | `stag-<name>` | `prod-<name>` |
| `FIREBASE_PROJECT_ID` (var) | `.dev.vars` | `[env.dev.vars]` | `[env.testing.vars]` | `[env.stag.vars]` | `[env.prod.vars]` |
| `CORS_ORIGINS` (var) | `http://localhost:3000` | app origin per env (never `*`) | | | |
| `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (secrets) | `.dev.vars` | `wrangler secret put --env <env>` per env | | | |
| `API_LIMITER` (binding) | top-level `[[ratelimits]]` | `[[env.<env>.ratelimits]]` with its own `namespace_id` | | | |
| Deploys | `npm run dev` | on merge to main | on demand | with approval | with approval |

What is a var, a secret, a binding:
- **var**: not sensitive, differs per env, visible in `wrangler.toml` (project id, origins).
- **secret**: anything that grants access (service-account email and key); never in `wrangler.toml`, never in CI logs; `.dev.vars` locally, gitignored.
- **binding**: a platform resource the Worker reaches by name (rate limiter, queue, R2); declared per env, typed in `Env`.

Env block template:
```toml
[env.testing]
name = "testing-<name>"
vars = { FIREBASE_PROJECT_ID = "<firebase-project-testing>", CORS_ORIGINS = "https://testing.<app>" }
[[env.testing.ratelimits]]
name = "API_LIMITER"
namespace_id = "1004"            # unique per account
simple = { limit = 60, period = 60 }
```
`package.json`: `"deploy:testing": "wrangler deploy --env testing"`.

One-time per Firebase project: service account key (Console → Project settings → Service accounts), `roles/datastore.user`, Firestore in Native mode, `npx firebase deploy --only firestore:indexes --project <id>`.

Commands:
```bash
npm run typecheck && npm test && npm run check && npm audit --omit=dev
npx wrangler secret put FIREBASE_CLIENT_EMAIL --env <env>
npx wrangler secret put FIREBASE_PRIVATE_KEY --env <env>      # paste the private_key value as-is, \n sequences included
npx wrangler secret list --env <env>
npm run deploy:<env>
curl -s https://<env>-<name>.<account>.workers.dev/api/v1/health
npx wrangler tail --env <env>
npx wrangler deployments list --env <env>
npx wrangler rollback --env <env>
```

Cost and limits to state per env: plan tier (CPU ms per request, subrequests per request), requests per day expected, the limiter's limit and period, Firestore reads per request on the list endpoints (review-and-secure counts them).
