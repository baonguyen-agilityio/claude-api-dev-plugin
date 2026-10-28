#!/usr/bin/env node
// Copy the template into a new API folder. A Node script instead of `cp -R` because `cp` with flags
// always needs a manual approval in Claude Code, while `node <script>` can be pre-approved.
// Usage: node scaffold.mjs <dir>   (writes .claude/settings.json unless present; dir must be absent or empty apart from .git, .claude and .DS_Store; existing files are never overwritten;
// build and install artefacts are never copied)
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { guardRules } from "./guard-rules.mjs";

const dir = process.argv[2];
if (!dir) { console.error("usage: scaffold.mjs <dir>"); process.exit(1); }
const target = resolve(dir);
const ALLOWED_PRESENT = new Set([".git", ".claude", ".DS_Store"]);
const present = existsSync(target) ? readdirSync(target).filter((f) => !ALLOWED_PRESENT.has(f)) : [];
if (present.length) { console.error(`refusing: ${target} is not empty (${present.slice(0, 5).join(", ")})`); process.exit(1); }
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "templates");
mkdirSync(target, { recursive: true });
const SKIP = new Set(["node_modules", ".wrangler", "dist", "coverage", ".dev.vars"]);
cpSync(SRC, target, { recursive: true, force: false, errorOnExist: false, filter: (p) => !p.slice(SRC.length).split("/").some((seg) => SKIP.has(seg)) });
// The design note the template code cites ("architecture §N") ships with every project copy.
mkdirSync(join(target, "docs"), { recursive: true });
if (!existsSync(join(target, "docs", "architecture.md"))) cpSync(join(SRC, "..", "references", "architecture.md"), join(target, "docs", "architecture.md"));
// The settings kit-setup writes, so a new project has no AI attribution and the guard rules before anyone runs kit-setup.
const settings = join(target, ".claude", "settings.json");
if (!existsSync(settings)) {
  const { deny, ask } = guardRules(["main"]);
  const allow = ["pnpm install", "pnpm typecheck", "pnpm test", "pnpm check"].map((c) => `Bash(${c})`);
  mkdirSync(dirname(settings), { recursive: true });
  writeFileSync(settings, JSON.stringify({ attribution: { commit: "", pr: "" }, permissions: { allow, deny, ask } }, null, 2) + "\n");
}
const n = readdirSync(target).length;
console.log(`copied the template into ${target} (${n} top-level entries)\nnext: cd ${target} && pnpm install && cp apps/api/.dev.vars.example apps/api/.dev.vars, then rename (package.json, apps/api/wrangler.toml, API_INFO in apps/api/src/constants/routes.ts) and run: pnpm typecheck && pnpm test && pnpm check`);
