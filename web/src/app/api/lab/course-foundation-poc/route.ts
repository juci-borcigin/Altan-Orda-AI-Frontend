import { NextResponse } from "next/server";
import { guardLabApiMutation } from "@/lib/course-maker/lab-api-guard";
import {
  estimateFoundationRun,
  readFoundationManifest,
  runFoundationPipeline,
  writeFoundationManifest,
} from "@/lib/course-maker/course-foundation";
import {
  emptyFoundationManifest,
  type FoundationStep,
} from "@/lib/course-maker/course-foundation-schema";
import { GPT56_LAB_COURSE_ID } from "@/lib/course-maker/gpt-5-6-lab";

export const runtime = "nodejs";
export const maxDuration = 300;

function parseStep(v: unknown): FoundationStep | null {
  const n = Number(v);
  if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n;
  return null;
}

export async function GET() {
  const manifest =
    (await readFoundationManifest()) ??
    emptyFoundationManifest({
      notes: "未実行。POST action=estimate または execute（≤3）。",
    });
  return NextResponse.json({ manifest });
}

/**
 * action:
 * - estimate — 課金なし見積もり
 * - reset — manifest 初期化
 * - execute — through_step≤3 の課金実行
 */
export async function POST(req: Request) {
  let body: {
    action?: "estimate" | "reset" | "execute";
    through_step?: number;
    theme?: string;
    course_id?: string;
    session_count?: number;
    session_duration_min?: number;
    only_sessions?: number[];
    regenerate_outline?: boolean;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty */
  }

  const action = body.action ?? "estimate";
  if (action === "reset") {
    const denied = guardLabApiMutation(req, { allowWhenDisabled: true });
    if (denied) return denied;
    const manifest = emptyFoundationManifest();
    await writeFoundationManifest(manifest);
    return NextResponse.json({ manifest });
  }

  const through = parseStep(body.through_step) ?? 3;
  const theme = body.theme?.trim() || "量子力学入門";
  const sessionCount = body.session_count ?? 5;
  const courseId = body.course_id?.trim() || GPT56_LAB_COURSE_ID;

  if (action === "estimate") {
    const denied = guardLabApiMutation(req, { allowWhenDisabled: true });
    if (denied) return denied;
    const estimate = estimateFoundationRun({
      through_step: through,
      session_count: sessionCount,
    });
    const manifest = emptyFoundationManifest({
      theme,
      course_id: courseId,
      through_step: through,
      status: "estimated",
      estimate,
    });
    await writeFoundationManifest(manifest);
    return NextResponse.json({ manifest });
  }

  if (action === "execute") {
    const denied = guardLabApiMutation(req);
    if (denied) return denied;
    try {
      const manifest = await runFoundationPipeline({
        through_step: through,
        theme,
        course_id: courseId,
        session_count: sessionCount,
        session_duration_min: body.session_duration_min ?? 30,
        only_sessions: body.only_sessions,
        regenerate_outline: body.regenerate_outline,
        execute: true,
      });
      const status = manifest.status === "error" ? 500 : 200;
      return NextResponse.json({ manifest }, { status });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const manifest = await readFoundationManifest();
      return NextResponse.json(
        { error: message, manifest },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { error: "action は estimate / reset / execute" },
    { status: 400 },
  );
}
