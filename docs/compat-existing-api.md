# Compatibility check: backend-dev on an existing API

Dates: 2026-10-21 to 2026-10-22. Target: an existing internal API that does not follow this plugin's template: a pnpm + turbo monorepo with several Worker apps and a shared package, on a self-managed GitLab. Names and paths are anonymised.

Question answered here: do the skills work on real team code, read the repo's own commands and conventions, and give the right verdict? Repeat this check for any other repo shape; the questions stay the same.

## Setup

- `pnpm install --frozen-lockfile` at the monorepo root; `pnpm --filter @packages/core build` (the Worker imports the shared package from `dist/`).
- `apps/<app>/.dev.vars` copied from the sample: no real Firebase credentials, so only public routes answer 200; protected routes answer 401.
- A local-only `CLAUDE.md` at the monorepo root (git-excluded, never pushed) with: the real gates (`pnpm --filter <app> test`, `lint`, `pnpm build:<app>`; no `typecheck`/`check`), the dev command (`wrangler dev` on :8787), the shared-handler and middleware names, the permission model (entity/action matrix), the deploy envs (four, including `testing`), and the public routes (`/api/v1/docs`, `/openapi`).
- Skills loaded with `claude --plugin-dir <this repo>/plugins/backend-dev` from the monorepo root, model Sonnet, headless (`-p`) so every tool call is on record.

## Baseline

Manual baseline before any skill ran (wrangler 4.34 from the monorepo lockfile):

```
GET /api/v1/docs                         200
GET /openapi                             200
GET /api/v1/<resource> (no token)        401 {"code":"UNAUTHORIZED","message":"You are not authorized to perform this action."}
GET /api/v1/<resource> (Bearer nonsense) 401 {"code":"INVALID_TOKEN","message":"Invalid or expired Firebase ID token."}
GET /api/v1/docs  Origin: evil.example   Access-Control-Allow-Origin: *
```

## Stage skills on the existing repo (2026-10-21)

Same target, same local `CLAUDE.md`, plan mode (read-only), Sonnet, `--setting-sources project` so only the repo's own configuration and the plugin load. Two prompts per skill under test, `live-verify` and `incident`, then one pair with a mitigation.

| Prompt | Skill expected | Fired | Answer quality |
|---|---|---|---|
| verify the public surface without a token (docs, 401 paths, CORS with an evil origin); nothing running | live-verify | no | correct curl plan from the code: public routes, basic-auth areas, middleware order; asked for the deployed URL instead of inventing one |
| security scan says ACAO `*`; find the cause, read-only | incident | no | cause at `app.use('*', cors())`, severity reasoned (bearer auth, no credentials), fix with an env allow-list, the `?token=` query-string weakness noticed |
| we just deployed stag, check it works before QA | live-verify | no | asked for the stag URL (not in `wrangler.toml` or `CLAUDE.md`); refused to call the unauthenticated `tools/*` routes on stag |
| security scan, broken right? find the cause and fix it (plan only) | incident | no | same cause, same fix |
| the two first prompts again after one `CLAUDE.md` section naming the plugin's skills per stage | live-verify / incident | live-verify yes, incident no | unchanged |

Findings:
1. **Trigger gap on a foreign repo (open):** on this monorepo none of the four prompts fired a skill, against 2/2 on the template for the same two stages. The answers were still right because the model reads the repo and `CLAUDE.md`. The descriptions name "a Cloudflare Workers + Firestore API"; the repo is one, inside a pnpm monorepo with its own shared package, which is enough for Sonnet to answer directly. A `CLAUDE.md` section that names the skills per stage made `live-verify` fire (1/2); it is the mitigation to ship with the plugin's install notes, not a fix in the descriptions.
2. **Open CORS:** `cors()` with no options on every route; low severity with bearer auth and no credentials, still a scanner finding. Reported, not changed.
3. **Read-only discipline:** plan mode kept both skills from writing; the incident answer wrote its plan to a user-level plan file, as the template runs did. The Result template in the skill asks for the reply to carry the whole answer.

## With the team kit (2026-10-22)

Same repository, clean clones, Sonnet, `--setting-sources project`. The kit adds a project profile (`/backend-dev:kit-setup`), `/backend-dev:ticket` and the `onboard` skill.

| Persona | Before the kit | With the kit |
|---|---|---|
| Developer, ticket #412, plan it the team's way | no skill; good plan from scratch; planned a `Co-Authored-By: Claude` trailer and a "Generated with Claude Code" MR footer | after `kit-setup`: gates and commit format from the profile, no attribution; with `/backend-dev:ticket`: api-contract, data-model and implement invoked in order, branch in the team's pattern, stopped at a red gate without committing |
| Newcomer, first day, same free-text question | no skill; good answer written to a user-level plan file nobody else reads | `onboard` fired; `docs/onboarding.md` written for a lead to review; a second run refreshed three facts and caught a profile line that contradicted the hook files |
| Newcomer, first ticket | n/a | `/backend-dev:ticket … --learn`: purpose, what to check and the file to copy for every stage, glossary, Remember list |

What the runs taught the kit: the profile's gates must build the shared package first when the app imports it from `dist`; the gates must run once on the base branch before any change, because some tests already fail there; hooks are quoted from their files, never inferred. Repository findings, reported and not changed: a bare `.claude` line in `.gitignore` keeps team settings out of git; deploy workflows described in a migration guide do not exist; versions disagree between the app README, `packageManager` and CI.

## Tickets on the team's GitLab (2026-10-22)

Clean clone with the GitLab remote, Sonnet, read-only on GitLab.

| Run | Result |
|---|---|
| `kit-setup <app path>` | profile names the project that holds the tickets, which is not the code project (the code project has no issues; ticket ids in commits and MR titles belong to a tracker project on the same instance) |
| `/backend-dev:ticket <id>`, glab logged in | read the real issue from the tracker project; workflow card; noticed the fix already looked merged and asked before any work |
| same, glab logged out | GitLab answered 404, not 401, so the command checked `glab auth status` first and gave the login steps (Token login with a `read_api` personal access token on an instance without an OAuth application) |
| same, logged out, `claude --chrome` | read the issue page in the developer's own Chrome, read only; same analysis as the glab run |

## Reproduce

```bash
cd <path to the monorepo> && pnpm install --frozen-lockfile && pnpm --filter @packages/core build
cp -n apps/<app>/.dev.vars.sample apps/<app>/.dev.vars
(cd apps/<app> && npx wrangler dev --port 8787 --ip 127.0.0.1)
claude --plugin-dir <this repo>/plugins/backend-dev --setting-sources project
```
Full transcripts were kept outside the repo.
