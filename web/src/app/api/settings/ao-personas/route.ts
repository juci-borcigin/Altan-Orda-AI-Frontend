import { NextResponse } from "next/server";
import type { AoPersonaDisplayRow } from "@/lib/ao-persona-display";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** GET: チャット UI 用の僚友表示（name / alias / avatar_path）。1回取得してクライアントでキャッシュ想定。 */
export async function GET() {
  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ personas: [], supabaseConfigured: false }, { status: 503 });
  }

  const { data, error } = await supa
    .from("ao_personas")
    .select("persona_key, name, alias, default_project_id, avatar_path")
    .order("persona_key");

  if (error) {
    console.error("[settings/ao-personas GET]", error.message);
    return NextResponse.json({ error: "読込に失敗しました", detail: error.message }, { status: 500 });
  }

  const personas: AoPersonaDisplayRow[] = (data ?? []).map((row) => ({
    persona_key: String(row.persona_key ?? ""),
    name: String(row.name ?? ""),
    alias: String(row.alias ?? ""),
    default_project_id: String(row.default_project_id ?? ""),
    avatar_path: String(row.avatar_path ?? ""),
  }));

  return NextResponse.json({ personas, supabaseConfigured: true });
}
