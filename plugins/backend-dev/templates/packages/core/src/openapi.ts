import { Schema } from "effect";
import { resolver } from "hono-openapi";
import { PageMeta } from "./pagination";

// describeRoute() helpers. Docs reuse the Effect Schemas the services decode with, so the spec cannot drift.
type S<A, I> = Schema.Schema<A, I, never>;
export const doc = <A, I>(s: S<A, I>) => resolver(Schema.standardSchemaV1(s));
const json = (description: string, schema: object) => ({ description, content: { "application/json": { schema } } });

export const jsonBody = <A, I>(s: S<A, I>) => ({ required: true, content: { "application/json": { schema: doc(s) } } });
export const dataResponse = <A, I>(description: string, s: S<A, I>) => json(description, doc(Schema.Struct({ data: s })));
export const pageResponse = <A, I>(description: string, s: S<A, I>) => json(description, doc(Schema.Struct({ data: Schema.Array(s), meta: PageMeta })));
export const noContent = (description: string) => ({ description });

export const ErrorBody = Schema.Struct({ code: Schema.String, message: Schema.String }).annotations({ identifier: "Error" });
export const errorResponse = (description: string) => json(description, doc(ErrorBody));

// Spread into protected routes (architecture §8).
export const commonResponses = { 401: errorResponse("Missing or invalid bearer token"), 502: errorResponse("Upstream (Firestore) error") };
export const badRequest = { 400: errorResponse("Invalid input") };
export const forbidden = { 403: errorResponse("Caller lacks the required role") };
export const notFound = { 404: errorResponse("Not found, or not visible to the caller") };
export const conflict = { 409: errorResponse("Invalid state transition") };

// Each app names itself; the security scheme is the same for every app.
export const documentation = (info: { title: string; version: string }) => ({
  openapi: "3.1.0",
  info,
  components: { securitySchemes: { BearerAuth: { type: "http" as const, scheme: "bearer", bearerFormat: "Firebase ID token" } } },
  security: [{ BearerAuth: [] }],
});

const SWAGGER_UI = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.33.0";
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const docsHtml = (specUrl: string, title: string) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} docs</title>
<link rel="stylesheet" href="${SWAGGER_UI}/swagger-ui.css"></head>
<body><div id="swagger-ui"></div><script src="${SWAGGER_UI}/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: ${JSON.stringify(specUrl)}, dom_id: "#swagger-ui", persistAuthorization: true });</script></body></html>`;
