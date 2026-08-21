import { NextResponse } from "next/server";
import { getCourse, updateCourse } from "@/lib/course-maker/course-db";
import { runHearingTurn } from "@/lib/course-maker/course-hearing";
import { recordCourseTrace } from "@/lib/course-maker/course-trace";
import {
  emptySetupState,
  parseSetupState,
  serializeSetupState,
  type HearingTurn,
} from "@/lib/course-maker/course-theme-brief";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: Promise<{ courseId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { courseId } = await ctx.params;
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  let body: { message?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const message = body.message?.trim();
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

  try {
    const course = await getCourse(supa, courseId);
    if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const setup = parseSetupState(course.admin_memo) ?? emptySetupState();
    if (setup.phase === "locked") {
      return NextResponse.json({ error: "setup already locked" }, { status: 400 });
    }

    const history = setup.messages as HearingTurn[];
    const result = await runHearingTurn({
      title: course.title,
      history,
      message,
    });

    setup.messages = [
      ...history,
      { role: "user", content: message },
      { role: "assistant", content: result.reply },
    ];
    setup.phase = "hearing";

    const updated = await updateCourse(supa, courseId, {
      admin_memo: serializeSetupState(setup),
    });

    await recordCourseTrace(supa, {
      course_id: courseId,
      phase: "chat",
      step_key: `setup_hear_${Date.now()}`,
      model_id: result.model_id,
      provider: result.provider,
      user_prompt: message,
      response_text: result.reply,
      prompt_tokens: result.prompt_tokens,
      completion_tokens: result.completion_tokens,
      latency_ms: result.latency_ms,
      meta: { kind: "setup_hearing" },
    });

    return NextResponse.json({
      course: updated,
      setup,
      reply: result.reply,
      model_id: result.model_id,
      latency_ms: result.latency_ms,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
