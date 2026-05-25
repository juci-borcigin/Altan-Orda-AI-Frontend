import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type RouteCtx = { params: Promise<{ key: string }> };

/** GET: システムポップアップ文言（ao_popup） */
export async function GET(_req: Request, ctx: RouteCtx) {
  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { key: rawKey } = await ctx.params;
  const popupKey = decodeURIComponent(rawKey ?? "").trim();
  if (!popupKey) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const { data, error } = await supa
    .from("ao_popup")
    .select("popup_key, template_text, persona_key")
    .eq("popup_key", popupKey)
    .maybeSingle();

  if (error) {
    console.error("[popup GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    popup_key: String(data.popup_key ?? ""),
    template_text: String(data.template_text ?? ""),
    persona_key: String(data.persona_key ?? ""),
  });
}
