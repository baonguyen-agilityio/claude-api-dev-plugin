---
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
tags: [trigger, should-trigger, train]
---

we're adding a leave balance per employee (annual, sick) to our worker api on firestore. approving a request deducts days, cancelling gives them back, and it must never go negative. how should the data be stored?
