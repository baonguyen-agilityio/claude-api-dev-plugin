---
type: llm
---

PASS if the final message (1) reports typecheck, tests and check with their output rather than a claim, (2) states the access rule per endpoint and that another user's supplier answers 404, (3) lists the route test cases including a 403/404 case, a 400 case, the 409 on a second archive and a body carrying status or ownerId being ignored, (4) names the composite indexes added for the filtered lists, and (5) either adds a precondition for the archive transition or says the read-then-update race is open and why.
FAIL if any gate is claimed without output, if ownership is enforced only in the route, if status is accepted from the request body, or if the Result makes a contract decision (such as ignoring ?status= for users) without saying so.
