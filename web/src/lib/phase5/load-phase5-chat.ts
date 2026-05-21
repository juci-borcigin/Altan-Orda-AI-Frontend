import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectId } from "@/lib/ao-types";
import { applyGlossary, type GlossaryEntry } from "./glossary";
import { assembleFromDbRows } from "./assemble-sp-db";
import { Phase5DbConfigError } from "./phase5-db-errors";
import { PHASE5_PROJECT_IDS } from "./phase5-data";
import { systemTemplateBodyFromDb } from "./phase5-template";
import type { DbPersonaRow, DbProjectRow } from "./assemble-sp-db";

export type Phase5ProjectRuntime = {
  project_id: string;
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

export type Phase5ChatBundle = {
  template: string;
  globals: {
    stage: string;
    assistant: string;
    user: string;
    general: string;
    rules: string;
    format: string;
  };
  header: { profile: string };
  modes: { casual: string; designate: string };
  project: DbProjectRow;
  personas: DbPersonaRow[];
  runtime: Phase5ProjectRuntime;
  glossary: GlossaryEntry[];
  /** 表示名（フナン等）と別名（ベキ等） */
  allowedSpeakerNames: Set<string>;
  mainSpeakerName: string;
};

const REQUIRED_GLOBAL_KEYS = [
  "global.stage",
  "global.assistant",
  "global.user",
  "global.general",
  "global.rules",
  "global.format",
] as const;

const OPTIONAL_SECTION_KEYS = ["header.profile", "mode_casual", "mode_designate"] as const;

/** 書庫取り込み用 project_id → Phase5 論 ID（ao_projects.project_id） */
export function phase5DbProjectId(projectId: ProjectId): string {
  switch (projectId) {
    case "gemini":
    case "claude":
    case "chatgpt":
      return "plan";
    default:
      return projectId;
  }
}

export function isPhase5EligibleProject(projectId: ProjectId): boolean {
  const dbPid = phase5DbProjectId(projectId);
  return (PHASE5_PROJECT_IDS as readonly string[]).includes(dbPid);
}

function requireSectionBody(
  byKey: Map<string, string>,
  sectionKey: string,
  label: string,
): string {
  if (!byKey.has(sectionKey)) {
    throw new Phase5DbConfigError(`ao_prompts.${sectionKey} がありません（${label}）`);
  }
  return byKey.get(sectionKey) ?? "";
}

export async function loadPhase5ChatBundle(
  supa: SupabaseClient,
  projectId: ProjectId,
): Promise<Phase5ChatBundle | null> {
  if (!isPhase5EligibleProject(projectId)) return null;

  const dbPid = phase5DbProjectId(projectId);

  const { data: project, error: pErr } = await supa
    .from("ao_projects")
    .select(
      "project_id, label_ja, main_persona_key, process, tone, rag_enabled, rag_when, rag_match_count, rag_match_threshold, rag_max_chars, history_max_messages, profile_inject, web_search_enabled, web_search_min_rounds, web_search_max_rounds, web_search_max_per_round, web_search_tavily_max_results, web_search_result_max_chars, web_search_snippet_max_chars, max_completion_tokens",
    )
    .eq("project_id", dbPid)
    .maybeSingle();
  if (pErr) throw new Phase5DbConfigError(`ao_projects 読込失敗: ${pErr.message}`);
  if (!project) return null;

  const { data: tmplRow, error: tmplErr } = await supa
    .from("ao_prompts")
    .select("body")
    .eq("section_key", "system_template")
    .maybeSingle();
  if (tmplErr) throw new Phase5DbConfigError(`system_template 読込失敗: ${tmplErr.message}`);
  let template: string;
  try {
    template = systemTemplateBodyFromDb(tmplRow?.body);
  } catch (e) {
    throw new Phase5DbConfigError(
      e instanceof Error ? e.message : "system_template が未設定です",
    );
  }

  const sectionKeys = [...REQUIRED_GLOBAL_KEYS, ...OPTIONAL_SECTION_KEYS];
  const { data: sections, error: sErr } = await supa
    .from("ao_prompts")
    .select("section_key, body")
    .in("section_key", sectionKeys);
  if (sErr) throw new Phase5DbConfigError(`ao_prompts 読込失敗: ${sErr.message}`);

  const byKey = new Map<string, string>();
  for (const row of sections ?? []) {
    byKey.set(row.section_key, row.body ?? "");
  }

  const globals = {
    stage: requireSectionBody(byKey, "global.stage", "舞台"),
    assistant: requireSectionBody(byKey, "global.assistant", "AIの役割"),
    user: requireSectionBody(byKey, "global.user", "ユーザー"),
    general: requireSectionBody(byKey, "global.general", "方針"),
    rules: requireSectionBody(byKey, "global.rules", "必須ルール"),
    format: requireSectionBody(byKey, "global.format", "出力形式"),
  };

  const { data: personas, error: perErr } = await supa
    .from("ao_personas")
    .select("persona_key, name, alias, title, thinking, role, tone");
  if (perErr) throw new Phase5DbConfigError(`ao_personas 読込失敗: ${perErr.message}`);

  const { data: glossaryRows, error: gErr } = await supa
    .from("ao_glossary")
    .select("ao_term, general_term, sort_order")
    .order("sort_order", { ascending: false });
  if (gErr) throw new Phase5DbConfigError(`ao_glossary 読込失敗: ${gErr.message}`);

  const pmap = new Map((personas ?? []).map((p) => [p.persona_key, p]));
  const main = pmap.get(project.main_persona_key);
  const mainSpeakerName = main?.name?.trim() || "フナン";

  const allowedSpeakerNames = new Set<string>();
  for (const p of personas ?? []) {
    if (p.name?.trim()) allowedSpeakerNames.add(p.name.trim());
    if (p.alias?.trim()) allowedSpeakerNames.add(p.alias.trim());
  }

  const runtime: Phase5ProjectRuntime = {
    project_id: project.project_id,
    rag_enabled: project.rag_enabled ?? true,
    rag_when: project.rag_when === "first_user" ? "first_user" : "every_user",
    rag_match_count: project.rag_match_count ?? 5,
    rag_match_threshold: project.rag_match_threshold ?? 0.5,
    rag_max_chars: project.rag_max_chars ?? 4000,
    history_max_messages: project.history_max_messages ?? 20,
    profile_inject: project.profile_inject ?? false,
    web_search_enabled: project.web_search_enabled ?? true,
    web_search_min_rounds: project.web_search_min_rounds ?? 0,
    web_search_max_rounds: project.web_search_max_rounds ?? 2,
    web_search_max_per_round: project.web_search_max_per_round ?? 4,
    web_search_tavily_max_results: project.web_search_tavily_max_results ?? 5,
    web_search_result_max_chars: project.web_search_result_max_chars ?? 12_000,
    web_search_snippet_max_chars: project.web_search_snippet_max_chars ?? 450,
    max_completion_tokens: project.max_completion_tokens ?? null,
  };

  return {
    template,
    globals,
    header: { profile: byKey.get("header.profile") ?? "" },
    modes: {
      casual: byKey.get("mode_casual") ?? "",
      designate: byKey.get("mode_designate") ?? "",
    },
    project: {
      project_id: project.project_id,
      label_ja: project.label_ja,
      main_persona_key: project.main_persona_key,
      process: project.process ?? "",
      tone: project.tone ?? "",
    },
    personas: personas ?? [],
    runtime,
    glossary: (glossaryRows ?? []).map((r) => ({
      ao_term: r.ao_term,
      general_term: r.general_term,
      sort_order: r.sort_order ?? 0,
    })),
    allowedSpeakerNames,
    mainSpeakerName,
  };
}

export function buildPhase5SystemPrompt(opts: {
  bundle: Phase5ChatBundle;
  userTextGeneral: string;
  ragBlock: string;
  modeBlock: string;
  includeProfile: boolean;
  preThread: string;
}): string {
  const { bundle } = opts;
  return assembleFromDbRows({
    template: bundle.template,
    globals: bundle.globals,
    header: bundle.header,
    projects: [bundle.project],
    personas: bundle.personas,
    projectId: bundle.project.project_id,
    userText: opts.userTextGeneral,
    ragBlock: opts.ragBlock,
    modeBlock: opts.modeBlock,
    includeProfile: opts.includeProfile,
    preThread: opts.preThread,
  });
}

export function encodeUserTextForLlm(text: string, glossary: GlossaryEntry[]): string {
  return applyGlossary(text, glossary, "ao_to_general");
}

export function decodeAssistantTextForUi(text: string, glossary: GlossaryEntry[]): string {
  return applyGlossary(text, glossary, "general_to_ao");
}

export function trimHistoryForRuntime(
  projectId: ProjectId,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  runtime: Phase5ProjectRuntime,
): Array<{ role: "user" | "assistant"; content: string }> {
  const max = runtime.history_max_messages;
  if (messages.length <= max) return messages;
  return messages.slice(messages.length - max);
}
