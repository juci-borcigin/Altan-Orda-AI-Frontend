import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectId } from "@/lib/ao-types";
import { isProjectId } from "@/lib/ao-types";

/**
 * Supabase `ao_project_llm`。未設定・空はフォールバック（env の LLM_MODEL）。
 */
export async function loadProjectLlmModel(supa: SupabaseClient, projectId: ProjectId): Promise<string | null> {
  const { data, error } = await supa.from("ao_project_llm").select("model_id").eq("project_id", projectId).maybeSingle();
  if (error) {
    console.error("[ao-project-llm] load:", error.message);
    return null;
  }
  const m = typeof data?.model_id === "string" ? data.model_id.trim() : "";
  return m.length ? m : null;
}

export async function loadProjectLlmOverrides(supa: SupabaseClient): Promise<Partial<Record<ProjectId, string>>> {
  const { data, error } = await supa.from("ao_project_llm").select("project_id, model_id");
  if (error) {
    console.error("[ao-project-llm] load all:", error.message);
    return {};
  }
  const out: Partial<Record<ProjectId, string>> = {};
  for (const row of data ?? []) {
    const pid = typeof row.project_id === "string" ? row.project_id.trim() : "";
    const mid = typeof row.model_id === "string" ? row.model_id.trim() : "";
    if (!pid || !isProjectId(pid) || !mid) continue;
    out[pid] = mid;
  }
  return out;
}
