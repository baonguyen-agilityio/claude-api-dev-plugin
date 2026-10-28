import { Data } from "effect";

// Tagged errors raised by services; core/run.ts maps each tag to a status and body (architecture §8).
// A new failure: add it here, to AppError in run.ts, and to toErrorResponse. TypeScript then forces the mapping.
export class BadRequest extends Data.TaggedError("BadRequest")<{ message: string }> {}
export class Forbidden extends Data.TaggedError("Forbidden")<{ message: string }> {}
export class NotFound extends Data.TaggedError("NotFound")<{ what: string }> {}
export class Conflict extends Data.TaggedError("Conflict")<{ message: string }> {}
export class FirestoreError extends Data.TaggedError("FirestoreError")<{ status: number; message: string }> {}

export type ErrorBody = { code: string; message: string };
export const errorBody = (code: string, message: string): ErrorBody => ({ code, message });
