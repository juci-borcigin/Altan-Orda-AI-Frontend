import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { generateCourseVisualImage } from "@/lib/course-maker/course-image";
import { IMAGE_LAB_SIZE_16_9, imageLabPublicDir } from "@/lib/course-maker/image-lab";
import { readGpt56LabManifest } from "@/lib/course-maker/gpt-5-6-lab";
import {
  cellKey,
  publicUrlForSession1File,
  readSession1VisualManifest,
  session1VisualPublicDir,
  writeSession1VisualManifest,
  type Session1Quality,
  type Session1VisualCell,
  type Session1VisualManifest,
  type Session1VisualSection,
} from "@/lib/course-maker/session1-visual-lab";
import { guardSampleApiMutation } from "@/lib/course-maker/sample-api-guard";

export const runtime = "nodejs";
export const maxDuration = 600;

function emptyTotals() {
  return { generated_count: 0, cost_usd: 0, latency_ms: 0 };
}

async function ensureSeededManifest(): Promise<Session1VisualManifest> {
  const existing = await readSession1VisualManifest();
  const gpt = await readGpt56LabManifest();
  if (!gpt?.test2?.luna?.["1"] || !gpt.test2.terra?.["1"]) {
    throw new Error("先に GPT-5.6 テスト2（第1回本文）を完了してください");
  }

  const luna = gpt.test2.luna["1"]!;
  const terra = gpt.test2.terra["1"]!;
  const sonnet = gpt.test2.current?.["1"];

  const sectionCount = Math.max(luna.pages.length, terra.pages.length);
  const sections: Session1VisualSection[] = [];

  for (let i = 1; i <= sectionCount; i++) {
    const lunaPage = luna.pages.find((p) => p.section_no === i);
    const terraPage = terra.pages.find((p) => p.section_no === i);
    const heading =
      lunaPage?.heading ?? terraPage?.heading ?? `セクション${i}`;
    const prev = existing?.sections.find((s) => s.section_no === i);
    const cells = { ...(prev?.cells ?? {}) };

    if (lunaPage) {
      for (const quality of ["low", "medium"] as const) {
        const key = cellKey("luna", quality);
        cells[key] = {
          image_url: cells[key]?.image_url ?? null,
          prompt: lunaPage.image_prompt,
          markdown: lunaPage.markdown,
          heading: lunaPage.heading,
          cost_usd: cells[key]?.cost_usd ?? null,
          latency_ms: cells[key]?.latency_ms ?? null,
          quality,
          model_id: "gpt-image-2",
          source: cells[key]?.image_url ? (cells[key]?.source ?? "generated") : "generated",
        };
      }
    }

    if (terraPage) {
      for (const quality of ["low", "medium"] as const) {
        const key = cellKey("terra", quality);
        cells[key] = {
          image_url: cells[key]?.image_url ?? null,
          prompt: terraPage.image_prompt,
          markdown: terraPage.markdown,
          heading: terraPage.heading,
          cost_usd: cells[key]?.cost_usd ?? null,
          latency_ms: cells[key]?.latency_ms ?? null,
          quality,
          model_id: "gpt-image-2",
          source: cells[key]?.image_url ? (cells[key]?.source ?? "generated") : "generated",
        };
      }
    }

    // Sonnet: reuse historical mid images for secs 1-5 (old 6-section structure)
    if (sonnet && i <= 6) {
      const sonnetPage = sonnet.pages.find((p) => p.section_no === i);
      if (sonnetPage) {
        const baselineName = `s1_sec${i}_baseline_mid.png`;
        const src = path.join(imageLabPublicDir(), baselineName);
        const destName = `sonnet_s1_sec${i}_mid.png`;
        const dest = path.join(session1VisualPublicDir(), destName);
        let imageUrl = cells.sonnet_mid?.image_url ?? null;
        try {
          await fs.mkdir(session1VisualPublicDir(), { recursive: true });
          await fs.copyFile(src, dest);
          imageUrl = publicUrlForSession1File(destName);
        } catch {
          // Keep previous URL if copy fails.
        }
        const perSectionCost =
          sonnet.metric.cost_usd != null && sonnet.pages.length > 0
            ? Math.round((sonnet.metric.cost_usd / sonnet.pages.length) * 1e6) / 1e6
            : null;
        const perSectionMs =
          sonnet.pages.length > 0
            ? Math.round(sonnet.metric.latency_ms / sonnet.pages.length)
            : null;
        cells.sonnet_mid = {
          image_url: imageUrl,
          prompt: sonnetPage.image_prompt,
          markdown: sonnetPage.markdown,
          heading: sonnetPage.heading,
          cost_usd: cells.sonnet_mid?.cost_usd ?? perSectionCost,
          latency_ms: cells.sonnet_mid?.latency_ms ?? perSectionMs,
          quality: "historical_mid",
          model_id: "gpt-image-2",
          source: "reused",
        };
      }
    }

    sections.push({ section_no: i, heading, cells });
  }

  const totals = existing?.totals ?? emptyTotals();
  const manifest: Session1VisualManifest = {
    updated_at: new Date().toISOString(),
    course_id: gpt.course_id,
    session_no: 1,
    size: IMAGE_LAB_SIZE_16_9,
    notes:
      "第1回全文。Luna/Terraはテスト2のプロンプトを使用。Sonnetは再生成せず既存mid画像を比較用に併記。講師チャットなし。",
    totals,
    sections,
  };
  await writeSession1VisualManifest(manifest);
  return manifest;
}

