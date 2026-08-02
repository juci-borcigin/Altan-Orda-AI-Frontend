import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getCourse, listSessions } from "@/lib/course-maker/course-db";
import { generateCourseVisualImage } from "@/lib/course-maker/course-image";
import { rewriteSectionImagePrompt } from "@/lib/course-maker/course-llm";
import { getSectionMarkdown } from "@/lib/course-maker/course-admin-view";
import type { CourseMaster } from "@/lib/course-maker/course-master-schema";
import {
  applyStyleA,
  IMAGE_LAB_DEFAULT_COURSE_ID,
  IMAGE_LAB_SECTIONS,
  IMAGE_LAB_SESSION,
  IMAGE_LAB_SIZE_16_9,
  IMAGE_LAB_VARIANT_META,
  imageLabPublicDir,
  publicUrlForLabFile,
  readImageLabManifest,
  writeImageLabManifest,
  type ImageLabManifest,
  type ImageLabSlot,
} from "@/lib/course-maker/image-lab";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { guardLabApiMutation } from "@/lib/course-maker/lab-api-guard";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  const manifest = await readImageLabManifest();
  return NextResponse.json({
    manifest,
    compare_plan: {
      shared: "同一 course / 同一回。B 以降の共通原紙は style_b_prompt",
      phases: ["A style-only", "B Sonnet prompt rewrite", "C 4 models"],
      models_for_c: ["gpt-image-2 low", "gpt-image-2 mid", "nano_banana_2", "flux_2_pro"],
      dropped: ["imagen-4-fast"],
    },
  });
}

async function loadBaselineStats(courseId: string, supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>) {
  const { data: midTraces } = await supa
    .from("ao_course_trace_events")
    .select("step_key, cost_usd, latency_ms, meta, created_at")
    .eq("course_id", courseId)
    .eq("phase", "tier2_image")
    .eq("model_id", "gpt-image-2")
    .order("created_at", { ascending: false });

  const baselineStats = new Map<number, { cost: number; ms: number }>();
  for (const t of midTraces ?? []) {
    const meta = (t.meta ?? {}) as { quality?: string; section_no?: number };
    if (String(meta.quality ?? "").toLowerCase() !== "medium") continue;
    const m = String(t.step_key).match(/^s(\d+)_sec(\d+)/);
    const sessionNo = m ? Number(m[1]) : IMAGE_LAB_SESSION;
    const sectionNo = m ? Number(m[2]) : Number(meta.section_no);
    if (sessionNo !== IMAGE_LAB_SESSION || !Number.isFinite(sectionNo)) continue;
    if (baselineStats.has(sectionNo)) continue;
    baselineStats.set(sectionNo, {
      cost: Number(t.cost_usd ?? 0),
      ms: Number(t.latency_ms ?? 0),
    });
  }
  return baselineStats;
}

/**
 * POST { phase: "A" | "B" }
 * A: 既存 base_prompt + スタイル後付け → mid 画像
 * B: Sonnet で image_prompt を新ルール書き直し → mid 画像（漢字禁止なし）
 * いずれも講義 visuals は非破壊。
 */
