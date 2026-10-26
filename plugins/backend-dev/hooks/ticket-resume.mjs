#!/usr/bin/env node
// SessionStart(compact): after the context is compacted, point Claude back at the ticket it was working on.
// A compacted summary can drop "stopped, waiting for the developer's go", so the ticket run could carry on unasked.
// The ticket is the state file in .backend-dev/tickets/ whose id appears in the current branch name, else the one
// updated in the last 12 hours. No such file: print nothing. Errors never stop the session.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { projectDir } from "./profile.mjs";

const RECENT_MS = 12 * 60 * 60 * 1000;

function currentBranch(dir) {
  const r = spawnSync("git", ["-C", dir, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "";
}

// The state file to resume from, or null.
export function activeTicket(dir, branch = currentBranch(dir), now = Date.now()) {
  const folder = join(dir, ".backend-dev", "tickets");
  let files;
  try {
    files = readdirSync(folder).filter((f) => f.endsWith(".md")).map((f) => ({ id: f.slice(0, -3), path: join(folder, f), mtime: statSync(join(folder, f)).mtimeMs }));
  } catch {
    return null;
  }
  const onBranch = files.find((f) => new RegExp(`(^|[/_-])${f.id.replace(/[^\w-]/g, "")}([/_-]|$)`).test(branch));
  if (onBranch) return onBranch;
  const recent = files.filter((f) => now - f.mtime < RECENT_MS).sort((a, b) => b.mtime - a.mtime);
  return recent[0] ?? null;
}

export function message(ticket, dir) {
  const rel = ticket.path.slice(dir.length + 1);
  const next = readFileSync(ticket.path, "utf8").match(/^\*\*Next:\*\*.*$/m)?.[0];
  return [
    `backend-dev: the context was just compacted while ticket ${ticket.id} was in progress. Before anything else, read ${rel} and show the workflow card from it.`,
    next ? `Its last next step: ${next}` : null,
    "If the run had stopped for the developer (after the analysis, at a decision or at a red gate), wait for their reply: a compacted summary is not their go.",
  ].filter(Boolean).join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const input = JSON.parse(readFileSync(0, "utf8"));
    const dir = projectDir(input);
    const ticket = activeTicket(dir);
    if (ticket) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: message(ticket, dir) } }) + "\n");
  } catch {
    // never block the session
  }
  process.exit(0);
}
