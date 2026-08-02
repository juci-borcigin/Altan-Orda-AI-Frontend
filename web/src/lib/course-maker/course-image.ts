import fs from "fs/promises";
import path from "path";
import { imageGenerationUsdPerImage, withImageLabelLangNote } from "./course-pricing";
import { IMAGE_LAB_SIZE_16_9 } from "./image-lab";

/** 講義ビジュアル設定（env で上書き可） */
export function resolveCourseImageModel(): string {
  return process.env.AO_COURSE_IMAGE_MODEL?.trim() || "gpt-image-2";
}

/** 既定は 16:9 近傍。旧 1536x1024 は AO_COURSE_IMAGE_SIZE で復帰可 */
export function resolveCourseImageSize(): string {
  return process.env.AO_COURSE_IMAGE_SIZE?.trim() || IMAGE_LAB_SIZE_16_9;
}

export function resolveCourseImageQuality(): "low" | "medium" | "high" {
  const q = (process.env.AO_COURSE_IMAGE_QUALITY ?? "low").trim().toLowerCase();
  if (q === "medium" || q === "high" || q === "low") return q;
  return "low";
}

export const COURSE_IMAGE_N = 1;

/** @deprecated 互換 — resolveCourseImageSize() を使う */
export const COURSE_IMAGE_SIZE = IMAGE_LAB_SIZE_16_9;

export type ImageGenerationResult = {
  artifact_url: string;
  model_id: string;
  provider: string;
  prompt: string;
  size: string;
  quality: string;
  latency_ms: number;
  cost_usd: number;
  revised_prompt?: string;
  b64_png?: string;
};

/** DB 肥大化を避け、public 配下に PNG を保存してパスを返す */
export async function persistCourseImageFile(opts: {
  courseId: string;
  slotId: string;
  b64_png: string;
}): Promise<string> {
  const dir = path.join(process.cwd(), "public", "courses", opts.courseId);
  await fs.mkdir(dir, { recursive: true });
  const safeSlot = opts.slotId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${safeSlot}.png`;
  await fs.writeFile(path.join(dir, fileName), Buffer.from(opts.b64_png, "base64"));
  return `/courses/${opts.courseId}/${fileName}`;
}

export async function generateCourseVisualImage(opts: {
  prompt: string;
  courseId: string;
  slotId: string;
  model?: string;
  quality?: "low" | "medium" | "high";
  size?: string;
  /** true なら漢字注記を付けない（ラボでスタイルブロック側に任せる場合） */
  skipLabelNote?: boolean;
  /** false なら data URL のまま（既定はファイル保存） */
  persistFile?: boolean;
}): Promise<ImageGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set for image generation");

  const model = opts.model ?? resolveCourseImageModel();
  const quality = opts.quality ?? resolveCourseImageQuality();
  const size = opts.size ?? resolveCourseImageSize();
  const prompt = opts.skipLabelNote ? opts.prompt.trim() : withImageLabelLangNote(opts.prompt);

  const started = Date.now();
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      quality,
      n: COURSE_IMAGE_N,
    }),
    signal: AbortSignal.timeout(300_000),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Image API ${res.status}: ${raw.slice(0, 400)}`);

  const json = JSON.parse(raw) as {
    data?: Array<{ b64_json?: string; revised_prompt?: string }>;
  };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image API returned no image data");

  const persist = opts.persistFile !== false;
  const artifact_url = persist
    ? await persistCourseImageFile({
        courseId: opts.courseId,
        slotId: opts.slotId,
        b64_png: b64,
      })
    : `data:image/png;base64,${b64}`;

  return {
    artifact_url,
    b64_png: b64,
    model_id: model,
    provider: "openai",
    prompt,
    size,
    quality,
    latency_ms: Date.now() - started,
    cost_usd: imageGenerationUsdPerImage(model, { size, quality }),
    revised_prompt: json.data?.[0]?.revised_prompt,
  };
}
