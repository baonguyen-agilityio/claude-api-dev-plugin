import type { Module } from "@app/core/run";
import { timeOffRequestRoutes } from "./routes";

export const timeOffRequestsModule: Module = { path: "/timeOffRequests", routes: timeOffRequestRoutes };
