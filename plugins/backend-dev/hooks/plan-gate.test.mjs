import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onEdit, onPrompt } from "./plan-gate.mjs";

// The session running the tests may export its own project dir; these tests pass cwd instead.
delete process.env.CLAUDE_PROJECT_DIR;

const HOOK = new URL("./plan-gate.mjs", import.meta.url).pathname;
const repo = () => mkdtempSync(join(tmpdir(), "gate-"));
const gate = (dir) => JSON.parse(readFileSync(join(dir, ".backend-dev", "plan-gate.json"), "utf8"));
const say = (dir, prompt) => onPrompt({ cwd: dir, prompt });
const edit = (dir, file_path, extra = {}) => onEdit({ cwd: dir, tool_input: { file_path, ...extra } });

test("no gate file: nothing is blocked, so plain requests outside the ticket flow still edit", () => {
  const dir = repo();
  say(dir, "add a GET /items/count endpoint");
  assert.equal(existsSync(join(dir, ".backend-dev", "plan-gate.json")), false);
  assert.deepEqual(edit(dir, "src/app.ts"), { code: 0 });
});

test("/ticket and /plan open the gate; source edits are blocked, the ticket record is not", () => {
  for (const prompt of ["/backend-dev:ticket https://gitlab.example.com/g/p/-/issues/412", "/backend-dev:plan 412", "/backend-dev:plan add a level field"]) {
    const dir = repo();
    say(dir, prompt);
    assert.equal(gate(dir).state, "pending", prompt);
    assert.equal(edit(dir, join(dir, "src", "app.ts")).code, 2, prompt);
    assert.match(edit(dir, "src/app.ts").message, /not approved/);
    for (const ok of ["docs/tickets/412/plan.md", "docs/incidents/2026-10-28-x.md", ".backend-dev/tickets/412.md", "/etc/hosts"])
      assert.deepEqual(edit(dir, ok), { code: 0 }, ok);
    assert.equal(readFileSync(join(dir, ".backend-dev", ".gitignore"), "utf8"), "*\n");
  }
});

test("/build <id> approves; /build \"text\" stays pending until a bare go", () => {
  const a = repo();
  say(a, "/backend-dev:ticket 412");
  say(a, "/backend-dev:build 412 --learn");
  assert.equal(gate(a).state, "approved");
  assert.deepEqual(edit(a, "src/app.ts"), { code: 0 });

  const b = repo();
  say(b, '/backend-dev:build "Integrate Firebase Auth and expose one API to get user list for Admin role"');
  assert.deepEqual([gate(b).state, gate(b).via], ["pending", "build-text"]);
  assert.equal(edit(b, "src/app.ts").code, 2);
  say(b, "go ahead and also add pagination");
  assert.equal(gate(b).state, "pending", "only a bare go approves");
  say(b, "go");
  assert.equal(gate(b).state, "approved");
  assert.deepEqual(edit(b, "src/app.ts"), { code: 0 });
});

test("a bare go approves only after /build \"text\", not after /ticket", () => {
  const dir = repo();
  say(dir, "/backend-dev:ticket 412");
  say(dir, "go");
  assert.equal(gate(dir).state, "pending");
});

test("a secret value written into the ticket or incident record is blocked; key names are fine", () => {
  const dir = repo();
  const pem = "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----";
  assert.equal(edit(dir, "docs/tickets/x/intent.md", { content: `Spec\n${pem}` }).code, 2);
  assert.equal(edit(dir, "docs/incidents/a.md", { new_string: '{"private_key": "abc"}' }).code, 2);
  assert.equal(edit(dir, "docs/tickets/x/spec.md", { edits: [{ new_string: "token glpat-abcdefghijklmnopqrstu" }] }).code, 2);
  assert.match(edit(dir, "docs/tickets/x/intent.md", { content: pem }).message, /secret value/);
  assert.deepEqual(edit(dir, "docs/tickets/x/intent.md", { content: "Rotated FIREBASE_PRIVATE_KEY (key id 3f2a)" }), { code: 0 });
});

test("as hooks: the prompt hook writes the gate, the edit hook exits 2 with the reason, bad input exits 0", () => {
  const dir = repo();
  const run = (mode, input) => spawnSync("node", [HOOK, mode], { input, encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  assert.equal(run("prompt", JSON.stringify({ prompt: "/backend-dev:ticket 7" })).status, 0);
  const r = run("edit", JSON.stringify({ tool_input: { file_path: join(dir, "src", "a.ts") } }));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /not approved/);
  assert.equal(run("edit", "{not json").status, 0);
});
