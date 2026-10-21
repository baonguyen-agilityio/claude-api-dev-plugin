# Queries, indexes and cursors

## What a Firestore query can do
- Equalities on any number of fields (`==`, `in` up to 30 values, `array-contains`).
- Range filters (`<`, `<=`, `>`, `>=`, `!=`, `not-in`) on several fields since 2024 (limit 10). The range fields must come first in the `orderBy`; a query with an inequality on a field implies ordering by that field.
- `orderBy` on fields the documents have; a document without the field is not in the result.
- No `OR` across fields outside `or()` composite filters (which fan out to one index per branch), no joins, no aggregation beyond `count`/`sum`/`avg` over an indexed query.

## Index per shape
Single-field indexes are automatic. A composite is needed when a query combines an equality with an order on another field, or two orders, or a range plus an order on different fields. Write it from the query:

| Query | Index fields |
|---|---|
| `ownerId == me` order `createdAt desc` | `ownerId asc, createdAt desc` |
| `status == x`, `from >= a`, `from <= b` order `from asc` | `status asc, from asc` |
| `ownerId == me`, `from` range | `ownerId asc, from asc` |
| `from <= b AND to >= a` (overlap), equality on `ownerId` | `ownerId asc, from asc, to asc` (second range paid in index entries read; put the more selective range first) |
| direction flipped (`from desc`) | a different index; declare it, do not reuse |

`__name__` is appended automatically in the direction of the last field; the adapter adds it explicitly so cursors are unique.

`firestore.indexes.json` shape:
```json
{ "indexes": [ { "collectionGroup": "<col>", "queryScope": "COLLECTION", "fields": [ { "fieldPath": "ownerId", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] } ], "fieldOverrides": [] }
```
Deploy with `firebase deploy --only firestore:indexes`; a query whose index is missing fails with `FAILED_PRECONDITION` and a console link. The link is a symptom; the fix is the file.

## Cursors
- Keyset only: `startAt { values: [<order-by values…>, <document name>], before: false }` from the last row. Offsets re-read skipped rows and shift under inserts.
- Opaque to clients (base64url). Encode the order-by values and the document name; bind the cursor to the filter set and order that produced it (a hash in the cursor, or reject when the decoded value count differs from the current order list). Anything else answers `400 BAD_REQUEST "Invalid cursor"`.
- Last page: ask for `limit + 1` or rely on the adapter's `nextCursor` being absent.
- Timestamps in cursors: Firestore keeps microseconds, `Date` keeps milliseconds. Documents written only by this API carry millisecond timestamps and round-trip; documents written by other clients need the raw `timestampValue` string carried through.
- A cursor is not a snapshot: rows inserted before the cursor position are not returned; say so in the contract when the client expects completeness.
