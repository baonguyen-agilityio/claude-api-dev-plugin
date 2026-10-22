---
name: implement
description: "Implements features in a Cloudflare Workers API on Hono, Effect and Firestore the way the template does it: scaffolds a new project, generates modules, writes models, schemas, services, controllers, routes and both test layers, and runs the gates. Use when code has to be written or changed in such an API, from an empty folder to a new field or endpoint, even if the user only says build it or add it."
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(node * scaffold.mjs *), Bash(node * new-module.mjs *), Bash(npm install*), Bash(npm ci*), Bash(npm run typecheck*), Bash(npm test*), Bash(npm run check*), Bash(git status*), Bash(git diff*)
---

# Implement

Problem this solves: writing or changing code in this stack so it matches the existing modules (layers, DTOs without server fields, tagged errors, tests in the order that catches access bugs) and passes the three gates. When no contract or data design exists yet, the assumed contract is stated in the Result and kept minimal. Works on its own or as a step of the process.

Before anything else, follow the project profile: the `backend-dev:profile` block in the repo's `CLAUDE.md`. Where it differs from the defaults below (commands, layering, error style, git and CI conventions), the profile wins. No profile: the defaults below are the template's (`${CLAUDE_PLUGIN_ROOT}/references/project-profile.md`); say in the result that `/backend-dev:kit-setup` has not been run.

The design the code follows: `${CLAUDE_PLUGIN_ROOT}/references/architecture.md`. Code shapes with the template's own snippets: `references/patterns.md`. Scripts: `${CLAUDE_PLUGIN_ROOT}/scripts/scaffold.mjs` (new project), `${CLAUDE_PLUGIN_ROOT}/scripts/new-module.mjs` (new module from `items`).

## Procedure

1. **Read the closest module first** (the profile's layering line says where modules live): its `routes.ts`, one controller, one service, its two test files, and the `core/` exports it uses. The template's comments cite the plugin's rules and the architecture note; those files live in the plugin, not in the project, so the nearest module is the reference when the plugin is absent.
2. **Empty folder:** `node ${CLAUDE_PLUGIN_ROOT}/scripts/scaffold.mjs <dir>` (never `cp -R`: it always prompts), then `npm install`, `cp .dev.vars.example .dev.vars`, rename (`wrangler.toml` names and `FIREBASE_PROJECT_ID` per env, `package.json` name, `info.title` in `src/core/openapi.ts`), and run the gates on the untouched skeleton so a later failure is yours. Unknown ids stay placeholders under Not done; never invent one.
3. **New module:** `node ${CLAUDE_PLUGIN_ROOT}/scripts/new-module.mjs <dir> <plural> <singular>`, then gates on the untouched copy. It registers the module in `src/modules/index.ts`; an unregistered module typechecks and 404s.
4. **Model → schemas → service → controller → route**, in that order, each with the pattern in the reference: writable fields in `<Entity>Fields`, server-owned fields separate, DTOs without server fields, `Schema.decodeUnknown(Dto)` inside the service, ownership and state checks in the service, controllers that only pick the status, `describeRoute` that lists every status the service can produce.
5. **Access from the contract's matrix:** role → `requireRole` on the route; ownership → compare `ownerId` in the service; hidden resources → `NotFound` for another owner, never `Forbidden`. A default the contract did not give (`?status=` for a non-admin) is stated in the Result, not silently chosen.
6. **State transitions:** a transition not in the state machine → `Conflict` naming the current state. When the contract promises exactly one winner, the read-then-update in the template is not enough: add a precondition to the adapter (`currentDocument.updateTime` on the `PATCH`, `FAILED_PRECONDITION` → `Conflict`) with an adapter test, or say in the Result that the race is open.
7. **Data:** a new filtered or ordered query needs its composite in `firestore.indexes.json` in the same commit; anything beyond `list/query/get/create/update/remove` goes into the `Firestore` tag, `FirestoreLive`, the fake and an adapter test together.
8. **Tests, 403/404 first:** route test cases in order: the guard or ownership status, 400 naming the field, 404, 409 with the `CONFLICT` code, the success envelope, a body carrying `ownerId`/`status` ignored; service tests for each tagged error and "nothing written on failure". Add the requests to `api.http`.
9. **Gates after each layer, output shown:** the profile's gates (template: `npm run typecheck && npm test && npm run check`). `check` is `wrangler deploy --dry-run`: a Node built-in or a missing binding fails here, not in vitest.
10. **Prove it live or say so.** Green tests are not proof; drive the endpoint with curl against `wrangler dev` (the live-verify skill has the token flow and the status list) or write "not verified" in the Result.

## Gotchas seen on this stack

- The no-skill run built a correct module and still made two contract decisions alone (archived suppliers editable, `?status=` ignored for users) and left the archive transition with the template's read-then-update race. Steps 5 and 6.
- The template's comments say "rules/security.md", "architecture §6": the run reported those files as missing. They are the plugin's; the project has the modules.
- `Schema.partial` cannot wrap a transformation (`UtcDate`): spell the optional variants out in `Update<Entity>`.
- `exactOptionalPropertyTypes` is on: an optional field is `Schema.optional(...)`, and `{ field: undefined }` does not typecheck.
- `__name__` is appended to every `orderBy` by the adapter; a cursor is valid only for the query shape that produced it.
- `cp -R` prompts for approval every time; the two Node scripts are pre-approved by this skill.
- The `items` sample stays until a real module exists; the generator copies from the plugin, not from the project.
- Errors follow the profile. In the template, a `throw` in a service is a 500; a new failure is a new tagged error in `core/errors.ts`, added to `AppError` and `toErrorResponse`, so TypeScript forces the mapping. In a repo whose profile says services throw mapped exceptions, a new failure is a new exception mapped where the profile says.
- `wrangler --dry-run` in `check` catches what tests cannot: Node built-ins, bindings declared at the top level only.

## Output

```markdown
## Result
**Verdict:** DONE | DONE-WITH-GAPS | BLOCKED
**Contract:** <endpoints and fields added or changed; additive or breaking; defaults chosen where the contract was silent>
**Access:** <per endpoint: public | authenticated | role | ownership; which check enforces it; worst a hostile valid caller can do>
**Data:** <collections, indexes added; adapter changes with their tests>
**Tests:** <both files by path; cases incl. the 403/404, 400, 409 and ignored-field cases>
**Gates:** <typecheck / test / check output, pasted>
**Verified live:** <what was driven with curl, or "not verified">
**Not done / Blocked by**
**Next:** review-and-secure on this change, then live-verify. Inside a ticket, `/backend-dev:ticket <id>` continues the workflow.
```

## Checklist
- [ ] Module registered; `describeRoute` lists every status the service can return.
- [ ] No server-owned field in a DTO; body `ownerId`/`status` proven ignored by a test.
- [ ] Every new query has its index; every new adapter operation has a fake and a test.
- [ ] Transitions that must be exactly-once have a precondition, or the open race is in the Result.
- [ ] Three gates green with output pasted; `api.http` updated.
