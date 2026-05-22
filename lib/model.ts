import { createOllama } from "ollama-ai-provider-v2";
import { gateway } from "ai";
import { getSettings } from "@/lib/settings";

export function getChatModel() {
  const s = getSettings();
  if (s.ai_mode === "cloud") {
    if (s.ai_gateway_api_key) {
      process.env.AI_GATEWAY_API_KEY = s.ai_gateway_api_key;
    }
    return gateway(s.ai_gateway_model);
  }
  const ollama = createOllama({ baseURL: s.ollama_base_url });
  return ollama(s.ollama_chat_model);
}

export function getEmbeddingModel() {
  const s = getSettings();
  const ollama = createOllama({ baseURL: s.ollama_base_url });
  return ollama.textEmbeddingModel(s.ollama_embed_model);
}

export function getModelInfo() {
  const s = getSettings();
  return {
    mode: s.ai_mode,
    chat: s.ai_mode === "cloud" ? s.ai_gateway_model : s.ollama_chat_model,
    embed: s.ollama_embed_model,
  };
}

// Back-compat aliases — prefer the function form.
export const MODEL_INFO = new Proxy(
  {} as ReturnType<typeof getModelInfo>,
  {
    get(_t, prop) {
      return getModelInfo()[prop as keyof ReturnType<typeof getModelInfo>];
    },
  },
);

