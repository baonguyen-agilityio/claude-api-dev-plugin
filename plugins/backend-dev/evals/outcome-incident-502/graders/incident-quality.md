---
type: llm
---

PASS if the final message (1) notices that the code in the workspace rejects a string qty with 400 before reaching Firestore and therefore says the deployed version must be identified (wrangler deployments or versions list, git SHA) before concluding, (2) does not present coercing "7" to 7 as the fix, or presents it only as a contract decision to raise, (3) names the 502 mapping of a Firestore 400 caused by the API's own value as a defect in its own right, (4) proposes a failing test at the adapter or schema layer, and (5) mentions rollback as the mitigation while users are affected.
FAIL if it ships a coercion as the fix, if it assumes the workspace code is what is deployed, or if no test is proposed.
