/**
 * Supabase `threads.project_id` と一致させる論 ID（巷間論の `talk` はクライアント専用・DB には出さない）。
 */
export type ProjectId =
  | "debate"
  | "chat"
  | "talk"
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
  "talk",
  "plan",
  "work",
  "mental",
  "notebook",
  "foreign",
  "gemini",
  "chatgpt",
  "claude",
]);

export function isProjectId(x: string): x is ProjectId {
  return PROJECT_IDS.has(x);
}
