---
name: data-model
description: "Designs Firestore data for a Cloudflare Workers API: document shapes from the access patterns, server-owned fields, composite indexes as firestore.indexes.json, cursor rules, consistency under concurrent writes, and a rollout plan for existing data. Use when a feature needs to store, query, filter, sort, count or migrate data, even if the user only asks for a field, an index or a filter, or asks how to store something."
allowed-tools: Read, Glob, Grep, Write, Edit, WebFetch
---

# Data model

Problem this solves: a feature needs documents, queries and invariants, and Firestore punishes a shape chosen before the access patterns (missing composite, unbounded fan-out, a balance that goes negative under two concurrent writes). The answer is the data design in the reply plus `firestore.indexes.json`, the one file this skill writes. Works on its own or as a step of the process; module boundaries and the HTTP shape are separate skills.

Before anything else, follow the project profile: the `backend-dev:profile` block in the repo's `CLAUDE.md`. Where it differs from the defaults below (commands, layering, error style, git and CI conventions), the profile wins. No profile: the defaults below are the template's (`${CLAUDE_PLUGIN_ROOT}/references/project-profile.md`); say in the result that `/backend-dev:kit-setup` has not been run.

Rules of the store: `references/firestore-modeling.md` (shapes, server fields, consistency, rollout). Queries, indexes and cursors: `references/queries-and-indexes.md`.

## Procedure

1. **Read what exists before naming a field.** Open the module's models or types, the indexes file and the data access layer the profile names (template: `models/`, `firestore.indexes.json`, `core/firestore.ts`); list the collections, their field names and types, the state machine and the cursor format the adapter already produces. A design that renames `ownerId` to `employeeId` or stores a date as a string next to timestamps is a migration, not a design.
2. **List the access patterns first, one line each:** actor, filter fields, order, page size, write frequency. Every document shape and every index is justified by a line here; a field nobody filters or reads has no index.
3. **Choose the shape per pattern** with the embed/reference/duplicate table in the reference: one document per thing the API returns; an unbounded list (history, comments) is a subcollection; a value read on every list (latest decision) is duplicated onto the parent and named as a copy; a thing looked up by a natural key (`balance per employee, year, type`) gets a deterministic id, so a lookup is one `get` and racing creators collide instead of duplicating.
4. **Mark every field server-owned or client-supplied.** Server-owned: ids, `ownerId` from the token, timestamps (`REQUEST_TIME` transform or adapter), status, derived amounts. Snapshot what a later rule change must not alter (`deductedDays` on approve, so cancel refunds exactly that).
5. **Derive the indexes from the queries, then write `firestore.indexes.json`.** One composite per distinct (equalities…, range/order) shape; the range field leads the `orderBy`; `__name__` is the implicit tiebreak and follows the last field's direction. A query that needs an index the file does not declare is a bug, not a console link to click later.
6. **Define the cursor contract per query:** opaque, encodes the order-by values plus the document name, bound to the filter set that produced it, `400 Invalid cursor` otherwise; `limit + 1` or the adapter's `nextCursor` to detect the last page.
7. **Choose consistency per invariant:** a precondition (`currentDocument.updateTime` / `exists`) for one document; a transaction (`:beginTransaction` + `:commit`) when the check reads one document and writes another (balance must not go negative); a `FieldTransform.increment` for counters with no invariant; sharded counters only above ~1 write/s on one document. Say which REST status the loser gets and who retries. If the adapter lacks the primitive, say so; adding it is implementation work.
8. **Plan the rollout for existing documents:** additive fields; tolerant readers first; backfill idempotent with `updateMask` and an `updateTime` precondition; flag flip; reconcile; rollback by flag. Export the collection before the backfill.
9. **Classify the data:** PII and free text (comments, reasons), retention of history, what an admin list leaks across owners.

## Gotchas seen on this stack

- The no-skill run designed against invented fields (`employeeId`, `startDate` as a string) without opening the repo: the template has `ownerId`, `from`/`to` as timestamps and `cancelled` already in the state machine. Step 1 exists because of that.
- Firestore has supported range filters on several fields since 2024; "one range field per query" is no longer a limit. The costs remain: the range fields must lead the `orderBy`, each shape needs its own composite, and a second range is paid in index entries read. The architecture note says which shapes the API offers; an overlap query (`from <= b AND to >= a`) is possible, not free.
- A document missing the ordered or filtered field is invisible to that query, silently. Backfill the field before an index that sorts on it goes live.
- A string and a timestamp in the same field sort by type, not by value; one mixed document breaks every range on that field.
- The template adapter has `update` with `updateMask` and `currentDocument.exists`, and no transaction or transform. A balance invariant needs `:beginTransaction`/`:commit` added to the `Firestore` tag and its fake; the design must say so instead of assuming it.
- The adapter's `query` runs `:runQuery` on the database root (`from: [{ collectionId }]`), so it cannot read a subcollection. History as `timeOffRequests/{id}/approvals` needs a parent path in the adapter; history as a top-level `timeOffApprovals` with `requestId` works today. Say which, and what implement must add.
- An unmasked `PATCH` replaces the document and deletes the fields a migration just added.
- Cursors from `Date` carry millisecond precision; a timestamp written by another client with microseconds makes the next page skip or repeat the boundary row. Carry the raw `timestampValue` string in the cursor when documents are not all written by this API.
- Counting approved days from the request documents on every balance check is a fan-out of reads inside the request path; store the running total and reconcile it from the documents in a job.

## Output

````markdown
## Collections
### <collection>/{id}  (<existing, extended> | <new>; id = <auto | natural key>)
| Field | Type | Owner | Rule |
<one row per field; Owner = client | server; derived and copied fields say from what>
Invariants: <one line each>

## Queries and indexes
| # | Actor | Filter | Order | Index |
<one row per access pattern>
```json
<firestore.indexes.json, complete, to be written to the project>
```
Cursor: <what it encodes, what invalidates it>
Not queryable as asked: <pattern → why → the shape offered instead>

## Consistency
<invariant → mechanism (precondition | transaction | increment | shard) → loser's status → retry policy → what the adapter must gain>

## Rollout
<numbered steps: export, indexes, tolerant readers, backfill (idempotent, masked, preconditioned), flag flip, reconcile, rollback>

## Data classification
<PII / free text / retention / cross-owner exposure>

## Assumptions (defaults applied) / Open questions (blocking only)
**Next:** api-contract for the endpoints that read and write this data, or implement when the contract is already settled. Inside a ticket, the card's Next line names the following command.
````

## Done when
- [ ] Every field in the tables exists in the repo or is marked new; types match the existing documents.
- [ ] Every query line has an index row and the file declares it.
- [ ] Every invariant has a mechanism, a loser status and a retry owner.
- [ ] The rollout has an export step and a rollback step.
- [ ] Adapter primitives the design relies on but the template lacks are listed.
