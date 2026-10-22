#!/usr/bin/env node
// Lints this plugin: manifest name = folder, SKILL.md frontmatter and description length, Result block,
// every ${CLAUDE_PLUGIN_ROOT}/... and rules/*.md reference, hooks exist and are runnable,
// references/architecture.md identical to docs/architecture.md, and eval coverage per skill.
// Usage: node plugins/backend-dev/scripts/check-plugin.mjs   (exit 1 on any problem)
import { accessSync, constants, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(ROOT, "..", "..");
const problems = [];
const err = (file, msg) => problems.push(`${relative(REPO, file)}: ${msg}`);
const read = (f) => readFileSync(f, "utf8");
const walk = (p) => (statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => walk(join(p, f))) : [p]);

function frontmatter(file) {
  const m = read(file).match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return err(file, "missing YAML frontmatter"), {};
  return Object.fromEntries(
    m[1].split("\n").map((l) => l.match(/^([a-z-]+):\s*(.*)$/)).filter(Boolean).map((x) => [x[1], x[2]]),
  );
}

// manifest
const manifest = JSON.parse(read(join(ROOT, ".claude-plugin/plugin.json")));
if (manifest.name !== ROOT.split("/").pop()) err(join(ROOT, ".claude-plugin/plugin.json"), `name "${manifest.name}" != folder`);
for (const k of ["version", "description", "repository", "license"]) if (!manifest[k]) err(join(ROOT, ".claude-plugin/plugin.json"), `missing ${k}`);
const market = JSON.parse(read(join(REPO, ".claude-plugin/marketplace.json")));
const entry = market.plugins.find((p) => p.name === manifest.name);
if (!entry) err(join(REPO, ".claude-plugin/marketplace.json"), `no entry for ${manifest.name}`);
else if (entry.version !== manifest.version) err(join(REPO, ".claude-plugin/marketplace.json"), `version ${entry.version} != plugin.json ${manifest.version}`);

// skills
const skills = readdirSync(join(ROOT, "skills")).filter((d) => statSync(join(ROOT, "skills", d)).isDirectory());
for (const name of skills) {
  const file = join(ROOT, "skills", name, "SKILL.md");
  if (!existsSync(file)) { err(file, "missing"); continue; }
  const fm = frontmatter(file);
  const body = read(file);
  if (fm.name !== name) err(file, `name "${fm.name}" != folder "${name}"`);
  const desc = fm.description ?? "";
  if (!/\bUse when\b/.test(desc)) err(file, "description must say when to use it, spec form: \"<what it does>. Use when …\" (agentskills.io specification)");
  
  if (desc.length > 1024) err(file, `description over 1024 chars (${desc.length})`);
  
  if (!/Worker|Firestore/.test(desc)) err(file, "description must name the stack (Workers or Firestore)");
  
  if (body.split("\n").length > 200) err(file, "SKILL.md over 200 lines; move detail to rules/ or references/");
  if (!/## Result|result-block\.md|## Output/.test(body)) err(file, "has neither a Result block nor an ## Output template");
  if (!fm["allowed-tools"]) err(file, "missing allowed-tools (state the permission boundary)");
  if (!/\*\*Next:\*\*/.test(body)) err(file, "output must end with a **Next:** line (the following step in the workflow)");
  if (!/backend-dev:profile/.test(body)) err(file, "must tell the reader to follow the project profile (backend-dev:profile block)");
}

// commands: typed by people, so a description and an argument hint are what they see in the menu
const cmdDir = join(ROOT, "commands");
for (const f of existsSync(cmdDir) ? readdirSync(cmdDir).filter((x) => x.endsWith(".md")) : []) {
  const fm = frontmatter(join(cmdDir, f));
  if (!fm.description) err(join(cmdDir, f), "missing description");
  if (!fm["allowed-tools"]) err(join(cmdDir, f), "missing allowed-tools");
}

// agents
for (const f of readdirSync(join(ROOT, "agents"))) {
  const fm = frontmatter(join(ROOT, "agents", f));
  if (fm.name !== f.replace(/\.md$/, "")) err(join(ROOT, "agents", f), "name != file name");
  if (!fm.description) err(join(ROOT, "agents", f), "missing description");
}

// references inside the plugin: ${CLAUDE_PLUGIN_ROOT}/<path> and `rules/<x>.md`
for (const file of walk(ROOT).filter((f) => /\.(md|json|sh|mjs)$/.test(f) && !f.includes("/templates/"))) {
  const text = read(file);
  for (const [, p] of text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9_./-]+[A-Za-z0-9_-])/g))
    if (!existsSync(join(ROOT, p))) err(file, `broken reference \${CLAUDE_PLUGIN_ROOT}/${p}`);
  for (const [, p] of text.matchAll(/`(rules\/[a-z-]+\.md)`/g))
    if (!existsSync(join(ROOT, p))) err(file, `broken reference ${p}`);
}

// the shipped design must be the repo's design
const shipped = join(ROOT, "references/architecture.md");
const source = join(REPO, "docs/architecture.md");
if (!existsSync(shipped)) err(shipped, "missing; copy docs/architecture.md");
else if (read(shipped) !== read(source)) err(shipped, "differs from docs/architecture.md; run: cp docs/architecture.md plugins/backend-dev/references/architecture.md");

// hooks
const hooksFile = join(ROOT, "hooks/hooks.json");
if (existsSync(hooksFile)) {
  const hooks = JSON.parse(read(hooksFile));
  for (const entries of Object.values(hooks.hooks ?? {}))
    for (const entry of entries)
      for (const h of entry.hooks ?? []) {
        const parts = h.command.replaceAll("${CLAUDE_PLUGIN_ROOT}", ROOT).replaceAll('"', "").split(" ");
        const viaShell = ["bash", "sh", "node"].includes(parts[0]);
        const script = viaShell ? parts[1] : parts[0];
        if (!existsSync(script)) err(hooksFile, `hook script missing: ${h.command}`);
        else if (!viaShell) try { accessSync(script, constants.X_OK); } catch { err(hooksFile, `hook not executable: ${h.command}`); }
      }
}

// evals: every skill needs a case that expects it, and there must be negatives
const evalDir = join(ROOT, "evals");
if (existsSync(evalDir)) {
  const graders = walk(evalDir).filter((f) => /\/graders\/[^/]+\.md$/.test(f) && !f.includes("/results/"));
  const text = graders.map(read).join("\n");
  for (const name of skills)
    if (!new RegExp(`\\b${name}\\b`).test(text)) err(evalDir, `no eval grader expects skill ${name}`);
  if (!/min:\s*0[\s\S]*max:\s*0/.test(text)) err(evalDir, "no negative (near-miss) case: a tool_used grader with min: 0 and max: 0");
}

if (problems.length) {
  console.error(`✖ ${problems.length} problem(s)\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`✔ ${manifest.name}: ${skills.length} skills, agent, rules, references in sync`);
