---
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
tags: [trigger, should-trigger, train]
---

add a suppliers module: name, email, status active|archived, users see their own, admins all, POST /suppliers/:id/archive with 409 when already archived. tests too.
