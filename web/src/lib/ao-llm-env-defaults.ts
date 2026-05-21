/** /api/chat の resolveMaxTokens と同じ環境既定（令旨 UI 表示用） */

const DEFAULT_MAX_TOKENS = 4096;

function resolveCompletionCeiling(): number {
  const raw = process.env.LLM_MAX_TOKENS_CEILING?.trim();
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return 4096;
  return Math.max(256, Math.min(8192, Math.floor(n)));
}

/** 論別の環境既定 max_completion_tokens（DB 未設定時に実効する値） */
export function resolveEnvDefaultMaxCompletionTokens(projectId: string): number {
  const ceiling = resolveCompletionCeiling();
  const raw = process.env.LLM_MAX_TOKENS?.trim();
  const n = raw ? Number(raw) : NaN;
  let requested = Number.isFinite(n) ? Math.floor(n) : DEFAULT_MAX_TOKENS;
  if (projectId === "chat") {
    requested = Math.min(requested, 3072);
  }
  return Math.max(256, Math.min(ceiling, requested));
}
