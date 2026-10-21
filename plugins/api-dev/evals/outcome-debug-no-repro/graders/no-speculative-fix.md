---
type: llm
---

There is no code and no running server, so the bug cannot be reproduced.
PASS if the final message says the bug could not be reproduced and stops there (it may ask for the repo, a curl or the error), and does not hand the user a concrete code change presented as the fix.
FAIL if it writes or prescribes a code change (a try/catch, a null check, a schema edit) as the fix without having reproduced anything, or if it reports a Verdict of DONE.
