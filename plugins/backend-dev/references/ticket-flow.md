# Ticket flow

A ticket goes through five commands, one phase each. Each command reads what the previous ones wrote, does its phase, updates the files below and stops with a **Next** line naming the following command, so a phase can run in a later session.

| Command | Phase | Writes | Needs first |
|---|---|---|---|
| `/backend-dev:ticket <id>` | read the ticket, explore the code, settle open questions, fix the acceptance criteria, choose the stages | state file, `intent.md` | the profile |
| `/backend-dev:plan <id>` | the design stages the ticket needs, then the plan | `spec.md` (and `incident.md` for a bug), `plan.md` | `intent.md` with acceptance |
| `/backend-dev:build <id>` | branch, baseline gates, the change and its tests, gates green | code and tests, `plan.md` Changes | `plan.md` |
| `/backend-dev:prove <id>` | review in a fresh context, live verification | `plan.md` Verification | build done, gates green |
| `/backend-dev:settle <id>` | commit, push the feature branch, merge request | the commit | prove with no open blocking finding |

`/backend-dev:review <MR>` reviews somebody else's merge request and is not part of a ticket's run.

Running a command is the developer's go for that phase. A command whose prerequisite is missing says which command to run first and stops. A command run again on a finished phase says so and offers to redo it.

## What each phase runs, by kind of ticket

| The ticket is | plan | build | prove |
|---|---|---|---|
| a new feature or endpoint | api-contract → data-model (new collection, query, index or invariant) → system-design (background work, notifications, exports, more than one module) | implement | review-and-secure → live-verify |
| a field, filter or response change | api-contract (additive or breaking) → data-model (index, backfill) | implement | review-and-secure → live-verify |
| a bug, error or "it returns X" | incident steps 1–3, 5–6: triage, what is live, reproduce, cause, blast radius | incident steps 4, 7–8: the failing test, the fix, the proof | review-and-secure → live-verify (the original request again) |
| a deploy, environment, secret or pipeline change | delivery: what changes, in which order, the rollback | delivery: the change in the repo; a deploy only with the developer | live-verify against the environment |
| a refactor with no contract change | the plan only | implement | review-and-secure |

`incident` is for anything broken or exposed: a 500, a wrong status, an open access check, a leaked key. A bug goes through the phases above with incident inside `plan` and `build`. A leaked secret (a key pasted in chat, committed, or printed in a log) does not wait for phases, because the key stays usable until it is rotated: `/backend-dev:ticket` says so and points to `/backend-dev:incident` now, whose leaked-credential runbook rotates the key first and investigates after.

## Several tickets at once: one worktree each

Two tickets in one checkout share a branch, a working tree and a state folder, so one ticket's edits end up in the other's commit. Each ticket in progress at the same time gets its own git worktree, and the whole ticket, from `/backend-dev:ticket` to `/backend-dev:settle`, runs in a Claude Code session started in it:

```bash
claude -w 412          # creates .claude/worktrees/412 on a new branch worktree-412, or reopens it
```

Then `/backend-dev:ticket 412` in that session. Claude Code copies the files listed in `.worktreeinclude` (`kit-setup` lists `.dev.vars`) into a new worktree, so the local secrets arrive without anyone reading them; the dependencies are installed once per worktree with the profile's install command. `claude -w 412` later reopens the same worktree, with the ticket's state file and uncommitted record in it.

