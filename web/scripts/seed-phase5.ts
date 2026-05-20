/**
 * Phase 5: ao_glossary, maps, system_template, flat global.* sections
 * 実行: cd web && npm run seed:phase5
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import {
  PHASE5_GLOSSARY_SEED,
  PHASE5_MODE_TRIGGERS,
  PHASE5_PERSONA_ALIAS_BY_KEY,
  PHASE5_PERSONA_AVATAR,
} from "../src/lib/phase5/phase5-data";
import { aoProjectUpsertPayload, personaRowsFromVariables, projectRowsFromVariables } from "../src/lib/phase5/ao-projects";
import { parseVariablesFile } from "../src/lib/phase5/parse-variables";
import { extractPhase5TemplateBody } from "../src/lib/phase5/phase5-template";

const PM_PHASE5 = resolve(
  process.cwd(),
  "../../Project Management/Altan-Orda-AI-Frontend/Resorces/Docs/Phase 5",
);

function loadWebDotEnv() {
  const p = resolve(process.cwd(), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

async function main() {
  loadWebDotEnv();
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です（web/.env）。");
    process.exit(1);
  }

  const supa = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const glossaryPath = resolve(PM_PHASE5, "AO_Phase5_Glossary.txt");
  const glossaryRows = existsSync(glossaryPath)
    ? parseGlossaryFile(glossaryPath)
    : PHASE5_GLOSSARY_SEED;

  const { error: gErr } = await supa.from("ao_glossary").upsert(glossaryRows, { onConflict: "ao_term" });
  if (gErr) {
    console.error("ao_glossary", gErr.message);
    process.exit(1);
  }
  console.log("ao_glossary", glossaryRows.length);

  const avatarByPersonaKey = Object.fromEntries(
    PHASE5_PERSONA_AVATAR.map((a) => [a.persona_key, a.avatar_path]),
  );

  for (const row of PHASE5_MODE_TRIGGERS) {
    const { error } = await supa.from("ao_mode_triggers").upsert(
      { ...row, updated_at: new Date().toISOString() },
      { onConflict: "mode_key" },
    );
    if (error) {
      console.error("ao_mode_triggers", row.mode_key, error.message);
      process.exit(1);
    }
  }
  console.log("ao_mode_triggers", PHASE5_MODE_TRIGGERS.length);

  const templatePath = existsSync(resolve(process.cwd(), "../docs/phase5/master/AO_Phase5_System Prompt Template.txt"))
    ? resolve(process.cwd(), "../docs/phase5/master/AO_Phase5_System Prompt Template.txt")
    : resolve(PM_PHASE5, "AO_Phase5_System Prompt Template.txt");
  const variablesPath = resolve(PM_PHASE5, "AO_Phase5_Variables.txt");
  if (existsSync(templatePath)) {
    const body = extractPhase5TemplateBody(readFileSync(templatePath, "utf8"));
    const { error } = await supa.from("ao_prompt_sections").upsert(
      { section_key: "system_template", body, updated_at: new Date().toISOString() },
      { onConflict: "section_key" },
    );
    if (error) console.warn("system_template (ao_prompt_sections may need key in app):", error.message);
    else console.log("system_template upserted");
  }

  if (existsSync(variablesPath)) {
    const vars = parseVariablesFile(variablesPath);

    for (const row of projectRowsFromVariables(vars)) {
      const { error } = await supa
        .from("ao_projects")
        .upsert(aoProjectUpsertPayload(row), { onConflict: "project_id" });
      if (error) {
        console.error("ao_projects", row.project_id, error.message);
        process.exit(1);
      }
    }
    console.log("ao_projects", projectRowsFromVariables(vars).length);

    for (const row of personaRowsFromVariables(vars)) {
      const alias =
        row.alias?.trim() || PHASE5_PERSONA_ALIAS_BY_KEY[row.persona_key]?.trim() || "";
      const { error } = await supa.from("ao_personas").upsert(
        {
          ...row,
          alias,
          avatar_path: avatarByPersonaKey[row.persona_key] ?? "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "persona_key" },
      );
      if (error) {
        console.error("ao_personas", row.persona_key, error.message);
        process.exit(1);
      }
    }
    console.log("ao_personas", personaRowsFromVariables(vars).length);
    const flatKeys: Array<{ key: string; body: string }> = [
      { key: "global.stage", body: vars.global.stage ?? "" },
      { key: "global.assistant", body: vars.global.assistant ?? "" },
      { key: "global.user", body: vars.global.user ?? "" },
      { key: "global.system", body: vars.global.system ?? "" },
      { key: "global.general", body: vars.global.general ?? "" },
      { key: "global.rules", body: vars.global.rules ?? "" },
      { key: "global.format", body: vars.global.format ?? "" },
      { key: "header.profile", body: vars.header.profile ?? "" },
    ];
    for (const { key, body } of flatKeys) {
      if (!body.trim()) continue;
      const { error } = await supa.from("ao_prompt_sections").upsert(
        { section_key: key, body, updated_at: new Date().toISOString() },
        { onConflict: "section_key" },
      );
      if (error) console.warn("ao_prompt_sections", key, error.message);
      else console.log("ao_prompt_sections", key);
    }
    for (const [mk, body] of Object.entries(vars.modes)) {
      if (!body.trim()) continue;
      const { error } = await supa.from("ao_prompt_sections").upsert(
        { section_key: mk, body, updated_at: new Date().toISOString() },
        { onConflict: "section_key" },
      );
      if (error) console.warn("mode section", mk, error.message);
      else console.log("ao_prompt_sections", mk);
    }
  }

  console.log("seed:phase5 done");
}

function parseGlossaryFile(path: string): Array<{ ao_term: string; general_term: string; sort_order: number }> {
  const raw = readFileSync(path, "utf8");
  const rows: Array<{ ao_term: string; general_term: string; sort_order: number }> = [];
  let order = 100;
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("-") === false) continue;
    const m = t.match(/^-\s*(.+?)：(.+)$/);
    if (!m) continue;
    const gen = m[2].trim();
    if (m[1].includes("AO用語") || m[1].includes("一般用語")) continue;
    for (const ao of m[1].split(/[、,]/).map((s) => s.trim()).filter(Boolean)) {
      rows.push({ ao_term: ao, general_term: gen, sort_order: order-- });
    }
  }
  return rows.length ? rows : PHASE5_GLOSSARY_SEED;
}

void main();
