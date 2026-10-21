# Getting real tokens

Prerequisites (Firebase console, once per project): Authentication → Sign-in method → Email/Password enabled; Project settings → General → Web API key; Project settings → Service accounts → a private key JSON (keep it outside the repo or under a name `.gitignore` covers).

```bash
export PROJECT_ID="<firebase project id of the target env>"
export WEB_API_KEY="<web api key>"
export SA="<path to the service-account json>"
SIGNUP="https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$WEB_API_KEY"
SIGNIN="https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$WEB_API_KEY"

# test users (EMAIL_EXISTS on a rerun is fine)
for who in user admin; do curl -s "$SIGNUP" -H 'content-type: application/json' -d "{\"email\":\"e2e-$who@example.test\",\"password\":\"<strong test password>\",\"returnSecureToken\":true}" | jq '{email, localId}'; done

# admin claim, before minting the admin token
node "${CLAUDE_PLUGIN_ROOT}/skills/live-verify/scripts/set-claim.mjs" "$SA" e2e-admin@example.test admin

tok() { curl -s "$SIGNIN" -H 'content-type: application/json' -d "{\"email\":\"e2e-$1@example.test\",\"password\":\"<strong test password>\",\"returnSecureToken\":true}" | jq -r .idToken; }
USER_TOKEN=$(tok user); ADMIN_TOKEN=$(tok admin)

# read the claims before blaming the API (macOS: base64 -D; Linux: base64 -d)
claims() { echo "$1" | cut -d. -f2 | tr '_-' '/+' | base64 -D 2>/dev/null | jq '{sub, aud, iss, role}'; }
claims "$ADMIN_TOKEN"     # aud = PROJECT_ID, role = "admin"
```

Checks that save an hour:
- `aud` must equal the target's `FIREBASE_PROJECT_ID`; otherwise every call is 401 and the API is right.
- `role` must be in the admin token; if it is missing, the claim was set after sign-in: sign in again.
- Tokens last one hour.
- `set-claim.mjs` needs `firebase-admin` resolvable: run it from a folder where `npm i firebase-admin` was done, or pass `NODE_PATH`. The script never runs on the Worker.

Deployed targets: `BASE=https://<env>-<name>.<account>.workers.dev/api/v1`; the token comes from that env's Firebase project. Local: `BASE=http://localhost:8787/api/v1`, project from `.dev.vars`.
