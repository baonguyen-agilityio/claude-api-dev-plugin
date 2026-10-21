import { Context, Effect, Layer } from "effect";
import { BadRequest, FirestoreError, NotFound } from "./errors";

// Worker bindings and vars (architecture §7).
export type Env = {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  CORS_ORIGINS?: string;
  API_LIMITER?: { limit: (opts: { key: string }) => Promise<{ success: boolean }> };
};

export type Doc = Record<string, unknown> & { id: string; createdAt: Date; updatedAt: Date };
export type FsError = NotFound | FirestoreError;
export type Direction = "asc" | "desc";
export type Where = { field: string; op: "==" | "<" | "<=" | ">" | ">="; value: unknown };
export type OrderBy = { field: string; dir: Direction };
export type ListOptions = { limit: number; cursor?: string };
export type QueryOptions = { where: Where[]; orderBy: OrderBy[]; limit: number; cursor?: string };
export type ListResult = { docs: Doc[]; nextCursor?: string };

// The only way a service reaches data (architecture §3). Tests swap in makeFakeFirestore().
export class Firestore extends Context.Tag("Firestore")<
  Firestore,
  {
    list: (col: string, opts: ListOptions) => Effect.Effect<ListResult, FsError | BadRequest>;
    query: (col: string, opts: QueryOptions) => Effect.Effect<ListResult, FsError | BadRequest>;
    get: (col: string, id: string) => Effect.Effect<Doc, FsError>;
    create: (col: string, data: Record<string, unknown>) => Effect.Effect<Doc, FsError>;
    update: (col: string, id: string, data: Record<string, unknown>) => Effect.Effect<Doc, FsError>;
    remove: (col: string, id: string) => Effect.Effect<void, FsError>;
  }
>() {}

// --- Firestore REST value encoding (architecture §3: Date <-> timestampValue) ---
type Value = Record<string, any>;

export const encode = (v: unknown): Value => {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  if (typeof v === "object") return { mapValue: { fields: toFields(v as Record<string, unknown>) } };
  throw new Error(`cannot encode ${typeof v}`);
};

export const decode = (v: Value): unknown => {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return new Date(v.timestampValue);
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(decode);
  if ("mapValue" in v) return fromFields(v.mapValue.fields ?? {});
  return null;
};

export const toFields = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, encode(v)]));
export const fromFields = (f: Record<string, Value>) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, decode(v)]));

const toDoc = (d: { name: string; fields?: Record<string, Value> }): Doc =>
  ({ id: d.name.split("/").pop()!, ...fromFields(d.fields ?? {}) }) as Doc;

// --- Cursor for :runQuery pages: the last document's order-by values plus its name, base64url (opaque to clients) ---
const b64url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));
export const encodeCursor = (values: Value[]) => b64url(JSON.stringify(values));
export const decodeCursor = (cursor: string): Value[] | null => {
  try {
    const v = JSON.parse(unb64url(cursor));
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
};

// --- Service-account access token: RS256 JWT signed with WebCrypto, exchanged at Google's OAuth endpoint.
// Per-isolate cache; a cold isolate fetches a new token. Shared cache (KV) only if token volume becomes a problem.
let cached: { token: string; exp: number } | undefined;
const b64 = (data: string | ArrayBuffer) =>
  b64url(typeof data === "string" ? data : String.fromCharCode(...new Uint8Array(data)));

export async function accessToken(env: Env, fetchFn: typeof fetch = fetch): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;
  const pem = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"); // secrets often store "\n" literally
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const claims = { iss: env.FIREBASE_CLIENT_EMAIL, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
  const unsigned = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(JSON.stringify(claims))}`;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const res = await fetchFn("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64(sig)}` }),
  });
  if (!res.ok) throw new Error(`oauth token ${res.status}`);
  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: access_token, exp: now + expires_in };
  return access_token;
}
export const resetTokenCache = () => { cached = undefined; };

// --- REST adapter ---
const base = (env: Env) => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const docName = (env: Env, col: string, id: string) => `${base(env).replace("https://firestore.googleapis.com/v1/", "")}/${col}/${encodeURIComponent(id)}`;

const call = (env: Env, path: string, init: RequestInit = {}, fetchFn: typeof fetch = fetch) =>
  Effect.tryPromise({
    try: async () => {
      const res = await fetchFn(`${base(env)}${path}`, {
        ...init,
        headers: { authorization: `Bearer ${await accessToken(env, fetchFn)}`, "content-type": "application/json" },
      });
      return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
    },
    catch: (e) => new FirestoreError({ status: 0, message: String(e) }),
  }).pipe(
    Effect.flatMap(({ status, body }): Effect.Effect<any, FsError> =>
      status === 404 ? Effect.fail(new NotFound({ what: path }))
      : status >= 400 ? Effect.fail(new FirestoreError({ status, message: JSON.stringify(body).slice(0, 500) }))
      : Effect.succeed(body),
    ),
  );

