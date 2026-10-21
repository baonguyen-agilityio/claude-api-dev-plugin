import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { requireRole } from "@/core/auth";
import type { AppEnv, Run } from "@/core/run";
import { badRequest, commonResponses, conflict, dataResponse, forbidden, jsonBody, notFound, pageResponse } from "@/core/openapi";
import { validate } from "@/core/validate";
import { timeOffRequestController } from "./controllers/timeOffRequest.controller";
import { TimeOffRequest } from "./models/timeOffRequest.model";
import { NewTimeOffRequest, TimeOffRequestListQuery, UpdateTimeOffRequest } from "./schemas/timeOffRequest.schema";

const tags = ["timeOffRequests"];
const entity = (d: string) => dataResponse(d, TimeOffRequest);

export const timeOffRequestRoutes = (run: Run) => {
  const ctl = timeOffRequestController(run);
  return new Hono<AppEnv>()
    .get("/", describeRoute({ tags, summary: "List time-off requests (own; admins see all)", responses: { 200: pageResponse("Requests", TimeOffRequest), ...badRequest, ...commonResponses } }), validate("query", TimeOffRequestListQuery), ctl.list)
    .get("/:id", describeRoute({ tags, summary: "Get a request (owner or admin)", responses: { 200: entity("Request"), ...notFound, ...commonResponses } }), ctl.get)
    .post("/", describeRoute({ tags, summary: "Create a pending request", requestBody: jsonBody(NewTimeOffRequest), responses: { 201: entity("Created"), ...badRequest, ...commonResponses } }), ctl.create)
    .patch("/:id", describeRoute({ tags, summary: "Edit a pending request (owner or admin)", requestBody: jsonBody(UpdateTimeOffRequest), responses: { 200: entity("Updated"), ...badRequest, ...notFound, ...conflict, ...commonResponses } }), ctl.update)
    .post("/:id/approve", describeRoute({ tags, summary: "Approve (admin only)", responses: { 200: entity("Approved"), ...forbidden, ...notFound, ...conflict, ...commonResponses } }), requireRole("admin"), ctl.approve)
    .post("/:id/reject", describeRoute({ tags, summary: "Reject (admin only)", responses: { 200: entity("Rejected"), ...forbidden, ...notFound, ...conflict, ...commonResponses } }), requireRole("admin"), ctl.reject)
    .post("/:id/cancel", describeRoute({ tags, summary: "Cancel (owner or admin; pending, or approved and not started)", responses: { 200: entity("Cancelled"), ...notFound, ...conflict, ...commonResponses } }), ctl.cancel);
};
