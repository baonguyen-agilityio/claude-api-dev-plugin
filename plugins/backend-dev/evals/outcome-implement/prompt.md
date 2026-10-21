---
max_turns: 40
allowed_tools: [Read, Glob, Grep, Write, Edit, Skill, Bash]
tags: [outcome]
---

This worker api (hono + effect + firestore, files here, dependencies installed) needs a suppliers module: name (required, ≤120), email (required), status active|archived (server-owned, starts active). Users see and edit their own suppliers; admins see all and can filter with ?status=. Add POST /suppliers/:id/archive, 409 when already archived. Follow the repo conventions, write the tests, and show the gate output.
