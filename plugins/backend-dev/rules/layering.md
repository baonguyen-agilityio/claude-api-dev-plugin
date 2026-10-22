# Layering

Applies to every skill. The design is `${CLAUDE_PLUGIN_ROOT}/references/architecture.md`; this file only says how to use it.

- Layout, layers and what each may import: architecture §2. Read the closest existing module before adding one. If the project's own `CLAUDE.md` describes a different layout, it wins; say so in the Result block.
- `core/` already owns the envelope and error mapping (`run`), auth (`authMiddleware`, `requireRole`), query validation (`validate`), pagination, the `Firestore` tag and the OpenAPI helpers. A handler that calls `c.json` itself, a second auth check, or a `fetch` to Firestore from a service is drift; for auth it is a security bug.
- The middleware chain and its order: architecture §1. A route mounted on another Hono instance, or a middleware placed before auth, bypasses what every handler assumes.
- The response is a contract. Additive changes are safe; renaming, removing or retyping a field is breaking: find the consumers, or ask who they are. `describeRoute` changes in the same commit as the response.
