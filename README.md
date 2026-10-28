# claude-api-dev-plugin

Claude Code plugin `backend-dev`: a kit for a team building APIs on Cloudflare Workers + Firestore. It works on the team's existing repositories and on new ones made from its template: a lead sets a repo up once, a developer works a ticket with one command per phase, a newcomer gets a reviewed project map and a guided first ticket.

## Quickstart

Where you start depends on what you have:
- **An existing repository** (your own skeleton or a running API): a lead sets it up once (below), then developers work tickets.
- **An empty folder:** ask in plain words, for example "create a new Workers + Firestore API in ./my-api". The kit copies its template with the profile and settings already in place, so no setup step is needed; go straight to tickets.

**Lead, once per existing repository**
1. Install the plugin (below).
2. In the repo root: `/backend-dev:kit-setup` (in a monorepo add the API app's path, `/backend-dev:kit-setup apps/api`). It drafts a project profile in `CLAUDE.md` from the repo (commands, layering, error style, git and CI conventions), turns off AI attribution, pre-approves the repo's exact gate commands and lists every fact it could not establish as a question.
3. `/backend-dev:onboard` writes `docs/onboarding.md` from the repo.
4. Answer the questions in both files, review the diff, commit.

**Developer with a ticket**
A ticket goes through five commands, one phase each. Each one stops with a workflow card (`✔ ticket · ✔ plan · ▶ build · ○ prove · ○ settle`) and a **Next** line naming the following command, so a phase can run in a later session; progress lives in `.backend-dev/tickets/412.md` (self-ignored).

| Command | Phase | Writes |
|---|---|---|
| `/backend-dev:ticket <ticket URL>` | reads the ticket, explores the code, settles open questions with you, fixes the acceptance criteria, picks the stages | `docs/tickets/412/intent.md` |
| `/backend-dev:plan 412` | the design stages the ticket needs (api-contract, data-model, system-design, or the diagnosis for a bug), then the plan | `spec.md`, `plan.md` |
| `/backend-dev:build 412` | branch, the repo's gates on the base first (so failures already there are named), the change and its tests, gates green | code, tests |
| `/backend-dev:prove 412` | review in a subagent that sees only the code, each finding checked; live verification | `plan.md` Verification |
| `/backend-dev:settle 412` | commit with the ticket record, push the feature branch and open the MR, each only on your word | the commit, the MR |

`docs/tickets/412/` is committed with the code and linked from the MR: `intent.md` is readable by the BA and tester, `spec.md` holds the decisions, `plan.md` the changes, a test per acceptance line and the verification. No ticket yet, only a spec? Paste it: `/backend-dev:build "Expose GET /users for the admin role"` runs ticket and plan in one go, shows the plan and waits for your `go`, then builds; `/backend-dev:plan "<text>"` stops after the plan.

Pass the ticket's full URL, which names the tracker so nothing is guessed:
- GitLab issue: read with `glab`. GitHub issue: read with `gh`.
- Any other page (Trello, Jira): read-only in your own Chrome when Claude Code was started with `claude --chrome`.
- A bare id (`/backend-dev:ticket 412`) is a shortcut for the tracker named in the profile; pasted text works too: `/backend-dev:ticket "#412 add a level field…"`.
- `glab` and `gh` are recommended, not required. Log in once: `glab auth login --hostname <host>` (on a self-managed GitLab choose Token and paste a personal access token with `read_api`) or `gh auth login`. Without them tickets are read through Chrome or pasted, but `/backend-dev:review` and the MR step of `/backend-dev:settle` need `glab`.

`/backend-dev:review 87` reviews a teammate's MR !87: reads it and its ticket record, reviews the diff in a fresh context, checks each finding and drafts the comments; it posts only when you say so.

**Several tickets at once**: one git worktree per ticket, so their branches and edits never mix. Start the session with `claude -w 412` (it creates `.claude/worktrees/412`, or reopens it later) and run the ticket's commands there. `kit-setup` writes `.worktreeinclude` so Claude Code copies the app's `.dev.vars` into each new worktree without anyone reading it; install the dependencies once per worktree. `/backend-dev:ticket` stops and gives you that command when the checkout already holds another ticket; `settle` prints the cleanup once the MR is merged.

**Newcomer, first day**
1. Read `docs/onboarding.md`; ask anything (`where do I start?`, `how does a request reach Firestore here?`): the `onboard` skill answers from the repo and checks your machine (`node <plugin>/scripts/doctor.mjs . <app path>`: versions, dependencies, env keys present, glab login; never prints values).
2. First tickets: add `--learn` to `ticket`, `plan`, `build` and `prove` (`/backend-dev:ticket <id> --learn`): the same work, with each stage, each decision and the terms explained on the way.

**Using a skill on its own**: say the job in plain words ("add a level filter to employees"); Claude picks the skill. The menu shows only the commands people type (`kit-setup`, `onboard`, `ticket`, `plan`, `build`, `prove`, `settle`, `review`, `incident`); the stage skills below stay out of it and are run by those commands or by Claude.

## Skills and commands

| Stage | Skill | Output |
|---|---|---|
| Requirement → system design | `system-design` | design note and ADR |
| Data design | `data-model` | collections, indexes, consistency, rollout |
| API contract | `api-contract` | endpoints, statuses, access, Given/When/Then |
| Implementation | `implement` | code and tests in the repo's layering, gates green |
| Quality before the MR | `review-and-secure` | findings with tests, MR notes |
| Live verification | `live-verify` | curl record of every status, verdict |
| Delivery and operations | `delivery` | environments, secrets, pipeline, deploy, rollback |
| Incidents: anything broken or exposed (a 500, a wrong status, an open access check, a leaked key) | `incident` | cause, fix, blast radius, proof, postmortem; an incident record committed in `docs/incidents/<date>-<slug>.md` (or the ticket's folder) |

| Command | Who | What |
|---|---|---|
| `/backend-dev:kit-setup [app]` | lead, once per repo | project profile in `CLAUDE.md`, attribution off, gate permissions |
| `/backend-dev:ticket <ticket URL, id or text> [--learn]` | developer | reads the ticket, settles it, writes the acceptance criteria |
| `/backend-dev:plan <id>` · `build <id>` · `prove <id>` · `settle <id>` | developer | the ticket's next phases, in that order |
| `/backend-dev:review <MR>` | reviewer | a teammate's merge request reviewed, comments drafted |
| `/backend-dev:onboard` | newcomer or lead | `docs/onboarding.md` written or refreshed, machine check |

## Hooks

The plugin's hooks act on Claude's own tool calls in any repo where it is enabled; the repo's own git hooks (husky, commitlint, lint-staged) and CI still apply to everyone.

| Hook | When | What |
|---|---|---|
| format on edit | after `Edit`/`Write` | runs the profile's **On edit** format and lint commands on the changed file; lint errors go back to Claude so they are fixed before the commit |
| gates on stop | at the end of a turn in which Claude edited a file other than Markdown | off until the profile's **On stop** line holds a command (the gates, or a faster part of them); then it runs that command and sends a failure back to Claude, once per turn, so a turn does not end red. Turn it on when the base branch is green |
| ticket resume | after the context is compacted | points Claude back at the ticket in progress (`.backend-dev/tickets/<id>.md`) and tells it a summary is not the developer's go |
| plan gate | when you type a ticket command, and before every file edit | `/ticket`, `/plan` and `/build "<text>"` open it; `/build <id>`, or `go` after `/build "<text>"`, approves the plan. Until then Claude cannot edit source files, in any permission mode, auto included. It also refuses, best effort (common key and token formats), to write a secret value into `docs/tickets/` or `docs/incidents/`. Left a ticket after `/plan`? Approve it with `/build <id>` or delete `.backend-dev/plan-gate.json` yourself; until then source edits stay blocked in that checkout |
| secret files | before every shell command | A command that names `.dev.vars` or `.env*` (redirects such as `cat < .dev.vars` included) waits for you to approve it, even when Bash is allowed. Samples (`.env.example`, `.sample`) pass the hook; the `ask` rules `kit-setup` writes still ask about them |
| checkpoints | after a skill loads, at the end of a turn | one row in `.claude/checkpoints/` |

To let a ticket's stages run after `go` without a prompt per command, start the session in auto mode (`claude --permission-mode auto`), not `bypassPermissions`: the deny rules below and the hooks still apply, and with **On stop** set the gates are checked at every stop.

Commits and pushes are guarded by the harness, not by a hook: `kit-setup` writes `permissions.deny` rules into the repo's `.claude/settings.json` that block Claude from pushing to the profile's **Protected branches**, `--no-verify`, force pushes other than `--force-with-lease`, AI attribution in a commit message, and the Read and Edit tools on `.dev.vars` and `.env` files; the Read deny also covers `cat`, `grep`, `head` and `cp` on them, and `permissions.ask` rules make a person approve any other shell command that names one, such as a `node -e` script. The rule set and its known gaps are in `plugins/backend-dev/references/project-profile.md`.


## Stack

| Layer | Choice | Version (pinned in the template) | Where it is configured |
|---|---|---|---|
| Runtime | Cloudflare Workers, `nodejs_compat` | wrangler 4.151 | `templates/apps/api/wrangler.toml` |
| HTTP + OpenAPI | Hono; `hono-openapi` `describeRoute`; Swagger UI from CDN | hono 4.13, hono-openapi 1.5 | `templates/apps/api/src/app.ts`, `packages/core/src/openapi.ts` |
| Logic + validation | Effect programs; Effect Schema for DTOs and the OpenAPI spec | effect 3.22 | `templates/apps/api/src/modules/*/services`, `schemas` |
| Data | Firestore over REST; service-account JWT signed with WebCrypto; no SDK | none (fetch) | `templates/packages/core/src/firestore.ts` |
| Auth | Firebase ID token (RS256, Google JWKS); role from the `role` custom claim | jose 6.2 | `templates/packages/core/src/auth.ts` |
| Security | secure headers, CORS allow-list from env, 1 MB body limit, per-uid Workers Rate Limiting | hono built-ins | `templates/packages/core/src/security.ts` |
| Tests | vitest; in-memory fake Firestore layer; fake token verifier | vitest 3.2 | `templates/apps/api/src/tests`, `templates/packages/core/src/testing` |
| Language | TypeScript strict, no build step | typescript 5.9 | `templates/*/*/tsconfig.json` |
| Node | for tooling only (wrangler, vitest, scripts) | >= 22 | `templates/package.json` `engines` |

Design and decisions: [docs/architecture.md](docs/architecture.md).

Since 0.7.0 the template is a pnpm monorepo. A project made from the earlier single-app template keeps its layout and keeps working: the skills follow its profile (its own commands and paths), not the template's.

A repo on another stack (another datastore, runtime or deploy target) still gets the ticket commands, records, plan gate, review, guard rules and hooks. The stage skills keep their stack-neutral steps and take the rest from the repo, never Firestore or Wrangler advice; `kit-setup` writes the repo's **Stack** line, and [references/stacks.md](plugins/backend-dev/references/stacks.md) lists what holds on any stack and how a guide for a new stack is added (one file, no skill changes).

## Install

In Claude Code 2.1.275 or later:

```
/plugin marketplace add git@gitlab.asoft-python.com:bao.nguyen/claude-api-dev-plugin.git
/plugin install backend-dev@team-plugins
```

Or from a clone: `claude plugin marketplace add ./` then `claude plugin install backend-dev@team-plugins`. Installed under the marketplace's old name `bao-plugins`: run `claude plugin marketplace remove bao-plugins`, then the two commands above, and change `bao-plugins` to `team-plugins` in any repository's `.claude/settings.json`. Teammates need read access (Reporter) to the GitLab project and an SSH key on that GitLab to install from it. Recommended, not required: `glab` (GitLab tickets and merge requests) or `gh` (GitHub issues), each logged in once.

To turn the plugin on for everyone who opens a repository, commit this to its `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "team-plugins": { "source": { "source": "git", "url": "git@gitlab.asoft-python.com:bao.nguyen/claude-api-dev-plugin.git" } }
  },
  "enabledPlugins": { "backend-dev@team-plugins": true }
}
```

In this repo the plugin is already enabled through `.claude/settings.json`.

Then, once per repository, a lead runs `/backend-dev:kit-setup` (add the API app's path in a monorepo, for example `/backend-dev:kit-setup apps/api`). It reads the repo and drafts a short project profile in `CLAUDE.md` (commands, layering, error style, git and CI conventions), turns off AI attribution in `.claude/settings.json` and lists every fact it could not establish as a question. Review, answer, commit. Every skill follows that profile; projects made from the template get one from the scaffold.

Agent: `backend-dev:backend-dev`, only when asked by name or for an end-to-end run.

## Maintaining

- Owner: bao.nguyen. Code is written and reviewed on [GitHub](https://github.com/baonguyen-agilityio/claude-api-dev-plugin) (remote `origin`): every change is a pull request, and `.github/workflows/` runs the lint, skill-validator, template gates and the Claude review on it before a merge. The review re-reads the whole pull request on every push once it is ready (drafts are skipped, a new push cancels the old run): bugs in hooks, scripts and the template's TypeScript, and skills and references read as instructions against `CLAUDE.md` and this repo's rules. It fails its check on `VERDICT: NEEDS_CHANGES` or when it did not run; nothing merges to `main` without it. For a deeper bug hunt on a risky change, mention `@claude` in the pull request or run `/code-review` locally. Mention `@claude` in a pull request or issue to ask it something.
- The team installs from [GitLab](https://gitlab.asoft-python.com/bao.nguyen/claude-api-dev-plugin) (remote `gitlab`). After each merge, bring it up to date by hand, since the GitLab host is only reachable from the internal network: `git checkout main && git pull origin main && git push gitlab main`. It is always a fast-forward; GitLab's `main` is protected against force pushes.
- Every skill was built the same way, and a change to one follows the same six steps: (1) do the stage's task on the template with a plain session and no skill, keep what it got wrong; (2) write the procedure, the gotchas from that run, the output template; (3) description in the Agent Skills form ("what it does. Use when …", ≤ 1024 chars, naming the stack); (4) write the eval queries (should-trigger, near-miss, one outcome rubric); (5) `node plugins/backend-dev/scripts/check-plugin.mjs`, `skill-validator check plugins/backend-dev/skills/<name> --strict` (agent-ecosystem/skill-validator: strict YAML, fences, token budget, keyword stuffing; `brew install agent-ecosystem/tap/skill-validator`), `claude plugin validate plugins/backend-dev --strict`, one smoke prompt per stage; (6) the pull request carries the hands-on notes, the smoke result and the review pass.
- Smoke prompts on a machine with its own user-level skills: `claude -p "<prompt>" --model sonnet --setting-sources project --plugin-dir plugins/backend-dev --permission-mode acceptEdits --allowedTools "Bash(ls *)" "Bash(cat *)" Read Glob Grep Skill Write Edit --output-format stream-json --verbose`, then grep for `"name":"Skill"`. Without `--setting-sources project` the user's other skills compete and the plugin's rarely fire.
- Evals run once per release, not per edit: trigger suite `claude plugin eval plugins/backend-dev --trust-plugin --ablation none --tag train --runs 2 -j 4 --model sonnet --max-cost-usd 8`, then `--tag validation` once on queries never used to edit a description (a case passes at a trigger rate ≥ 0.5); outcome suite `--tag outcome --ablation with-without --runs 2 --scaffold --allow-tools Bash Write Edit --max-cost-usd 6`. Commit the dated results folders. Re-run only the failed cases after a fix.
- Any change to `docs/architecture.md`: copy it to `plugins/backend-dev/references/architecture.md` (the lint fails otherwise) and re-check the template against the changed sections.
- Any change to `templates/`: CI runs the gates on a clean copy and the generator; run them locally first on a copy, as CI does: `tmp=$(mktemp -d) && cp -R plugins/backend-dev/templates/. "$tmp" && cd "$tmp" && pnpm install --frozen-lockfile && pnpm typecheck && pnpm test && pnpm check`.
- Token footprint (`claude --plugin-dir plugins/backend-dev plugin details backend-dev`): about 1,200 tokens always-on for the eight descriptions and the agent, 1.5k–2.4k per skill when it fires.

## Layout

- `plugins/backend-dev/` — the plugin: `skills/` (sixteen: seven commands that only run when typed, `kit-setup`, `ticket`, `plan`, `build`, `prove`, `settle`, `review`; `onboard` and `incident`, typed or started by Claude; seven stage skills kept out of the menu, started by the commands or by Claude), `references/` (project profile format, ticket flow, architecture note), `scripts/` (scaffold, new-module, doctor, guard-rules), `templates/` (new API), `agents/`, `hooks/`, `rules/`, `evals/`
- `docs/` — architecture and decisions the plugin and template follow
