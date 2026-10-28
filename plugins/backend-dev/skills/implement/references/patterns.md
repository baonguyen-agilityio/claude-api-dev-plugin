# Patterns, as the template writes them

## Model: writable fields, server fields, entity
```ts
export const COLLECTION = "timeOffRequests";
export const TimeOffStatus = Schema.Literal("pending", "approved", "rejected", "cancelled");
export const TimeOffRequestFields = { type: TimeOffType, from: UtcDate, to: UtcDate, reason: Schema.optionalWith(Schema.String.pipe(Schema.maxLength(500)), { default: () => "" }) };
export const TimeOffRequestServerFields = { status: TimeOffStatus, decidedBy: Schema.NullOr(Schema.String), decidedAt: Schema.NullOr(Schema.DateFromString) };
export const QUERY_FIELDS = ["ownerId", "status", "from", "createdAt"] as const;   // the only fields a query may filter or order by
export const TimeOffRequest = Schema.Struct({ ...ServerFields, ...TimeOffRequestFields, ...TimeOffRequestServerFields }).annotations({ identifier: "TimeOffRequest" });
```

## Schemas: DTOs without server fields; partial spelled out
```ts
export const NewTimeOffRequest = Schema.Struct(TimeOffRequestFields).pipe(Schema.filter(spanOk)).annotations({ identifier: "NewTimeOffRequest", examples: [...] });
// Schema.partial cannot wrap transformations (UtcDate), so the optional variants are spelled out.
export const UpdateTimeOffRequest = Schema.Struct({ type: Schema.optional(TimeOffType), from: Schema.optional(UtcDate), to: Schema.optional(UtcDate), reason: Schema.optional(Schema.String.pipe(Schema.maxLength(500))) })
  .pipe(Schema.filter((o) => Object.keys(o).length > 0 || "at least one field is required"), Schema.filter(spanOk));
export const TimeOffRequestListQuery = Schema.Struct({ ...PageQuery.fields, status: Schema.optional(TimeOffStatus), from: Schema.optional(UtcDate), to: Schema.optional(UtcDate) });
```

## Service: decode in the service, ownership → 404, state → Conflict
```ts
const visible = (user: AuthUser, id: string) => Effect.gen(function* () {
  const db = yield* Firestore;
  const doc = yield* db.get(COLLECTION, id);
  if (doc.ownerId !== user.uid && !isAdmin(user)) return yield* new NotFound({ what: `${COLLECTION}/${id}` });   // 404, not 403: existence is not leaked
  return doc;
});
const requireStatus = (doc: Doc, allowed: TimeOffStatus[], action: string) =>
  allowed.includes(doc.status as TimeOffStatus) ? Effect.succeed(doc) : Effect.fail(new Conflict({ message: `cannot ${action} a ${doc.status} request` }));

export const createTimeOffRequest = (user: AuthUser, body: unknown) => Effect.gen(function* () {
  const data = yield* Schema.decodeUnknown(NewTimeOffRequest)(body);          // 400 "field: reason"
  const db = yield* Firestore;
  return yield* db.create(COLLECTION, { ...data, ownerId: user.uid, status: "pending", decidedBy: null, decidedAt: null });   // server fields after the spread
});
const decide = (status: "approved" | "rejected") => (admin: AuthUser, id: string) => Effect.gen(function* () {
  const db = yield* Firestore;
  const current = yield* db.get(COLLECTION, id);
  yield* requireStatus(current, ["pending"], status.slice(0, -1));
  return yield* db.update(COLLECTION, id, { status, decidedBy: admin.uid, decidedAt: new Date() });   // read-then-update: two callers can both win; add a precondition when the contract needs one winner
});
```
A list with filters: build `where: Where[]` from the query, pick `orderBy` (the range field leads, else `createdAt desc`), `db.query(COLLECTION, { where, orderBy, limit, cursor })`, return `page(docs, limit, nextCursor)`. Each (where, orderBy) shape has a composite in `firestore.indexes.json`.

## When the contract asks for If-Match or an Idempotency-Key
- **ETag / If-Match:** the adapter returns the Firestore document's `updateTime` with the entity; the controller sends it as `ETag`; the service passes the request's `If-Match` value to `update(col, id, data, { ifUpdateTime })`, which adds `currentDocument.updateTime=<value>` to the `PATCH`. Firestore rejects a stale value (verify the exact REST status on a dev project); map it to a `PreconditionFailed` tagged error → 412. Add the error to `packages/core/src/errors.ts`, `AppError` and `toErrorResponse`, and an adapter test for the query string.
- **Idempotency-Key:** derive the document id from the caller's uid and the key and create with `currentDocument.exists=false`; on `ALREADY_EXISTS`, read the document: same body → return it with 201, different body → `Conflict`. A route test sends the same key twice and asserts one record.

## Controller: pick the status, nothing else
```ts
const body = (c: Ctx) => c.req.json().catch(() => null);
export const timeOffRequestController = (run: Run) => ({
  list: (c: WithQuery<TimeOffRequestListQuery>) => run(c, service.listTimeOffRequests(c.get("user"), c.req.valid("query"))),
  create: async (c: Ctx) => run(c, service.createTimeOffRequest(c.get("user"), await body(c)), 201),
  approve: (c: WithId) => run(c, service.approveTimeOffRequest(c.get("user"), c.req.param("id"))),
});
```

## Route: describeRoute → guard → validate → handler
```ts
.get("/", describeRoute({ tags, summary: "List (own; admins see all)", responses: { 200: pageResponse("Requests", TimeOffRequest), ...badRequest, ...commonResponses } }), validate("query", TimeOffRequestListQuery), ctl.list)
.post("/:id/approve", describeRoute({ tags, summary: "Approve (admin only)", responses: { 200: entity("Approved"), ...forbidden, ...notFound, ...conflict, ...commonResponses } }), requireRole("admin"), ctl.approve)
```
`index.ts`: `export const timeOffRequestsModule: Module = { path: "/timeOffRequests", routes: timeOffRequestRoutes };` and the registry `apps/api/src/modules/index.ts`.

## Errors: a new failure is a new tagged error, mapped once
`packages/core/src/errors.ts`: `export class Conflict extends Data.TaggedError("Conflict")<{ message: string }> {}` → add to `AppError` and `toErrorResponse` in `packages/core/src/run.ts`; the switch is exhaustive, so a missing case fails typecheck.

## Tests
Route (`testApp().request(path, { method, body, as: "other" | "admin" })`): the 403/404 case first, then 400 (`message` matches `/^field:/`), 409 with `{ code: "CONFLICT" }`, 201 with the entity, a body carrying `status`/`ownerId` ignored, a `+07:00` date truncated to the UTC day.
Service (`run(fake, program)` / `fail(fake, program)` with `makeFakeFirestore()`): each tagged error by `_tag`, and `fake.store.size` unchanged after a failure.
Adapter (`packages/core/src/tests/firestore.test.ts`): the exact REST request (`updateMask`, `currentDocument`) and the status → error mapping, with a stubbed `fetch`.
