import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, statSync, createReadStream } from "node:fs";
import { extname, join, normalize } from "node:path";
import { WebSocketServer } from "ws";
import { loadConfig } from "../config.js";
import { createLlmProviderFromConfig } from "../llm/factory.js";
import type { LlmProvider } from "../llm/types.js";
import { createFileQaRepository } from "../repository/qaRepository.js";
import type { QaRepository } from "../repository/qaRepository.js";
import { createDeepgramProvider } from "../stt/deepgramProvider.js";
import type { SttProvider } from "../stt/types.js";
import { handleSessionSocket } from "../ws/sessionSocket.js";

export interface ServerDeps {
  llm: LlmProvider;
  stt: SttProvider;
  repository: QaRepository;
  webDistDir?: string;
}

// Only reached when packages/desktop bundles a built packages/web alongside
// the server (see webDistDir) — the normal dev setup serves web/ via Vite
// and never hits this. No router on the client side, so any path that
// isn't a real file in webDistDir falls back to index.html.
const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

function serveStatic(webDistDir: string, req: IncomingMessage, res: ServerResponse): void {
  const requestedPath = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]));
  const resolved = join(webDistDir, requestedPath);

  const filePath = resolved.startsWith(webDistDir) && existsSync(resolved) && statSync(resolved).isFile()
    ? resolved
    : join(webDistDir, "index.html");

  res.writeHead(200, { "content-type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream" });
  createReadStream(filePath).pipe(res);
}

export function createHttpServer(deps: ServerDeps): Server {
  const httpServer = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, llmProvider: deps.llm.name, sttProvider: deps.stt.name }));
      return;
    }

    if (deps.webDistDir && req.method === "GET") {
      serveStatic(deps.webDistDir, req, res);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server: httpServer, path: "/session" });
  wss.on("connection", (socket) => handleSessionSocket(socket, deps));

  return httpServer;
}

export function startServer(): void {
  const config = loadConfig();
  const deps: ServerDeps = {
    llm: createLlmProviderFromConfig(config),
    stt: createDeepgramProvider(config.deepgram),
    repository: createFileQaRepository(config.dataDir),
    webDistDir: config.webDistDir,
  };

  createHttpServer(deps).listen(config.port, () => {
    console.log(`Parluvox server listening on :${config.port} (LLM provider: ${deps.llm.name})`);
  });
}
