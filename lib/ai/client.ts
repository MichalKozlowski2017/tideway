import OpenAI from "openai";

export type AiProvider = "openai" | "local";

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_LOCAL_MODEL = "qwen2.5:32b-instruct-q4_K_M";
const DEFAULT_LOCAL_BASE_URL = "http://localhost:11434/v1";

export function getAiProvider(): AiProvider {
  return process.env.AI_PROVIDER?.toLowerCase() === "local" ? "local" : "openai";
}

export function getAiModel(): string {
  if (getAiProvider() === "local") {
    return process.env.LOCAL_AI_MODEL ?? DEFAULT_LOCAL_MODEL;
  }
  return process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
}

export function getAiClient(): OpenAI {
  if (getAiProvider() === "local") {
    return new OpenAI({
      apiKey: process.env.LOCAL_AI_API_KEY ?? "ollama",
      baseURL: process.env.LOCAL_AI_BASE_URL ?? DEFAULT_LOCAL_BASE_URL,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY (set AI_PROVIDER=local for Ollama)");
  }

  const baseURL = process.env.OPENAI_BASE_URL;
  return new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });
}

export function describeAiSetup(): string {
  const provider = getAiProvider();
  const model = getAiModel();
  if (provider === "local") {
    const baseURL = process.env.LOCAL_AI_BASE_URL ?? DEFAULT_LOCAL_BASE_URL;
    return `local · ${model} @ ${baseURL}`;
  }
  return `openai · ${model}`;
}
