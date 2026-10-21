---
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
tags: [trigger, should-trigger, train]
---

prod has thousands of timeOffRequests where the date is a string; we want real timestamps. how do we get there without breaking the running api?
