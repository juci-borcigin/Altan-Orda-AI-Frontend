import { NextResponse } from "next/server";
import { BOOKS_MAX_CHUNKS_PER_SOURCE } from "@/lib/ao-rag-policy";
import { chunkTextForKind } from "@/lib/ao-chunk-profiles";
import { hashTextContent, upsertBookChunks } from "@/lib/qdrant-books";
import { loadQdrantConfig } from "@/lib/qdrant-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const TEXT_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "application/octet-stream",
]);

export async function POST(req: Request) {
  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const oai = process.env.OPENAI_API_KEY?.trim();
  if (!oai) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 503 });
  }
  const qcfg = loadQdrantConfig();
  if (!qcfg) {
    return NextResponse.json({ error: "QDRANT_URL / QDRANT_API_KEY is not set" }, { status: 503 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const themeSlug = String(form.get("theme_slug") ?? "").trim();
  const workTitle = String(form.get("work_title") ?? "").trim();
  const authors = String(form.get("authors") ?? "").trim();
  const displayName = String(form.get("display_name") ?? "").trim();

  if (!themeSlug) {
    return NextResponse.json({ error: "theme_slug is required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const mime = (file.type || "text/plain").toLowerCase();
  const name = displayName || file.name || "upload";
  if (!TEXT_MIMES.has(mime) && !name.match(/\.(txt|md|markdown)$/i)) {
    return NextResponse.json(
      {
        error:
          "Phase 6 縦スライス: .txt / .md のみ対応（PDF は後続）。mime=" + mime,
      },
      { status: 400 },
    );
  }

  const text = await file.text();
  if (!text.trim()) {
    return NextResponse.json({ error: "empty file" }, { status: 400 });
  }

  const contentHash = hashTextContent(text);
  let chunks = chunkTextForKind(text, "books");
  if (chunks.length > BOOKS_MAX_CHUNKS_PER_SOURCE) {
    chunks = chunks.slice(0, BOOKS_MAX_CHUNKS_PER_SOURCE);
  }

  const { data: row, error: insErr } = await supa
    .from("ao_book_sources")
    .insert({
      project_id: "notebook",
      ingest_kind: "upload",
      display_name: name,
      work_title: workTitle || name,
      authors,
      extracted_text: "",
      content_hash: contentHash,
      metadata: { theme_slug: themeSlug },
    })
    .select("id")
    .single();

  if (insErr || !row?.id) {
    return NextResponse.json(
      { error: insErr?.message ?? "insert ao_book_sources failed" },
      { status: 500 },
    );
  }

  try {
    const embedded = await upsertBookChunks({
      cfg: qcfg,
      openaiKey: oai,
      projectId: "notebook",
      themeSlug,
      sourceId: row.id,
      workTitle: workTitle || name,
      chunks,
      contentHash,
    });
    return NextResponse.json({
      ok: true,
      source_id: row.id,
      theme_slug: themeSlug,
      chunks: embedded,
      content_hash: contentHash,
    });
  } catch (e) {
    await supa.from("ao_book_sources").delete().eq("id", row.id);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
