/** RAG 埋め込みクエリ整形・論 ID 正規化（phase5 / threads 共通） */

/** テスト用先頭行などを除いた殿下の直近 user 本文 */
export function normalizeRagQuery(userMessage: string): string {
  const t = userMessage.trim();
  if (!t) return "";
  return t.replace(/^RAGテスト\d+\s*\n+/i, "").trim() || t;
}

/**
 * threads.project_id またはクライアント論 ID → ao_projects 系の ID（plan, chat, …）
 */
export function normalizeEmbedProjectId(projectId: string | null | undefined): string | null {
  const p = (projectId ?? "").trim();
  if (!p) return null;
  switch (p) {
    case "talk":
      return "chat";
    case "study":
      return "notebook";
    case "gemini":
    case "claude":
    case "chatgpt":
      return "plan";
    default:
      return p;
  }
}

/** 埋め込み API に渡すクエリ文（論ラベル + 直近 user 1 件） */
export function buildRagEmbedQuery(opts: {
  lastUserText: string;
  projectLabelJa?: string | null;
  projectId?: string | null;
}): string {
  const user = normalizeRagQuery(opts.lastUserText);
  const parts: string[] = [];
  const label = opts.projectLabelJa?.trim();
  const pid = opts.projectId?.trim();
  if (label) parts.push(`論: ${label}`);
  else if (pid) parts.push(`論: ${pid}`);
  if (user) parts.push(user);
  return parts.join("\n\n").trim();
}
