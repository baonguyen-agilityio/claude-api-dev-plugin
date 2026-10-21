import type { Ctx, Run, WithId, WithQuery } from "@/core/run";
import type { ItemListQuery } from "../schemas/item.schema";
import * as service from "../services/item.service";

// Malformed JSON -> null -> schema fails -> 400, not a 500.
const body = (c: Ctx) => c.req.json().catch(() => null);

// Controller: adapts HTTP (params, query, body, status) to service calls. No business logic here.
export const itemController = (run: Run) => ({
  list: (c: WithQuery<ItemListQuery>) => run(c, service.listItems(c.req.valid("query"))),
  get: (c: WithId) => run(c, service.getItem(c.req.param("id"))),
  create: async (c: Ctx) => run(c, service.createItem(c.get("user"), await body(c)), 201),
  update: async (c: WithId) => run(c, service.updateItem(c.get("user"), c.req.param("id"), await body(c))),
  remove: (c: WithId) => run(c, service.deleteItem(c.req.param("id")), 204),
});
