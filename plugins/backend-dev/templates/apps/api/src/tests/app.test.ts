import { describe, expect, it } from "vitest";
import { API_PREFIX, PUBLIC_ROUTES } from "@/constants/routes";
import { testApp } from "./helpers/test-app";

describe("app", () => {
  it("health is public and wrapped in { data }", async () => {
    const { request } = testApp();
    const res = await request("/health", { as: null });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { ok: true } });
  });

  it("every documented route except PUBLIC_ROUTES answers 401 without a token", async () => {
    const { request } = testApp();
    const spec = await (await request("/openapi.json", { as: null })).json();
    const paths = Object.keys(spec.paths);
    expect(paths.length).toBeGreaterThan(3);
    for (const p of paths) {
      if (PUBLIC_ROUTES.includes(p)) continue;
      for (const method of Object.keys(spec.paths[p])) {
        const res = await request(p.replace(API_PREFIX, "").replace(/\{(\w+)\}/g, "x"), { method: method.toUpperCase(), as: null });
        expect(res.status, `${method} ${p}`).toBe(401);
        expect(await res.json()).toMatchObject({ code: "UNAUTHORIZED" });
      }
    }
  });

  it("a forged token is 401", async () => {
    const { request } = testApp();
    expect((await request("/items", { token: "forged" })).status).toBe(401);
  });

  it("the spec documents the bearer scheme and every route declares 401", async () => {
    const { request } = testApp();
    const spec = await (await request("/openapi.json", { as: null })).json();
    expect(spec.components.securitySchemes.BearerAuth.scheme).toBe("bearer");
    for (const [p, ops] of Object.entries<any>(spec.paths)) {
      if (PUBLIC_ROUTES.includes(p)) continue;
      for (const [m, op] of Object.entries<any>(ops)) expect(op.responses["401"], `${m} ${p}`).toBeDefined();
    }
  });

  it("rate limiter binding answers 429 when exhausted", async () => {
    const { request } = testApp();
    const res = await request("/items", { env: { API_LIMITER: { limit: async () => ({ success: false }) } } });
    expect(res.status).toBe(429);
  });

  it("CORS only echoes allow-listed origins", async () => {
    const { request } = testApp();
    const ok = await request("/health", { as: null, headers: { origin: "http://localhost:3000" }, env: { CORS_ORIGINS: "http://localhost:3000" } });
    expect(ok.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    const no = await request("/health", { as: null, headers: { origin: "https://evil.example" }, env: { CORS_ORIGINS: "http://localhost:3000" } });
    expect(no.headers.get("access-control-allow-origin")).toBeNull();
  });
});
