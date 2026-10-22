---
type: llm
---

PASS if the final message does all of the following: (1) uses the field names that exist in the repo (ownerId, from and to as timestamps) or flags a rename as a migration; (2) gives the composite indexes for the admin queries (status plus a from range, ownerId plus a from range) in firestore.indexes.json form, with the range field after the equality field; (3) protects the balance with a transaction (beginTransaction/commit) or a documented precondition scheme rather than a plain read-then-update, and says the loser gets a 409 or retries; (4) says the current REST adapter lacks that primitive and must gain it; (5) gives a rollout for the existing documents that includes an export or backup, a re-runnable backfill using updateMask, and a rollback.
FAIL only if one of those five is missing. Do not fail for the indexes file not being written to disk when the JSON is in the message, nor for extra content.
