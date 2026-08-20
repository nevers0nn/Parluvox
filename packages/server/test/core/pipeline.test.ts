import { describe, expect, it } from "vitest";
import { buildQaRecord, detectLanguage, isQuestionShaped } from "../../src/core/pipeline.js";
import type { LlmProvider } from "../../src/llm/types.js";

function fakeLlmProvider(): LlmProvider {
  return {
    name: "fake",
    async translate({ text }) {
      return `[ru] ${text}`;
    },
    async generateReferenceAnswer({ question }) {
      return `Reference answer for: ${question}`;
    },
  };
}

describe("detectLanguage", () => {
  it("detects Russian by cyrillic characters", () => {
    expect(detectLanguage("Объясните замыкания")).toBe("ru");
  });

  it("defaults to english otherwise", () => {
    expect(detectLanguage("Explain closures")).toBe("en");
  });
});

describe("isQuestionShaped", () => {
  it("accepts a long-enough utterance ending in a question mark", () => {
    expect(isQuestionShaped("What is a closure?")).toBe(true);
  });

  it("rejects statements without a trailing question mark", () => {
    expect(isQuestionShaped("This is just a remark.")).toBe(false);
  });

  it("rejects short fragments even if they end in a question mark", () => {
    expect(isQuestionShaped("What?")).toBe(false);
  });
});

describe("buildQaRecord", () => {
  it("translates question and answer when the question is not Russian", async () => {
    const record = await buildQaRecord(fakeLlmProvider(), {
      id: "1",
      source: "self",
      questionOriginal: "Explain closures",
      now: () => "2026-08-18T10:00:00.000Z",
    });

    expect(record.questionLang).toBe("en");
    expect(record.questionRu).toBe("[ru] Explain closures");
    expect(record.referenceAnswerOriginal).toBe("Reference answer for: Explain closures");
    expect(record.referenceAnswerRu).toBe("[ru] Reference answer for: Explain closures");
  });

  it("skips translation when the question is already Russian", async () => {
    const record = await buildQaRecord(fakeLlmProvider(), {
      id: "2",
      source: "other",
      questionOriginal: "Объясните замыкания",
      now: () => "2026-08-18T10:00:00.000Z",
    });

    expect(record.questionLang).toBe("ru");
    expect(record.questionRu).toBe(record.questionOriginal);
    expect(record.referenceAnswerRu).toBe(record.referenceAnswerOriginal);
  });
});
