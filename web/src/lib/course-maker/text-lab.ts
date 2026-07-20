import fs from "fs/promises";
import path from "path";
import type {
  CourseMaster,
  CourseParams,
} from "./course-master-schema";

export const TEXT_LAB_DEFAULT_COURSE_ID = "bfea8c94-40d9-4c39-8f68-627a4927a648";

export const TEXT_LAB_MODELS = [
  {
    id: "anthropic/claude-sonnet-4.6",
    label: "現行 · Claude Sonnet 4.6",
    config: "temperature 0.3",
  },
  {
    id: "openai/gpt-5.6-luna",
    label: "GPT-5.6 Luna",
    config: "reasoning none",
  },
  {
    id: "openai/gpt-5.6-terra",
    label: "GPT-5.6 Terra",
    config: "reasoning none",
  },
] as const;

export type TextLabModelId = (typeof TEXT_LAB_MODELS)[number]["id"];

export type TextLabCallMetric = {
  model_id: string;
  provider: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
  cost_usd: number | null;
};

export type TextLabSectionResult = {
  section_no: number;
  heading: string;
  markdown: string;
  image_prompt: string | null;
  image_rationale: string | null;
  metric: TextLabCallMetric;
};

export type TextLabOutlineResult = {
  raw: string | null;
  master: CourseMaster;
  attempts: number;
  verification_status: string;
  verification: unknown;
  metrics: TextLabCallMetric[];
  total_cost_usd: number | null;
  total_latency_ms: number;
};

export type TextLabManifest = {
  updated_at: string;
  course_id: string;
  course_title: string;
  params: CourseParams;
  models: Array<{ id: TextLabModelId; label: string; config: string }>;
  sections: Partial<Record<"1" | "2", Partial<Record<TextLabModelId, TextLabSectionResult>>>>;
  outlines: Partial<Record<TextLabModelId, TextLabOutlineResult>>;
  notes: string;
};

export function textLabPublicDir(): string {
  return path.join(process.cwd(), "public", "sample", "text-lab");
}

export function textLabManifestPath(): string {
  return path.join(textLabPublicDir(), "manifest.json");
}

export async function readTextLabManifest(): Promise<TextLabManifest | null> {
  try {
    return JSON.parse(await fs.readFile(textLabManifestPath(), "utf8")) as TextLabManifest;
  } catch {
    return null;
  }
}

export async function writeTextLabManifest(manifest: TextLabManifest): Promise<void> {
  await fs.mkdir(textLabPublicDir(), { recursive: true });
  await fs.writeFile(textLabManifestPath(), JSON.stringify(manifest, null, 2), "utf8");
}
