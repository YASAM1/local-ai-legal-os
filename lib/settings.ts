/**
 * Runtime settings loaded from .app-config.json. Values written here override
 * the matching env vars and take effect immediately — no dev-server restart
 * required.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const CONFIG_FILE = path.join(process.cwd(), ".app-config.json");

export type AppSettings = {
  ai_mode: "local" | "cloud";
  ollama_base_url: string;
  ollama_chat_model: string;
  ollama_embed_model: string;
  ai_gateway_model: string;
  ai_gateway_api_key: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  ai_mode: "local",
  ollama_base_url: "http://localhost:11434/api",
  ollama_chat_model: "qwen2.5:7b",
  ollama_embed_model: "nomic-embed-text",
  ai_gateway_model: "anthropic/claude-haiku-4-5",
  ai_gateway_api_key: "",
};

function fromEnv(): Partial<AppSettings> {
  const env = process.env;
  return {
    ai_mode: (env.AI_MODE as "local" | "cloud") || undefined,
    ollama_base_url: env.OLLAMA_BASE_URL || undefined,
    ollama_chat_model: env.OLLAMA_MODEL || undefined,
    ollama_embed_model: env.OLLAMA_EMBED_MODEL || undefined,
    ai_gateway_model: env.AI_GATEWAY_MODEL || undefined,
    ai_gateway_api_key: env.AI_GATEWAY_API_KEY || undefined,
  };
}

function readFile(): Partial<AppSettings> {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function compact<T extends object>(o: T): Partial<T> {
  const out = {} as Partial<T>;
  for (const k of Object.keys(o) as (keyof T)[]) {
    if (o[k] !== undefined && o[k] !== null) out[k] = o[k];
  }
  return out;
}

export function getSettings(): AppSettings {
  const fileSettings = compact(readFile());
  const envSettings = compact(fromEnv());
  return {
    ...DEFAULT_SETTINGS,
    ...envSettings,
    ...fileSettings,
  } as AppSettings;
}

export async function setSettings(
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  const current = { ...readFile() };
  const next = { ...current, ...patch };
  // Drop undefineds so we don't write null over env-provided values.
  for (const key of Object.keys(next) as (keyof AppSettings)[]) {
    if (next[key] === undefined || next[key] === null) {
      delete next[key];
    }
  }
  await fsp.writeFile(CONFIG_FILE, JSON.stringify(next, null, 2), "utf8");
  // Push back into the runtime so any code reading from process.env (like
  // env-only consumers) also sees the new values.
  if (next.ai_gateway_api_key) {
    process.env.AI_GATEWAY_API_KEY = next.ai_gateway_api_key;
  }
  return getSettings();
}
