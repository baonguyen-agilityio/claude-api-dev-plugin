---
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
tags: [trigger, should-trigger, train]
---

tests are green but I want proof: show me POST /timeOffRequests/:id/approve really gives 403 to a user, 200 to an admin and 409 the second time, against wrangler dev with curl
