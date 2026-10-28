import { Schema } from "effect";
import { validator } from "hono-openapi";
import { errorBody } from "./errors";
import { issueMessage } from "./run";

// Query/param/header validation in the route: documents the parameters and answers 400 { code, message }.
// JSON bodies are decoded in services instead, so service tests cover their rules (architecture §2).
export const validate = <T extends "query" | "param" | "header", A, I>(target: T, schema: Schema.Schema<A, I, never>) =>
  validator(target, Schema.standardSchemaV1(schema), (result, c) => {
    if (!result.success) {
      const [first] = result.error;
      return c.json(errorBody("BAD_REQUEST", first ? issueMessage(first) : "Invalid request"), 400);
    }
  });
