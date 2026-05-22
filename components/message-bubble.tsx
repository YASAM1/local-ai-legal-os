"use client";

import { Badge } from "@/components/ui/badge";
import type { UIMessage } from "ai";
import { cn } from "@/lib/utils";
import { Scale, User, ChevronRight } from "lucide-react";

export function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-1">
          <Scale className="h-3.5 w-3.5" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] space-y-2",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-3 shadow-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-card border border-border rounded-bl-md",
          )}
        >
          {message.parts.map((part, i) => {
            if (part.type === "text") {
              return (
                <div
                  key={i}
                  className="text-sm whitespace-pre-wrap leading-relaxed"
                >
                  {part.text}
                </div>
              );
            }
            if (part.type === "reasoning") {
              return (
                <details key={i} className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer flex items-center gap-1">
                    <ChevronRight className="h-3 w-3" />
                    reasoning
                  </summary>
                  <pre className="whitespace-pre-wrap mt-1 ml-4">
                    {part.text}
                  </pre>
                </details>
              );
            }
            if (part.type.startsWith("tool-")) {
              return <ToolCard key={i} part={part} />;
            }
            return null;
          })}
        </div>
      </div>
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground mt-1">
          <User className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}

function ToolCard({ part }: { part: UIMessage["parts"][number] }) {
  const p = part as unknown as {
    type: string;
    state: string;
    input?: unknown;
    output?: unknown;
    errorText?: string;
  };
  const name = p.type.replace(/^tool-/, "");
  const state = p.state ?? "input-streaming";

  const label =
    state === "input-streaming"
      ? "preparing"
      : state === "input-available"
        ? "running"
        : state === "output-available"
          ? "done"
          : state === "output-error"
            ? "error"
            : state;

  const variant =
    state === "output-error"
      ? "destructive"
      : state === "output-available"
        ? "secondary"
        : "outline";

  return (
    <div className="rounded-lg border border-border bg-muted/50 px-2.5 py-2 my-1.5">
      <div className="flex items-center gap-2 text-xs">
        <code className="font-mono font-medium text-primary">{name}</code>
        <Badge
          variant={variant}
          className="font-normal text-[10px] py-0 px-1.5"
        >
          {label}
        </Badge>
      </div>
      {p.input != null && (
        <details className="text-[11px] text-muted-foreground mt-1.5">
          <summary className="cursor-pointer hover:text-foreground">
            input
          </summary>
          <pre className="whitespace-pre-wrap break-words max-h-40 overflow-auto mt-1 font-mono text-[10px] bg-background/60 rounded p-2">
            {JSON.stringify(p.input, null, 2)}
          </pre>
        </details>
      )}
      {p.output != null && (
        <details className="text-[11px] text-muted-foreground mt-1.5">
          <summary className="cursor-pointer hover:text-foreground">
            output
          </summary>
          <pre className="whitespace-pre-wrap break-words max-h-48 overflow-auto mt-1 font-mono text-[10px] bg-background/60 rounded p-2">
            {JSON.stringify(p.output, null, 2)}
          </pre>
        </details>
      )}
      {p.errorText && (
        <div className="text-[11px] text-destructive mt-1">{p.errorText}</div>
      )}
    </div>
  );
}
