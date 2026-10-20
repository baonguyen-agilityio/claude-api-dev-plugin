// PreToolUse hook (matcher: Bash). Blocks any `git push` that would update `main`.
// Input: hook JSON on stdin ({ tool_input: { command }, cwd }). Exit 2 blocks the call and
// sends stderr back to Claude; exit 0 lets it through. Unparseable input exits 0 on purpose:
// a broken guard must not lock every Bash call, so this hook fails open and CLAUDE.md says so.
// Test: node --test .claude/hooks/block-push-main.test.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export function currentBranch(cwd) {
  try {
    return execFileSync("git", ["-C", cwd, "branch", "--show-current"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

// One shell segment (already split on && ; || | and newlines). True when it pushes to main.
export function pushesToMain(segment, branch) {
  const m = segment.trim().match(/^git(?:\s+-[Cc]\s+\S+)*\s+push\b(.*)$/);
  if (!m) return false;
  const args = m[1].split(/\s+/).filter(Boolean).map((a) => a.replace(/^["']|["']$/g, ""));
  if (args.some((a) => a === "--all" || a === "--mirror")) return true;
  const positional = args.filter((a) => !a.startsWith("-"));
  const refspecs = positional.slice(1); // first positional is the remote
  if (refspecs.some((r) => /(^|:)\+?(refs\/heads\/)?main$/.test(r))) return true;
  // `git push`, `git push origin`, `git push origin HEAD`: pushes the current branch.
  const pushesCurrent = refspecs.length === 0 || refspecs.every((r) => r === "HEAD");
  return pushesCurrent && branch === "main";
}

export function decide(input) {
  const command = input?.tool_input?.command ?? "";
  const cwd = input?.cwd ?? process.cwd();
  const segments = command.split(/&&|\|\||;|\||\n/);
  if (!segments.some((s) => /\bgit\b/.test(s) && /\bpush\b/.test(s))) return null;
  const branch = currentBranch(cwd);
  const hit = segments.find((s) => pushesToMain(s, branch));
  return hit ? hit.trim() : null;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }
  const blocked = decide(input);
  if (blocked) {
    process.stderr.write(`Blocked by .claude/hooks/block-push-main.mjs: "${blocked}" would push to main. Open a pull request instead.\n`);
    process.exit(2);
  }
}
