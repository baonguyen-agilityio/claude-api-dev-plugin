import { createApp } from "@/app";
import { FirestoreLive } from "@app/core/firestore";

// Worker entry: a Hono app already has fetch, so exporting it is enough.
export default createApp({ firestore: (env) => FirestoreLive(env) });
