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
import type { CourseMaster } from "@/lib/course-maker/course-master-schema";
import { recordCourseTrace } from "@/lib/course-maker/course-trace";
import { verifySessionBody } from "@/lib/course-maker/verify-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: Promise<{ courseId: string }> };
type Supa = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

function slotIdFor(sessionNo: number, sectionNo: number) {
  return `vis_${sessionNo}_${sectionNo}`;
}

/** 画像は生成せず、プロンプトだけ visuals に保存（管理者検証用） */
async function upsertImagePromptDraft(
  supa: Supa,
  courseId: string,
  sessionNo: number,
  sectionNo: number,
  prompt: string | null,
  rationale: string | null,
) {
  const slotId = slotIdFor(sessionNo, sectionNo);
  if (!prompt) {
    await supa.from("ao_course_visuals").upsert(
      {
        course_id: courseId,
        session_no: sessionNo,
        slot_id: slotId,
        visual_type: "diagram",
        status: "skipped",
        prompt: null,
        artifact_url: null,
        image_model_id: null,
        image_model_tier: "mini",
        error_message: rationale ?? "図解不要と判定",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "course_id,session_no,slot_id" },
    );
    return;
  }

  await supa.from("ao_course_visuals").upsert(
    {
      course_id: courseId,
      session_no: sessionNo,
      slot_id: slotId,
      visual_type: "diagram",
      status: "pending",
      prompt,
      artifact_url: null,
      image_model_id: null,
      image_model_tier: "mini",
      error_message: rationale,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "course_id,session_no,slot_id" },
  );

  await recordCourseTrace(supa, {
    course_id: courseId,
    phase: "ui_display",
    step_key: `image_prompt_draft_s${sessionNo}_sec${sectionNo}`,
    user_prompt: prompt,
    response_text: rationale ?? undefined,
    meta: { session_no: sessionNo, section_no: sectionNo, kind: "image_prompt_draft" },
  });
}

async function generateSectionImageFromStoredPrompt(
  supa: Supa,
  courseId: string,
  sessionNo: number,
  sectionNo: number,
  promptOverride?: string,
) {
  const slotId = slotIdFor(sessionNo, sectionNo);
  let prompt = promptOverride?.trim() ?? "";
  if (!prompt) {
    const { data } = await supa
      .from("ao_course_visuals")
      .select("prompt")
      .eq("course_id", courseId)
      .eq("session_no", sessionNo)
      .eq("slot_id", slotId)
      .maybeSingle();
    prompt = (data?.prompt as string | null)?.trim() ?? "";
  }
  if (!prompt) throw new Error("画像プロンプトがありません。先に文章＋画像プロンプトを生成してください。");

  const img = await generateCourseVisualImage({ prompt, courseId, slotId });
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
      image_model_tier: img.model_id.includes("mini") ? "mini" : "medium",
      error_message: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "course_id,session_no,slot_id" },
  );
  await recordCourseTrace(supa, {
    course_id: courseId,
    phase: "tier2_image",
    step_key: `s${sessionNo}_sec${sectionNo}_${slotId}`,
    model_id: img.model_id,
    provider: img.provider,
    user_prompt: prompt,
    response_text: img.revised_prompt ?? "(image)",
    latency_ms: img.latency_ms,
    cost_usd: img.cost_usd,
    meta: {
      session_no: sessionNo,
      section_no: sectionNo,
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
  const image_prompts: Array<{
    section_no: number;
    image_prompt: string | null;
    image_rationale: string | null;
  }> = [];
  const trace = { course_id: courseId, supa };

  // text / both: 本文＋画像プロンプト（画像バイトは作らない）
  if (opts.output === "text" || opts.output === "both") {
    if (opts.section_no == null) {
      const result = await generateSessionContent({
        master,
        session_no: sessionNo,
        trace,
      });
      model_id = result.model_id;
      fallback_used = result.fallback_used;
      llm_call_count = result.llm_calls.length;
      for (const page of result.pages) {
        parts.push(page.markdown.trim());
        image_prompts.push({
          section_no: page.section_no,
          image_prompt: page.image_prompt,
          image_rationale: page.image_rationale,
        });
        await upsertImagePromptDraft(
          supa,
          courseId,
          sessionNo,
          page.section_no,
          page.image_prompt,
          page.image_rationale,
        );
      }
    } else {
      const sec = sections[0]!;
      const result = await generateSessionSection({
        master,
        session_no: sessionNo,
        section_no: sec.section_no,
        trace,
      });
      model_id = result.model_id;
      llm_call_count = result.llm ? 1 : 0;
      parts.push(result.markdown.trim());
      image_prompts.push({
        section_no: sec.section_no,
        image_prompt: result.image_prompt,
        image_rationale: result.image_rationale,
      });
      await upsertImagePromptDraft(
        supa,
        courseId,
        sessionNo,
        sec.section_no,
        result.image_prompt,
        result.image_rationale,
      );
    }
  }

  // image / both: 保存済み（または直前に作った）プロンプトで画像生成
  if (opts.output === "image" || opts.output === "both") {
    for (const sec of sections) {
      const drafted = image_prompts.find((p) => p.section_no === sec.section_no);
      await generateSectionImageFromStoredPrompt(
        supa,
        courseId,
        sessionNo,
        sec.section_no,
        drafted?.image_prompt ?? undefined,
      );
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
  const valid_source_ids = new Set(master.sources.items.map((s) => s.source_id));
  if (valid_source_ids.size === 0) valid_source_ids.add("mock_chunk_1");

  const verification =
    markdown_body != null
      ? verifySessionBody({
          markdown: markdown_body,
          session,
          target_chars: master.meta.target_chars_per_session,
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
      image_prompts,
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
      meta: { word_count, output: opts.output, image_prompts },
    });
  }

  return {
    session_no: sessionNo,
    verification,
    model_id,
    markdown_body,
    output: opts.output,
    image_prompts,
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

  // デフォルトは画像バイトまで一気に作らず、プロンプト検証を先に行う
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
      for (let n = 1; n <= master.meta.session_count; n++) {
        results.push(await generateOneSession(supa, courseId, master, n, { output }));
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
