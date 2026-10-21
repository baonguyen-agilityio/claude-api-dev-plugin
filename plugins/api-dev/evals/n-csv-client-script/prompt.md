---
max_turns: 4
allowed_tools: [Read, Glob, Grep, Skill]
tags: [trigger, should-not-trigger, validation]
---

write a python script that reads bookings.csv and POSTs each row to our api at /api/v1/bookings with a bearer token from an env var
