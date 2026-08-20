import { describe, expect, it } from "vitest";
import { createInitialSessionState, sessionReducer, type QaRecord } from "../../src/core/sessionState.js";

describe("sessionReducer", () => {
  it("ignores listening_started before consent is given", () => {
    const state = createInitialSessionState();
    const next = sessionReducer(state, { type: "LISTENING_STARTED" });
    expect(next.listening).toBe(false);
  });

  it("starts listening once consent was given", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, { type: "CONSENT_GIVEN", at: "2026-08-18T10:00:00.000Z" });
    state = sessionReducer(state, { type: "LISTENING_STARTED" });
    expect(state.listening).toBe(true);
  });

  it("tracks interim transcripts per source independently while listening", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, { type: "CONSENT_GIVEN", at: "2026-08-18T10:00:00.000Z" });
    state = sessionReducer(state, { type: "LISTENING_STARTED" });
    state = sessionReducer(state, { type: "INTERIM_TRANSCRIPT", source: "self", text: "explain clos" });
    state = sessionReducer(state, { type: "INTERIM_TRANSCRIPT", source: "other", text: "what about" });
    expect(state.liveTranscripts).toEqual({ self: "explain clos", other: "what about" });
  });

  it("moves a captured question into pending and clears that source's live transcript", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, { type: "CONSENT_GIVEN", at: "2026-08-18T10:00:00.000Z" });
    state = sessionReducer(state, { type: "LISTENING_STARTED" });
    state = sessionReducer(state, { type: "INTERIM_TRANSCRIPT", source: "self", text: "Explain closures?" });
    state = sessionReducer(state, {
      type: "QUESTION_CAPTURED",
      id: "q1",
      source: "self",
      questionOriginal: "Explain closures?",
    });

    expect(state.liveTranscripts.self).toBe("");
    expect(state.pending).toEqual([{ id: "q1", source: "self", questionOriginal: "Explain closures?" }]);
  });

  it("keeps both sources' pending questions independent", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, { type: "CONSENT_GIVEN", at: "2026-08-18T10:00:00.000Z" });
    state = sessionReducer(state, { type: "LISTENING_STARTED" });
    state = sessionReducer(state, { type: "QUESTION_CAPTURED", id: "q1", source: "self", questionOriginal: "A?" });
    state = sessionReducer(state, { type: "QUESTION_CAPTURED", id: "q2", source: "other", questionOriginal: "B?" });
    expect(state.pending).toHaveLength(2);
  });

  it("moves a ready QA record from pending into history", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, { type: "CONSENT_GIVEN", at: "2026-08-18T10:00:00.000Z" });
    state = sessionReducer(state, { type: "LISTENING_STARTED" });
    state = sessionReducer(state, { type: "QUESTION_CAPTURED", id: "q1", source: "self", questionOriginal: "Explain closures?" });

    const record: QaRecord = {
      id: "q1",
      source: "self",
      questionOriginal: "Explain closures?",
      questionLang: "en",
      questionRu: "Объясните замыкания?",
      referenceAnswerOriginal: "A closure is...",
      referenceAnswerRu: "Замыкание — это...",
      createdAt: "2026-08-18T10:00:05.000Z",
    };
    state = sessionReducer(state, { type: "QA_READY", id: "q1", record });

    expect(state.pending).toEqual([]);
    expect(state.history).toEqual([record]);
  });

  it("drops a failed pending question without touching history", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, { type: "CONSENT_GIVEN", at: "2026-08-18T10:00:00.000Z" });
    state = sessionReducer(state, { type: "LISTENING_STARTED" });
    state = sessionReducer(state, { type: "QUESTION_CAPTURED", id: "q1", source: "self", questionOriginal: "Explain closures?" });
    state = sessionReducer(state, { type: "QA_FAILED", id: "q1" });

    expect(state.pending).toEqual([]);
    expect(state.history).toEqual([]);
  });

  it("resets listening and live transcripts on listening_stopped", () => {
    let state = createInitialSessionState();
    state = sessionReducer(state, { type: "CONSENT_GIVEN", at: "2026-08-18T10:00:00.000Z" });
    state = sessionReducer(state, { type: "LISTENING_STARTED" });
    state = sessionReducer(state, { type: "INTERIM_TRANSCRIPT", source: "self", text: "hello" });
    state = sessionReducer(state, { type: "LISTENING_STOPPED" });

    expect(state.listening).toBe(false);
    expect(state.liveTranscripts).toEqual({ self: "", other: "" });
  });
});
