import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

/**
 * Provider configuration.
 *
 * The app talks to DeepSeek through Synthetic's OpenAI-compatible endpoint by
 * default. Because this is a standard OpenAI-compatible surface, the same code
 * works with any compatible provider by changing LLM_BASE_URL and LLM_MODEL.
 */

export const DEFAULT_LLM_BASE_URL = "https://api.synthetic.new/openai/v1";
export const DEFAULT_LLM_MODEL =
  "hf:deepseek-ai/DeepSeek-V4.1-Flash-1017";

function getLlmApiKey(): string | undefined {
  return (
    process.env.LLM_API_KEY ??
    process.env.SYNTHETIC_API_KEY ??
    process.env.DEEPSEEK_API_KEY
  );
}

function getLlmBaseUrl(): string {
  return process.env.LLM_BASE_URL ?? DEFAULT_LLM_BASE_URL;
}

function getLlmModelId(): string {
  return process.env.LLM_MODEL ?? DEFAULT_LLM_MODEL;
}

export function isLlmConfigured(): boolean {
  return Boolean(getLlmApiKey());
}

export function getLanguageModel(): LanguageModel {
  const apiKey = getLlmApiKey();
  if (!apiKey) {
    throw new Error(
      "LLM_API_KEY is not set. Add your Synthetic API key to .env.local and restart the dev server.",
    );
  }

  const provider = createOpenAICompatible({
    name: "synthetic",
    baseURL: getLlmBaseUrl(),
    apiKey,
  });

  return provider.chatModel(getLlmModelId());
}
