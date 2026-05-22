import { tool, embed } from "ai";
import { z } from "zod";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { getEmbeddingModel } from "@/lib/model";
import { getWorkspaceRoot } from "@/lib/workspace";

export const ragTools = {
  search_documents: tool({
    description:
      "Semantic search across ingested workspace documents using vector similarity. Returns the most relevant text passages with their source file.",
    inputSchema: z.object({
      query: z.string().min(2).describe("Natural-language question or topic."),
      limit: z.number().int().min(1).max(10).default(5),
    }),
    execute: async ({ query, limit }) => {
      if (!isSupabaseConfigured()) {
        return {
          ok: false,
          error:
            "Vector database not configured. Use search_files or list_files instead, or run document ingestion.",
        };
      }
      const supabase = getSupabase();
      if (!supabase) return { ok: false, error: "Supabase client unavailable" };

      const { embedding } = await embed({
        model: getEmbeddingModel(),
        value: query,
      });

      const { data, error } = await supabase.rpc("match_chunks", {
        query_embedding: embedding,
        match_count: limit,
        filter_workspace: getWorkspaceRoot(),
      });
      if (error) return { ok: false, error: error.message };

      return {
        ok: true,
        query,
        matches: (data ?? []).map((d: {
          id: string;
          source_path: string;
          chunk_index: number;
          content: string;
          similarity: number;
        }) => ({
          source: d.source_path,
          chunk: d.chunk_index,
          similarity: d.similarity,
          content: d.content,
        })),
      };
    },
  }),
};
