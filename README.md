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

## Install

In Claude Code 2.1.275 or later:

```
/plugin install api-dev --marketplace baonguyen-agilityio/claude-api-dev-plugin
```

Or from a clone: `claude plugin marketplace add ./` then `claude plugin install api-dev@bao-plugins`. In this repo the plugin is already enabled through `.claude/settings.json`.

Skills: `new-api`, `add-endpoint`, `debug-endpoint`, `probe-endpoint`, `release-api`; agent `api-dev:api-dev`. Say the job in plain words (Vietnamese works); you do not need to name a skill.

## Install

In Claude Code 2.1.275 or later:

```
/plugin install api-dev --marketplace baonguyen-agilityio/claude-api-dev-plugin
```

Or from a clone: `claude plugin marketplace add ./` then `claude plugin install api-dev@bao-plugins`. In this repo the plugin is already enabled through `.claude/settings.json`.

Skills: `new-api`, `add-endpoint`, `debug-endpoint`, `probe-endpoint`, `release-api`; agent `api-dev:api-dev`. Say the job in plain words (Vietnamese works); you do not need to name a skill.

## Maintaining

- Owner: baonguyen-agilityio. Changes go through a pull request with a review pass (`/review-checklist` or `/code-review`) posted on it.
- Any change to a skill description, a rule or the agent: run `node plugins/api-dev/scripts/check-plugin.mjs`, then the trigger suite `claude plugin eval plugins/api-dev --trust-plugin --ablation none` (about $3, Sonnet) and commit the dated results folder. The outcome cases (`evals/outcome-*`) run with `--ablation with-without` to report the delta against no plugin.
- Any change to `docs/architecture.md`: copy it to `plugins/api-dev/references/architecture.md` (the lint fails otherwise) and re-check the template against the changed sections.
- Any change to `templates/`: CI runs the gates on a clean copy and the generator; run them locally first (`npm run typecheck && npm test && npm run check`).
- Adding a skill: a folder under `skills/` with a third-person description (quoted trigger phrases, one "not for" clause), `allowed-tools`, a body that ends with the Result block, and at least one eval case whose grader expects it.

## Layout

- `plugins/api-dev/` — the plugin (skills, rules, agent, template, evals, hooks)
- `docs/` — architecture and decisions the plugin and template follow
