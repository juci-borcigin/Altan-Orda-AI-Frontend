import { NextResponse } from "next/server";
import { loadAoPromptOverrides } from "@/lib/ao-prompt-supabase";
import { loadProjectLlmOverrides } from "@/lib/ao-project-llm-supabase";
import {
  AO_PROMPT_DEFAULTS,
  AO_PROMPT_SECTION_KEYS,
  isAoPromptSectionKey,
  type AoPromptSectionKey,
} from "@/lib/ao-prompts";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isProjectId, type ProjectId } from "@/lib/ao-types";

function resolveEnvDefaultModel(): string {
  return (
    process.env.LLM_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-5.4-mini"
  );
}

/** 秘密は返さずホスト名のみ（設定 UI で「どの API に繋がっているか」表示用） */
function resolveLlmApiSummary(): { host: string; isOpenRouter: boolean } {
  const raw =
    process.env.LLM_API_BASE_URL?.trim() ||
    process.env.OPENAI_API_BASE_URL?.trim() ||
    "https://api.openai.com/v1";
  const normalized = raw.includes("://") ? raw : `https://${raw}`;
  let host = "";
  try {
    host = new URL(normalized).host;
  } catch {
    host = "";
  }
  return {
    host: host || "(ホストを解析できませんでした)",
    isOpenRouter: raw.toLowerCase().includes("openrouter"),
  };
}

/** GET: 編集用に既定と DB の実効値を返す（読み取りは Supabase 無しでも可） */
export async function GET() {
  const effective: Record<AoPromptSectionKey, string> = { ...AO_PROMPT_DEFAULTS };
  const supa = getSupabaseAdmin();
  if (supa) {
    try {
      const overrides = await loadAoPromptOverrides(supa);
      for (const key of AO_PROMPT_SECTION_KEYS) {
        const o = overrides[key];
        if (typeof o === "string" && o.trim()) effective[key] = o.trim();
      }
    } catch (e) {
      console.error("[settings/prompts GET] overrides", e);
    }
  }

  let projectModels: Partial<Record<ProjectId, string>> = {};
  if (supa) {
    try {
      projectModels = await loadProjectLlmOverrides(supa);
    } catch (e) {
      console.error("[settings/prompts GET] project llm", e);
    }
  }

  return NextResponse.json({
    sections: effective,
    defaults: AO_PROMPT_DEFAULTS,
    projectModels,
    envDefaultModel: resolveEnvDefaultModel(),
    llmApi: resolveLlmApiSummary(),
    supabaseConfigured: Boolean(supa),
  });
}

type PostBody = {
  sections?: Record<string, string>;
  projectModels?: Record<string, string>;
};

/** POST: ao_prompts / ao_projects.model_id を更新（要 Supabase サービスロール） */
export async function POST(req: Request) {
  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json(
      { error: "Supabase が未設定です（SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）。" },
      { status: 503 },
    );
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sections = body.sections && typeof body.sections === "object" ? body.sections : {};
  const projectModels =
    body.projectModels && typeof body.projectModels === "object" ? body.projectModels : {};

  const now = new Date().toISOString();

  for (const [rawKey, rawVal] of Object.entries(sections)) {
    if (!isAoPromptSectionKey(rawKey)) continue;
    const key = rawKey;
    const trimmed = typeof rawVal === "string" ? rawVal.trim() : "";
    const defTrim = AO_PROMPT_DEFAULTS[key].trim();

    if (!trimmed || trimmed === defTrim) {
      const { error } = await supa.from("ao_prompts").delete().eq("section_key", key);
      if (error) {
        console.error("[settings/prompts POST] delete section", key, error.message);
        return NextResponse.json({ error: `削除に失敗: ${key}`, detail: error.message }, { status: 500 });
      }
      continue;
    }

    const { error } = await supa.from("ao_prompts").upsert(
      { section_key: key, body: trimmed, updated_at: now },
      { onConflict: "section_key" },
    );
    if (error) {
      console.error("[settings/prompts POST] upsert section", key, error.message);
      return NextResponse.json({ error: `保存に失敗: ${key}`, detail: error.message }, { status: 500 });
    }
  }

  for (const [pid, rawMid] of Object.entries(projectModels)) {
    if (!isProjectId(pid)) continue;
    const mid = typeof rawMid === "string" ? rawMid.trim() : "";
    const { error } = await supa
      .from("ao_projects")
      .update({ model_id: mid, updated_at: now })
      .eq("project_id", pid);
    if (error) {
      console.error("[settings/prompts POST] upsert project llm", pid, error.message);
      return NextResponse.json(
        { error: `モデル設定の保存に失敗: ${pid}`, detail: error.message },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
