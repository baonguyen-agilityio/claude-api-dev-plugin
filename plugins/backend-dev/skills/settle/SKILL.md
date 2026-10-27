---
name: settle
description: Settle a verified backend ticket after /backend-dev:verify. Commits the change with its ticket record in the repo's format, then pushes the feature branch and opens the merge request from the repo's template, each only on your word.
argument-hint: "<ticket id>"
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(git status*), Bash(git diff*), Bash(git log*), Bash(git branch*), Bash(git rev-parse*), Bash(git add *), Bash(git commit *)
---

Settle this ticket: "$ARGUMENTS"

The repo's conventions are in the `backend-dev:profile` block of `CLAUDE.md`. The flow, the state file and the card: `${CLAUDE_PLUGIN_ROOT}/references/ticket-flow.md`; read it first.

## Steps
1. **Read the state.** `.backend-dev/tickets/<id>.md` and `docs/tickets/<id>/plan.md`. Verify not recorded, or a blocking finding still open in `plan.md` Verification: stop and name it, with `/backend-dev:verify <id>` or `/backend-dev:build <id>` as the next command. Make sure the ticket's branch is checked out and holds only this ticket's changes (`git status`, `git diff <base> --stat`).
2. **Finish the record.** `intent.md` Status set to ready for review; `plan.md` Verification complete; for a bug, the incident record finished (the incident skill's step 9: Timeline, Prevention, Status).
3. **Commit** in the profile's format with the ticket id (`[#412] feat(employees): …` where the profile says so), the ticket record folder included in the same commit. No AI attribution in the message. Show the commit.
4. **Push**, only when the developer says so: `git push -u origin <branch>`, the feature branch only, never a protected branch (the guard rules block those anyway).
5. **Merge request:** fill the profile's MR template with what changed, why (link the ticket, `Closes #412`), how it was tested (the gate output, what was driven with curl), the type of change, and links to the ticket record: `intent.md` for what was asked, `spec.md` for the decisions, `plan.md` for how it was proven. Print the exact command, for example `glab mr create -t "<title>" --target-branch <profile target> --description "<filled template>"`, and run it only when the developer says so.
6. Update the state file (settled, the commit, the MR link once opened) and show the card.
7. **In a worktree** (the state file names one): once the MR is merged, the worktree is removed from the main checkout with `git worktree unlock .claude/worktrees/<id>`, `git worktree remove .claude/worktrees/<id>` and `git branch -D worktree-<id>`. Print them for the developer; never remove a worktree that still has uncommitted changes.

## Output
```markdown
<workflow card>
## Settle #<id>: <title>
**Commit:** <hash and message>
**Ticket record:** `docs/tickets/<id>/` (intent, spec, plan, and incident for a bug)
**Push:** <done: branch → remote | waiting for your word: the command>
**Merge request:** <link | the filled template and the command, waiting for your word>
**Worktree:** <none | the cleanup commands, for after the merge>
**Next:** <say `push` / `open the MR`, or nothing left: the MR is open for review>
```
