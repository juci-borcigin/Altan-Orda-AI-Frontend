import fs from "fs/promises";
import path from "path";

export const SESSION1_VISUAL_LAB_DIR = "lab/session1-visual-lab";

export type Session1LlmId = "luna" | "terra" | "sonnet";
export type Session1Quality = "low" | "medium";

export type Session1VisualCell = {
  image_url: string | null;
  prompt: string | null;
  markdown: string;
  heading: string;
  cost_usd: number | null;
  latency_ms: number | null;
  quality: Session1Quality | "historical_mid";
  model_id: string;
  source: "generated" | "reused";
};

export type Session1VisualSection = {
  section_no: number;
  heading: string;
  cells: Partial<Record<"luna_low" | "luna_mid" | "terra_low" | "terra_mid" | "sonnet_mid", Session1VisualCell>>;
};

export type Session1VisualManifest = {
  updated_at: string;
  course_id: string;
  session_no: 1;
  size: string;
  notes: string;
  totals: {
    generated_count: number;
    cost_usd: number;
    latency_ms: number;
  };
  sections: Session1VisualSection[];
};

export function session1VisualPublicDir(): string {
  return path.join(process.cwd(), "public", SESSION1_VISUAL_LAB_DIR);
}

export function session1VisualManifestPath(): string {
  return path.join(session1VisualPublicDir(), "manifest.json");
}

export function publicUrlForSession1File(filename: string): string {
  return `/${SESSION1_VISUAL_LAB_DIR}/${filename}`;
}

export async function readSession1VisualManifest(): Promise<Session1VisualManifest | null> {
  try {
    return JSON.parse(
      await fs.readFile(session1VisualManifestPath(), "utf8"),
    ) as Session1VisualManifest;
  } catch {
    return null;
  }
}

export async function writeSession1VisualManifest(
  manifest: Session1VisualManifest,
): Promise<void> {
  await fs.mkdir(session1VisualPublicDir(), { recursive: true });
  await fs.writeFile(
    session1VisualManifestPath(),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
}

export function cellKey(
  llm: "luna" | "terra",
  quality: Session1Quality,
): "luna_low" | "luna_mid" | "terra_low" | "terra_mid" {
  if (llm === "luna") return quality === "low" ? "luna_low" : "luna_mid";
  return quality === "low" ? "terra_low" : "terra_mid";
}
