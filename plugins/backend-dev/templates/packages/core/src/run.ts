import type { Context, Hono } from "hono";
import { Effect, Either, type Layer, ParseResult } from "effect";
import type { AuthUser } from "./auth";
import { errorBody, type BadRequest, type Conflict, type ErrorBody, type FirestoreError, type Forbidden, type NotFound } from "./errors";
import type { Env, Firestore } from "./firestore";
import { isPage } from "./pagination";

// c.env holds the bindings; c.get("user") is set by authMiddleware on every protected route.
export type AppEnv = { Bindings: Env; Variables: { user: AuthUser } };
export type AppError = BadRequest | Forbidden | NotFound | Conflict | FirestoreError | ParseResult.ParseError;

export type Ctx = Context<AppEnv, any>;
export type WithId = Context<AppEnv, "/:id">;
export type WithQuery<Q> = Context<AppEnv, any, { out: { query: Q } }>;

export type Run = (c: Ctx, eff: Effect.Effect<unknown, AppError, Firestore>, status?: 200 | 201 | 204) => Promise<Response>;

// Contract every feature module exports from modules/<name>/index.ts (architecture §2).
export type Module = { path: string; routes: (run: Run) => Hono<AppEnv> };

// First issue only, as "field: message" (architecture §8).
export const issueMessage = (issue: { message: string; path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> }) => {
  const path = (issue.path ?? []).map((p) => String(typeof p === "object" ? p.key : p)).join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
};

export const toErrorResponse = (e: AppError): { status: 400 | 403 | 404 | 409 | 502; body: ErrorBody } => {
  switch (e._tag) {
    case "ParseError": {
      const [first] = ParseResult.ArrayFormatter.formatErrorSync(e);
      return { status: 400, body: errorBody("BAD_REQUEST", first ? issueMessage(first) : "Invalid request") };
    }
    case "BadRequest": return { status: 400, body: errorBody("BAD_REQUEST", e.message) };
    case "Forbidden": return { status: 403, body: errorBody("FORBIDDEN", e.message) };
    case "NotFound": return { status: 404, body: errorBody("NOT_FOUND", "Resource not found") };
    case "Conflict": return { status: 409, body: errorBody("CONFLICT", e.message) };
    case "FirestoreError": return { status: 502, body: errorBody("UPSTREAM_ERROR", "Upstream error") };
  }
};

// Effect -> Hono bridge: provide the Firestore layer, wrap success as { data } (a Page is sent as-is),
// map tagged errors to { code, message }. layerFor is injected so tests pass a fake Firestore.
export const makeRun = (layerFor: (env: Env) => Layer.Layer<Firestore>): Run =>
  async (c, eff, status = 200) => {
    const result = await Effect.runPromise(Effect.either(Effect.provide(eff, layerFor(c.env))));
    if (Either.isRight(result)) {
      if (status === 204) return c.body(null, 204);
      return c.json(isPage(result.right) ? result.right : { data: result.right }, status);
    }
    const e = result.left;
    if (e._tag === "FirestoreError") console.error(JSON.stringify({ event: "upstream_error", service: "firestore", status: e.status, requestId: c.req.header("cf-ray") }));
    const { status: code, body } = toErrorResponse(e);
    return c.json(body, code);
  };
