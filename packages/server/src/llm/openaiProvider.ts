import type { HttpFetch } from "./proxyFetch.js";
import type { LlmProvider, ReferenceAnswerInput, TranslateInput } from "./types.js";

interface OpenAiConfig {
  apiKey: string;
  model: string;
}

async function chatCompletion(
  fetchImpl: HttpFetch,
  config: OpenAiConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    // No `temperature` override here on purpose — reasoning-family models
    // (o1/o3/gpt-5-thinking-style) reject any value other than their
    // default (1) with a 400, so omitting it is what works across models.
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return body.choices[0].message.content.trim();
}

export function createOpenAiProvider(config: OpenAiConfig, fetchImpl: HttpFetch): LlmProvider {
  return {
    name: "openai",

    async translate({ text, targetLang }: TranslateInput): Promise<string> {
      return chatCompletion(
        fetchImpl,
        config,
        `You are a precise technical translator. Translate the user's text into ${targetLang}. ` +
          "Preserve technical terminology. Respond with only the translation, no commentary.",
        text
      );
    },

    async generateReferenceAnswer({ question, questionLang, jobContext }: ReferenceAnswerInput): Promise<string> {
      const contextLine = jobContext ? `Job context: ${jobContext}\n\n` : "";
      return chatCompletion(
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
