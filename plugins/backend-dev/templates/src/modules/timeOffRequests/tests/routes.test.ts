import { describe, expect, it } from "vitest";
import { testApp } from "@/tests/helpers/test-app";

const body = { type: "annual", from: "2026-11-03", to: "2026-11-05", reason: "trip" };

describe("timeOffRequests routes", () => {
  it("approve/reject are admin only (403), cancel is not; a user cannot see another user's request (404)", async () => {
    const { request } = testApp();
    const { data } = await (await request("/timeOffRequests", { method: "POST", body })).json();
    expect((await request(`/timeOffRequests/${data.id}/approve`, { method: "POST" })).status).toBe(403);
    expect((await request(`/timeOffRequests/${data.id}/reject`, { method: "POST" })).status).toBe(403);
    expect((await request(`/timeOffRequests/${data.id}`, { as: "other" })).status).toBe(404);
    expect((await request(`/timeOffRequests/${data.id}/cancel`, { method: "POST", as: "other" })).status).toBe(404);
    expect((await request(`/timeOffRequests/${data.id}/approve`, { method: "POST", as: "admin" })).status).toBe(200);
  });

  it("400 names the field; 409 on a bad transition with the CONFLICT code", async () => {
    const { request } = testApp();
    const bad = await request("/timeOffRequests", { method: "POST", body: { ...body, type: "holiday" } });
    expect(bad.status).toBe(400);
    expect((await bad.json()).message).toMatch(/^type:/);
    const { data } = await (await request("/timeOffRequests", { method: "POST", body })).json();
    await request(`/timeOffRequests/${data.id}/reject`, { method: "POST", as: "admin" });
    const again = await request(`/timeOffRequests/${data.id}/approve`, { method: "POST", as: "admin" });
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ code: "CONFLICT" });
  });

  it("POST 201 stores dates as UTC days and ignores client-sent status/ownerId; dates come back as ISO strings", async () => {
    const { request } = testApp();
    const res = await request("/timeOffRequests", { method: "POST", body: { ...body, from: "2026-11-03T03:00:00+07:00", status: "approved", ownerId: "evil" } });
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data).toMatchObject({ status: "pending", ownerId: "u1", from: "2026-11-02T00:00:00.000Z", to: "2026-11-05T00:00:00.000Z" });
  });

  it("list: own only for users, status filter for admins, 400 on a bad status or cursor", async () => {
    const { request } = testApp();
    await request("/timeOffRequests", { method: "POST", body });
    await request("/timeOffRequests", { method: "POST", body, as: "other" });
    expect((await (await request("/timeOffRequests")).json()).data).toHaveLength(1);
    expect((await (await request("/timeOffRequests?status=pending", { as: "admin" })).json()).data).toHaveLength(2);
    expect((await request("/timeOffRequests?status=nope", { as: "admin" })).status).toBe(400);
    expect((await request("/timeOffRequests?cursor=garbage")).status).toBe(400);
  });
});
