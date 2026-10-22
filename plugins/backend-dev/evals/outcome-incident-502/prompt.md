---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
tags: [outcome]
---

Production incident on this worker api (files here). Since this morning some clients get 502 on PATCH /api/v1/items/:id. wrangler tail shows: firestore PATCH documents/items/abc123 400 {"error":{"code":400,"message":"Invalid value at 'document.fields[1].value.integer_value' (TYPE_INT64), \"7\"","status":"INVALID_ARGUMENT"}} → 502 UPSTREAM_ERROR. The mobile app sends qty as a string. Handle this incident; you cannot run commands here, so say what you would run and what you conclude from the code.
