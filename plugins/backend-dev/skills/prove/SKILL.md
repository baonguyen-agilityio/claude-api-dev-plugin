---
name: prove
description: Prove a built backend ticket works after /backend-dev:build. Reviews the change in a subagent that sees only the code, checks each finding, drives the endpoints with live-verify and records the outcome in plan.md; then /backend-dev:settle, or back to /backend-dev:build for a blocking finding.
argument-hint: "<ticket id> [--learn]"
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Write, Edit, Skill, Agent, Bash(git status*), Bash(git diff*), Bash(git log*), Bash(git rev-parse*)
---

Prove this ticket works: "$ARGUMENTS"

The repo's conventions are in the `backend-dev:profile` block of `CLAUDE.md`. The flow, the state file, the card, the record templates and learning mode: `${CLAUDE_PLUGIN_ROOT}/references/ticket-flow.md`; read it first. This command changes no code: a defect it finds goes back to build.

## Steps
0. **A ticket reference only.** When the argument is more than one token, there is no built code to prove: say to run `/backend-dev:build "<text>"` instead, and stop.
1. **Read the state.** `.backend-dev/tickets/<id>.md` and `docs/tickets/<id>/plan.md`. No build recorded, or the last gates red: stop and say to run `/backend-dev:build <id>` first. Make sure the ticket's branch is checked out.
2. **Review in a fresh context.** The conversation that built the change argues for it, so the review goes to a subagent (Agent tool, `general-purpose`) that sees only the code. Its prompt names the repo path, the base branch and the ticket record folder, and says: run the `backend-dev:review-and-secure` skill on the diff from the base, read `intent.md` and `spec.md` for what was asked and decided, and return the Review block verbatim. Nothing about how the change was built or why. When it returns, check each finding against the code before it goes into the reply: one that does not hold is dropped with the reason, and a severity you change says why.
3. **Live verification** when the reference's table lists it for this kind of ticket: load the `backend-dev:live-verify` skill with the Skill tool and follow it, every declared status driven, a bug's original request re-run.
4. **Record and stop.** `plan.md` Verification: each review finding and how it was settled, each status driven and its result. Update the state file and show the card. A blocking finding or a failed check: the card shows ✗ at prove and the next command is `/backend-dev:build <id>` with what to fix; otherwise `/backend-dev:settle <id>`.

## Output
```markdown
<workflow card>
## Prove #<id>: <title>
**Review (fresh context):** <blocking and non-blocking findings, each with location, what breaks, the test; dropped ones with the reason>
**Live:** <VERIFIED | PARTIAL | UNVERIFIED, each status driven and its result | not in this ticket's stages>
**Written:** `docs/tickets/<id>/plan.md` Verification
**Next:** `/backend-dev:settle <id>`; or `/backend-dev:build <id>` to fix <the blocking findings>.
```
