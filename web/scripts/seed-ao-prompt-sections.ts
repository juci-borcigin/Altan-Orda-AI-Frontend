/**
 * Supabase `ao_prompt_sections` にコード既定（AO_PROMPT_DEFAULTS）を upsert。
 * 実行: cd web && npm run seed:prompts
 * 必要: .env に SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { AO_PROMPT_DEFAULTS, AO_PROMPT_SECTION_KEYS } from "../src/lib/ao-prompts";

function loadWebDotEnv() {
  const p = resolve(process.cwd(), ".env");
  if (!existsSync(p)) return;
  const raw = readFileSync(p, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined || process.env[k] === "") {
      process.env[k] = v;
    }
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

  const supa = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const section_key of AO_PROMPT_SECTION_KEYS) {
    const body = AO_PROMPT_DEFAULTS[section_key];
    const { error } = await supa.from("ao_prompt_sections").upsert(
      {
        section_key,
        body,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "section_key" },
    );
    if (error) {
      console.error(section_key, error.message);
      process.exit(1);
    }
    console.log("upsert", section_key);
  }
  console.log("done:", AO_PROMPT_SECTION_KEYS.length, "sections");
}

void main();
