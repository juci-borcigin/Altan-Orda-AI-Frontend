import { NextResponse } from "next/server";
import { getCourse, listSessions } from "@/lib/course-maker/course-db";
import { getSectionMarkdown } from "@/lib/course-maker/course-admin-view";
import {
  generateCourseMaster,
  generateSessionContent,
  type LlmCallResult,
} from "@/lib/course-maker/course-llm";
import type {
  CourseMaster,
  CourseParams,
} from "@/lib/course-maker/course-master-schema";
import { estimateLlmCostUsd } from "@/lib/course-maker/course-pricing";
import {
  GPT56_LAB_COURSE_ID,
  readGpt56LabManifest,
  writeGpt56LabManifest,
  type Gpt56LabManifest,
  type Gpt56LabMetric,
  type Gpt56LabSessionResult,
  type Gpt56LabTest2,
} from "@/lib/course-maker/gpt-5-6-lab";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { guardLabApiMutation } from "@/lib/course-maker/lab-api-guard";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({ manifest: await readGpt56LabManifest() });
}

type Supa = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

async function metricFor(call: LlmCallResult): Promise<Gpt56LabMetric> {
  return {
    model_id: call.model_id,
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

async function loadCurrentSessionResults(
  supa: Supa,
  courseId: string,
  master: CourseMaster,
): Promise<Record<string, Gpt56LabSessionResult>> {
  const sessions = await listSessions(supa, courseId);
  const { data: visuals, error: visualError } = await supa
    .from("ao_course_visuals")
    .select("session_no,slot_id,prompt,error_message")
    .eq("course_id", courseId);
  if (visualError) throw new Error(visualError.message);
  const { data: traces, error: traceError } = await supa
    .from("ao_course_trace_events")
    .select(
      "step_key,model_id,prompt_tokens,completion_tokens,latency_ms,cost_usd,created_at",
    )
    .eq("course_id", courseId)
    .eq("phase", "tier2_section")
    .order("created_at", { ascending: false });
  if (traceError) throw new Error(traceError.message);

  const latestBySection = new Map<string, (typeof traces)[number]>();
  for (const trace of traces ?? []) {
    const match = String(trace.step_key).match(/^s(\d+)_sec(\d+)$/);
    if (!match) continue;
    const key = `${match[1]}:${match[2]}`;
    if (!latestBySection.has(key)) latestBySection.set(key, trace);
  }

  const results: Record<string, Gpt56LabSessionResult> = {};
  for (const session of master.sessions) {
    const row = sessions.find((item) => item.session_no === session.session_no);
    const metrics = session.sections
      .map((section) =>
        latestBySection.get(`${session.session_no}:${section.section_no}`),
      )
      .filter((trace): trace is NonNullable<typeof trace> => Boolean(trace));
    const modelId =
      String(metrics[0]?.model_id ?? row?.generation_meta?.model_id ?? "anthropic/claude-sonnet-4.6");
    const pages = session.sections.map((section) => {
      const visual = (visuals ?? []).find(
        (item) =>
          Number(item.session_no) === session.session_no &&
          item.slot_id === `vis_${session.session_no}_${section.section_no}`,
      );
      return {
        section_no: section.section_no,
        heading: section.heading,
        markdown:
          getSectionMarkdown(row?.markdown_body ?? null, section.section_no) ?? "",
        image_prompt:
          typeof visual?.prompt === "string" && visual.prompt.trim()
            ? visual.prompt.trim()
            : null,
        image_rationale:
          typeof visual?.error_message === "string" && visual.error_message.trim()
            ? visual.error_message.trim()
            : null,
      };
    });
    const bodyChars = pages.reduce(
      (sum, page) => sum + page.markdown.replace(/[#*_`\s]/g, "").length,
      0,
    );
    const targetChars = master.meta.target_chars_per_session;
    results[String(session.session_no)] = {
      session_no: session.session_no,
      title: session.title,
      model_id: modelId,
      pages,
      metric: {
        model_id: modelId,
        prompt_tokens: metrics.reduce(
          (sum, metric) => sum + Number(metric.prompt_tokens ?? 0),
          0,
        ),
        completion_tokens: metrics.reduce(
          (sum, metric) => sum + Number(metric.completion_tokens ?? 0),
          0,
        ),
        latency_ms: metrics.reduce(
          (sum, metric) => sum + Number(metric.latency_ms ?? 0),
          0,
        ),
        cost_usd:
          metrics.some((metric) => metric.cost_usd == null)
            ? null
            : Math.round(
                metrics.reduce(
                  (sum, metric) => sum + Number(metric.cost_usd ?? 0),
                  0,
                ) * 1e6,
              ) / 1e6,
      },
      fallback_used: false,
      body_chars: bodyChars,
      target_chars: targetChars,
      length_pass: bodyChars >= targetChars * 0.85 && bodyChars <= targetChars * 1.15,
    };
  }
  return results;
}

export async function POST(req: Request) {
  const denied = guardLabApiMutation(req);
  if (denied) return denied;

  let body: {
    test?: "course_design" | "session_generation" | "prompt_evaluation";
    course_id?: string;
    session_no?: number;
    model?: "luna" | "terra";
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // Validate below.
  }
  if (
    body.test !== "course_design" &&
    body.test !== "session_generation" &&
    body.test !== "prompt_evaluation"
  ) {
    return NextResponse.json(
      { error: "test は course_design / session_generation / prompt_evaluation" },
      { status: 400 },
    );
  }
  if (
    body.test === "session_generation" &&
    (!Number.isInteger(body.session_no) ||
      Number(body.session_no) < 1 ||
      Number(body.session_no) > 5 ||
      (body.model !== "luna" && body.model !== "terra"))
  ) {
    return NextResponse.json(
      { error: "session_generation には session_no=1..5 と model が必要です" },
      { status: 400 },
    );
  }

  const courseId = body.course_id?.trim() || GPT56_LAB_COURSE_ID;
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

    if (body.test === "prompt_evaluation") {
      const manifest = await readGpt56LabManifest();
      if (!manifest?.test2) {
        return NextResponse.json({ error: "テスト2の結果がありません" }, { status: 409 });
      }
      manifest.test2.evaluation = {
        current: {
          summary:
            "全30本が非空でラベル指示もあるが、16:9明示は21/30、照明・質感は19/30。旧来の線画・白背景・日本語禁止が中心で、現行のシネマ調教材方針とはずれる。",
          strengths: [
            "概念の左右比較や因果関係が明確",
            "30本すべて固有で、教材上の焦点は概ね読み取りやすい",
          ],
          concerns: [
            "日本語禁止と線画指定が現在の画像方針に反する",
            "16:9・照明・質感の指定が一部欠け、映像品質の再現性が低い",
          ],
          recommendation: "比較基準として残し、新規生成には採用しない。",
        },
        luna: {
          summary:
            "全40本で16:9・教材スタイル・短いラベルを明示。平均343字と簡潔で、前後比較や時間変化も伝わりやすい。照明・質感の明示は31/40。",
          strengths: [
            "短く整理され、画像モデルが主題を把握しやすい",
            "検出点・干渉縞・確率分布など本文との対応が明確",
            "日本語ラベルを自然に組み込んでいる",
          ],
          concerns: [
            "Intro・まとめで複数概念を詰め込み、焦点が散る例がある",
            "人物や旅人など装飾的な主役が科学概念より目立つ可能性がある",
          ],
          recommendation:
            "実用可能。Intro/Outroだけ『焦点は最大3概念』を追加すると安定する。",
        },
        terra: {
          summary:
            "全40本で16:9・教材スタイル・日本語ラベルを明示し、照明・質感も38/40。平均428字で、装置・素材・時間変化の記述がLunaより具体的。",
          strengths: [
            "二重スリット、検出器、干渉縞の因果関係が科学的に明瞭",
            "構図・光・材質・ラベルの指定が最も一貫している",
            "日本語ラベルが引用符付きで画像モデルに伝わりやすい",
          ],
          concerns: [
            "概念マップ型のまとめ画像は要素過多になりやすい",
            "雨粒などの比喩を同一画面に入れると科学図と混同される可能性がある",
          ],
          recommendation:
            "3候補中で画像プロンプト品質は最良。要素数上限と比喩の別枠化を加えて採用候補。",
        },
      };
      manifest.updated_at = new Date().toISOString();
      await writeGpt56LabManifest(manifest);
      return NextResponse.json({ manifest });
    }

    if (body.test === "session_generation") {
      const manifest = await readGpt56LabManifest();
      if (!manifest?.test1?.terra.master) {
        return NextResponse.json(
          { error: "先にテスト1のTerra講義設計を実行してください" },
          { status: 409 },
        );
      }
      const sessionNo = Number(body.session_no);
      const variant = body.model!;
      const modelId =
        variant === "luna"
          ? "openai/gpt-5.6-luna"
          : "openai/gpt-5.6-terra";
      const generated = await generateSessionContent({
        master: manifest.test1.terra.master,
        session_no: sessionNo,
        luna_model_id: modelId,
        terra_model_id: modelId,
        allow_fallback: false,
        enforce_length: false,
        max_tokens: 20_000,
      });
      const call = generated.llm_calls[0];
      if (!call || generated.llm_calls.length !== 1) {
        throw new Error(`${variant} session ${sessionNo}: expected exactly one call`);
      }
      const session = manifest.test1.terra.master.sessions.find(
        (item) => item.session_no === sessionNo,
      );
      if (!session) throw new Error(`session ${sessionNo} not found in test1 master`);
      const pages = generated.pages.map((page) => ({
        ...page,
        heading:
          session.sections.find(
            (section) => section.section_no === page.section_no,
          )?.heading ?? `セクション${page.section_no}`,
      }));
      const bodyChars = pages.reduce(
        (sum, page) => sum + page.markdown.replace(/[#*_`\s]/g, "").length,
        0,
      );
      const targetChars = manifest.test1.terra.master.meta.target_chars_per_session;
      const result: Gpt56LabSessionResult = {
        session_no: sessionNo,
        title: session.title,
        model_id: generated.model_id,
        pages,
        metric: await metricFor(call),
        fallback_used: generated.fallback_used,
        body_chars: bodyChars,
        target_chars: targetChars,
        length_pass:
          bodyChars >= targetChars * 0.85 && bodyChars <= targetChars * 1.15,
      };
      const test2: Gpt56LabTest2 = manifest.test2 ?? {
        current: await loadCurrentSessionResults(supa, courseId, currentMaster),
        luna: {},
        terra: {},
        evaluation: {},
      };
      test2[variant][String(sessionNo)] = result;
      manifest.test2 = test2;
      manifest.updated_at = new Date().toISOString();
      await writeGpt56LabManifest(manifest);
      return NextResponse.json({
        model: variant,
        session_no: sessionNo,
        result,
        manifest,
      });
    }

    const { data: traceRows, error: traceError } = await supa
      .from("ao_course_trace_events")
      .select(
        "model_id,prompt_tokens,completion_tokens,latency_ms,cost_usd,created_at",
      )
      .eq("course_id", courseId)
      .eq("phase", "tier1_outline")
      .order("created_at", { ascending: false })
      .limit(1);
    if (traceError) throw new Error(traceError.message);
    const baselineTrace = traceRows?.[0];

    const generated = await generateCourseMaster(params, undefined, {
      model_id: "openai/gpt-5.6-terra",
      max_tokens: 20_000,
      max_attempts: 1,
    });
    const call = generated.llm_calls[0];
    if (!call) throw new Error("Terra call metric missing");
    const terraMetric: Gpt56LabMetric = {
      model_id: call.model_id,
      prompt_tokens: call.prompt_tokens,
      completion_tokens: call.completion_tokens,
      latency_ms: call.latency_ms,
      cost_usd: await estimateLlmCostUsd(
        call.prompt_tokens,
        call.completion_tokens,
        call.model_id,
      ),
    };

    const manifest: Gpt56LabManifest = {
      updated_at: new Date().toISOString(),
      course_id: courseId,
      course_title: course.title,
      params,
      logic: {
        section_count: "各回3〜10。テーマ・回数・時間からAIが判断",
        intro: "先頭は固定タイトル「はじめに」。第1回は講義の位置づけ、以降は前回まとめ",
        outro: "末尾は固定タイトル「まとめ」。今回の要点と次回への接続",
        section_chars: "平均400字。通常300〜500字、回全体は時間×200字の±10%",
        session_generation: "1回分をLunaの1コールで生成し、構造・文字数不合格時のみTerra",
        models: "講義設計=Terra、本文=Luna→Terraフォールバック",
      },
      test1: {
        current: {
          label: "現行 · Haiku 4.5（6セクション固定）",
          model_id: String(baselineTrace?.model_id ?? "anthropic/claude-haiku-4.5"),
          master: currentMaster,
          raw: JSON.stringify(currentMaster, null, 2),
          metric: {
            model_id: String(baselineTrace?.model_id ?? "anthropic/claude-haiku-4.5"),
            prompt_tokens: Number(baselineTrace?.prompt_tokens ?? 0),
            completion_tokens: Number(baselineTrace?.completion_tokens ?? 0),
            latency_ms: Number(baselineTrace?.latency_ms ?? 0),
            cost_usd:
              baselineTrace?.cost_usd == null ? null : Number(baselineTrace.cost_usd),
          },
          verification: {
            status: "historical",
            note: "現行6セクション制約下で承認済みの保存CourseMaster",
          },
          section_counts: currentMaster.sessions.map((session) => session.sections.length),
        },
        terra: {
          label: "GPT-5.6 テスト1 · Terra（可変セクション）",
          model_id: generated.model_id,
          master: generated.master,
          raw: generated.raw ?? null,
          metric: terraMetric,
          verification: generated.verification,
          section_counts: generated.master.sessions.map(
            (session) => session.sections.length,
          ),
        },
      },
      test2: null,
    };
    await writeGpt56LabManifest(manifest);
    return NextResponse.json({ manifest });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
