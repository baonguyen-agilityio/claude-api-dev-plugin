# ADR 0001 — Effect Schema and Effect programs, not Zod

Status: accepted, 2026-10-21.

## Context
The team's `tech-stack.md` for space-api lists Zod as the validation library. The space-api code uses `effect/Schema` in 20 files and `@hono/zod-openapi` in 3, and every service is an Effect program. A first draft of this plugin chose Zod to follow the document.

## Decision
Follow the code, not the document: Effect Schema for request/response DTOs and for the OpenAPI spec (through `hono-openapi`'s Standard Schema resolver), and services written as Effect programs that depend on a `Firestore` service tag.

## Consequences
- Parity with space-api's service layer, so the process skills (`fix-api-bug`, `verify-api-endpoint`) read naturally there.
- Steeper learning curve than Zod for hand-written code; the template and the generator carry the patterns so a module author rarely writes Effect from scratch.
- The stack is now the same as the team's reference plugin (`phuoc.vo/claude`, `api-backend-dev`). This plugin's value is its design doc, domain example, reproducible evals and the compatibility check, not a different stack.
- Pin `effect` to 3.x (space-api is on 3.17; 4.x changes the Schema API). Revisit when space-api moves.
