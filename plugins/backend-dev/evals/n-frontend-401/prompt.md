---
max_turns: 4
allowed_tools: [Read, Glob, Grep, Skill]
tags: [trigger, should-not-trigger, train]
---

in my next.js app the bookings page calls GET /api/v1/bookings and spins forever when the token expires. how should the page handle the 401?
