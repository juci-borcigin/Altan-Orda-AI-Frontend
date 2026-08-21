import { NextResponse } from "next/server";
import { getCourse, listSessions } from "@/lib/course-maker/course-db";
import { isPublicLearnCourse } from "@/lib/course-maker/course-public-learn";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ courseId: string }> };

type VisualRow = Record<string, unknown> & {
  artifact_url?: string | null;
  status?: string;
};

function slimVisuals(rows: VisualRow[] | null | undefined) {
  return (rows ?? []).map((v) => {
    const url = typeof v.artifact_url === "string" ? v.artifact_url : null;
    const { artifact_url: _drop, ...rest } = v;
    const status = typeof rest.status === "string" ? rest.status : "";
    const hasArtifact = status === "ready" || Boolean(url);
    return {
      ...rest,
      has_artifact: hasArtifact,
      artifact_bytes: url ? url.length : 0,
      artifact_url: null as string | null,
    };
  });
}

/** 公開受講用: 講義＋回＋visual メタ（巨大 artifact / 管理メモ / ログなし） */
export async function GET(_req: Request, ctx: Ctx) {
  const { courseId } = await ctx.params;
  if (!isPublicLearnCourse(courseId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const course = await getCourse(supa, courseId);
    if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const sessions = await listSessions(supa, courseId);
    const { data: visuals, error } = await supa
      .from("ao_course_visuals")
      .select(
        "id, course_id, session_no, slot_id, visual_type, status, prompt, image_model_id, image_model_tier, error_message, created_at, updated_at",
      )
      .eq("course_id", courseId)
      .order("session_no");
    if (error) throw new Error(error.message);

    return NextResponse.json({
      course: {
        id: course.id,
        title: course.title,
        status: course.status,
        course_master: course.course_master,
        last_opened_session_no: course.last_opened_session_no,
      },
      sessions: sessions.map((s) => ({
        session_no: s.session_no,
        status: s.status,
        markdown_body: s.markdown_body,
        word_count: s.word_count,
      })),
      visuals: slimVisuals(visuals as VisualRow[] | null),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
