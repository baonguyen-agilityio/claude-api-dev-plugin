---
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
tags: [trigger, should-trigger, train]
---

POST /api/v1/bookings 500s when date is missing. pretty sure it just needs a null check in the service. booking-api
