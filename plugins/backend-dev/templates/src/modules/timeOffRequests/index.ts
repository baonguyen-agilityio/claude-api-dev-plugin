import type { Module } from "@/core/run";
import { timeOffRequestRoutes } from "./routes";

export const timeOffRequestsModule: Module = { path: "/timeOffRequests", routes: timeOffRequestRoutes };
