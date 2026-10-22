---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
tags: [outcome]
---

Our worker api (hono + effect + firestore, files are here) already has timeOffRequests in production. Add: a leave balance per employee and leave type that must never go negative (approve deducts, cancelling an approved request refunds), an approval history with who/when/comment, and admin filters by status plus date range and by employee plus date range. Give me the data design: collections and fields with what the server owns, the exact firestore.indexes.json, cursor rules, how the balance stays correct under concurrent approvals, and the rollout for the existing documents.
