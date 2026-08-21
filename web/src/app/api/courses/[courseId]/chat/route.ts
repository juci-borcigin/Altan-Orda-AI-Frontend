import { NextResponse } from "next/server";
import { getCourse, listSessions } from "@/lib/course-maker/course-db";
import {
  buildCourseChatSystemPrompt,
  COURSE_CHAT_MODEL,
  type CourseChatContext,
} from "@/lib/course-maker/course-chat";
import type { CourseMaster } from "@/lib/course-maker/course-master-schema";
import { applyCompletionBudgetToPayload, stripUnsupportedSamplingFromPayload } from "@/lib/llm/completion-payload";
import { completionHeaders } from "@/lib/llm/router";
import { resolveLlmRoute } from "@/lib/llm/resolve-route";
import { recordCourseTrace } from "@/lib/course-maker/course-trace";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: Promise<{ courseId: string }> };

type ChatTurn = { role: "user" | "assistant"; content: string };

/**
 * 講師チャット（第 n 回 = 1 スレッド）。
 * 料金・時間は phase=chat のみ。生成パイプライン合計には混ぜない想定。
 */
export async function POST(req: Request, ctx: Ctx) {
  const { courseId } = await ctx.params;
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  let body: {
    session_no?: number;
    section_no?: number;
    message?: string;
    history?: ChatTurn[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });
  const sessionNo = body.session_no ?? 1;
  const sectionNo = body.section_no ?? 1;

  try {
    const course = await getCourse(supa, courseId);
    if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const master = course.course_master as CourseMaster | null;
    if (!master) return NextResponse.json({ error: "course_master missing" }, { status: 400 });

    const sessionPlan = master.sessions.find((s) => s.session_no === sessionNo);
    if (!sessionPlan) {
      return NextResponse.json({ error: `session ${sessionNo} not in master` }, { status: 400 });
    }

    const sessions = await listSessions(supa, courseId);
    const sessionRow = sessions.find((s) => s.session_no === sessionNo);
    const markdown = (sessionRow?.markdown_body as string | null)?.trim() || "";

    const { data: visuals } = await supa
      .from("ao_course_visuals")
      .select("slot_id, session_no, prompt, image_model_id, status")
      .eq("course_id", courseId)
      .eq("session_no", sessionNo)
      .order("slot_id");

    const sectionVisuals = [...sessionPlan.sections]
      .sort((a, b) => a.section_no - b.section_no)
      .map((sec) => {
        const slotId = `vis_${sessionNo}_${sec.section_no}`;
        const row = (visuals ?? []).find(
          (v) => v.session_no === sessionNo && v.slot_id === slotId,
        );
        return {
          section_no: sec.section_no,
          heading: sec.heading,
          image_prompt: (row?.prompt as string | null) ?? null,
          image_model_id: (row?.image_model_id as string | null) ?? null,
        };
      });

    const chatCtx: CourseChatContext = {
      courseTitle: course.title || master.meta.theme,
      theme: master.meta.theme,
      tone: master.common?.tone ?? null,
      narrativeArc: master.common?.narrative_arc ?? null,
      sessionNo,
      sessionTitle: sessionPlan.title,
      sessionMarkdown: markdown,
      sectionVisuals,
    };

    const system = buildCourseChatSystemPrompt(chatCtx);
    const history = (body.history ?? [])
      .filter((t) => t && (t.role === "user" || t.role === "assistant") && t.content?.trim())
      .slice(-16);

    const route = resolveLlmRoute(COURSE_CHAT_MODEL);
    if (!route.apiKey) {
      return NextResponse.json({ error: "LLM API key is not set" }, { status: 503 });
    }

    const messages = [
      { role: "system" as const, content: system },
      ...history.map((t) => ({ role: t.role, content: t.content.trim() })),
      { role: "user" as const, content: message },
    ];

    const payload: Record<string, unknown> = {
      model: route.modelId,
      stream: false,
      messages,
    };
    applyCompletionBudgetToPayload(payload, route, 2048);
    stripUnsupportedSamplingFromPayload(payload, route);

    const started = Date.now();
    const res = await fetch(`${route.baseUrl}/chat/completions`, {
      method: "POST",
      headers: completionHeaders(route),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90_000),
    });
    const raw = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: `Chat LLM ${res.status}: ${raw.slice(0, 400)}` },
        { status: 502 },
      );
    }
    const json = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };
    const reply = json.choices?.[0]?.message?.content?.trim() || "（応答が空でした）";
    const latency_ms = Date.now() - started;
    const prompt_tokens = json.usage?.prompt_tokens ?? 0;
    const completion_tokens = json.usage?.completion_tokens ?? 0;

    await recordCourseTrace(supa, {
      course_id: courseId,
      phase: "chat",
      step_key: `chat_s${sessionNo}_sec${sectionNo}_${Date.now()}`,
      model_id: COURSE_CHAT_MODEL,
      provider: route.provider,
      system_prompt: system,
      user_prompt: message,
      response_text: reply,
      prompt_tokens,
      completion_tokens,
      latency_ms,
      meta: {
        session_no: sessionNo,
        section_no: sectionNo,
        history_turns: history.length,
        kind: "instructor_thread",
      },
    });

    return NextResponse.json({
      reply,
      model_id: COURSE_CHAT_MODEL,
      provider: route.provider,
      latency_ms,
      prompt_tokens,
      completion_tokens,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
