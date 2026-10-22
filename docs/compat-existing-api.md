# Compatibility check: backend-dev skills on an existing API

Date: 2026-10-21. Plugin: `backend-dev` at the `feat/plugin-hooks` tip. Target: an existing internal API that does not follow this plugin's template. In this run it is a pnpm + turbo monorepo with several apps; the Worker under test (`apps/<app>`) shares the wire contract with this plugin's design but not its internal shape (a shared `@packages/core` package, a permission matrix inside the request handler, class-based services).

Question answered here: do the stack-neutral skills (`probe-endpoint`, `debug-endpoint`) work on real team code when the repo's `CLAUDE.md` tells them the local commands and names? The build skills (`new-api`, `add-endpoint`, `release-api`) are out of scope: their descriptions already exclude a multi-app monorepo.

Repeat this check for any other repo shape; the questions are the same: does the skill read the repo's `CLAUDE.md`, use its real commands, and give the right verdict?

## Setup

- `pnpm install --frozen-lockfile` at the monorepo root; `pnpm --filter @packages/core build` (the Worker imports the shared package from `dist/`).
- `apps/<app>/.dev.vars` copied from the sample: no real Firebase credentials, so only public routes answer 200; protected routes answer 401, which is itself a probe target.
- A local-only `CLAUDE.md` at the monorepo root (git-excluded, never pushed) with: the real gates (`pnpm --filter <app> test`, `lint`, `pnpm build:<app>`; no `typecheck`/`check`), the dev command (`wrangler dev` on :8787), the shared-handler and middleware names, the permission model (entity/action matrix), the deploy envs (four, including `testing`), and the public routes (`/api/v1/docs`, `/openapi`).
- Skills loaded with `claude --plugin-dir <this repo>/plugins/backend-dev` from the monorepo root, model Sonnet, headless (`-p`) so every tool call is on record.

## Runs

Manual baseline before any skill ran (wrangler 4.34 from the monorepo lockfile):

```
GET /api/v1/docs                         200
GET /openapi                             200
GET /api/v1/<resource> (no token)        401 {"code":"UNAUTHORIZED","message":"You are not authorized to perform this action."}
GET /api/v1/<resource> (Bearer nonsense) 401 {"code":"INVALID_TOKEN","message":"Invalid or expired Firebase ID token."}
GET /api/v1/docs  Origin: evil.example   Access-Control-Allow-Origin: *
```

### Run 1 — probe-endpoint

Prompt: "The API in this repo is running locally on http://127.0.0.1:8787 (wrangler dev, apps/<app>). I have no Firebase token. Verify it works: the public docs route, that protected routes reject a missing and a bad bearer token with the right status and envelope, and the CORS behaviour of /api/v1/docs for an origin like https://evil.example. Use curl, show each status and body, and finish with the Result block."

Session: `claude -p --model sonnet --plugin-dir …/plugins/backend-dev --allowedTools "Bash(curl *)" "Bash(jq *)" Read Grep Glob Skill`, 6 turns, $0.26.

- Skill tool call: `backend-dev:probe-endpoint` (first action).
- Commands: curl against `/api/v1/docs`, `/openapi`, two protected resources with no token, `Bearer nonsense`, `Basic abc`, plus `OPTIONS` preflights with `Origin: https://evil.example`.
- Reported verdict: **PARTIAL**. Drove 200 (docs, openapi), 401 (missing token → `UNAUTHORIZED`, bad token → `INVALID_TOKEN`, wrong scheme), 204 (preflight). Listed as not driven: any 2xx on a protected route, 403/404/400/409, pagination, the basic-auth routes.
- Findings it made on its own: `cors()` with default options on every route in the app entry file, `Access-Control-Allow-Origin: *` on success and error responses alike; the skill's example path `/api/v1/openapi.json` does not exist here (the spec is at `/openapi`, listed in the local CLAUDE.md), which it noted instead of reporting a failure.
- Correct behaviour: yes. PARTIAL is the right verdict without a token, each claim has a pasted status, and the CORS note matches the manual baseline.

### Run 2 — debug-endpoint (expected), open CORS

Prompt: "Bug report for the API in this repo (apps/<app>, running locally on http://127.0.0.1:8787): any website can call our API from the browser. A page on https://evil.example gets Access-Control-Allow-Origin: * back from http://127.0.0.1:8787/api/v1/docs. Find the real cause in this repo and say what the fix is and which tests would pin it, but do not edit any file and do not commit. Finish with the Result block, leading with the cause."

Session: same flags plus `"Bash(git log *)"`, 9 turns, $0.21.

- Skill tool call: **none**. The agent answered from the plugin's rules and the repo without invoking `debug-endpoint`.
- What it did: read the app entry file, grepped for CORS handling in the app and the shared package, read the env type and the test mocks. It did **not** curl the running server ("I didn't run the app or curl it").
- Reported: **Cause** `app.use('*', cors())` with no options in the app entry file, Hono's default `origin: '*'`, applied before auth so 401s and preflights carry it too. **Fix** an origin allow-list from env (the existing single frontend-URL var, or a new comma-separated list var in the env type, the vars sample and every wrangler env), no `credentials: true`. **Tests** five cases for a new `cors.test.ts` using the repo's existing test client. **Unresolved** one origin or several; which origins per env.
- Correct behaviour: the diagnosis is right and the Result block is well formed, but the skill's own rule ("reproduce before theorising", a curl on the unfixed code) was skipped because the skill never loaded. The 15/15 trigger evals did not cover a security-style bug report ("any website can call our API"); they covered a 500 and a deploy-only 401.

