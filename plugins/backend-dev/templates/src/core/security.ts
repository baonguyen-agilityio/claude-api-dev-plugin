import type { Context, MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { errorBody } from "./errors";
import type { AppEnv } from "./run";

// Security plumbing composed in app.ts (architecture §1; rules/security.md).
export const MAX_BODY_BYTES = 1024 * 1024;

// One JSON line per security event. Never the token, headers or body.
export const securityLog = (c: Context<AppEnv>, event: string, reason: string) =>
  console.warn(JSON.stringify({ event, reason, method: c.req.method, path: c.req.path, uid: c.get("user")?.uid, requestId: c.req.header("cf-ray") }));

export const securityHeaders = (): MiddlewareHandler => secureHeaders();

// Allow-list from env.CORS_ORIGINS; any other origin gets no CORS headers. Unset = server-to-server only.
export const corsFromEnv = (): MiddlewareHandler<AppEnv> => (c, next) => {
  const allowed = (c.env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  return cors({ origin: (origin) => (allowed.includes(origin) ? origin : null) })(c, next);
};

export const limitBody = (): MiddlewareHandler =>
  bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json(errorBody("PAYLOAD_TOO_LARGE", "Request body is too large"), 413) });

// Per-user limit through the Workers Rate Limiting binding. Runs after auth so the key is the uid; no binding = no limiting.
export const rateLimit = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const user = c.get("user");
  if (c.env.API_LIMITER && user) {
    const { success } = await c.env.API_LIMITER.limit({ key: user.uid });
    if (!success) {
      securityLog(c, "rate_limited", "limit exceeded");
      return c.json(errorBody("RATE_LIMITED", "Too many requests"), 429);
    }
  }
  await next();
};
