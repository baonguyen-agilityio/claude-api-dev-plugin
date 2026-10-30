#!/usr/bin/env node
// Release gate: who may ship what, enforced by the harness in every permission mode, bypass included.
//   node release-gate.mjs prompt  UserPromptSubmit: reads what the developer typed (never what the model wrote).
//                                 `/backend-dev:release prod` marks the current commit as waiting; a bare `go` after it
//                                 approves that commit for production, but only when the last release report in the
//                                 transcript says `**Verdict:** GO`: a go typed after a NO-GO approves nothing. Other
//                                 environments record nothing.
//   node release-gate.mjs bash    PreToolUse(Bash): a command that ships (`wrangler deploy` without --dry-run,
//                                 `wrangler versions deploy`, `wrangler rollback`, `wrangler secret put|delete|bulk`,
//                                 a `deploy:<env>` package script, `firebase deploy`) is decided by its environment:
//                                   production: allowed only with an approval for the checked-out commit, the working
//                                     tree clean and the approval under an hour old; otherwise refused with the route.
//                                   any other named environment: asked, with the commit it ships.
//                                   no environment named: refused, since the top-level config is not an environment.
//                                 A command that names the gate file is refused too.
//   node release-gate.mjs edit    PreToolUse(Edit|Write|MultiEdit): the gate file is never edited by a tool.
// An allowed release still goes through the normal permission prompt; the gate only adds a condition. A refusal's
// reason reaches Claude, so it names the route for Claude to pass on; an ask's reason is shown to the person.
// In a non-interactive run nobody answers an ask, so Claude Code denies it. Limits: names, not what they point to
// (a script that calls wrangler, an alias, a symlinked gate file) are not seen. The hook's own failures never block.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { projectDir } from "./profile.mjs";

const MAX_AGE_MS = 60 * 60 * 1000;
const GO = /^\s*(go|ok,?\s*go|approve[d]?|duyệt|lgtm)\s*[.!]?\s*$/i;
const PROD = /^(prod|production)([-_.][\w.-]*)?$/i;
const GATE_FILE = "release-gate.json";

const gatePath = (dir) => join(dir, ".backend-dev", GATE_FILE);
function readGate(dir) {
  try { return JSON.parse(readFileSync(gatePath(dir), "utf8")); } catch { return {}; }
}
function writeGate(dir, gate) {
  const folder = join(dir, ".backend-dev");
  mkdirSync(folder, { recursive: true });
  if (!existsSync(join(folder, ".gitignore"))) writeFileSync(join(folder, ".gitignore"), "*\n");
  writeFileSync(gatePath(dir), JSON.stringify(gate) + "\n");
}

const git = (dir, ...args) => {
  const r = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
};
const head = (dir) => git(dir, "rev-parse", "HEAD");
// Untracked files count: wrangler bundles what is on disk, not what is committed.
const clean = (dir) => git(dir, "status", "--porcelain") === "";

export function onPrompt(input, now = Date.now()) {
  const dir = projectDir(input);
  const prompt = typeof input?.prompt === "string" ? input.prompt : "";
  const gate = readGate(dir);
  const env = prompt.match(/^\s*\/backend-dev:release\s+(\S+)\s*$/)?.[1];
  if (env) {
    const { pending, ...rest } = gate; // a new release request replaces a pending one
    return writeGate(dir, PROD.test(env) ? { ...rest, pending: { env, sha: head(dir), at: now } } : rest);
  }
  if (gate.pending && GO.test(prompt)) {
    const { pending, ...rest } = gate;
    if (pending.sha && lastVerdict(input?.transcript_path) === "GO") writeGate(dir, { ...rest, approved: { env: pending.env, sha: pending.sha, at: now } });
    else writeGate(dir, rest); // the go answered a NO-GO or nothing: the request is spent
  }
}

// The verdict of the last release report Claude showed: "GO", "NO-GO" or null.
export function lastVerdict(transcriptPath) {
  let verdict = null;
  try {
    for (const line of readFileSync(transcriptPath, "utf8").split("\n")) {
      if (!line.includes("Verdict:")) continue;
      const msg = JSON.parse(line)?.message;
      if (msg?.role !== "assistant" || !Array.isArray(msg.content)) continue;
      for (const block of msg.content) {
        const m = block?.type === "text" && block.text.match(/\*\*Verdict:\*\*\s*(NO-GO|GO)\b/g);
        if (m) verdict = m.at(-1).includes("NO-GO") ? "NO-GO" : "GO";
      }
    }
  } catch { /* no transcript: no verdict */ }
  return verdict;
}

