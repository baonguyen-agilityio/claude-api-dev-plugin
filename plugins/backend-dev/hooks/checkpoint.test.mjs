import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handle } from "./checkpoint.mjs";

const HOOK = new URL("./checkpoint.mjs", import.meta.url).pathname;
const run = (mode, payload, cwd) => spawnSync("node", [HOOK, mode], { input: typeof payload === "string" ? payload : JSON.stringify(payload), encoding: "utf8", cwd, env: { ...process.env, CLAUDE_PROJECT_DIR: cwd } });
const fileIn = (dir) => join(dir, ".claude", "checkpoints");

test("invoked: an owned skill writes a row and returns additionalContext", () => {
  const dir = mkdtempSync(join(tmpdir(), "ckpt-"));
  const r = run("invoked", { session_id: "s1", cwd: dir, tool_input: { skill: "backend-dev:system-design" } }, dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /"hookEventName":"PostToolUse"/);
  assert.match(r.stdout, /Checkpoint row written/);
  const text = readFileSync(join(fileIn(dir), `${new Date().toISOString().slice(0, 10)}-s1.md`), "utf8");
  assert.match(text, /\| backend-dev \| system-design \| invoked \|/);
  assert.doesNotMatch(text, /finished/);
});

test("invoked: a skill of another plugin or an unqualified foreign name writes nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "ckpt-"));
  assert.equal(run("invoked", { session_id: "s1", cwd: dir, tool_input: { skill: "other-plugin:system-design" } }, dir).status, 0);
  assert.equal(run("invoked", { session_id: "s1", cwd: dir, tool_input: { skill: "review-checklist" } }, dir).status, 0);
  assert.equal(existsSync(fileIn(dir)), false);
});

test("turn-ended: only appends when today's file exists; malformed input exits 0", () => {
  const dir = mkdtempSync(join(tmpdir(), "ckpt-"));
  assert.equal(run("turn-ended", { session_id: "s1", cwd: dir }, dir).status, 0);
  assert.equal(existsSync(fileIn(dir)), false);
  run("invoked", { session_id: "s1", cwd: dir, tool_input: { skill: "system-design" } }, dir);
  run("turn-ended", { session_id: "s1", cwd: dir }, dir);
  const text = readFileSync(join(fileIn(dir), `${new Date().toISOString().slice(0, 10)}-s1.md`), "utf8");
  assert.match(text, /\| - \| turn ended \|/);
  assert.equal(run("invoked", "{not json", dir).status, 0);
});

test("handle() resolves owned skills from the plugin's skills directory", () => {
  const dir = mkdtempSync(join(tmpdir(), "ckpt-"));
  process.env.CLAUDE_PROJECT_DIR = dir;
  assert.equal(handle("invoked", { session_id: "x", tool_input: { skill: "nope" } }), null);
  assert.notEqual(handle("invoked", { session_id: "x", tool_input: { skill: "system-design" } }), null);
  delete process.env.CLAUDE_PROJECT_DIR;
});
