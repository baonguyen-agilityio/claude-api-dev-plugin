# claude-api-dev-plugin

Claude Code plugin `backend-dev`: a kit for a team building APIs on Cloudflare Workers + Firestore. It works on the team's existing repositories and on new ones made from its template: a lead sets a repo up once, a developer works a ticket with one command, a newcomer gets a reviewed project map and a guided first ticket.

## Quickstart

**Lead, once per repository**
1. Install the plugin (below).
2. In the repo root: `/backend-dev:kit-setup` (in a monorepo add the API app's path, `/backend-dev:kit-setup apps/api`). It drafts a project profile in `CLAUDE.md` from the repo (commands, layering, error style, git and CI conventions), turns off AI attribution, pre-approves the repo's exact gate commands and lists every fact it could not establish as a question.
3. `/backend-dev:onboard` writes `docs/onboarding.md` from the repo.
4. Answer the questions in both files, review the diff, commit.

**Developer with a ticket**
- `/backend-dev:ticket 412` reads GitLab issue #412 (`glab auth login --hostname <host>` once; on a self-managed GitLab choose Token and paste a personal access token with `read_api`, since browser login needs an OAuth application the instance may not have). If the org blocks your token, start Claude Code with `claude --chrome`: the kit then reads the issue page read-only in your own Chrome session. Or paste the text: `/backend-dev:ticket "#412 add a level field…"`.
- It restates the ticket, asks only blocking questions, picks the stages the ticket needs and **stops with a workflow card** (`✔ analysis · ▶ api-contract · ○ implement …` and a **Next** line). Reply `go`, change the stage list, or `stop`; `/backend-dev:ticket 412` in a later session resumes from `.backend-dev/tickets/412.md` (self-ignored). After `go` it runs the stages with the skills below, updating the card after each, runs the repo's gates (first on the base branch, so failures that were already there are named), commits in the repo's format and prints the merge request command. Push and MR happen only when you say so.

**Newcomer, first day**
1. Read `docs/onboarding.md`; ask anything (`where do I start?`, `how does a request reach Firestore here?`): the `onboard` skill answers from the repo and checks your machine (`node <plugin>/scripts/doctor.mjs . <app path>`: versions, dependencies, env keys present, glab login; never prints values).
2. First tickets: `/backend-dev:ticket <id> --learn` does the same work and explains each stage, each decision, and the terms on the way.

**Using a skill on its own**: say the job in plain words; every skill works alone, follows the repo's profile and ends with a **Next** line naming the following step of the workflow.

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
| Incidents | `incident` | cause, fix, blast radius, proof, postmortem |

| Command | Who | What |
|---|---|---|
| `/backend-dev:kit-setup [app]` | lead, once per repo | project profile in `CLAUDE.md`, attribution off, gate permissions |
| `/backend-dev:ticket <id or text> [--learn]` | developer | the stages a ticket needs, ending in commit and MR draft |
| `/backend-dev:onboard` | newcomer or lead | `docs/onboarding.md` written or refreshed, machine check |


## Stack

| Layer | Choice | Version (pinned in the template) | Where it is configured |
|---|---|---|---|
| Runtime | Cloudflare Workers, `nodejs_compat` | wrangler 4.151 | `templates/wrangler.toml` |
| HTTP + OpenAPI | Hono; `hono-openapi` `describeRoute`; Swagger UI from CDN | hono 4.13, hono-openapi 1.5 | `templates/src/app.ts`, `src/core/openapi.ts` |
| Logic + validation | Effect programs; Effect Schema for DTOs and the OpenAPI spec | effect 3.22 | `templates/src/modules/*/services`, `schemas` |
| Data | Firestore over REST; service-account JWT signed with WebCrypto; no SDK | none (fetch) | `templates/src/core/firestore.ts` |
| Auth | Firebase ID token (RS256, Google JWKS); role from the `role` custom claim | jose 6.2 | `templates/src/core/auth.ts` |
| Security | secure headers, CORS allow-list from env, 1 MB body limit, per-uid Workers Rate Limiting | hono built-ins | `templates/src/core/security.ts` |
| Tests | vitest; in-memory fake Firestore layer; fake token verifier | vitest 3.2 | `templates/src/tests` |
| Language | TypeScript strict, no build step | typescript 5.9 | `templates/tsconfig.json` |
| Node | for tooling only (wrangler, vitest, scripts) | >= 22 | `templates/package.json` `engines` |

Design and decisions: [docs/architecture.md](docs/architecture.md).

## Install

In Claude Code 2.1.275 or later:

```
/plugin install backend-dev --marketplace baonguyen-agilityio/claude-api-dev-plugin
```

Or from a clone: `claude plugin marketplace add ./` then `claude plugin install backend-dev@bao-plugins`. Teammates need read access to this repository to install from it. In this repo the plugin is already enabled through `.claude/settings.json`.

Then, once per repository, a lead runs `/backend-dev:kit-setup` (add the API app's path in a monorepo, for example `/backend-dev:kit-setup apps/api`). It reads the repo and drafts a short project profile in `CLAUDE.md` (commands, layering, error style, git and CI conventions), turns off AI attribution in `.claude/settings.json` and lists every fact it could not establish as a question. Review, answer, commit. Every skill follows that profile; projects made from the template get one from the scaffold.

Agent: `backend-dev:backend-dev`, only when asked by name or for an end-to-end run.

## Maintaining

- Owner: baonguyen-agilityio. Changes go through a pull request with a review pass posted on it; nothing merges to `main` without one.
- Every skill was built the same way, and a change to one follows the same six steps: (1) do the stage's task on the template with a plain session and no skill, keep what it got wrong; (2) write the procedure, the gotchas from that run, the output template; (3) description in the Agent Skills form ("what it does. Use when …", ≤ 1024 chars, naming the stack); (4) write the eval queries (should-trigger, near-miss, one outcome rubric); (5) `node plugins/backend-dev/scripts/check-plugin.mjs`, `skill-validator check plugins/backend-dev/skills/<name> --strict` (agent-ecosystem/skill-validator: strict YAML, fences, token budget, keyword stuffing; `brew install agent-ecosystem/tap/skill-validator`), `claude plugin validate plugins/backend-dev --strict`, one smoke prompt per stage; (6) the PR carries the hands-on notes, the smoke result and the review pass.
- Smoke prompts on a machine with its own user-level skills: `claude -p "<prompt>" --model sonnet --setting-sources project --plugin-dir plugins/backend-dev --permission-mode acceptEdits --allowedTools "Bash(ls *)" "Bash(cat *)" Read Glob Grep Skill Write Edit --output-format stream-json --verbose`, then grep for `"name":"Skill"`. Without `--setting-sources project` the user's other skills compete and the plugin's rarely fire.
- Evals run once per release, not per edit: trigger suite `claude plugin eval plugins/backend-dev --trust-plugin --ablation none --tag train --runs 2 -j 4 --model sonnet --max-cost-usd 8`, then `--tag validation` once on queries never used to edit a description (a case passes at a trigger rate ≥ 0.5); outcome suite `--tag outcome --ablation with-without --runs 2 --scaffold --allow-tools Bash Write Edit --max-cost-usd 6`. Commit the dated results folders. Re-run only the failed cases after a fix.
- Any change to `docs/architecture.md`: copy it to `plugins/backend-dev/references/architecture.md` (the lint fails otherwise) and re-check the template against the changed sections.
- Any change to `templates/`: CI runs the gates on a clean copy and the generator; run them locally first (`npm run typecheck && npm test && npm run check`).
- Token footprint (`claude --plugin-dir plugins/backend-dev plugin details backend-dev`): about 1,200 tokens always-on for the eight descriptions and the agent, 1.5k–2.4k per skill when it fires.

## Layout

- `plugins/backend-dev/` — the plugin: `skills/` (nine), `commands/` (kit-setup, ticket), `references/` (project profile format, architecture note), `scripts/` (scaffold, new-module, doctor), `templates/` (new API), `agents/`, `hooks/`, `rules/`, `evals/`
- `docs/` — architecture and decisions the plugin and template follow
