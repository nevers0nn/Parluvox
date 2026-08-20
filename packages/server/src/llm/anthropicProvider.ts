import type { HttpFetch } from "./proxyFetch.js";
import type { LlmProvider, ReferenceAnswerInput, TranslateInput } from "./types.js";

interface AnthropicConfig {
  apiKey: string;
  model: string;
}

async function messagesCompletion(
  fetchImpl: HttpFetch,
  config: AnthropicConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic request failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const textBlock = body.content.find((block) => block.type === "text");
  return (textBlock?.text ?? "").trim();
}

export function createAnthropicProvider(config: AnthropicConfig, fetchImpl: HttpFetch): LlmProvider {
  return {
    name: "anthropic",

    async translate({ text, targetLang }: TranslateInput): Promise<string> {
      return messagesCompletion(
        fetchImpl,
        config,
        `You are a precise technical translator. Translate the user's text into ${targetLang}. ` +
          "Preserve technical terminology. Respond with only the translation, no commentary.",
        text
      );
    },

    async generateReferenceAnswer({ question, questionLang, jobContext }: ReferenceAnswerInput): Promise<string> {
      const contextLine = jobContext ? `Job context: ${jobContext}\n\n` : "";
      return messagesCompletion(
        fetchImpl,
        config,
        "You are assisting an HR interviewer who is not a subject-matter expert. " +
          `Given a technical interview question, write a concise, accurate reference answer ` +
          `a strong candidate might give, so the interviewer can compare it to what the candidate says. ` +
          `Respond only in ${questionLang}, no preamble, no meta-commentary.`,
        `${contextLine}Question: ${question}`
      );
    },
  };
}
