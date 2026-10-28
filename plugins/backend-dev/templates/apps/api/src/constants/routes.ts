// Every route lives under this prefix (app.ts uses it as the Hono basePath). Architecture §1.
export const API_PREFIX = "/api/v1";

// Exact paths that skip authMiddleware. Everything else needs a valid Bearer token.
export const PUBLIC_ROUTES: readonly string[] = [`${API_PREFIX}/health`, `${API_PREFIX}/docs`, `${API_PREFIX}/openapi.json`];

// This app's name and version in the OpenAPI spec and the docs page; rename with the package.
export const API_INFO = { title: "my-api", version: "0.1.0" };
