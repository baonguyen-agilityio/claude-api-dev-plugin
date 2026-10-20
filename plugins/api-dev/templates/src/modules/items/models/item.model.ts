import { Schema } from "effect";
import { ServerFields } from "@/core/entity";

// Model: the stored entity and where it lives. Single source for field rules (architecture §4).
export const COLLECTION = "items";

export const ItemFields = {
  name: Schema.NonEmptyTrimmedString.pipe(Schema.maxLength(120)),
  qty: Schema.NonNegativeInt,
};

export const Item = Schema.Struct({ ...ServerFields, ...ItemFields }).annotations({ identifier: "Item" });
export type Item = typeof Item.Type;
