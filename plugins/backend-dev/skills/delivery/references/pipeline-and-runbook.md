# Pipeline shape and runbook

## Workflows
- `ci.yml` on `pull_request`: `pnpm install --frozen-lockfile`, typecheck, tests, `wrangler deploy --dry-run` for the base config and every env (catches a var or binding declared at the top level only). Make the job a required check on `main`.
- `deploy.yml` on `push` to `main`: gates, then deploy `dev`, smoke, stop. `stag` and `prod` are jobs with `environment: stag` / `environment: prod`; GitHub Environments with required reviewers hold them until approved. `workflow_dispatch` with an `environment` input redeploys any SHA to any env.
- Each environment carries its own `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and a `BASE_URL` variable for the smoke step.

Deploy job skeleton:
```yaml
deploy:
  environment: ${{ inputs.environment }}
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: pnpm }
    - run: pnpm install --frozen-lockfile
    - run: pnpm --filter api exec wrangler deployments list --env ${{ inputs.environment }} | head -5
      env: { CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}, CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }} }
    - run: pnpm --filter api exec wrangler deploy --env ${{ inputs.environment }}
      env: { CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}, CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }} }
    - run: for i in 1 2 3 4 5; do curl -fsS "${{ vars.BASE_URL }}/api/v1/health" && exit 0; sleep 5; done; exit 1
```
Not in the pipeline, on purpose: `firebase deploy --only firestore:indexes` (needs a Firebase credential; run it before the code deploy that needs the index) and `wrangler secret put` (interactive, per env, by a person).

## Runbook per environment
**Before:** gates green on the SHA; indexes deployed to the env's project; `wrangler secret list --env` complete; the change's consumers know if the contract changed.
**Deploy:** `pnpm deploy:<env>`; note the version id.
**Smoke (five minutes):** `/health` 200; one authenticated read with a token from that env's project; one write on `dev`/`stag`; live-verify for a full status pass on a release.
**Watch (ten minutes):** `wrangler tail --env`; dashboard error rate, 502 count, CPU time p99; the symptom table in `troubleshoot.md`.
**Roll back when:** 5xx rate rises, 401 on everything (secret or project id), 502 on a list (index), any security regression. `npx wrangler rollback --env <env>`; then fix forward through a PR. Rollback does not undo: secrets rotated, indexes added, data written, a contract clients already adopted.
**Record:** version before and after, who approved, what was smoke-tested, anything rolled back.
