# Workers primitives: which one, when

The request path is for work that must finish before the client gets an answer. Everything else leaves it. Pick the primitive from the shape of the work, not from habit.

| Work | Primitive | Why | Not this |
|---|---|---|---|
| Answer a client in one round trip | fetch handler | bounded CPU, one isolate | long loops, fan-out to many upstreams |
| Fire-and-forget after a response (log, metric, cache warm) | `ctx.waitUntil()` | runs after the response, same isolate, no retry | anything that must not be lost |
| Must happen, may be delayed, may fail and retry (email, webhook, export of one record) | Queue producer in the handler, Queue consumer Worker | at-least-once delivery, retries with backoff, dead-letter queue, batching | `waitUntil` (lost on isolate eviction), a cron that polls Firestore for "pending" rows |
| On a schedule (monthly export, nightly cleanup) | Cron Trigger (`scheduled` handler) | wall-clock trigger, no client; pair with a Queue when the job fans out | a client request that "happens to run on the 1st" |
| Coordination, ordering or a single mutable counter per key (seat allocation, per-user rate state) | Durable Object | single-threaded per id, transactional storage | Firestore transactions when contention is per key and hot; a DO when there is no ordering need (cost and complexity) |
| Shared small config or cache across isolates | KV (eventually consistent) | cheap reads at the edge | source of truth; anything needing read-after-write |
| Large files (CSV export, uploads) | R2 | object storage, signed URLs | Firestore documents (1 MiB cap), returning the file inline from a cron |

## Limits that shape designs (check current numbers in the Cloudflare docs before relying on them)
- CPU time per invocation is bounded (tens of ms on the free plan, more on paid); wall time is not CPU time, but a 10 000-document loop is.
- Subrequests per invocation are capped; one Firestore call is one subrequest. A fan-out of N reads is N subrequests.
- Memory per isolate is limited (128 MiB class); never build a month's export in memory from Firestore documents one by one without streaming or chunking.
- Module-scope state is per isolate and may vanish at any time: fine for a service-account token cache, never for user state or dedupe sets.
- No filesystem; no long-lived sockets; `firebase-admin` does not run (REST only).
- Queue consumers receive batches; make the handler idempotent per message id.
- Cron handlers have no request and no user; they run as the service account.

## Idempotency recipes
- Email on decision: idempotency key = `${requestId}:${decisionVersion}`; store `notifiedAt` + key on the request document with an `updateMask` write; the consumer skips when the key is already present.
- Monthly export: key = `export:${YYYY-MM}`; the cron enqueues one job; the consumer writes `exports/{YYYY-MM}` with `currentDocument.exists=false` so a second run cannot overwrite; writes the file to R2 under the same key.
- Any Queue message: carry the entity id and version; never carry the full payload if the entity can change before delivery.
