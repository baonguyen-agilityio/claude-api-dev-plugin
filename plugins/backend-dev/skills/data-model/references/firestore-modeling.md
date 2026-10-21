# Firestore modeling rules for this API

Documents are read whole and billed per read; design for the list the API returns, not for normal forms.

## Shape per access pattern

| Pattern | Shape | Why | Not this |
|---|---|---|---|
| Returned together on every read, bounded size (address on a request) | embed as a map | one read, one write | a second collection joined in the handler |
| Unbounded list owned by one parent (approval history, comments) | subcollection `parent/{id}/<list>/{autoId}`, or a top-level collection with `parentId` + a composite on (`parentId`, `createdAt`) | no 1 MiB document cap, no growth in the parent the list query reads; the top-level form works with the adapter as is, the subcollection needs `query` to take a parent path | an array field that grows forever |
| Value read on every list but owned elsewhere (latest decision, display name) | duplicate onto the parent, name it as a copy | list queries stay single-collection | a per-row lookup in the handler (N subrequests) |
| Thing addressed by a natural key (balance per employee + year + type) | deterministic id `${employeeId}_${year}_${type}` | lookup is one `get`; racing creators collide (`exists=false`) instead of duplicating | a query by three equalities plus a uniqueness check in code |
| Many-to-many (employees ↔ teams) | an edge collection or an array of ids on the smaller side, `array-contains` | Firestore has no join | nested maps keyed by id (unqueryable) |
| Shared across tenants or owners | top-level collection with `ownerId` on every document | one ownership rule, one index prefix | per-owner collections (no cross-owner admin query) |

## Server-owned fields
Every document: `id`, `ownerId` (from the verified token), `createdAt`, `updatedAt` (adapter or `setToServerValue: REQUEST_TIME`). Per feature: `status`, decision fields, derived amounts, snapshots (`deductedDays`), `schemaVersion` when a migration is planned. None of them is accepted from a request body; the schema for the body omits them rather than stripping them.

## Consistency: pick the weakest mechanism that holds the invariant

| Invariant | Mechanism | Loser gets | Retry |
|---|---|---|---|
| "Only one of two concurrent edits wins" on one document | `currentDocument.updateTime` precondition on the update | `FAILED_PRECONDITION` → 409 | client, with a fresh read |
| "Create only if absent" | `currentDocument.exists=false` | `ALREADY_EXISTS` → 409 | none |
| "Count without a bound" (views, likes) | `updateTransforms: [{ increment }]` | never loses | none |
| "Read A, then write A and B under a condition" (balance ≥ 0, seat left) | `:beginTransaction` (read-write) → reads with the transaction id → one `:commit` with every write | `ABORTED` → retry in a new transaction, bounded (3–5, jittered); then 409/503 | the service |
| One document written > ~1/s sustained | shard the counter into N documents, read all N to total | n/a | n/a |

The REST adapter in the template implements `update` with `updateMask` + `exists=true`, `create`, `remove`, `get`, `list`, `query`. It has no `:commit` with preconditions beyond `exists`, no transforms, no transactions. A design that needs one of those lists it under "what the adapter must gain" and hands it to implement; it does not pretend the primitive exists.

Workers have no process-wide lock: two isolates run the same handler at once. Firestore is the lock.

## Rollout for existing documents (every step runs against the live API)
1. Export the collection (`gcloud firestore export`) and count documents missing any field the new queries filter or order by; a missing field hides the document from that query.
2. Deploy indexes (additive; wait for READY).
3. Deploy readers that tolerate both shapes, behind a flag that keeps new enforcement off; confirm every write uses an `updateMask` and the status decoder accepts every value the migration will produce.
4. Backfill, idempotent and re-runnable: `updateMask` on the new fields only, `currentDocument.updateTime` from the read so a concurrent edit is not clobbered, from a local script with the service account (no Admin SDK on Workers; the script may use it).
5. Flip the flag. Reconcile derived totals from their sources in a job; drift can only come from writes between the backfill read and the flip.
6. Rollback = flag off; the fields are additive and old code ignores them. The two things that break rollback: an unmasked `PATCH` and a strict decoder meeting a new enum value.

## Data classification
Free-text fields (reason, comment) are PII by default: no logging, no export without the system-design decision on exports. History subcollections keep who-did-what; state the retention. An admin list across owners is the one place ownership is not a filter; say what it exposes.
