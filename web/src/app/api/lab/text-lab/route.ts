import { NextResponse } from "next/server";
import { getCourse } from "@/lib/course-maker/course-db";
import {
  generateCourseMaster,
  generateSessionSection,
  type LlmCallResult,
} from "@/lib/course-maker/course-llm";
import type {
  CourseMaster,
  CourseParams,
} from "@/lib/course-maker/course-master-schema";
import { estimateLlmCostUsd } from "@/lib/course-maker/course-pricing";
import {
  readTextLabManifest,
  TEXT_LAB_DEFAULT_COURSE_ID,
  TEXT_LAB_MODELS,
  writeTextLabManifest,
  type TextLabCallMetric,
  type TextLabManifest,
  type TextLabModelId,
} from "@/lib/course-maker/text-lab";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { guardLabApiMutation } from "@/lib/course-maker/lab-api-guard";

export const runtime = "nodejs";
export const maxDuration = 300;

async function metricFor(call: LlmCallResult): Promise<TextLabCallMetric> {
  return {
    model_id: call.model_id,
    provider: call.provider,
    prompt_tokens: call.prompt_tokens,
    completion_tokens: call.completion_tokens,
    latency_ms: call.latency_ms,
    cost_usd: await estimateLlmCostUsd(
      call.prompt_tokens,
      call.completion_tokens,
      call.model_id,
    ),
  };
}

function totalKnownCost(metrics: TextLabCallMetric[]): number | null {
  if (metrics.some((m) => m.cost_usd == null)) return null;
  return Math.round(metrics.reduce((sum, m) => sum + (m.cost_usd ?? 0), 0) * 1e6) / 1e6;
}

function baseManifest(opts: {
  existing: TextLabManifest | null;
  courseId: string;
  courseTitle: string;
  params: CourseParams;
}): TextLabManifest {
  return {
    updated_at: new Date().toISOString(),
    course_id: opts.courseId,
    course_title: opts.courseTitle,
    params: opts.params,
    models: TEXT_LAB_MODELS.map((m) => ({ ...m })),
    sections: opts.existing?.sections ?? {},
    outlines: opts.existing?.outlines ?? {},
    notes:
      "同一の現行CourseMaster/ユーザー設定を使用。Sonnetはtemperature 0.3、GPT-5.6はreasoning none。画像生成は行わずimage_promptまで比較。",
  };
}

export async function GET() {
  return NextResponse.json({ manifest: await readTextLabManifest() });
}

export async function POST(req: Request) {
  const denied = guardLabApiMutation(req);
  if (denied) return denied;

  let body: {
    test?: "section" | "outline";
    section_no?: number;
    course_id?: string;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // Keep defaults below.
  }

  const test = body.test;
  if (test !== "section" && test !== "outline") {
    return NextResponse.json({ error: "test は section または outline" }, { status: 400 });
  }
  const sectionNo = Number(body.section_no);
  if (test === "section" && sectionNo !== 1 && sectionNo !== 2) {
    return NextResponse.json({ error: "section_no は 1 または 2" }, { status: 400 });
  }

  const courseId = body.course_id?.trim() || TEXT_LAB_DEFAULT_COURSE_ID;
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const course = await getCourse(supa, courseId);
    if (!course) return NextResponse.json({ error: "course not found" }, { status: 404 });
    const params = course.params as CourseParams;
    const currentMaster = course.course_master as CourseMaster | null;
    if (!currentMaster) {
      return NextResponse.json({ error: "course_master missing" }, { status: 400 });
    }

    const manifest = baseManifest({
      existing: await readTextLabManifest(),
      courseId,
      courseTitle: course.title,
      params,
    });

    for (const model of TEXT_LAB_MODELS) {
      const modelId = model.id as TextLabModelId;
      if (test === "section") {
        const generated = await generateSessionSection({
          master: currentMaster,
          session_no: 1,
          section_no: sectionNo,
          model_id: modelId,
        });
        if (!generated.llm) throw new Error(`${modelId}: llm metric missing`);
        const section = currentMaster.sessions
          .find((s) => s.session_no === 1)
          ?.sections.find((s) => s.section_no === sectionNo);
        const key = String(sectionNo) as "1" | "2";
        manifest.sections[key] ??= {};
        manifest.sections[key]![modelId] = {
          section_no: sectionNo,
          heading: section?.heading ?? `セクション${sectionNo}`,
          markdown: generated.markdown,
          image_prompt: generated.image_prompt,
          image_rationale: generated.image_rationale,
          metric: await metricFor(generated.llm),
        };
      } else {
        const generated = await generateCourseMaster(params, undefined, {
          model_id: modelId,
          max_tokens: 20_000,
        });
        const metrics = await Promise.all(generated.llm_calls.map(metricFor));
        manifest.outlines[modelId] = {
          raw: generated.raw ?? null,
          master: generated.master,
          attempts: generated.attempts,
          verification_status: generated.verification.status,
          verification: generated.verification,
          metrics,
          total_cost_usd: totalKnownCost(metrics),
          total_latency_ms: metrics.reduce((sum, m) => sum + m.latency_ms, 0),
        };
      }
      manifest.updated_at = new Date().toISOString();
      await writeTextLabManifest(manifest);
    }

    return NextResponse.json({ test, section_no: test === "section" ? sectionNo : null, manifest });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
