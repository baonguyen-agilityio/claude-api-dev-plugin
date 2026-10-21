---
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
tags: [trigger, should-trigger, validation]
---

deployed dev-booking-api yesterday. can you double check that /api/v1/rooms on https://dev-booking-api.example.workers.dev gives back the { data } shape and rejects a missing token?
