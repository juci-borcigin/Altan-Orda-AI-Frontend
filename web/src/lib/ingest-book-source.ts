import { BOOKS_MAX_CHUNKS_PER_SOURCE } from "./ao-rag-policy";
import { chunkTextForKind } from "./ao-chunk-profiles";
import { hashTextContent, upsertBookChunks } from "./qdrant-books";
import type { QdrantConfig } from "./qdrant-client";
import type { SupabaseClient } from "@supabase/supabase-js";

export type IngestBookSourceInput = {
  text: string;
  displayName: string;
  workTitle: string;
  authors: string;
  themeSlug: string;
  ingestKind?: string;
  sourceFile?: string;
};

export type IngestBookSourceResult =
  | { ok: true; sourceId: string; chunks: number; contentHash: string }
  | { ok: false; error: string };

export async function ingestBookSource(opts: {
  supa: SupabaseClient;
  qcfg: QdrantConfig;
  openaiKey: string;
  input: IngestBookSourceInput;
}): Promise<IngestBookSourceResult> {
  const text = opts.input.text.trim();
  if (!text) {
    return { ok: false, error: "empty text" };
  }

  const contentHash = hashTextContent(text);
  let chunks = chunkTextForKind(text, "books");
  if (chunks.length > BOOKS_MAX_CHUNKS_PER_SOURCE) {
    chunks = chunks.slice(0, BOOKS_MAX_CHUNKS_PER_SOURCE);
  }
  if (chunks.length === 0) {
    return { ok: false, error: "no chunks after split" };
  }

  const name = opts.input.displayName.trim() || "upload";
  const workTitle = opts.input.workTitle.trim() || name;

  const { data: row, error: insErr } = await opts.supa
    .from("ao_book_sources")
    .insert({
      project_id: "notebook",
      ingest_kind: opts.input.ingestKind ?? "upload",
      display_name: name,
      work_title: workTitle,
      authors: opts.input.authors ?? "",
      extracted_text: "",
      content_hash: contentHash,
      metadata: {
        theme_slug: opts.input.themeSlug,
        ...(opts.input.sourceFile ? { source_file: opts.input.sourceFile } : {}),
      },
    })
    .select("id")
    .single();

  if (insErr || !row?.id) {
    return { ok: false, error: insErr?.message ?? "insert ao_book_sources failed" };
  }

  try {
    const embedded = await upsertBookChunks({
      cfg: opts.qcfg,
      openaiKey: opts.openaiKey,
      projectId: "notebook",
      themeSlug: opts.input.themeSlug,
      sourceId: row.id,
      workTitle,
      chunks,
      contentHash,
    });
    return { ok: true, sourceId: row.id, chunks: embedded, contentHash };
  } catch (e) {
    await opts.supa.from("ao_book_sources").delete().eq("id", row.id);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
