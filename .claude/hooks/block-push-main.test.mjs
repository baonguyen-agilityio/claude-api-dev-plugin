import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decide, pushesToMain } from "./block-push-main.mjs";

const HOOK = new URL("./block-push-main.mjs", import.meta.url).pathname;

// A throwaway repo so currentBranch() has something real to read.
function repoOn(branch) {
  const dir = mkdtempSync(join(tmpdir(), "guard-main-"));
  execFileSync("git", ["-C", dir, "init", "-q", "-b", branch]);
  writeFileSync(join(dir, "f"), "x");
  execFileSync("git", ["-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", "add", "f"]);
  execFileSync("git", ["-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "init"]);
  return dir;
}

const run = (payload) => spawnSync("node", [HOOK], { input: typeof payload === "string" ? payload : JSON.stringify(payload), encoding: "utf8" });

test("explicit refspecs to main are blocked on any branch", () => {
  for (const cmd of ["git push origin main", "git push origin HEAD:main", "git push -u origin main", "git push origin +main", "git push origin refs/heads/main", "git push --all origin", "git -C /x push origin main"]) {
    assert.equal(pushesToMain(cmd, "feat/x"), true, cmd);
  }
});

test("pushes to other branches pass", () => {
  for (const cmd of ["git push origin feat/x", "git push --force-with-lease origin feat/x", "git push origin main-fix", "git push origin HEAD:feat/main-page"]) {
    assert.equal(pushesToMain(cmd, "main"), false, cmd);
  }
});

test("bare git push is blocked only when the current branch is main", () => {
  assert.equal(pushesToMain("git push", "main"), true);
  assert.equal(pushesToMain("git push origin HEAD", "main"), true);
  assert.equal(pushesToMain("git push", "feat/x"), false);
});

test("decide() scans every segment of a compound command", () => {
  const cwd = repoOn("feat/x");
  assert.equal(decide({ cwd, tool_input: { command: "git add -A && git commit -m x && git push origin main" } }), "git push origin main");
  assert.equal(decide({ cwd, tool_input: { command: "git status; echo push main" } }), null);
});

test("hook process: exit 2 with a message on main, exit 0 otherwise, exit 0 on bad input", () => {
  const onMain = repoOn("main");
  const blocked = run({ cwd: onMain, tool_input: { command: "git push" } });
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /would push to main/);
  assert.equal(run({ cwd: onMain, tool_input: { command: "git push origin feat/x" } }).status, 0);
  assert.equal(run({ cwd: onMain, tool_input: { command: "npm test" } }).status, 0);
  assert.equal(run("{not json").status, 0);
});
