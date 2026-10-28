import { describe, expect, it } from "vitest";
import { approveTimeOffRequest, cancelTimeOffRequest, createTimeOffRequest, getTimeOffRequest, listTimeOffRequests, rejectTimeOffRequest, updateTimeOffRequest } from "../services/timeOffRequest.service";
import { makeFakeFirestore } from "@app/core/testing/fake-firestore";
import { USERS, fail, run } from "@/tests/helpers/test-app";

const body = (over: Record<string, unknown> = {}) => ({ type: "annual", from: "2026-11-03", to: "2026-11-05", reason: "trip", ...over });

describe("timeOffRequest service", () => {
  it("create: pending, owner from the caller, dates truncated to UTC days, server fields ignored", async () => {
    const fake = makeFakeFirestore();
    const r = await run(fake, createTimeOffRequest(USERS.user, body({ from: "2026-11-03T03:00:00+07:00", status: "approved", ownerId: "evil" })));
    expect(r).toMatchObject({ status: "pending", ownerId: "u1", decidedBy: null, decidedAt: null, type: "annual" });
    expect((r.from as Date).toISOString()).toBe("2026-11-02T00:00:00.000Z"); // +07:00 03:00 on the 3rd is the 2nd in UTC
    expect((r.to as Date).toISOString()).toBe("2026-11-05T00:00:00.000Z");
  });

  it("create rejects from > to, a span over 30 days and an unknown type, writing nothing", async () => {
    const fake = makeFakeFirestore();
    for (const b of [body({ from: "2026-11-06" }), body({ to: "2026-12-10" }), body({ type: "holiday" })]) {
      expect((await fail(fake, createTimeOffRequest(USERS.user, b)))._tag).toBe("ParseError");
    }
    expect(fake.store.size).toBe(0);
  });

  it("get: owner and admin see it; another user gets NotFound, not Forbidden", async () => {
    const fake = makeFakeFirestore();
    const { id } = await run(fake, createTimeOffRequest(USERS.user, body()));
    expect((await run(fake, getTimeOffRequest(USERS.user, id))).id).toBe(id);
    expect((await run(fake, getTimeOffRequest(USERS.admin, id))).id).toBe(id);
    expect((await fail(fake, getTimeOffRequest(USERS.other, id)))._tag).toBe("NotFound");
  });

  it("state machine: approve/reject only pending; cancel pending or future approved; everything else Conflict", async () => {
    const fake = makeFakeFirestore();
    const { id } = await run(fake, createTimeOffRequest(USERS.user, body()));
    const approved = await run(fake, approveTimeOffRequest(USERS.admin, id));
    expect(approved).toMatchObject({ status: "approved", decidedBy: "a1" });
    expect(approved.decidedAt).toBeInstanceOf(Date);
    expect((await fail(fake, approveTimeOffRequest(USERS.admin, id)))._tag).toBe("Conflict");
    expect((await fail(fake, rejectTimeOffRequest(USERS.admin, id)))._tag).toBe("Conflict");
    expect((await fail(fake, updateTimeOffRequest(USERS.user, id, { reason: "x" })))._tag).toBe("Conflict");
    // approved and already started: cannot cancel
    expect((await fail(fake, cancelTimeOffRequest(USERS.user, id, new Date("2026-11-04T00:00:00Z"))))._tag).toBe("Conflict");
    // approved and in the future: owner may cancel
    expect((await run(fake, cancelTimeOffRequest(USERS.user, id, new Date("2026-10-01T00:00:00Z")))).status).toBe("cancelled");
    expect((await fail(fake, cancelTimeOffRequest(USERS.user, id)))._tag).toBe("Conflict");
  });

  it("update: only pending, owner only (other user 404), keeps from <= to across the merge", async () => {
    const fake = makeFakeFirestore();
    const { id } = await run(fake, createTimeOffRequest(USERS.user, body()));
    expect((await fail(fake, updateTimeOffRequest(USERS.other, id, { reason: "x" })))._tag).toBe("NotFound");
    expect((await fail(fake, updateTimeOffRequest(USERS.user, id, { to: "2026-11-01" })))._tag).toBe("Conflict");
    expect((await run(fake, updateTimeOffRequest(USERS.user, id, { to: "2026-11-06" }))).to).toEqual(new Date("2026-11-06T00:00:00Z"));
  });

  it("list: users see their own newest first; admins filter by status; a date range orders by from and pages", async () => {
    const fake = makeFakeFirestore();
    await run(fake, createTimeOffRequest(USERS.user, body({ from: "2026-11-10", to: "2026-11-10" })));
    await run(fake, createTimeOffRequest(USERS.user, body({ from: "2026-11-01", to: "2026-11-01" })));
    await run(fake, createTimeOffRequest(USERS.other, body({ from: "2026-11-05", to: "2026-11-05" })));
    const mine = await run(fake, listTimeOffRequests(USERS.user, { limit: 20 }));
    expect(mine.data.map((d) => d.ownerId)).toEqual(["u1", "u1"]);
    expect(mine.data[0].id > mine.data[1].id).toBe(true); // newest first
    const all = await run(fake, listTimeOffRequests(USERS.admin, { limit: 20, status: "pending" }));
    expect(all.data).toHaveLength(3);
    const ranged = await run(fake, listTimeOffRequests(USERS.admin, { limit: 2, from: new Date("2026-11-01T00:00:00Z"), to: new Date("2026-11-30T00:00:00Z") }));
    expect(ranged.data.map((d) => (d.from as Date).toISOString().slice(0, 10))).toEqual(["2026-11-01", "2026-11-05"]);
    const next = await run(fake, listTimeOffRequests(USERS.admin, { limit: 2, from: new Date("2026-11-01T00:00:00Z"), to: new Date("2026-11-30T00:00:00Z"), cursor: ranged.meta.pagination.cursor }));
    expect(next.data.map((d) => (d.from as Date).toISOString().slice(0, 10))).toEqual(["2026-11-10"]);
    expect(next.meta.pagination.cursor).toBeUndefined();
  });
});
