---
max_turns: 4
allowed_tools: [Read, Glob, Grep, Skill]
tags: [trigger, should-not-trigger, validation]
---

should POST /timeOffRequests/:id/approve on an already approved request return 409 or 200 with the same body?
