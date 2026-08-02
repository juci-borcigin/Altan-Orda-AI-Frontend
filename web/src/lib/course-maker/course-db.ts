import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseMaster, CourseParams } from "./course-master-schema";
import type { VerificationResult } from "./verify-course-master";

export type CourseRow = {
  id: string;
  owner_user_id: string;
  title: string;
  status: string;
  generation_mode: string;
  params: CourseParams;
  course_master: CourseMaster | null;
  last_opened_session_no: number | null;
  admin_memo?: string;
  created_at: string;
  updated_at: string;
};

export type SessionRow = {
  id: string;
  course_id: string;
  session_no: number;
  markdown_body: string | null;
  word_count: number | null;
  status: string;
  verification: VerificationResult | null;
  generation_meta: Record<string, unknown> | null;
};

export async function listCourses(supa: SupabaseClient): Promise<CourseRow[]> {
  const { data, error } = await supa
    .from("ao_courses")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CourseRow[];
}

export async function getCourse(supa: SupabaseClient, id: string): Promise<CourseRow | null> {
  const { data, error } = await supa.from("ao_courses").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CourseRow | null) ?? null;
}

export async function createCourse(
  supa: SupabaseClient,
  params: CourseParams,
  title?: string,
): Promise<CourseRow> {
  const row = {
    title: title?.trim() || params.theme.trim(),
    params,
    status: "draft",
    generation_mode: "pipeline_batch",
  };
  const { data, error } = await supa.from("ao_courses").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as CourseRow;
}

export async function updateCourse(
  supa: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<CourseRow> {
  const { data, error } = await supa
    .from("ao_courses")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CourseRow;
}

export async function listSessions(supa: SupabaseClient, courseId: string): Promise<SessionRow[]> {
  const { data, error } = await supa
    .from("ao_course_sessions")
    .select("*")
    .eq("course_id", courseId)
    .order("session_no", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SessionRow[];
}

export async function upsertSession(
  supa: SupabaseClient,
  courseId: string,
  sessionNo: number,
  patch: Partial<SessionRow>,
): Promise<SessionRow> {
  const { data, error } = await supa
    .from("ao_course_sessions")
    .upsert(
      {
        course_id: courseId,
        session_no: sessionNo,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "course_id,session_no" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as SessionRow;
}

export async function ensureSessionRows(
  supa: SupabaseClient,
  courseId: string,
  count: number,
): Promise<void> {
  for (let n = 1; n <= count; n++) {
    await upsertSession(supa, courseId, n, { status: "pending" });
  }
}

export async function ensureVisualRows(
  supa: SupabaseClient,
  courseId: string,
  master: CourseMaster,
): Promise<void> {
  for (const s of master.sessions) {
    const heroId = `hero_s${s.session_no}`;
    const heroPrompt =
      s.hero_image_prompt?.trim() ||
      `Educational 16:9 hero for ${master.meta.theme} session ${s.session_no}`;
    {
      const { error } = await supa.from("ao_course_visuals").upsert(
        {
          course_id: courseId,
          session_no: s.session_no,
          slot_id: heroId,
          visual_type: "diagram",
          prompt: heroPrompt,
          image_model_tier: "mini",
          image_model_id: "gpt-image-2",
          status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "course_id,session_no,slot_id" },
      );
      if (error) throw new Error(error.message);
    }
    for (const v of s.visual_slots) {
      const { error } = await supa.from("ao_course_visuals").upsert(
        {
          course_id: courseId,
          session_no: s.session_no,
          slot_id: v.slot_id,
          visual_type: v.visual_type,
          prompt: v.prompt_hint,
          image_model_tier: v.image_model_tier,
          image_model_id: v.image_model_tier === "medium" ? "gpt-image-1.5-medium" : "gpt-image-1-mini",
          status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "course_id,session_no,slot_id" },
      );
      if (error) throw new Error(error.message);
    }
  }
}
