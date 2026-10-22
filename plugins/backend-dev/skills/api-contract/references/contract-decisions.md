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