const invalidCursor = <A, E extends FsError>(hasCursor: boolean) => (eff: Effect.Effect<A, E>) =>
  Effect.catchIf(eff, (e) => hasCursor && e._tag === "FirestoreError" && e.status === 400, () => Effect.fail(new BadRequest({ message: "Invalid cursor" })));

export const FirestoreLive = (env: Env, fetchFn: typeof fetch = fetch) =>
  Layer.succeed(Firestore, {
    list: (col, { limit, cursor }) => {
      const qs = new URLSearchParams({ pageSize: String(limit) });
      if (cursor) qs.set("pageToken", cursor);
      return call(env, `/${col}?${qs}`, {}, fetchFn).pipe(
        Effect.map((b): ListResult => ({ docs: (b.documents ?? []).map(toDoc), nextCursor: b.nextPageToken || undefined })),
        invalidCursor(cursor !== undefined),
      );
    },
    // Structured query (architecture §5). __name__ is always the last order-by so cursors are unique.
    query: (col, { where, orderBy, limit, cursor }) => {
      const order = [...orderBy, { field: "__name__", dir: orderBy.at(-1)?.dir ?? "asc" }];
      const sq: Record<string, unknown> = {
        from: [{ collectionId: col }],
        orderBy: order.map((o) => ({ field: { fieldPath: o.field }, direction: o.dir === "asc" ? "ASCENDING" : "DESCENDING" })),
        limit: limit + 1, // one extra row tells us whether a next page exists
      };
      if (where.length) {
        const ops = { "==": "EQUAL", "<": "LESS_THAN", "<=": "LESS_THAN_OR_EQUAL", ">": "GREATER_THAN", ">=": "GREATER_THAN_OR_EQUAL" } as const;
        sq.where = { compositeFilter: { op: "AND", filters: where.map((w) => ({ fieldFilter: { field: { fieldPath: w.field }, op: ops[w.op], value: encode(w.value) } })) } };
      }
      if (cursor !== undefined) {
        const values = decodeCursor(cursor);
        if (!values || values.length !== order.length) return Effect.fail(new BadRequest({ message: "Invalid cursor" }));
        sq.startAt = { values, before: false };
      }
      return call(env, ":runQuery", { method: "POST", body: JSON.stringify({ structuredQuery: sq }) }, fetchFn).pipe(
        Effect.map((rows: Array<{ document?: { name: string; fields?: Record<string, Value> } }>): ListResult => {
          const raw = rows.filter((r) => r.document).map((r) => r.document!);
          const pageRows = raw.slice(0, limit);
          const docs = pageRows.map(toDoc);
          if (raw.length <= limit) return { docs };
          const last = pageRows.at(-1)!;
          const values = orderBy.map((o) => last.fields?.[o.field] ?? { nullValue: null });
          values.push({ referenceValue: last.name });
          return { docs, nextCursor: encodeCursor(values) };
        }),
        invalidCursor(cursor !== undefined),
      );
    },
    get: (col, id) => call(env, `/${col}/${encodeURIComponent(id)}`, {}, fetchFn).pipe(Effect.map(toDoc)),
    create: (col, data) => {
      const now = new Date();
      return call(env, `/${col}`, { method: "POST", body: JSON.stringify({ fields: toFields({ ...data, createdAt: now, updatedAt: now }) }) }, fetchFn).pipe(Effect.map(toDoc));
    },
    // updateMask limits the write to the sent fields; currentDocument.exists=true turns a missing doc into 404, never an upsert.
    update: (col, id, data) => {
      const patch = { ...data, updatedAt: new Date() };
      const qs = new URLSearchParams({ "currentDocument.exists": "true" });
      for (const field of Object.keys(patch)) qs.append("updateMask.fieldPaths", field);
      return call(env, `/${col}/${encodeURIComponent(id)}?${qs}`, { method: "PATCH", body: JSON.stringify({ fields: toFields(patch) }) }, fetchFn).pipe(Effect.map(toDoc));
    },
    remove: (col, id) => call(env, `/${col}/${encodeURIComponent(id)}?currentDocument.exists=true`, { method: "DELETE" }, fetchFn).pipe(Effect.asVoid),
  });

export { docName };
