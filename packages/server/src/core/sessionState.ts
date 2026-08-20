export type QuestionSource = "self" | "other";

export interface QaRecord {
  id: string;
  source: QuestionSource;
  questionOriginal: string;
  questionLang: string;
  questionRu: string;
  referenceAnswerOriginal: string;
  referenceAnswerRu: string;
  createdAt: string;
}

export interface PendingQuestion {
  id: string;
  source: QuestionSource;
  questionOriginal: string;
}

export interface SessionState {
  consentGivenAt: string | null;
  listening: boolean;
  liveTranscripts: Record<QuestionSource, string>;
  pending: PendingQuestion[];
  history: QaRecord[];
}

export type SessionEvent =
  | { type: "CONSENT_GIVEN"; at: string }
  | { type: "LISTENING_STARTED" }
  | { type: "LISTENING_STOPPED" }
  | { type: "INTERIM_TRANSCRIPT"; source: QuestionSource; text: string }
  | { type: "QUESTION_CAPTURED"; id: string; source: QuestionSource; questionOriginal: string }
  | { type: "QA_READY"; id: string; record: QaRecord }
  | { type: "QA_FAILED"; id: string };

export function createInitialSessionState(): SessionState {
  return {
    consentGivenAt: null,
    listening: false,
    liveTranscripts: { self: "", other: "" },
    pending: [],
    history: [],
  };
}

export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case "CONSENT_GIVEN":
      return { ...state, consentGivenAt: event.at };

    case "LISTENING_STARTED":
      if (!state.consentGivenAt) return state;
      return { ...state, listening: true, liveTranscripts: { self: "", other: "" } };

    case "LISTENING_STOPPED":
      return { ...state, listening: false, liveTranscripts: { self: "", other: "" } };

    case "INTERIM_TRANSCRIPT":
      if (!state.listening) return state;
      return { ...state, liveTranscripts: { ...state.liveTranscripts, [event.source]: event.text } };

    case "QUESTION_CAPTURED":
      if (!state.listening) return state;
      return {
        ...state,
        liveTranscripts: { ...state.liveTranscripts, [event.source]: "" },
        pending: [...state.pending, { id: event.id, source: event.source, questionOriginal: event.questionOriginal }],
      };

    case "QA_READY":
      return {
        ...state,
        pending: state.pending.filter((item) => item.id !== event.id),
        history: [event.record, ...state.history],
      };

    case "QA_FAILED":
      return { ...state, pending: state.pending.filter((item) => item.id !== event.id) };

    default:
      return state;
  }
}
