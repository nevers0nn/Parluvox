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

export type ServerMessage =
  | { type: "session_started"; sessionId: string; history: QaRecord[] }
  | { type: "state"; state: SessionState }
  | { type: "transcript"; source: QuestionSource; text: string; isFinal: boolean }
  | { type: "error"; message: string }
  | { type: "warning"; message: string };
