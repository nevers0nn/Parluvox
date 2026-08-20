import { readFileSync, existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";

function findUp(filename: string, startDir: string): string | null {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, filename);
    if (existsSync(candidate)) return candidate;
    const parentDir = dirname(dir);
    if (parentDir === dir || dir === parse(dir).root) return null;
    dir = parentDir;
  }
}

export function loadDotEnv(filename = ".env"): void {
  const path = findUp(filename, process.cwd());
  if (!path) return;

  const lines = readFileSync(path, "utf8").split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
