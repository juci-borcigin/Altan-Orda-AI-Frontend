import { NextResponse } from "next/server";
import { getCourse, updateCourse } from "@/lib/course-maker/course-db";
import { isPublicLearnCourse } from "@/lib/course-maker/course-public-learn";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ courseId: string }> };

/** 公開受講: 最終閲覧回のみ更新 */
export async function PATCH(req: Request, ctx: Ctx) {
  const { courseId } = await ctx.params;
  if (!isPublicLearnCourse(courseId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  let body: { last_opened_session_no?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.last_opened_session_no == null) {
    return NextResponse.json({ error: "last_opened_session_no required" }, { status: 400 });
  }

  try {
    const course = await getCourse(supa, courseId);
    if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const updated = await updateCourse(supa, courseId, {
      last_opened_session_no: body.last_opened_session_no,
    });
    return NextResponse.json({
      course: {
        id: updated.id,
        last_opened_session_no: updated.last_opened_session_no,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
