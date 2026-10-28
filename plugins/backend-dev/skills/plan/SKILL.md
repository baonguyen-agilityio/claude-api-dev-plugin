---
name: plan
description: Plan a backend ticket after /backend-dev:ticket. Runs the design stages it needs (api-contract, data-model, system-design, or the incident's diagnosis for a bug), records the decisions in spec.md and writes plan.md with the changes and a test per acceptance line; then /backend-dev:build.
argument-hint: "<ticket id | \"ticket text\"> [--learn]"
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Write, Edit, Skill, Bash(git status*), Bash(git log*), Bash(git diff*), Bash(git branch*), Bash(git rev-parse*), Bash(npx @redocly/cli lint *), Bash(glab issue view*), Bash(glab auth status*), Bash(gh issue view*), Bash(gh auth status*), Bash(git remote get-url*), mcp__claude-in-chrome__navigate, mcp__claude-in-chrome__get_page_text, mcp__claude-in-chrome__tabs_context_mcp, mcp__claude-in-chrome__tabs_create_mcp
---

Plan this ticket: "$ARGUMENTS"

The repo's conventions are in the `backend-dev:profile` block of `CLAUDE.md`. The flow, the state file, the card, the record templates and learning mode: `${CLAUDE_PLUGIN_ROOT}/references/ticket-flow.md`; read it first. This command writes design and plan files only: no source code, no branch.

## Steps
0. **No argument:** ask which ticket and stop. **Text instead of a ticket.** When the argument is more than one token, it is the ticket's text: first run the sections Read the inputs, Explore, Discuss and settle, and Write and stop of `${CLAUDE_PLUGIN_ROOT}/skills/ticket/SKILL.md` on it in this conversation (explore, settle the blocking questions, write `intent.md` and the state), then go on below without waiting for another command. Blocking questions still stop the run there.
1. **Read the state.** `.backend-dev/tickets/<id>.md` and `docs/tickets/<id>/intent.md`. Either missing, or `intent.md` without acceptance criteria: stop and say to run `/backend-dev:ticket <id>` first. Blocking questions still open in `intent.md`: list them and stop. **The ticket changed?** When the state's Source names a tracker issue, read its `updated_at` again (`glab issue view … -F json`, `gh issue view … --json updatedAt`); newer than the state's: show what changed in the description or comments and ask whether to update `intent.md` first.
2. **Run the design stages** the state file chose, in its order. Load each stage's skill with the Skill tool (`backend-dev:api-contract`, `backend-dev:data-model`, `backend-dev:system-design`, `backend-dev:incident`) before working on that stage and follow its procedure and output: the skill holds the checks for that stage, so a stage written without it is not done. Deliver each stage's output in the reply. After each one, record its outcome in `spec.md` (the stage's section, decisions with who decided and the date) and update the state file. A bug runs the incident skill's steps 1–3 and 5–6 (triage, what is live, reproduce, cause, blast radius) and stops before the failing test and the fix; its outcome is the incident record. Stop at a decision the skill cannot default (a contract or data choice the ticket does not settle): the card shows ✗ and the question.
3. **Write `plan.md`** (template in the reference): Branch from the profile's pattern and Base from the profile; the stages and why; every file to change and why; a test for every acceptance line in `intent.md` (an incident's failing test first) and the request-level checks the stages produced.
4. **Show the card and stop.** The developer reads the plan; `/backend-dev:build <id>` is their approval.

## Output
```markdown
<workflow card>
## Plan #<id>: <title>
<each stage's output, in order>
**Written:** `docs/tickets/<id>/spec.md` (<sections>), `docs/tickets/<id>/plan.md`
**Changes:** <file → what, one per line>
**Tests:** <acceptance line → test, one per line>
**Open questions:** <blocking first; none when settled>
**Next:** read `plan.md`, then `/backend-dev:build <id>`; or say what to change in the plan.
```
