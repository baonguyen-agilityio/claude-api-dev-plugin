#!/usr/bin/env node
// Generate a module from the plugin's `items` sample: copies code + tests, renames identifiers, registers it.
// Usage: node new-module.mjs <api-dir> <plural> <singular>   e.g. node new-module.mjs . orderLines orderLine
// Refuses to overwrite an existing module. Copies from the plugin, so the project may delete `items`.
import { cpSync, existsSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [dir, plural, singular] = process.argv.slice(2);
if (!dir || !plural || !singular || !/^[a-z][A-Za-z0-9]*$/.test(plural) || !/^[a-z][A-Za-z0-9]*$/.test(singular)) {
  console.error("usage: new-module.mjs <api-dir> <plural camelCase> <singular camelCase>");
  process.exit(1);
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "templates", "src", "modules", "items");
const DEST = join(dir, "src", "modules", plural);
if (existsSync(DEST)) { console.error(`refusing to overwrite ${DEST}`); process.exit(1); }

cpSync(SRC, DEST, { recursive: true });
const rename = (s) => s.replaceAll("Items", cap(plural)).replaceAll("items", plural).replaceAll("Item", cap(singular)).replaceAll("item", singular);
const walk = (p) => (statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => walk(join(p, f))) : [p]);
for (const file of walk(DEST)) {
  writeFileSync(file, rename(readFileSync(file, "utf8")));
  const to = join(dirname(file), rename(file.split("/").pop()));
  if (to !== file) renameSync(file, to);
}
const registry = join(dir, "src", "modules", "index.ts");
let reg = readFileSync(registry, "utf8");
reg = reg.replace(/(import \{ itemsModule \} from "\.\/items";\n)/, `$1import { ${plural}Module } from "./${plural}";\n`);
reg = reg.replace(/export const modules: readonly Module\[\] = \[([^\]]*)\];/, (_, list) => `export const modules: readonly Module[] = [${list.trim()}, ${plural}Module];`);
writeFileSync(registry, reg);
console.log(`created ${DEST} and registered ${plural}Module\nnext: set the real fields in models/${singular}.model.ts, adapt schemas/services/routes/tests, then: npm run typecheck && npm test && npm run check`);
