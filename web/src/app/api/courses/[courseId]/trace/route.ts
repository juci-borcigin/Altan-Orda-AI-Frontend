import { NextResponse } from "next/server";
import { listCourseTraces, summarizeTraces } from "@/lib/course-maker/course-trace";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ courseId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { courseId } = await ctx.params;
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  try {
    const events = await listCourseTraces(supa, courseId);
    const summary = summarizeTraces(events);
    const llm_summary = summarizeTraces(events, { llmOnly: true });
    return NextResponse.json({ events, summary, llm_summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
