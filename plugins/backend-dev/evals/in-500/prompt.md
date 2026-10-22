---
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
tags: [trigger, should-trigger, train]
---

prod: PATCH /api/v1/items/:id returns 502 for some clients since this morning. tail shows firestore PATCH documents/items/abc 400 INVALID_ARGUMENT integer_value "7". handle it
