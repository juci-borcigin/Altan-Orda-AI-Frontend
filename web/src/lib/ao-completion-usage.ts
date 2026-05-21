/** chat/completions 系レスポンスからトークン数を取り出す（OpenRouter／プロバイダ差を吸収） */

const MAX_USAGE_WALK_DEPTH = 12;
const MAX_USAGE_WALK_NODES = 120;

function pickTokenInt(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.floor(v));
  if (typeof v === "string") {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return undefined;
}

/**
 * 1 回分の completion JSON（choices を含むオブジェクト）から prompt/completion を読む。
 * `usage` が無い・別キーのときは可能な範囲でフォールバックする。
 */
export function usagePromptCompletionFromCompletionJson(json: unknown): {
  promptTokens: number;
  completionTokens: number;
} | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;

  const candidates: unknown[] = [];
  if (root.usage != null) candidates.push(root.usage);
  const meta = root.usage_metadata ?? root.usageMetadata;
  if (meta != null) candidates.push(meta);

  for (const ur of candidates) {
    if (!ur || typeof ur !== "object") continue;
    const u = ur as Record<string, unknown>;

    const prompt =
      pickTokenInt(u.prompt_tokens) ??
      pickTokenInt(u.input_tokens) ??
      pickTokenInt(u.promptTokenCount);

    const completion =
      pickTokenInt(u.completion_tokens) ??
      pickTokenInt(u.output_tokens) ??
      pickTokenInt(u.completionTokenCount) ??
      pickTokenInt(u.candidatesTokenCount);

    const total =
      pickTokenInt(u.total_tokens) ?? pickTokenInt(u.totalTokens) ?? pickTokenInt(u.totalTokenCount);

    if (prompt !== undefined || completion !== undefined) {
      return {
        promptTokens: prompt ?? 0,
        completionTokens: completion ?? 0,
      };
    }
    if (total !== undefined) {
      return { promptTokens: 0, completionTokens: total };
    }
  }
  return null;
}

function coerceParseJsonBlob(raw: unknown): unknown | null {
  if (raw == null) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return null;
  }
}

function walkFindPositiveUsage(
  obj: unknown,
  depth: number,
  visited: WeakSet<object>,
  nodesVisited: { n: number },
): ReturnType<typeof usagePromptCompletionFromCompletionJson> | null {
  if (depth > MAX_USAGE_WALK_DEPTH || nodesVisited.n > MAX_USAGE_WALK_NODES) return null;

  const parsed = coerceParseJsonBlob(obj);
  const root = parsed ?? obj;

  if (root == null || typeof root !== "object") return null;
  if (visited.has(root)) return null;
  visited.add(root);
  nodesVisited.n += 1;

  const hit = usagePromptCompletionFromCompletionJson(root);
  if (hit && (hit.promptTokens > 0 || hit.completionTokens > 0)) return hit;

  if (!parsed && typeof obj === "string") return null;

  for (const v of Object.values(root as Record<string, unknown>)) {
    const inner = walkFindPositiveUsage(v, depth + 1, visited, nodesVisited);
    if (inner && (inner.promptTokens > 0 || inner.completionTokens > 0)) return inner;
  }
  return null;
}

/** レスポンス内のどこかに埋もれた usage を拾う（保存済み raw_response 復元用・単発 completion 用） */
export function usagePromptCompletionFromDeepWalk(envelope: unknown): {
  promptTokens: number;
  completionTokens: number;
} | null {
  return walkFindPositiveUsage(envelope, 0, new WeakSet<object>(), { n: 0 });
}

/** `/api/chat` のループで複数ラウンドの usage を足し込む */
export function addCompletionUsageToAgg(
  agg: { prompt: number; completion: number },
  completionJson: unknown,
): void {
  const got =
    usagePromptCompletionFromCompletionJson(completionJson) ??
    usagePromptCompletionFromDeepWalk(completionJson);
  if (!got) return;
  agg.prompt += got.promptTokens;
  agg.completion += got.completionTokens;
}

/** Supabase `ao_messages.raw_response`（{ completion?: unknown } 想定）から復元 */
export function usagePromptCompletionFromStoredRawResponse(
  rawResponse: unknown,
): { promptTokens: number; completionTokens: number } | null {
  if (rawResponse == null) return null;
  const o =
    coerceParseJsonBlob(rawResponse) ??
    (typeof rawResponse === "object" ? rawResponse : null);
  if (!o || typeof o !== "object") return null;
  const rec = o as Record<string, unknown>;

  const completion = coerceParseJsonBlob(rec.completion) ?? rec.completion;
  const fromCompletion =
    usagePromptCompletionFromCompletionJson(completion) ??
    usagePromptCompletionFromDeepWalk(completion);
  if (fromCompletion && (fromCompletion.promptTokens > 0 || fromCompletion.completionTokens > 0)) {
    return fromCompletion;
  }
  return usagePromptCompletionFromDeepWalk(rec);
}
