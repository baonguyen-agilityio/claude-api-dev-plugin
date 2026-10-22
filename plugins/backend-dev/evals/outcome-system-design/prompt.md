---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
tags: [outcome]
---

Our worker api (hono + effect + firestore, see any files here) needs: employees submit leave requests, their manager approves or rejects, the employee gets an email on each decision, HR gets a CSV of last month on the 1st. Design it before any code: modules, request path vs background work, how emails and the export are safe against retries, which platform limits matter. Finish with an ADR.
