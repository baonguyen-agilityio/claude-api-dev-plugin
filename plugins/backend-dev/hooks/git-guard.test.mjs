import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check, commands, protectedFrom } from "./git-guard.mjs";

const HOOK = new URL("./git-guard.mjs", import.meta.url).pathname;
const PROTECTED = ["main", "dev"];
const onFeature = () => "feat/412-level";
const onDev = () => "dev";
const blocked = (cmd, branchOf = onFeature) => check(cmd, "/repo", PROTECTED, branchOf);

test("commands() splits like the shell: quotes, escapes, ; && || | and newlines", () => {
  assert.deepEqual(commands(`git commit -m "a; b" && git push origin 'x y'`), [["git", "commit", "-m", "a; b"], ["git", "push", "origin", "x y"]]);
  assert.deepEqual(commands("cd api\ngit push"), [["cd", "api"], ["git", "push"]]);
});

test("allows ordinary work on a feature branch", () => {
  for (const cmd of [
    "git status",
    'git commit -m "[#412] feat(employees): add level"',
    "git commit -am 'fix: typo'",
    "git push -u origin feat/412-level",
    "git push --force-with-lease origin feat/412-level",
    "git push",
    "npm test && git log --oneline -5",
  ]) assert.equal(blocked(cmd), null, cmd);
});

test("blocks skipping the repo's hooks", () => {
  assert.match(blocked("git commit --no-verify -m x"), /no-verify/);
  assert.match(blocked("git commit -nm x"), /no-verify/);
  assert.match(blocked("git push --no-verify origin feat/x"), /no-verify/);
});

test("blocks AI attribution in a commit message, heredoc included", () => {
  assert.match(blocked('git commit -m "feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"'), /attribution/);
  assert.match(blocked(`git commit -m "$(cat <<'EOF'\nfeat: x\n\nGenerated with [Claude Code](https://claude.com)\nEOF\n)"`), /attribution/);
});

test("blocks pushes to protected branches in every spelling", () => {
  for (const cmd of [
    "git push origin main",
    "git push origin HEAD:dev",
    "git push origin feat/x:main",
    "git push origin refs/heads/main",
    "git -C ../api push origin main",
    "git push origin :dev",
    "cd api && git push origin dev",
  ]) assert.match(blocked(cmd) ?? "", /protected branch/, cmd);
  assert.match(blocked("git push", onDev), /protected branch "dev"/);
  assert.match(blocked("git push origin HEAD", onDev), /protected branch "dev"/);
});

test("blocks force pushes, --all/--mirror and targets it cannot read", () => {
  assert.match(blocked("git push -f origin feat/x"), /Force push/);
  assert.match(blocked("git push --force origin feat/x"), /Force push/);
  assert.match(blocked("git push origin +feat/x"), /Force push/);
  assert.match(blocked("git push --all origin"), /--all/);
  assert.match(blocked('git push origin "$BRANCH"'), /Cannot tell/);
});

test("protected branches come from the profile, with main and master as the default", () => {
  assert.deepEqual(protectedFrom(""), ["main", "master"]);
  assert.deepEqual(protectedFrom("**Protected branches:** `dev`, `prod-flash`\n"), ["dev", "prod-flash"]);
});

test("as a hook: exit 2 with the reason on stderr; malformed input and non-git commands exit 0", () => {
  const dir = mkdtempSync(join(tmpdir(), "guard-"));
  writeFileSync(join(dir, "CLAUDE.md"), "<!-- backend-dev:profile:start -->\n**Protected branches:** `release`\n<!-- backend-dev:profile:end -->\n");
  const run = (input) => spawnSync("node", [HOOK], { input, encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  const r = run(JSON.stringify({ cwd: dir, tool_input: { command: "git push origin release" } }));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /protected branch "release"/);
  assert.equal(run(JSON.stringify({ cwd: dir, tool_input: { command: "git push origin main" } })).status, 0);
  assert.equal(run(JSON.stringify({ cwd: dir, tool_input: { command: "ls -la" } })).status, 0);
  assert.equal(run("{not json").status, 0);
});
