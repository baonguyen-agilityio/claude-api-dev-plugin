---
name: new-api
description: This skill should be used when the user asks to "create a new API", "scaffold a backend", "set up a Worker API in an empty folder", or wants to start a standalone REST service on Cloudflare Workers from scratch. Copies and verifies this plugin's template. Not for adding to an existing API (add-endpoint) or a multi-app monorepo.
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(node *), Bash(cp .dev.vars.example .dev.vars), Bash(ls *), Bash(npm install*), Bash(npm run typecheck*), Bash(npm test*), Bash(npm run check*), Bash(git init*), Bash(git status*)
---

# New API

Create a working API from `${CLAUDE_PLUGIN_ROOT}/templates/` and prove it runs before anything is built on it. The design it implements: `${CLAUDE_PLUGIN_ROOT}/references/architecture.md`.

## Before copying
- Target folder: ask if not given. It must be empty or new; list it first, never overwrite without asking.
- Names: Worker name (kebab-case, also the `*.workers.dev` subdomain) and the Firebase project id per env. Unknown ids stay as placeholders and go under **Not done**; never invent one.
- `node -v` ≥ 22.

## Steps
1. Copy with the scaffold script (a Node script, not `cp -R`: `cp` with flags always prompts for approval, `node <script>` is pre-approved): `node ${CLAUDE_PLUGIN_ROOT}/scripts/scaffold.mjs <dir>`, then `cd <dir> && npm install && cp .dev.vars.example .dev.vars`. The script refuses a non-empty folder and skips build artefacts.
2. Rename: `name` and each `[env.*].name` in `wrangler.toml`; `FIREBASE_PROJECT_ID` and `CORS_ORIGINS` in every vars block (real browser origins, never `*`); the `ratelimits` `namespace_id`s (unique per account); `name` in `package.json`; `info.title` in `src/core/openapi.ts`.
3. Gates on the untouched skeleton, so a later failure is yours: `npm run typecheck && npm test && npm run check`.
4. Optional local run with real credentials in `.dev.vars`: `npm run dev`, then `curl -s http://localhost:8787/api/v1/health` → `{"data":{"ok":true}}`; docs at `/api/v1/docs`.
5. First real module: hand over to **add-endpoint**. The `items` sample can be removed once a real module exists; the generator copies from the plugin, not from the project.
6. `git init` if needed; confirm `git status` shows no `.dev.vars`; commit.

## Report
`## Result` per `${CLAUDE_PLUGIN_ROOT}/rules/result-block.md`: folder, the three gate outputs, names still placeholders.
