# Contract decisions

## Additive or breaking
| Change | Class | Consequence |
|---|---|---|
| new endpoint; new optional request field; new response field; new enum value *produced* only when clients were told to tolerate unknown values | additive | ship; document |
| new required request field; renamed, removed or retyped response field; a status that used to be 200 becoming 4xx; a new enum value clients switch on | breaking | find the consumers first; add alongside → migrate → remove in a later release; or a new version prefix when the break cannot be staged |
| tightening validation on existing input (shorter max, new pattern) | breaking for clients that sent the old values | measure before tightening; reject only new writes if the old data must stay readable |
| changing a default (`limit`, sort order) | breaking in practice | treat as breaking |

Consumers are not found by grep in this repo; if the user cannot name them, the contract says "consumers unknown, treated as breaking" and stays additive.

## PATCH or an action endpoint
| Change | Shape | Why |
|---|---|---|
| editing the caller's own writable fields | `PATCH /<col>/:id` with a partial body | one DTO, one ownership rule |
| a state transition (approve, reject, cancel, archive) | `POST /<col>/:id/<verb>` with an optional small body (`{ note }`) | the transition has its own access rule and its own 409; a `PATCH {status}` would need status in the body, which is server-owned |
| a transition that needs data from the actor (reject with a reason) | the same action endpoint with a body DTO (`{ reason }` required) | the field lives on the request, written by the server with the actor's uid and time |

## Concurrent edits: ETag and If-Match
Two people editing or deciding the same resource is the race this stack keeps hitting (read, check, update, both win). Put the guard in the contract:
- `GET /<col>/:id` and every write that returns the entity send `ETag: "<update time>"`.
- `PATCH` and action endpoints accept `If-Match: "<etag>"`; a stale value answers **412** and changes nothing.
- On an **existing** endpoint `If-Match` starts optional (412 only when sent): making it required breaks clients that do not send it. Require it (**428** when missing) only on new endpoints, or after a deprecation period.
- Implementation maps the ETag to the Firestore document's update time and the check to the write's `currentDocument.updateTime` precondition; the adapter has to return and accept that value.
- Acceptance: "Given two admins loaded the same request, When the second approves with the old ETag, Then 412 and the request keeps the first decision."

## Creates that clients retry: Idempotency-Key
Mobile and queue clients retry a `POST` after a timeout; without a key the retry creates a second record.
- `POST` endpoints that create records accept `Idempotency-Key: <client-generated id>` (optional on existing endpoints, required on new ones that clients retry).
- Same key and same body within the retention window (state it, e.g. 24 h): answer the original `201` with the same entity. Same key, different body: **409**.
- Implementation: a deterministic document id derived from the caller and the key with `currentDocument.exists=false`, or a small `idempotencyKeys/{uid}_{key}` record storing the response; data-model decides which.

## Deprecating and removing
For a breaking change that can be staged:
1. Add the new field or endpoint alongside; both work.
2. Mark the old one deprecated: in the OpenAPI spec (`deprecated: true`) and on every response that uses it (`Deprecation: @<unix seconds>`, `Sunset: <HTTP-date>`, `Link: <guide>; rel="deprecation"`).
3. Tell the consumers with the date and a short migration guide (old → new, one example each).
4. Remove after the sunset date, in its own release, after checking the old one is no longer called (logs).

## Machine checks on the contract
The spec is generated from the code (`/openapi.json` or the path the profile names), so check the generated spec rather than a hand-written one:
- **Lint:** `npx @redocly/cli lint <spec>`: every operation has responses for its statuses, examples parse, no duplicate operation ids.
- **Breaking-change diff:** export the spec on the base branch and on the change, then `oasdiff breaking base.json head.json` (install: `brew install oasdiff`, or the `tufin/oasdiff` Docker image). Any finding is a breaking change: name the consumers or stage it as above. Pin both tools as dev dependencies when the team adopts them.

## Versioning
`/api/v1` is the only prefix until a break cannot be staged. A second prefix means two handlers for the same data; prefer additive.

## Acceptance criteria
One Given/When/Then per status per endpoint, with concrete values QA can send:
```
Given a pending request owned by user A
When admin B POSTs /timeOffRequests/{id}/approve with {"note":"ok"}
Then 200, data.status = "approved", data.decidedBy = B's uid, data.note = "ok"
```
Cover: the happy path, 401, the 403/404 rule, 400 on the body, 409 on the transition, and the server-owned field ignored.
