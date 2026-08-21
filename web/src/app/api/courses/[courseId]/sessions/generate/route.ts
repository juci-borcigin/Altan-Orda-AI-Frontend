import { NextResponse } from "next/server";
import {
  getCourse,
  listSessions,
  updateCourse,
  upsertSession,
} from "@/lib/course-maker/course-db";
import { mergeSessionMarkdown } from "@/lib/course-maker/course-admin-view";
import { parseTier2OutputMode, type Tier2OutputMode } from "@/lib/course-maker/course-dev";
import { generateCourseVisualImage } from "@/lib/course-maker/course-image";
import {
  generateSessionContent,
  generateSessionSection,
} from "@/lib/course-maker/course-llm";
import {
  heroSlotId,
  type CourseMaster,
} from "@/lib/course-maker/course-master-schema";
import {
  attachWikimediaSectionImages,
  resolveHeroImagePrompt,
} from "@/lib/course-maker/course-session-media";
import { recordCourseTrace } from "@/lib/course-maker/course-trace";
import { verifySessionBody } from "@/lib/course-maker/verify-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: Promise<{ courseId: string }> };
type Supa = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** Format v2: 回メイン画像のみ生成（セクション画像は Wikimedia） */
async function generateSessionHeroImage(
  supa: Supa,
  courseId: string,
  master: CourseMaster,
  sessionNo: number,
) {
  const slotId = heroSlotId(sessionNo);
  const prompt = resolveHeroImagePrompt(master, sessionNo);
  const img = await generateCourseVisualImage({
    prompt,
    courseId,
    slotId,
    quality: "low",
  });
  await supa.from("ao_course_visuals").upsert(
    {
      course_id: courseId,
      session_no: sessionNo,
      slot_id: slotId,
      visual_type: "diagram",
      status: "ready",
      artifact_url: img.artifact_url,
      prompt,
      image_model_id: img.model_id,
      image_model_tier: "mini",
      error_message: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "course_id,session_no,slot_id" },
  );
  await recordCourseTrace(supa, {
    course_id: courseId,
    phase: "tier2_image",
    step_key: `s${sessionNo}_${slotId}`,
    model_id: img.model_id,
    provider: img.provider,
    user_prompt: prompt,
    response_text: img.revised_prompt ?? "(hero image)",
    latency_ms: img.latency_ms,
    cost_usd: img.cost_usd,
    meta: {
      session_no: sessionNo,
      kind: "hero",
      size: img.size,
      quality: img.quality,
    },
  });
  return img;
}

