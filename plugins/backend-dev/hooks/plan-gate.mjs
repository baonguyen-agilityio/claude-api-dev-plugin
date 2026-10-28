#!/usr/bin/env node
// Two guards on the ticket flow that the harness enforces, not the model.
//
// Plan gate: no source edit before the developer approved the ticket's plan.
//   node plan-gate.mjs prompt  UserPromptSubmit: reads what the developer typed (never what the model wrote).
//                              `/backend-dev:ticket …`, `/backend-dev:plan …` and `/backend-dev:build "<text>"` open the
//                              gate as pending; `/backend-dev:build <id>` approves it; after `/backend-dev:build "<text>"`
//                              a bare `go` approves it too. A command with no argument leaves the gate as it is (the
//                              skill asks which ticket).
//   node plan-gate.mjs edit    PreToolUse(Edit|Write|MultiEdit|NotebookEdit): while the gate is pending, an edit outside
//                              the ticket record (`docs/tickets/`, `docs/incidents/`, `.backend-dev/`) exits 2. The gate
//                              file itself is never editable this way, pending or not.
// The gate is <project>/.backend-dev/plan-gate.json, one per checkout (one ticket per checkout). No gate file: nothing
// is blocked, so plain requests outside the ticket flow work as before.
//
// Record guard: an edit that would write a secret value into `docs/tickets/` or `docs/incidents/` exits 2, so a key
// pasted into a ticket never reaches a commit.
//   node plan-gate.mjs bash    PreToolUse(Bash): a shell command that names the gate file exits 2. The permission rules
//                              cannot do this alone: they match `rm`/`cp`/`tee` on the file but not a `> file` redirect.
//                              A command that names a secret file (`.dev.vars`, `.env*`) asks the developer first, for
//                              the same reason: the `ask` rules miss `cat < .dev.vars` and `echo x > .dev.vars`.
// Other shell writes (sed on a source file, a script) are not seen, nor a name the shell builds (`plan-g*te.json`,
// `f=.dev; cat $f.vars`). The hook's own failures never block.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { projectDir } from "./profile.mjs";

const RECORD = ["docs/tickets/", "docs/incidents/", ".backend-dev/"];
const SECRETS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /"private_key"\s*:\s*"/, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
  /\bglpat-[A-Za-z0-9_-]{20,}\b/, /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/, /\bsk-[A-Za-z0-9_-]{20,}\b/, /\bAIza[0-9A-Za-z_-]{35}\b/,
];
// A secret file name as a path segment; `process.env` is not one (a word character before the dot). Samples
// (`.env.example`, `.dev.vars.sample`) hold no secret, so they pass.
const SECRET_FILE = /(?:^|[^\w.])(\.(?:dev\.vars|env)[.\w-]*)(?![\w])/g;
const SAMPLE = /\.(example|sample)$/;
const GO = /^\s*(go|ok,?\s*go|approve[d]?|duyệt|lgtm)\s*[.!]?\s*$/i;

const gatePath = (dir) => join(dir, ".backend-dev", "plan-gate.json");
function readGate(dir) {
  try { return JSON.parse(readFileSync(gatePath(dir), "utf8")); } catch { return null; }
}
function writeGate(dir, gate) {
  const folder = join(dir, ".backend-dev");
  mkdirSync(folder, { recursive: true });
  if (!existsSync(join(folder, ".gitignore"))) writeFileSync(join(folder, ".gitignore"), "*\n");
  writeFileSync(gatePath(dir), JSON.stringify({ ...gate, at: new Date().toISOString() }) + "\n");
}

