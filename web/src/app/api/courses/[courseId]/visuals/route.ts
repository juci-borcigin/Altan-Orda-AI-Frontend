import { NextResponse } from "next/server";
import { getCourse } from "@/lib/course-maker/course-db";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ courseId: string }> };

/** 1スロット分の画像本体だけ返す（講座 GET から巨大 base64 を外すため） */
export async function GET(req: Request, ctx: Ctx) {
  const { courseId } = await ctx.params;
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const url = new URL(req.url);
  const sessionNo = Number(url.searchParams.get("session_no") ?? "");
  const sectionNo = Number(url.searchParams.get("section_no") ?? "");
  const slotId =
    url.searchParams.get("slot_id")?.trim() ||
    (Number.isFinite(sessionNo) && Number.isFinite(sectionNo)
      ? `vis_${sessionNo}_${sectionNo}`
      : "");

  if (!slotId || !Number.isFinite(sessionNo)) {
    return NextResponse.json(
      { error: "session_no + section_no (or slot_id) required" },
      { status: 400 },
    );
  }

  try {
    const course = await getCourse(supa, courseId);
    if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data, error } = await supa
      .from("ao_course_visuals")
      .select("slot_id, session_no, status, artifact_url, prompt, image_model_id, image_model_tier, visual_type, error_message")
      .eq("course_id", courseId)
      .eq("session_no", sessionNo)
      .eq("slot_id", slotId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "Visual not found" }, { status: 404 });

    return NextResponse.json({ visual: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
