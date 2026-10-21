# Reads, limits and amplification

One request runs in one isolate with bounded CPU time and a cap on subrequests; every Firestore call is one subrequest.

| Pattern | Cost per request | Finding |
|---|---|---|
| `db.list` or `db.query` with `limit` | 1 call | fine |
| a `get` per row after a list (`Effect.forEach(docs, (d) => db.get(...))`) | 1 + limit calls | N+1; return the listed documents |
| a list fetched to count it | 1 call reading up to `limit` documents, result discarded | use the stored total or an aggregation query |
| a lookup per row for a display name | 1 + limit calls | duplicate the name onto the document (data-model) or batch the ids |
| validation that reads before every write (uniqueness by query) | 2 calls, racy | a deterministic id with `exists=false` |
| `limit` without an upper bound | unbounded; combined with any of the above, one request can exhaust the subrequest cap | cap at `MAX_LIMIT`, test `limit=101` → 400 |

Count with the largest `limit` the endpoint accepts and write the number in the finding. Latency follows the same count: each call is a round trip to Firestore.

Index gaps are a performance finding too: a filtered query without its composite in `firestore.indexes.json` fails with `FAILED_PRECONDITION` in every environment where the index was not created from the console link.
