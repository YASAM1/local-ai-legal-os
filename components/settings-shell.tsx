"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  RefreshCw,
  Cloud,
  HardDrive,
  Database,
  Eye,
  ScanLine,
  Folder,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Settings = {
  ai_mode: "local" | "cloud";
  ollama_base_url: string;
  ollama_chat_model: string;
  ollama_embed_model: string;
  ai_gateway_model: string;
  ai_gateway_api_key: string;
  ai_gateway_api_key_set: boolean;
};

type Check = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  fixHint?: string;
};

type Health = {
  overall: "ready" | "degraded" | "broken";
  mode: string;
  checks: Check[];
};

const SUGGESTED_MODELS: { name: string; size: string; note: string }[] = [
  { name: "qwen2.5:7b", size: "4.7 GB", note: "Default. Strong tool use." },
  { name: "qwen2.5:14b", size: "9 GB", note: "Higher quality, slower." },
  { name: "llama3.1:8b", size: "4.7 GB", note: "Meta. Good general use." },
  { name: "llama3.1:70b", size: "40 GB", note: "Very large. Workstation only." },
];

export function SettingsShell() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [installed, setInstalled] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [s, h, m] = await Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/health").then((r) => r.json()),
      fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_models" }),
      })
        .then((r) => r.json())
        .catch(() => ({ models: [] })),
    ]);
    setSettings(s);
    setHealth(h);
    setInstalled((m.models ?? []).map((x: { name: string }) => x.name));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const patch = (p: Partial<Settings>) => {
    if (!settings) return;
    setSettings({ ...settings, ...p });
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (json.ok) {
        setSettings(json.settings);
        setSavedMsg("Saved");
        loadAll();
      } else {
        setSavedMsg(json.error ?? "Save failed");
      }
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(null), 2000);
    }
  };

  const runAction = async (action: string, args?: Record<string, unknown>) => {
    setBusyAction(action + (args?.model ? `:${args.model}` : ""));
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, args }),
      });
      await res.json();
    } finally {
      setBusyAction(null);
      loadAll();
    }
  };

  if (!settings || !health) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-muted/30 text-foreground">
      <header className="border-b border-border bg-background sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
            <p className="text-xs text-muted-foreground">
              Configure the local AI, services, and workspace.
            </p>
          </div>
          <OverallBadge overall={health.overall} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        {/* System health */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              System health
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 ml-auto"
                onClick={loadAll}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </CardTitle>
            <CardDescription>
              Each prerequisite the app needs. Click a fix when one's missing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {health.checks.map((c) => (
              <HealthRow
                key={c.id}
                check={c}
                onFix={async () => {
                  if (c.id === "ollama") await runAction("start_ollama");
                  else if (c.id === "supabase")
                    await runAction("start_supabase");
                  else if (c.id === "tesseract")
                    await runAction("install_tesseract");
                  else if (c.id === "model_chat")
                    await runAction("pull_model", {
                      model: settings.ollama_chat_model,
                    });
                  else if (c.id === "model_embed")
                    await runAction("pull_model", {
                      model: settings.ollama_embed_model,
                    });
                }}
                busy={busyAction !== null}
              />
            ))}
          </CardContent>
        </Card>

        {/* AI mode */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">AI mode</CardTitle>
            <CardDescription>
              Local keeps every byte on this machine. Cloud routes via Vercel AI
              Gateway for higher-quality drafting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <ModeCard
                active={settings.ai_mode === "local"}
                icon={<HardDrive className="h-4 w-4" />}
                title="Local"
                detail="Runs on this machine"
                onClick={() => patch({ ai_mode: "local" })}
              />
              <ModeCard
                active={settings.ai_mode === "cloud"}
                icon={<Cloud className="h-4 w-4" />}
                title="Cloud"
                detail="Vercel AI Gateway"
                onClick={() => patch({ ai_mode: "cloud" })}
              />
            </div>

            {settings.ai_mode === "local" ? (
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label>Ollama base URL</Label>
                  <Input
                    value={settings.ollama_base_url}
                    onChange={(e) => patch({ ollama_base_url: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
                <ModelPicker
                  label="Chat model"
                  value={settings.ollama_chat_model}
                  installed={installed}
                  onChange={(v) => patch({ ollama_chat_model: v })}
                  onPull={(m) => runAction("pull_model", { model: m })}
                  busy={busyAction}
                  suggestions={SUGGESTED_MODELS}
                />
                <ModelPicker
                  label="Embedding model"
                  value={settings.ollama_embed_model}
                  installed={installed}
                  onChange={(v) => patch({ ollama_embed_model: v })}
                  onPull={(m) => runAction("pull_model", { model: m })}
                  busy={busyAction}
                  suggestions={[
                    {
                      name: "nomic-embed-text",
                      size: "274 MB",
                      note: "Default. 768-dim.",
                    },
                  ]}
                />
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label>Gateway model</Label>
                  <Input
                    value={settings.ai_gateway_model}
                    onChange={(e) =>
                      patch({ ai_gateway_model: e.target.value })
                    }
                    placeholder="anthropic/claude-haiku-4-5"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    AI Gateway API key{" "}
                    {settings.ai_gateway_api_key_set && (
                      <Badge variant="secondary" className="text-[10px]">
                        set
                      </Badge>
                    )}
                  </Label>
                  <Input
                    type="password"
                    value={settings.ai_gateway_api_key}
                    onChange={(e) =>
                      patch({ ai_gateway_api_key: e.target.value })
                    }
                    placeholder={
                      settings.ai_gateway_api_key_set
                        ? "•••••  (leave blank to keep current)"
                        : "vck_..."
                    }
                    className="font-mono text-xs"
                  />
                  <p className="text-[10.5px] text-muted-foreground">
                    Get a key at{" "}
                    <span className="font-mono">vercel.com/ai-gateway</span>
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Workspace + RAG */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Workspace</CardTitle>
            <CardDescription>
              The folder the assistant operates inside.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-border bg-background px-3 py-2.5 flex items-center gap-2">
              <Folder className="h-3.5 w-3.5 text-primary" />
              <code className="text-xs font-mono flex-1 truncate">
                {health.checks.find((c) => c.id === "workspace")?.detail}
              </code>
              <Link href="/">
                <Button size="sm" variant="outline">
                  Change in sidebar
                </Button>
              </Link>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">Re-index documents</p>
                <p className="text-xs text-muted-foreground">
                  Embed everything in the workspace for semantic search.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => runAction("reingest")}
                disabled={busyAction === "reingest"}
                className="gap-1.5"
              >
                {busyAction === "reingest" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Database className="h-3.5 w-3.5" />
                )}
                Re-index
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="sticky bottom-0 -mx-6 px-6 py-3 border-t border-border bg-background/80 backdrop-blur flex items-center justify-end gap-2">
          {savedMsg && (
            <span className="text-xs text-muted-foreground">{savedMsg}</span>
          )}
          <Button onClick={save} disabled={saving} className="gap-1.5">
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save settings
          </Button>
        </div>
      </main>
    </div>
  );
}

function OverallBadge({ overall }: { overall: Health["overall"] }) {
  const colors = {
    ready: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    degraded:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    broken:
      "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
  };
  const labels = {
    ready: "All systems ready",
    degraded: "Some features off",
    broken: "Needs setup",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-medium",
        colors[overall],
      )}
    >
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current opacity-80">
        {overall === "ready" && (
          <span className="absolute inset-0 rounded-full bg-current animate-ping opacity-60" />
        )}
      </span>
      {labels[overall]}
    </span>
  );
}

