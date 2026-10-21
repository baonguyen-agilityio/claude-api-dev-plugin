# One endpoint, in order

Applies to `add-endpoint`, `probe-endpoint`. Shapes and names come from `${CLAUDE_PLUGIN_ROOT}/references/architecture.md` §2, §6 and §8.

| # | File | Holds |
|---|---|---|
| 1 | `models/<entity>.model.ts` | `COLLECTION`, field schemas, entity schema |
| 2 | `schemas/<entity>.schema.ts` | `New<Entity>`, `Update<Entity>`, `<Entity>ListQuery` (extends `PageQuery`) |
| 3 | `services/<entity>.service.ts` | one exported Effect program per use case; `Schema.decodeUnknown(Dto)` on the body; ownership and state checks |
| 4 | `controllers/<entity>.controller.ts` | one handler per operation: params, body, status |
| 5 | `routes.ts` | `describeRoute` → `requireRole` if any → `validate("query", …)` → handler |
| 6 | `index.ts` + `src/modules/index.ts` | module export + registry (new module only) |
| 7 | `tests/<entity>.service.test.ts` | logic, each failure, nothing written on failure |
| 8 | `tests/routes.test.ts` | 403 first if guarded, then 400, 404, envelope, server-owned fields ignored |

Naming: module folder, route path and collection are plural camelCase (`timeOffRequests`); files inside are singular with a layer suffix (`timeOffRequest.service.ts`); DTOs `New<Entity>`/`Update<Entity>`; programs verb + entity (`approveTimeOffRequest`).

Input: query/path/header through `validate()` in the route (also documents them); JSON body through `Schema.decodeUnknown` in the service so the service test covers it. Excess body fields are stripped. Never take `id`, `ownerId`, `role` or `status` from the body; the caller is `c.get("user")`.

Statuses and codes: architecture §8. A new failure is a new tagged error in `core/errors.ts`, added to `AppError` and `toErrorResponse`; TypeScript then forces the mapping. A `throw` in a service is a 500 and a bug.

Public route: only if genuinely public; full path in `PUBLIC_ROUTES` and `security: []` in `describeRoute`. Never to make a 401 go away.
