# CLAUDE.md

## Project
Repo for the `api-dev` Claude Code plugin: skills, rules, an agent, a template API and evals for building one standalone REST API on Cloudflare Workers. Design lives in `docs/`; the plugin in `plugins/api-dev/`. Everything in source is English: code, comments, docs, commit messages.

## Commands
- No commands yet. Plugin lint and template gates are added as the plugin lands; keep this list current.

## Conventions
- Branches: `feat/<short-desc>`, `docs/<short-desc>`, `chore/<short-desc>`. One branch per pull request, one topic per branch; squash-merge, then delete the branch.
- Commits: Conventional Commits, lowercase imperative (`feat: add ...`, `docs: update ...`).
- Design before code: `docs/architecture.md` is the source of truth; plugin rules cite it, the template implements it. A mismatch is a bug in one of them, fix that one.
- Prefer Node built-ins over npm packages; say why before adding a dependency.
- Review before merge: every PR gets a review pass (`/review-checklist` or `/code-review`) posted on the PR; a thread resolves only after the fix is verified; the verdict line is quoted in the merge body.
- Known gaps of the push guard: it only sees Claude's tool calls, not your terminal; a bare `git push` while on `main`, `git --git-dir=… push`, and commands built from shell variables are not matched. This private repo has no server-side branch protection.

## Never
- Never commit secrets, `.dev.vars`, service-account files or tokens; read them from env vars or Wrangler secrets.
- Never push to `main` directly; `.claude/settings.json` denies `git push … main` for Claude. Use `--force-with-lease` only on your own branch.
- Never merge a PR without a review pass on it.
- Never add AI-attribution lines to commits or pull requests.
- Never put unrelated material (course notes, quiz pages, personal files) in this repo.