// The command's argument without flags; one token (an id, `#412`, a URL) is a ticket reference, anything else is text.
function argument(prompt, command) {
  const m = prompt.match(new RegExp(`^\\s*/backend-dev:${command}(?:\\s+([\\s\\S]*))?$`));
  if (!m) return null;
  return (m[1] ?? "").replace(/(^|\s)--learn(?=\s|$)/g, " ").trim();
}
const isReference = (arg) => /^\S+$/.test(arg) && !/^["']/.test(arg);

export function onPrompt(input) {
  const dir = projectDir(input);
  const prompt = typeof input?.prompt === "string" ? input.prompt : "";
  const gate = readGate(dir);
  // No argument: the skill asks which ticket, so the gate stays as it is.
  if ([argument(prompt, "ticket"), argument(prompt, "plan"), argument(prompt, "build")].includes("")) return;
  if (argument(prompt, "ticket") !== null) return writeGate(dir, { state: "pending", via: "ticket" });
  const plan = argument(prompt, "plan");
  if (plan !== null) return writeGate(dir, { state: "pending", via: isReference(plan) ? "plan" : "plan-text" });
  const build = argument(prompt, "build");
  if (build !== null) return writeGate(dir, isReference(build) ? { state: "approved", via: "build" } : { state: "pending", via: "build-text" });
  if (gate?.state === "pending" && gate.via === "build-text" && GO.test(prompt)) return writeGate(dir, { state: "approved", via: "go" });
}

function editedPaths(tool) {
  const i = tool?.tool_input ?? {};
  return [i.file_path, i.notebook_path].filter((p) => typeof p === "string");
}
function writtenText(tool) {
  const i = tool?.tool_input ?? {};
  return [i.content, i.new_string, ...(Array.isArray(i.edits) ? i.edits.map((e) => e?.new_string) : [])].filter((t) => typeof t === "string").join("\n");
}

// Returns { code, message }: 2 blocks the edit and tells Claude why.
export function onEdit(input) {
  const dir = projectDir(input);
  for (const path of editedPaths(input)) {
    const rel = relative(dir, isAbsolute(path) ? path : resolve(dir, path)).split(sep).join("/");
    if (rel === ".." || rel.startsWith("../") || isAbsolute(rel)) continue;
    if (rel === ".backend-dev/plan-gate.json") {
      return { code: 2, message: "Blocked: .backend-dev/plan-gate.json is written only by the hook that reads what the developer types. Ask the developer to approve the plan (/backend-dev:build <id>, or go after /backend-dev:build \"<text>\")." };
    }
    const inRecord = RECORD.some((p) => rel.startsWith(p));
    if (inRecord && rel.startsWith("docs/") && SECRETS.some((re) => re.test(writtenText(input)))) {
      return { code: 2, message: `Blocked: this edit would write a secret value into ${rel}. The ticket and incident records name keys and ids only, never a value. If a secret was pasted into the ticket, treat it as a leak: stop and run /backend-dev:incident.` };
    }
    if (!inRecord && readGate(dir)?.state === "pending") {
      return { code: 2, message: `Blocked: the plan for the ticket in progress is not approved yet, so no source file may change (${rel}). Show plan.md and wait for the developer: they approve with /backend-dev:build <id>, or with "go" after /backend-dev:build "<text>". If they are leaving the ticket for unrelated work, they remove .backend-dev/plan-gate.json themselves.` };
    }
  }
  return { code: 0 };
}

// Returns { code, message } for a shell command: 2 when it names the gate file; `ask` when it names a secret file.
export function onBash(input) {
  const command = typeof input?.tool_input?.command === "string" ? input.tool_input.command : "";
  if (/plan-gate/.test(command)) {
    return { code: 2, message: "Blocked: the plan gate file is written only by the hook that reads what the developer types, never from the shell. Ask the developer to approve the plan, or to remove .backend-dev/plan-gate.json themselves if they are leaving the ticket." };
  }
  const secret = [...command.matchAll(SECRET_FILE)].map((m) => m[1]).find((f) => !SAMPLE.test(f));
  if (secret) {
    return { code: 0, ask: `This command names ${secret}, a file that holds secrets. Approve only if it neither prints nor changes a secret value.` };
  }
  return { code: 0 };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const input = JSON.parse(readFileSync(0, "utf8"));
    if (process.argv[2] === "prompt") { onPrompt(input); process.exit(0); }
    if (process.argv[2] === "bash") {
      const { code, message, ask } = onBash(input);
      if (message) process.stderr.write(`${message}\n`);
      if (ask) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: ask } }));
      process.exit(code);
    }
    const { code, message } = onEdit(input);
    if (message) process.stderr.write(`${message}\n`);
    process.exit(code);
  } catch {
    process.exit(0); // never block on the hook's own failure
  }
}
