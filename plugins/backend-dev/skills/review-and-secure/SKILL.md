---
name: review-and-secure
description: "Reviews a change to a Cloudflare Workers + Firestore API before the merge request: contract against code, access control per endpoint, input handling, error leakage, reads per request, CORS and headers, secrets and tests, and writes the findings with the MR notes. Use when a change should be checked, hardened or made ready for review, even if the user only asks whether it is ok to merge."
allowed-tools: Read, Glob, Grep, Bash(npm run typecheck*), Bash(npm test*), Bash(npm run check*), Bash(npm audit*), Bash(git diff*), Bash(git status*), Bash(git log*)
---

# Review and secure

Problem this solves: a change looks done, and the defects that reach production in this stack are the quiet ones: a fetched document never compared with the caller, a server field accepted from the body, `cors()` with no options, a `get` per row. The answer is a findings list with locations and tests, plus the MR notes. Reads and reports; it changes no code. Works on its own or as a step of the process.

Risk table with the template's status: `references/security-checklist.md`. Reads, limits and amplification: `references/performance.md`.

## Procedure

1. **Establish the diff and run what you may.** `git diff <base>` or the module named; `npm run typecheck && npm test` when the dependencies are installed and the mode allows. When they cannot run, the Result says "gates not run" instead of inferring green.
2. **Contract against code.** For each endpoint in the diff: does `describeRoute` list every status the service can return; is the response shape the one the contract promised; is any existing field renamed, removed or retyped (breaking) without a consumer named.
3. **Access per endpoint, both checks.** Role on the route (`requireRole`), ownership in the service, and the 403/404 choice per resource. A fetched `current` that is never compared with the caller is a missing check; a `Forbidden` import with no use is the same finding. A gap in one module is checked in every sibling module.
4. **Input.** DTOs hold writable fields only; `{ ...data, ownerId: user.uid }` has the server field after the spread; `limit` is capped at `MAX_LIMIT`; query filter fields come from the model's allow-list; the body limit is in the chain.
5. **Errors.** No `throw` in a service; every tagged error mapped in `toErrorResponse`; the 502 body never carries the upstream message; a Firestore 400 caused by our own value is our defect, not an upstream one.
6. **Reads per request.** Count the Firestore calls on the hot path: a `get` inside a loop over a list, a list fetched twice, a lookup per row. Multiply by the largest `limit` the endpoint accepts; that is the subrequest and latency cost of one request.
7. **Headers, CORS, rate limit.** `cors()` without options is a finding; `CORS_ORIGINS` must be read; `secureHeaders()` present; a `ratelimits` binding in every env block.
8. **Secrets and logs.** No credential in code, tests, fixtures or `api.http`; logs carry ids, never tokens or bodies with PII.
9. **Tests for each finding.** Name the existing test that should fail on the finding, or the test to add; a finding without a test is a finding that will come back.
10. **Write the MR notes:** what changed, core touched, what reviewers should look at, which gates ran with their output. Never claim a gate that did not run.

## Gotchas seen on this stack

- The no-skill review found every planted defect (missing ownership check, `ownerId` from the body, open CORS, N+1 `get` per row, `limit` without a cap) and combined the last two into the real finding: `?limit=100000` fans out to that many Firestore calls from one request. Amplification is the severity, not each item.
- It read the tests and said which existing cases would fail; that is the shape of a finding here: location, what breaks, which test shows it.
- `run()` uses `Effect.either`, which does not catch defects: a `throw` inside `encode` or a bad PEM becomes a bare 500 with no structured body. Report it as a core finding when a change adds code that can throw.
- The review went to a plan file; the findings and the MR notes belong in the reply.
- A core finding (CORS, pagination) is a finding for every module; the blast radius line says so.
- Gates in plan mode or without `node_modules` cannot run; "I read the tests" is not "tests pass".

## Output

```markdown
## Review: <module or diff>
**Gates:** <typecheck / test / check output, or "not run: <why>">

### Blocking
[<area>] <path:line>
Breaks: <what a caller can do or what fails>
Shows: <existing test that fails, or the test to add>
Fix: <one line>

### Non-blocking
<same shape>

### Blast radius
<sibling modules checked for each finding → clean | same gap at <path>>

### MR notes
<what, core touched, reviewer focus, gates with output>
```

## Checklist
- [ ] Every endpoint in the diff has its access cell verified in code, not in the route doc.
- [ ] Every finding names a location, what breaks, and a test.
- [ ] Reads per request counted on the list endpoints with the maximum `limit`.
- [ ] Core findings carry their blast radius.
- [ ] Gates reported with output or as not run.
