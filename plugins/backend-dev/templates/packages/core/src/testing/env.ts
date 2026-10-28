import type { Env } from "../firestore";

// Bindings for tests: a demo project and credentials the fakes never use.
export const TEST_ENV: Env = { FIREBASE_PROJECT_ID: "demo", FIREBASE_CLIENT_EMAIL: "svc@demo.iam.gserviceaccount.com", FIREBASE_PRIVATE_KEY: "unused-with-the-fake" };
