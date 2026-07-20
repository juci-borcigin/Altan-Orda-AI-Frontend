import fs from "fs/promises";
import path from "path";
import type {
  CourseMaster,
  CourseParams,
} from "./course-master-schema";

export const GPT56_LAB_COURSE_ID = "bfea8c94-40d9-4c39-8f68-627a4927a648";

export type Gpt56LabMetric = {
  model_id: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
  cost_usd: number | null;
};

export type Gpt56LabOutlineResult = {
  label: string;
  model_id: string;
  master: CourseMaster;
  raw: string | null;
  metric: Gpt56LabMetric;
  verification: unknown;
  section_counts: number[];
};

export type Gpt56LabPageResult = {
  section_no: number;
  heading: string;
  markdown: string;
  image_prompt: string | null;
  image_rationale: string | null;
};

export type Gpt56LabSessionResult = {
  session_no: number;
  title: string;
  model_id: string;
  pages: Gpt56LabPageResult[];
  metric: Gpt56LabMetric;
  fallback_used: boolean;
  body_chars: number;
  target_chars: number;
  length_pass: boolean;
};

export type Gpt56PromptEvaluation = {
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendation: string;
};

export type Gpt56LabTest2 = {
  current: Record<string, Gpt56LabSessionResult>;
  luna: Record<string, Gpt56LabSessionResult>;
  terra: Record<string, Gpt56LabSessionResult>;
  evaluation: Partial<
    Record<"current" | "luna" | "terra", Gpt56PromptEvaluation>
  >;
};

export type Gpt56LabManifest = {
  updated_at: string;
  course_id: string;
  course_title: string;
  params: CourseParams;
  logic: {
    section_count: string;
    intro: string;
    outro: string;
    section_chars: string;
    session_generation: string;
    models: string;
  };
  test1: {
    current: Gpt56LabOutlineResult;
    terra: Gpt56LabOutlineResult;
  } | null;
  test2: Gpt56LabTest2 | null;
};

function publicDir(): string {
  return path.join(process.cwd(), "public", "sample", "gpt-5-6-lab");
}

function manifestPath(): string {
  return path.join(publicDir(), "manifest.json");
}

export async function readGpt56LabManifest(): Promise<Gpt56LabManifest | null> {
  try {
    return JSON.parse(await fs.readFile(manifestPath(), "utf8")) as Gpt56LabManifest;
  } catch {
    return null;
  }
}

export async function writeGpt56LabManifest(manifest: Gpt56LabManifest): Promise<void> {
  await fs.mkdir(publicDir(), { recursive: true });
  await fs.writeFile(manifestPath(), JSON.stringify(manifest, null, 2), "utf8");
}
