import { Effect, Schema } from "effect";
import { isAdmin, type AuthUser } from "@app/core/auth";
import { Conflict, NotFound } from "@app/core/errors";
import { Firestore, type Doc, type OrderBy, type Where } from "@app/core/firestore";
import { page } from "@app/core/pagination";
import { COLLECTION, type TimeOffStatus } from "../models/timeOffRequest.model";
import { NewTimeOffRequest, UpdateTimeOffRequest, type TimeOffRequestListQuery } from "../schemas/timeOffRequest.schema";

// Users see their own requests; admins see all, optionally filtered by status. A date range filters on `from`
// and must then also order by `from` (architecture §5).
export const listTimeOffRequests = (user: AuthUser, q: TimeOffRequestListQuery) =>
  Effect.gen(function* () {
    const where: Where[] = isAdmin(user)
      ? (q.status ? [{ field: "status", op: "==", value: q.status }] : [])
      : [{ field: "ownerId", op: "==", value: user.uid }];
    const ranged = q.from !== undefined || q.to !== undefined;
    if (q.from) where.push({ field: "from", op: ">=", value: q.from });
    if (q.to) where.push({ field: "from", op: "<=", value: q.to });
    const orderBy: OrderBy[] = ranged ? [{ field: "from", dir: "asc" }] : [{ field: "createdAt", dir: "desc" }];
    const db = yield* Firestore;
    const { docs, nextCursor } = yield* db.query(COLLECTION, { where, orderBy, limit: q.limit, cursor: q.cursor });
    return page(docs, q.limit, nextCursor);
  });

// Another user's record is 404, not 403, so ids cannot be enumerated (architecture §6).
const visible = (user: AuthUser, id: string) =>
  Effect.gen(function* () {
    const db = yield* Firestore;
    const doc = yield* db.get(COLLECTION, id);
    if (doc.ownerId !== user.uid && !isAdmin(user)) return yield* new NotFound({ what: `${COLLECTION}/${id}` });
    return doc;
  });

const requireStatus = (doc: Doc, allowed: TimeOffStatus[], action: string) =>
  allowed.includes(doc.status as TimeOffStatus) ? Effect.succeed(doc) : Effect.fail(new Conflict({ message: `cannot ${action} a ${doc.status} request` }));

export const getTimeOffRequest = (user: AuthUser, id: string) => visible(user, id);

export const createTimeOffRequest = (user: AuthUser, body: unknown) =>
  Effect.gen(function* () {
    const data = yield* Schema.decodeUnknown(NewTimeOffRequest)(body);
    const db = yield* Firestore;
    return yield* db.create(COLLECTION, { ...data, ownerId: user.uid, status: "pending", decidedBy: null, decidedAt: null });
  });

// Only pending requests may be edited, by their owner (or an admin).
export const updateTimeOffRequest = (user: AuthUser, id: string, body: unknown) =>
  Effect.gen(function* () {
    const data = yield* Schema.decodeUnknown(UpdateTimeOffRequest)(body);
    const current = yield* visible(user, id);
    yield* requireStatus(current, ["pending"], "edit");
    const merged = { from: current.from as Date, to: current.to as Date, ...data };
    if (merged.from > merged.to) return yield* new Conflict({ message: "from must not be after to" });
    const db = yield* Firestore;
    return yield* db.update(COLLECTION, id, data);
  });

const decide = (status: "approved" | "rejected") => (admin: AuthUser, id: string) =>
  Effect.gen(function* () {
    const db = yield* Firestore;
    const current = yield* db.get(COLLECTION, id);
    yield* requireStatus(current, ["pending"], status.slice(0, -1));
    return yield* db.update(COLLECTION, id, { status, decidedBy: admin.uid, decidedAt: new Date() });
  });
export const approveTimeOffRequest = decide("approved");
export const rejectTimeOffRequest = decide("rejected");

// Owner (or admin) cancels a pending request, or an approved one whose first day is still in the future.
export const cancelTimeOffRequest = (user: AuthUser, id: string, now: Date = new Date()) =>
  Effect.gen(function* () {
    const current = yield* visible(user, id);
    yield* requireStatus(current, ["pending", "approved"], "cancel");
    if (current.status === "approved" && (current.from as Date) <= now) return yield* new Conflict({ message: "cannot cancel an approved request that has started" });
    const db = yield* Firestore;
    return yield* db.update(COLLECTION, id, { status: "cancelled" });
  });
