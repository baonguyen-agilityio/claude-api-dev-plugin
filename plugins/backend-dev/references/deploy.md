# Deploy to Cloudflare Workers

## One-time setup
1. Firebase service account: Console → Project settings → Service accounts → Generate new private key. Take `client_email` and `private_key` from the JSON; never commit the file (`.gitignore` blocks `service-account*.json`).
2. IAM: the service account needs `roles/datastore.user` (the Firebase-generated key has it).
3. Firestore in Native mode with the `(default)` database. Deploy `firestore.indexes.json` with `npx firebase deploy --only firestore:indexes` (or create indexes from the console link Firestore prints on the first failing query).
4. `npx wrangler login`.
5. `wrangler.toml`: set `name` and `FIREBASE_PROJECT_ID` at the top level (used by `wrangler dev`) and in each `[env.*]`. Each env deploys as its own Worker and may point at its own Firebase project.
6. Auth: clients sign in with the Firebase Auth SDK and send `Authorization: Bearer <ID token>` from the same project as that env's `FIREBASE_PROJECT_ID`. Roles are custom claims (`role: "admin"`) set once with the Admin SDK from a trusted script.

## Secrets
```bash
npx wrangler secret put FIREBASE_CLIENT_EMAIL --env dev
npx wrangler secret put FIREBASE_PRIVATE_KEY --env dev     # paste the private_key value as-is, \n sequences included
npx wrangler secret list --env dev
```
Repeat per env. Locally use `.dev.vars` (copied from `.dev.vars.example`).

## Deploy and verify
```bash
npm run typecheck && npm test && npm run check && npm audit --omit=dev
npm run deploy:dev
curl -s https://dev-<name>.<account>.workers.dev/api/v1/health
npx wrangler tail --env dev
npx wrangler rollback --env dev
```

## CI
Run the gates on every PR. Deploy from CI only with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets and a manual approval for stag/prod.
