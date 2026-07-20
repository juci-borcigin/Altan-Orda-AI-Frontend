import { NextResponse } from "next/server";
import { getCourse } from "@/lib/course-maker/course-db";
import { generateCourseVisualImage } from "@/lib/course-maker/course-image";
import { recordCourseTrace } from "@/lib/course-maker/course-trace";
import type { CourseMaster } from "@/lib/course-maker/course-master-schema";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: Promise<{ courseId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { courseId } = await ctx.params;
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  let body: { session_no?: number; section_no?: number; slot_id?: string; prompt?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionNo = body.session_no ?? 1;
  const sectionNo = body.section_no ?? 1;
  const slotId = body.slot_id ?? `vis_${sessionNo}_${sectionNo}`;

  try {
    const course = await getCourse(supa, courseId);
    if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const master = course.course_master as CourseMaster | null;
    if (!master) return NextResponse.json({ error: "course_master missing" }, { status: 400 });

    let prompt = body.prompt?.trim() ?? "";
    if (!prompt) {
      const { data: existing } = await supa
        .from("ao_course_visuals")
        .select("prompt")
        .eq("course_id", courseId)
        .eq("session_no", sessionNo)
        .eq("slot_id", slotId)
        .maybeSingle();
      prompt = (existing?.prompt as string | null)?.trim() ?? "";
    }
    if (!prompt) {
      return NextResponse.json(
        { error: "画像プロンプトがありません。先に「文章＋画像プロンプト」を生成してください。" },
        { status: 400 },
      );
    }

    const img = await generateCourseVisualImage({ prompt, courseId, slotId });

    await supa.from("ao_course_visuals").upsert(
      {
        course_id: courseId,
        session_no: sessionNo,
        slot_id: slotId,
        visual_type: "diagram",
        status: "ready",
        artifact_url: img.artifact_url,
        prompt,
        image_model_id: img.model_id,
        image_model_tier: img.model_id.includes("mini") ? "mini" : "medium",
        error_message: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "course_id,session_no,slot_id" },
    );

    await recordCourseTrace(supa, {
      course_id: courseId,
      phase: "tier2_image",
      step_key: `s${sessionNo}_sec${sectionNo}_${slotId}`,
      model_id: img.model_id,
      provider: img.provider,
      user_prompt: prompt,
      response_text: img.revised_prompt ?? "(image)",
      ui_display_ref: `/courses/${courseId}/learn#visual-${slotId}`,
      latency_ms: img.latency_ms,
      cost_usd: img.cost_usd,
      meta: {
        session_no: sessionNo,
        section_no: sectionNo,
        slot_id: slotId,
        size: img.size,
        quality: img.quality,
      },
    });

    return NextResponse.json({
      visual: { slot_id: slotId, session_no: sessionNo, artifact_url: img.artifact_url, prompt },
      image: img,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
