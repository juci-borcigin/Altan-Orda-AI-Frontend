/**
 * Phase 5: DB（ao_projects / ao_personas / ao_prompts）から組み立て済みSPサンプルを生成。
 *
 * 実行:
 *   cd web && npx tsx scripts/generate-phase5-sp-samples-from-db.ts
 *
 * 前提:
 * - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が利用可能（web/.env など）
 */

import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { assembleFromDbRows, type DbAssembleInput } from "../src/lib/phase5/assemble-sp-db";
import { systemTemplateBodyFromDb } from "../src/lib/phase5/phase5-template";

const OUT_REPO = resolve(process.cwd(), "../docs/phase5/sp-samples");

function env(k: string): string {
  const v = (process.env[k] ?? "").trim();
  if (!v) throw new Error(`Missing env: ${k}`);
  return v;
}

async function main() {
  // Load web/.env if present (dev convenience)
  const dotenvPath = resolve(process.cwd(), ".env");
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { config } = require("dotenv");
    config({ path: dotenvPath, override: false });
  } catch {
    // dotenv is optional; rely on existing env
  }

  const supa = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: sections, error: secErr } = await supa
    .from("ao_prompts")
    .select("section_key, body")
    .in("section_key", [
      "global.stage",
      "global.assistant",
      "global.user",
      "global.general",
      "global.rules",
      "global.format",
      "global.search",
      "header.profile",
    ]);
  if (secErr) throw new Error(`ao_prompts: ${secErr.message}`);

  const byKey = new Map<string, string>();
  for (const row of sections ?? []) byKey.set(row.section_key, row.body ?? "");

  const { data: projects, error: projErr } = await supa
    .from("ao_projects")
    .select("project_id, label_ja, main_persona_key, process, tone")
    .in("project_id", ["chat", "plan", "work"])
    .order("project_id", { ascending: true });
  if (projErr) throw new Error(`ao_projects: ${projErr.message}`);

  const { data: personas, error: perErr } = await supa
    .from("ao_personas")
    .select("persona_key, name, title, thinking, role, tone");
  if (perErr) throw new Error(`ao_personas: ${perErr.message}`);

  const { data: tmplRow, error: tmplErr } = await supa
    .from("ao_prompts")
    .select("body")
    .eq("section_key", "system_template")
    .maybeSingle();
  if (tmplErr) throw new Error(`system_template: ${tmplErr.message}`);
  const template = systemTemplateBodyFromDb(tmplRow?.body);

  const input: DbAssembleInput = {
    template,
    globals: {
      stage: byKey.get("global.stage") ?? "",
      assistant: byKey.get("global.assistant") ?? "",
      user: byKey.get("global.user") ?? "",
      general: byKey.get("global.general") ?? "",
      rules: byKey.get("global.rules") ?? "",
      format: byKey.get("global.format") ?? "",
      search: byKey.get("global.search") ?? "",
    },
    header: { profile: byKey.get("header.profile") ?? "" },
    projects: projects ?? [],
    personas: personas ?? [],
  };

  const sampleUser = "（サンプル）次の四半期で優先すべきプロジェクトの整理を、根拠付きで短く示してください。";
  const sampleRag =
    "## 関連する過去の議論\n（サンプル）過去スレッドより: プロジェクト優先度はリスクと殿下の承認タイミングで決まることが多い。";

  mkdirSync(OUT_REPO, { recursive: true });

  for (const proj of projects ?? []) {
    const sp = assembleFromDbRows({
      ...input,
      projectId: proj.project_id,
      userText: sampleUser,
      ragBlock: sampleRag,
      modeBlock: "",
      searchBlock: "",
      includeProfile: false,
      preThread: "",
    });

    const fileName =
      proj.project_id === "chat"
        ? "chat_project_chat.md"
        : proj.project_id === "plan"
          ? "plan_project_plan.md"
          : "work_project_work.md";

    const header = `# 組み立て SP サンプル: ${proj.label_ja ?? proj.project_id}

- project_id: \`${proj.project_id}\`
- 文字数: ${sp.length}
- source: Supabase（ao_projects / ao_personas / ao_prompts）

---

`;
    writeFileSync(resolve(OUT_REPO, fileName), header + sp, "utf8");
    // eslint-disable-next-line no-console
    console.log("wrote", fileName, sp.length);
  }
}

void main();

