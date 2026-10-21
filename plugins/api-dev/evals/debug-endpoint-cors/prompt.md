---
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
tags: [trigger, known-gap]
---

Bug report for our API (apps/api, a hono + effect worker on cloudflare, running locally on http://127.0.0.1:8787): any website can call it from the browser. A page on https://evil.example gets Access-Control-Allow-Origin: * back from /api/v1/docs. Find the real cause and say what the fix is and which tests would pin it, but do not edit any file.
