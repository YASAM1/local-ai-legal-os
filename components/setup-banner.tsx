"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Health = {
  overall: "ready" | "degraded" | "broken";
  checks: { id: string; label: string; ok: boolean; detail: string }[];
};

const DISMISSED_KEY = "lls.setupBanner.dismissedAt";

export function SetupBanner() {
  const [health, setHealth] = useState<Health | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => null);
    try {
      const at = localStorage.getItem(DISMISSED_KEY);
      if (at && Date.now() - Number(at) < 60 * 60 * 1000) {
        setDismissed(true);
      }
    } catch {}
  }, []);

  if (!health || health.overall === "ready" || dismissed) return null;

  const broken = health.checks.filter((c) => !c.ok);
  const isBlocking = health.overall === "broken";

  return (
    <div
      className={
        isBlocking
          ? "border-b border-red-500/30 bg-red-500/5"
          : "border-b border-amber-500/30 bg-amber-500/5"
      }
    >
      <div className="max-w-4xl mx-auto px-6 py-3 flex items-start gap-3">
        <AlertTriangle
          className={
            isBlocking
              ? "h-4 w-4 mt-0.5 shrink-0 text-red-600 dark:text-red-400"
              : "h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
          }
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {isBlocking ? "Setup required" : "Some optional features are off"}
          </p>
          <ul className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
            {broken.slice(0, 4).map((c) => (
              <li key={c.id} className="flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-current opacity-50" />
                {c.label}
              </li>
            ))}
            {broken.length > 4 && (
              <li className="text-muted-foreground">
                +{broken.length - 4} more
              </li>
            )}
          </ul>
        </div>
        <Link href="/settings">
          <Button size="sm" variant="outline" className="gap-1.5">
            Open Settings
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8"
          aria-label="Dismiss"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(DISMISSED_KEY, String(Date.now()));
            } catch {}
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export { CheckCircle2 };
