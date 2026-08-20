import WebSocket from "ws";
import type { SttProvider, SttStream, TranscriptChunk } from "./types.js";

interface DeepgramConfig {
  apiKey: string;
  model: string;
}

interface DeepgramMessage {
  type?: string;
  channel?: {
    alternatives?: Array<{ transcript?: string }>;
  };
  is_final?: boolean;
}

export function createDeepgramProvider(config: DeepgramConfig): SttProvider {
  return {
    name: "deepgram",

    openStream(onTranscript: (chunk: TranscriptChunk) => void, onError: (error: Error) => void, label = "?"): SttStream {
      const tag = `[deepgram:${label}]`;
      const params = new URLSearchParams({
        model: config.model,
        punctuate: "true",
        smart_format: "true",
        interim_results: "true",
        // language=multi needs a model whose multilingual mode covers the
        // languages you actually speak — nova-2's "multi" is Spanish+English
        // only, no Russian. nova-3's "multi" covers Russian. Keep these two
        // config values coupled.
        language: "multi",
      });

      const socket = new WebSocket(`wss://api.deepgram.com/v1/listen?${params.toString()}`, {
        headers: { Authorization: `Token ${config.apiKey}` },
      });

      // MediaRecorder's very first chunk carries the WebM/Opus container
      // header — everything after it only decodes if that header arrived
      // first. The Deepgram handshake isn't instant, so without this queue
      // any chunk sent before the socket reaches OPEN is silently dropped,
      // which orphans every later chunk (no transcript, no error, ever).
      let isOpen = false;
      const pendingAudio: Buffer[] = [];

      socket.on("open", () => {
        isOpen = true;
        console.log(`${tag} connection open, flushing ${pendingAudio.length} queued chunk(s)`);
        for (const chunk of pendingAudio) socket.send(chunk);
        pendingAudio.length = 0;
      });

      socket.on("close", (code, reason) => {
        console.log(`${tag} connection closed: code=${code} reason=${reason.toString() || "(none)"}`);
      });

      socket.on("message", (raw) => {
        let parsed: DeepgramMessage;
        try {
          parsed = JSON.parse(raw.toString());
        } catch {
          return;
        }
        const transcript = parsed.channel?.alternatives?.[0]?.transcript;
        if (!transcript) return;
        onTranscript({ text: transcript, isFinal: Boolean(parsed.is_final) });
      });

      socket.on("error", (err) => onError(err instanceof Error ? err : new Error(String(err))));

      socket.on("unexpected-response", (_req, res) => {
        onError(new Error(`Deepgram handshake failed: HTTP ${res.statusCode} ${res.statusMessage ?? ""}`.trim()));
      });

      return {
        sendAudio(chunk: Buffer) {
          if (isOpen && socket.readyState === WebSocket.OPEN) {
            socket.send(chunk);
          } else if (socket.readyState === WebSocket.CONNECTING) {
            pendingAudio.push(chunk);
          }
        },
        close() {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "CloseStream" }));
          socket.close();
        },
      };
    },
  };
}
