/**
 * ao_projects 行型・既定値。seed 後は Supabase が正。
 */

import type { Phase5SampleProjectId } from "./phase5-data";
import { PHASE5_PROJECT_IDS, PHASE5_PROJECT_MAP } from "./phase5-data";
import type { Phase5Variables, ProjectRecord } from "./parse-variables";
import { projectIdFromSectionKey } from "./parse-variables";
import type { RagWhen } from "./project-runtime";
import { PHASE5_PROJECT_RUNTIME_DEFAULTS } from "./project-runtime";

export type AoProjectRow = {
  project_id: string;
  section_key: string;
  label_ja: string;
  summary: string;
  notes: string;
  main_persona_key: string;
  process: string;
  tone: string;
  rag_enabled: boolean;
  rag_when: RagWhen;
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

export type AoPersonaRow = {
  persona_key: string;
  name: string;
  title: string;
  alias: string;
  default_project_id: string;
  summary: string;
  fact: string;
  thinking: string;
  role: string;
  tone: string;
};

export function projectRowsFromVariables(vars: Phase5Variables): AoProjectRow[] {
  const rows: AoProjectRow[] = [];
  for (const proj of Object.values(vars.projects)) {
    const projectId = projectIdFromSectionKey(proj._key);
    if (!projectId) continue;
    const map = PHASE5_PROJECT_MAP[projectId as Phase5SampleProjectId];
    const rt = PHASE5_PROJECT_RUNTIME_DEFAULTS[projectId as Phase5SampleProjectId];
    rows.push({
      project_id: projectId,
      section_key: map.section_key,
      label_ja: map.topic_label_ja,
      summary: proj.summary,
      notes: proj.notes,
      main_persona_key: proj.main,
      process: proj.process,
      tone: proj.tone,
      rag_enabled: rt.rag_enabled,
      rag_when: rt.rag_when,
      rag_match_count: rt.rag_match_count,
      rag_match_threshold: rt.rag_match_threshold,
      rag_max_chars: rt.rag_max_chars,
      history_max_messages: rt.history_max_messages,
      profile_inject: rt.profile_inject,
      web_search_enabled: rt.web_search_enabled,
      web_search_min_rounds: 0,
      web_search_max_rounds: rt.web_search_max_rounds,
      web_search_max_per_round: rt.web_search_max_per_round,
      web_search_tavily_max_results: rt.web_search_tavily_max_results,
      web_search_result_max_chars: rt.web_search_result_max_chars,
      web_search_snippet_max_chars: rt.web_search_snippet_max_chars,
      max_completion_tokens: rt.max_completion_tokens,
    });
  }
  return rows;
}

export function personaRowsFromVariables(vars: Phase5Variables): AoPersonaRow[] {
  return Object.values(vars.personas).map((p) => ({
    persona_key: p._key,
    name: p.name ?? "",
    title: p.title ?? "",
    alias: p.alias ?? "",
    default_project_id: p.project ?? "",
    summary: p.summary ?? "",
    fact: p.fact ?? "",
    thinking: p.thinking ?? "",
    role: p.role ?? "",
    tone: p.tone ?? "",
  }));
}

/** Supabase upsert 用（runtime 互換列を含む） */
export function aoProjectUpsertPayload(row: AoProjectRow): Record<string, unknown> {
  return {
    ...row,
    updated_at: new Date().toISOString(),
  };
}

export function defaultAoProjectRow(projectId: string): AoProjectRow | null {
  if (!PHASE5_PROJECT_IDS.includes(projectId as Phase5SampleProjectId)) return null;
  const id = projectId as Phase5SampleProjectId;
  const map = PHASE5_PROJECT_MAP[id];
  const rt = PHASE5_PROJECT_RUNTIME_DEFAULTS[id];
  return {
    project_id: id,
    section_key: map.section_key,
    label_ja: map.topic_label_ja,
    summary: "",
    notes: "",
    main_persona_key: "",
    process: "",
    tone: "",
    rag_enabled: rt.rag_enabled,
    rag_when: rt.rag_when,
    rag_match_count: rt.rag_match_count,
    rag_match_threshold: rt.rag_match_threshold,
    rag_max_chars: rt.rag_max_chars,
    history_max_messages: rt.history_max_messages,
    profile_inject: rt.profile_inject,
    web_search_enabled: rt.web_search_enabled,
    web_search_min_rounds: 0,
    web_search_max_rounds: rt.web_search_max_rounds,
    web_search_max_per_round: rt.web_search_max_per_round,
    web_search_tavily_max_results: rt.web_search_tavily_max_results,
    web_search_result_max_chars: rt.web_search_result_max_chars,
    web_search_snippet_max_chars: rt.web_search_snippet_max_chars,
    max_completion_tokens: rt.max_completion_tokens,
  };
}
