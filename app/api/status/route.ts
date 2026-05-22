import { NextResponse } from "next/server";
import { MODEL_INFO } from "@/lib/model";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getWorkspaceRoot } from "@/lib/workspace";

export async function GET() {
  let ollamaReachable = false;
  if (MODEL_INFO.mode === "local") {
    try {
      const url = (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/api").replace(
        /\/api$/,
        "",
      );
      const res = await fetch(`${url}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      });
      ollamaReachable = res.ok;
    } catch {
      ollamaReachable = false;
    }
  }
  return NextResponse.json({
    model: MODEL_INFO,
    workspace: getWorkspaceRoot(),
    supabase: isSupabaseConfigured(),
    ollamaReachable,
  });
}
