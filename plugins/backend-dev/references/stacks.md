# Stacks

The kit's skills are written for one default stack. A repo on another stack still gets the process; it never gets advice for a store, runtime or deploy tool it does not use.

## The default stack

`workers-firestore`: Cloudflare Workers, Hono, Firestore through its REST API, Firebase ID tokens, Wrangler for local runs, secrets and deploys. The template in `templates/`, `scaffold.mjs`, `new-module.mjs`, `architecture.md` and every "Gotchas seen on this stack" section describe this stack.

## Which stack a repo is on

The profile's **Stack** line: `<runtime> · <framework> · <datastore> · <auth> · <deploy target>`, for example `Cloudflare Workers · Hono · Firestore · Firebase Auth · Wrangler` or `Node 22 · Hono · Postgres (Drizzle) · JWT · Docker on ECS`. `kit-setup` writes it from the repo's dependencies and config. In a monorepo whose apps differ, the line holds one entry per app, apps on the same stack grouped: `apps/space, apps/flash: Cloudflare Workers · Hono · Firestore · Firebase Auth · Wrangler; apps/jobs: Node · Trigger.dev · Firestore (firebase-admin)`. A skill applies the entry of the app the change touches; a change across apps applies each app's entry to its own files. A profile without the line (written before it existed) is on the default stack when the repo has a `wrangler.toml` and either a `firestore.indexes.json` or code that calls `firestore.googleapis.com` or imports a Firestore client; otherwise treat it as another stack with no guide, state that assumption in the result, carry on, and suggest re-running `/backend-dev:kit-setup`.

## On another stack

1. Look in the plugin for a guide `references/stacks/<slug>.md` whose **Matches** line covers the profile's Stack line. When one exists, it replaces the default-stack parts listed below, skill by skill.
2. When none exists, keep the stack-neutral parts below, take the rest from the repo itself (its architecture note, the closest module, its config and scripts), and say in the result: "No kit guide for this stack (<Stack line>); stack-specific steps followed the repo."
3. Never carry the default stack's specifics into such a repo: no `firestore.indexes.json`, no Firestore REST primitives, no `wrangler` command, no Firebase token flow, no `scaffold.mjs` or `new-module.mjs`.

The stage skills pre-approve npm and pnpm commands only; on a repo whose gates use another tool (yarn, bun, gradle, make), each gate run asks for approval in default mode, so a lead who wants it silent adds those commands to the repo's `.claude/settings.json` allow list.

Not affected by the stack: the five ticket commands, the ticket and incident records, the plan gate, `review`, the guard rules and the hooks; they read their commands from the profile.

## Stack-neutral and default-only, per skill

| Skill | Holds on any stack | Default stack only |
|---|---|---|
| system-design | actors and flows; module boundaries; request path versus background work; idempotency keys per side effect; races on write paths; data leaving the system; decide with defaults | the primitive table (Queues, Cron Triggers, Durable Objects, Workflows), Workers CPU and subrequest limits, per-env cron in `wrangler.toml` |
| data-model | read what exists first; access patterns before shapes; server-owned versus client fields; one index per query shape; cursor contract; consistency per invariant with the loser's status; rollout with export and rollback; data classification | document shapes, subcollections, `firestore.indexes.json`, Firestore preconditions, transactions and transforms, the REST adapter's gaps; `references/firestore-modeling.md`, `references/queries-and-indexes.md` |
| api-contract | all of it: consumers and breaking changes, access matrix, statuses, 403/404 rule, `ETag`/`If-Match`, Given/When/Then, spec lint and `oasdiff` | `PUBLIC_ROUTES` and module file names, which follow the repo |
| implement | read the closest module first; layer order; access from the contract; state transitions; tests 403/404 first; gates after each layer; prove it live or say so | `scaffold.mjs`, `new-module.mjs`, the `Firestore` tag and its fake, Effect patterns, `wrangler deploy --dry-run`; `references/patterns.md` |
| review-and-secure | the whole checklist: contract against code, access, input, errors by the profile's style, reads per request, headers and CORS, secrets and logs, loosened tests, a test per finding, MR notes | Firestore call counting on the REST adapter, the `ratelimits` binding, `references/performance.md` numbers |
| live-verify | drive every declared status against a running API with the output pasted; check state after each step; spec diff; headers; logs; races; clean up; the verdict rule | Firebase token flow and `set-claim.mjs`, `wrangler dev` and `wrangler tail`, `.dev.vars`; `references/token-flow.md` |
| delivery | target confirmed by the user; gates and audit; config per environment; data changes before code; smoke with a real token; promote one step at a time; approvals outside the YAML; rollback and what it does not undo; secret rotation | `wrangler.toml` env blocks, `wrangler secret`, `wrangler rollback`, Firebase CLI for indexes, `ratelimits`; `references/environments.md`, `references/pipeline-and-runbook.md`, `references/troubleshoot.md` |
| incident | triage and the incident record; what is live before reading code; reproduce; a failing test first; cause not symptom; blast radius; fix in the shared place; proof; postmortem; leaked-credential order (rotate, then investigate) | `wrangler deployments`, `wrangler tail`, Firestore error codes, Firebase key rotation; `references/symptoms.md`, the Wrangler and Firebase parts of `references/leaked-credential.md` |

## Adding a stack

One file, `references/stacks/<slug>.md`, no change to any skill:

```markdown
# <Stack name>
**Matches:** <the Stack lines this guide covers>
**Run locally:** <command, port, where config and secrets come from>
**Logs:** <command or console>

## system-design
<primitives for background work, scheduled work and fan-out; platform limits that matter>
## data-model
<store, how shapes and indexes are declared, consistency primitives, migrations tool>
## implement
<module layout, error and validation pattern, how a new module is created>
## review-and-secure
<stack-specific checks: query counting, ORM pitfalls, framework defaults>
## live-verify
<how to obtain a token per role, how to start the API, how to read logs>
## delivery
<environments, secrets, deploy and rollback commands, what rollback does not undo>
## incident
<how to find what is live, common symptoms and their causes, credential rotation>
## Gotchas
<one line each, seen in a real run>
```

A guide is ready when a real `/backend-dev:build` and `/backend-dev:prove` on a repo of that stack ran without a correction from the developer on stack matters.
