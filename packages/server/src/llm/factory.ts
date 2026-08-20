import type { Config } from "../config.js";
import { createAnthropicProvider } from "./anthropicProvider.js";
import { createOpenAiProvider } from "./openaiProvider.js";
import { createHttpFetch } from "./proxyFetch.js";
import type { LlmProvider } from "./types.js";

export function createLlmProviderFromConfig(config: Config): LlmProvider {
  const fetchImpl = createHttpFetch(config.proxyUrl);

  if (config.llmProvider === "openai") {
    if (!config.openai.apiKey) throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai");
    return createOpenAiProvider(config.openai, fetchImpl);
  }
  if (!config.anthropic.apiKey) throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic");
  return createAnthropicProvider(config.anthropic, fetchImpl);
}
