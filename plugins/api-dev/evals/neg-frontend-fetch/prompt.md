---
max_turns: 4
allowed_tools: [Read, Glob, Grep, Skill]
tags: [trigger, negative]
---

in my next.js app the bookings page calls GET /api/v1/bookings with fetch and shows a spinner forever when the token expires. how should the page handle the 401?
