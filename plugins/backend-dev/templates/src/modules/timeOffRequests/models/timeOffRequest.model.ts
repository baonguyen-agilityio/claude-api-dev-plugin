import { Schema } from "effect";
import { ServerFields, UtcDate } from "@/core/entity";

export const COLLECTION = "timeOffRequests";
export const MAX_SPAN_DAYS = 30;

export const TimeOffType = Schema.Literal("annual", "sick", "unpaid");
export const TimeOffStatus = Schema.Literal("pending", "approved", "rejected", "cancelled");
export type TimeOffStatus = typeof TimeOffStatus.Type;

// Fields a client may write (architecture §4).
export const TimeOffRequestFields = {
  type: TimeOffType,
  from: UtcDate,
  to: UtcDate,
  reason: Schema.optionalWith(Schema.String.pipe(Schema.maxLength(500)), { default: () => "" }),
};

// Fields only the server writes.
export const TimeOffRequestServerFields = {
  status: TimeOffStatus,
  decidedBy: Schema.NullOr(Schema.String),
  decidedAt: Schema.NullOr(Schema.DateFromString),
};

// Field names a list query may filter or order by; the adapter never takes these from the caller (rules/security.md).
export const QUERY_FIELDS = ["ownerId", "status", "from", "createdAt"] as const;

export const TimeOffRequest = Schema.Struct({ ...ServerFields, ...TimeOffRequestFields, ...TimeOffRequestServerFields }).annotations({ identifier: "TimeOffRequest" });
export type TimeOffRequest = typeof TimeOffRequest.Type;
