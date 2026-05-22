/**
 * Unified text-extraction for the firm's documents.
 *
 * The agent and the ingest pipeline both call extractText() so they have a
 * single source of truth for what the system can "read".
 */
import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export type ExtractResult = {
  text: string;
  kind:
    | "text"
    | "markdown"
    | "html"
    | "csv"
    | "rtf"
    | "pdf"
    | "docx"
    | "xlsx"
    | "image"
    | "binary"
    | "unknown";
  pageCount?: number;
  sheetCount?: number;
  wordCount?: number;
  warnings?: string[];
  truncated?: boolean;
};

const MAX_OUTPUT_CHARS = 200_000;
const MAX_FILE_BYTES = 30 * 1024 * 1024; // 30 MB hard ceiling

const TEXT_EXTS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".log",
  ".json",
  ".yaml",
  ".yml",
  ".xml",
]);

const IMAGE_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".tif",
  ".tiff",
  ".gif",
  ".bmp",
  ".webp",
  ".heic",
]);

export function isExtractable(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  if (TEXT_EXTS.has(ext)) return true;
  if (IMAGE_EXTS.has(ext)) return true;
  return [
    ".csv",
    ".html",
    ".htm",
    ".rtf",
    ".pdf",
    ".docx",
    ".xlsx",
    ".xls",
  ].includes(ext);
}

export async function extractText(absPath: string): Promise<ExtractResult> {
  const ext = path.extname(absPath).toLowerCase();
  const st = await fs.stat(absPath);
  if (st.size > MAX_FILE_BYTES) {
    return {
      text: "",
      kind: "binary",
      warnings: [
        `File is ${(st.size / 1024 / 1024).toFixed(1)} MB which exceeds the 30 MB extraction limit.`,
      ],
    };
  }

  if (TEXT_EXTS.has(ext)) return extractPlainText(absPath, ext);
  if (ext === ".csv") return extractPlainText(absPath, ".csv");
  if (ext === ".html" || ext === ".htm") return extractHtml(absPath);
  if (ext === ".rtf") return extractRtf(absPath);
  if (ext === ".pdf") return extractPdf(absPath);
  if (ext === ".docx") return extractDocx(absPath);
  if (ext === ".xlsx" || ext === ".xls") return extractXlsx(absPath);
  if (IMAGE_EXTS.has(ext)) return extractImage(absPath, ext);

  // Unknown extension — try as UTF-8 text, otherwise mark as binary.
  return tryGenericText(absPath);
}

async function extractPlainText(
  abs: string,
  ext: string,
): Promise<ExtractResult> {
  const text = await fs.readFile(abs, "utf8");
  return finalize(text, ext === ".md" || ext === ".markdown" ? "markdown" : "text");
}

async function extractHtml(abs: string): Promise<ExtractResult> {
  const raw = await fs.readFile(abs, "utf8");
  const text = raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
  return finalize(text, "html");
}

async function extractRtf(abs: string): Promise<ExtractResult> {
  const raw = await fs.readFile(abs, "utf8");
  // Strip basic RTF control words and groups.
  const text = raw
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\'[0-9a-fA-F]{2}/g, "")
    .replace(/\\[a-z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+\n/g, "\n")
    .trim();
  return finalize(text, "rtf");
}

async function extractPdf(abs: string): Promise<ExtractResult> {
  const { extractText: pdfExtract, getDocumentProxy } = await import("unpdf");
  const buf = await fs.readFile(abs);
  // unpdf accepts a Uint8Array; copy the underlying bytes.
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const pdf = await getDocumentProxy(bytes);
  const { text, totalPages } = await pdfExtract(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join("\n\n") : text;

  const warnings: string[] = [];
  if (merged.trim().length === 0) {
    warnings.push(
      "PDF returned no extractable text — likely a scanned/image PDF. OCR is not yet enabled.",
    );
  }
  const result = finalize(merged, "pdf");
  result.pageCount = totalPages;
  result.warnings = warnings.length ? warnings : undefined;
  return result;
}

async function extractDocx(abs: string): Promise<ExtractResult> {
  const mammoth = (await import("mammoth")).default;
  const buf = await fs.readFile(abs);
  const { value, messages } = await mammoth.extractRawText({ buffer: buf });
  const warnings = messages
    .filter((m) => m.type === "warning")
    .map((m) => m.message);
  const result = finalize(value, "docx");
  if (warnings.length) result.warnings = warnings;
  return result;
}

async function extractXlsx(abs: string): Promise<ExtractResult> {
  const XLSX = await import("xlsx");
  const buf = await fs.readFile(abs);
  const wb = XLSX.read(buf, { type: "buffer" });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    parts.push(`# Sheet: ${name}\n${csv}`);
  }
  const result = finalize(parts.join("\n\n"), "xlsx");
  result.sheetCount = wb.SheetNames.length;
  return result;
}

async function extractImage(
  abs: string,
  ext: string,
): Promise<ExtractResult> {
  // Optional OCR via tesseract CLI. Gracefully degrades when absent.
  const tesseract = await which("tesseract");
  if (!tesseract) {
    return {
      text: "",
      kind: "image",
      warnings: [
        `Image file (${ext}). OCR not available. Install 'tesseract' on PATH to enable text extraction from images.`,
      ],
    };
  }
  try {
    const { stdout } = await execAsync(
      `"${tesseract}" "${abs}" - --psm 1 -l eng`,
      { maxBuffer: 50 * 1024 * 1024, timeout: 60_000 },
    );
    const result = finalize(stdout, "image");
    if (!stdout.trim()) {
      result.warnings = ["OCR returned no text."];
    }
    return result;
  } catch (e) {
    return {
      text: "",
      kind: "image",
      warnings: [`OCR failed: ${(e as Error).message}`],
    };
  }
}

async function tryGenericText(abs: string): Promise<ExtractResult> {
  const buf = await fs.readFile(abs);
  // Heuristic: if the buffer contains a high ratio of printable chars, treat as text.
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  let printable = 0;
  for (const b of sample) {
    if (b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b < 0x7f)) {
      printable++;
    }
  }
  const ratio = sample.length === 0 ? 1 : printable / sample.length;
  if (ratio > 0.85) {
    return finalize(buf.toString("utf8"), "text");
  }
  return {
    text: "",
    kind: "binary",
    warnings: ["Binary file — no text extraction available."],
  };
}

function finalize(text: string, kind: ExtractResult["kind"]): ExtractResult {
  const truncated = text.length > MAX_OUTPUT_CHARS;
  const out = truncated ? text.slice(0, MAX_OUTPUT_CHARS) : text;
  const wordCount = out
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
  return {
    text: out,
    kind,
    wordCount,
    truncated: truncated || undefined,
  };
}

async function which(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`command -v ${cmd}`);
    const out = stdout.trim();
    return out || null;
  } catch {
    return null;
  }
}
