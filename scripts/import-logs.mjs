#!/usr/bin/env node
/**
 * Step 6: 既存ログを Supabase に流し込む（初回一括用）
 *
 * 使い方:
 *   (リポジトリルートで) npm install
 *   export $(grep -v '^#' web/.env | xargs)   # または dotenv が web/.env を読む
 *   node scripts/import-logs.mjs --provider chatgpt --file ./conversations.json
 *
 *   --project-id 軍議ゲル | 執務ゲル | …（任意。未指定は gungi）
 *   --persona "耶律楚材"（任意。アダプタ既定あり）
 *   --dry-run  DB に書かず JSON を stdout のみ
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../web/.env") });

/** UI ラベル → ao-types ProjectId */
const GEL_TO_PROJECT = {
  執務ゲル: "shitsumu",
  軍議ゲル: "gungi",
  寝所ゲル: "nesho",
  クリルタイ: "kurultai",
  "トゥルイ・ウルス": "gemini",
  "オゴデイ・ウルス": "claude",
};

function parseArgs(argv) {
  const o = { dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") o.dryRun = true;
    else if (a === "--provider" && argv[i + 1]) {
      o.provider = argv[++i];
    } else if (a === "--file" && argv[i + 1]) {
      o.file = argv[++i];
    } else if (a === "--project-id" && argv[i + 1]) {
      o.projectIdLabel = argv[++i];
    } else if (a === "--persona" && argv[i + 1]) {
      o.persona = argv[++i];
    }
  }
  return o;
}

function linearizeChatGPT(data) {
  const mapping = data.mapping || {};
  const chain = [];
  let id = data.current_node;
  while (id && mapping[id]) {
    chain.push(mapping[id]);
    id = mapping[id].parent;
  }
  chain.reverse();
  const out = [];
  for (const node of chain) {
    const msg = node.message;
    if (!msg) continue;
    const role = msg.author?.role;
    if (role === "system" || role === "tool") continue;
    const parts = msg.content?.parts;
    let text = "";
    if (Array.isArray(parts)) {
      text = parts
        .map((p) => (typeof p === "string" ? p : JSON.stringify(p)))
        .join("\n\n");
    } else if (typeof msg.content?.text === "string") {
      text = msg.content.text;
    }
    if (!text.trim()) continue;
    out.push({
      role: role === "user" ? "user" : "assistant",
      text: text.trim(),
    });
  }
  return out;
}

function adaptChatGPT(raw, defaults) {
  const data = JSON.parse(raw);
  const turns = linearizeChatGPT(data);
  return { title: data.title || "ChatGPT import", turns, defaults };
}

function adaptClaude(raw, defaults) {
  const data = JSON.parse(raw);
  let msgs;
  if (Array.isArray(data.messages)) msgs = data.messages;
  else throw new Error("Claude: expected top-level messages[]");
  const turns = msgs.map((m) => ({
    role: m.role === "human" ? "user" : "assistant",
    text: typeof m.text === "string" ? m.text : String(m.content ?? ""),
  }));
  return { title: data.title || data.convId || "Claude import", turns, defaults };
}

function adaptGeminiHtml(raw, defaults) {
  const $ = cheerio.load(raw);
  const blobs = [];
  $("p, div").each((_, el) => {
    const t = $(el).text().trim();
    if (t.length > 2 && t.length < 20000) blobs.push(t);
  });
  const dedup = blobs.filter((t, i, a) => i === 0 || t !== a[i - 1]);
  const turns = dedup.slice(0, 500).map((text, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    text,
  }));
  return {
    title: "Gemini HTML import",
    turns,
    defaults,
  };
}

async function supabaseInsert(baseUrl, key, { title, projectId, turns, provider, modelId, persona }) {
  const hdr = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  const tr = await fetch(`${baseUrl}/rest/v1/threads`, {
    method: "POST",
    headers: hdr,
    body: JSON.stringify({
      title,
      project_id: projectId,
    }),
  });
  const trText = await tr.text();
  if (!tr.ok) throw new Error(`threads insert ${tr.status}: ${trText.slice(0, 400)}`);
  const [threadRow] = JSON.parse(trText);
  const threadId = threadRow.id;

  for (const row of turns) {
    const r = await fetch(`${baseUrl}/rest/v1/messages`, {
      method: "POST",
      headers: hdr,
      body: JSON.stringify({
        thread_id: threadId,
        role: row.role,
        text: row.text,
        persona: row.role === "assistant" ? persona : null,
        provider,
        model_id: modelId,
      }),
    });
    const rt = await r.text();
    if (!r.ok) throw new Error(`messages insert ${r.status}: ${rt.slice(0, 400)}`);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.provider || !args.file) {
    console.error(
      "Usage: node scripts/import-logs.mjs --provider chatgpt|claude|gemini --file path [--project-id 軍議ゲル] [--persona 耶律楚材] [--dry-run]",
    );
    process.exit(1);
  }

  const baseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!args.dryRun && (!baseUrl || !key)) {
    throw new Error("web/.env に SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要です");
  }

  const raw = fs.readFileSync(path.resolve(args.file), "utf8");
  const projectId =
    GEL_TO_PROJECT[args.projectIdLabel] ||
    (args.projectIdLabel && GEL_TO_PROJECT[args.projectIdLabel.trim()]) ||
    "gungi";

  let pack;
  const defChatgpt = {
    provider: "openrouter",
    modelId: "openai/gpt-4.1-mini",
    persona: args.persona || "耶律楚材",
  };
  const defClaude = {
    provider: "openrouter",
    modelId: "anthropic/claude-sonnet-4.5",
    persona: args.persona || "耶律楚材",
  };
  const defGemini = {
    provider: "openrouter",
    modelId: "google/gemini-2.5-flash",
    persona: args.persona || "ソルコクタニ",
  };

  if (args.provider === "chatgpt") pack = adaptChatGPT(raw, defChatgpt);
  else if (args.provider === "claude") pack = adaptClaude(raw, defClaude);
  else if (args.provider === "gemini") pack = adaptGeminiHtml(raw, defGemini);
  else throw new Error(`Unknown provider: ${args.provider}`);

  const { title, turns } = pack;
  const defaults = pack.defaults;

  if (args.dryRun) {
    console.log(JSON.stringify({ projectId, title, count: turns.length, sample: turns.slice(0, 3) }, null, 2));
    return;
  }

  await supabaseInsert(baseUrl, key, {
    title,
    projectId,
    turns,
    provider: defaults.provider,
    modelId: defaults.modelId,
    persona: defaults.persona,
  });
  console.error("Import OK:", title, "messages:", turns.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
