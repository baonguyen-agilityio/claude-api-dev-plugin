# Compatibility check: api-dev process skills on space-api

Date: 2026-10-21. Plugin: `api-dev` at the `feat/plugin-hooks` tip. Target: `granbull/space-api` at `9ab2f82` (branch `dev`), a pnpm + turbo monorepo whose Worker API (`apps/space`) shares the wire contract with this plugin's design but not its internal shape (`@packages/core`, permix, class services).

Question answered here: do the stack-neutral skills (`probe-endpoint`, `debug-endpoint`) work on real team code when the repo's `CLAUDE.md` tells them the local commands and names? The build skills (`new-api`, `add-endpoint`, `release-api`) are out of scope: their descriptions already exclude the monorepo.

## Setup

- `pnpm install --frozen-lockfile` at the space-api root; `pnpm --filter @packages/core build` (the Worker imports `@packages/core` from `dist/`).
- `apps/space/.dev.vars` copied from `.dev.vars.sample`: no real Firebase credentials, so only public routes answer 200; protected routes answer 401, which is itself a probe target.
- A local-only `CLAUDE.md` at the space-api root (git-excluded, never pushed) with: the real gates (`pnpm --filter space test`, `lint`, `pnpm build:space`; no `typecheck`/`check`), the dev command (`pnpm dev:space` on :8787), the core names (`apiHandlerEffect`, `authMiddleware`, `basicAuthMiddleware`, `permissionMiddleware`, `BaseRepository`), the permission model (permix entity/action), envs incl. `testing`, and the public routes (`/api/v1/docs`, `/openapi`).
- Skills loaded with `claude --plugin-dir <this repo>/plugins/api-dev` from the space-api root, model Sonnet, headless (`-p`) so every tool call is on record.

## Runs

Manual baseline before any skill ran (wrangler 4.34 from the monorepo lockfile, `.dev.vars` from the sample):

```
GET /api/v1/docs                         200
GET /openapi                             200
GET /api/v1/users (no token)             401 {"code":"UNAUTHORIZED","message":"You are not authorized to perform this action."}
GET /api/v1/users (Bearer nonsense)      401 {"code":"INVALID_TOKEN","message":"Invalid or expired Firebase ID token."}
GET /api/v1/docs  Origin: evil.example   Access-Control-Allow-Origin: *
```

### Run 1 — probe-endpoint

Prompt: "The API in this repo is running locally on http://127.0.0.1:8787 (wrangler dev, apps/space). I have no Firebase token. Verify it works: the public docs route, that protected routes reject a missing and a bad bearer token with the right status and envelope, and the CORS behaviour of /api/v1/docs for an origin like https://evil.example. Use curl, show each status and body, and finish with the Result block."

Session: `claude -p --model sonnet --plugin-dir …/plugins/api-dev --allowedTools "Bash(curl *)" "Bash(jq *)" Read Grep Glob Skill`, 6 turns, $0.26.

- Skill tool call: `api-dev:probe-endpoint` (first action).
- Commands: curl against `/api/v1/docs`, `/openapi`, `/api/v1/configs`, `/api/v1/employees` with no token, `Bearer nonsense`, `Basic abc`, plus `OPTIONS` preflights with `Origin: https://evil.example`.
- Reported verdict: **PARTIAL**. Drove 200 (docs, openapi), 401 (missing token → `UNAUTHORIZED`, bad token → `INVALID_TOKEN`, wrong scheme), 204 (preflight). Listed as not driven: any 2xx on a protected route, 403/404/400/409, pagination, the basic-auth routes.
- Findings it made on its own: `cors()` with default options on every route at `apps/space/src/index.ts:73`, `Access-Control-Allow-Origin: *` on success and error responses alike; the skill's example path `/api/v1/openapi.json` does not exist here (the spec is at `/openapi`, listed in the local CLAUDE.md), which it noted instead of reporting a failure.
- Correct behaviour: yes. PARTIAL is the right verdict without a token, each claim has a pasted status, and the CORS note matches the manual baseline.

### Run 2 — debug-endpoint (expected), open CORS

