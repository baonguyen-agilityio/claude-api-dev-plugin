import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activeTicket, message } from "./ticket-resume.mjs";

const HOOK = new URL("./ticket-resume.mjs", import.meta.url).pathname;
const HOUR = 60 * 60 * 1000;

function project(tickets) {
  const dir = mkdtempSync(join(tmpdir(), "resume-"));
  const folder = join(dir, ".backend-dev", "tickets");
  mkdirSync(folder, { recursive: true });
  for (const [id, ageHours, body] of tickets) {
    const file = join(folder, `${id}.md`);
    writeFileSync(file, body ?? `# #${id}\n**Next:** data-model: pin the level field. Reply \`go\` to run it.\n`);
    const t = (Date.now() - ageHours * HOUR) / 1000;
    utimesSync(file, t, t);
  }
  return dir;
}

test("the ticket named in the branch wins, even when another file is newer", () => {
  const dir = project([["412", 30], ["5053", 1]]);
  assert.equal(activeTicket(dir, "feat/412-employee-level").id, "412");
  assert.equal(activeTicket(dir, "fix/5053-basic-auth").id, "5053");
});

test("without a match in the branch, the newest file from the last 12 hours; older files are ignored", () => {
  assert.equal(activeTicket(project([["412", 3], ["5053", 1]]), "dev").id, "5053");
  assert.equal(activeTicket(project([["412", 30]]), "dev"), null);
  assert.equal(activeTicket(mkdtempSync(join(tmpdir(), "resume-")), "dev"), null);
});

test("a branch id must be a whole token: 41 does not match feat/412-x", () => {
  assert.equal(activeTicket(project([["41", 30]]), "feat/412-x"), null);
});

test("the message names the file, repeats the last Next line and forbids taking the summary as a go", () => {
  const dir = project([["412", 1]]);
  const text = message(activeTicket(dir, "dev"), dir);
  assert.match(text, /\.backend-dev\/tickets\/412\.md/);
  assert.match(text, /\*\*Next:\*\* data-model/);
  assert.match(text, /not their go/);
});

test("as a hook: prints additionalContext for SessionStart, nothing when no ticket, exit 0 on bad input", () => {
  const dir = project([["412", 1]]);
  const run = (cwd, input) => spawnSync("node", [HOOK], { input, encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: cwd } });
  const r = run(dir, JSON.stringify({ hook_event_name: "SessionStart", source: "compact", cwd: dir }));
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(out.hookSpecificOutput.additionalContext, /ticket 412/);
  const empty = mkdtempSync(join(tmpdir(), "resume-"));
  assert.equal(run(empty, JSON.stringify({ cwd: empty })).stdout, "");
  assert.equal(run(dir, "{not json").status, 0);
});
