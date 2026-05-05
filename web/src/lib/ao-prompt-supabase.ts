import type { SupabaseClient } from "@supabase/supabase-js";
import { type AoPromptSectionKey, isAoPromptSectionKey } from "@/lib/ao-prompts";

/**
 * Supabase `ao_prompt_sections` を読み、`buildAoSystemPrompt` へ渡す上書きマップにする。
 * テーブル不存在・空・エラー時は `{}`（コード既定のみ）。
 */
export async function loadAoPromptOverrides(
  supa: SupabaseClient,
): Promise<Partial<Record<AoPromptSectionKey, string>>> {
  const { data, error } = await supa.from("ao_prompt_sections").select("section_key, body");
  if (error) {
    console.error("[ao-prompt] load ao_prompt_sections:", error.message);
    return {};
  }
  if (!data?.length) return {};

  const out: Partial<Record<AoPromptSectionKey, string>> = {};
  for (const row of data as Array<{ section_key?: string; body?: string }>) {
    const k = row.section_key?.trim() ?? "";
    const body = row.body;
    if (!k || typeof body !== "string" || !body.trim()) continue;
    if (!isAoPromptSectionKey(k)) continue;
    out[k] = body.trim();
  }
  return out;
}
