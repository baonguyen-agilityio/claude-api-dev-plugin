---
name: api-contract
description: "Turns a ticket or feature request into the API contract for a Cloudflare Workers + Firestore API: endpoints, request and response shapes, statuses, access rules, additive or breaking classification, and Given/When/Then acceptance criteria. Use when a requirement will add or change endpoints and nobody has pinned down what they return or who may call them, even if the user just says add an API or asks what a client will get."
user-invocable: false
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(npx @redocly/cli lint *), Bash(oasdiff breaking *), Bash(curl -s *openapi*)
---

# API contract

Problem this solves: a ticket says what the user wants, not what the API returns, who may call it, which status each failure gets, whether existing clients break, or how QA proves it. The answer is the contract in the reply; no project file changes until someone implements it. Works on its own or as a step of the process; data layout and code are separate skills.

Before anything else, follow the project profile: the `backend-dev:profile` block in the repo's `CLAUDE.md`. Where it differs from the defaults below (commands, layering, error style, git and CI conventions), the profile wins. No profile: the defaults below are the template's (`${CLAUDE_PLUGIN_ROOT}/references/project-profile.md`); say in the result that `/backend-dev:kit-setup` has not been run.

**Stack.** The steps, gotchas and references below are written for the kit's default stack (Cloudflare Workers, Hono, Firestore, Firebase Auth). When the profile's **Stack** entry for the app this change touches names another stack, read `${CLAUDE_PLUGIN_ROOT}/references/stacks.md` before step 1: it says which steps hold on any stack and where that stack's guide lives. No guide for it: keep the stack-neutral steps, follow the repo's own architecture note and code for the rest, and say so in the result; never carry Firestore, Wrangler or Firebase advice into a repo that does not use them.

Shapes every endpoint inherits: `references/envelope-and-errors.md`. Who may call what: `references/access-rules.md`. Additive vs breaking, PATCH vs action, versioning, acceptance form: `references/contract-decisions.md`.

## Procedure

1. **Read the endpoints the ticket touches before designing new ones.** `routes.ts`, the controller and the service of the module, the state machine in the model, `PUBLIC_ROUTES`. Most tickets extend an endpoint that exists; a ticket that reads like a new feature often is "add a body to approve".
2. **Name the consumers and classify every change.** For each endpoint touched: who calls it today (ask when the repo cannot tell), and whether the change is additive or breaking per the table in the reference. A status that used to be 200 and becomes 4xx (blocking admins from approving their own request) is breaking even when it is right; say so and let the user decide.
3. **Choose the shape.** Own writable fields → `PATCH`; a state transition → `POST /:id/<verb>` with a small body DTO; data the actor supplies at the transition (`note`, `reason`) lives on the entity, written by the server with the actor's uid and time. Request DTOs carry writable fields only; server-owned fields are listed as "ignored if sent".
4. **Fill the access matrix for every endpoint,** every cell a status: anonymous, owner, other user, admin, plus any new role. Apply the 403/404 rule from the reference. A cell left "whichever you choose" is a rule that ships as "everyone"; put a default in it.
5. **List the statuses per endpoint** from the error table: 400 with the message rule, 401, the 403/404 choice, 409 for every transition not in the state machine, 502. Name the current state in the 409 message.
6. **Separate what the contract needs from what it designs.** A rule that depends on data the system does not have (who is someone's manager, a team) is a decision outside the contract (module boundaries, data layout): state the dependency and the field the contract assumes (`managerId` on the request), do not design the collection here.
7. **Guard the write paths the new rules touch.** A transition or edit whose check and write are two steps gives two concurrent callers both a 200. Put `ETag` on the resource and `If-Match` → 412 on the writes (optional on existing endpoints, required on new ones); a create that clients retry takes an `Idempotency-Key`. Both are in `references/contract-decisions.md`; the Firestore precondition behind them is implementation work.
8. **Write acceptance criteria** as Given/When/Then with concrete values, one per status per endpoint, in the order QA will run them: 401, the 403/404 rule, 400 on the body, 409 on each wrong state, the happy path with the fields the response must show, and the server-owned field ignored.
9. **Check the generated spec by machine** when the code exists: lint it and diff it against the base branch with `oasdiff breaking` (commands in the reference). A breaking finding goes back to step 2: stage it with `Deprecation` and `Sunset`, or name the consumers who agreed.
10. **Decide with defaults.** Open questions get a default in brackets; only a question that changes the access rule or breaks a consumer blocks.

## Gotchas seen on this stack

- The no-skill run extended the existing approve/reject correctly but never classified the changes: the new response fields were additive, the self-approval block was a breaking 403 on a path admins use today. Step 2 exists because of that.
- It designed a `manager` role, an `employees` collection and a `scope=team` filter inside the contract; those are architecture and data-layout decisions. The contract names the dependency and the assumed field.
- It left one cell open ("empty list or 403, whichever you choose"). Open cells ship as the widest rule.
- QA guidance came as prose bullets; QA cannot run prose. Given/When/Then with values.
- The approve/reject write in the template is read-then-update with no precondition; a contract promising 409 on double approval must list the precondition as implementation work, or the promise is false under load.
- Admins can approve their own request today; a contract that says otherwise changes behaviour for a live role. Flag it, do not bury it.
- The design went to a plan file the user never saw; the reply must carry the whole contract.

## Output

```markdown
## Contract: <ticket in one line>
**Consumers:** <who calls the touched endpoints, or "unknown, treated as breaking">
**Changes:** <endpoint → additive | breaking → why>

| Method & path | Request | Response | Statuses | Access |
|---|---|---|---|---|
<one row per endpoint touched or added; request lists writable fields with rules; response names new fields>

**Ignored if sent:** <server-owned fields>
**State machine:** <transitions touched, 409 cases with their message>
**Access matrix:** <anonymous / owner / other / admin (/ new role) per endpoint, a status in every cell>
**Depends on:** <architecture or data-layout decisions this contract assumes, with the assumed field>
**Concurrency and retries:** <ETag/If-Match per write (optional | required), Idempotency-Key per create>
**Deprecations:** <old → new, Deprecation and Sunset dates, or none>
**For implementation:** <preconditions, indexes, new tagged errors the contract relies on>

## Acceptance
Given … / When … / Then … (one per status per endpoint, concrete values)

## Open questions (blocking) / Defaults applied
**Next:** implement from this contract (data-model first when it needs new fields, queries or indexes). Inside a ticket, the card's Next line names the following command.
```

## Done when
- [ ] Every touched endpoint is classified additive or breaking, with its consumers named or marked unknown.
- [ ] Every access cell has a status; the 403/404 choice is stated per resource.
- [ ] Every transition not in the state machine has a 409 line.
- [ ] No server-owned field appears in a request DTO.
- [ ] Acceptance covers 401, the 403/404 rule, 400, 409, success and the ignored field, with values.
- [ ] Every write that two people can race has an `If-Match` rule; every create that clients retry has an `Idempotency-Key` rule.
