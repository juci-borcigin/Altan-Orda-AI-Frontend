import { NextResponse } from "next/server";
import { getCourse, updateCourse } from "@/lib/course-maker/course-db";
import type { CourseMaster } from "@/lib/course-maker/course-master-schema";
import { verifyCourseMaster } from "@/lib/course-maker/verify-course-master";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ courseId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { courseId } = await ctx.params;
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const course = await getCourse(supa, courseId);
    if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const master = course.course_master as CourseMaster | null;
    if (!master) {
      return NextResponse.json({ error: "course_master not generated" }, { status: 400 });
    }

    const verification = verifyCourseMaster(master);
    if (verification.status === "error") {
      return NextResponse.json({ error: "Master verification failed", verification }, { status: 409 });
    }

    const lockedMaster: CourseMaster = {
      ...master,
      sources: { ...master.sources, locked: true },
    };

    await supa
      .from("ao_course_sources")
      .update({ locked_at: new Date().toISOString() })
      .eq("course_id", courseId);

    const updated = await updateCourse(supa, courseId, {
      course_master: lockedMaster,
      status: "outline_approved",
    });

    return NextResponse.json({ course: updated, verification });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
