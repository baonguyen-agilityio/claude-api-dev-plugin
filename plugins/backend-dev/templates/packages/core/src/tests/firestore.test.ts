import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Firestore, FirestoreLive, decodeCursor, encode, decode, resetTokenCache } from "../firestore";
import { TEST_ENV } from "../testing/env";

// Adapter test: stub fetch, assert the exact REST request and the status -> error mapping.
const docName = (id: string) => `projects/demo/databases/(default)/documents/timeOffRequests/${id}`;
let calls: Array<{ url: string; init: RequestInit }>;
let responses: Array<{ status: number; body: unknown }>;
const fetchStub = (async (url: string, init: RequestInit = {}) => {
  if (url.startsWith("https://oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
  calls.push({ url, init });
  const r = responses.shift() ?? { status: 200, body: {} };
  return new Response(JSON.stringify(r.body), { status: r.status });
}) as unknown as typeof fetch;

// A syntactically valid PEM (importKey is mocked, so the bytes do not matter).
const ENV = { ...TEST_ENV, FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n" };
const withLive = <A, E>(eff: Effect.Effect<A, E, Firestore>) => Effect.runPromise(Effect.either(Effect.provide(eff, FirestoreLive(ENV, fetchStub))));

beforeEach(() => { calls = []; responses = []; resetTokenCache(); vi.spyOn(crypto.subtle, "importKey").mockResolvedValue({} as CryptoKey); vi.spyOn(crypto.subtle, "sign").mockResolvedValue(new ArrayBuffer(4)); });
afterEach(() => vi.restoreAllMocks());

describe("value encoding", () => {
  it("round-trips Date as timestampValue, ints and doubles", () => {
    const d = new Date("2026-10-21T00:00:00.000Z");
    expect(encode(d)).toEqual({ timestampValue: "2026-10-21T00:00:00.000Z" });
    expect(decode(encode(d))).toEqual(d);
    expect(encode(3)).toEqual({ integerValue: "3" });
    expect(encode(2.5)).toEqual({ doubleValue: 2.5 });
    expect(decode({ integerValue: "3" })).toBe(3);
  });
});

describe("FirestoreLive", () => {
  it("update sends PATCH with updateMask for each field plus updatedAt and the exists precondition", async () => {
    responses.push({ status: 200, body: { name: docName("r1"), fields: { status: { stringValue: "approved" } } } });
    const res = await withLive(Effect.flatMap(Firestore, (db) => db.update("timeOffRequests", "r1", { status: "approved" })));
    expect(res._tag).toBe("Right");
    const { url, init } = calls[0];
    expect(init.method).toBe("PATCH");
    const u = new URL(url);
    expect(u.pathname.endsWith("/documents/timeOffRequests/r1")).toBe(true);
    expect(u.searchParams.get("currentDocument.exists")).toBe("true");
    expect(u.searchParams.getAll("updateMask.fieldPaths").sort()).toEqual(["status", "updatedAt"]);
    expect(JSON.parse(init.body as string).fields.status).toEqual({ stringValue: "approved" });
  });

  it("maps 404 to NotFound and 500 to FirestoreError", async () => {
    responses.push({ status: 404, body: {} });
    const nf = await withLive(Effect.flatMap(Firestore, (db) => db.get("timeOffRequests", "nope")));
    expect(nf._tag === "Left" && nf.left._tag).toBe("NotFound");
    responses.push({ status: 500, body: { error: "boom" } });
    const up = await withLive(Effect.flatMap(Firestore, (db) => db.get("timeOffRequests", "x")));
    expect(up._tag === "Left" && up.left._tag).toBe("FirestoreError");
  });

  it("query builds a structuredQuery with filters, order-by ending in __name__, limit+1, and pages with an opaque cursor", async () => {
    const row = (id: string) => ({ document: { name: docName(id), fields: { ownerId: { stringValue: "u1" }, createdAt: { timestampValue: `2026-10-0${id.slice(-1)}T00:00:00Z` } } } });
    responses.push({ status: 200, body: [row("r1"), row("r2"), row("r3")] });
    const res = await withLive(Effect.flatMap(Firestore, (db) => db.query("timeOffRequests", { where: [{ field: "ownerId", op: "==", value: "u1" }], orderBy: [{ field: "createdAt", dir: "desc" }], limit: 2 })));
    expect(res._tag).toBe("Right");
    const sq = JSON.parse(calls[0].init.body as string).structuredQuery;
    expect(calls[0].url.endsWith("/documents:runQuery")).toBe(true);
    expect(sq.limit).toBe(3);
    expect(sq.where.compositeFilter.filters[0].fieldFilter).toEqual({ field: { fieldPath: "ownerId" }, op: "EQUAL", value: { stringValue: "u1" } });
    expect(sq.orderBy.map((o: any) => o.field.fieldPath)).toEqual(["createdAt", "__name__"]);
    if (res._tag === "Right") {
      expect(res.right.docs.map((d) => d.id)).toEqual(["r1", "r2"]);
      const cursor = decodeCursor(res.right.nextCursor!)!;
      expect(cursor).toEqual([{ timestampValue: "2026-10-02T00:00:00Z" }, { referenceValue: docName("r2") }]);
    }
  });

  it("a cursor that does not match the order-by shape is BadRequest, not a Firestore call", async () => {
    const res = await withLive(Effect.flatMap(Firestore, (db) => db.query("timeOffRequests", { where: [], orderBy: [{ field: "createdAt", dir: "desc" }], limit: 2, cursor: "garbage" })));
    expect(res._tag === "Left" && res.left._tag).toBe("BadRequest");
    expect(calls).toHaveLength(0);
  });
});
