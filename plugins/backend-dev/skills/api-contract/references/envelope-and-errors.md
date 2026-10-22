# Envelope and error contract

Every endpoint of the API answers in one of these shapes; a contract that invents another is a defect.

| Case | Status | Body |
|---|---|---|
| read, update, action | 200 | `{ "data": <entity> }` |
| create | 201 | `{ "data": <entity> }` |
| delete | 204 | empty |
| list | 200 | `{ "data": [<entity>…], "meta": { "pagination": { "limit": n, "cursor"?: "<opaque>" } } }`; `cursor` absent on the last page |
| failure | see table | `{ "code": "<CODE>", "message": "<text>" }`, nothing else |

| Status | `code` | Raised by | Message rule |
|---|---|---|---|
| 400 | `BAD_REQUEST` | body decode, `validate()` on query/path, bad cursor | `"<field>: <reason>"`, first issue only |
| 401 | `UNAUTHORIZED` | missing, expired or foreign-project token | fixed text |
| 403 | `FORBIDDEN` | role guard; ownership on a resource the caller may know exists | fixed text, no hint about the record |
| 404 | `NOT_FOUND` | missing document, or another owner's document the caller may not learn exists | same text for both cases |
| 409 | `CONFLICT` | state transition not in the state machine; a server-side precondition lost; an `Idempotency-Key` reused with a different body | names the current state (`cannot approve a rejected request`) |
| 412 | `PRECONDITION_FAILED` | the client's `If-Match` no longer matches the resource's `ETag` | fixed: "the resource changed; fetch it again" |
| 428 | `PRECONDITION_REQUIRED` | `If-Match` missing on an operation that requires it | fixed; only on endpoints whose contract says it is required |
| 413 | `PAYLOAD_TOO_LARGE` | body > 1 MB | fixed |
| 429 | `RATE_LIMITED` | per-uid limiter, deployed envs only | fixed; with a `Retry-After: <seconds>` header the client waits before retrying |
| 502 | `UPSTREAM_ERROR` | Firestore or OAuth failure | generic, never the upstream body |

Rules the contract inherits:
- Entities carry `id`, `ownerId`, `createdAt`, `updatedAt` plus their fields; dates are ISO 8601 strings in UTC; date-only values are midnight UTC.
- Request bodies hold writable fields only. `id`, `ownerId`, `status`, `decidedBy`, `decidedAt`, timestamps are never accepted; a body carrying them still succeeds and the response shows the server's values.
- Excess body fields are stripped, not rejected.
- `PATCH` takes a partial body with at least one field; `PUT` is not used.
- Query parameters: `limit` 1..100 (default 20), `cursor`, then the filters the data design indexed. A filter without an index is not offered.
- Single-resource reads and every write that returns the entity carry an `ETag` header (the document's update time, opaque to clients).
- A deprecated field or endpoint answers with `Deprecation: @<unix seconds>`, `Sunset: <HTTP-date>` (not earlier than the deprecation) and `Link: <migration guide>; rel="deprecation"` (RFC 9745, RFC 8594).
- A new failure needs a new tagged error and a row here before any handler returns it.
