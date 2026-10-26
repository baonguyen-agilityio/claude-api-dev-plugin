# CLAUDE.md

## Project
Repo for the `backend-dev` Claude Code plugin: a team kit for APIs on Cloudflare Workers + Firestore: skills (including the typed `/backend-dev:kit-setup` and `/backend-dev:ticket`), rules, an agent, a template API and evals. It works on existing repos and monorepos through a project profile, and on new repos made from the template. Design lives in `docs/`; the plugin in `plugins/backend-dev/`. Code is written and reviewed on GitHub (`origin`): pull requests, CI and the Claude review run there before a merge. GitLab (`gitlab`) is where the team installs the plugin from; it receives `main` after each merge with `git push gitlab main`, done by hand because the GitLab host is only reachable from the internal network. Everything in source is English: code, comments, docs, commit messages.

## Commands
- `node plugins/backend-dev/scripts/check-plugin.mjs` — plugin lint (frontmatter, references, design copy in sync, evals). CI runs it on every pull request.
- `claude plugin validate --strict plugins/backend-dev` and `claude plugin validate --strict .` — manifest and marketplace.
- After editing `docs/architecture.md`: `cp docs/architecture.md plugins/backend-dev/references/architecture.md` (the lint fails otherwise).

## Conventions
- Branches: `feat/<short-desc>`, `docs/<short-desc>`, `chore/<short-desc>`. One branch per pull request, one topic per branch; squash-merge, then delete the branch.
- Commits: Conventional Commits, lowercase imperative (`feat: add ...`, `docs: update ...`).
- Design before code: `docs/architecture.md` is the source of truth; plugin rules cite it, the template implements it. A mismatch is a bug in one of them, fix that one.
- Prefer Node built-ins over npm packages; say why before adding a dependency.
- Review before merge: every pull request gets a review pass (the review workflow: `claude-review` for bugs in code, `kit-review` for skills as instructions, which fails its check on `VERDICT: NEEDS_CHANGES`; or `/review-checklist` / `/code-review` by hand) posted on the pull request, with its verdict in its description; a thread resolves only after the fix is verified.
- Known gaps of the push guard: it only sees Claude's tool calls, not your terminal; a bare `git push` while on `main`, `git --git-dir=… push`, and commands built from shell variables are not matched. The GitHub repo has no server-side branch protection; on GitLab, `main` is protected (Maintainers push, no force push), so `main` there only ever fast-forwards to GitHub's.

## Never
- Never commit secrets, `.dev.vars`, service-account files or tokens; read them from env vars or Wrangler secrets.
- Never push to `main` directly; `.claude/settings.json` denies `git push … main` for Claude. Use `--force-with-lease` only on your own branch.
- Never merge a pull request without a review pass on it.
- Never add AI-attribution lines to commits or pull requests.
- Never put unrelated material (course notes, quiz pages, personal files) in this repo.
