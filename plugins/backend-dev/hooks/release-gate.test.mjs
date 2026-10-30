import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onBash, onEdit, onPrompt, releases } from "./release-gate.mjs";

// The session running the tests may export its own project dir; these tests pass cwd instead.
delete process.env.CLAUDE_PROJECT_DIR;

const HOOK = new URL("./release-gate.mjs", import.meta.url).pathname;
const git = (dir, ...args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" }).stdout.trim();
function repo() {
  const dir = mkdtempSync(join(tmpdir(), "release-"));
  git(dir, "init", "-q");
  writeFileSync(join(dir, "app.ts"), "export {};\n");
  git(dir, "add", ".");
  git(dir, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init");
  return dir;
}
const commit = (dir) => { writeFileSync(join(dir, "app.ts"), `export const x = ${Math.random()};\n`); git(dir, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qam", "next"); };
// A transcript whose last release report carries this verdict, as Claude Code writes it (one JSON object per line).
function transcript(dir, verdict, heading = `## Release prod: ${git(dir, "rev-parse", "--short=7", "HEAD")}`) {
  const path = join(mkdtempSync(join(tmpdir(), "transcript-")), "t.jsonl"); // outside the repo, which must stay clean
  const line = (role, text) => JSON.stringify({ type: role, message: { role, content: [{ type: "text", text }] } });
  writeFileSync(path, [line("user", "/backend-dev:release prod"), line("assistant", `${heading}\n**Verdict:** ${verdict}`)].join("\n") + "\n");
  return path;
}
const say = (dir, prompt, now, verdict = "GO") => onPrompt({ cwd: dir, prompt, transcript_path: transcript(dir, verdict) }, now);
const run = (dir, command, now) => onBash({ cwd: dir, tool_input: { command } }, now);
const approve = (dir, now) => { say(dir, "/backend-dev:release prod", now); say(dir, "go", now); };

test("finds every command that ships, with its environment", () => {
  const env = (c) => releases(c).map((r) => r.env);
  assert.deepEqual(env("cd apps/api && npx wrangler deploy --env prod"), ["prod"]);
  assert.deepEqual(env("wrangler deploy --env=stag"), ["stag"]);
  assert.deepEqual(env("wrangler deploy -e dev"), ["dev"]);
  assert.deepEqual(env("wrangler deploy"), [""]);
  assert.deepEqual(env("pnpm deploy:prod"), ["prod"]);
  assert.deepEqual(env("pnpm --filter api run deploy:stag"), ["stag"]);
  assert.deepEqual(env("npm run deploy:dev; echo ok"), ["dev"]);
  assert.deepEqual(env("wrangler rollback --env prod"), ["prod"]);
  assert.deepEqual(env("wrangler versions deploy --env prod"), ["prod"]);
  assert.deepEqual(env("echo k | wrangler secret put FIREBASE_KEY --env prod"), ["prod"]);
  assert.deepEqual(env("firebase deploy --only firestore:indexes --project acme-prod"), ["prod"]);
  assert.deepEqual(env("npx wrangler@4 deploy --env prod"), ["prod"]);
  assert.deepEqual(env("npx wrangler@latest rollback --env prod"), ["prod"]);
  assert.deepEqual(env("npx wrangler --config wrangler.toml deploy --env prod"), ["prod"]);
  assert.deepEqual(env("npx wrangler -c w.toml secret put K --env prod"), ["prod"]);
  assert.deepEqual(env("./node_modules/.bin/wrangler deploy -e stag"), ["stag"]);
  assert.deepEqual(env("wrangler deploy --dry-run=false --env prod"), ["prod"]);
  assert.deepEqual(env("wrangler deploy --env prod # --dry-run"), ["prod"]);
  for (const safe of ["wrangler deploy --dry-run --env prod", "npx wrangler@4 deploy --dry-run --outdir dist --env=\"\"", "wrangler deployments list --env prod", "wrangler versions list --env prod", "wrangler secret list --env prod", "wrangler deployments list", "wrangler tail --env prod", "pnpm test", "git log --grep deploy:prod"])
    assert.deepEqual(releases(safe), [], safe);
});

test("dev and stag ask, with the commit they ship; no environment is refused", () => {
  const dir = repo();
  const r = run(dir, "pnpm deploy:stag");
  assert.equal(r.code, 0);
  assert.match(r.ask, new RegExp(`ships ${git(dir, "rev-parse", "--short=7", "HEAD")} to stag`));
  assert.match(run(dir, "wrangler deploy --env dev").ask, /to dev/);
  writeFileSync(join(dir, "app.ts"), "changed\n");
  assert.match(run(dir, "pnpm deploy:stag").ask, /uncommitted changes/);
  assert.equal(run(dir, "npx wrangler deploy").code, 2);
  assert.match(run(dir, "npx wrangler deploy").message, /names no environment/);
  assert.deepEqual(run(dir, "pnpm test"), { code: 0 });
});

test("production is refused without an approval, and the refusal names the route", () => {
  const dir = repo();
  const r = run(dir, "pnpm deploy:prod");
  assert.equal(r.code, 2);
  assert.match(r.message, /no release approval/);
  assert.match(r.message, /\/backend-dev:release prod/);
  say(dir, "/backend-dev:release prod");
  assert.equal(run(dir, "pnpm deploy:prod").code, 2, "asking for a release is not approving it");
});

test("go after /release prod approves the checked-out commit, for an hour, with a clean tree", () => {
  const t = 1_000_000;
  const dir = repo();
  approve(dir, t);
  assert.deepEqual(run(dir, "cd apps/api && npx wrangler deploy --env prod", t + 1000), { code: 0 });
  assert.match(run(dir, "pnpm deploy:prod", t + 61 * 60 * 1000).message, /more than an hour old/);
  writeFileSync(join(dir, "app.ts"), "uncommitted\n");
  assert.match(run(dir, "pnpm deploy:prod", t + 1000).message, /uncommitted changes/);
  git(dir, "checkout", "-q", "app.ts");
  commit(dir);
  assert.match(run(dir, "pnpm deploy:prod", t + 1000).message, /the approval is for .{7}, the checkout is at/);
});

test("go after a NO-GO, or with no report in the transcript, approves nothing and spends the request", () => {
  const dir = repo();
  say(dir, "/backend-dev:release prod", undefined, "NO-GO: gates fail");
  say(dir, "go", undefined, "NO-GO: gates fail");
  assert.equal(run(dir, "pnpm deploy:prod").code, 2);
  say(dir, "go", undefined, "GO");
  assert.equal(run(dir, "pnpm deploy:prod").code, 2, "a later go needs a new /release prod");
  onPrompt({ cwd: dir, prompt: "/backend-dev:release prod" });
  onPrompt({ cwd: dir, prompt: "go" });
  assert.equal(run(dir, "pnpm deploy:prod").code, 2);
});

test("go after a GO for another environment or commit, or after the unfilled template, approves nothing", () => {
  const dir = repo();
  const sha = git(dir, "rev-parse", "--short=7", "HEAD");
  for (const [verdict, heading] of [["GO", `## Release stag: ${sha}`], ["GO", "## Release prod: 0000000"], ["<GO, or NO-GO: each failed check and its fix>", `## Release prod: ${sha}`]]) {
    say(dir, "/backend-dev:release prod");
    onPrompt({ cwd: dir, prompt: "go", transcript_path: transcript(dir, verdict, heading) });
    assert.equal(run(dir, "pnpm deploy:prod").code, 2, heading + " " + verdict);
  }
});

test("rollback and secret changes on production ask instead of waiting on a release check", () => {
  const dir = repo();
  for (const cmd of ["npx wrangler rollback --env prod", "echo k | npx wrangler@4 secret put FIREBASE_PRIVATE_KEY --env prod"]) {
    const r = run(dir, cmd);
    assert.equal(r.code, 0, cmd);
    assert.match(r.ask, /no commit ships/, cmd);
  }
  assert.equal(run(dir, "npx wrangler versions deploy --env prod").code, 2, "versions deploy ships a version: it needs the approval");
});

test("go without a pending release, or after a non-production release, approves nothing", () => {
  const dir = repo();
  say(dir, "go");
  say(dir, "/backend-dev:release stag");
  say(dir, "go");
  assert.equal(existsSync(join(dir, ".backend-dev", "release-gate.json")) && "approved" in JSON.parse(readFileSync(join(dir, ".backend-dev", "release-gate.json"), "utf8")), false);
  assert.equal(run(dir, "pnpm deploy:prod").code, 2);
});

test("only a prompt writes the gate file: tools and the shell are refused", () => {
  const dir = repo();
  for (const file_path of [".backend-dev/release-gate.json", join(dir, ".backend-dev", "release-gate.json")])
    assert.equal(onEdit({ cwd: dir, tool_input: { file_path } }).code, 2, file_path);
  assert.deepEqual(onEdit({ cwd: dir, tool_input: { file_path: "src/app.ts" } }), { code: 0 });
  assert.equal(run(dir, `echo '{"approved":{}}' > .backend-dev/release-gate.json`).code, 2);
  assert.deepEqual(run(dir, "node --test plugins/backend-dev/hooks/release-gate.test.mjs"), { code: 0 });
});

test("as a hook process: a refusal exits 2 with the reason, an ask prints the decision, bad input never blocks", () => {
  const dir = repo();
  const hook = (mode, input) => spawnSync("node", [HOOK, mode], { input, encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  const deny = hook("bash", JSON.stringify({ tool_input: { command: "pnpm deploy:prod" } }));
  assert.equal(deny.status, 2);
  assert.match(deny.stderr, /ships to production/);
  const ask = hook("bash", JSON.stringify({ tool_input: { command: "pnpm deploy:dev" } }));
  assert.equal(ask.status, 0);
  assert.equal(JSON.parse(ask.stdout).hookSpecificOutput.permissionDecision, "ask");
  assert.equal(hook("bash", "not json").status, 0);
  hook("prompt", JSON.stringify({ prompt: "/backend-dev:release prod" }));
  hook("prompt", JSON.stringify({ prompt: "go", transcript_path: transcript(dir, "GO") }));
  assert.equal(hook("bash", JSON.stringify({ tool_input: { command: "pnpm deploy:prod" } })).status, 0);
});
