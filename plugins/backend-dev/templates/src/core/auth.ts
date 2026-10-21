import type { MiddlewareHandler } from "hono";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { errorBody } from "./errors";
import type { Env } from "./firestore";
import type { AppEnv } from "./run";
import { securityLog } from "./security";

// The verified caller, available as c.get("user") on every protected route (architecture §6).
export type AuthUser = { uid: string; email?: string; role?: string };
export type VerifyToken = (token: string, env: Env) => Promise<AuthUser>;
export const isAdmin = (u: AuthUser) => u.role === "admin";

const FIREBASE_JWKS = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let remoteKeys: JWTVerifyGetKey | undefined; // per-isolate key cache; jose refetches on an unknown kid

// Verifies a Firebase ID token: RS256, issuer and audience pinned to the env's project. `keys` is injectable for tests.
export const verifyFirebaseIdToken =
  (keys?: JWTVerifyGetKey): VerifyToken =>
  async (token, env) => {
    const { payload } = await jwtVerify(token, keys ?? (remoteKeys ??= createRemoteJWKSet(new URL(FIREBASE_JWKS), { timeoutDuration: 3000 })), {
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
      audience: env.FIREBASE_PROJECT_ID,
      algorithms: ["RS256"],
    });
    if (!payload.sub) throw new Error("token has no subject");
    return {
      uid: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      role: typeof payload.role === "string" ? payload.role : undefined,
    };
  };

// Requires `Authorization: Bearer <ID token>` on every path not in publicRoutes. OPTIONS passes for CORS preflight.
export const authMiddleware =
  (verify: VerifyToken, publicRoutes: readonly string[]): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    if (c.req.method === "OPTIONS" || publicRoutes.includes(c.req.path)) return next();
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) {
      securityLog(c, "unauthorized", "missing token");
      return c.json(errorBody("UNAUTHORIZED", "Missing bearer token"), 401);
    }
    try {
      c.set("user", await verify(token, c.env));
    } catch {
      securityLog(c, "unauthorized", "invalid token");
      return c.json(errorBody("UNAUTHORIZED", "Invalid or expired token"), 401);
    }
    await next();
  };

// Route guard; place after describeRoute() and before the handler.
export const requireRole =
  (...roles: string[]): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const role = c.get("user")?.role;
    if (!role || !roles.includes(role)) {
      securityLog(c, "forbidden", `needs ${roles.join("|")}`);
      return c.json(errorBody("FORBIDDEN", "You are not allowed to do this"), 403);
    }
    await next();
  };
