# API

<!-- backend-dev:profile:start -->
## Backend profile
**Kit:** backend-dev plugin. Use its skills for backend work (system-design, data-model, api-contract, implement, review-and-secure, live-verify, delivery, incident); a ticket goes `/backend-dev:ticket <id>` → `plan` → `build` → `prove` → `settle`, `/backend-dev:review <MR>` reviews a teammate's MR, `/backend-dev:onboard` maps the project.
**Repo:** single app; API in `src/`; design note in `docs/architecture.md`
**Stack:** Cloudflare Workers · Hono · Firestore · Firebase Auth · Wrangler
**Commands:** install `npm install`; dev `npm run dev`; gates `npm run typecheck && npm test && npm run check`; deploy `npm run deploy:<env>` (only with the user)
**Layering:** `routes.ts` → `controllers/` → `services/` (Effect programs) → `@/core` `Firestore` tag; modules in `src/modules/<plural>/`, registered in `src/modules/index.ts`
**Errors:** tagged errors in `src/core/errors.ts`, mapped once in `toErrorResponse`; a `throw` inside a service is a defect
**Validation:** Effect Schema; body decoded in the service, query and path through `validate()`
**Data:** Firestore REST adapter `src/core/firestore.ts`; indexes in `firestore.indexes.json`
**Auth:** Firebase ID token in `authMiddleware`; role from the `role` claim; ownership checked in the service
**Tests:** vitest; `makeFakeFirestore()` for services, `testApp()` for routes
**Git:** base `main`; branch `feat/<slug>`; conventional commits; pull request to `main`; tickets: ?: which tracker
**CI/CD:** ?: provider; environments `dev`, `stag`, `prod` in `wrangler.toml`
**On edit:** none
**On stop:** none
**Protected branches:** `main`
**Watch out:** `wrangler.toml` project ids are placeholders until renamed; bindings and vars are not inherited between envs; no Firestore emulator, `npm run dev` talks to the project in `.dev.vars`
<!-- backend-dev:profile:end -->
