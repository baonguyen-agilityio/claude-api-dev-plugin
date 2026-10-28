import { describe, expect, it } from "vitest";
import { createItem, deleteItem, getItem, listItems, updateItem } from "../services/item.service";
import { makeFakeFirestore } from "@app/core/testing/fake-firestore";
import { USERS, fail, run } from "@/tests/helpers/test-app";

describe("item service", () => {
  it("create validates the body, stamps ownerId from the caller and writes nothing on failure", async () => {
    const fake = makeFakeFirestore();
    expect((await fail(fake, createItem(USERS.user, { name: "", qty: 1 })))._tag).toBe("ParseError");
    expect((await fail(fake, createItem(USERS.user, { name: "pen", qty: -1 })))._tag).toBe("ParseError");
    expect((await fail(fake, createItem(USERS.user, { name: " pen ", qty: 1 })))._tag).toBe("ParseError"); // must arrive trimmed
    expect(fake.store.size).toBe(0);
    const created = await run(fake, createItem(USERS.user, { name: "pen", qty: 3, ownerId: "someone-else" }));
    expect(created).toMatchObject({ name: "pen", qty: 3, ownerId: "u1" });
    expect(created.createdAt).toBeInstanceOf(Date);
  });

  it("update is owner or admin; another user is Forbidden; missing is NotFound", async () => {
    const fake = makeFakeFirestore();
    const { id } = await run(fake, createItem(USERS.user, { name: "pen", qty: 3 }));
    expect((await fail(fake, updateItem(USERS.other, id, { qty: 9 })))._tag).toBe("Forbidden");
    expect((await run(fake, updateItem(USERS.admin, id, { qty: 9 }))).qty).toBe(9);
    expect((await run(fake, updateItem(USERS.user, id, { qty: 4 }))).qty).toBe(4);
    expect((await fail(fake, updateItem(USERS.user, id, {})))._tag).toBe("ParseError");
    expect((await fail(fake, updateItem(USERS.user, "nope", { qty: 1 })))._tag).toBe("NotFound");
  });

  it("list pages by id with an opaque cursor; the last page has none", async () => {
    const fake = makeFakeFirestore();
    for (let i = 0; i < 3; i++) await run(fake, createItem(USERS.user, { name: `n${i}`, qty: i }));
    const p1 = await run(fake, listItems({ limit: 2 }));
    expect(p1.data).toHaveLength(2);
    expect(p1.meta.pagination.cursor).toBeDefined();
    const p2 = await run(fake, listItems({ limit: 2, cursor: p1.meta.pagination.cursor }));
    expect(p2.data).toHaveLength(1);
    expect(p2.meta.pagination.cursor).toBeUndefined();
    expect((await fail(fake, listItems({ limit: 2, cursor: "garbage" })))._tag).toBe("BadRequest");
  });

  it("get and delete", async () => {
    const fake = makeFakeFirestore();
    const { id } = await run(fake, createItem(USERS.user, { name: "pen", qty: 1 }));
    expect((await run(fake, getItem(id))).id).toBe(id);
    await run(fake, deleteItem(id));
    expect((await fail(fake, getItem(id)))._tag).toBe("NotFound");
    expect((await fail(fake, deleteItem(id)))._tag).toBe("NotFound");
  });
});