- A new worktree starts from whatever commit the main checkout had; `build` always creates the ticket branch from the profile's base, never from the current commit.
- Two `wrangler dev` runs cannot share port 8787: the second ticket's live verification uses the next free port.
- Both worktrees talk to the same dev Firestore project: live verification names what it creates after the ticket (`lv-412-…`) and deletes only that.
- After the MR is merged, remove the worktree from the main checkout (the commands are in `settle`'s output). A worktree made by `claude -w` is locked, so it is unlocked first.

## State file

The ticket's progress lives in `.backend-dev/tickets/<id>.md` at the repo root (pasted text without an id: `<short-slug>.md`). The folder ignores itself: create `.backend-dev/.gitignore` containing `*` the first time, so nothing there is ever committed (Claude Code protects `.claude/`, so the state does not go there). It holds what a new session needs: the restated ticket, the worktree when there is one, the chosen stages with their reasons, the status of each phase, the branch, the decisions taken (question → answer), the last gate result and the card's **Next** line. Every command reads it first and updates it before it stops. If the working tree disagrees with it (branch missing, files already changed or reverted), trust the tree and say what differs.

## Workflow card

Shown at the end of every command and on resume:

```markdown
**#412 · <title>**  ✔ ticket · ✔ plan (api-contract, data-model) · ▶ build · ○ prove · ○ settle
Skipped: system-design (one module, no background work)
**Next:** `/backend-dev:build 412`: <what it will do in one line>. Or change the plan first.
```

✔ done, ▶ next, ○ to do, ✗ stopped on a blocker (say which and what unblocks it).

## Ticket record

The state file is the developer's own progress and is never committed. What the team needs to review the change and to understand it later goes into the **ticket record**, the folder `docs/tickets/<id>/` (pasted text without an id: `docs/tickets/<short-slug>/`), committed with the code. Three files (four for a bug or security ticket), each with one reader and one moment to be written:

| File | Answers | Read by | Written by |
|---|---|---|---|
| `intent.md` | what and why | anyone, the BA and tester included | `ticket`; again only if the goal or acceptance changes |
| `spec.md` | how it behaves | the reviewer | `plan`, after each design stage and at every decision (the answered question then leaves `intent.md` Open questions) |
| `incident.md` | what broke, why, and how it was proven fixed | the reviewer and whoever meets the symptom again | the incident skill, from triage on (its own Incident record section) |
| `plan.md` | how it is built and proven | the developer and the reviewer | `plan`; then `build` (Changes as made), `prove` (Verification) |

Write a file whether or not the branch exists yet (uncommitted files move with you when the branch is created). They hold outcomes, not transcripts, each section only when its stage ran, and each written out in full in the file: the chat is gone after the session, so a line such as "see the contract reply" is a hole, not a record. One fact lives in one file; the others link to it (`spec.md#api-contract`) instead of repeating it.

`intent.md`, in words the ticket's author would use, no code, no field types:
```markdown
# #<id> · <title>
Ticket: <link>  ·  Status: <in progress | ready for review>

## Goal
<one or two lines: the outcome for the user, and why it is wanted>

## Acceptance
- Given <state>, When <action>, Then <observable result>   (one per line; inferred ones marked "(inferred)")

## Out of scope
- <item>

## Open questions
- <question> (<who can answer>)   (removed once answered; the answer goes to spec.md Decisions)
```

`spec.md`:
```markdown
# #<id> · Spec
## Decisions
- <question> → <answer> (<who decided, date>)
## Design            (system-design: the chosen shape, primitives, what was rejected and why)
## Data              (data-model: documents and fields, indexes, consistency rule, rollout or backfill)
## API contract      (api-contract: a table of method and path | who may call | statuses | additive or breaking, then each changed request or response field)
```
No acceptance section in `spec.md`: acceptance lives in `intent.md`, and the request-level checks a stage produces (each status, each field) go to `plan.md` Tests.

`plan.md`:
```markdown
# #<id> · Plan
Branch: `<branch>`  ·  Base: `<base>`

## Stages
- <stage> → <why>   (skipped ones with their reason)
## Changes
- `<path>`: <what changes and why>
## Tests
- <acceptance line, by its Given> → `<test file>`: <test name>   (every acceptance line in intent.md has one; an incident's failing test first)
- <request-level check from api-contract or live-verify: request → expected status and body>
## Verification      (gates output in one line each; review-and-secure findings and how each was settled; live-verify: each status driven and its result)
## Follow-ups        (anything left for another ticket)
```

## Learning mode (`--learn`)

`ticket`, `plan`, `build` and `prove` take `--learn`, for someone on their first tickets in this repo. Do the same work, never skip a gate or a stage to save time, and add:
- **Before each stage**, three lines: what this stage is for, what an experienced backend engineer checks here, and the file in this repo that shows the pattern to copy.
- **At each decision**, the options and why you pick one, in plain words.
- **After each stage**, one or two lines under "Remember", and any new term in a running glossary (`apiHandlerEffect`: the shared handler that turns exceptions into statuses).
- Answer "why" questions before moving on.
