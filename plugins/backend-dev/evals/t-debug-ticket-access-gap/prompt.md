---
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
tags: [trigger, should-trigger, train]
---

ticket PTO-42: employees can open each other's leave requests via GET /api/v1/timeOffRequests/:id. only the owner or an admin should see one. repo booking-api
