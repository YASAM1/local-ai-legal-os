"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Status = {
  model: { mode: string; chat: string; embed: string };
  workspace: string;
  supabase: boolean;
  ollamaReachable: boolean;
};

export function StatusBadge() {
  const [s, setS] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/status");
        const json: Status = await res.json();
        if (!cancelled) setS(json);
      } catch {}
    };
    load();
    const id = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!s) return null;

  const healthy = s.model.mode === "cloud" || s.ollamaReachable;
  return (
    <span
      title={`mode: ${s.model.mode}\nchat: ${s.model.chat}\nembed: ${s.model.embed}\nsupabase: ${s.supabase ? "configured" : "off"}`}
      className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground"
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-1.5 w-1.5 rounded-full",
          healthy ? "bg-emerald-500" : "bg-red-500",
        )}
      >
        {healthy && (
          <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60" />
        )}
      </span>
      {healthy ? "online" : "offline"} · {s.model.mode}
    </span>
  );
}
