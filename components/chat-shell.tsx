"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { WorkspaceTree } from "@/components/workspace-tree";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { StatusBadge } from "@/components/status-badge";
import { MessageBubble } from "@/components/message-bubble";
import { ThemeToggle } from "@/components/theme-toggle";
import { Send, Loader2, Scale, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";
import { SetupBanner } from "@/components/setup-banner";

export function ChatShell() {
  const [input, setInput] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: () => setRefreshKey((k) => k + 1),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;
    sendMessage({ text: input });
    setInput("");
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <aside className="w-80 shrink-0 border-r border-border flex flex-col bg-card">
        <div className="px-4 py-3.5 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground shrink-0">
                <Scale className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold tracking-tight truncate">
                  Local Legal OS
                </h1>
                <p className="text-[10.5px] text-muted-foreground -mt-0.5">
                  On-prem AI for the firm
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Link href="/settings">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8"
                  aria-label="Settings"
                >
                  <SettingsIcon className="h-4 w-4" />
                </Button>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
        <div className="px-3 pt-3 pb-1 space-y-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">
              Workspace
            </span>
            <StatusBadge />
          </div>
          <WorkspaceSwitcher
            refreshKey={refreshKey}
            onSwitched={() => setRefreshKey((k) => k + 1)}
          />
        </div>
        <div className="flex-1 min-h-0">
          <WorkspaceTree
            refreshKey={refreshKey}
            onChange={() => setRefreshKey((k) => k + 1)}
          />
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <SetupBanner />
        <div className="border-b border-border bg-card/40 backdrop-blur supports-[backdrop-filter]:bg-card/60 px-6 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Assistant</h2>
            <p className="text-xs text-muted-foreground">
              Ask about your documents or give it work to do.
            </p>
          </div>
          {busy && (
            <Button variant="outline" size="sm" onClick={stop}>
              Stop
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 px-6 py-6" ref={scrollerRef as never}>
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.length === 0 && (
              <EmptyState onPick={(text) => sendMessage({ text })} />
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Thinking…
              </div>
            )}
            {error && (
              <Card className="border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {error.message}
              </Card>
            )}
          </div>
        </ScrollArea>

        <form
          onSubmit={onSubmit}
          className="border-t border-border bg-card/40 px-6 py-4"
        >
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2 items-end rounded-xl border border-border bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/40 focus-within:border-primary/40 transition-shadow">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about a document, draft a letter, organize files…"
                rows={2}
                className="resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 px-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit(e as unknown as React.FormEvent);
                  }
                }}
              />
              <Button
                type="submit"
                disabled={busy || !input.trim()}
                className="shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground text-center">
              Drafts are for attorney review. Not legal advice.
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const examples = [
    "List all files in the workspace.",
    "Summarize the engagement letter for ACME Corp.",
    "Draft a follow-up letter to opposing counsel about discovery deadlines.",
    "Find every document that mentions 'indemnification'.",
  ];
  return (
    <Card className="p-8 space-y-6 border-border/80 shadow-sm">
      <div className="flex gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <Scale className="h-5 w-5" />
        </div>
        <div className="space-y-1.5">
          <h3 className="font-semibold tracking-tight">
            Welcome, counsel.
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Drop files into the workspace, then ask questions or request work
            below. Everything runs on this machine — no client data leaves it.
          </p>
        </div>
      </div>
      <Separator />
      <div className="space-y-2.5">
        <p className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">
          Try one of these
        </p>
        <div className="flex flex-col gap-1.5">
          {examples.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onPick(e)}
              className="text-left text-sm rounded-md border border-border/60 bg-background px-3 py-2 hover:bg-accent hover:border-primary/30 transition-colors"
            >
              <Badge
                variant="outline"
                className="mr-2 text-[10px] font-normal text-primary border-primary/30"
              >
                example
              </Badge>
              {e}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
