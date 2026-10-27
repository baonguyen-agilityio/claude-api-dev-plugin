---
name: build
description: Build a planned backend ticket after /backend-dev:plan. Creates the branch, runs the gates on the base branch first, makes the change and its tests the way plan.md says, and ends with the gates green; then /backend-dev:verify.
argument-hint: "<ticket id> [--learn]"
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Write, Edit, Skill, Bash(git status*), Bash(git diff*), Bash(git log*), Bash(git branch*), Bash(git switch*), Bash(git rev-parse*)
---

Build this ticket: "$ARGUMENTS"

The repo's conventions are in the `backend-dev:profile` block of `CLAUDE.md`. The flow, the state file, the card, the record templates and learning mode: `${CLAUDE_PLUGIN_ROOT}/references/ticket-flow.md`; read it first.

## Steps
1. **Read the state.** `.backend-dev/tickets/<id>.md` and `docs/tickets/<id>/plan.md`. No `plan.md`: stop and say to run `/backend-dev:plan <id>` first. Running this command is the developer's approval of the plan as it stands.
2. **Branch.** Create `plan.md`'s branch from the profile's base (`git switch -c <name> <base>`), or switch to it when it exists. The ticket record files do not count as a change; any other uncommitted change: ask first.
3. **Baseline before any change:** run the profile's gates once on the base and keep the result in the state file. A test that already fails there is reported as pre-existing, not fixed in passing and not blamed on the ticket. A gate that cannot run (no permission, missing dependencies) stops here with the command the developer has to run or approve.
4. **Make the change** with the skill the reference's table names for this kind of ticket, loaded with the Skill tool before any edit (`backend-dev:implement`, `backend-dev:incident`, `backend-dev:delivery`) and followed: implement, or the incident skill's steps 4 and 7–8 for a bug (the failing test first, then the fix in the shared place, then the proof), or delivery. Follow `plan.md`; a change the plan did not foresee goes into `plan.md` Changes with its reason, and one that changes a decision goes back to the developer before it is made.
5. **Gates green.** The profile's gates after the change and after every fix, output shown. A red gate that the change caused is fixed here; one that cannot be fixed without changing the plan stops with ✗ and the output.
6. **Record and stop.** Update `plan.md` Changes to what was made, `plan.md` Verification with the gate output in one line each, and the state file. Show the card.

## Output
```markdown
<workflow card>
## Build #<id>: <title>
**Branch:** <name> from <base>
**Baseline on <base>:** <gate results; pre-existing failures named>
<the skill's output>
**Gates:** <typecheck / lint / test / build output, pasted>
**Changed from the plan:** <none | file → why>
**Next:** `/backend-dev:verify <id>`.
```
