// Reads the backend-dev profile block from the project's CLAUDE.md. The hooks take the repo's own commands and
// branch names from it; a repo without a profile, or a profile without the field, gets the hook's safe default.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const projectDir = (input) => process.env.CLAUDE_PROJECT_DIR || input?.cwd || process.cwd();

export function readProfile(dir) {
  try {
    const text = readFileSync(join(dir, "CLAUDE.md"), "utf8");
    return text.match(/<!-- backend-dev:profile:start -->([\s\S]*?)<!-- backend-dev:profile:end -->/)?.[1] ?? "";
  } catch {
    return "";
  }
}

// The text after "**<name>:**" on its line, or null.
export function field(profile, name) {
  return profile.match(new RegExp(`^\\*\\*${name}:\\*\\*(.*)$`, "m"))?.[1].trim() ?? null;
}

export const backticked = (text) => [...(text ?? "").matchAll(/`([^`]+)`/g)].map((m) => m[1]);
