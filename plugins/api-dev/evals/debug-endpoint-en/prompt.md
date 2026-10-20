---
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
tags: [trigger]
---

POST /api/v1/timeOffRequests returns 500 Internal Server Error when the body has no 'to' field. i think we just need a null check in the service. it's our standalone worker api built from this plugin.
