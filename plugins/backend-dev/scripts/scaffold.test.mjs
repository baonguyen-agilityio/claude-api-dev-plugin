import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { guardRules } from "./guard-rules.mjs";

const SCRIPT = new URL("./scaffold.mjs", import.meta.url).pathname;
const scaffold = (dir) => spawnSync(process.execPath, [SCRIPT, dir], { encoding: "utf8" });

test("a new project gets kit-setup's settings: no attribution, the gate commands, the guard rules for main", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "scaffold-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.equal(scaffold(dir).status, 0);
  const s = JSON.parse(readFileSync(join(dir, ".claude", "settings.json"), "utf8"));
  assert.deepEqual(s.attribution, { commit: "", pr: "" });
  assert.deepEqual(s.permissions.allow, ["Bash(pnpm install)", "Bash(pnpm typecheck)", "Bash(pnpm test)", "Bash(pnpm check)"]);
  const { deny, ask } = guardRules(["main"]);
  assert.deepEqual(s.permissions.deny, deny);
  assert.deepEqual(s.permissions.ask, ask);
  spawnSync("git", ["init", "-q"], { cwd: dir });
  const ignored = (f) => spawnSync("git", ["check-ignore", "-q", f], { cwd: dir }).status === 0;
  assert.ok(ignored(".claude/checkpoints/x") && ignored(".claude/settings.local.json"));
  assert.ok(!ignored(".claude/settings.json"));
});

test("an existing .claude/settings.json is left alone", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "scaffold-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, ".claude"));
  writeFileSync(join(dir, ".claude", "settings.json"), "{}\n");
  assert.equal(scaffold(dir).status, 0);
  assert.equal(readFileSync(join(dir, ".claude", "settings.json"), "utf8"), "{}\n");
});
