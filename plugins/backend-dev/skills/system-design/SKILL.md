---
name: system-design
description: "Designs how a backend feature fits a Cloudflare Workers + Firestore system: module boundaries, request path versus background jobs, idempotency, platform limits, as a design note and ADR. Use when planning a feature or background job that spans endpoints or needs queues, cron jobs, notifications or exports, or when the user asks where something should run, how to keep it from running twice, or for an architecture note or ADR."
user-invocable: false
allowed-tools: Read, Glob, Grep, Write, Edit, WebFetch
---

# System design

Problem this solves: a feature brief says what should happen, not where the work runs, what happens on retries, or which platform limit breaks it first. The answer is a design note and an ADR in the reply. Works on its own or as the first step of the process in the README; field-level data design and the endpoint contract are separate skills, not prerequisites.

Before anything else, follow the project profile: the `backend-dev:profile` block in the repo's `CLAUDE.md`. Where it differs from the defaults below (commands, layering, error style, git and CI conventions), the profile wins. No profile: the defaults below are the template's (`${CLAUDE_PLUGIN_ROOT}/references/project-profile.md`); say in the result that `/backend-dev:kit-setup` has not been run.

**Stack.** The steps, gotchas and references below are written for the kit's default stack (Cloudflare Workers, Hono, Firestore, Firebase Auth). When the profile's **Stack** entry for the app this change touches names another stack, read `${CLAUDE_PLUGIN_ROOT}/references/stacks.md` before step 1: it says which steps hold on any stack and where that stack's guide lives. No guide for it: keep the stack-neutral steps, follow the repo's own architecture note and code for the rest, and say so in the result; never carry Firestore, Wrangler or Firebase advice into a repo that does not use them.

Decide the shape of the work before anyone writes an endpoint. The output is a design note and an ADR in the reply itself, not a plan file. Primitives and limits: `references/workers-primitives.md`. ADR shape: `references/adr-template.md`.

## Procedure

1. **Restate the requirement as actors and flows.** One line per flow: who triggers it, what must be true afterwards, how soon. Latency expectations decide the primitive later ("the employee gets an email" within minutes is not the same as "before the response").
2. **Draw the module boundaries.** Which existing module owns the data; whether the feature needs a new module or new services inside one. Modules never import each other; shared things go to `packages/core` (template) or the repo's shared package (a mailer, a storage client) behind a tag with a fake for tests, like `Firestore`.
3. **Split the request path from everything else.** The request path does one atomic write and returns. Anything that calls another system, loops over many documents, or waits on a clock leaves it. Pick the primitive from the table in `references/workers-primitives.md`:
   - per-event side effect (email, webhook) → Queue producer in the write, Queue consumer elsewhere;
   - schedule (monthly export, nightly cleanup) → Cron Trigger, which enqueues when it fans out;
   - ordering or a hot per-key counter → Durable Object, only with a stated reason;
   - polling Firestore for pending rows → only when Queues are unavailable; say the cost (latency, reads per tick, no backoff, no dead letter).
4. **Make every side effect idempotent.** Name the key per effect (`notice:${requestId}:${decisionVersion}`, `export:${YYYY-MM}`), where it is stored, and what a duplicate delivery does. The write that triggers the effect carries the marker on the same document so the trigger and the state are one atomic write (the outbox-on-document pattern).
5. **Check the write paths the design touches for races.** A read-then-write service (`get` then `update`) lets two concurrent callers both succeed; add a precondition (`updateTime`, `currentDocument.exists`) or a transaction and say which. Name the REST status a failed precondition returns, or mark it "verify on a dev project".
6. **Run the limits checklist** (numbers in the reference; confirm against the current docs only when a number is load-bearing): CPU per invocation and plan tier; subrequests per invocation versus the fan-out; memory versus the largest payload (a month's CSV); concurrent outbound connections; cron runs in UTC and is declared per environment; no module-scope state for anything per user.
7. **Classify the data that leaves the system.** For exports and notifications: PII, free text, spreadsheet formula injection (`=`, `+`, `-`, `@`), time-zone of the boundary (UTC month versus the team's month). Decide and state it.
8. **Decide with defaults.** Open questions get a default in brackets and the design proceeds on it; only a question that changes the primitive or the data owner blocks. Amending an existing architecture rule (for example a "no Queues" scope line) is a decision, so it goes in the ADR, not a comment.

## Gotchas seen on this stack

- A scope line in `architecture.md` ("no Queues") was taken as a law and produced a 5-minute polling cron for emails. Scope lines are decisions; propose the amendment in the ADR when the primitive fits better.
- The design note and ADR were written to a plan file and never delivered. The reply must contain both; files come after approval.
- `decide()` in the template reads then writes with no precondition; two concurrent approvals both succeed. Any design that adds a trigger to that write inherits the race.
- Cron triggers, like bindings, are per environment in `wrangler.toml`; a cron declared only at the top level does not run in `stag` or `prod`.
- The free plan's CPU and subrequest caps make most background work unusable; say which plan the design assumes.
- A monthly boundary computed in UTC moves early-morning local decisions into the previous month for teams east of UTC.

## Output

```markdown
## Design: <feature>
**Flows:** <actor → trigger → result → latency>, one per line
**Modules:** <existing module touched / new service / new core tag>
**Request path:** <the single atomic write and what it marks>
**Off the request path:** <primitive → what it does → idempotency key → where the key lives>
**Races and preconditions:** <write path → precondition>
**Limits:** <each limit touched → number assumed → how the design stays under it>
**Data leaving the system:** <PII, injection, time zone decisions>
**Assumptions (defaults applied):** <bullet list>
**Open questions (blocking only):** <bullet list or "none">

## ADR <nnnn> — <decision>
<per references/adr-template.md>
**Next:** data-model for the collections and indexes this design implies, then api-contract. Inside a ticket, the card's Next line names the following command.
```

## Done when
- [ ] Every flow has a primitive and an idempotency key.
- [ ] The request path has exactly one write per user action.
- [ ] Each limit touched has a number and a mitigation.
- [ ] The ADR names at least one rejected alternative with a concrete reason.
- [ ] Blocking questions are separated from defaults.
