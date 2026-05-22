import { NextResponse } from "next/server";
import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { getSettings } from "@/lib/settings";

const execAsync = promisify(exec);

async function runShell(cmd: string, timeoutMs = 600_000) {
  return execAsync(cmd, {
    timeout: timeoutMs,
    maxBuffer: 50 * 1024 * 1024,
    env: process.env,
  });
}

export async function POST(req: Request) {
  const { action, args } = (await req.json()) as {
    action: string;
    args?: Record<string, unknown>;
  };

  try {
    if (action === "pull_model") {
      const model = String(args?.model ?? "");
      if (!model) throw new Error("model required");
      const base = getSettings().ollama_base_url.replace(/\/api$/, "");
      // Stream-pull via the Ollama HTTP API so we don't depend on the `ollama`
      // CLI being on PATH inside Next.js.
      const res = await fetch(`${base}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, stream: false }),
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Pull failed: ${await res.text()}` },
          { status: 500 },
        );
      }
      return NextResponse.json({ ok: true, model });
    }

    if (action === "list_models") {
      const base = getSettings().ollama_base_url.replace(/\/api$/, "");
      const res = await fetch(`${base}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: "Ollama not reachable" },
          { status: 503 },
        );
      }
      const data = (await res.json()) as {
        models?: { name: string; size: number }[];
      };
      return NextResponse.json({
        ok: true,
        models: (data.models ?? []).map((m) => ({
          name: m.name,
          size: m.size,
        })),
      });
    }

    if (action === "start_ollama") {
      await runShell("brew services start ollama");
      return NextResponse.json({ ok: true });
    }

    if (action === "start_supabase") {
      // Start in detached mode so the response can return before Supabase finishes.
      const child = spawn("supabase", ["start"], {
        cwd: process.cwd(),
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      return NextResponse.json({
        ok: true,
        note: "Supabase is starting in the background. This may take a minute on first run.",
      });
    }

    if (action === "install_tesseract") {
      await runShell("brew install tesseract");
      return NextResponse.json({ ok: true });
    }

    if (action === "reingest") {
      const script = path.join(process.cwd(), "scripts", "ingest.ts");
      const child = spawn(
        process.execPath.includes("node")
          ? "pnpm"
          : "pnpm",
        ["tsx", script],
        {
          cwd: process.cwd(),
          detached: true,
          stdio: "ignore",
          env: process.env,
        },
      );
      child.unref();
      return NextResponse.json({
        ok: true,
        note: "Re-indexing started in the background. Watch the dev-server console for progress.",
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
