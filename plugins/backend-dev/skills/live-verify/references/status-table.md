# Statuses to drive, in order

```bash
B=http://localhost:8787/api/v1
req() { curl -s -w '\nHTTP %{http_code}\n' -H "Authorization: Bearer $1" "${@:2}"; }
```

| # | Case | How | Expect | Also check |
|---|---|---|---|---|
| 1 | baseline | `curl -s -w '%{http_code}' $B/health` | 200 `{ data: { ok: true } }` | |
| 2 | no token / bad token | omit the header, `Bearer nonsense` | 401 `UNAUTHORIZED` | |
| 3 | wrong role | `$USER_TOKEN` on an admin route | 403 `FORBIDDEN` | document unchanged |
| 4 | another user's record | `$USER_TOKEN` on an id owned by someone else | 404 `NOT_FOUND` (hidden resources) or 403 (readable ones) per the contract | same body as a missing id |
| 5 | invalid body | `{"type":"x"}` | 400, `message` starts with the field name | |
| 6 | invalid query / cursor | `?limit=0`, `?cursor=garbage` | 400 | |
| 7 | missing record | `/does-not-exist` | 404 | |
| 8 | happy path | real body from `api.http` or the schema `examples` | 200 / 201 / 204; fields the contract promised | `createdAt`, `ownerId` = caller |
| 9 | second transition | the same action again | 409 `CONFLICT`, message names the state | `decidedAt` unchanged |
| 10 | server-owned field in body | `-d '{"ownerId":"someone-else", ...}'` | 2xx, response shows the caller's `ownerId` | |
| 11 | body limit / rate limit | > 1 MB body; burst past the limit (deployed only) | 413 / 429 | |
| 12 | concurrency | `for i in 1 2 3 4 5; do curl … /approve & done; wait` on a fresh request | one 200, four 409 | more than one 200 → incident |

Envelope: `{ data }`, `{ data, meta.pagination }` for lists (send `cursor` back as `?cursor=`), `{ code, message }` for failures, empty 204 on delete. A bare array, a stack trace or Hono's plain `Internal Server Error` is a defect.

Spec diff:
```bash
curl -s "$B/openapi.json" | jq '.paths["/api/v1/timeOffRequests"].post.responses | keys'
req $USER_TOKEN "$B/timeOffRequests?limit=1" | head -n -1 | jq -S '.data[0] | keys'
```
Headers (deployed, once per release):
```bash
curl -s -D - -o /dev/null "$B/health" -H 'Origin: https://evil.example' | grep -iE 'access-control|strict-transport|x-content-type'
```
