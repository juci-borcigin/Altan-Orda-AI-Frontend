import { NextResponse } from "next/server";
import { guardSampleApiMutation } from "@/lib/course-maker/sample-api-guard";
import {
  estimateFoundationRun,
  readFoundationManifest,
  runFoundationPipelineStub,
  writeFoundationManifest,
} from "@/lib/course-maker/course-foundation";
import {
  emptyFoundationManifest,
  type FoundationStep,
} from "@/lib/course-maker/course-foundation-schema";

export const runtime = "nodejs";
export const maxDuration = 60;

function parseStep(v: unknown): FoundationStep | null {
  const n = Number(v);
  if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n;
  return null;
}

export async function GET() {
  const manifest =
    (await readFoundationManifest()) ??
    emptyFoundationManifest({
      notes: "未実行。POST action=estimate で見積もりを保存できる。",
    });
  return NextResponse.json({ manifest });
}

/**
 * action:
 * - estimate — 課金なし見積もりを manifest に保存
 * - reset — manifest 初期化
 * - execute — 現状はスタブ（LLM 未接続）。将来の課金実行入口
 */
export async function POST(req: Request) {
  let body: {
    action?: "estimate" | "reset" | "execute";
    through_step?: number;
    theme?: string;
    course_id?: string;
    session_count?: number;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty */
  }

  const action = body.action ?? "estimate";
  if (action === "reset") {
    const denied = guardSampleApiMutation(req, { allowWhenDisabled: true });
    if (denied) return denied;
    const manifest = emptyFoundationManifest();
    await writeFoundationManifest(manifest);
    return NextResponse.json({ manifest });
  }

  const through = parseStep(body.through_step) ?? 3;
  const theme = body.theme?.trim() || "量子力学入門";
  const sessionCount = body.session_count ?? 5;

  if (action === "estimate") {
    const denied = guardSampleApiMutation(req, { allowWhenDisabled: true });
    if (denied) return denied;
    const estimate = estimateFoundationRun({
      through_step: through,
      session_count: sessionCount,
    });
    const manifest = emptyFoundationManifest({
      theme,
      course_id: body.course_id ?? null,
      through_step: through,
      status: "estimated",
      estimate,
    });
    await writeFoundationManifest(manifest);
    return NextResponse.json({ manifest });
  }

  if (action === "execute") {
    const denied = guardSampleApiMutation(req);
    if (denied) return denied;
    const manifest = await runFoundationPipelineStub({
      through_step: through,
      theme,
      course_id: body.course_id,
      session_count: sessionCount,
      execute: true,
    });
    return NextResponse.json({ manifest }, { status: 501 });
  }

  return NextResponse.json(
    { error: "action は estimate / reset / execute" },
    { status: 400 },
  );
}
