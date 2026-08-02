import { NextResponse } from "next/server";
import { ensureSessionRows, ensureVisualRows, getCourse, updateCourse } from "@/lib/course-maker/course-db";
import { isCourseDevMode } from "@/lib/course-maker/course-dev";
import { generateCourseMaster } from "@/lib/course-maker/course-llm";
import type { CourseParams } from "@/lib/course-maker/course-master-schema";
import { normalizeCourseParams } from "@/lib/course-maker/course-master-schema";
import { recordCourseTrace } from "@/lib/course-maker/course-trace";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: Promise<{ courseId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { courseId } = await ctx.params;
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const course = await getCourse(supa, courseId);
    if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const params = normalizeCourseParams(course.params as CourseParams);
    const { master, model_id, attempts, verification } = await generateCourseMaster(params, {
      course_id: courseId,
      supa,
    });

    await ensureSessionRows(supa, courseId, master.meta.session_count);
    await ensureVisualRows(supa, courseId, master);

    const updated = await updateCourse(supa, courseId, {
      course_master: master,
      status: "outline_draft",
      params,
    });

    if (isCourseDevMode()) {
      await recordCourseTrace(supa, {
        course_id: courseId,
        phase: "ui_display",
        step_key: "tier1_master_summary",
        ui_display_ref: `/courses/${courseId}`,
        response_text: JSON.stringify(
          master.sessions.map((s) => ({
            session_no: s.session_no,
            title: s.title,
            sections: s.sections.map((sec) => ({
              section_no: sec.section_no,
              heading: sec.heading,
              intent: sec.intent,
            })),
          })),
          null,
          2,
        ),
        meta: {
          session_count: master.meta.session_count,
          model_id,
          attempts,
          note: "LLM の生出力 JSON は tier1_outline トレースの response_text を参照",
        },
      });
    }

    return NextResponse.json({
      course: updated,
      master,
      verification,
      generation_meta: { phase: "outline", model_id, attempts },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