function HealthRow({
  check,
  onFix,
  busy,
}: {
  check: Check;
  onFix: () => Promise<void>;
  busy: boolean;
}) {
  const Icon = check.ok ? CheckCircle2 : XCircle;
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-background px-3 py-2.5">
      <Icon
        className={cn(
          "h-4 w-4 mt-0.5 shrink-0",
          check.ok ? "text-emerald-500" : "text-red-500",
        )}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{check.label}</p>
        <p className="text-xs text-muted-foreground truncate">{check.detail}</p>
        {check.fixHint && !check.ok && (
          <code className="text-[10.5px] font-mono text-muted-foreground mt-1 inline-block">
            {check.fixHint}
          </code>
        )}
      </div>
      {!check.ok && check.fixHint && (
        <Button
          size="sm"
          variant="outline"
          onClick={onFix}
          disabled={busy}
          className="gap-1.5"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <FixIcon id={check.id} />
          )}
          Fix
        </Button>
      )}
    </div>
  );
}

function FixIcon({ id }: { id: string }) {
  if (id.startsWith("model")) return <Download className="h-3 w-3" />;
  if (id === "tesseract") return <ScanLine className="h-3 w-3" />;
  if (id === "supabase") return <Database className="h-3 w-3" />;
  return <Eye className="h-3 w-3" />;
}

function ModeCard({
  active,
  icon,
  title,
  detail,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/5 text-primary"
          : "border-border hover:bg-accent",
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm font-medium">{title}</p>
      </div>
      <p className="text-[10.5px] text-muted-foreground mt-1">{detail}</p>
    </button>
  );
}

function ModelPicker({
  label,
  value,
  installed,
  onChange,
  onPull,
  busy,
  suggestions,
}: {
  label: string;
  value: string;
  installed: string[];
  onChange: (v: string) => void;
  onPull: (model: string) => void;
  busy: string | null;
  suggestions: { name: string; size: string; note: string }[];
}) {
  const isInstalled = installed.some((n) =>
    n.startsWith(value.split(":")[0]),
  );

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="qwen2.5:7b"
          className="font-mono text-xs flex-1"
        />
        {!isInstalled && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPull(value)}
            disabled={busy === `pull_model:${value}`}
            className="gap-1.5 shrink-0"
          >
            {busy === `pull_model:${value}` ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            Pull
          </Button>
        )}
        {isInstalled && (
          <Badge
            variant="secondary"
            className="self-center gap-1 px-2 text-[10px]"
          >
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            installed
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {suggestions.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => onChange(s.name)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10.5px] font-mono transition-colors",
              value === s.name
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border hover:bg-accent",
            )}
            title={`${s.size} — ${s.note}`}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
