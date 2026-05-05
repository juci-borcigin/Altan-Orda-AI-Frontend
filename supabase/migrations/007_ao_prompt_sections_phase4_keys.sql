-- Phase 4: `section_key` の集合が刷新された（`web/src/lib/ao-prompts.ts` の `AO_PROMPT_SECTION_KEYS`）。
-- 既存 DB に旧キー行だけが残る場合、`isAoPromptSectionKey` で無視されコード既定にフォールバックする。
-- 新キーで Supabase を埋め直すには: `cd web && npm run seed:prompts`（SUPABASE_* 必須）。
-- 任意: 旧キー行は手動で delete してよい（スキーマ変更なし）。

select 1;
