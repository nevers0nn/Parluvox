import { loadDotEnv } from "./env.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill it in.`
    );
  }
  return value;
}

export type LlmProviderName = "openai" | "anthropic";

function readLlmProvider(): LlmProviderName {
  const value = process.env.LLM_PROVIDER;
  if (value !== "openai" && value !== "anthropic") {
    throw new Error(
      `LLM_PROVIDER must be set to "openai" or "anthropic" (got: ${value ?? "unset"}). ` +
        `This is a deliberate choice left to whoever deploys Parluvox — pick one in .env.`
    );
  }
  return value;
}

export interface Config {
  port: number;
  dataDir: string;
  proxyUrl: string | undefined;
  webDistDir: string | undefined;
  llmProvider: LlmProviderName;
  openai: { apiKey: string; model: string };
  anthropic: { apiKey: string; model: string };
  deepgram: { apiKey: string; model: string };
}

export function loadConfig(): Config {
  loadDotEnv();

  return {
    port: Number(process.env.PORT ?? 8787),
    dataDir: process.env.DATA_DIR ?? "./data",
    proxyUrl: process.env.PROXY_URL || undefined,
    webDistDir: process.env.WEB_DIST_DIR || undefined,

    llmProvider: readLlmProvider(),
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? "",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
    },

    deepgram: {
      apiKey: required("DEEPGRAM_API_KEY"),
      model: process.env.DEEPGRAM_MODEL ?? "nova-3",
    },
  };
}
