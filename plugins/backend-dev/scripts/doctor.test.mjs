import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkEnv, envKeys } from "./doctor.mjs";

const SCRIPT = new URL("./doctor.mjs", import.meta.url).pathname;

test("envKeys reads names only, skips comments and blanks", () => {
  assert.deepEqual(envKeys("# c\nA=1\n\nexport B = two\nnot a pair\n"), ["A", "B"]);
});

test("a missing key is reported by name and the value never appears", () => {
  const dir = mkdtempSync(join(tmpdir(), "doctor-"));
  writeFileSync(join(dir, ".dev.vars.example"), "FIREBASE_PROJECT_ID=\nFIREBASE_PRIVATE_KEY=\n");
  writeFileSync(join(dir, ".dev.vars"), "FIREBASE_PROJECT_ID=secret-project-value\n");
  const [[level, , detail]] = checkEnv(dir);
  assert.equal(level, "FAIL");
  assert.match(detail, /FIREBASE_PRIVATE_KEY/);
  assert.doesNotMatch(detail, /secret-project-value/);
});

test("full run: missing env file is FAIL (exit 1), output carries no values", () => {
  const dir = mkdtempSync(join(tmpdir(), "doctor-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x", packageManager: "npm@1.0.0" }));
  mkdirSync(join(dir, "apps", "api"), { recursive: true });
  writeFileSync(join(dir, "apps", "api", ".dev.vars.sample"), "TOKEN=\n");
  let code = 0, stdout = "";
  try { stdout = execFileSync("node", [SCRIPT, dir]).toString(); } catch (e) { code = e.status; stdout = e.stdout.toString(); }
  assert.equal(code, 1);
  assert.match(stdout, /FAIL\s+apps\/api\/\.dev\.vars/);
  assert.match(stdout, /WARN\s+kit profile/);
});
