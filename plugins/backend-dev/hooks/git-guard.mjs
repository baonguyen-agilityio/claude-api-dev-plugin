#!/usr/bin/env node
// PreToolUse(Bash): stops git commands that bypass the repo's checks, whatever CLAUDE.md says:
//   - commit or push with --no-verify (commit -n), which skips husky and the like;
//   - a commit message carrying an AI attribution line;
//   - a push to a protected branch (profile line "**Protected branches:** `main`, `dev`"; default main and master),
//     including --all, --mirror, a bare push from a protected branch and a delete of one;
//   - a force push other than --force-with-lease, and a push whose target cannot be read (built from $VAR or `…`).
// The command is split into words the way the shell does, so `git -C dir push origin HEAD:main` is caught.
// Exit 2 blocks the call and tells Claude why. The server's branch protection and the repo's own hooks still apply.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { backticked, field, projectDir, readProfile } from "./profile.mjs";

const ATTRIBUTION = /co-authored-by:[^\n]*(claude|anthropic)|generated with \[?claude/i;

// Shell-like split into commands (on unquoted ; && || | and newlines) and words (quotes and backslashes honoured).
export function commands(line) {
  const out = [];
  let words = [], word = "", quote = null, has = false;
  const endWord = () => { if (has) words.push(word); word = ""; has = false; };
  const endCommand = () => { endWord(); if (words.length) out.push(words); words = []; };
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === "\\" && quote === '"' && i + 1 < line.length) word += line[++i];
      else word += c;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; has = true; }
    else if (c === "\\" && i + 1 < line.length) { word += line[++i]; has = true; }
    else if (c === " " || c === "\t") endWord();
    else if (c === "\n" || c === ";" || c === "|" || c === "&") { endCommand(); if ((c === "&" || c === "|") && line[i + 1] === c) i++; }
    else { word += c; has = true; }
  }
  endCommand();
  return out;
}

// { dir, sub, args } for a git invocation, or null.
export function gitCall(words, cwd) {
  let i = 0;
  while (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i])) i++;
  if (!/(^|\/)git$/.test(words[i] ?? "")) return null;
  let dir = cwd;
  for (i++; i < words.length; i++) {
    const w = words[i];
    if (w === "-C") dir = words[++i];
    else if (w === "-c" || w === "--git-dir" || w === "--work-tree") i++;
    else if (w.startsWith("-")) continue;
    else return { dir, sub: w, args: words.slice(i + 1) };
  }
  return null;
}

const shortFlag = (arg, letter) => /^-[A-Za-z]+$/.test(arg) && arg.slice(1).includes(letter);

function currentBranch(dir) {
  const r = spawnSync("git", ["-C", dir, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

// The reason to block, or null.
export function check(command, cwd, protectedBranches, branchOf = currentBranch) {
  for (const words of commands(command)) {
    const call = gitCall(words, cwd);
    if (!call) continue;
    const { sub, args } = call;
    if (sub === "commit") {
      if (args.includes("--no-verify") || args.some((a) => shortFlag(a, "n"))) return "git commit --no-verify skips the repo's commit hooks. Fix what the hook reports instead.";
      if (ATTRIBUTION.test(command)) return "The commit message carries an AI attribution line. Remove it; this kit never adds one.";
    }
    if (sub === "push") {
      if (args.includes("--no-verify")) return "git push --no-verify skips the repo's push hooks. Fix what the hook reports instead.";
      if (args.includes("--all") || args.includes("--mirror")) return "git push --all/--mirror would push protected branches. Push the one feature branch by name.";
      const force = args.includes("--force") || args.some((a) => shortFlag(a, "f"));
      const refs = args.filter((a) => !a.startsWith("-"));
      if (force || refs.slice(1).some((r) => r.startsWith("+"))) return "Force push is blocked. Use --force-with-lease on your own feature branch.";
      const targets = refs.length > 1
        ? refs.slice(1).map((r) => (r.includes(":") ? r.split(":").pop() : r).replace(/^\+/, "").replace(/^refs\/heads\//, ""))
        : [branchOf(call.dir)];
      for (const t of targets) {
        if (t == null) continue;
        if (/[$`]/.test(t)) return `Cannot tell which branch "${t}" pushes to. Name the branch literally.`;
        const name = t === "HEAD" ? branchOf(call.dir) : t;
        if (protectedBranches.includes(name)) return `Pushing to the protected branch "${name}" is blocked. Push a feature branch and open a merge or pull request.`;
      }
    }
  }
  return null;
}

export function protectedFrom(profile) {
  const names = backticked(field(profile, "Protected branches"));
  return names.length ? names : ["main", "master"];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const input = JSON.parse(readFileSync(0, "utf8"));
    const command = input?.tool_input?.command;
    const dir = projectDir(input);
    const reason = typeof command === "string" && /\bgit\b/.test(command) ? check(command, input?.cwd || dir, protectedFrom(readProfile(dir))) : null;
    if (reason) {
      process.stderr.write(`Blocked by backend-dev git guard: ${reason}\n`);
      process.exit(2);
    }
  } catch {
    // a guard that cannot read its input lets the call through; the repo's hooks and the server still apply
  }
  process.exit(0);
}
