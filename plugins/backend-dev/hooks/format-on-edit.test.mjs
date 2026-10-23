import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handle, onEditConfig } from "./format-on-edit.mjs";

const HOOK = new URL("./format-on-edit.mjs", import.meta.url).pathname;
const LINE = "**On edit:** format `fmt {file}`; lint `lint {file}`; files `.ts .json`";

function repo(profileLine = LINE) {
  const dir = mkdtempSync(join(tmpdir(), "onedit-"));
  writeFileSync(join(dir, "CLAUDE.md"), `# API\n<!-- backend-dev:profile:start -->\n${profileLine}\n<!-- backend-dev:profile:end -->\n`);
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src", "a b.ts"), "export const x = 1\n");
  writeFileSync(join(dir, "README.md"), "# readme\n");
  return dir;
}

// Records the commands and answers with the given lint status.
function fakeExec(lintStatus = 0) {
  const calls = [];
  const exec = (cmd, cwd) => { calls.push({ cmd, cwd }); return cmd.startsWith("lint") ? { status: lintStatus, stdout: "src/a b.ts\n  1:1 error no-var\n", stderr: "" } : { status: 0, stdout: "", stderr: "" }; };
  return { calls, exec };
}

test("onEditConfig reads format, lint and file types; none and ?: mean off", () => {
  assert.deepEqual(onEditConfig(LINE), { format: "fmt {file}", lint: "lint {file}", exts: [".ts", ".json"] });
  assert.equal(onEditConfig("**On edit:** none"), null);
  assert.equal(onEditConfig("**On edit:** ?: which formatter"), null);
  assert.equal(onEditConfig(""), null);
});

test("formats then lints the edited file from the project root, path quoted", () => {
  const dir = repo();
  process.env.CLAUDE_PROJECT_DIR = dir;
  const { calls, exec } = fakeExec(0);
  assert.deepEqual(handle({ tool_input: { file_path: join(dir, "src", "a b.ts") } }, exec), { code: 0 });
  assert.deepEqual(calls.map((c) => c.cmd), ["fmt 'src/a b.ts'", "lint 'src/a b.ts'"]);
  assert.ok(calls.every((c) => c.cwd === dir));
  delete process.env.CLAUDE_PROJECT_DIR;
});

test("lint errors (exit 1) go back to Claude with exit 2; other lint failures say nothing", () => {
  const dir = repo();
  process.env.CLAUDE_PROJECT_DIR = dir;
  const failed = handle({ tool_input: { file_path: "src/a b.ts" } }, fakeExec(1).exec);
  assert.equal(failed.code, 2);
  assert.match(failed.message, /Lint errors in src\/a b\.ts[\s\S]*no-var/);
  assert.deepEqual(handle({ tool_input: { file_path: "src/a b.ts" } }, fakeExec(2).exec), { code: 0 });
  assert.deepEqual(handle({ tool_input: { file_path: "src/a b.ts" } }, fakeExec(127).exec), { code: 0 });
  delete process.env.CLAUDE_PROJECT_DIR;
});

test("skips unlisted file types, files outside the project, deleted files and repos without the line", () => {
  const dir = repo();
  process.env.CLAUDE_PROJECT_DIR = dir;
  for (const file_path of [join(dir, "README.md"), "/etc/hosts", join(dir, "src", "gone.ts")]) {
    const { calls, exec } = fakeExec(1);
    assert.deepEqual(handle({ tool_input: { file_path } }, exec), { code: 0 }, file_path);
    assert.equal(calls.length, 0, file_path);
  }
  process.env.CLAUDE_PROJECT_DIR = repo("**Git:** base `main`");
  assert.deepEqual(handle({ tool_input: { file_path: "src/a b.ts" } }, fakeExec(1).exec), { code: 0 });
  delete process.env.CLAUDE_PROJECT_DIR;
});

test("as a hook: a real failing lint command blocks with exit 2, bad input exits 0", () => {
  const dir = repo("**On edit:** lint `node -e \"console.log('bad: '+process.argv[1]); process.exit(1)\" {file}`; files `.ts`");
  const run = (input) => spawnSync("node", [HOOK], { input, encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  const r = run(JSON.stringify({ tool_input: { file_path: join(dir, "src", "a b.ts") } }));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /bad: src\/a b\.ts/);
  assert.equal(run("{not json").status, 0);
});
