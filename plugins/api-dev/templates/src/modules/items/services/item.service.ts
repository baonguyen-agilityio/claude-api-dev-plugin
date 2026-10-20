import { Effect, Schema } from "effect";
import { isAdmin, type AuthUser } from "@/core/auth";
import { Forbidden } from "@/core/errors";
import { Firestore } from "@/core/firestore";
import { page } from "@/core/pagination";
import { COLLECTION } from "../models/item.model";
import { NewItem, UpdateItem, type ItemListQuery } from "../schemas/item.schema";

// Business logic as Effect programs. No HTTP here; service tests run these directly.
export const listItems = ({ limit, cursor }: ItemListQuery) =>
  Effect.flatMap(Firestore, (db) => db.list(COLLECTION, { limit, cursor })).pipe(Effect.map(({ docs, nextCursor }) => page(docs, limit, nextCursor)));

export const getItem = (id: string) => Effect.flatMap(Firestore, (db) => db.get(COLLECTION, id));

export const createItem = (user: AuthUser, body: unknown) =>
  Effect.gen(function* () {
    const data = yield* Schema.decodeUnknown(NewItem)(body);
    const db = yield* Firestore;
    return yield* db.create(COLLECTION, { ...data, ownerId: user.uid });
  });

// Owner or admin may update (architecture §6); anyone else gets 403 because items are readable by all.
export const updateItem = (user: AuthUser, id: string, body: unknown) =>
  Effect.gen(function* () {
    const data = yield* Schema.decodeUnknown(UpdateItem)(body);
    const db = yield* Firestore;
    const current = yield* db.get(COLLECTION, id);
    if (current.ownerId !== user.uid && !isAdmin(user)) return yield* new Forbidden({ message: "Only the owner or an admin may update this item" });
    return yield* db.update(COLLECTION, id, data);
  });

export const deleteItem = (id: string) => Effect.flatMap(Firestore, (db) => db.remove(COLLECTION, id));
