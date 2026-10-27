---
name: build
description: Build a planned backend ticket after /backend-dev:plan. Creates the branch, runs the gates on the base branch first, makes the change and its tests the way plan.md says, and ends with the gates green; then /backend-dev:verify.
argument-hint: "<ticket id> [--learn]"
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Write, Edit, Skill, Bash(git status*), Bash(git diff*), Bash(git log*), Bash(git branch*), Bash(git switch*), Bash(git rev-parse*), Bash(git fetch origin *)
---

Build this ticket: "$ARGUMENTS"

The repo's conventions are in the `backend-dev:profile` block of `CLAUDE.md`. The flow, the state file, the card, the record templates and learning mode: `${CLAUDE_PLUGIN_ROOT}/references/ticket-flow.md`; read it first.

## Steps
0. **Load the stage skill first**, before reading code or running anything: the Skill tool with `backend-dev:implement` (a bug: `backend-dev:incident`; a deploy or environment ticket: `backend-dev:delivery`). Its procedure and checks govern steps 3–5; a build done without it is not done.
1. **Read the state.** `.backend-dev/tickets/<id>.md` and `docs/tickets/<id>/plan.md`. No `plan.md`: stop and say to run `/backend-dev:plan <id>` first. Running this command is the developer's approval of the plan as it stands.
2. **Branch.** When `plan.md`'s branch exists, switch to it. Otherwise create it from the remote's base: `git fetch origin <base>`, then `git switch -c <name> --no-track origin/<base>`, so a local base that is missing or behind does not matter and the new branch does not track the base (a bare `git push` must never reach it; `settle` sets the branch's own upstream). If the fetch fails, use the local `<base>` and say so; with no local base either, stop and report. Always from the base, never from the current commit, which in a new worktree is whatever the main checkout had. In a worktree without dependencies, run the profile's install command first (`kit-setup` allows it; without that the developer approves it once). The ticket record files do not count as a change; any other uncommitted change: ask first.
3. **Baseline before any change:** run the profile's gates once on the base and keep the result in the state file. A test that already fails there is reported as pre-existing, not fixed in passing and not blamed on the ticket. A gate that cannot run (no permission, missing dependencies) stops here with the command the developer has to run or approve.
4. **Make the change** following the skill from step 0: implement, or the incident skill's steps 4 and 7–8 for a bug (the failing test first, then the fix in the shared place, then the proof), or delivery. Follow `plan.md`; a change the plan did not foresee goes into `plan.md` Changes with its reason, and one that changes a decision goes back to the developer before it is made.
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
