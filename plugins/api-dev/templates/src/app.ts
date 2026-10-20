import { Hono } from "hono";
import { describeRoute, openAPIRouteHandler } from "hono-openapi";
import { Schema, type Layer } from "effect";
import { API_PREFIX, PUBLIC_ROUTES } from "@/constants/routes";
import { authMiddleware, verifyFirebaseIdToken, type VerifyToken } from "@/core/auth";
import type { Env, Firestore } from "@/core/firestore";
import { makeRun, type AppEnv } from "@/core/run";
import { dataResponse, docsHtml, documentation } from "@/core/openapi";
import { corsFromEnv, limitBody, rateLimit, securityHeaders } from "@/core/security";
import { modules } from "@/modules";

// Injected so tests pass a fake Firestore layer and a fake token verifier.
export type AppDeps = { firestore: (env: Env) => Layer.Layer<Firestore>; verifyToken?: VerifyToken };

// The pipeline of architecture §1, in this order.
export function createApp({ firestore, verifyToken = verifyFirebaseIdToken() }: AppDeps) {
  const run = makeRun(firestore);
  const app = new Hono<AppEnv>().basePath(API_PREFIX);

  app.use("*", securityHeaders());
  app.use("*", corsFromEnv());
  app.use("*", limitBody());
  app.use("*", authMiddleware(verifyToken, PUBLIC_ROUTES));
  app.use("*", rateLimit());

  app.get("/health", describeRoute({ tags: ["system"], summary: "Health check", security: [], responses: { 200: dataResponse("OK", Schema.Struct({ ok: Schema.Boolean })) } }), (c) => c.json({ data: { ok: true } }));
  for (const m of modules) app.route(m.path, m.routes(run));

  app.get("/openapi.json", openAPIRouteHandler(app, { documentation, exclude: [`${API_PREFIX}/openapi.json`, `${API_PREFIX}/docs`] }));
  app.get("/docs", (c) => c.html(docsHtml(`${API_PREFIX}/openapi.json`)));
  return app;
}
