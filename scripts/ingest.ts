/**
 * Walk the workspace directory, chunk every text file, embed each chunk with
 * the local Ollama embedding model, and upsert into Supabase.
 *
 * Run: pnpm ingest
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { embedMany } from "ai";
import { createClient } from "@supabase/supabase-js";
import { getEmbeddingModel, getModelInfo } from "../lib/model";
import { ensureWorkspace } from "../lib/workspace";
import { extractText, isExtractable } from "../lib/extract";
const CHUNK_SIZE = 1100;
const CHUNK_OVERLAP = 150;
const EMBED_BATCH = 16;

function chunkText(text: string): string[] {
  const cleaned = text.replace(/\r\n/g, "\n");
  const out: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    out.push(cleaned.slice(i, i + CHUNK_SIZE));
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return out.filter((c) => c.trim().length > 30);
}

async function walk(dir: string, acc: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) await walk(abs, acc);
    else if (isExtractable(e.name)) acc.push(abs);
  }
  return acc;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run `supabase start` and copy the keys into .env.local.",
    );
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const root = await ensureWorkspace();
  const files = await walk(root);
  console.log(`Found ${files.length} ingestable files in ${root}`);
  console.log(`Embedding with: ${getModelInfo().embed}`);

  let totalChunks = 0;
  for (const abs of files) {
    const rel = path.relative(root, abs);
    const fileBytes = await fs.readFile(abs);
    const hash = crypto.createHash("sha256").update(fileBytes).digest("hex");

    const { data: existing } = await supabase
      .from("documents")
      .select("id, content_hash")
      .eq("workspace_root", root)
      .eq("source_path", rel)
      .maybeSingle();

    if (existing?.content_hash === hash) {
      console.log(`  skip (unchanged): ${rel}`);
      continue;
    }

    const extracted = await extractText(abs);
    if (!extracted.text.trim()) {
      const reason = extracted.warnings?.[0] ?? "no text extracted";
      console.log(`  skip (${reason}): ${rel}`);
      continue;
    }

    const chunks = chunkText(extracted.text);
    if (chunks.length === 0) {
      console.log(`  skip (empty after chunking): ${rel}`);
      continue;
    }

    let docId = existing?.id;
    if (docId) {
      await supabase.from("chunks").delete().eq("document_id", docId);
      await supabase
        .from("documents")
        .update({
          bytes: fileBytes.length,
          content_hash: hash,
          ingested_at: new Date().toISOString(),
        })
        .eq("id", docId);
    } else {
      const { data, error } = await supabase
        .from("documents")
        .insert({
          workspace_root: root,
          source_path: rel,
          title: path.basename(rel),
          bytes: fileBytes.length,
          content_hash: hash,
        })
        .select("id")
        .single();
      if (error || !data) {
        console.error(`  error inserting document for ${rel}:`, error?.message);
        continue;
      }
      docId = data.id;
    }

    const rows: {
      document_id: string;
      workspace_root: string;
      source_path: string;
      chunk_index: number;
      content: string;
      embedding: number[];
    }[] = [];

    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
      const batch = chunks.slice(i, i + EMBED_BATCH);
      const { embeddings } = await embedMany({
        model: getEmbeddingModel(),
        values: batch,
      });
      embeddings.forEach((e, j) => {
        rows.push({
          document_id: docId!,
          workspace_root: root,
          source_path: rel,
          chunk_index: i + j,
          content: batch[j],
          embedding: e,
        });
      });
    }

    const { error: insErr } = await supabase.from("chunks").insert(rows);
    if (insErr) {
      console.error(`  error inserting chunks for ${rel}:`, insErr.message);
      continue;
    }
    totalChunks += rows.length;
    const meta = [
      `${rows.length} chunks`,
      extracted.kind,
      extracted.pageCount ? `${extracted.pageCount} pp` : null,
      extracted.sheetCount ? `${extracted.sheetCount} sheets` : null,
      extracted.truncated ? "truncated" : null,
    ]
      .filter(Boolean)
      .join(", ");
    console.log(`  ingested: ${rel} → ${meta}`);
    if (extracted.warnings?.length) {
      for (const w of extracted.warnings) console.log(`    ⚠ ${w}`);
    }
  }

  console.log(`\nDone. ${totalChunks} chunks ingested.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
