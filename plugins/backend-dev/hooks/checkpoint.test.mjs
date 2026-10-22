import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handle } from "./checkpoint.mjs";

const HOOK = new URL("./checkpoint.mjs", import.meta.url).pathname;
const run = (mode, payload, cwd) => spawnSync("node", [HOOK, mode], { input: typeof payload === "string" ? payload : JSON.stringify(payload), encoding: "utf8", cwd, env: { ...process.env, CLAUDE_PROJECT_DIR: cwd } });
const fileIn = (dir) => join(dir, ".claude", "checkpoints");
const today = () => new Date().toISOString().slice(0, 10);
// A plugin root with one skill, so the tests do not depend on which skills ship.
const fixtureRoot = () => { const root = mkdtempSync(join(tmpdir(), "plugin-")); mkdirSync(join(root, "skills", "demo-skill"), { recursive: true }); return root; };

test("invoked: an owned skill writes a row and returns additionalContext", () => {
  const dir = mkdtempSync(join(tmpdir(), "ckpt-"));
  process.env.CLAUDE_PROJECT_DIR = dir;
  const out = handle("invoked", { session_id: "s1", tool_input: { skill: "backend-dev:demo-skill" } }, fixtureRoot());
  delete process.env.CLAUDE_PROJECT_DIR;
  assert.equal(out.hookSpecificOutput.hookEventName, "PostToolUse");
  assert.match(out.hookSpecificOutput.additionalContext, /Checkpoint row written/);
  assert.match(readFileSync(join(fileIn(dir), `${today()}-s1.md`), "utf8"), /\| backend-dev \| demo-skill \| invoked \|/);
});

test("invoked: a skill of another plugin or an unqualified foreign name writes nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "ckpt-"));
  assert.equal(run("invoked", { session_id: "s1", cwd: dir, tool_input: { skill: "other-plugin:demo-skill" } }, dir).status, 0);
  assert.equal(run("invoked", { session_id: "s1", cwd: dir, tool_input: { skill: "review-checklist" } }, dir).status, 0);
  assert.equal(existsSync(fileIn(dir)), false);
});

test("turn-ended: only appends when today's file exists; malformed input exits 0", () => {
  const dir = mkdtempSync(join(tmpdir(), "ckpt-"));
  process.env.CLAUDE_PROJECT_DIR = dir;
  assert.equal(handle("turn-ended", { session_id: "s1" }), null);
  assert.equal(existsSync(fileIn(dir)), false);
  handle("invoked", { session_id: "s1", tool_input: { skill: "demo-skill" } }, fixtureRoot());
  handle("turn-ended", { session_id: "s1" });
  delete process.env.CLAUDE_PROJECT_DIR;
  assert.match(readFileSync(join(fileIn(dir), `${today()}-s1.md`), "utf8"), /\| - \| turn ended \|/);
  assert.equal(run("invoked", "{not json", dir).status, 0);
});

test("handle() resolves owned skills from the plugin's skills directory", () => {
  const dir = mkdtempSync(join(tmpdir(), "ckpt-"));
  process.env.CLAUDE_PROJECT_DIR = dir;
  const root = fixtureRoot();
  assert.equal(handle("invoked", { session_id: "x", tool_input: { skill: "nope" } }, root), null);
  assert.notEqual(handle("invoked", { session_id: "x", tool_input: { skill: "demo-skill" } }, root), null);
  delete process.env.CLAUDE_PROJECT_DIR;
});
