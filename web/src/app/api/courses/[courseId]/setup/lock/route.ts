import { NextResponse } from "next/server";
import { getCourse, updateCourse } from "@/lib/course-maker/course-db";
import {
  briefToCourseParams,
  emptySetupState,
  parseSetupState,
  serializeSetupState,
} from "@/lib/course-maker/course-theme-brief";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ courseId: string }> };

/** 骨格確定 → 管理（本文）画面へ進める */
export async function POST(_req: Request, ctx: Ctx) {
  const { courseId } = await ctx.params;
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const course = await getCourse(supa, courseId);
    if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const setup = parseSetupState(course.admin_memo) ?? emptySetupState();
    if (!setup.skeleton) {
      return NextResponse.json({ error: "skeleton missing" }, { status: 400 });
    }
    if (!setup.brief) {
      return NextResponse.json({ error: "brief missing" }, { status: 400 });
    }

    setup.skeleton = { ...setup.skeleton, status: "locked" };
    setup.brief = { ...setup.brief, status: "locked" };
    setup.phase = "locked";

    const params = briefToCourseParams(setup.brief);
    params.session_count = setup.skeleton.session_count;

    const updated = await updateCourse(supa, courseId, {
      admin_memo: serializeSetupState(setup),
      params,
      status: "outline_draft",
      title: setup.brief.title || course.title,
    });

    return NextResponse.json({ course: updated, setup });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
