import { PHASE5_PROJECT_IDS } from "@/lib/phase5/phase5-data";

/** GET /api/settings/ao-projects が返す論設定（ao_projects 正本） */
export type AoProjectSettingsDto = {
  project_id: string;
  label_ja: string;
  summary: string;
  notes: string;
  process: string;
  tone: string;
  main_persona_key: string;
  main_persona_name: string;
  model_id: string;
  rag_enabled: boolean;
  rag_when: "first_user" | "every_user";
  rag_match_count: number;
  rag_match_threshold: number;
  rag_max_chars: number;
  history_max_messages: number;
  profile_inject: boolean;
  web_search_enabled: boolean;
  web_search_min_rounds: number;
  web_search_max_rounds: number;
  web_search_max_per_round: number;
  web_search_tavily_max_results: number;
  web_search_result_max_chars: number;
  web_search_snippet_max_chars: number;
  max_completion_tokens: number | null;
};

export const AO_PROJECT_SETTINGS_SELECT =
  "project_id, label_ja, summary, notes, process, tone, main_persona_key, model_id, rag_enabled, rag_when, rag_match_count, rag_match_threshold, rag_max_chars, history_max_messages, profile_inject, web_search_enabled, web_search_min_rounds, web_search_max_rounds, web_search_max_per_round, web_search_tavily_max_results, web_search_result_max_chars, web_search_snippet_max_chars, max_completion_tokens";

export function isPhase5ProjectIdForSettings(id: string): boolean {
  return (PHASE5_PROJECT_IDS as readonly string[]).includes(id);
}

export type AoProjectSettingsPatch = Partial<
  Pick<
    AoProjectSettingsDto,
    | "model_id"
    | "rag_enabled"
    | "rag_when"
    | "rag_match_count"
    | "rag_match_threshold"
    | "rag_max_chars"
    | "history_max_messages"
    | "profile_inject"
    | "web_search_enabled"
    | "web_search_min_rounds"
    | "web_search_max_rounds"
    | "web_search_max_per_round"
    | "web_search_tavily_max_results"
    | "web_search_result_max_chars"
    | "web_search_snippet_max_chars"
    | "max_completion_tokens"
  >
>;

export function normalizeAoProjectSettingsPatch(raw: unknown): AoProjectSettingsPatch | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: AoProjectSettingsPatch = {};

  if (typeof o.model_id === "string") out.model_id = o.model_id.trim();

  if (typeof o.rag_enabled === "boolean") out.rag_enabled = o.rag_enabled;
  if (o.rag_when === "first_user" || o.rag_when === "every_user") out.rag_when = o.rag_when;

  const intFields = [
    "rag_match_count",
    "rag_max_chars",
    "history_max_messages",
    "web_search_min_rounds",
    "web_search_max_rounds",
    "web_search_max_per_round",
    "web_search_tavily_max_results",
    "web_search_result_max_chars",
    "web_search_snippet_max_chars",
  ] as const;
  for (const k of intFields) {
    const n = Number(o[k]);
    if (Number.isFinite(n)) out[k] = Math.floor(n);
  }

  const t = Number(o.rag_match_threshold);
  if (Number.isFinite(t)) out.rag_match_threshold = Math.max(0, Math.min(1, t));

  if (typeof o.profile_inject === "boolean") out.profile_inject = o.profile_inject;
  if (typeof o.web_search_enabled === "boolean") out.web_search_enabled = o.web_search_enabled;

  if (o.max_completion_tokens === null) out.max_completion_tokens = null;
  else {
    const m = Number(o.max_completion_tokens);
    if (Number.isFinite(m)) out.max_completion_tokens = Math.floor(m);
  }

  return Object.keys(out).length ? out : null;
}
