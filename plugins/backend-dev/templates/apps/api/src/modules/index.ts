import type { Module } from "@app/core/run";
import { itemsModule } from "./items";
import { timeOffRequestsModule } from "./timeOffRequests";

// Module registry: app.ts mounts each at API_PREFIX + path. A module missing here typechecks and 404s.
export const modules: readonly Module[] = [itemsModule, timeOffRequestsModule];
