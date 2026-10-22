import { Schema } from "effect";
import { UtcDate } from "@/core/entity";
import { PageQuery } from "@/core/pagination";
import { MAX_SPAN_DAYS, TimeOffRequestFields, TimeOffStatus, TimeOffType } from "../models/timeOffRequest.model";

const DAY = 86_400_000;
const spanOk = (o: { from?: Date; to?: Date }) => {
  if (!o.from || !o.to) return true;
  if (o.from > o.to) return "from: must not be after to";
  if ((o.to.getTime() - o.from.getTime()) / DAY > MAX_SPAN_DAYS) return `to: span must be at most ${MAX_SPAN_DAYS} days`;
  return true;
};

export const NewTimeOffRequest = Schema.Struct(TimeOffRequestFields)
  .pipe(Schema.filter(spanOk))
  .annotations({ identifier: "NewTimeOffRequest", examples: [{ type: "annual", from: new Date("2026-11-03T00:00:00Z"), to: new Date("2026-11-05T00:00:00Z"), reason: "family trip" }] });
export type NewTimeOffRequest = typeof NewTimeOffRequest.Type;

// Schema.partial cannot wrap transformations (UtcDate), so the optional variants are spelled out.
export const UpdateTimeOffRequest = Schema.Struct({
  type: Schema.optional(TimeOffType),
  from: Schema.optional(UtcDate),
  to: Schema.optional(UtcDate),
  reason: Schema.optional(Schema.String.pipe(Schema.maxLength(500))),
})
  .pipe(Schema.filter((o) => Object.keys(o).length > 0 || "at least one field is required"), Schema.filter(spanOk))
  .annotations({ identifier: "UpdateTimeOffRequest", examples: [{ to: new Date("2026-11-06T00:00:00Z") }] });
export type UpdateTimeOffRequest = typeof UpdateTimeOffRequest.Type;

// ?status= (admin only, ignored for users), ?from=&to= date range on `from` (architecture §5).
export const TimeOffRequestListQuery = Schema.Struct({
  ...PageQuery.fields,
  status: Schema.optional(TimeOffStatus),
  from: Schema.optional(UtcDate),
  to: Schema.optional(UtcDate),
}).annotations({ identifier: "TimeOffRequestListQuery" });
export type TimeOffRequestListQuery = typeof TimeOffRequestListQuery.Type;
