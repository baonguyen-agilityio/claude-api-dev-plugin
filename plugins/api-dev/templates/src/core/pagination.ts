import { Schema } from "effect";

// List contract (architecture §5): ?limit=1..100 (default 20) and an opaque cursor.
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export const PageQuery = Schema.Struct({
  limit: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, MAX_LIMIT)).annotations({
      message: () => `limit must be an integer between 1 and ${MAX_LIMIT}`,
    }),
    { default: () => DEFAULT_LIMIT },
  ),
  cursor: Schema.optional(Schema.String),
});
export type PageQuery = typeof PageQuery.Type;

export type Page<A> = { data: readonly A[]; meta: { pagination: { limit: number; cursor?: string } } };
export const page = <A>(data: readonly A[], limit: number, cursor?: string): Page<A> => ({
  data,
  meta: { pagination: { limit, ...(cursor ? { cursor } : {}) } },
});

export const PageMeta = Schema.Struct({
  pagination: Schema.Struct({ limit: Schema.Number, cursor: Schema.optional(Schema.String) }),
}).annotations({ identifier: "PageMeta" });

export const isPage = (v: unknown): v is Page<unknown> =>
  typeof v === "object" && v !== null && "data" in v && "meta" in v;
