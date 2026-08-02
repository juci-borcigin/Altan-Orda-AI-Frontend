import { NextResponse } from "next/server";
import { createCourse, listCourses } from "@/lib/course-maker/course-db";
import {
  normalizeCourseParams,
  type CourseParams,
} from "@/lib/course-maker/course-master-schema";
import {
  defaultOutcome,
  emptySetupState,
  openingAssistantMessage,
  serializeSetupState,
} from "@/lib/course-maker/course-theme-brief";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  try {
    const courses = await listCourses(supa);
    return NextResponse.json({ courses });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  let body: { params?: Partial<CourseParams> & { theme?: string }; title?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = body.title?.trim() || body.params?.theme?.trim() || "";
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  try {
    const params = normalizeCourseParams({
      theme: body.params?.theme?.trim() || title,
      audience: body.params?.audience ?? "working_adult",
      math_level: body.params?.math_level,
      target_outcome: body.params?.target_outcome?.trim() || defaultOutcome(title),
      session_count: body.params?.session_count ?? 5,
    });

    const setup = emptySetupState();
    setup.messages = [{ role: "assistant", content: openingAssistantMessage(title) }];
    setup.phase = "hearing";

    const course = await createCourse(supa, params, title);
    const { updateCourse } = await import("@/lib/course-maker/course-db");
    const withSetup = await updateCourse(supa, course.id, {
      admin_memo: serializeSetupState(setup),
    });

    return NextResponse.json({ course: withSetup, setup });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
