import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { guardRules } from "./guard-rules.mjs";

const SCRIPT = new URL("./guard-rules.mjs", import.meta.url).pathname;

// The harness's matching, as observed in real sessions: the rule matches the whole command, * matches anything.
const matches = (rule, command) => {
  const m = rule.match(/^Bash\((.*)\)$/);
  if (!m) return false;
  const re = new RegExp(`^${m[1].split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`, "s");
  return re.test(command);
};
const denied = (rules, command) => rules.some((r) => matches(r, command));

test("deny: nine rules per branch, then the fixed set and the secret files; ask: shell commands naming a secret file", () => {
  const { deny, ask } = guardRules(["main", "dev"]);
  assert.equal(deny.length, 2 * 9 + 26 + 6);
  assert.ok(deny.includes("Bash(git push * dev)"));
  assert.ok(deny.includes("Read(**/.dev.vars)"));
  assert.ok(!deny.some((r) => r.includes("{b}")));
  assert.equal(ask.length, 2);
});

test("ask covers any shell command naming a secret file, interpreters included; ordinary commands stay free", () => {
  const { ask } = guardRules(["main"]);
  for (const cmd of ["cat .dev.vars", `node -e "require('fs').readFileSync('apps/api/.dev.vars','utf8')"`, "python3 -c \"open('.env').read()\"", "source .env.local && npm run dev", "cat .dev.vars.example"])
    assert.ok(denied(ask, cmd), cmd);
  for (const cmd of ["npm test", "pnpm --filter space test", "npx wrangler deploy --env dev", "git status"])
    assert.ok(!denied(ask, cmd), cmd);
});

test("blocks the spellings seen in real sessions and lets feature work through", () => {
  const rules = guardRules(["main", "dev"]).deny;
  for (const cmd of [
    "git push origin dev", "git push origin HEAD:main", "git -C . push origin dev", "git push origin refs/heads/main",
    "git push --force origin feat/x", "git push -f origin feat/x", "git push origin feat/x --force", "git push origin +feat/x",
    "git commit --allow-empty --no-verify -m x", "git commit -nm x", "git push --all origin",
    "git commit -m 'feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>'",
    "git push", "git push origin", "git push -u origin", "git -C apps/api push", "git push --force-with-lease", "git push origin -u",
    `echo '{"state":"approved"}' > .backend-dev/plan-gate.json`, "rm .backend-dev/plan-gate.json", "cd apps/api && sed -i '' s/pending/approved/ .backend-dev/plan-gate.json",
  ]) assert.ok(denied(rules, cmd), cmd);
  for (const cmd of [
    "git push origin feat/x", "git push --force-with-lease origin feat/x", "git push origin feat/x --force-with-lease",
    "git push origin feat/dev", "git push origin dev-eu-v2", "git commit -m 'feat: add level'",
    "git push -u origin feat/x", "git push --set-upstream origin feat/x", "git -C apps/api push origin feat/x",
  ]) assert.ok(!denied(rules, cmd), cmd);
});

test("a prefix-* entry covers a family of environment branches, not feature branches that mention it", () => {
  const rules = guardRules(["dev", "stag", "main", "dev-*", "stag-*", "prod-*"]).deny;
  for (const cmd of [
    "git push origin prod-eu-job", "git push origin HEAD:prod-us", "git push -u origin stag-eu",
    "git -C apps/api push origin dev-eu", "git push origin refs/heads/prod-eu", "git push origin stag",
  ]) assert.ok(denied(rules, cmd), cmd);
  for (const cmd of [
    "git push origin feat/prod-x", "git push -u origin fix/stag-login", "git push origin feat/dev-eu-retry",
    "git push origin production-notes",
  ]) assert.ok(!denied(rules, cmd), cmd);
});

test("cli prints the rules as JSON and refuses no branch or a branch name with shell characters", () => {
  const ok = spawnSync("node", [SCRIPT, "main", "prod-eu"], { encoding: "utf8" });
  assert.equal(ok.status, 0);
  assert.ok(JSON.parse(ok.stdout).deny.includes("Bash(git push *:prod-eu)"));
  assert.equal(spawnSync("node", [SCRIPT], { encoding: "utf8" }).status, 1);
  assert.equal(spawnSync("node", [SCRIPT, "$(rm -rf x)"], { encoding: "utf8" }).status, 1);
  // A family keeps its wildcard; a bare or inner * would block every push or match too much, so it is refused.
  assert.ok(JSON.parse(spawnSync("node", [SCRIPT, "prod-*"], { encoding: "utf8" }).stdout).deny.includes("Bash(git push * prod-*)"));
  for (const bad of ["*", "pro*d"]) assert.equal(spawnSync("node", [SCRIPT, bad], { encoding: "utf8" }).status, 1, bad);
});
