import type { Module } from "@app/core/run";
import { itemRoutes } from "./routes";

export const itemsModule: Module = { path: "/items", routes: itemRoutes };
