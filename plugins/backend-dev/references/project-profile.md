# Project profile

Every repo that uses this kit carries a short profile as a marked block in its `CLAUDE.md`. Claude Code loads `CLAUDE.md` into every session, so the profile is in context before any skill runs; each skill follows it where it differs from the skill's own defaults. `/backend-dev:kit-setup` drafts the block from the repo; a lead reviews and commits it. A value nobody could establish stays as `?: <question for the lead>`, never a guess.

## The block

```markdown
<!-- backend-dev:profile:start -->
## Backend profile
**Kit:** backend-dev plugin. Use its skills for backend work (system-design, data-model, api-contract, implement, review-and-secure, live-verify, delivery, incident); `/backend-dev:ticket <id>` works a ticket, `/backend-dev:onboard` maps the project.
**Repo:** <single app | monorepo: apps in <path>, shared code in <path>>; API app: <path>
**Commands:** install `<cmd>`; dev `<cmd>`; gates `<lint or typecheck>` && `<test>` && `<build or dry-run>`; deploy `<cmd per env>` (only with the user)
**Layering:** <route → controller → service → repository>; a new endpoint touches <files>
**Errors:** <how a failure is raised and where it becomes a status>; <what counts as a defect>
**Validation:** <library> at <boundary>
**Data:** Firestore via <adapter or repository>; indexes in <file>
**Auth:** <token check>; roles and permissions in <path>
**Tests:** <runner> in <path>; <what is faked>
**Git:** base `<branch>`; branch `<pattern>`; commit `<format>` (enforced by <tool>); MR template `<path>`, target `<branch>`; tickets: <GitLab issues via glab | other>
**CI/CD:** <provider and files>; environments <list>
**Watch out:** <three to five facts a newcomer would get wrong>
<!-- backend-dev:profile:end -->
```

Keep it under 25 lines: it is read in every session. Detail goes to `docs/onboarding.md` (`/backend-dev:onboard`).

## Defaults for a project made from this kit's template

Used when a repo has no profile block, and written into `CLAUDE.md` by the scaffold.

| Field | Template value |
|---|---|
| Repo | single app; API in `src/` |
| Commands | install `npm install`; dev `npm run dev`; gates `npm run typecheck && npm test && npm run check` (`check` is `wrangler deploy --dry-run`); deploy `npm run deploy:<env>` |
| Layering | `routes.ts` → `controllers/` → `services/` (Effect programs) → `@/core` `Firestore` tag; modules in `src/modules/<plural>/`, registered in `src/modules/index.ts` |
| Errors | tagged errors (`core/errors.ts`) mapped once in `toErrorResponse`; a `throw` inside a service is a defect (bare 500) |
| Validation | Effect Schema: body decoded in the service, query and path through `validate()` |
| Data | Firestore REST adapter `core/firestore.ts`; indexes in `firestore.indexes.json` |
| Auth | Firebase ID token in `authMiddleware`; role from the `role` claim; ownership in the service |
| Tests | vitest; `makeFakeFirestore()` for services, `testApp()` for routes |
| Git | base `main`; `feat/<slug>`; conventional commits; pull request to `main` |
| CI/CD | GitHub Actions; envs `dev`, `stag`, `prod` in `wrangler.toml` |