export async function POST(req: Request) {
  const denied = guardLabApiMutation(req);
  if (denied) return denied;

  let body: { phase?: string; course_id?: string; sections?: number[]; image_only?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty */
  }
  const phase = (body.phase ?? "A").toUpperCase();
  if (phase !== "A" && phase !== "B") {
    return NextResponse.json({ error: "phase は A または B" }, { status: 400 });
  }
  const imageOnly = Boolean(body.image_only);

  const courseId = body.course_id?.trim() || IMAGE_LAB_DEFAULT_COURSE_ID;
  const sectionFilter =
    Array.isArray(body.sections) && body.sections.length > 0
      ? body.sections.map(Number).filter((n) => IMAGE_LAB_SECTIONS.includes(n as (typeof IMAGE_LAB_SECTIONS)[number]))
      : [...IMAGE_LAB_SECTIONS];
  if (sectionFilter.length === 0) {
    return NextResponse.json({ error: "sections が不正です" }, { status: 400 });
  }
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const course = await getCourse(supa, courseId);
    if (!course) return NextResponse.json({ error: "course not found" }, { status: 404 });
    const master = course.course_master as CourseMaster | null;
    if (!master) return NextResponse.json({ error: "course_master missing" }, { status: 400 });

    const session = master.sessions.find((s) => s.session_no === IMAGE_LAB_SESSION);
    if (!session) return NextResponse.json({ error: "session 1 missing" }, { status: 400 });

    const sessions = await listSessions(supa, courseId);
    const sessionRow = sessions.find((s) => s.session_no === IMAGE_LAB_SESSION);

    const { data: visuals, error: vErr } = await supa
      .from("ao_course_visuals")
      .select("slot_id, session_no, prompt, artifact_url, image_model_id, status")
      .eq("course_id", courseId)
      .eq("session_no", IMAGE_LAB_SESSION);
    if (vErr) throw new Error(vErr.message);

    const baselineStats = await loadBaselineStats(courseId, supa);
    await fs.mkdir(imageLabPublicDir(), { recursive: true });

    const existing = (await readImageLabManifest()) ?? null;
    const slots: ImageLabSlot[] = [];
    const results: Array<Record<string, unknown>> = [];

    let costPrompt = 0;
    let msPrompt = 0;
    let costImage = 0;
    let msImage = 0;

    for (const sectionNo of sectionFilter) {
      const sec = session.sections.find((s) => s.section_no === sectionNo);
      const slotId = `vis_${IMAGE_LAB_SESSION}_${sectionNo}`;
      const visual = (visuals ?? []).find((v) => v.slot_id === slotId);
      const basePrompt =
        (visual?.prompt as string | null)?.trim() ||
        existing?.slots.find((s) => s.section_no === sectionNo)?.base_prompt ||
        "";
      if (!basePrompt && phase === "A") {
        results.push({ section_no: sectionNo, ok: false, error: "base prompt missing" });
        continue;
      }

      const heading = sec?.heading ?? `セクション${sectionNo}`;
      const prev = existing?.slots.find((s) => s.section_no === sectionNo);
      const slot: ImageLabSlot = {
        session_no: IMAGE_LAB_SESSION,
        section_no: sectionNo,
        heading,
        base_prompt: basePrompt || prev?.base_prompt || "",
        style_a_prompt: prev?.style_a_prompt,
        style_b_prompt: prev?.style_b_prompt,
        style_b_prime_prompt: prev?.style_b_prime_prompt,
        style_b_prime_structured: prev?.style_b_prime_structured,
        files: { ...(prev?.files ?? {}) },
        costs: { ...(prev?.costs ?? {}) },
        latencies_ms: { ...(prev?.latencies_ms ?? {}) },
        prompt_rewrite_costs: { ...(prev?.prompt_rewrite_costs ?? {}) },
        prompt_rewrite_latencies_ms: { ...(prev?.prompt_rewrite_latencies_ms ?? {}) },
        prompt_rewrite_model: prev?.prompt_rewrite_model,
        prompt_rewrite_model_b_prime: prev?.prompt_rewrite_model_b_prime,
      };

      // baseline file/cost
      const baselineName = `s${IMAGE_LAB_SESSION}_sec${sectionNo}_baseline_mid.png`;
      const baselinePath = path.join(imageLabPublicDir(), baselineName);
      const artifact = visual?.artifact_url as string | null;
      if (artifact?.startsWith("data:image")) {
        const b64 = artifact.replace(/^data:image\/\w+;base64,/, "");
        await fs.writeFile(baselinePath, Buffer.from(b64, "base64"));
        slot.files.baseline_mid = publicUrlForLabFile(baselineName);
      } else if (prev?.files.baseline_mid) {
        slot.files.baseline_mid = prev.files.baseline_mid;
      }
      const baseStat = baselineStats.get(sectionNo);
      if (baseStat) {
        slot.costs.baseline_mid = baseStat.cost;
        slot.latencies_ms.baseline_mid = baseStat.ms;
      } else if (prev?.costs.baseline_mid != null) {
        slot.costs.baseline_mid = prev.costs.baseline_mid;
        slot.latencies_ms.baseline_mid = prev.latencies_ms.baseline_mid;
      }

      try {
        if (phase === "A") {
          const stylePrompt = applyStyleA(slot.base_prompt);
          slot.style_a_prompt = stylePrompt;
          const img = await generateCourseVisualImage({
            prompt: stylePrompt,
            courseId,
            slotId: `lab_a_${slotId}`,
            model: "gpt-image-2",
            quality: "medium",
            size: IMAGE_LAB_SIZE_16_9,
            skipLabelNote: true,
          });
          const fileName = `s${IMAGE_LAB_SESSION}_sec${sectionNo}_style_a.png`;
          await fs.writeFile(
            path.join(imageLabPublicDir(), fileName),
            Buffer.from(
              img.b64_png ?? img.artifact_url.replace(/^data:image\/\w+;base64,/, ""),
              "base64",
            ),
          );
          slot.files.style_a = publicUrlForLabFile(fileName);
          slot.costs.style_a = img.cost_usd;
          slot.latencies_ms.style_a = img.latency_ms;
          costImage += img.cost_usd;
          msImage += img.latency_ms;
          results.push({
            section_no: sectionNo,
            ok: true,
            image_cost: img.cost_usd,
            image_ms: img.latency_ms,
          });
        } else {
          // Phase B
          let promptText = slot.style_b_prompt?.trim() || "";
          if (!imageOnly || !promptText) {
            const sectionMd =
              getSectionMarkdown(sessionRow?.markdown_body ?? null, sectionNo) ??
              `## ${heading}\n`;
            const rewritten = await rewriteSectionImagePrompt({
              theme: master.meta.theme,
              session_no: IMAGE_LAB_SESSION,
              section_no: sectionNo,
              heading,
              section_markdown: sectionMd,
            });
            promptText = rewritten.image_prompt;
            slot.style_b_prompt = rewritten.image_prompt;
            slot.prompt_rewrite_costs = {
              ...(slot.prompt_rewrite_costs ?? {}),
              style_b: rewritten.cost_usd,
            };
            slot.prompt_rewrite_latencies_ms = {
              ...(slot.prompt_rewrite_latencies_ms ?? {}),
              style_b: rewritten.llm.latency_ms,
            };
            slot.prompt_rewrite_model = rewritten.model_id;
            costPrompt += rewritten.cost_usd;
            msPrompt += rewritten.llm.latency_ms;
          }

          const img = await generateCourseVisualImage({
            prompt: promptText,
            courseId,
            slotId: `lab_b_${slotId}`,
            model: "gpt-image-2",
            quality: "medium",
            size: IMAGE_LAB_SIZE_16_9,
            skipLabelNote: true,
          });
          const fileName = `s${IMAGE_LAB_SESSION}_sec${sectionNo}_style_b.png`;
          await fs.writeFile(
            path.join(imageLabPublicDir(), fileName),
            Buffer.from(
              img.b64_png ?? img.artifact_url.replace(/^data:image\/\w+;base64,/, ""),
              "base64",
            ),
          );
          slot.files.style_b = publicUrlForLabFile(fileName);
          slot.costs.style_b = img.cost_usd;
          slot.latencies_ms.style_b = img.latency_ms;
          costImage += img.cost_usd;
          msImage += img.latency_ms;
          results.push({
            section_no: sectionNo,
            ok: true,
            prompt_cost: slot.prompt_rewrite_costs?.style_b,
            prompt_ms: slot.prompt_rewrite_latencies_ms?.style_b,
            prompt_model: slot.prompt_rewrite_model,
            image_cost: img.cost_usd,
            image_ms: img.latency_ms,
            image_only: imageOnly && Boolean(prev?.style_b_prompt),
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ section_no: sectionNo, ok: false, error: msg });
      }

      slots.push(slot);
    }

    // B のとき既存 A スロットを落とさないよう、既存に無い番号だけ差し替え済み
    // A 実行時は B を温存
    const mergedBySec = new Map<number, ImageLabSlot>();
    for (const s of existing?.slots ?? []) mergedBySec.set(s.section_no, s);
    for (const s of slots) mergedBySec.set(s.section_no, s);
    const mergedSlots = [...IMAGE_LAB_SECTIONS]
      .map((n) => mergedBySec.get(n))
      .filter((s): s is ImageLabSlot => Boolean(s));

    const manifest: ImageLabManifest = {
      updated_at: new Date().toISOString(),
      course_id: courseId,
      session_no: IMAGE_LAB_SESSION,
      sections: [...IMAGE_LAB_SECTIONS],
      size: IMAGE_LAB_SIZE_16_9,
      aspect: "16:9",
      notes:
        phase === "A"
          ? "phase A: base_prompt + スタイル後付け。講義 visuals 非破壊。"
          : "phase B: Sonnet 新ルールで image_prompt 再執筆（漢字禁止なし）→ gpt-image-2 mid。講義 visuals 非破壊。",
      variants: IMAGE_LAB_VARIANT_META,
      slots: mergedSlots,
    };
    await writeImageLabManifest(manifest);

    return NextResponse.json({
      phase,
      results,
      totals: {
        prompt_cost_usd: Math.round(costPrompt * 1e6) / 1e6,
        prompt_latency_ms: msPrompt,
        image_cost_usd: Math.round(costImage * 1e6) / 1e6,
        image_latency_ms: msImage,
        cost_usd: Math.round((costPrompt + costImage) * 1e6) / 1e6,
        latency_ms: msPrompt + msImage,
      },
      manifest,
      view: "/lab/image-lab",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
