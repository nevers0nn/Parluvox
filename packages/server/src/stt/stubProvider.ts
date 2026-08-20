import type { SttProvider, SttStream, TranscriptChunk } from "./types.js";

const DEMO_TRANSCRIPT = "What is the difference between let and var in JavaScript?";

export function createStubSttProvider(): SttProvider {
  return {
    name: "stub",
    openStream(onTranscript: (chunk: TranscriptChunk) => void): SttStream {
      let chunksReceived = 0;
      let finalized = false;

      return {
        sendAudio(_chunk: Buffer) {
          chunksReceived += 1;
          if (!finalized && chunksReceived === 1) {
            onTranscript({ text: DEMO_TRANSCRIPT.slice(0, 10), isFinal: false });
          }
          if (!finalized && chunksReceived >= 2) {
            finalized = true;
            onTranscript({ text: DEMO_TRANSCRIPT, isFinal: true });
          }
        },
        close() {},
      };
    },
  };
}
