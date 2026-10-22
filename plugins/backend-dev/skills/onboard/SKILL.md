---
name: onboard
description: "Builds or refreshes the onboarding guide for a Cloudflare Workers + Firestore API repository from the repo itself: how to run it, how the code is organised, the team's conventions, a domain glossary, what to read first and open questions for the lead, written to docs/onboarding.md. Use when someone is new to the project, asks where to start or how this codebase works, or the onboarding guide is missing or out of date."
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(node * doctor.mjs*), Bash(git ls-files*), Bash(git log*), Bash(ls *)
---

# Onboard

Problem this solves: a newcomer's first days go to questions the repo already answers (how to run it, which version, where a new endpoint goes, what the commit hook wants) and to the ones it does not (whose Firebase project local dev writes to, who hands out secrets). Each newcomer re-derives the same map, and nobody corrects it once. The answer is `docs/onboarding.md`, built from evidence and reviewed by a lead, plus a check of the newcomer's own machine. Works on its own or before a first `/backend-dev:ticket <id> --learn`.

Before anything else, follow the project profile: the `backend-dev:profile` block in the repo's `CLAUDE.md`. It is the reviewed summary; this guide is the long form and must agree with it. No profile: build the guide from the repo anyway and say in the result that `/backend-dev:kit-setup` has not been run. Section shapes and what counts as evidence: `references/guide-sections.md`.

## Procedure

1. **Guide exists?** Read `docs/onboarding.md`. Check every command, path and version in it against the repo; list each one that no longer holds. Refresh only those sections and keep text a person wrote (anything without a `<!-- onboard:generated -->` marker above it). No guide: write a new one.
2. **Run the machine check** for the person asking: `node ${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs <repo root> <API app path>`. Its output goes in the reply, never into the guide (it describes one laptop).
3. **What this is:** the product in two lines from the README and app names; the apps and shared packages, which one is the API.
4. **Run it:** the exact steps from the README and `package.json`, in order, with the versions the repo pins and where they disagree (README vs `packageManager` vs CI); the env keys the sample files name (names only, never values) and who provides the values (`?:` when no file says); what local dev talks to (a shared Firebase project, an emulator, seeded data) and how to seed.
5. **Map one request end to end** with real paths: route → controller → service → data access → response, using a module that already exists (prefer the one the person's ticket touches). Then where a new endpoint's pieces go, from the profile's layering line.
6. **Conventions** from the profile and the files that enforce them: branch, commit format and the hook that checks it, MR template and target, what pre-commit and pre-push run and how long, test layout and what is faked.
7. **Glossary:** the domain's nouns from the models or types and the collection names, one line each, taken from the code (types, comments, enum values); a term whose meaning the code does not give stays `?:`.
8. **Read first:** five to eight files in reading order, each with one line on why.
9. **Open questions for the lead:** every `?:`, plus anything the repo contradicts itself on.
10. **Write the guide** (under 200 lines), mark generated sections, do not commit. In the reply, answer the person's own question first, then point to the guide's sections.

## Gotchas seen on this stack

- The no-kit newcomer run found real traps (versions disagree between README and CI; local dev writes to the shared dev project; the root README is an untouched stub) and then wrote them to a user-level plan file that nobody else would read. The guide is a repo file for that reason.
- Env samples hold key names; a `.dev.vars` holds secrets. Read keys from the sample only and never print a value, even one that looks harmless.
- A monorepo has several READMEs that disagree; say which one is current (the app's, usually) and why.
- History in a fresh clone may be grafted to one commit; branch and commit conventions then come from the hook configs and templates, not from `git log`.
- Do not describe code from memory of similar projects: every path in the guide is one you opened.

## Output

The reply:

```markdown
## Onboarding: <repo>
**Your question:** <answer in a few lines, with paths>
**Your machine:** <doctor output, FAIL and WARN lines first>
**Guide:** docs/onboarding.md (new | refreshed: <sections changed>)
**Questions for the lead:** <the ?: list>
**Next:** read <first two files>; then `/backend-dev:ticket <id> --learn` for your first ticket
```

The guide follows `references/guide-sections.md`.

## Done when
- [ ] Every command and path in the guide was checked against the repo in this run.
- [ ] No env value appears anywhere; only key names.
- [ ] The guide agrees with the profile block, or the disagreement is a question for the lead.
- [ ] Generated sections are marked; human-written text was kept.
