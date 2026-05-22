"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileCode,
  FileType,
  File as FileIcon,
  RefreshCw,
  Plus,
  Briefcase,
  FolderPlus,
  FilePlus,
  Trash2,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Node = {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  children?: Node[];
};

type PromptKind = "folder" | "file" | "matter" | null;

export function WorkspaceTree({
  refreshKey,
  onChange,
}: {
  refreshKey: number;
  onChange?: () => void;
}) {
  const [tree, setTree] = useState<Node[]>([]);
  const [root, setRoot] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<string>(".");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptKind>(null);
  const [promptValue, setPromptValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workspace");
      const json = await res.json();
      setTree(json.tree ?? []);
      setRoot(json.root ?? "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [refreshKey, load]);

  const refresh = () => {
    load();
    onChange?.();
  };

  const uploadFiles = async (files: FileList | File[]) => {
    if (!files || (files as FileList).length === 0) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const form = new FormData();
      form.append("dir", active);
      Array.from(files as ArrayLike<File>).forEach((f) =>
        form.append("files", f),
      );
      const res = await fetch("/api/workspace", { method: "PUT", body: form });
      const json = await res.json();
      if (json.ok) {
        setUploadMsg(`Uploaded ${json.count} file${json.count === 1 ? "" : "s"}`);
        refresh();
      } else {
        setUploadMsg(json.error ?? "Upload failed");
      }
    } catch (e) {
      setUploadMsg((e as Error).message);
    } finally {
      setUploading(false);
      setTimeout(() => setUploadMsg(null), 3000);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) uploadFiles(files);
  };

  const openPrompt = (kind: PromptKind, initial = "") => {
    setPrompt(kind);
    setPromptValue(initial);
  };

  const submitPrompt = async () => {
    const value = promptValue.trim();
    if (!value || !prompt) return;
    try {
      let body: Record<string, unknown>;
      if (prompt === "matter") {
        body = { action: "create_matter", name: value };
      } else if (prompt === "folder") {
        body = {
          action: "create_folder",
          path: joinRel(active, value),
        };
      } else {
        body = {
          action: "create_file",
          path: joinRel(active, value),
          content: "",
        };
      }
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.ok && json.path) setActive(json.path);
      setPrompt(null);
      setPromptValue("");
      refresh();
    } catch {
      setPrompt(null);
    }
  };

  const deleteNode = async (p: string) => {
    if (!confirm(`Delete "${p}"? This cannot be undone.`)) return;
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", path: p }),
    });
    if (active === p || active.startsWith(p + "/")) setActive(".");
    refresh();
  };

  return (
    <div
      className={cn(
        "relative h-full flex flex-col transition-colors",
        dragOver &&
          "bg-primary/5 ring-2 ring-inset ring-primary/40 rounded-sm",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between px-3 mb-1 gap-1">
        <code
          className="text-[10.5px] text-muted-foreground truncate flex-1"
          title={root}
        >
          {active === "." ? "/" : "/" + active}
        </code>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="h-7 w-7"
          aria-label="Refresh"
        >
          <RefreshCw
            className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}
          />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7"
              aria-label="New item"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openPrompt("matter")}>
              <Briefcase className="h-3.5 w-3.5 mr-2" />
              New matter
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openPrompt("folder")}>
              <FolderPlus className="h-3.5 w-3.5 mr-2" />
              New folder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openPrompt("file")}>
              <FilePlus className="h-3.5 w-3.5 mr-2" />
              New file
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-2" />
              Upload files…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {tree.length === 0 ? (
          <EmptyDrop />
        ) : (
          <ul className="space-y-0.5 text-sm">
            <RootRow active={active} onSelect={() => setActive(".")} />
            {tree.map((n) => (
              <TreeRow
                key={n.path}
                node={n}
                depth={0}
                active={active}
                onSelect={setActive}
                onDelete={deleteNode}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border px-3 py-2 text-[10.5px] text-muted-foreground">
        {uploading ? (
          <span className="text-primary">Uploading…</span>
        ) : uploadMsg ? (
          <span className="text-primary">{uploadMsg}</span>
        ) : (
          <span>
            Drop files here →{" "}
            <span className="text-foreground/80 font-medium">
              {active === "." ? "root" : active}
            </span>
          </span>
        )}
      </div>

      <Dialog
        open={prompt !== null}
        onOpenChange={(o) => !o && setPrompt(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {prompt === "matter"
                ? "New matter"
                : prompt === "folder"
                  ? "New folder"
                  : "New file"}
            </DialogTitle>
            <DialogDescription>
              {prompt === "matter"
                ? "Creates matters/<slug>/ with intake.md and standard subfolders."
                : prompt === "folder"
                  ? `Inside ${active === "." ? "root" : active}.`
                  : `Inside ${active === "." ? "root" : active}. Include the extension.`}
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            placeholder={
              prompt === "matter"
                ? "Smith v. Jones"
                : prompt === "folder"
                  ? "research"
                  : "notes.md"
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") submitPrompt();
              if (e.key === "Escape") setPrompt(null);
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrompt(null)}>
              Cancel
            </Button>
            <Button onClick={submitPrompt} disabled={!promptValue.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function joinRel(base: string, sub: string): string {
  if (base === "." || base === "") return sub;
  return `${base}/${sub}`;
}

function RootRow({
  active,
  onSelect,
}: {
  active: string;
  onSelect: () => void;
}) {
  const selected = active === ".";
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "w-full flex items-center gap-2 text-left rounded-md px-2 py-1.5 transition-colors",
          selected
            ? "bg-primary/10 text-primary"
            : "hover:bg-accent/60 text-foreground",
        )}
      >
        {selected ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate text-xs font-medium">workspace</span>
      </button>
    </li>
  );
}

function TreeRow({
  node,
  depth,
  active,
  onSelect,
  onDelete,
}: {
  node: Node;
  depth: number;
  active: string;
  onSelect: (p: string) => void;
  onDelete: (p: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const selected = active === node.path;
  const Icon: LucideIcon =
    node.type === "dir"
      ? open
        ? FolderOpen
        : Folder
      : iconForFile(node.name);

  return (
    <li className="group">
      <div
        className={cn(
          "w-full flex items-center gap-2 rounded-md pr-1.5 py-1.5 transition-colors",
          selected
            ? "bg-primary/10 text-primary"
            : "hover:bg-accent/60 text-foreground",
        )}
        style={{ paddingLeft: depth * 14 + 8 }}
      >
        <button
          type="button"
          onClick={() => {
            if (node.type === "dir") {
              setOpen((o) => !o);
              onSelect(node.path);
            } else {
              onSelect(node.path);
            }
          }}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <Icon
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              selected ? "" : "text-muted-foreground",
            )}
          />
          <span className="truncate text-xs">{node.name}</span>
          {node.size !== undefined && (
            <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
              {formatBytes(node.size)}
            </span>
          )}
        </button>
        <button
          type="button"
          aria-label={`Delete ${node.name}`}
          onClick={() => onDelete(node.path)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-0.5"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {open && node.children && node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <TreeRow
              key={c.path}
              node={c}
              depth={depth + 1}
              active={active}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function EmptyDrop() {
  return (
    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center mt-3 bg-muted/30">
      <div className="mx-auto h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
        <Upload className="h-4 w-4" />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Drop files here, or click{" "}
        <span className="inline-flex items-center justify-center h-4 w-4 rounded bg-primary text-primary-foreground align-middle">
          <Plus className="h-3 w-3" />
        </span>{" "}
        to create a matter or folder.
      </p>
    </div>
  );
}

function iconForFile(name: string): LucideIcon {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  switch (ext) {
    case ".pdf":
      return FileType;
    case ".docx":
    case ".doc":
    case ".rtf":
    case ".md":
    case ".markdown":
    case ".txt":
    case ".log":
      return FileText;
    case ".xlsx":
    case ".xls":
    case ".csv":
      return FileSpreadsheet;
    case ".png":
    case ".jpg":
    case ".jpeg":
    case ".gif":
    case ".tif":
    case ".tiff":
    case ".webp":
    case ".heic":
    case ".bmp":
      return FileImage;
    case ".html":
    case ".htm":
    case ".json":
    case ".yaml":
    case ".yml":
    case ".xml":
      return FileCode;
    default:
      return FileIcon;
  }
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
