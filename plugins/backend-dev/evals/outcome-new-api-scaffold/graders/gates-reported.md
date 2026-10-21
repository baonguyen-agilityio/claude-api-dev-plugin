---
type: llm
---

PASS if the final message contains a Result block with a Verdict (DONE, DONE-WITH-GAPS or BLOCKED), reports the outcome of typecheck, test and the wrangler dry-run check with their actual output or an explicit statement that one could not run, and lists the placeholder ids under Not done.
FAIL if a gate is reported green without any output, if the Verdict is DONE while a gate was skipped, or if there is no Result block.
