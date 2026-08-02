import { NextResponse } from "next/server";
import { getCourse, updateCourse } from "@/lib/course-maker/course-db";
import { generateOutlineSkeleton } from "@/lib/course-maker/course-hearing";
import { recordCourseTrace } from "@/lib/course-maker/course-trace";
import {
  buildDefaultBrief,
  emptySetupState,
  parseSetupState,
  serializeSetupState,
} from "@/lib/course-maker/course-theme-brief";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: Promise<{ courseId: string }> };

/** 骨格アウトライン生成／修正 */
export async function POST(req: Request, ctx: Ctx) {
  const { courseId } = await ctx.params;
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  let body: { revision?: string };
  try {
    body = (await req.json().catch(() => ({}))) as typeof body;
  } catch {
    body = {};
  }

  try {
    const course = await getCourse(supa, courseId);
    if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const setup = parseSetupState(course.admin_memo) ?? emptySetupState();
    if (setup.phase === "locked") {
      return NextResponse.json({ error: "setup already locked" }, { status: 400 });
    }

    const brief = setup.brief ?? buildDefaultBrief(course.title, setup.messages.length);
    if (!setup.brief) setup.brief = brief;

    const { skeleton, llm } = await generateOutlineSkeleton({
      brief,
      revision: body.revision,
      previous: setup.skeleton,
    });

    setup.skeleton = skeleton;
    setup.phase = "skeleton";

    const updated = await updateCourse(supa, courseId, {
      admin_memo: serializeSetupState(setup),
    });

    await recordCourseTrace(supa, {
      course_id: courseId,
      phase: "tier1_outline",
      step_key: `setup_skeleton_${Date.now()}`,
      model_id: llm.model_id,
      provider: llm.provider,
      user_prompt: body.revision?.trim() || "(new)",
      response_text: JSON.stringify(skeleton, null, 2),
      prompt_tokens: llm.prompt_tokens,
      completion_tokens: llm.completion_tokens,
      latency_ms: llm.latency_ms,
      meta: { kind: "setup_outline_skeleton" },
    });

    return NextResponse.json({ course: updated, setup, skeleton });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
