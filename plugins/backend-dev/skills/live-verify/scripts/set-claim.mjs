// Sets a custom claim on a Firebase user with the Admin SDK. Runs locally, never on the Worker.
// Usage: node set-claim.mjs <service-account.json> <email> [role=admin]
// Needs `firebase-admin` resolvable (npm i firebase-admin in the current folder, or NODE_PATH).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const [sa, email, role = "admin"] = process.argv.slice(2);
if (!sa || !email) { console.error("usage: node set-claim.mjs <service-account.json> <email> [role]"); process.exit(1); }
const require = createRequire(process.cwd() + "/");
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
initializeApp({ credential: cert(JSON.parse(readFileSync(sa, "utf8"))) });
const user = await getAuth().getUserByEmail(email);
await getAuth().setCustomUserClaims(user.uid, { role });
console.log(`role=${role} set for ${user.uid}; sign in again to get a token that carries it`);
