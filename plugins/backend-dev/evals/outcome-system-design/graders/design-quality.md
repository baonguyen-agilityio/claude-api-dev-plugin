---
type: llm
---

PASS if the final message (1) keeps the approve/reject request path to a single write and moves the email and the export off it onto a named Workers primitive (Queue, Cron Trigger, or an explicitly justified polling cron), (2) names an idempotency key for the email and one for the export and where each is stored, (3) states at least two platform limits with how the design stays under them, and (4) ends with an ADR that has context, decision, at least one rejected alternative with a reason, and consequences.
FAIL if emails are sent inside the request handler, if idempotency is not addressed, if no limit is named, or if there is no ADR section.
