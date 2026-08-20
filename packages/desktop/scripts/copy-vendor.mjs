import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(here, "..");

function copy(from, to) {
  if (!existsSync(from)) {
    throw new Error(`Missing build output: ${from} (run "npm run build" in that workspace first)`);
  }
  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

copy(path.resolve(desktopRoot, "../server/dist"), path.join(desktopRoot, "vendor/server"));
copy(path.resolve(desktopRoot, "../web/dist"), path.join(desktopRoot, "vendor/web"));

// ws/undici have no runtime deps of their own, so vendoring just these two
// makes vendor/server fully self-contained — no reliance on electron-builder
// understanding npm workspace hoisting.
const repoRoot = path.resolve(desktopRoot, "../..");
for (const dep of ["ws", "undici"]) {
  copy(path.join(repoRoot, "node_modules", dep), path.join(desktopRoot, "vendor/server/node_modules", dep));
}

writeFileSync(
  path.join(desktopRoot, "vendor/server/package.json"),
  JSON.stringify({ type: "module" }, null, 2)
);

