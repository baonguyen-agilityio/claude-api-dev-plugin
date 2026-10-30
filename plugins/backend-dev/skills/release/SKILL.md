---
name: release
description: Release check for a Workers + Firestore API before it ships to an environment. Runs the delivery checklist without deploying (gates, audit, env block, secrets, indexes, rollback path) and reports GO or NO-GO for the checked-out commit. For production, a GO waits for you to type go, which the release gate records as your approval of that commit; a go after a NO-GO approves nothing.
argument-hint: "<env: dev | stag | prod | …>"
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Skill, Bash(git status*), Bash(git rev-parse*), Bash(git log*), Bash(git fetch*), Bash(git branch*), Bash(npx wrangler secret list*), Bash(npx wrangler deployments*), Bash(npx wrangler versions list*), Bash(npm audit*), Bash(pnpm audit*)
---

Check this release: "$ARGUMENTS"

The repo's conventions are in the `backend-dev:profile` block of `CLAUDE.md`: the deploy command per environment, the gates, the protected branches. Steps 1 to 4 deploy nothing and change no file. Step 5 deploys only after the developer's go; its deploy command, smoke and log commands are left out of `allowed-tools` on purpose, so each one goes through the normal permission prompt as well as the gate. The release gate (`hooks/release-gate.mjs`) decides every deploy, rollback and secret change in any permission mode: a production deploy only from a commit the developer approved here; a production rollback or secret change, and any other environment, after asking.

## Steps
1. **One environment.** No argument, or more than one token: ask which environment, and stop. An environment the profile and the deploy config (`[env.<name>]` in `wrangler.toml`, a `deploy:<name>` script) do not know: say so and stop.
2. **What would ship.** `git rev-parse HEAD`, the branch, `git status --porcelain` (anything listed ships with it: NO-GO for production), and `git fetch origin` then `git branch -r --contains HEAD`: a production release from a commit no protected branch contains is NO-GO, since nobody reviewed it. Name the commits since the last deploy when `npx wrangler deployments list --env <env>` shows its version message.
3. **The checklist.** Load `backend-dev:delivery` with the Skill tool and follow its steps 2 to 4 and 9 for this environment, reading only: the gates and the audit with their output, the env block, `npx wrangler secret list --env <env>` against the secrets the `Env` type needs, indexes the change adds, the rollback path and what rollback does not undo. Do not run its deploy, secret or promotion steps. A step that cannot run: say which, and the result is NO-GO for production.
4. **Verdict.** GO only when every check passed; otherwise NO-GO with each failed check and its fix. For production, a GO ends with: type `go` to approve `<short sha>` for production; the approval holds for an hour, for that commit and a clean working tree. Never write `.backend-dev/release-gate.json` yourself; only the hook that reads what the developer types writes it.
5. **After a NO-GO, a `go` changes nothing:** the gate records no approval, so say the verdict stands and name the fixes; never deploy on it. **After the developer's go to a GO** (production) or on their word (any other environment): run the profile's deploy command for the environment, which the gate checks; then delivery's step 5 (the authenticated smoke) and step 8 (watch the logs). A refused deploy: pass on the gate's reason as it stands. **The smoke fails or the logs show new errors:** stop; report the request that failed and its response; offer `npx wrangler rollback --env <env>` (the gate asks the developer; never run it on your own) and say what rollback does not undo (secrets, indexes, data); when users are affected, the next command is `/backend-dev:incident`.

## Output
```markdown
## Release <env>: <short sha> (<branch>)
**Ships:** <commits since the last deploy | unknown> · working tree <clean | changes listed>
**Reviewed:** <the protected branch that contains it | none>
**Checks:** gates <pass | fail | not run> · audit <…> · env block <…> · secrets <…> · indexes <…> · rollback <path, and what it does not undo>
**Verdict:** <one of GO, or NO-GO with each failed check and its fix>
**Next:** <prod GO: type `go` to approve <short sha> for production, then I run `<deploy command>` | other env GO: say deploy and I run `<deploy command>` (the gate asks you) | NO-GO: the fixes, then `/backend-dev:release <env>` again>
```
