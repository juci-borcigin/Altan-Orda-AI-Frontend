import type { SupabaseClient } from "@supabase/supabase-js";

/** public.ao_user_context の唯一のキー。マイグレーションの check と一致させる。 */
export const AO_USER_CONTEXT_KEY = "juchi";

/** マイグレーションの char_length 上限と揃える。 */
export const AO_USER_CONTEXT_MAX_CHARS = 20_000;

const HEADING = "## 殿下の人物コンテキスト";

/**
 * 立ち情報をシステムプロンプトの末尾へ足す。空なら元の文を返す。
 * 呼び出しは組み立て済み system に対して一度だけ。
 */
export function appendAoUserContext(system: string, body: string | null | undefined): string {
  const trimmed = (body ?? "").trim();
  if (!trimmed) return system;
  const clipped =
    trimmed.length > AO_USER_CONTEXT_MAX_CHARS
      ? trimmed.slice(0, AO_USER_CONTEXT_MAX_CHARS)
      : trimmed;
  const block = `${HEADING}\n毎ターン参照する立ち情報である。検索結果ではない。本文に無い属性は推測で補わない。\n\n${clipped}`;
  const base = system.trimEnd();
  return base ? `${base}\n\n${block}` : block;
}

/**
 * サービスロールで1行読む。未適用・空行・読取失敗でも会話は続ける（空文字）。
 * 本文はログに出さない。
 */
export async function loadAoUserContextBody(supa: SupabaseClient): Promise<string> {
  try {
    const { data, error } = await supa
      .from("ao_user_context")
      .select("body")
      .eq("context_key", AO_USER_CONTEXT_KEY)
      .maybeSingle();
    if (error) {
      console.error("[ao-user-context] load:", error.code ?? "", error.message);
      return "";
    }
    return typeof data?.body === "string" ? data.body : "";
  } catch (e) {
    console.error("[ao-user-context] load:", e instanceof Error ? e.message : e);
    return "";
  }
}
