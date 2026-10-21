import { Schema } from "effect";
import { PageQuery } from "@/core/pagination";
import { ItemFields } from "../models/item.model";

// DTOs: what clients may send. Excess fields are stripped; server-owned fields are not here (architecture §4).
export const NewItem = Schema.Struct(ItemFields).annotations({ identifier: "NewItem", examples: [{ name: "pen", qty: 3 }] });
export type NewItem = typeof NewItem.Type;

export const UpdateItem = Schema.partial(Schema.Struct(ItemFields))
  .pipe(Schema.filter((o) => Object.keys(o).length > 0 || "at least one field is required"))
  .annotations({ identifier: "UpdateItem", examples: [{ qty: 5 }] });
export type UpdateItem = typeof UpdateItem.Type;

export const ItemListQuery = PageQuery;
export type ItemListQuery = typeof ItemListQuery.Type;
