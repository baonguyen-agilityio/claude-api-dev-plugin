# claude-api-dev-plugin

Claude Code plugin `backend-dev`: the backend engineer's process on Cloudflare Workers + Firestore, one skill per stage, plus the design and template they implement.

## The process and its skills

| Stage | Skill | Status |
|---|---|---|
| 1 Requirement → system design | `system-design` | done |
| 2 Data design | `data-model` | done |
| 3 API contract | `api-contract` | done |
| 4 Implementation | `implement` | done |
| 5 Quality before the MR | `review-and-secure` | done |
| 6 Live verification | `live-verify` | done |
| 7 Delivery and operations | `delivery` | done |
| 8 Incidents | `incident` | done |


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
/plugin install backend-dev --marketplace baonguyen-agilityio/claude-api-dev-plugin
```

Or from a clone: `claude plugin marketplace add ./` then `claude plugin install backend-dev@bao-plugins`. In this repo the plugin is already enabled through `.claude/settings.json`.

Agent: `backend-dev:backend-dev`. Say the job in plain words; you do not need to name a skill.

## Maintaining

- Owner: baonguyen-agilityio. Changes go through a pull request with a review pass posted on it; nothing merges to `main` without one.
- Every skill was built the same way, and a change to one follows the same six steps: (1) do the stage's task on the template with a plain session and no skill, keep what it got wrong; (2) write the procedure, the gotchas from that run, the output template; (3) description in the Agent Skills form ("what it does. Use when …", ≤ 1024 chars, naming the stack); (4) write the eval queries (should-trigger, near-miss, one outcome rubric); (5) `node plugins/backend-dev/scripts/check-plugin.mjs`, `skill-validator check plugins/backend-dev/skills/<name> --strict` (agent-ecosystem/skill-validator: strict YAML, fences, token budget, keyword stuffing; `brew install agent-ecosystem/tap/skill-validator`), `claude plugin validate plugins/backend-dev --strict`, one smoke prompt per stage; (6) the PR carries the hands-on notes, the smoke result and the review pass.
- Smoke prompts on a machine with its own user-level skills: `claude -p "<prompt>" --model sonnet --setting-sources project --plugin-dir plugins/backend-dev --permission-mode acceptEdits --allowedTools "Bash(ls *)" "Bash(cat *)" Read Glob Grep Skill Write Edit --output-format stream-json --verbose`, then grep for `"name":"Skill"`. Without `--setting-sources project` the user's other skills compete and the plugin's rarely fire.
- Evals run once per release, not per edit: trigger suite `claude plugin eval plugins/backend-dev --trust-plugin --ablation none --tag train --runs 2 -j 4 --model sonnet --max-cost-usd 8`, then `--tag validation` once on queries never used to edit a description (a case passes at a trigger rate ≥ 0.5); outcome suite `--tag outcome --ablation with-without --runs 2 --scaffold --allow-tools Bash Write Edit --max-cost-usd 6`. Commit the dated results folders. Re-run only the failed cases after a fix.
- Any change to `docs/architecture.md`: copy it to `plugins/backend-dev/references/architecture.md` (the lint fails otherwise) and re-check the template against the changed sections.
- Any change to `templates/`: CI runs the gates on a clean copy and the generator; run them locally first (`npm run typecheck && npm test && npm run check`).
- Token footprint (`claude --plugin-dir plugins/backend-dev plugin details backend-dev`): about 1,200 tokens always-on for the eight descriptions and the agent, 1.5k–2.4k per skill when it fires.

## Layout

- `plugins/backend-dev/` — the plugin (skills, rules, agent, template, evals, hooks)
- `docs/` — architecture and decisions the plugin and template follow
