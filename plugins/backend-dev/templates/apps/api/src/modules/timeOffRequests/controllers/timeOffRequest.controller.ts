import type { Ctx, Run, WithId, WithQuery } from "@app/core/run";
import type { TimeOffRequestListQuery } from "../schemas/timeOffRequest.schema";
import * as service from "../services/timeOffRequest.service";

const body = (c: Ctx) => c.req.json().catch(() => null);

export const timeOffRequestController = (run: Run) => ({
  list: (c: WithQuery<TimeOffRequestListQuery>) => run(c, service.listTimeOffRequests(c.get("user"), c.req.valid("query"))),
  get: (c: WithId) => run(c, service.getTimeOffRequest(c.get("user"), c.req.param("id"))),
  create: async (c: Ctx) => run(c, service.createTimeOffRequest(c.get("user"), await body(c)), 201),
  update: async (c: WithId) => run(c, service.updateTimeOffRequest(c.get("user"), c.req.param("id"), await body(c))),
  approve: (c: WithId) => run(c, service.approveTimeOffRequest(c.get("user"), c.req.param("id"))),
  reject: (c: WithId) => run(c, service.rejectTimeOffRequest(c.get("user"), c.req.param("id"))),
  cancel: (c: WithId) => run(c, service.cancelTimeOffRequest(c.get("user"), c.req.param("id"))),
});
