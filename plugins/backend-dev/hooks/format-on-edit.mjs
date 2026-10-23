#!/usr/bin/env node
// PostToolUse(Edit|Write|MultiEdit): format and lint the file Claude just changed, with the repo's own commands from
// the profile line
//   **On edit:** format `pnpm exec prettier --write {file}`; lint `pnpm exec eslint --max-warnings=0 {file}`; files `.ts .tsx .js .json`
// Commands run from the project root with {file} replaced by the quoted path relative to it.
// Lint errors (exit code 1) go back to Claude with exit 2 so they are fixed now, not at commit time. Anything else
// (no profile line, a file type the line does not list, a missing tool, a crash, a timeout) exits 0 and says nothing:
// a formatting hook never stops the work.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { field, projectDir, readProfile } from "./profile.mjs";

export function onEditConfig(profile) {
  const line = field(profile, "On edit");
  if (!line || /^(none|\?:)/i.test(line)) return null;
  const pick = (key) => line.match(new RegExp(`${key}\\s+\`([^\`]+)\``))?.[1] ?? null;
  const files = pick("files");
  const config = { format: pick("format"), lint: pick("lint"), exts: files ? files.split(/[\s,]+/).filter(Boolean) : [] };
  return config.format || config.lint ? config : null;
}

const quote = (path) => `'${path.replace(/'/g, `'\\''`)}'`;
const fill = (command, file) => command.replaceAll("{file}", quote(file));
const tail = (text, n = 40) => text.trim().split("\n").slice(-n).join("\n");

// Returns { code, message }: code 2 means "tell Claude", 0 means "say nothing".
export function handle(input, exec = (cmd, cwd) => spawnSync(cmd, { cwd, shell: true, encoding: "utf8", timeout: 60_000 })) {
  const dir = projectDir(input);
  const config = onEditConfig(readProfile(dir));
  const path = input?.tool_input?.file_path;
  if (!config || typeof path !== "string") return { code: 0 };
  const abs = isAbsolute(path) ? path : resolve(dir, path);
  const rel = relative(dir, abs);
  if (!rel || rel.startsWith("..") || isAbsolute(rel) || !existsSync(abs)) return { code: 0 };
  if (config.exts.length && !config.exts.includes(extname(abs))) return { code: 0 };

  if (config.format) exec(fill(config.format, rel), dir);
  if (config.lint) {
    const r = exec(fill(config.lint, rel), dir);
    if (r.status === 1) {
      return { code: 2, message: `Lint errors in ${rel} (${config.lint.replaceAll("{file}", rel)}). Fix them before going on:\n${tail(`${r.stdout ?? ""}${r.stderr ?? ""}`)}` };
    }
  }
  return { code: 0 };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const { code, message } = handle(JSON.parse(readFileSync(0, "utf8")));
    if (message) process.stderr.write(`${message}\n`);
    process.exit(code);
  } catch {
    process.exit(0); // never block the work on the hook's own failure
  }
}
