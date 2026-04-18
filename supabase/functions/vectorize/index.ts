/**
 * Step 7-1（任意）: DB Webhook 用 Edge Function ひな形。本番は web が embedding-pipeline で処理可能。
 * deno deploy / supabase functions deploy に合わせて調整してください。
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CHUNK = 500 * 3;
const OVERLAP = 50 * 3;

function chunkText(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= CHUNK) return [t];
  const out: string[] = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(i + CHUNK, t.length);
    out.push(t.slice(i, end));
    if (end >= t.length) break;
    i = end - OVERLAP;
    if (i < 0) i = 0;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body: { record?: { id?: string; text?: string } };
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const msgId = body.record?.id;
  const text = body.record?.text;
  if (!msgId || !text?.trim()) {
    return new Response("missing id/text", { status: 400 });
  }

  const oai = Deno.env.get("OPENAI_API_KEY") ?? "";
  const supaUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!oai || !supaUrl || !supaKey) {
    return new Response("env not set", { status: 500 });
  }

  const supa = createClient(supaUrl, supaKey, { auth: { persistSession: false } });
  await supa.from("embeddings").delete().eq("source_id", msgId).eq("source_type", "message");

  for (const chunk of chunkText(text)) {
    const embRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${oai}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "text-embedding-3-small", input: chunk }),
    });
    const raw = await embRes.text();
    if (!embRes.ok) return new Response(raw.slice(0, 500), { status: 502 });
    const j = JSON.parse(raw) as { data?: Array<{ embedding?: number[] }> };
    const vec = j.data?.[0]?.embedding;
    if (!vec?.length) continue;
    await supa.from("embeddings").insert({
      source_id: msgId,
      source_type: "message",
      chunk_text: chunk,
      embedding: vec,
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
