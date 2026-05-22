import { NextResponse } from "next/server";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { getSettings } from "@/lib/settings";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase";
import { getWorkspaceRoot } from "@/lib/workspace";

const execAsync = promisify(exec);

type Check = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  fixHint?: string;
};

async function which(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`command -v ${cmd}`);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function fetchTimed(url: string, ms = 2000): Promise<Response | null> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(ms) });
  } catch {
    return null;
  }
}

export async function GET() {
  const s = getSettings();
  const checks: Check[] = [];

  // Ollama (only meaningful in local mode)
  if (s.ai_mode === "local") {
    const base = s.ollama_base_url.replace(/\/api$/, "");
    const res = await fetchTimed(`${base}/api/tags`);
    if (res && res.ok) {
      const json = (await res.json()) as { models?: { name: string }[] };
      const names = (json.models ?? []).map((m) => m.name);
      const haveChat = names.some((n) => n.startsWith(s.ollama_chat_model.split(":")[0]));
      const haveEmbed = names.some((n) => n.startsWith(s.ollama_embed_model.split(":")[0]));
      checks.push({
        id: "ollama",
        label: "Ollama running",
        ok: true,
        detail: `${names.length} models available`,
      });
      checks.push({
        id: "model_chat",
        label: `Chat model: ${s.ollama_chat_model}`,
        ok: haveChat,
        detail: haveChat ? "installed" : "not installed",
        fixHint: haveChat ? undefined : `ollama pull ${s.ollama_chat_model}`,
      });
      checks.push({
        id: "model_embed",
        label: `Embedding model: ${s.ollama_embed_model}`,
        ok: haveEmbed,
        detail: haveEmbed ? "installed" : "not installed",
        fixHint: haveEmbed
          ? undefined
          : `ollama pull ${s.ollama_embed_model}`,
      });
    } else {
      checks.push({
        id: "ollama",
        label: "Ollama running",
        ok: false,
        detail: `not reachable at ${s.ollama_base_url}`,
        fixHint: "brew services start ollama",
      });
    }
  } else {
    checks.push({
      id: "gateway",
      label: "Cloud model",
      ok: Boolean(s.ai_gateway_api_key),
      detail: s.ai_gateway_api_key
        ? `using ${s.ai_gateway_model}`
        : "no AI Gateway API key",
      fixHint: s.ai_gateway_api_key
        ? undefined
        : "Set AI Gateway key in Settings",
    });
  }

  // Supabase
  if (isSupabaseConfigured()) {
    const sb = getSupabase();
    let ok = false;
    let detail = "configured but unreachable";
    try {
      const { error } = await sb!.from("documents").select("id").limit(1);
      ok = !error;
      detail = error ? error.message : "connected";
    } catch (e) {
      detail = (e as Error).message;
    }
    checks.push({
      id: "supabase",
      label: "Vector database (Supabase)",
      ok,
      detail,
      fixHint: ok ? undefined : "supabase start",
    });
  } else {
    checks.push({
      id: "supabase",
      label: "Vector database (Supabase)",
      ok: false,
      detail: "not configured — semantic search disabled",
      fixHint: "Run ./bin/setup or supabase start, then update .env.local",
    });
  }

  // Tesseract (OCR for scanned images / scanned PDFs)
  const tesseract = await which("tesseract");
  checks.push({
    id: "tesseract",
    label: "OCR (Tesseract)",
    ok: Boolean(tesseract),
    detail: tesseract ? "installed" : "not installed (optional)",
    fixHint: tesseract ? undefined : "brew install tesseract",
  });

  // Workspace
  const root = getWorkspaceRoot();
  checks.push({
    id: "workspace",
    label: "Workspace folder",
    ok: true,
    detail: root,
  });

  const overall: "ready" | "degraded" | "broken" = checks.every((c) => c.ok)
    ? "ready"
    : checks.find((c) => c.id === "ollama" || c.id === "gateway")?.ok
      ? "degraded"
      : "broken";

  return NextResponse.json({
    overall,
    mode: s.ai_mode,
    checks,
  });
}
