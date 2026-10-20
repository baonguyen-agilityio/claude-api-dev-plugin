---
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
tags: [trigger]
---

API bị lỗi: sau khi deploy inventory-api lên stag thì request nào cũng 401 dù token mới, còn prod thì bình thường. đây là worker hono + effect + firestore.
