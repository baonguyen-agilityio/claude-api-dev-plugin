---
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
tags: [outcome]
---

Before we ship, I want proof that POST /api/v1/timeOffRequests/:id/approve really works on this worker api (files here): a normal user gets 403, an admin gets 200 and the status changes, a second approve gets 409. Not vitest, the real thing with curl against wrangler dev. There is no server running in this sandbox and no credentials, so tell me exactly what to run, step by step, including how we get the tokens for a user and an admin, and report what you can conclude.
