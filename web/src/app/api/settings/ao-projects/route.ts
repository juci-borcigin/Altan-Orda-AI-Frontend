import { NextResponse } from "next/server";
import {
  AO_PROJECT_SETTINGS_SELECT,
  type AoProjectSettingsDto,
  isPhase5ProjectIdForSettings,
  normalizeAoProjectSettingsPatch,
} from "@/lib/ao-project-settings";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function envDefaultModel(): string {
  return (
    process.env.LLM_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-5.4-mini"
  );
}

function rowToDto(
  row: Record<string, unknown>,
  mainPersonaName: string,
): AoProjectSettingsDto {
  const ragWhen = row.rag_when === "first_user" ? "first_user" : "every_user";
  const maxRaw = row.max_completion_tokens;
  const maxTokens =
    maxRaw === null || maxRaw === undefined
      ? null
      : Number.isFinite(Number(maxRaw))
        ? Math.floor(Number(maxRaw))
        : null;

  return {
    project_id: String(row.project_id ?? ""),
    label_ja: String(row.label_ja ?? ""),
    summary: String(row.summary ?? ""),
    notes: String(row.notes ?? ""),
    process: String(row.process ?? ""),
    tone: String(row.tone ?? ""),
    main_persona_key: String(row.main_persona_key ?? ""),
    main_persona_name: mainPersonaName,
    model_id: String(row.model_id ?? "").trim(),
    rag_enabled: Boolean(row.rag_enabled ?? true),
    rag_when: ragWhen,
    rag_match_count: Number(row.rag_match_count ?? 5),
    rag_match_threshold: Number(row.rag_match_threshold ?? 0.5),
    rag_max_chars: Number(row.rag_max_chars ?? 4000),
    history_max_messages: Number(row.history_max_messages ?? 20),
    profile_inject: Boolean(row.profile_inject ?? false),
    web_search_enabled: Boolean(row.web_search_enabled ?? true),
    web_search_min_rounds: Number(row.web_search_min_rounds ?? 0),
    web_search_max_rounds: Number(row.web_search_max_rounds ?? 2),
    web_search_max_per_round: Number(row.web_search_max_per_round ?? 4),
    web_search_tavily_max_results: Number(row.web_search_tavily_max_results ?? 5),
    web_search_result_max_chars: Number(row.web_search_result_max_chars ?? 12_000),
    web_search_snippet_max_chars: Number(row.web_search_snippet_max_chars ?? 450),
    max_completion_tokens: maxTokens,
  };
}

/** GET ?projectId=plan — 論設定（ao_projects） */
export async function GET(req: Request) {
  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json(
      { error: "Supabase が未設定です", supabaseConfigured: false },
      { status: 503 },
    );
  }

  const projectId = new URL(req.url).searchParams.get("projectId")?.trim() ?? "";
  if (!projectId || !isPhase5ProjectIdForSettings(projectId)) {
    return NextResponse.json({ error: "Invalid or missing projectId" }, { status: 400 });
  }

  const { data: row, error } = await supa
    .from("ao_projects")
    .select(AO_PROJECT_SETTINGS_SELECT)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("[settings/ao-projects GET]", error.message);
    return NextResponse.json({ error: "読込に失敗しました", detail: error.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: `ao_projects に ${projectId} がありません` }, { status: 404 });
  }

  let mainPersonaName = "";
  const pk = typeof row.main_persona_key === "string" ? row.main_persona_key.trim() : "";
  if (pk) {
    const { data: per } = await supa.from("ao_personas").select("name").eq("persona_key", pk).maybeSingle();
    mainPersonaName = per?.name?.trim() ?? "";
  }

  return NextResponse.json({
    project: rowToDto(row as Record<string, unknown>, mainPersonaName),
    envDefaultModel: envDefaultModel(),
    supabaseConfigured: true,
  });
}

type PostBody = {
  projectId?: string;
  patch?: unknown;
};

/** POST — 論設定の編集可能列のみ更新 */
export async function POST(req: Request) {
  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ error: "Supabase が未設定です" }, { status: 503 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  if (!projectId || !isPhase5ProjectIdForSettings(projectId)) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }

  const patch = normalizeAoProjectSettingsPatch(body.patch);
  if (!patch) {
    return NextResponse.json({ error: "Empty or invalid patch" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.model_id !== undefined) update.model_id = patch.model_id;
  if (patch.rag_enabled !== undefined) update.rag_enabled = patch.rag_enabled;
  if (patch.rag_when !== undefined) update.rag_when = patch.rag_when;
  if (patch.rag_match_count !== undefined) update.rag_match_count = patch.rag_match_count;
  if (patch.rag_match_threshold !== undefined) update.rag_match_threshold = patch.rag_match_threshold;
  if (patch.rag_max_chars !== undefined) update.rag_max_chars = patch.rag_max_chars;
  if (patch.history_max_messages !== undefined) update.history_max_messages = patch.history_max_messages;
  if (patch.profile_inject !== undefined) update.profile_inject = patch.profile_inject;
  if (patch.web_search_enabled !== undefined) update.web_search_enabled = patch.web_search_enabled;
  if (patch.web_search_min_rounds !== undefined) update.web_search_min_rounds = patch.web_search_min_rounds;
  if (patch.web_search_max_rounds !== undefined) update.web_search_max_rounds = patch.web_search_max_rounds;
  if (patch.web_search_max_per_round !== undefined) update.web_search_max_per_round = patch.web_search_max_per_round;
  if (patch.web_search_tavily_max_results !== undefined) {
    update.web_search_tavily_max_results = patch.web_search_tavily_max_results;
  }
  if (patch.web_search_result_max_chars !== undefined) {
    update.web_search_result_max_chars = patch.web_search_result_max_chars;
  }
  if (patch.web_search_snippet_max_chars !== undefined) {
    update.web_search_snippet_max_chars = patch.web_search_snippet_max_chars;
  }
  if (patch.max_completion_tokens !== undefined) update.max_completion_tokens = patch.max_completion_tokens;

  const { error } = await supa.from("ao_projects").update(update).eq("project_id", projectId);
  if (error) {
    console.error("[settings/ao-projects POST]", error.message);
    return NextResponse.json({ error: "保存に失敗しました", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
