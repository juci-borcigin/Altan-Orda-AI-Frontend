import { NextResponse } from "next/server";
import { getCourse, listSessions, updateCourse } from "@/lib/course-maker/course-db";
import {
  buildImagePatternComparison,
  listCourseTraceCosts,
  listCourseTraces,
  summarizeTraces,
  type CourseTraceRow,
} from "@/lib/course-maker/course-trace";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ courseId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { courseId } = await ctx.params;
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  let body: { last_opened_session_no?: number; admin_memo?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.last_opened_session_no == null && body.admin_memo === undefined) {
    return NextResponse.json(
      { error: "last_opened_session_no or admin_memo required" },
      { status: 400 },
    );
  }
  try {
    const patch: Record<string, unknown> = {};
    if (body.last_opened_session_no != null) {
      patch.last_opened_session_no = body.last_opened_session_no;
    }
    if (body.admin_memo !== undefined) {
      patch.admin_memo = body.admin_memo;
    }
    const course = await updateCourse(supa, courseId, patch);
    return NextResponse.json({ course });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type VisualRow = Record<string, unknown> & {
  artifact_url?: string | null;
  slot_id?: string;
  session_no?: number;
};

/** 一覧用: 巨大な data-URL を落とす（本体は /visuals で別取得） */
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

function preferredImageFilter(
  rows: Array<Pick<CourseTraceRow, "phase" | "cost_usd" | "latency_ms"> & Partial<CourseTraceRow>>,
  modelIncludes: string,
  quality: string,
) {
  return rows.filter((r) => {
    if (r.phase === "chat") return false;
    if (r.phase !== "tier2_image") return true;
    const model = (r.model_id ?? "").includes(modelIncludes);
    const q =
      r.meta && typeof r.meta === "object" && "quality" in r.meta
        ? String((r.meta as { quality?: unknown }).quality ?? "").toLowerCase()
        : "";
    return model && q === quality;
  });
}

export async function GET(req: Request, ctx: Ctx) {
  const { courseId } = await ctx.params;
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const url = new URL(req.url);
  const includeLogs = url.searchParams.get("include_logs") === "1";
  const includeArtifacts = url.searchParams.get("include_artifacts") === "1";

  try {
    const course = await getCourse(supa, courseId);
    if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const sessions = await listSessions(supa, courseId);

    const visualsSelect = includeArtifacts
      ? "*"
      : "id, course_id, session_no, slot_id, visual_type, status, prompt, image_model_id, image_model_tier, error_message, created_at, updated_at";

    const [{ data: visuals }, { data: sources }] = await Promise.all([
      supa.from("ao_course_visuals").select(visualsSelect).eq("course_id", courseId).order("session_no"),
      supa.from("ao_course_sources").select("*").eq("course_id", courseId),
    ]);

    let process_logs: Awaited<ReturnType<typeof listCourseTraces>> = [];
    let costRows: Awaited<ReturnType<typeof listCourseTraceCosts>> = [];
    try {
      costRows = await listCourseTraceCosts(supa, courseId, 800);
    } catch {
      /* ignore */
    }

    if (includeLogs) {
      try {
        process_logs = await listCourseTraces(supa, courseId, 400);
      } catch (logErr) {
        console.error("[courses GET] process_logs:", logErr);
      }
    }

    const forCompare = includeLogs && process_logs.length > 0 ? process_logs : costRows;
    const image_pattern_compare = buildImagePatternComparison(forCompare, {
      highlightQuality: "medium",
      highlightModelIncludes: "gpt-image-2",
    });

    const midReady = Boolean(image_pattern_compare.mid_course_total);
    const llm_summary = midReady
      ? summarizeTraces(preferredImageFilter(forCompare, "gpt-image-2", "medium"), { llmOnly: true })
      : summarizeTraces(forCompare, { llmOnly: true });

    const visualPayload = includeArtifacts
      ? (visuals ?? [])
      : slimVisuals(visuals as VisualRow[] | null);

    return NextResponse.json({
      course,
      sessions,
      visuals: visualPayload,
      sources: sources ?? [],
      process_logs: includeLogs ? process_logs : [],
      llm_summary,
      image_pattern_compare,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
