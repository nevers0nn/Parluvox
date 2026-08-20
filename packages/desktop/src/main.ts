import { app, BrowserWindow, desktopCapturer, session, utilityProcess, type UtilityProcess } from "electron";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.setName("Parluvox");

const PORT = 8787;
const DEV_WEB_URL = process.env.PARLUVOX_WEB_URL ?? "http://localhost:5173";

let serverProcess: UtilityProcess | null = null;

function debugLog(message: string): void {
  appendFileSync(path.join(app.getPath("userData"), "desktop-debug.log"), `${new Date().toISOString()} ${message}\n`);
}

function exeDir(): string {
  return process.env.PORTABLE_EXECUTABLE_DIR ?? path.dirname(process.execPath);
}

function startBundledServer(): void {
  const vendorDir = path.join(__dirname, "..", "vendor");
  const entry = path.join(vendorDir, "server", "index.js");
  debugLog(`spawning server entry=${entry} cwd=${exeDir()}`);

  serverProcess = utilityProcess.fork(entry, [], {
    cwd: exeDir(),
    stdio: "pipe",
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR: app.getPath("userData"),
      WEB_DIST_DIR: path.join(vendorDir, "web"),
    },
  });

  serverProcess.stdout?.on("data", (chunk: Buffer) => debugLog(`[server stdout] ${chunk.toString().trim()}`));
  serverProcess.stderr?.on("data", (chunk: Buffer) => debugLog(`[server stderr] ${chunk.toString().trim()}`));
  serverProcess.on("exit", (code) => debugLog(`server process exited code=${code}`));
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await fetch(`${url}/health`);
      return;
    } catch {
      if (Date.now() > deadline) throw new Error(`Server at ${url} did not come up in time`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 960,
    height: 720,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setContentProtection(true);

  const url = app.isPackaged ? `http://localhost:${PORT}` : DEV_WEB_URL;
  if (app.isPackaged) {
    try {
      await waitForServer(url, 10_000);
    } catch (error) {
      debugLog(`waitForServer failed: ${(error as Error).message}`);
    }
  }
  debugLog(`loading ${url}`);
  win.loadURL(url);
}

app.whenReady().then(async () => {
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ["screen"] }).then((sources) => {
      callback({ video: sources[0], audio: "loopback" });
    });
  });

  if (app.isPackaged) startBundledServer();

  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  serverProcess?.kill();
});
