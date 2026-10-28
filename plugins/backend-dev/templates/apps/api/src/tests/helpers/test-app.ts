import { Effect } from "effect";
import { createApp } from "@/app";
import type { AuthUser, VerifyToken } from "@app/core/auth";
import type { Env } from "@app/core/firestore";
import { API_PREFIX } from "@/constants/routes";
import { makeFakeFirestore, type Fake } from "@app/core/testing/fake-firestore";
import { TEST_ENV } from "@app/core/testing/env";

export { TEST_ENV };

// Fake verifier: the token string picks the caller; anything else is 401.
export const USERS: Record<string, AuthUser> = {
  user: { uid: "u1", email: "user@example.com" },
  other: { uid: "u2", email: "other@example.com" },
  admin: { uid: "a1", email: "admin@example.com", role: "admin" },
};
const fakeVerify: VerifyToken = async (token) => {
  const user = USERS[token];
  if (!user) throw new Error("invalid token");
  return user;
};

// Responses are typed loosely so tests can read bodies without casts.
type Res = Omit<Response, "json"> & { json: () => Promise<any> };
type Options = { method?: string; body?: unknown; as?: keyof typeof USERS | null; token?: string; headers?: Record<string, string>; env?: Partial<Env> };

// HTTP client against the real app with a fake Firestore and fake auth. Paths are relative to API_PREFIX.
export function testApp() {
  const fake = makeFakeFirestore();
  const app = createApp({ firestore: () => fake.layer, verifyToken: fakeVerify });
  const request = (path: string, { method = "GET", body, as = "user", token, headers: extra, env }: Options = {}) => {
    const headers: Record<string, string> = { ...extra };
    const bearer = token ?? (as ? as : undefined);
    if (bearer) headers.authorization = `Bearer ${bearer}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    const payload = body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body);
    return app.request(`${API_PREFIX}${path}`, { method, headers, body: payload }, { ...TEST_ENV, ...env }) as Promise<Res>;
  };
  return { app, fake, request };
}

// Run / flip an Effect against a fake layer (service tests).
export const run = <A, E>(fake: Fake, eff: Effect.Effect<A, E, any>) => Effect.runPromise(eff.pipe(Effect.provide(fake.layer)) as Effect.Effect<A, E>);
export const fail = <A, E>(fake: Fake, eff: Effect.Effect<A, E, any>) => Effect.runPromise(Effect.flip(eff).pipe(Effect.provide(fake.layer)) as Effect.Effect<E, A>);
