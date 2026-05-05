/**
 * Supabase `threads.project_id` と一致させる論 ID。
 * 巷間論は chat / chatgpt / claude（一覧では gemini を除外）。
 */
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

export function isProjectId(x: string): x is ProjectId {
  return PROJECT_IDS.has(x);
}
