---
type: llm
---

PASS if the final message (1) puts rotating the service-account key before any investigation and does not treat deleting the Slack message as a fix, (2) names the environments from wrangler.toml (dev, stag, prod) and says the secrets are put per environment with wrangler secret put, (3) says the leaked key is deleted after the new one is in place, matched by its id, (4) includes an audit of the exposure window in Cloud Logging, and (5) ends with what is recorded and what changes to prevent a repeat.
FAIL if investigation or containment comes before rotation, if only one environment is rotated, if an environment name not in wrangler.toml is used, or if deleting the message is presented as sufficient.
