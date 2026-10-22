# Access rules

Two questions, two checks: `authMiddleware` says who the caller is; the route guard and the service say what they may do.

| Rule | Where it is enforced | Contract wording |
|---|---|---|
| public | path listed in `PUBLIC_ROUTES`, `security: []` in the route doc | "no token" |
| any signed-in user | nothing beyond auth | "authenticated" |
| role (`admin`) | `requireRole("admin")` on the route → 403 | "admin only; 403 otherwise" |
| ownership | the service compares `ownerId` with the caller's uid | "owner or admin" |
| ownership on a hidden resource | the service answers `NotFound` for another owner's record | "404 for other users' records" |

Role comes from the Firebase custom claim `role`; absent means `user`. The API never sets claims.

## 403 or 404
- The caller is allowed to know the record exists (items are readable by everyone) and is only denied the action → 403.
- The caller must not learn whether the record exists (time off requests belong to one person) → 404 on read and on every action, same body as a missing id.
- A role gate on the whole route (approve, reject, delete) → 403 before anything is read; the route guard answers, the service is never reached.

## The matrix to fill for every endpoint
| Endpoint | anonymous | user (owner) | user (other) | admin |
|---|---|---|---|---|

Fill every cell with a status. An empty cell is an undecided rule, and an undecided rule ships as "everyone".