Prompt: "Bug report for the API in this repo (apps/space, running locally on http://127.0.0.1:8787): any website can call our API from the browser. A page on https://evil.example gets Access-Control-Allow-Origin: * back from http://127.0.0.1:8787/api/v1/docs. Find the real cause in this repo and say what the fix is and which tests would pin it, but do not edit any file and do not commit. Finish with the Result block, leading with the cause."

Session: same flags plus `"Bash(git log *)" "Bash(pnpm --filter space test *)"`, 9 turns, $0.21.

- Skill tool call: **none**. The agent answered from the plugin's rules and the repo without invoking `debug-endpoint`.
- What it did: read `apps/space/src/index.ts`, grepped for CORS handling in `apps/space` and `packages/core`, read the env type and the test mocks. It did **not** curl the running server ("I didn't run the app or curl it").
- Reported: **Cause** `app.use('*', cors())` at `apps/space/src/index.ts:73`, Hono's default `origin: '*'`, applied before auth so 401s and preflights carry it too. **Fix** an origin allow-list from env (`PUBLIC_APP_URL` exists as a single value; a `CORS_ALLOWED_ORIGINS` list would need a new var in `AppEnv`, `.dev.vars.sample` and every wrangler env), no `credentials: true`. **Tests** five cases for a new `apps/space/src/tests/cors.test.ts` using the existing `initApp(mockEnv)` client. **Unresolved** one origin or several; which origins per env.
- Correct behaviour: the diagnosis is right and the Result block is well formed, but the skill's own rule ("reproduce before theorising", a curl on the unfixed code) was skipped because the skill never loaded. The 15/15 trigger evals did not cover a security-style bug report ("any website can call our API"); they covered a 500 and a deploy-only 401.

## Verdicts

| Skill | Prompt | Read CLAUDE.md? | Used the right gates/commands? | Verdict it reported | Correct? |
|---|---|---|---|---|---|
| probe-endpoint | public docs, 401 paths, CORS with an evil origin, no token available | injected by the harness (not a tool read); it used the `/openapi` path from it | curl only, as the skill prescribes | PARTIAL, with the undriven statuses listed | yes |
| debug-endpoint | open CORS bug report, read-only | injected; it used `initApp(mockEnv)` and `PUBLIC_APP_URL` from the repo | grep/read only; no curl reproduction | Result block with Cause / Fix / Tests / Unresolved | diagnosis yes; process no, because the skill did not fire |

## Gaps found

1. **Trigger gap (plugin):** `debug-endpoint` did not fire on a security-shaped bug report ("any website can call our API", "CORS"). Its description listed wrong statuses, 500s, deploy-only failures and flaky tests, not access-control or header defects. Change: description now names CORS/header/security reports and "a 200 where a 4xx was expected"; a new eval case `debug-endpoint-cors` pins it (see the evals PR).
2. **Example paths (plugin):** `probe-endpoint` shows `/api/v1/openapi.json`; space-api serves `/openapi`. The skill coped because the local CLAUDE.md listed the public routes. Change: the skill text now says "the spec path your CLAUDE.md or app.ts declares" instead of a fixed path.
3. **Gates (monorepo):** neither run needed the gates, so the `pnpm` commands in CLAUDE.md were not exercised. `release-api` and `add-endpoint` would have hit `npm run typecheck`, which does not exist here; they stay out of scope for this monorepo, as their descriptions say.
4. **Real finding in space-api:** `app.use('*', cors())` with no options, confirmed both by curl (`Access-Control-Allow-Origin: *` on `/api/v1/docs` for `Origin: https://evil.example`) and by code. Reported here only; nothing in `granbull/space-api` was changed or pushed.

## Reproduce

```bash
cd ref/space-api && pnpm install --frozen-lockfile && pnpm --filter @packages/core build
cp -n apps/space/.dev.vars.sample apps/space/.dev.vars
(cd apps/space && npx wrangler dev --port 8787 --ip 127.0.0.1)
cd ref/space-api && claude --plugin-dir <this repo>/plugins/api-dev
```
Full transcripts of both runs (stream-json) were kept outside the repo; the quoted Result blocks above are verbatim.
