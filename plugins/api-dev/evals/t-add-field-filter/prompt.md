---
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
tags: [trigger, should-trigger, train]
---

in booking-api (our hono worker, src/modules/rooms exists) product wants rooms to have a capacity field and the mobile app will filter with ?minCapacity=
