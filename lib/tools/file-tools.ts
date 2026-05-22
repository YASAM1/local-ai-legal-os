import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureWorkspace,
  resolveWithinWorkspace,
  toRelative,
  getWorkspaceRoot,
} from "@/lib/workspace";
import { extractText, isExtractable } from "@/lib/extract";

const MAX_BYTES_READ = 200_000;
const MAX_LIST_ENTRIES = 500;

async function statSafe(p: string) {
  try {
    return await fs.stat(p);
  } catch {
    return null;
  }
}

export const fileTools = {
  list_files: tool({
    description:
      "List files and folders in a workspace directory. Use this to discover what content exists before reading.",
    inputSchema: z.object({
      dir: z
        .string()
        .default(".")
        .describe("Relative path inside the workspace. '.' for the root."),
    }),
    execute: async ({ dir }) => {
      await ensureWorkspace();
      const abs = resolveWithinWorkspace(dir);
      const st = await statSafe(abs);
      if (!st) return { ok: false, error: `Not found: ${dir}` };
      if (!st.isDirectory()) return { ok: false, error: `Not a directory: ${dir}` };
      const entries = await fs.readdir(abs, { withFileTypes: true });
      const out = entries.slice(0, MAX_LIST_ENTRIES).map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "dir" : "file",
        path: toRelative(path.join(abs, e.name)),
      }));
      return { ok: true, dir: toRelative(abs), entries: out };
    },
  }),

  read_file: tool({
    description:
      "Read a document from the workspace. Extracts text from PDF, DOCX, XLSX, HTML, RTF, plain-text, and (with OCR installed) images. Returns the extracted text along with metadata like page count.",
    inputSchema: z.object({
      path: z.string().describe("Relative path inside the workspace."),
    }),
    execute: async ({ path: rel }) => {
      const abs = resolveWithinWorkspace(rel);
      const st = await statSafe(abs);
      if (!st || !st.isFile()) return { ok: false, error: `Not a file: ${rel}` };
      const result = await extractText(abs);
      return {
        ok: true,
        path: toRelative(abs),
        bytes: st.size,
        kind: result.kind,
        pageCount: result.pageCount,
        sheetCount: result.sheetCount,
        wordCount: result.wordCount,
        truncated: result.truncated,
        warnings: result.warnings,
        content: result.text,
      };
    },
  }),

  write_file: tool({
    description:
      "Create a new file or overwrite an existing file in the workspace. Use sparingly — prefer edit_file for changes to existing files.",
    inputSchema: z.object({
      path: z.string().describe("Relative path inside the workspace."),
      content: z.string().describe("Full file content to write."),
    }),
    execute: async ({ path: rel, content }) => {
      const abs = resolveWithinWorkspace(rel);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, "utf8");
      const st = await fs.stat(abs);
      return {
        ok: true,
        path: toRelative(abs),
        bytes: st.size,
        action: "written",
      };
    },
  }),

  edit_file: tool({
    description:
      "Edit an existing file by replacing an exact string. The old_string must match exactly once.",
    inputSchema: z.object({
      path: z.string(),
      old_string: z.string().describe("Exact text to find. Must be unique."),
      new_string: z.string().describe("Replacement text."),
    }),
    execute: async ({ path: rel, old_string, new_string }) => {
      const abs = resolveWithinWorkspace(rel);
      const st = await statSafe(abs);
      if (!st || !st.isFile()) return { ok: false, error: `Not a file: ${rel}` };
      const before = await fs.readFile(abs, "utf8");
      const idx = before.indexOf(old_string);
      if (idx < 0)
        return { ok: false, error: "old_string not found in file" };
      if (before.indexOf(old_string, idx + 1) >= 0)
        return {
          ok: false,
          error: "old_string is ambiguous (multiple matches). Be more specific.",
        };
      const after = before.replace(old_string, new_string);
      await fs.writeFile(abs, after, "utf8");
      return {
        ok: true,
        path: toRelative(abs),
        action: "edited",
        bytes_before: before.length,
        bytes_after: after.length,
      };
    },
  }),

  delete_file: tool({
    description: "Delete a file from the workspace. Confirm with the user before destructive ops.",
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path: rel }) => {
      const abs = resolveWithinWorkspace(rel);
      const st = await statSafe(abs);
      if (!st) return { ok: false, error: `Not found: ${rel}` };
      if (!st.isFile()) return { ok: false, error: `Not a file: ${rel}` };
      await fs.unlink(abs);
      return { ok: true, path: toRelative(abs), action: "deleted" };
    },
  }),

  search_files: tool({
    description:
      "Search file contents in the workspace for a substring (case-insensitive). Returns matching files with line context.",
    inputSchema: z.object({
      query: z.string().min(2),
      dir: z.string().default("."),
      max_results: z.number().int().min(1).max(50).default(20),
    }),
    execute: async ({ query, dir, max_results }) => {
      await ensureWorkspace();
      const start = resolveWithinWorkspace(dir);
      const results: { path: string; line: number; text: string }[] = [];
      const needle = query.toLowerCase();

      async function walk(p: string) {
        if (results.length >= max_results) return;
        const entries = await fs.readdir(p, { withFileTypes: true });
        for (const e of entries) {
          if (results.length >= max_results) return;
          const sub = path.join(p, e.name);
          if (e.isDirectory()) {
            if (e.name === "node_modules" || e.name.startsWith(".")) continue;
            await walk(sub);
          } else if (e.isFile()) {
            const st = await fs.stat(sub);
            if (st.size > MAX_BYTES_READ * 2) continue;
            try {
              const text = await fs.readFile(sub, "utf8");
              const lines = text.split(/\r?\n/);
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes(needle)) {
                  results.push({
                    path: toRelative(sub),
                    line: i + 1,
                    text: lines[i].slice(0, 240),
                  });
                  if (results.length >= max_results) return;
                }
              }
            } catch {}
          }
        }
      }

      await walk(start);
      return { ok: true, query, count: results.length, results };
    },
  }),
};

export const workspaceDescriptionHint = () =>
  `The workspace root on disk is: ${getWorkspaceRoot()}`;