// Each shell segment that ships, with the environment it names ("" when none).
export function releases(command) {
  const out = [];
  for (const seg of command.split(/&&|\|\||[;|\n]/)) {
    const s = seg.trim();
    const envFlag = s.match(/(?:^|\s)(?:--env|-e)(?:=|\s+)["']?([\w.-]+)/)?.[1] ?? "";
    if (/\bwrangler\s+(deploy|versions\s+deploy|rollback|secret\s+(put|delete|bulk))\b/.test(s) && !/--dry-run\b/.test(s)) {
      out.push({ what: s, env: envFlag });
      continue;
    }
    const script = s.match(/\b(?:pnpm|npm|yarn|bun)\b.*?\b(?:run\s+)?deploy:([\w.-]+)/);
    if (script) { out.push({ what: s, env: script[1] }); continue; }
    if (/\bfirebase\s+deploy\b/.test(s)) {
      const project = s.match(/(?:--project|-P)(?:=|\s+)["']?([\w.-]+)/)?.[1] ?? "";
      out.push({ what: s, env: /prod/i.test(project) ? "prod" : project });
    }
  }
  return out;
}

const ROUTE = "Run /backend-dev:release prod; when it reports GO the developer types go, which approves the checked-out commit for an hour. Then deploy again from that commit with a clean working tree.";

// Returns { code, message } to refuse (2), { ask } to ask, or { code: 0 }.
export function onBash(input, now = Date.now()) {
  const dir = projectDir(input);
  const command = typeof input?.tool_input?.command === "string" ? input.tool_input.command : "";
  if (command.includes(GATE_FILE)) {
    return { code: 2, message: `Blocked: the shell never touches .backend-dev/${GATE_FILE}; only the hook that reads what the developer types writes it. ${ROUTE}` };
  }
  const found = releases(command);
  if (!found.length) return { code: 0 };
  const sha = head(dir);
  const short = sha ? sha.slice(0, 7) : "an unknown commit";
  const asks = [];
  for (const { what, env } of found) {
    if (!env) {
      return { code: 2, message: `Blocked: \`${what}\` names no environment, so it would ship the top-level config. Name the environment (--env <name>, or the deploy:<env> script) and run it again.` };
    }
    if (PROD.test(env)) {
      const ok = readGate(dir).approved;
      const why = !ok ? "there is no release approval"
        : ok.sha !== sha ? `the approval is for ${String(ok.sha).slice(0, 7)}, the checkout is at ${short}`
        : now - ok.at > MAX_AGE_MS ? "the approval is more than an hour old"
        : !clean(dir) ? "the working tree has uncommitted changes, which would ship with it"
        : null;
      if (why) return { code: 2, message: `Blocked: \`${what}\` ships to production and ${why}. ${ROUTE}` };
      continue;
    }
    asks.push(env);
  }
  if (asks.length) {
    const dirty = clean(dir) ? "" : " The working tree has uncommitted changes, which ship with it.";
    return { code: 0, ask: `This ships ${short} to ${[...new Set(asks)].join(", ")}.${dirty} Approve only if you own this release.` };
  }
  return { code: 0 };
}

export function onEdit(input) {
  const dir = projectDir(input);
  const i = input?.tool_input ?? {};
  for (const path of [i.file_path, i.notebook_path].filter((p) => typeof p === "string")) {
    const rel = relative(dir, isAbsolute(path) ? path : resolve(dir, path)).split(sep).join("/");
    if (rel === `.backend-dev/${GATE_FILE}`) {
      return { code: 2, message: `Blocked: .backend-dev/${GATE_FILE} is written only by the hook that reads what the developer types. ${ROUTE}` };
    }
  }
  return { code: 0 };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const input = JSON.parse(readFileSync(0, "utf8"));
    if (process.argv[2] === "prompt") { onPrompt(input); process.exit(0); }
    const { code, message, ask } = process.argv[2] === "bash" ? onBash(input) : onEdit(input);
    if (message) process.stderr.write(`${message}\n`);
    if (ask) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: ask } }));
    process.exit(code);
  } catch {
    process.exit(0); // never block on the hook's own failure
  }
}