## Verdicts

| Skill | Prompt | Read CLAUDE.md? | Used the right gates/commands? | Verdict it reported | Correct? |
|---|---|---|---|---|---|
| probe-endpoint | public docs, 401 paths, CORS with an evil origin, no token available | injected by the harness (not a tool read); it used the `/openapi` path from it | curl only, as the skill prescribes | PARTIAL, with the undriven statuses listed | yes |
| debug-endpoint | open CORS bug report, read-only | injected; it used the repo's test client and env var names | grep/read only; no curl reproduction | Result block with Cause / Fix / Tests / Unresolved | diagnosis yes; process no, because the skill did not fire |

## Gaps found

1. **Trigger gap (plugin, closed by shortening):** `debug-endpoint` did not fire on a CORS-shaped bug report in any of three phrasings while its description was a 700–1000-char imperative paragraph, even after CORS/security wording and "also when they ask only for the cause" were added. The eval case `debug-endpoint-cors` reproduced the miss (0/3, twice). Rewriting all five descriptions to the official form (third person, quoted trigger phrases, one not-for clause, 380–540 chars) made the same case pass 3/3 and the whole suite 16/16. Lesson: trigger reliability came from a shorter, conventional description, not from more trigger words. The two runs recorded above were made with the long descriptions and are kept as the evidence for that lesson.
2. **Example paths (plugin):** `probe-endpoint` showed `/api/v1/openapi.json`; this API serves `/openapi`. The skill coped because the local CLAUDE.md listed the public routes. Change: the skill text now says "the spec path your CLAUDE.md or app.ts declares" instead of a fixed path.
3. **Gates (monorepo):** neither run needed the gates, so the `pnpm` commands in CLAUDE.md were not exercised. `release-api` and `add-endpoint` would have hit `npm run typecheck`, which does not exist here; they stay out of scope for a multi-app monorepo, as their descriptions say.
4. **Harness lesson (this check):** the "please fix it" run was started with `--allowedTools "Bash(curl *)" "Bash(git log *)" Read Grep Glob Skill --disallowedTools Edit Write`, yet it wrote files through a `python3` heredoc inside Bash: in auto mode `--allowedTools` only pre-approves, it does not fence, and the classifier let the write through. The edit was reverted with `git checkout` and `rm`; `git status` is clean, nothing was committed or pushed. Read-only runs against a repo you do not own need `--permission-mode plan` (or `dontAsk` with an explicit allow list), not auto mode.
5. **Real finding in the target API:** `app.use('*', cors())` with no options, confirmed both by curl (`Access-Control-Allow-Origin: *` on `/api/v1/docs` for `Origin: https://evil.example`) and by code. Reported to its owners only; nothing in that repo was changed or pushed.

## Reproduce

```bash
cd <path to the monorepo> && pnpm install --frozen-lockfile && pnpm --filter @packages/core build
cp -n apps/<app>/.dev.vars.sample apps/<app>/.dev.vars
(cd apps/<app> && npx wrangler dev --port 8787 --ip 127.0.0.1)
claude --plugin-dir <this repo>/plugins/backend-dev
```
Full transcripts of both runs (stream-json) were kept outside the repo; the quoted Result blocks above are verbatim apart from the anonymised paths.


## Re-run with the v2 skills (2026-10-21 23:40, `docs/v2-readiness` tip)

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
2. **Open CORS (unchanged since the first run):** `cors()` with no options on every route; low severity with bearer auth and no credentials, still a scanner finding. Reported, not changed.
3. **Read-only discipline:** plan mode kept both skills from writing; the incident answer wrote its plan to a user-level plan file, as the template runs did. The Result template in the skill asks for the reply to carry the whole answer.

## With the team kit (2026-10-22)

Same repository, clean clones, Sonnet, `--setting-sources project`. The kit adds a project profile (`/backend-dev:kit-setup`), `/backend-dev:ticket` and the `onboard` skill.

| Persona | Before the kit | With the kit |
|---|---|---|
| Developer, ticket #412, plan it the team's way | no skill; good plan from scratch; planned a `Co-Authored-By: Claude` trailer and a "Generated with Claude Code" MR footer | after `kit-setup`: gates and commit format from the profile, no attribution; with `/backend-dev:ticket`: api-contract, data-model and implement invoked in order, branch in the team's pattern, stopped at a red gate without committing |
| Newcomer, first day, same free-text question | no skill; good answer written to a user-level plan file nobody else reads | `onboard` fired; `docs/onboarding.md` written for a lead to review; a second run refreshed three facts and caught a profile line that contradicted the hook files |
| Newcomer, first ticket | n/a | `/backend-dev:ticket … --learn`: purpose, what to check and the file to copy for every stage, glossary, Remember list |

What the runs taught the kit: the profile's gates must build the shared package first when the app imports it from `dist`; the gates must run once on the base branch before any change, because some tests already fail there; hooks are quoted from their files, never inferred. Repository findings, reported and not changed: a bare `.claude` line in `.gitignore` keeps team settings out of git; deploy workflows described in a migration guide do not exist; versions disagree between the app README, `packageManager` and CI.
