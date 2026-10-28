# API

<!-- backend-dev:profile:start -->
## Backend profile
**Kit:** backend-dev plugin. Use its skills for backend work (system-design, data-model, api-contract, implement, review-and-secure, live-verify, delivery, incident); a ticket goes `/backend-dev:ticket <id>` → `plan` → `build` → `prove` → `settle`, `/backend-dev:review <MR>` reviews a teammate's MR, `/backend-dev:onboard` maps the project.
**Repo:** monorepo (pnpm workspaces): apps in `apps/`, shared code in `packages/core` (`@app/core`, consumed as source, no build step); API app: `apps/api`; design note in `docs/architecture.md`
**Stack:** Cloudflare Workers · Hono · Firestore · Firebase Auth · Wrangler
**Commands:** install `pnpm install`; dev `pnpm dev`; gates `pnpm typecheck && pnpm test && pnpm check`; deploy `pnpm deploy:<env>` (only with the user); one package: `pnpm --filter api <script>`, `pnpm --filter @app/core <script>`
**Layering:** `routes.ts` → `controllers/` → `services/` (Effect programs) → `@app/core/firestore` `Firestore` tag; modules in `apps/api/src/modules/<plural>/`, registered in `apps/api/src/modules/index.ts`; code two apps would share goes to `packages/core`
**Errors:** tagged errors in `packages/core/src/errors.ts`, mapped once in `toErrorResponse`; a `throw` inside a service is a defect
**Validation:** Effect Schema; body decoded in the service, query and path through `validate()`
**Data:** Firestore REST adapter `packages/core/src/firestore.ts`; indexes in `apps/api/firestore.indexes.json`
**Auth:** Firebase ID token in `authMiddleware`; role from the `role` claim; ownership checked in the service
**Tests:** vitest; `makeFakeFirestore()` from `@app/core/testing/fake-firestore` for services, `testApp()` for routes
**Git:** base `main`; branch `feat/<slug>`; conventional commits; pull request to `main`; tickets: ?: which tracker
**CI/CD:** ?: provider; environments `dev`, `stag`, `prod` in `apps/api/wrangler.toml`
**On edit:** none
**On stop:** none
**Protected branches:** `main`
**Watch out:** `apps/api/wrangler.toml` project ids are placeholders until renamed; bindings and vars are not inherited between envs; no Firestore emulator, `pnpm dev` talks to the project in `apps/api/.dev.vars`
<!-- backend-dev:profile:end -->
