import type { LlmProvider, ReferenceAnswerInput, TranslateInput } from "./types.js";

export function createStubLlmProvider(): LlmProvider {
  return {
    name: "stub",
    async translate({ text, targetLang }: TranslateInput): Promise<string> {
      return `[${targetLang}] ${text}`;
    },
    async generateReferenceAnswer({ question }: ReferenceAnswerInput): Promise<string> {
      return `Stub reference answer for: "${question}"`;
    },
  };
}
