# claude-api-dev-plugin

Claude Code plugin for building one standalone REST API on Cloudflare Workers, plus the design it implements.

## Stack

| Layer | Choice | Version (pinned in the template) | Where it is configured |
|---|---|---|---|
| Runtime | Cloudflare Workers, `nodejs_compat` | wrangler 4.151 | `templates/wrangler.toml` |
| HTTP + OpenAPI | Hono; `hono-openapi` `describeRoute`; Swagger UI from CDN | hono 4.13, hono-openapi 1.5 | `templates/src/app.ts`, `src/core/openapi.ts` |
| Logic + validation | Effect programs; Effect Schema for DTOs and the OpenAPI spec | effect 3.22 | `templates/src/modules/*/services`, `schemas` |
| Data | Firestore over REST; service-account JWT signed with WebCrypto; no SDK | none (fetch) | `templates/src/core/firestore.ts` |
| Auth | Firebase ID token (RS256, Google JWKS); role from the `role` custom claim | jose 6.2 | `templates/src/core/auth.ts` |
| Security | secure headers, CORS allow-list from env, 1 MB body limit, per-uid Workers Rate Limiting | hono built-ins | `templates/src/core/security.ts` |
| Tests | vitest; in-memory fake Firestore layer; fake token verifier | vitest 3.2 | `templates/src/tests` |
| Language | TypeScript strict, no build step | typescript 5.9 | `templates/tsconfig.json` |
| Node | for tooling only (wrangler, vitest, scripts) | >= 22 | `templates/package.json` `engines` |

Design and decisions: [docs/architecture.md](docs/architecture.md).

## Layout

- `plugins/api-dev/` — the plugin (skills, rules, agent, template, evals, hooks)
- `docs/` — architecture and decisions the plugin and template follow
