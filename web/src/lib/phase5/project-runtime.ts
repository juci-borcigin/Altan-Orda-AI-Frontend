/**
 * 論（project_id）ごとの実行パラメータ既定。
 *
 * 分担:
 * - SP（Template + Variables）… 令旨・進行・口調・方針・出力形式
 * - ao_projects … RAG / 履歴 / Web検索 / max_tokens / model_id（DB 正本）
 * - ao_glossary … 表示用 encode/decode（機械適用・設定不要）
 * - コード固定 … format 再試行 2 回、Glossary 適用ロジック
 *
 * /api/chat への接続は未。Go 時に loadProjectRuntime(projectId) で読む想定。
 */

import type { Phase5SampleProjectId } from "./phase5-data";
import { PHASE5_PROJECT_IDS } from "./phase5-data";

/** RAG 検索をいつ走らせるか */
export type RagWhen = "first_user" | "every_user";

export type AoProjectRuntimeRow = {
  project_id: string;
  /** RAG */
  rag_enabled: boolean;
  rag_when: RagWhen;
  rag_match_count: number;
  rag_match_threshold: number;
  rag_max_chars: number;
  /** 会話履歴（messages 配列。要約は未実装） */
  history_max_messages: number;
  /** 心気論のみ true など */
  profile_inject: boolean;
  /** Web 検索（TAVILY_API_KEY が無いときはコード側で無効） */
  web_search_enabled: boolean;
  web_search_max_rounds: number;
  web_search_max_per_round: number;
  web_search_tavily_max_results: number;
  web_search_result_max_chars: number;
  web_search_snippet_max_chars: number;
  /** null = env LLM_MAX_TOKENS / 天井に従う */
  max_completion_tokens: number | null;
};

/** 全論共通のフォールバック（DB 行が無いとき） */
export const AO_PROJECT_RUNTIME_GLOBAL_DEFAULTS: Omit<AoProjectRuntimeRow, "project_id"> = {
  rag_enabled: true,
  rag_when: "every_user",
  rag_match_count: 5,
  rag_match_threshold: 0.5,
  rag_max_chars: 4000,
  history_max_messages: 20,
  profile_inject: false,
  web_search_enabled: true,
  web_search_max_rounds: 2,
  web_search_max_per_round: 4,
  web_search_tavily_max_results: 5,
  web_search_result_max_chars: 12_000,
  web_search_snippet_max_chars: 450,
  max_completion_tokens: null,
};

/** 論別既定（現行 chat/route.ts の挙動＋殿下方針を反映） */
export const PHASE5_PROJECT_RUNTIME_DEFAULTS: Record<Phase5SampleProjectId, AoProjectRuntimeRow> = {
  debate: {
    project_id: "debate",
    ...AO_PROJECT_RUNTIME_GLOBAL_DEFAULTS,
    history_max_messages: 12,
    rag_when: "every_user",
    web_search_enabled: true,
  },
  chat: {
    project_id: "chat",
    ...AO_PROJECT_RUNTIME_GLOBAL_DEFAULTS,
    history_max_messages: 12,
    rag_when: "every_user",
    web_search_enabled: true,
    max_completion_tokens: 3072,
  },
  plan: {
    project_id: "plan",
    ...AO_PROJECT_RUNTIME_GLOBAL_DEFAULTS,
    history_max_messages: 20,
    rag_when: "every_user",
    web_search_enabled: true,
  },
  work: {
    project_id: "work",
    ...AO_PROJECT_RUNTIME_GLOBAL_DEFAULTS,
    history_max_messages: 20,
    rag_when: "every_user",
    web_search_enabled: true,
  },
  mental: {
    project_id: "mental",
    ...AO_PROJECT_RUNTIME_GLOBAL_DEFAULTS,
    history_max_messages: 20,
    rag_when: "every_user",
    profile_inject: true,
    web_search_enabled: false,
  },
  notebook: {
    project_id: "notebook",
    ...AO_PROJECT_RUNTIME_GLOBAL_DEFAULTS,
    history_max_messages: 20,
    rag_when: "every_user",
    web_search_enabled: true,
  },
  foreign: {
    project_id: "foreign",
    ...AO_PROJECT_RUNTIME_GLOBAL_DEFAULTS,
    history_max_messages: 20,
    rag_when: "every_user",
    web_search_enabled: false,
  },
};

export function defaultProjectRuntime(projectId: string): AoProjectRuntimeRow {
  const key = projectId as Phase5SampleProjectId;
  if (PHASE5_PROJECT_IDS.includes(key)) return { ...PHASE5_PROJECT_RUNTIME_DEFAULTS[key] };
  return { project_id: projectId, ...AO_PROJECT_RUNTIME_GLOBAL_DEFAULTS };
}

/** Supabase upsert 用の平坦な行配列 */
export function projectRuntimeSeedRows(): AoProjectRuntimeRow[] {
  return PHASE5_PROJECT_IDS.map((id) => PHASE5_PROJECT_RUNTIME_DEFAULTS[id]);
}
