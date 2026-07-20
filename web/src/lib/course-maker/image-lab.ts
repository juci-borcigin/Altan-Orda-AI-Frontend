import fs from "fs/promises";
import path from "path";
import { COURSE_IMAGE_STYLE_YOUTUBE_BG } from "./course-image-prompt-guide";

/** 量子力学入門比較ラボ用の既定講座 */
export const IMAGE_LAB_DEFAULT_COURSE_ID = "bfea8c94-40d9-4c39-8f68-627a4927a648";

/** 16:9 近傍（gpt-image-2 許容: 倍数16・比≦3） */
export const IMAGE_LAB_SIZE_16_9 = "2048x1152";

export const IMAGE_LAB_SESSION = 1;
export const IMAGE_LAB_SECTIONS = [1, 2, 3, 4, 5] as const;

export type ImageLabVariantId =
  | "baseline_mid"
  | "style_a"
  | "style_b"
  | "style_b_prime"
  | "nano_banana_2"
  | "gpt_image2_low"
  | "gpt_image2_mid"
  | "flux_2_pro";

export type ImageLabSlot = {
  session_no: number;
  section_no: number;
  heading: string;
  /** 旧プロンプト（講座DB由来） */
  base_prompt: string;
  /** A: base + スタイル後付け */
  style_a_prompt?: string;
  /** B: Sonnet 新ルールで書き直した共通原紙候補 */
  style_b_prompt?: string;
  /** B': Infographic 反省版のプロンプト（試行） */
  style_b_prime_prompt?: string;
  /** B': A/B/C 構造化 Markdown（人間可読） */
  style_b_prime_structured?: string;
  files: Partial<Record<ImageLabVariantId, string>>;
  costs: Partial<Record<ImageLabVariantId, number>>;
  latencies_ms: Partial<Record<ImageLabVariantId, number>>;
  /** B のプロンプト書き換え（Sonnet）だけの料金・時間 */
  prompt_rewrite_costs?: Partial<Record<"style_b" | "style_b_prime", number>>;
  prompt_rewrite_latencies_ms?: Partial<Record<"style_b" | "style_b_prime", number>>;
  prompt_rewrite_model?: string;
  prompt_rewrite_model_b_prime?: string;
};

export type ImageLabManifest = {
  updated_at: string;
  course_id: string;
  session_no: number;
  sections: number[];
  size: string;
  aspect: "16:9";
  notes: string;
  variants: Array<{
    id: ImageLabVariantId;
    label: string;
    model_id: string;
    quality: string | null;
    style: "none" | "youtube_bg";
  }>;
  slots: ImageLabSlot[];
};

export function imageLabPublicDir(): string {
  return path.join(process.cwd(), "public", "sample", "image-lab");
}

export function imageLabManifestPath(): string {
  return path.join(imageLabPublicDir(), "manifest.json");
}

export function publicUrlForLabFile(filename: string): string {
  return `/sample/image-lab/${filename}`;
}

export async function readImageLabManifest(): Promise<ImageLabManifest | null> {
  try {
    const raw = await fs.readFile(imageLabManifestPath(), "utf8");
    return JSON.parse(raw) as ImageLabManifest;
  } catch {
    return null;
  }
}

export async function writeImageLabManifest(manifest: ImageLabManifest): Promise<void> {
  await fs.mkdir(imageLabPublicDir(), { recursive: true });
  await fs.writeFile(imageLabManifestPath(), JSON.stringify(manifest, null, 2), "utf8");
}

export function applyStyleA(basePrompt: string): string {
  const cleaned = basePrompt
    .replace(/\bclean line-art style\b/gi, "subject matter")
    .replace(/\bline-art\b/gi, "visual")
    .trim();
  return `${cleaned}\n\n${COURSE_IMAGE_STYLE_YOUTUBE_BG}`;
}

export const IMAGE_LAB_VARIANT_META: ImageLabManifest["variants"] = [
  {
    id: "baseline_mid",
    label: "既存配置 · gpt-image-2 mid（講座の現行）",
    model_id: "gpt-image-2",
    quality: "medium",
    style: "none",
  },
  {
    id: "style_a",
    label: "A · 同一モデル mid + YouTube背景スタイル指示",
    model_id: "gpt-image-2",
    quality: "medium",
    style: "youtube_bg",
  },
  {
    id: "style_b",
    label: "B · Sonnet 新ルールで書き直したプロンプト + mid",
    model_id: "gpt-image-2",
    quality: "medium",
    style: "youtube_bg",
  },
  {
    id: "style_b_prime",
    label: "B' · Infographic 反省版プロンプト + mid（試行）",
    model_id: "gpt-image-2",
    quality: "medium",
    style: "none",
  },
  {
    id: "nano_banana_2",
    label: "C · Nano Banana 2（OpenRouter / Gemini 3.1 Flash Image）",
    model_id: "google/gemini-3.1-flash-image-preview",
    quality: null,
    style: "none",
  },
];
