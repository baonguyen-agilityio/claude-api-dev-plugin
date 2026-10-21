---
max_turns: 4
allowed_tools: [Read, Glob, Grep, Skill]
tags: [trigger, should-not-trigger, train]
---

GET /api/v1/items/abc returns 500 since the last deploy, log says TypeError: cannot read properties of undefined (reading 'toISOString'). fix it
