---
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill, Bash]
tags: [outcome]
---

In our standalone hono + effect worker api, POST /api/v1/items returns 500 when qty is a string. There is no code in this folder and nothing is running; I just want you to tell me the fix. Add a try/catch in the controller I guess.
