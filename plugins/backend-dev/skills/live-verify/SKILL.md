---
name: live-verify
description: "Proves a Cloudflare Workers + Firestore API works by calling it for real: obtains Firebase ID tokens for a user and an admin, drives every declared status with curl against wrangler dev or a deployed environment, diffs responses against the OpenAPI spec, checks headers and logs, and reports VERIFIED, PARTIAL or UNVERIFIED. Use when someone wants proof that an endpoint, change or deployment works, even when the tests are green."
user-invocable: false
allowed-tools: Read, Glob, Grep, Bash(curl *), Bash(jq *), Bash(npm run dev*), Bash(npx wrangler dev*), Bash(npx wrangler tail*), Bash(node * set-claim.mjs *), Bash(base64 *), Bash(cut *)
---

# Live verify

Problem this solves: green tests prove the fake, not the token check, the adapter or the bindings. The answer is a curl record of every declared status against a running Worker, with a verdict. Changes no code and no data in `prod`; a defect it finds is reported with the exact request that showed it. Works on its own or as a step of the process.

Before anything else, follow the project profile: the `backend-dev:profile` block in the repo's `CLAUDE.md`. Where it differs from the defaults below (commands, layering, error style, git and CI conventions), the profile wins. No profile: the defaults below are the template's (`${CLAUDE_PLUGIN_ROOT}/references/project-profile.md`); say in the result that `/backend-dev:kit-setup` has not been run.

**Stack.** The steps, gotchas and references below are written for the kit's default stack (Cloudflare Workers, Hono, Firestore, Firebase Auth). When the profile's **Stack** line names another stack, read `${CLAUDE_PLUGIN_ROOT}/references/stacks.md` before step 1: it says which steps hold on any stack and where that stack's guide lives. No guide for it: keep the stack-neutral steps, follow the repo's own architecture note and code for the rest, and say so in the result; never carry Firestore, Wrangler or Firebase advice into a repo that does not use them.

Tokens and claims: `references/token-flow.md`. Statuses to drive and what each proves: `references/status-table.md`. Claim script: `scripts/set-claim.mjs`.

## Procedure

1. **Pick the target and read its config.** `wrangler dev` with `.dev.vars` (the `FIREBASE_PROJECT_ID` there wins over `[vars]`; the kit's settings keep `.dev.vars` closed to Claude because it holds secrets, so ask the developer which project it names, or use `[vars]` when the developer says `.dev.vars` does not override it), or `https://<env>-<name>.<account>.workers.dev/api/v1`. The token must come from the same Firebase project as that target's `FIREBASE_PROJECT_ID`; a token from another project is a 401 that looks like a bug.
2. **Obtain tokens the way a client does:** Firebase Auth REST `signUp`/`signInWithPassword` with the project's web API key for a test user and a test admin; set `role=admin` with the Admin SDK from `scripts/set-claim.mjs` before minting the admin token (a claim set after the token was issued is not in it). Decode the payload and check `aud`, `iss`, `role` before blaming the API. No token: protected routes are UNVERIFIED, say so; never add a route to `PUBLIC_ROUTES` to get past auth.
3. **Start or reach the API** and prove the baseline. Port 8787 taken (`curl -s localhost:8787/health` answers before you started anything, or `wrangler dev` reports the address in use; often another worktree's run): start on the next free port (`npx wrangler dev --port 8788`) and drive that one. Then `/health` 200, a protected route without a token 401.
4. **Drive every declared status for the endpoint under test,** in the order of the table: 401, the 403/404 rule as the wrong user, 400 on a bad body and a bad cursor, 404 on a missing id, the happy path with the fields the contract promised, the 409 on the second transition, the server-owned field ignored. Always print the status with the body (`-w '\nHTTP %{http_code}\n'`).
5. **Check the state after each step**, not only the response: a 403 must leave the document unchanged; a 409 must not move `decidedAt`.
6. **Diff against the spec:** `/openapi.json` (or the path the repo's `app.ts` declares) for the route's responses and schema versus `jq -S 'keys'` of the real response. A spec that disagrees with a correct response is the defect.
7. **Headers and limits once per deployment:** `Origin: https://evil.example` must get no `access-control-allow-origin`; `strict-transport-security` and `x-content-type-options` present; a burst past the limit answers 429 (deployed only; `wrangler dev` has no limiter).
8. **Read the logs while driving:** `npx wrangler tail --env <env>` for the `firestore` line on a 502, the `forbidden` event on a 403.
9. **Race the transition when the contract promises one winner:** five concurrent approvals on a fresh request; more than one 200 is a defect to report with the request that showed it.
10. **Clean up what you created** on dev and stag (cancel, delete). Name what you create after the ticket or branch (`lv-412-pen`) from the start, so a run in another worktree against the same project neither reads nor deletes it; never create or change data in `prod` without the user's go-ahead.

## Gotchas seen on this stack

- The no-skill run produced the whole token flow (REST sign-up, claim script, payload decode) and the race test, but never diffed `/openapi.json`, never checked headers, never read `wrangler tail`, and gave no verdict line. Steps 6–8 and the Output exist because of that.
- `wrangler.toml` env blocks hold placeholder project ids in a fresh scaffold; `--env dev` then points at a project that does not exist. Local runs read `.dev.vars`.
- Claims live in the token: set the claim, then sign in. Tokens expire after one hour; a 401 late in a session is usually that.
- `wrangler dev` talks to the real Firestore of the project in `.dev.vars`; there is no emulator in this stack. Verification writes real documents; the cleanup step is part of the proof.
- macOS `base64 -D`, Linux `base64 -d`; when decoding fails on padding, read the claims from the sign-in response (`localId`) and the script output instead.
- The template's approve/reject has no precondition: the sequential 409 passes while the concurrent case can produce two 200s. Step 9 is the only place that shows it.
- A green vitest run proves the fake; only the curl proves the adapter, the token check and the bindings.

## Output

```markdown
## Result
**Verdict:** VERIFIED | PARTIAL | UNVERIFIED
**Target:** <wrangler dev | env URL>, project <id>, as user <uid> and admin <uid>
**Drove:** <method path → status → key fields seen>, one line per case, in table order
**Spec diff:** <none | path → difference>
**Headers:** <checked | not checked (local)>
**Logs:** <lines that matter, or "none">
**Statuses not driven:** <which and why>
**Defects found:** <exact request → expected vs seen> (report with the exact request)
**Cleanup:** <what was removed or left, where>
**Next:** VERIFIED → commit and open the MR, or promote to the next environment after a deploy; a defect → incident with the request that showed it.
```

`VERIFIED` only when every declared status for the endpoint was driven with the output pasted; `PARTIAL` when some could not be (no admin token, no deployed env); `UNVERIFIED` when nothing was driven. Never `VERIFIED` from tests alone.
