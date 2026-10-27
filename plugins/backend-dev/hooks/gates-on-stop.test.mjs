import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handle, onStopCommand } from "./gates-on-stop.mjs";

// The session running the tests may export its own project dir; these tests pass cwd instead.
delete process.env.CLAUDE_PROJECT_DIR;

const HOOK = new URL("./gates-on-stop.mjs", import.meta.url).pathname;

function repo(profileLine = "**On stop:** `gates`") {
  const dir = mkdtempSync(join(tmpdir(), "onstop-"));
  writeFileSync(join(dir, "CLAUDE.md"), `# API\n<!-- backend-dev:profile:start -->\n${profileLine}\n<!-- backend-dev:profile:end -->\n`);
  return dir;
}

function fakeExec(status, out = "") {
  const calls = [];
  return { calls, exec: (cmd, cwd) => { calls.push({ cmd, cwd }); return { status, stdout: out, stderr: "" }; } };
}

const edited = (dir, file_path, session_id = "s1") => handle("edited", { cwd: dir, session_id, tool_input: { file_path } });
const mark = (dir, session = "s1") => join(dir, ".backend-dev", `gates-pending-${session}`);

test("onStopCommand reads the command; none, ?: and a missing line mean off", () => {
  assert.equal(onStopCommand("**On stop:** `pnpm lint && pnpm test`"), "pnpm lint && pnpm test");
  assert.equal(onStopCommand("**On stop:** none"), null);
  assert.equal(onStopCommand("**On stop:** ?: which gates"), null);
  assert.equal(onStopCommand("**On edit:** none"), null);
});

test("a code edit marks the session; markdown, outside files and an off profile do not", () => {
  const dir = repo();
  edited(dir, join(dir, "docs", "tickets", "412", "plan.md"));
  edited(dir, "/etc/hosts");
  assert.equal(existsSync(mark(dir)), false);
  edited(dir, "src/app.ts");
  assert.ok(existsSync(mark(dir)));
  assert.equal(readFileSync(join(dir, ".backend-dev", ".gitignore"), "utf8"), "*\n");

  const off = repo("**On stop:** none");
  edited(off, "src/app.ts");
  assert.equal(existsSync(mark(off)), false);
});

test("stop runs nothing without a mark, and lets the turn end when Claude is already continuing", () => {
  const dir = repo();
  const none = fakeExec(1);
  assert.deepEqual(handle("stop", { cwd: dir, session_id: "s1" }, none.exec), { code: 0 });
  edited(dir, "src/app.ts");
  assert.deepEqual(handle("stop", { cwd: dir, session_id: "s1", stop_hook_active: true }, none.exec), { code: 0 });
  assert.equal(none.calls.length, 0);
  assert.ok(existsSync(mark(dir)), "the mark stays for the next stop");
});

test("green clears the mark; red blocks with the output and keeps it", () => {
  const dir = repo();
  edited(dir, "src/app.ts");
  const red = fakeExec(1, "FAIL src/app.test.ts > returns 403\n");
  const failed = handle("stop", { cwd: dir, session_id: "s1" }, red.exec);
  assert.equal(failed.code, 2);
  assert.match(failed.message, /gates failed \(`gates`, exit 1\)[\s\S]*returns 403/);
  assert.deepEqual(red.calls, [{ cmd: "gates", cwd: dir }]);
  assert.ok(existsSync(mark(dir)));

  assert.deepEqual(handle("stop", { cwd: dir, session_id: "s1" }, fakeExec(0).exec), { code: 0 });
  assert.equal(existsSync(mark(dir)), false);
});

test("a timeout tells the user and never blocks; sessions are separate", () => {
  const dir = repo();
  edited(dir, "src/app.ts", "a");
  const timedOut = handle("stop", { cwd: dir, session_id: "a" }, () => ({ status: null, signal: "SIGTERM" }));
  assert.equal(timedOut.code, 0);
  assert.match(JSON.parse(timedOut.stdout).systemMessage, /did not finish \(SIGTERM\)/);
  const other = fakeExec(1);
  assert.deepEqual(handle("stop", { cwd: dir, session_id: "b" }, other.exec), { code: 0 });
  assert.equal(other.calls.length, 0);
});

test("as a hook: a real failing command blocks with exit 2, bad input exits 0", () => {
  const dir = repo("**On stop:** `node -e \"console.log('2 failed'); process.exit(1)\"`");
  const run = (mode, input) => spawnSync("node", [HOOK, mode], { input, encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  assert.equal(run("edited", JSON.stringify({ session_id: "s1", tool_input: { file_path: join(dir, "src", "a.ts") } })).status, 0);
  const r = run("stop", JSON.stringify({ session_id: "s1", stop_hook_active: false }));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /2 failed/);
  assert.equal(run("stop", "{not json").status, 0);
});
