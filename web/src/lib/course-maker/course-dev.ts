/** 講義メーカー Dev モード（トレース UI・部分生成）。本番では AO_COURSE_DEV_MODE=0 */
export function isCourseDevMode(): boolean {
  const v = (process.env.AO_COURSE_DEV_MODE ?? "1").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export type Tier2OutputMode = "text" | "image" | "both";

export function parseTier2OutputMode(v: unknown): Tier2OutputMode {
  if (v === "text" || v === "image" || v === "both") return v;
  return "both";
}
