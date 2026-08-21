import { NextResponse } from "next/server";
import { getCourse, updateCourse } from "@/lib/course-maker/course-db";
import { summarizeThemeBrief } from "@/lib/course-maker/course-hearing";
import { briefToCourseParams } from "@/lib/course-maker/course-theme-brief";
import { recordCourseTrace } from "@/lib/course-maker/course-trace";
import {
  emptySetupState,
  parseSetupState,
  serializeSetupState,
} from "@/lib/course-maker/course-theme-brief";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: Promise<{ courseId: string }> };

/** ヒアリング終了 → ThemeBrief 一括要約 → confirm フェーズ */
export async function POST(_req: Request, ctx: Ctx) {
  const { courseId } = await ctx.params;
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const course = await getCourse(supa, courseId);
    if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const setup = parseSetupState(course.admin_memo) ?? emptySetupState();
    if (setup.phase === "locked") {
      return NextResponse.json({ error: "setup already locked" }, { status: 400 });
    }

    const { brief, llm } = await summarizeThemeBrief({
      title: course.title,
      messages: setup.messages,
    });

    setup.brief = brief;
    setup.phase = "confirm";

    const params = briefToCourseParams(brief);
    const updated = await updateCourse(supa, courseId, {
      admin_memo: serializeSetupState(setup),
      params,
      title: brief.title || course.title,
    });

    await recordCourseTrace(supa, {
      course_id: courseId,
      phase: "tier1_outline",
      step_key: `setup_brief_${Date.now()}`,
      model_id: llm.model_id,
      provider: llm.provider,
      response_text: JSON.stringify(brief, null, 2),
      prompt_tokens: llm.prompt_tokens,
      completion_tokens: llm.completion_tokens,
      latency_ms: llm.latency_ms,
      meta: { kind: "setup_brief_summarize" },
    });

    return NextResponse.json({ course: updated, setup, brief });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
