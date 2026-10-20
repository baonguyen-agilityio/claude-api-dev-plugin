# Testing

Applies to `add-endpoint`, `debug-endpoint`. Layers and helpers live in the template (`src/tests/helpers`).

| Layer | File | Proves |
|---|---|---|
| service | `modules/<plural>/tests/<entity>.service.test.ts` with `makeFakeFirestore().layer` | logic, validation, which tagged error, nothing written on failure |
| route | `modules/<plural>/tests/routes.test.ts` with `testApp().request()` | route registered, guarded, validated; envelope and status |
| app | `src/tests/app.test.ts` | `/health`, 401 on every protected route, every route documented, only `PUBLIC_ROUTES` public |
| adapter | `src/core/tests/firestore.test.ts` with a stubbed `fetch` | exact REST request and the status → error mapping |
| auth | `src/core/tests/auth.test.ts` with a local JWKS | issuer, audience, expiry, algorithm |

Required route cases: the 403 (or 404 for another user's record) first, then 400 for body and query, 404, the success envelope, and a body carrying `ownerId`/`status` being ignored. For dates, one input with a `+07:00` offset proving UTC-date truncation (architecture §9).

A bug fix starts with a failing test at the lowest layer that shows it; keep the failing output for the Result block. Never loosen an existing assertion to get green.

Flaky suite: shared state (one fake reused across writes, a `vi.spyOn` without restore, a module-scope cache). Fix isolation, do not re-run.
