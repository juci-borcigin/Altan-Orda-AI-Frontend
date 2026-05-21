/** Supabase `ao_threads.project_id` および AO ネイティブ議事の論 ID（DB と一致） */
export type ProjectId =
  | "debate"
  | "chat"
  | "plan"
  | "work"
  | "mental"
  | "notebook"
  | "foreign"
  | "gemini"
  | "chatgpt"
  | "claude";

const PROJECT_IDS = new Set<string>([
  "debate",
  "chat",
  "plan",
  "work",
  "mental",
  "notebook",
  "foreign",
  "gemini",
  "chatgpt",
  "claude",
]);

/** 旧クライアント ID・取り込み表記 → 現行 ProjectId */
export function normalizeProjectId(raw: string): ProjectId | null {
  const t = raw.trim();
  if (!t) return null;
  if (t === "talk") return "chat";
  if (t === "study") return "notebook";
  if (isProjectId(t)) return t;
  return null;
}

export function isProjectId(x: string): x is ProjectId {
  return PROJECT_IDS.has(x);
}
