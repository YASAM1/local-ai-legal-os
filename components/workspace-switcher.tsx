"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FolderOpen,
  FolderPlus,
  Home,
  Folder,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RootInfo = {
  current: string;
  home: string;
  suggestions: { label: string; path: string }[];
  platform: string;
};

export function WorkspaceSwitcher({
  refreshKey,
  onSwitched,
}: {
  refreshKey: number;
  onSwitched: () => void;
}) {
  const [info, setInfo] = useState<RootInfo | null>(null);
  const [picking, setPicking] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/workspace/root")
      .then((r) => r.json())
      .then(setInfo);
  }, [refreshKey]);

  const current = info?.current ?? "";
  const display = displayPath(current, info?.home) || "Loading…";

  const openNativePicker = async () => {
    if (info && info.platform !== "darwin") {
      setFallbackOpen(true);
      return;
    }
    setPicking(true);
    setErr(null);
    try {
      const res = await fetch("/api/workspace/root", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pick" }),
      });
      const json = await res.json();
      if (json.ok && json.root) {
        onSwitched();
      } else if (json.cancelled) {
        // user dismissed Finder picker — nothing to do
      } else if (json.error) {
        setErr(json.error);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPicking(false);
    }
  };

  return (
    <>
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={openNativePicker}
          disabled={picking}
          className="w-full flex items-center gap-2 rounded-md border border-border bg-background hover:border-primary/40 hover:bg-accent/40 disabled:opacity-60 px-2.5 py-1.5 text-left transition-colors"
          title={current}
        >
          {picking ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 text-primary animate-spin" />
          ) : (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
          )}
          <span className="truncate text-xs font-mono">{display}</span>
          <ChevronDown className="h-3 w-3 ml-auto shrink-0 text-muted-foreground" />
        </button>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs justify-center gap-1.5"
            onClick={openNativePicker}
            disabled={picking}
          >
            {picking ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FolderOpen className="h-3 w-3" />
            )}
            Open Folder
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs justify-center gap-1.5"
            onClick={() => setCreateOpen(true)}
          >
            <FolderPlus className="h-3 w-3" />
            New Folder
          </Button>
        </div>
        {picking && (
          <p className="text-[10.5px] text-muted-foreground px-1">
            Waiting for Finder…
          </p>
        )}
        {err && (
          <p className="text-[10.5px] text-destructive px-1">{err}</p>
        )}
      </div>

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        info={info}
        onCreated={() => {
          setCreateOpen(false);
          onSwitched();
        }}
      />

      <FallbackDialog
        open={fallbackOpen}
        onOpenChange={setFallbackOpen}
        info={info}
        onPicked={() => {
          setFallbackOpen(false);
          onSwitched();
        }}
      />
    </>
  );
}

function CreateDialog({
  open,
  onOpenChange,
  info,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  info: RootInfo | null;
  onCreated: () => void;
}) {
  const [parent, setParent] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open && info && !parent) {
      setParent(info.suggestions[0]?.path ?? info.home);
    }
  }, [open, info, parent]);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/workspace/root", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", parent, name }),
      });
      const json = await res.json();
      if (json.ok) {
        setName("");
        onCreated();
      } else {
        setErr(json.error ?? "Failed to create folder");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New workspace folder</DialogTitle>
          <DialogDescription>
            Creates a folder on disk and opens it as the active workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Create in</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {info?.suggestions.map((s) => (
                <Chip
                  key={s.path}
                  onClick={() => setParent(s.path)}
                  variant={parent === s.path ? "primary" : "default"}
                >
                  {s.label === "Home" ? (
                    <Home className="h-3 w-3" />
                  ) : (
                    <Folder className="h-3 w-3" />
                  )}
                  {s.label}
                </Chip>
              ))}
            </div>
            <Input
              value={parent}
              onChange={(e) => setParent(e.target.value)}
              placeholder="~/Desktop"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Folder name</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Firm Workspace"
              onKeyDown={(e) =>
                e.key === "Enter" && name.trim() && !busy && submit()
              }
            />
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim()}>
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FolderPlus className="h-3.5 w-3.5" />
            )}
            Create and open
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FallbackDialog({
  open,
  onOpenChange,
  info,
  onPicked,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  info: RootInfo | null;
  onPicked: () => void;
}) {
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open && info && !manual) setManual(info.current);
  }, [open, info, manual]);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/workspace/root", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "switch", path: manual }),
      });
      const json = await res.json();
      if (json.ok) onPicked();
      else setErr(json.error ?? "Failed to open folder");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Open folder</DialogTitle>
          <DialogDescription>
            Native picker is macOS-only. Paste a path to switch.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="~/Desktop/MyFirm"
          className="font-mono text-xs"
        />
        {err && <p className="text-xs text-destructive">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !manual.trim()}>
            Open
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">
      {children}
    </p>
  );
}

function Chip({
  children,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "primary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        variant === "primary"
          ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
          : "border-border hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function displayPath(p: string, home?: string): string {
  if (home && p.startsWith(home)) return "~" + p.slice(home.length);
  return p;
}
