---
type: llm
---

PASS if the final message (1) says who consumes the affected endpoints or asks before changing an existing response, and classifies each change as additive or breaking, (2) gives an endpoint table with request and response shapes that exclude server-owned fields from the request, (3) lists the statuses per endpoint including 401, 403 or 404 with the rule for which one, and 409 for an invalid state transition, (4) states the access rule per endpoint (role and ownership), and (5) ends with acceptance criteria in Given/When/Then form that QA can run.
FAIL if a server-owned field (ownerId, status, decidedBy) is accepted in a request body, if no status list is given, if the additive/breaking question is not addressed, or if there are no acceptance criteria.
