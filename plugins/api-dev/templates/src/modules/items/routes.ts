import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { requireRole } from "@/core/auth";
import type { AppEnv, Run } from "@/core/run";
import { badRequest, commonResponses, dataResponse, forbidden, jsonBody, noContent, notFound, pageResponse } from "@/core/openapi";
import { validate } from "@/core/validate";
import { itemController } from "./controllers/item.controller";
import { Item } from "./models/item.model";
import { ItemListQuery, NewItem, UpdateItem } from "./schemas/item.schema";

const tags = ["items"];

// Per route: path -> describeRoute (docs) -> guards -> validate -> controller handler.
export const itemRoutes = (run: Run) => {
  const ctl = itemController(run);
  return new Hono<AppEnv>()
    .get("/", describeRoute({ tags, summary: "List items", responses: { 200: pageResponse("Items", Item), ...badRequest, ...commonResponses } }), validate("query", ItemListQuery), ctl.list)
    .get("/:id", describeRoute({ tags, summary: "Get an item", responses: { 200: dataResponse("Item", Item), ...notFound, ...commonResponses } }), ctl.get)
    .post("/", describeRoute({ tags, summary: "Create an item", requestBody: jsonBody(NewItem), responses: { 201: dataResponse("Created", Item), ...badRequest, ...commonResponses } }), ctl.create)
    .patch("/:id", describeRoute({ tags, summary: "Update some fields of an item (owner or admin)", requestBody: jsonBody(UpdateItem), responses: { 200: dataResponse("Updated", Item), ...badRequest, ...forbidden, ...notFound, ...commonResponses } }), ctl.update)
    .delete("/:id", describeRoute({ tags, summary: "Delete an item (admin only)", responses: { 204: noContent("Deleted"), ...forbidden, ...notFound, ...commonResponses } }), requireRole("admin"), ctl.remove);
};
