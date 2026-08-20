import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import { buildQaRecord, isQuestionShaped } from "../core/pipeline.js";
import { createInitialSessionState, sessionReducer, type QuestionSource, type SessionState } from "../core/sessionState.js";
import type { LlmProvider } from "../llm/types.js";
import type { QaRepository } from "../repository/qaRepository.js";
import type { SttProvider, SttStream } from "../stt/types.js";

type ClientMessage =
  | { type: "consent"; givenBy: string }
  | { type: "listening_start"; sources: QuestionSource[] }
  | { type: "add_channel"; source: QuestionSource }
  | { type: "listening_stop" }
  | { type: "job_context"; text: string };

interface Deps {
  llm: LlmProvider;
  stt: SttProvider;
  repository: QaRepository;
}

// Client tags every binary audio frame with a 1-byte source prefix so both
// the mic (self) and system-audio (other) streams can share one WebSocket
// connection without a second handshake.
const SOURCE_BYTE: Record<number, QuestionSource> = { 0: "self", 1: "other" };

export function handleSessionSocket(socket: WebSocket, deps: Deps): void {
  const sessionId = randomUUID();
  const log = (message: string) => console.log(`[session ${sessionId.slice(0, 8)}] ${message}`);

  let state: SessionState = createInitialSessionState();
  let jobContext: string | undefined;
  const sttStreams: Partial<Record<QuestionSource, SttStream>> = {};
  const firstChunkSeen: Partial<Record<QuestionSource, boolean>> = {};

  const send = (payload: unknown) => socket.send(JSON.stringify(payload));
  const applyEvent = (event: Parameters<typeof sessionReducer>[1]) => {
    state = sessionReducer(state, event);
    send({ type: "state", state });
  };

  const closeStreams = () => {
    for (const source of Object.keys(sttStreams) as QuestionSource[]) {
      sttStreams[source]?.close();
      delete sttStreams[source];
      delete firstChunkSeen[source];
    }
  };

  const handleFinalTranscript = (source: QuestionSource, text: string) => {
    log(`[${source}] final transcript: "${text}" (question-shaped: ${isQuestionShaped(text)})`);
    if (!isQuestionShaped(text)) return;

    const id = randomUUID();
    applyEvent({ type: "QUESTION_CAPTURED", id, source, questionOriginal: text });

    buildQaRecord(deps.llm, {
      id,
      source,
      questionOriginal: text,
      jobContext,
      now: () => new Date().toISOString(),
    })
      .then((record) => {
        deps.repository.append(sessionId, record);
        applyEvent({ type: "QA_READY", id, record });
      })
      .catch((error: Error) => {
        log(`[${source}] buildQaRecord failed: ${error.message}`);
        applyEvent({ type: "QA_FAILED", id });
        send({ type: "error", message: error.message });
      });
  };

  const openStreamFor = (source: QuestionSource) => {
    log(`[${source}] opening STT stream`);
    sttStreams[source] = deps.stt.openStream(
      (chunk) => {
        applyEvent({ type: "INTERIM_TRANSCRIPT", source, text: chunk.text });
        send({ type: "transcript", source, text: chunk.text, isFinal: chunk.isFinal });
        if (chunk.isFinal) handleFinalTranscript(source, chunk.text);
      },
      (error) => {
        log(`[${source}] STT error: ${error.message}`);
        send({ type: "error", message: `[${source}] ${error.message}` });
      },
      source
    );
  };

  send({ type: "session_started", sessionId, history: deps.repository.listBySession(sessionId) });

  socket.on("message", (raw, isBinary) => {
    if (isBinary) {
      const buffer = raw as Buffer;
      if (buffer.length < 2) return;
      const source = SOURCE_BYTE[buffer[0]];
      if (!source) return;
      if (!firstChunkSeen[source]) {
        firstChunkSeen[source] = true;
        log(`[${source}] first audio chunk received (${buffer.length - 1} bytes)`);
      }
      sttStreams[source]?.sendAudio(buffer.subarray(1));
      return;
    }

    let message: ClientMessage;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (message.type === "consent") {
      applyEvent({ type: "CONSENT_GIVEN", at: new Date().toISOString() });
      return;
    }

    if (message.type === "job_context") {
      jobContext = message.text;
      return;
    }

    if (message.type === "listening_start") {
      if (!state.consentGivenAt) return;
      log(`listening_start sources=[${message.sources.join(",")}]`);
      applyEvent({ type: "LISTENING_STARTED" });
      for (const source of message.sources) openStreamFor(source);
      return;
    }

    if (message.type === "add_channel") {
      log(`add_channel source=${message.source} (listening=${state.listening}, already open=${Boolean(sttStreams[message.source])})`);
      if (!state.listening || sttStreams[message.source]) return;
      openStreamFor(message.source);
      return;
    }

    if (message.type === "listening_stop") {
      log("listening_stop");
      closeStreams();
      applyEvent({ type: "LISTENING_STOPPED" });
    }
  });

  socket.on("close", closeStreams);
}
