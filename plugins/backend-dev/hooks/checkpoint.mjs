#!/usr/bin/env node
// Checkpoint rows for this plugin's skills (rules/checkpoints.md).
//   node checkpoint.mjs invoked     PostToolUse(Skill): one row "invoked" when a skill of this plugin was loaded.
//                                   PostToolUse fires when the Skill tool returns the skill text, not when the work is done,
//                                   so the row says "invoked" and nothing here ever says "finished".
//   node checkpoint.mjs turn-ended  Stop: one row "turn ended", only if today's checkpoint file already exists.
// The file is <project>/.claude/checkpoints/<YYYY-MM-DD>-<session>.md. Every error path exits 0: a logging hook never blocks a tool.
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN = "backend-dev";

export function ownedSkills(root = PLUGIN_ROOT) {
  try { return readdirSync(join(root, "skills")); } catch { return []; }
}

const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString().slice(11, 19);

export function checkpointPath(input) {
  const project = process.env.CLAUDE_PROJECT_DIR || input?.cwd || process.cwd();
  return join(project, ".claude", "checkpoints", `${today()}-${input?.session_id || "local"}.md`);
}

function appendRow(file, skill, note) {
  mkdirSync(dirname(file), { recursive: true });
  if (!existsSync(file)) {
    writeFileSync(file, `# Checkpoints — ${today()}\n\nRows are written by the ${PLUGIN} hooks; phase entries are yours (rules/checkpoints.md).\n\n| time | plugin | skill | note |\n|---|---|---|---|\n`);
  }
  appendFileSync(file, `| ${now()} | ${PLUGIN} | ${skill} | ${note} |\n`);
}

// Returns the JSON to print on stdout, or null. Pure apart from the file writes, so tests call it directly.
export function handle(mode, input, root = PLUGIN_ROOT) {
  const file = checkpointPath(input);
  if (mode === "invoked") {
    const full = input?.tool_input?.skill;
    if (typeof full !== "string") return null;
    const bare = full.includes(":") ? full.slice(full.lastIndexOf(":") + 1) : full;
    const namespaced = full.includes(":") ? full.slice(0, full.lastIndexOf(":")) : null;
    if (!ownedSkills(root).includes(bare) || (namespaced && namespaced !== PLUGIN)) return null;
    appendRow(file, bare, "invoked");
    const rel = file.startsWith(process.cwd()) ? file.slice(process.cwd().length + 1) : file;
    return { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: `Checkpoint row written to ${rel}. Tick the phase entry there when a gate passes or blocks, and close with the Result block.` } };
  }
  if (mode === "turn-ended") {
    if (!existsSync(file)) return null;
    appendRow(file, "-", "turn ended");
    return null;
  }
  return null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const input = JSON.parse(readFileSync(0, "utf8"));
    const out = handle(process.argv[2], input);
    if (out) process.stdout.write(JSON.stringify(out) + "\n");
  } catch {
    // never block the tool call
  }
  process.exit(0);
}
