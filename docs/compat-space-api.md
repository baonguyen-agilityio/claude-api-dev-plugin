# Compatibility check: api-dev process skills on space-api

Date: 2026-10-21. Plugin: `api-dev` at the `feat/plugin-hooks` tip. Target: `granbull/space-api` at `9ab2f82` (branch `dev`), a pnpm + turbo monorepo whose Worker API (`apps/space`) shares the wire contract with this plugin's design but not its internal shape (`@packages/core`, permix, class services).

Question answered here: do the stack-neutral skills (`probe-endpoint`, `debug-endpoint`) work on real team code when the repo's `CLAUDE.md` tells them the local commands and names? The build skills (`new-api`, `add-endpoint`, `release-api`) are out of scope: their descriptions already exclude the monorepo.

## Setup

- `pnpm install --frozen-lockfile` at the space-api root; `pnpm --filter @packages/core build` (the Worker imports `@packages/core` from `dist/`).
- `apps/space/.dev.vars` copied from `.dev.vars.sample`: no real Firebase credentials, so only public routes answer 200; protected routes answer 401, which is itself a probe target.
- A local-only `CLAUDE.md` at the space-api root (git-excluded, never pushed) with: the real gates (`pnpm --filter space test`, `lint`, `pnpm build:space`; no `typecheck`/`check`), the dev command (`pnpm dev:space` on :8787), the core names (`apiHandlerEffect`, `authMiddleware`, `basicAuthMiddleware`, `permissionMiddleware`, `BaseRepository`), the permission model (permix entity/action), envs incl. `testing`, and the public routes (`/api/v1/docs`, `/openapi`).
- Skills loaded with `claude --plugin-dir <this repo>/plugins/api-dev` from the space-api root, model Sonnet, headless (`-p`) so every tool call is on record.

## Runs

<!-- filled from the recorded sessions below -->

## Verdicts

| Skill | Prompt | Read CLAUDE.md? | Used the right gates/commands? | Verdict it reported | Correct? |
|---|---|---|---|---|---|
| probe-endpoint | | | | | |
| debug-endpoint | | | | | |

## Gaps found

<!-- what the skills got wrong because of the monorepo, and what changed in the plugin as a result -->
