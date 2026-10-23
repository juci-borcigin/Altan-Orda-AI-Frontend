import type { SupabaseClient } from "@supabase/supabase-js";

/** public.ao_user_context の唯一のキー。マイグレーションの check と一致させる。 */
export const AO_USER_CONTEXT_KEY = "juchi";

/** マイグレーションの char_length 上限と揃える。 */
export const AO_USER_CONTEXT_MAX_CHARS = 20_000;

/** ペルソナ本文より前に置く短い前置き。文言はレビュー指定のまま。 */
export const AO_USER_CONTEXT_PREFACE =
  "以下はユーザーの人物像。応答の参考であって事実の証拠ではない。ペルソナの方針が優先する。";

/**
 * 人物像をシステムプロンプトの先頭へ置く。空なら元の文を返す。
 * 毎ターン変わる本文（user_text、現在時刻、RAG）より前なので、
 * 先頭プレフィックスをキャッシュするモデルではここが安定部分になる。
 * 呼び出しは組み立て済み system に対して一度だけ。
 */
export function prependAoUserContext(system: string, body: string | null | undefined): string {
  const trimmed = (body ?? "").trim();
  if (!trimmed) return system;
  const clipped =
    trimmed.length > AO_USER_CONTEXT_MAX_CHARS
      ? trimmed.slice(0, AO_USER_CONTEXT_MAX_CHARS)
      : trimmed;
  const block = `${AO_USER_CONTEXT_PREFACE}\n\n${clipped}`;
  const rest = system.trimStart();
  return rest ? `${block}\n\n${rest}` : block;
}

/**
 * 論の主担当の inject_user_context。列がまだ無い・読めないときは既定のオン。
 * 主担当キーが空のときもオン。
 */
export async function mainPersonaInjectsUserContext(
  supa: SupabaseClient,
  personaKey: string | null | undefined,
): Promise<boolean> {
  const key = (personaKey ?? "").trim();
  if (!key) return true;
  try {
    const { data, error } = await supa
      .from("ao_personas")
      .select("inject_user_context")
      .eq("persona_key", key)
      .maybeSingle();
    if (error) {
      console.error("[ao-user-context] persona flag:", error.code ?? "", error.message);
      return true;
    }
    if (typeof data?.inject_user_context !== "boolean") return true;
    return data.inject_user_context;
  } catch (e) {
    console.error("[ao-user-context] persona flag:", e instanceof Error ? e.message : e);
    return true;
  }
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
