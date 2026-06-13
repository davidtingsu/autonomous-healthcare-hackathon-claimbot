import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";

export function isLlmAvailable(): boolean {
  const provider = process.env.LLM_PROVIDER ?? "openai";
  if (provider === "grok") return Boolean(process.env.XAI_API_KEY);
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getVisionModel(): LanguageModel {
  const provider = process.env.LLM_PROVIDER ?? "openai";
  if (provider === "grok") {
    return xai("grok-2-vision-1212");
  }
  return openai("gpt-4o");
}
