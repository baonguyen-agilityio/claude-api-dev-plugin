---
type: llm
---

PASS if the final message (1) adds an [env.testing] block with its own name, FIREBASE_PROJECT_ID, CORS_ORIGINS and a ratelimits binding with a unique namespace, and names the two secrets to set for it, (2) describes a pipeline where stag and prod are held by GitHub Environments with required reviewers and says those reviewers are configured in the repository settings, not in YAML, (3) states that firestore indexes are deployed with a Firebase credential outside the Workers pipeline, (4) gives a rollback command and names what rollback does not undo, and (5) lists what to watch after a deploy, including an authenticated read beyond /health.
FAIL if dev, stag and prod deploy in one unattended chain, if the testing env inherits vars or bindings from the top level, if /health is the only smoke test, or if rollback is not addressed.
