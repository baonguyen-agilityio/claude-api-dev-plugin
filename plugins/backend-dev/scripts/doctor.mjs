#!/usr/bin/env node
// Checks that this machine can work on the repo: tool versions against what the repo pins, dependencies installed,
// env files complete against their samples (key names only, values are never read out), the kit profile, the ticket CLI.
// Usage: node doctor.mjs [repo-root] [app-path]   app-path limits the env checks to the root and that app. Exit 1 on a FAIL line.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const app = process.argv[3];
const lines = [];
const out = (level, what, detail) => lines.push({ level, what, detail });
const read = (p) => readFileSync(p, "utf8");
const json = (p) => { try { return JSON.parse(read(p)); } catch { return null; } };
const run = (cmd, args) => { try { return execFileSync(cmd, args, { cwd: root, stdio: ["ignore", "pipe", "ignore"], timeout: 15000 }).toString().trim(); } catch { return null; } };
const major = (v) => (String(v ?? "").match(/\d+/) ?? [null])[0];

// env sample → env file pairs, root and one level of apps/packages
export const envKeys = (text) => text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => l.slice(0, l.indexOf("=")).replace(/^export\s+/, "").trim());
const SAMPLES = [[".dev.vars.example", ".dev.vars"], [".dev.vars.sample", ".dev.vars"], [".env.example", ".env"], [".env.sample", ".env"]];
const dirs = app ? [root, join(root, app)] : [root, ...["apps", "packages"].flatMap((d) => (existsSync(join(root, d)) ? readdirSync(join(root, d)).map((x) => join(root, d, x)).filter((p) => statSync(p).isDirectory()) : []))];

export function checkEnv(dir) {
  const found = [];
  for (const [sample, real] of SAMPLES) {
    if (!existsSync(join(dir, sample))) continue;
    const want = envKeys(read(join(dir, sample)));
    if (!existsSync(join(dir, real))) { found.push(["FAIL", `${relative(root, join(dir, real)) || real}`, `missing; copy ${sample} and ask the team for the values`]); continue; }
    const have = new Set(envKeys(read(join(dir, real))));
    const missing = want.filter((k) => !have.has(k));
    found.push(missing.length ? ["FAIL", relative(root, join(dir, real)), `keys missing: ${missing.join(", ")}`] : ["OK", relative(root, join(dir, real)), `${want.length} keys present`]);
  }
  return found;
}

function main() {
  const pkg = json(join(root, "package.json"));
  if (!pkg) { out("FAIL", "package.json", `not found in ${root}; run from the repo root`); return; }

  // Node: .node-version, .nvmrc, engines.node
  const nodeHave = process.versions.node;
  for (const f of [".node-version", ".nvmrc"]) if (existsSync(join(root, f))) {
    const want = read(join(root, f)).trim();
    out(major(want) === major(nodeHave) ? "OK" : "WARN", `node (${f})`, `repo pins ${want}, this machine has ${nodeHave}`);
  }
  if (pkg.engines?.node) out("INFO", "node (engines)", `package.json asks for ${pkg.engines.node}, this machine has ${nodeHave}`);
  const wf = join(root, ".github", "workflows");
  const ciNodes = new Set([...(existsSync(wf) ? readdirSync(wf).filter((f) => /\.ya?ml$/.test(f)).map((f) => read(join(wf, f))) : []), existsSync(join(root, ".gitlab-ci.yml")) ? read(join(root, ".gitlab-ci.yml")) : ""]
    .flatMap((t) => [...t.matchAll(/node-version:\s*['"]?([\d.x]+)|image:\s*node:([\d.]+)/g)].map((m) => m[1] ?? m[2])));
  if (ciNodes.size) out([...ciNodes].some((v) => major(v) !== major(nodeHave)) ? "WARN" : "OK", "node (CI)", `CI runs ${[...ciNodes].join(", ")}, this machine has ${nodeHave}`);

  // package manager
  const lock = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lockb"].find((f) => existsSync(join(root, f)));
  const pm = { "pnpm-lock.yaml": "pnpm", "package-lock.json": "npm", "yarn.lock": "yarn", "bun.lockb": "bun" }[lock] ?? "npm";
  const pmHave = run(pm, ["--version"]);
  if (!pmHave) out("FAIL", pm, `${pm} is not installed (the lockfile is ${lock})`);
  else if (pkg.packageManager?.startsWith(`${pm}@`)) {
    const want = pkg.packageManager.split("@")[1];
    out(major(want) === major(pmHave) ? "OK" : "WARN", pm, `repo pins ${want} (packageManager), this machine has ${pmHave}`);
  } else out("OK", pm, pmHave);
  out(existsSync(join(root, "node_modules")) ? "OK" : "FAIL", "dependencies", existsSync(join(root, "node_modules")) ? "node_modules present" : `not installed; run ${pm} install`);

  // env files
  for (const d of dirs) for (const [level, what, detail] of checkEnv(d)) out(level, what, detail);

  // kit profile
  const claude = existsSync(join(root, "CLAUDE.md")) ? read(join(root, "CLAUDE.md")) : "";
  const block = claude.match(/<!-- backend-dev:profile:start -->([\s\S]*?)<!-- backend-dev:profile:end -->/);
  if (!block) out("WARN", "kit profile", "no backend-dev:profile block in CLAUDE.md; a lead runs /backend-dev:kit-setup once");
  else {
    const open = (block[1].match(/\?:/g) ?? []).length;
    out(open ? "WARN" : "OK", "kit profile", open ? `${open} open question(s) for the lead in the profile` : "present");
  }
  if (existsSync(join(root, "docs", "onboarding.md"))) out("OK", "onboarding guide", "docs/onboarding.md"); else out("INFO", "onboarding guide", "none yet; /backend-dev:onboard writes it");

  // ticket CLI
  const remote = run("git", ["remote", "get-url", "origin"]) ?? "";
  if (/gitlab/i.test(remote) || existsSync(join(root, ".gitlab"))) {
    if (!run("glab", ["version"])) out("WARN", "glab", "not installed; /backend-dev:ticket <id> needs it (or paste the ticket text)");
    else out(run("glab", ["auth", "status"]) !== null ? "OK" : "WARN", "glab", run("glab", ["auth", "status"]) !== null ? "logged in" : "installed but not logged in; run glab auth login --hostname <your GitLab host>");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
  const w = Math.max(...lines.map((l) => l.what.length), 10);
  for (const l of lines) console.log(`${l.level.padEnd(4)}  ${l.what.padEnd(w)}  ${l.detail}`);
  process.exit(lines.some((l) => l.level === "FAIL") ? 1 : 0);
}
