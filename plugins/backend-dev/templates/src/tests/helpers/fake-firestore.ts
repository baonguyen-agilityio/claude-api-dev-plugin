import { Effect, Layer } from "effect";
import { BadRequest, NotFound } from "@/core/errors";
import { Firestore, type Doc, type Where } from "@/core/firestore";

// In-memory Firestore: no network or credentials. Keys are "col/id"; ids are "0001", "0002", ...
// list() orders by id; query() applies where/orderBy/limit; the cursor is the last document's id.
export function makeFakeFirestore() {
  const store = new Map<string, Doc>();
  let seq = 0;
  const key = (col: string, id: string) => `${col}/${id}`;
  const missing = (col: string, id: string) => Effect.fail(new NotFound({ what: key(col, id) }));
  const inCol = (col: string) => [...store].filter(([k]) => k.startsWith(`${col}/`)).map(([, d]) => d);
  const cmp = (a: unknown, b: unknown) => {
    const x = a instanceof Date ? a.getTime() : (a as any);
    const y = b instanceof Date ? b.getTime() : (b as any);
    return x < y ? -1 : x > y ? 1 : 0;
  };
  const matches = (d: Doc, w: Where) => {
    const c = cmp(d[w.field], w.value);
    return { "==": c === 0, "<": c < 0, "<=": c <= 0, ">": c > 0, ">=": c >= 0 }[w.op];
  };
  const paginate = (all: Doc[], limit: number, cursor?: string) => {
    let start = 0;
    if (cursor !== undefined) {
      const i = all.findIndex((d) => d.id === cursor);
      if (i < 0) return Effect.fail(new BadRequest({ message: "Invalid cursor" }));
      start = i + 1;
    }
    const docs = all.slice(start, start + limit);
    return Effect.succeed({ docs, nextCursor: start + docs.length < all.length ? docs.at(-1)?.id : undefined });
  };

  const layer = Layer.succeed(Firestore, {
    list: (col, { limit, cursor }) => paginate(inCol(col).sort((a, b) => a.id.localeCompare(b.id)), limit, cursor),
    query: (col, { where, orderBy, limit, cursor }) => {
      const rows = inCol(col).filter((d) => where.every((w) => matches(d, w)));
      rows.sort((a, b) => {
        for (const o of orderBy) {
          const c = cmp(a[o.field], b[o.field]);
          if (c !== 0) return o.dir === "asc" ? c : -c;
        }
        // Tie-break on id in the direction of the last order-by, like the adapter's trailing __name__.
        const c = a.id.localeCompare(b.id);
        return orderBy.at(-1)?.dir === "desc" ? -c : c;
      });
      return paginate(rows, limit, cursor);
    },
    get: (col, id) => { const d = store.get(key(col, id)); return d ? Effect.succeed(d) : missing(col, id); },
    create: (col, data) => {
      const now = new Date();
      const d = { ...data, id: String(++seq).padStart(4, "0"), createdAt: now, updatedAt: now } as Doc;
      store.set(key(col, d.id), d);
      return Effect.succeed(d);
    },
    update: (col, id, data) => {
      const d = store.get(key(col, id));
      if (!d) return missing(col, id);
      const next = { ...d, ...data, id, updatedAt: new Date() } as Doc;
      store.set(key(col, id), next);
      return Effect.succeed(next);
    },
    remove: (col, id) => (store.delete(key(col, id)) ? Effect.void : missing(col, id)),
  });
  return { store, layer };
}
export type Fake = ReturnType<typeof makeFakeFirestore>;
