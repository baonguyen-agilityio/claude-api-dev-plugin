import { describe, expect, it } from "vitest";
import { testApp } from "@/tests/helpers/test-app";

describe("items routes", () => {
  it("DELETE is admin only: 403 for a user, 204 for an admin, 404 when gone", async () => {
    const { request } = testApp();
    const { data } = await (await request("/items", { method: "POST", body: { name: "pen", qty: 1 } })).json();
    expect((await request(`/items/${data.id}`, { method: "DELETE" })).status).toBe(403);
    expect((await request(`/items/${data.id}`, { method: "DELETE", as: "admin" })).status).toBe(204);
    expect((await request(`/items/${data.id}`, { method: "DELETE", as: "admin" })).status).toBe(404);
  });

  it("400 for an invalid body, malformed JSON and a bad query, with the field named", async () => {
    const { request } = testApp();
    const bad = await request("/items", { method: "POST", body: { name: "", qty: 1 } });
    expect(bad.status).toBe(400);
    expect((await bad.json()).message).toMatch(/^name:/);
    expect((await request("/items", { method: "POST", body: "{not json" })).status).toBe(400);
    const q = await request("/items?limit=0");
    expect(q.status).toBe(400);
    expect((await q.json()).message).toMatch(/limit/);
  });

  it("POST returns 201 with the envelope and ignores a client-sent ownerId", async () => {
    const { request } = testApp();
    const res = await request("/items", { method: "POST", body: { name: "pen", qty: 2, ownerId: "evil" } });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ data: { name: "pen", qty: 2, ownerId: "u1" } });
    expect(typeof body.data.createdAt).toBe("string");
  });

  it("GET list returns { data, meta.pagination }; GET missing is 404", async () => {
    const { request } = testApp();
    await request("/items", { method: "POST", body: { name: "a", qty: 1 } });
    const list = await (await request("/items?limit=1")).json();
    expect(list.data).toHaveLength(1);
    expect(list.meta.pagination.limit).toBe(1);
    expect((await request("/items/nope")).status).toBe(404);
  });

  it("PATCH by another user is 403; by the owner 200", async () => {
    const { request } = testApp();
    const { data } = await (await request("/items", { method: "POST", body: { name: "pen", qty: 1 } })).json();
    expect((await request(`/items/${data.id}`, { method: "PATCH", as: "other", body: { qty: 5 } })).status).toBe(403);
    expect((await request(`/items/${data.id}`, { method: "PATCH", body: { qty: 5 } })).status).toBe(200);
  });
});
