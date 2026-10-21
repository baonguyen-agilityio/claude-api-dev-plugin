---
max_turns: 25
allowed_tools: [Read, Glob, Grep, Write, Edit, Skill]
tags: [outcome]
---

Set up delivery for this worker api (files here): add a fourth environment 'testing' with its own Firebase project for QA, and a GitHub Actions pipeline that runs the gates on every PR, deploys to dev on merge to main, and deploys to stag and prod only with a manual approval. Write down how we roll back and what we watch after a deploy.
