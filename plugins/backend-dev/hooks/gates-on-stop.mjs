#!/usr/bin/env node
// Runs the repo's gates when Claude ends a turn in which it edited code, so "done means the gates are green" is
// checked by the harness, not promised. Opt-in, from the profile line
//   **On stop:** `pnpm --filter space lint && pnpm --filter space test`        (or `none`)
//   node gates-on-stop.mjs edited  PostToolUse(Edit|Write|MultiEdit): marks the session as having code to check.
//                                  Markdown files (ticket and incident records) do not count, so a turn that only
//                                  wrote the record, such as the stop before `go`, runs nothing.
//   node gates-on-stop.mjs stop    Stop: with a mark, runs the command from the project root. Green clears the mark.
//                                  Red exits 2 with the output, which sends Claude back to fix it. The mark stays, so
//                                  the next stop checks again.
// stop_hook_active (Claude is already continuing because of this hook) lets the turn end, so a failure that predates
// the change, or one Claude cannot fix, costs one extra round, never a loop. A timeout or the hook's own failure never
// blocks. The mark is <project>/.backend-dev/gates-pending-<session>; that folder ignores itself.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { field, projectDir, readProfile } from "./profile.mjs";

export function onStopCommand(profile) {
  const line = field(profile, "On stop");
  if (!line || /^(none|\?:)/i.test(line)) return null;
  return line.match(/`([^`]+)`/)?.[1] ?? null;
}

const markPath = (dir, input) => join(dir, ".backend-dev", `gates-pending-${String(input?.session_id || "local").replace(/[^\w-]/g, "_")}`);
const tail = (text, n = 60) => text.trim().split("\n").slice(-n).join("\n");

function mark(dir, file) {
  const folder = join(dir, ".backend-dev");
  mkdirSync(folder, { recursive: true });
  if (!existsSync(join(folder, ".gitignore"))) writeFileSync(join(folder, ".gitignore"), "*\n");
  writeFileSync(file, `${new Date().toISOString()}\n`);
}

// Returns { code, message, stdout }: code 2 sends message to Claude; stdout is JSON for the user.
export function handle(mode, input, exec = (cmd, cwd) => spawnSync(cmd, { cwd, shell: true, encoding: "utf8", timeout: 570_000 })) {
  const dir = projectDir(input);
  const command = onStopCommand(readProfile(dir));
  if (!command) return { code: 0 };
  const file = markPath(dir, input);

  if (mode === "edited") {
    const path = input?.tool_input?.file_path;
    if (typeof path !== "string" || extname(path).toLowerCase() === ".md") return { code: 0 };
    const rel = relative(dir, isAbsolute(path) ? path : resolve(dir, path));
    if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return { code: 0 };
    mark(dir, file);
    return { code: 0 };
  }

  if (mode === "stop") {
    if (!existsSync(file) || input?.stop_hook_active) return { code: 0 };
    const r = exec(command, dir);
    if (r.status === 0) {
      rmSync(file, { force: true });
      return { code: 0 };
    }
    if (r.status === null) {
      return { code: 0, stdout: JSON.stringify({ systemMessage: `backend-dev: the On stop gates did not finish (${r.signal || r.error?.code || "timeout"}); they were not checked this turn.` }) };
    }
    const output = tail(`${r.stdout ?? ""}${r.stderr ?? ""}`);
    return { code: 2, message: `The gates failed (\`${command}\`, exit ${r.status}). Fix them before you finish. If they also fail on the base branch without your change, say so and stop.\n${output}` };
  }
  return { code: 0 };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const { code, message, stdout } = handle(process.argv[2], JSON.parse(readFileSync(0, "utf8")));
    if (stdout) process.stdout.write(`${stdout}\n`);
    if (message) process.stderr.write(`${message}\n`);
    process.exit(code);
  } catch {
    process.exit(0); // never block on the hook's own failure
  }
}
