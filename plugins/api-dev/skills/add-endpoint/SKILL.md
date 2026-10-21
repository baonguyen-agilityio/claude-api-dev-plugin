---
name: add-endpoint
description: Adds or changes what an existing standalone Hono + Effect + Firestore Worker API exposes: new modules and CRUD resources, response fields, validation rules, filters and pagination, role and ownership checks, public routes, each with its tests. Use this skill whenever the user wants the API to accept, return, validate or restrict something it does not today, even if they describe it as a feature, a ticket, a product request or a client's need rather than an endpoint. For something that is broken use debug-endpoint; not for a monorepo with several apps.
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(node * new-module.mjs *), Bash(npm run typecheck*), Bash(npm test*), Bash(npm run check*)
---

# Add endpoint

Match the module shape that already exists. Design: `${CLAUDE_PLUGIN_ROOT}/references/architecture.md`; mechanics: `${CLAUDE_PLUGIN_ROOT}/rules/endpoint-recipe.md`; layering: `${CLAUDE_PLUGIN_ROOT}/rules/layering.md`.

## Contract first
Before changing anything that already responds: who reads it? If the consumers are not in this repo, ask; a no-match grep is not evidence there are none. Additive is safe; renaming, removing or retyping is breaking (add alongside, migrate, remove in separate releases).

## Steps
1. Read the closest module: its `routes.ts`, one controller, one service, its tests. Read `src/core/` exports before writing a helper.
2. New module: `node ${CLAUDE_PLUGIN_ROOT}/scripts/new-module.mjs <dir> <plural> <singular>` (copies `items`, renames, registers, refuses to overwrite), then `npm run typecheck && npm test` on the untouched copy.
3. Follow the recipe table in order: model → schemas → service → controller → route → registry → service test → route test.
4. Access: decide role (route guard) and ownership (service check) from the role matrix in architecture §6; reads of another user's record are 404.
5. State: a transition not in the state machine fails with `Conflict` (409).
6. Data: anything beyond list/get/create/update/remove goes into the `Firestore` tag, `FirestoreLive`, the fake, and an adapter test; a new filtered query needs its index in `firestore.indexes.json` (architecture §5).
7. Security pass with `${CLAUDE_PLUGIN_ROOT}/rules/security.md`.
8. Gates: `npm run typecheck && npm test && npm run check`; then **probe-endpoint** against `npm run dev`. Add the requests to `api.http`.

## Report
`## Result` per `${CLAUDE_PLUGIN_ROOT}/rules/result-block.md`, stating: **Contract** (endpoints/fields added, changed, removed; breaking or not), **Access** (public or authenticated; role and ownership checks or "none" and why; worst a hostile caller can do), **Tests** (both files by path, cases incl. 403/400/404), **Gates** (the three outputs; what was driven with curl or "not verified" and why).
