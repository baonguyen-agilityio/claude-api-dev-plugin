#!/usr/bin/env node
// Prints the permissions.deny rules that keep Claude from pushing to protected branches, skipping the repo's git hooks,
// force pushing, adding AI attribution and opening secret files. kit-setup pastes the output into .claude/settings.json.
// The harness matches a rule against the whole command with * as a wildcard, hence one rule per spelling.
// Usage: node guard-rules.mjs <protected branch>...   (prints a JSON array)
import { fileURLToPath } from "node:url";

const PER_BRANCH = [
  "git push * {b}", "git push * {b} *", "git push *:{b}", "git push *:{b} *",
  "git -C * push * {b}", "git -C * push * {b} *", "git -C * push *:{b}", "git -C * push *:{b} *",
  "git push *refs/heads/{b}*",
];
// No space before --force/-f: "git push * --force" would miss "git push --force origin x".
const ONCE = [
  "git commit *--no-verify*", "git commit -n*", "git commit * -n*", "git push *--no-verify*",
  "git push *--force", "git push *--force *", "git push *-f", "git push *-f *", "git push * +*",
  "git push *--all*", "git push *--mirror*",
  "git commit *Co-Authored-By: Claude*", "git commit *Generated with*Claude*",
];
const SECRET_FILES = [".dev.vars", ".env", ".env.local"];

export function guardRules(branches) {
  return [
    ...branches.flatMap((b) => PER_BRANCH.map((p) => `Bash(${p.replaceAll("{b}", b)})`)),
    ...ONCE.map((p) => `Bash(${p})`),
    ...SECRET_FILES.flatMap((f) => [`Read(**/${f})`, `Edit(**/${f})`]),
  ];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const branches = process.argv.slice(2).filter((b) => /^[\w./-]+$/.test(b));
  if (!branches.length) {
    console.error("usage: guard-rules.mjs <protected branch>...");
    process.exit(1);
  }
  console.log(JSON.stringify(guardRules(branches), null, 2));
}
