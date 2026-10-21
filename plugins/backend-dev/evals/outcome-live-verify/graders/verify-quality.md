---
type: llm
---

PASS if the final message (1) gives a token flow that sets the admin claim before signing in and checks the token's aud against the target project, (2) lists the curl steps in an order that includes 401, 403, the happy path, 409 and the state check after the 403 and the 409, (3) includes a spec diff against /openapi.json or a header check, (4) includes a concurrency check or names the read-then-update race, and (5) ends with a verdict line that says UNVERIFIED or PARTIAL because nothing was driven, never VERIFIED.
FAIL if the verdict claims the endpoint is verified, if the admin token is minted before the claim is set, or if the steps stop at tests.