export async function GET() {
  try {
    const manifest = (await readSession1VisualManifest()) ?? (await ensureSeededManifest());
    return NextResponse.json({ manifest });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const denied = guardSampleApiMutation(req);
  if (denied) return denied;

  let body: {
    action?: "seed" | "generate";
    llm?: "luna" | "terra";
    section_no?: number;
    quality?: Session1Quality;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // Validate below.
  }

  try {
    if (body.action === "seed" || !body.action) {
      if (body.action === "seed" || body.llm == null) {
        const manifest = await ensureSeededManifest();
        return NextResponse.json({ manifest });
      }
    }

    if (body.action !== "generate") {
      return NextResponse.json({ error: "action は seed または generate" }, { status: 400 });
    }
    if (body.llm !== "luna" && body.llm !== "terra") {
      return NextResponse.json({ error: "llm は luna または terra" }, { status: 400 });
    }
    if (body.quality !== "low" && body.quality !== "medium") {
      return NextResponse.json({ error: "quality は low または medium" }, { status: 400 });
    }
    const sectionNo = Number(body.section_no);
    if (!Number.isInteger(sectionNo) || sectionNo < 1 || sectionNo > 10) {
      return NextResponse.json({ error: "section_no が不正です" }, { status: 400 });
    }

    let manifest = (await readSession1VisualManifest()) ?? (await ensureSeededManifest());
    const section = manifest.sections.find((s) => s.section_no === sectionNo);
    if (!section) {
      return NextResponse.json({ error: `section ${sectionNo} がありません` }, { status: 404 });
    }
    const key = cellKey(body.llm, body.quality);
    const cell = section.cells[key];
    if (!cell?.prompt?.trim()) {
      return NextResponse.json({ error: "画像プロンプトがありません" }, { status: 400 });
    }

    const img = await generateCourseVisualImage({
      prompt: cell.prompt,
      courseId: manifest.course_id,
      slotId: `s1vis_${body.llm}_${sectionNo}_${body.quality}`,
      model: "gpt-image-2",
      quality: body.quality,
      size: IMAGE_LAB_SIZE_16_9,
      skipLabelNote: false,
    });

    const fileName = `${body.llm}_s1_sec${sectionNo}_${body.quality === "low" ? "low" : "mid"}.png`;
    await fs.mkdir(session1VisualPublicDir(), { recursive: true });
    await fs.writeFile(
      path.join(session1VisualPublicDir(), fileName),
      Buffer.from(
        img.b64_png ?? img.artifact_url.replace(/^data:image\/\w+;base64,/, ""),
        "base64",
      ),
    );

    const nextCell: Session1VisualCell = {
      ...cell,
      image_url: publicUrlForSession1File(fileName),
      cost_usd: img.cost_usd,
      latency_ms: img.latency_ms,
      quality: body.quality,
      model_id: img.model_id,
      source: "generated",
    };
    section.cells[key] = nextCell;

    const wasMissing = !cell.image_url;
    if (wasMissing) {
      manifest.totals.generated_count += 1;
      manifest.totals.cost_usd =
        Math.round((manifest.totals.cost_usd + img.cost_usd) * 1e6) / 1e6;
      manifest.totals.latency_ms += img.latency_ms;
    } else {
      // Regeneration: approximate totals by replacing previous cost if known
      const prevCost = cell.cost_usd ?? 0;
      const prevMs = cell.latency_ms ?? 0;
      manifest.totals.cost_usd =
        Math.round((manifest.totals.cost_usd - prevCost + img.cost_usd) * 1e6) / 1e6;
      manifest.totals.latency_ms =
        manifest.totals.latency_ms - prevMs + img.latency_ms;
    }
    manifest.updated_at = new Date().toISOString();
    await writeSession1VisualManifest(manifest);

    return NextResponse.json({
      llm: body.llm,
      section_no: sectionNo,
      quality: body.quality,
      cell: nextCell,
      manifest,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
