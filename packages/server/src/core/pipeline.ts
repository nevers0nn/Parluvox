import type { LlmProvider } from "../llm/types.js";
import type { QaRecord, QuestionSource } from "./sessionState.js";

export interface DetectLanguage {
  (text: string): string;
}

const RU_LETTERS = /[а-яё]/i;

export const detectLanguage: DetectLanguage = (text) => (RU_LETTERS.test(text) ? "ru" : "en");

const MIN_QUESTION_LENGTH = 8;

// Deepgram's smart_format/punctuate reliably adds "?" for clearly interrogative
// speech, so a trailing "?" is a cheap, deterministic proxy for "this final
// utterance is a complete question" — good enough to gate auto-triggering the
// LLM pipeline without spamming a card for every filler word or remark.
export function isQuestionShaped(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length >= MIN_QUESTION_LENGTH && trimmed.endsWith("?");
}

export interface BuildQaRecordInput {
  id: string;
  source: QuestionSource;
  questionOriginal: string;
  jobContext?: string;
  now: () => string;
}

export async function buildQaRecord(llm: LlmProvider, input: BuildQaRecordInput): Promise<QaRecord> {
  const questionLang = detectLanguage(input.questionOriginal);

  const referenceAnswerOriginal = await llm.generateReferenceAnswer({
    question: input.questionOriginal,
    questionLang,
    jobContext: input.jobContext,
  });

  const [questionRu, referenceAnswerRu] =
    questionLang === "ru"
      ? [input.questionOriginal, referenceAnswerOriginal]
      : await Promise.all([
          llm.translate({ text: input.questionOriginal, targetLang: "ru" }),
          llm.translate({ text: referenceAnswerOriginal, targetLang: "ru" }),
        ]);

  return {
    id: input.id,
    source: input.source,
    questionOriginal: input.questionOriginal,
    questionLang,
    questionRu,
    referenceAnswerOriginal,
    referenceAnswerRu,
    createdAt: input.now(),
  };
}
