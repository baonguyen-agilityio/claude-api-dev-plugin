---
name: probe-endpoint
description: This skill should be used when the user asks to "verify the endpoint", "smoke-test the API", "check it works", "hit it with curl", or wants a change confirmed before a PR or after a deploy, on a standalone Hono + Effect Worker API. Drives every declared status with curl, even when tests are green. Not for writing code; for a defect found here, continue with debug-endpoint.
---

# Probe endpoint

An endpoint is verified when a curl that actually ran returned the status and body in the report, and both can be pasted. Green tests, a clean typecheck, a click in Swagger or reading the handler are not verification. Swagger UI (`/api/v1/docs`) is for discovery; curl is the record.

## 1. Set up
```bash
npm run dev                      # background; wait for "Ready on", note the port
export BASE=http://localhost:8787/api/v1
export TOKEN='<Firebase ID token of a normal user of this env's FIREBASE_PROJECT_ID>'
export ADMIN_TOKEN='<token of a user with role=admin>'    # only if a route has requireRole
```
Get tokens the way a client does (the app's login, or Firebase Auth REST `signInWithPassword` for a test user). No token: protected routes are **UNVERIFIED**; say so. Never add a route to `PUBLIC_ROUTES` to skip auth.

## 2. Drive it, always showing the status
```bash
curl -s -D /dev/stderr "$BASE/timeOffRequests?limit=2" -H "Authorization: Bearer $TOKEN" | jq
curl -s -D /dev/stderr -X POST "$BASE/timeOffRequests" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d @body.json | jq
```
Bodies come from `api.http` or the schema `examples`; add new ones to `api.http`.

## 3. Read the envelope
`{ data }` success; `{ data, meta.pagination }` list (send `cursor` back as `?cursor=`); `{ code, message }` mapped error; empty 204 on delete; anything else (bare array, stack trace, Hono's plain `500 Internal Server Error`) is a defect.

## 4. Diff against the spec
```bash
curl -s "$BASE/openapi.json" | jq '.paths["/api/v1/timeOffRequests"].get.responses["200"].content["application/json"].schema'   # spec path: the one app.ts or the repo CLAUDE.md declares (/openapi.json in the template; some apps serve /openapi)
curl -s "$BASE/timeOffRequests" -H "Authorization: Bearer $TOKEN" | jq -S '.data[0] | keys'
```
A spec that disagrees with the response is the bug even when the response is right.

## 5. Drive every declared status
| Case | How | Expect |
|---|---|---|
| success | real body | 200 / 201 on create / 204 on delete |
| no token / bad token | omit header / `Bearer nonsense` | 401 |
| without role | `$TOKEN` on an admin route | 403 |
| another user's record | id owned by someone else | 404 (architecture §6) |
| invalid body / query | `{"type":"x"}`, `?limit=0` | 400, message names the field |
| missing record | `/does-not-exist` | 404 |
| bad cursor | `?cursor=garbage` | 400 "Invalid cursor" |
| invalid transition | approve an already approved request | 409 |
| server-owned field in body | `-d '{"ownerId":"someone-else", ...}'` | 2xx, returned record shows the **caller's** ownerId |
| body limit / rate limit | > 1 MB body; burst past the limit (deployed only) | 413 / 429 |

Deployed env: `BASE=https://<env>-<name>.<account>.workers.dev/api/v1`; once per release also check headers: `curl -s -D - -o /dev/null "$BASE/health" -H 'Origin: https://evil.example' | grep -iE 'access-control|strict-transport|x-content-type'`. Never change data in `prod` to verify without the user's go-ahead.

## Report
`## Result` per `${CLAUDE_PLUGIN_ROOT}/rules/result-block.md` with **Verdict** VERIFIED | PARTIAL | UNVERIFIED, **Drove** (method, path, env, as which role), **Command** (exact curl, token redacted), **Saw** (status + body; comparison with the spec), **Statuses driven** (each actually triggered, and which were only reasoned about). PARTIAL when some declared statuses could not be driven. Never VERIFIED from tests alone.
