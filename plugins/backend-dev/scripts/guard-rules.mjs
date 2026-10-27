#!/usr/bin/env node
// Prints the permission rules kit-setup writes into a repo's .claude/settings.json:
//   deny: pushes to protected branches, a push that names no branch (its target comes from git config, which no rule
//         can see, so on a protected branch or one tracking it the push would reach it), skipping the repo's git
//         hooks, force pushes, AI attribution, and the Read and Edit tools on secret files;
//   ask:  any Bash command that names a secret file. The Read deny already stops cat, grep, head and cp on the file
//         (checked in real sessions); an interpreter that opens it (`node -e "...readFileSync('.dev.vars')..."`) is not
//         recognised as a read, so a person approves those.
// The harness matches a rule against the whole command with * as a wildcard, hence one rule per spelling.
// A branch may end in * to cover a family: `prod-*` blocks prod-eu and prod-eu-job. The rules then read
// `git push * prod-*`, so a feature branch that only contains the name (`feat/prod-x`) still pushes.
// Usage: node guard-rules.mjs <protected branch | prefix-*>...   (prints {"deny": [...], "ask": [...]})
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
  // A push with no branch: exact commands, so `git push origin feat/x` and `git push -u origin feat/x` stay allowed.
  "git push", "git push origin", "git push -u", "git push -u origin", "git push --set-upstream origin",
  "git -C * push", "git -C * push origin",
  "git commit *Co-Authored-By: Claude*", "git commit *Generated with*Claude*",
];
const SECRET_FILES = [".dev.vars", ".env", ".env.local"];

export function guardRules(branches) {
  return {
    deny: [
      ...branches.flatMap((b) => PER_BRANCH.map((p) => `Bash(${p.replaceAll("{b}", b)})`)),
      ...ONCE.map((p) => `Bash(${p})`),
      ...SECRET_FILES.flatMap((f) => [`Read(**/${f})`, `Edit(**/${f})`]),
    ],
    // Broad on purpose: the name can sit inside quotes or code. Samples (.dev.vars.example) get asked about too.
    ask: ["Bash(*.dev.vars*)", "Bash(*.env*)"],
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const branches = process.argv.slice(2).filter((b) => /^[\w./-]+\*?$/.test(b));
  if (!branches.length) {
    console.error("usage: guard-rules.mjs <protected branch | prefix-*>...");
    process.exit(1);
  }
  console.log(JSON.stringify(guardRules(branches), null, 2));
}
