import { Schema } from "effect";

// Server-owned fields every document carries (architecture §4). Never accepted from a request body.
export const ServerFields = {
  id: Schema.String,
  ownerId: Schema.String,
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
};

// Date-only input: ISO date string -> Date at 00:00 UTC (architecture §9). "2026-10-21", "2026-10-21T03:00:00+07:00" both -> 2026-10-21T00:00:00Z.
export const UtcDate = Schema.transform(Schema.DateFromString, Schema.DateFromSelf, {
  strict: true,
  decode: (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
  encode: (d) => d,
}).annotations({ identifier: "UtcDate", jsonSchema: { type: "string", format: "date" } });