async function generateOneSession(
  supa: Supa,
  courseId: string,
  master: CourseMaster,
  sessionNo: number,
  opts: { section_no?: number; output: Tier2OutputMode },
) {
  const session = master.sessions.find((s) => s.session_no === sessionNo);
  if (!session) throw new Error(`session ${sessionNo} not found`);

  const sections = [...session.sections]
    .sort((a, b) => a.section_no - b.section_no)
    .filter((sec) => (opts.section_no != null ? sec.section_no === opts.section_no : true));

  if (sections.length === 0) throw new Error(`section ${opts.section_no} not found`);

  await upsertSession(supa, courseId, sessionNo, { status: "generating" });

  const existingRows = await listSessions(supa, courseId);
  const existingBody = existingRows.find((r) => r.session_no === sessionNo)?.markdown_body ?? null;

  const parts: string[] = [];
  let model_id = "";
  let fallback_used = false;
  let llm_call_count = 0;
  const trace = { course_id: courseId, supa };
  let workingMaster = master;

  // text / both: 本文（soft 字数）
  if (opts.output === "text" || opts.output === "both") {
    if (opts.section_no == null) {
      const result = await generateSessionContent({
        master: workingMaster,
        session_no: sessionNo,
        trace,
        enforce_length: false,
      });
      model_id = result.model_id;
      fallback_used = result.fallback_used;
      llm_call_count = result.llm_calls.length;
      for (const page of result.pages) {
        parts.push(page.markdown.trim());
      }
    } else {
      const sec = sections[0]!;
      const result = await generateSessionSection({
        master: workingMaster,
        session_no: sessionNo,
        section_no: sec.section_no,
        trace,
      });
      model_id = result.model_id;
      llm_call_count = result.llm ? 1 : 0;
      parts.push(result.markdown.trim());
    }

    // 全文生成時のみ Wikimedia セクション画像を付与して master を更新
    if (opts.section_no == null) {
      workingMaster = await attachWikimediaSectionImages(workingMaster, sessionNo);
      await updateCourse(supa, courseId, { course_master: workingMaster });
    }
  }

  // image / both: 回メイン画像のみ（Image2 Low）
  let hero: { artifact_url: string; cost_usd: number } | null = null;
  if (opts.output === "image" || opts.output === "both") {
    if (opts.section_no != null) {
      // セクション単位の画像生成は v2 ではしない（Wikimedia）
    } else {
      const img = await generateSessionHeroImage(supa, courseId, workingMaster, sessionNo);
      hero = { artifact_url: img.artifact_url, cost_usd: img.cost_usd };
    }
  }

  let markdown_body: string | null = null;
  if (parts.length > 0) {
    if (opts.section_no != null && parts.length === 1) {
      markdown_body = mergeSessionMarkdown({
        existing: existingBody,
        sectionNo: opts.section_no,
        newMarkdown: parts[0]!,
        sections: session.sections,
      });
    } else {
      markdown_body = parts.join("\n\n");
    }
  }
  const word_count = markdown_body ? markdown_body.replace(/\s/g, "").length : null;
  const valid_source_ids = new Set(workingMaster.sources.items.map((s) => s.source_id));
  if (valid_source_ids.size === 0) valid_source_ids.add("mock_chunk_1");

  const sessionForVerify =
    workingMaster.sessions.find((s) => s.session_no === sessionNo) ?? session;

  const verification =
    markdown_body != null
      ? verifySessionBody({
          markdown: markdown_body,
          session: sessionForVerify,
          target_chars: workingMaster.meta.target_chars_per_session,
          valid_source_ids,
        })
      : null;

  const patch: Record<string, unknown> = {
    status: "ready",
    generation_meta: {
      model_id,
      section_count: sections.length,
      output: opts.output,
      partial: opts.section_no != null,
      fallback_used,
      llm_call_count,
      format: "v2",
      hero_url: hero?.artifact_url ?? null,
    },
  };
  if (markdown_body != null) {
    patch.markdown_body = markdown_body;
    patch.word_count = word_count;
    patch.verification = verification;
  }

  await upsertSession(supa, courseId, sessionNo, patch);

  if (markdown_body) {
    await recordCourseTrace(supa, {
      course_id: courseId,
      phase: "ui_display",
      step_key: `learn_s${sessionNo}${opts.section_no != null ? `_sec${opts.section_no}` : ""}`,
      ui_display_ref: `/courses/${courseId}/learn`,
      response_text: markdown_body.slice(0, 2000),
      meta: { word_count, output: opts.output, format: "v2" },
    });
  }

  return {
    session_no: sessionNo,
    verification,
    model_id,
    markdown_body,
    output: opts.output,
    hero,
  };
}

export async function POST(req: Request, ctx: Ctx) {
  const { courseId } = await ctx.params;
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  let body: {
    session_no?: number;
    section_no?: number;
    pipeline?: boolean;
    output?: Tier2OutputMode;
  } = {};
  try {
    body = (await req.json().catch(() => ({}))) as typeof body;
  } catch {
    /* empty */
  }

  // デフォルトは本文＋Wikimedia。回メイン画像は output=image|both
  const output = body.output != null ? parseTier2OutputMode(body.output) : "text";

  try {
    const course = await getCourse(supa, courseId);
    if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (course.status !== "outline_approved" && course.status !== "generating" && course.status !== "ready") {
      return NextResponse.json({ error: "Outline must be approved first" }, { status: 409 });
    }

    const master = course.course_master as CourseMaster | null;
    if (!master) return NextResponse.json({ error: "course_master missing" }, { status: 400 });

    await updateCourse(supa, courseId, { status: "generating" });

    const results = [];
    const pipeline = body.pipeline !== false;
    const onlySession = body.session_no;
    const onlySection = body.section_no;

    if (onlySession != null) {
      results.push(
        await generateOneSession(supa, courseId, master, onlySession, {
          section_no: onlySection,
          output,
        }),
      );
    } else if (pipeline) {
      let current = master;
      for (let n = 1; n <= master.meta.session_count; n++) {
        const courseNow = await getCourse(supa, courseId);
        current = (courseNow?.course_master as CourseMaster | null) ?? current;
        results.push(await generateOneSession(supa, courseId, current, n, { output }));
      }
    } else {
      return NextResponse.json({ error: "session_no or pipeline required" }, { status: 400 });
    }

    const sessions = await listSessions(supa, courseId);
    const allReady = sessions.every((s) => s.status === "ready");
    await updateCourse(supa, courseId, { status: allReady ? "ready" : "generating" });

    return NextResponse.json({ results, sessions, output });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await updateCourse(supa, courseId, { status: "failed" }).catch(() => {});
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
