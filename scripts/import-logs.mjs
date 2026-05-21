#!/usr/bin/env node
/**
 * Step 6: 既存ログを Supabase に流し込む（初回一括・手元ファイルのみ）
 *
 * 使い方（リポジトリルート）:
 *   npm install
 *   node scripts/import-logs.mjs --provider chatgpt --file ./conversations.json
 *   node scripts/import-logs.mjs --provider claude --file ./conversations.json [--facet chat]
 *   node scripts/import-logs.mjs --provider gemini-activity --file ./マイアクティビティ.json
 *   （Gemini: titleUrl で会話をまとめ、details / userInteractions から全ターンを復元）
 *   node scripts/import-logs.mjs --provider gemini --file ./gems.html
 *   node scripts/import-logs.mjs --provider nblm --file ./NotebookLM\ Conversation.json
 *   （nblm は既定で project_id=study, source_facet=study。--facet で上書き可）
 *
 *   --project-id 軍議ゲル | オゴデイ・ウルス | gemini | claude | study | …（任意）
 *   --facet do|feel|think|chat|study（Claude 一括は do〜chat、NotebookLM 等は study。会話ごとの推定は未実装）
 *   --dry-run  DB に書かず JSON を stdout のみ
 *   --dry-run-limit N  dry-run 時に先頭 N スレッドだけ詳細を出す（既定 40）
 *   --max-threads N  先頭 N スレッドだけ取り込む（本番のスモーク用）
 *
 *   上書き: source_native_id と source_provider が両方あるパックは、同キーの既存 ao_threads を
 *   DELETE（ao_messages は CASCADE）してから再挿入する（再実行で二重化しない。手動変更は消える）。
 *
 * ChatGPT エクスポート:
 *   conversations.json は「会話オブジェクト 1 本」または「会話オブジェクトの配列」のどちらにも対応。
 *   各会話は { title, mapping, current_node, ... } で、メッセージは mapping[id] のツリー（parent / children）。
 *   画像等の非文字列 parts はこの版では取り込まない（本文に混ぜない）。
 *   参考: https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../web/.env") });
dotenv.config({ path: path.join(__dirname, "../web/.env.local") });

/** UI ラベル → ao-types ProjectId（Supabase ao_threads.project_id と一致） */
const GEL_TO_PROJECT = {
  執務ゲル: "plan",
  軍議ゲル: "work",
  寝所ゲル: "mental",
  クリルタイ: "debate",
  "トゥルイ・ウルス": "gemini",
  "オゴデイ・ウルス": "claude",
};

const RAW_PROJECT_IDS = new Set([
  "debate",
  "chat",
  "plan",
  "work",
  "mental",
  "notebook",
  "foreign",
  "gemini",
  "chatgpt",
  "claude",
]);

function normalizeImportProjectId(id) {
  if (id === "talk") return "chat";
  if (id === "study") return "notebook";
  return id;
}

const NBLM_DEFAULT_THREAD_TITLE = "ジュチとGolden Horde (NotebookLM)";

const FACETS = new Set(["do", "feel", "think", "chat", "study"]);

function parseArgs(argv) {
  const o = { dryRun: false, dryRunLimit: 40 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") o.dryRun = true;
    else if (a === "--provider" && argv[i + 1]) o.provider = argv[++i];
    else if (a === "--file" && argv[i + 1]) o.file = argv[++i];
    else if (a === "--project-id" && argv[i + 1]) o.projectIdLabel = argv[++i];
    else if (a === "--persona" && argv[i + 1]) o.persona = argv[++i];
    else if (a === "--facet" && argv[i + 1]) o.facet = argv[++i];
    else if (a === "--dry-run-limit" && argv[i + 1]) o.dryRunLimit = Number(argv[++i], 10) || 40;
    else if (a === "--max-threads" && argv[i + 1]) {
      const n = Number(argv[++i], 10);
      if (!Number.isFinite(n) || n < 1) throw new Error("--max-threads には 1 以上の整数を指定してください");
      o.maxThreads = n;
    }
  }
  return o;
}

/** 取り込み専用の任意 project_id（Supabase ao_threads.project_id は text。UI の ProjectId 外も可） */
function isCustomImportProjectId(t) {
  if (t.length < 1 || t.length > 64) return false;
  return /^[a-zA-Z0-9_-]+$/.test(t);
}

function resolveProjectId(label, provider) {
  if (label) {
    const t = label.trim();
    if (RAW_PROJECT_IDS.has(t)) return t;
    const legacy = normalizeImportProjectId(t);
    if (RAW_PROJECT_IDS.has(legacy)) return legacy;
    const mapped = GEL_TO_PROJECT[t];
    if (mapped) return normalizeImportProjectId(mapped);
    if (isCustomImportProjectId(t)) return t;
  }
  if (provider === "claude") return "claude";
  if (provider === "gemini-activity") return "gemini";
  if (provider === "chatgpt") return "chatgpt";
  if (provider === "nblm" || provider === "notebooklm") return "notebook";
  return "work";
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
      const bits = parts
        .map((p) => (typeof p === "string" ? p : ""))
        .filter((s) => s.length > 0);
      text = bits.join("\n\n");
    } else if (typeof msg.content?.text === "string") {
      text = msg.content.text;
    }
    if (!text.trim()) continue;
    out.push({
      role: role === "user" ? "user" : "assistant",
      text: text.trim(),
      raw: { node },
    });
  }
  return out;
}

/** 会話オブジェクト 1 件 → import パック（--facet を source_facet に反映） */
function adaptChatGPTConversationObject(data, defaults, sourceFacet) {
  const turns = linearizeChatGPT(data);
  const native =
    data.id != null
      ? String(data.id)
      : data.conversation_id != null
        ? String(data.conversation_id)
        : null;
  return {
    title: String((typeof data.title === "string" && data.title.trim()) || "ChatGPT import").slice(0, 500),
    turns,
    defaults,
    sourceFacet,
    sourceNativeId: native,
    sourceProvider: "chatgpt",
    persona: defaults.persona,
    threadUpdatedAtIso: isoFromUnknown(data.update_time ?? data.updated_at),
  };
}

function adaptChatGPTFromFileRaw(raw, defaults, sourceFacet) {
  const data = JSON.parse(raw);
  if (Array.isArray(data)) {
    return data
      .filter((c) => c && typeof c === "object" && c.mapping && Object.keys(c.mapping).length > 0)
      .map((c) => adaptChatGPTConversationObject(c, defaults, sourceFacet));
  }
  return [adaptChatGPTConversationObject(data, defaults, sourceFacet)];
}

/** Claude 公式エクスポートの 1 メッセージ → user/assistant ターン（本文は thinking 以外を結合） */
function claudeExportMessageToTurn(msg) {
  const raw = msg;
  const pieces = [];
  const top = typeof msg.text === "string" ? msg.text.trim() : "";
  if (top) pieces.push(top);
  if (Array.isArray(msg.content)) {
    for (const block of msg.content) {
      if (!block || typeof block !== "object") continue;
      if (block.type === "thinking") continue;
      if (block.type === "text" && typeof block.text === "string" && block.text.trim()) {
        pieces.push(block.text.trim());
      }
    }
  }
  const text = pieces.join("\n\n").trim();
  if (!text) return null;
  const role = msg.sender === "human" ? "user" : "assistant";
  return { role, text, raw: raw };
}

/** Claude エクスポートの会話 1 件 */
function adaptClaudeExportConversation(conv, sourceFacet) {
  const msgs = conv.chat_messages || [];
  const turns = [];
  for (const m of msgs) {
    const t = claudeExportMessageToTurn(m);
    if (t) turns.push(t);
  }
  const title =
    (typeof conv.name === "string" && conv.name.trim()) ||
    (typeof conv.summary === "string" && conv.summary.trim().slice(0, 80)) ||
    conv.uuid ||
    "Claude import";
  return {
    title: String(title).slice(0, 500),
    turns,
    sourceFacet,
    sourceNativeId: conv.uuid != null ? String(conv.uuid) : null,
    sourceProvider: "claude",
    persona: null,
    threadUpdatedAtIso: isoFromUnknown(conv.updated_at),
  };
}

/** ISO 8601 文字列または数値 ms から DB 用 ISO（無ければ null） */
function isoFromUnknown(v) {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return new Date(v).toISOString();
  if (typeof v === "string" && v.trim()) {
    const d = Date.parse(v.trim());
    if (!Number.isNaN(d)) return new Date(d).toISOString();
  }
  return null;
}

/** NotebookLM エクスポート 1 メッセージの並び替え用時刻（ms） */
function nblmMessageTimeMs(m) {
  if (typeof m.updated_at === "number" && Number.isFinite(m.updated_at)) return m.updated_at;
  const iso = m.created_at;
  if (typeof iso === "string" && iso.trim()) {
    const t = Date.parse(iso.trim());
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

function nblmExtractText(m) {
  const parts = Array.isArray(m.contents) ? m.contents : [];
  const bits = [];
  for (const c of parts) {
    if (!c || typeof c !== "object") continue;
    if (c.type === "text" && typeof c.content === "string" && c.content.trim()) bits.push(c.content.trim());
  }
  return bits.join("\n\n").trim();
}

/**
 * NotebookLM の「NotebookLM Conversation.json」
 * - chatGroupId ごとに 1 ao_threads
 * - id が *_summary の assistant を先頭に、その他は created_at / updated_at 相当で時系列
 */
function adaptNotebookLmAll(raw, sourceFacet, fixedTitle = NBLM_DEFAULT_THREAD_TITLE) {
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error("NotebookLM: トップレベルはメッセージの配列を想定します");
  /** @type {Map<string, object[]>} */
  const byGroup = new Map();
  for (const m of data) {
    if (!m || typeof m !== "object") continue;
    const gid = m.chatGroupId != null ? String(m.chatGroupId).trim() : "";
    if (!gid) continue;
    const arr = byGroup.get(gid) ?? [];
    arr.push(m);
    byGroup.set(gid, arr);
  }
  const packs = [];
  const multi = byGroup.size > 1;
  for (const [chatGroupId, msgs] of byGroup) {
    const summaryMsgs = msgs.filter(
      (m) =>
        typeof m.id === "string" &&
        m.id.endsWith("_summary") &&
        String(m.role || "").toLowerCase() === "assistant",
    );
    const rest = msgs.filter((m) => !summaryMsgs.includes(m));
    rest.sort((a, b) => nblmMessageTimeMs(a) - nblmMessageTimeMs(b));

    const turns = [];
    for (const sm of summaryMsgs) {
      const text = nblmExtractText(sm);
      if (text) turns.push({ role: "assistant", text, raw: sm });
    }
    for (const m of rest) {
      const role = String(m.role || "").toLowerCase();
      if (role !== "user" && role !== "assistant") continue;
      const text = nblmExtractText(m);
      if (!text) continue;
      turns.push({ role, text, raw: m });
    }

    const titleBase = String(fixedTitle || NBLM_DEFAULT_THREAD_TITLE).slice(0, 500);
    const title = multi ? `${titleBase} (${chatGroupId.slice(0, 8)})`.slice(0, 500) : titleBase;
    const maxMs = msgs.length ? Math.max(...msgs.map(nblmMessageTimeMs)) : 0;
    packs.push({
      title,
      turns,
      sourceFacet,
      sourceNativeId: chatGroupId,
      sourceProvider: "nblm",
      persona: null,
      threadUpdatedAtIso: maxMs > 0 ? new Date(maxMs).toISOString() : null,
    });
  }
  return packs.filter((p) => p.turns.length > 0);
}

/** 旧形式 { messages: [{ role: human }] } */
function adaptClaudeLegacy(data, sourceFacet) {
  const msgs = data.messages;
  if (!Array.isArray(msgs)) throw new Error("Claude: expected messages[] or top-level conversations[]");
  const turns = msgs
    .map((m) => {
      const role = m.role === "human" ? "user" : "assistant";
      const text =
        typeof m.text === "string" ? m.text.trim() : String(m.content ?? "").trim();
      if (!text) return null;
      return { role, text, raw: m };
    })
    .filter(Boolean);
  return {
    title: data.title || data.convId || "Claude import",
    turns,
    sourceFacet,
    sourceNativeId: data.uuid != null ? String(data.uuid) : null,
    sourceProvider: "claude",
    persona: null,
    threadUpdatedAtIso: isoFromUnknown(data.updated_at),
  };
}

function htmlToPlain(html) {
  if (!html || typeof html !== "string") return "";
  const $ = cheerio.load(html);
  return $.root()
    .text()
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** subtitles の Gem 行から Do/Feel/Think/Chat */
function geminiFacetFromSubtitles(subtitles) {
  const line =
    (subtitles || []).find((s) => s.name && s.name.includes("がこのチャットで使用"))?.name || "";
  if (!line) return "chat";
  if (line.includes("将軍 スブタイ")) return "chat";
  if (line.includes("護衛 バイジュ") || line.includes("侍衛 バイジュ")) return "feel";
  if (line.includes("宰相 フナン")) return "think";
  if (line.includes("将軍 モンケウール")) return "do";
  return "chat";
}

function geminiAssistantPersona(subtitles) {
  const line =
    (subtitles || []).find((s) => s.name && s.name.includes("がこのチャットで使用"))?.name || "";
  const name = line.replace(/ がこのチャットで使用.*/, "").trim();
  return name || "ソルコクタニ";
}

/**
 * Google Takeout「マイアクティビティ.json」（Gemini Apps・JSON）
 *
 * - 形式は「アクティビティログ」: 原則 1 行 ≒ 1 往復。公式 UI 左サイドバーの「会話名」専用列は
 *   エクスポートに無いことが多く、会話名は title の非定型値か、先頭ユーザ発話からの推定になる。
 * - 同一会話は titleUrl（…/app/c/<conversation_id>）でグループ化し、時刻順にターンを連結する。
 * - 本文は details[]（Request/Response）または userInteractions を優先し、無ければ従来の safeHtmlItem+title。
 */
function geminiConversationIdFromRow(row, rowIndex) {
  const u = row.titleUrl || row.titleURL || "";
  if (typeof u === "string") {
    const m = u.match(/\/app\/c\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
  }
  return `orphan-${rowIndex}`;
}

function parseGeminiDetailsTurns(row) {
  const d = row.details;
  if (!Array.isArray(d)) return null;
  const turns = [];
  for (const item of d) {
    if (!item || typeof item !== "object") continue;
    const name = String(item.name || "").trim();
    const value = typeof item.value === "string" ? item.value.trim() : "";
    if (!value) continue;
    const nl = name.toLowerCase();
    if (nl === "request" || nl === "リクエスト" || name.includes("リクエスト")) {
      turns.push({ role: "user", text: value, raw: { detail: item } });
    } else if (nl === "response" || nl === "レスポンス" || name.includes("レスポンス")) {
      turns.push({ role: "assistant", text: value, raw: { detail: item } });
    }
  }
  return turns.length ? turns : null;
}

function extractTextFromGeminiInteractionJson(node, depth = 0) {
  if (depth > 14 || node == null) return "";
  if (typeof node === "string") return node.trim();
  if (Array.isArray(node)) {
    return node
      .map((x) => extractTextFromGeminiInteractionJson(x, depth + 1))
      .filter(Boolean)
      .join("\n\n");
  }
  if (typeof node === "object") {
    if (typeof node.text === "string" && node.text.trim()) return node.text.trim();
    if (typeof node.content === "string" && node.content.trim()) return node.content.trim();
    if (typeof node.prompt === "string" && node.prompt.trim()) return node.prompt.trim();
    const pieces = [];
    for (const v of Object.values(node)) {
      if (v === node) continue;
      const t = extractTextFromGeminiInteractionJson(v, depth + 1);
      if (t) pieces.push(t);
    }
    return pieces.join("\n\n");
  }
  return "";
}

function parseGeminiUserInteractionsTurns(row) {
  const arr = row.userInteractions;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const turns = [];
  for (let i = 0; i < arr.length; i++) {
    const wrap = arr[i];
    const ui = wrap?.userInteraction ?? wrap?.user_interaction;
    if (!ui || typeof ui !== "object") continue;
    for (const key of ["request", "response"]) {
      const raw = ui[key];
      if (typeof raw !== "string" || !raw.trim()) continue;
      let text = "";
      try {
        const parsed = JSON.parse(raw);
        text = extractTextFromGeminiInteractionJson(parsed);
      } catch {
        text = raw.trim();
      }
      if (!text) continue;
      turns.push({
        role: key === "request" ? "user" : "assistant",
        text: String(text).trim(),
        raw: { userInteraction: key, index: i },
      });
    }
  }
  return turns.length ? turns : null;
}

/** safeHtmlItem + activity title（従来ロジック） */
function parseGeminiSafeHtmlTitleTurns(row) {
  const facet = geminiFacetFromSubtitles(row.subtitles);
  let userText = (row.title || "").trim();
  if (userText.startsWith("送信したメッセージ: ")) {
    userText = userText.slice("送信したメッセージ: ".length).trim();
  }
  const htmlParts = (row.safeHtmlItem || []).map((x) => x?.html).filter(Boolean);
  const assistantText = htmlParts.map(htmlToPlain).filter(Boolean).join("\n\n").trim();
  const turns = [];
  if (userText) turns.push({ role: "user", text: userText, raw: { title: row.title, time: row.time } });
  if (assistantText) {
    turns.push({
      role: "assistant",
      text: assistantText,
      raw: { safeHtmlItem: row.safeHtmlItem, time: row.time },
    });
  }
  return turns.length ? turns : null;
}

function parseGeminiActivityRowTurns(row) {
  return (
    parseGeminiDetailsTurns(row) ||
    parseGeminiUserInteractionsTurns(row) ||
    parseGeminiSafeHtmlTitleTurns(row)
  );
}

function isGeminiActivityBoilerplateTitle(t) {
  const s = (t || "").trim();
  if (!s) return true;
  if (s.length > 220) return true;
  if (/^used gemini apps$/i.test(s)) return true;
  if (/^gemini$/i.test(s)) return true;
  if (/gemini\s*apps?\s*を使用/i.test(s)) return true;
  if (/used\s+gemini/i.test(s)) return true;
  return false;
}

function pickGeminiThreadTitle(segments, mergedTurns) {
  for (const seg of segments) {
    const t = (seg.activityTitle || "").trim();
    if (t && !isGeminiActivityBoilerplateTitle(t)) return String(t).slice(0, 500);
  }
  const firstUser = mergedTurns.find((x) => x.role === "user");
  if (firstUser?.text) {
    const oneLine = String(firstUser.text).replace(/\s+/g, " ").trim();
    return oneLine.slice(0, 500);
  }
  return "Gemini import";
}

function dedupeAdjacentTurns(turns) {
  const out = [];
  for (const t of turns) {
    const prev = out[out.length - 1];
    if (prev && prev.role === t.role && prev.text === t.text) continue;
    out.push(t);
  }
  return out;
}

function adaptGeminiActivityAll(raw) {
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error("Gemini activity: expected top-level array");

  /** @type {Map<string, Array<{ time: string, turns: object[], facet: string, activityTitle: string, subtitles: unknown }>>} */
  const groups = new Map();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const turns = parseGeminiActivityRowTurns(row);
    if (!turns || turns.length === 0) continue;

    const convId = geminiConversationIdFromRow(row, i);
    const time = typeof row.time === "string" ? row.time : String(row.time ?? "");
    const facet = geminiFacetFromSubtitles(row.subtitles);
    const activityTitle = typeof row.title === "string" ? row.title : "";

    const arr = groups.get(convId) ?? [];
    arr.push({ time, turns, facet, activityTitle, subtitles: row.subtitles });
    groups.set(convId, arr);
  }

  const packs = [];
  for (const [convId, segments] of groups) {
    segments.sort((a, b) => String(a.time).localeCompare(String(b.time)));

    const merged = [];
    for (const seg of segments) {
      for (const t of seg.turns) merged.push(t);
    }
    const mergedTurns = dedupeAdjacentTurns(merged);
    if (mergedTurns.length === 0) continue;

    const lastSub = segments[segments.length - 1]?.subtitles;
    const persona = geminiAssistantPersona(lastSub);
    const sourceFacet = segments[0]?.facet || "chat";

    const title = pickGeminiThreadTitle(segments, mergedTurns);
    const sourceNativeId = convId.startsWith("orphan-")
      ? `gem-${crypto.createHash("sha256").update(`${convId}\n${segments[0]?.time || ""}`).digest("hex").slice(0, 24)}`
      : `gem-c-${convId}`;

    packs.push({
      title,
      turns: mergedTurns,
      sourceFacet,
      sourceNativeId,
      sourceProvider: "gemini",
      persona,
      threadUpdatedAtIso: isoFromUnknown(segments[segments.length - 1]?.time),
    });
  }
  return packs;
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
    raw: null,
  }));
  return [
    {
      title: "Gemini HTML import",
      turns,
      sourceFacet: "chat",
      sourceNativeId: null,
      sourceProvider: "gemini",
      persona: null,
      threadUpdatedAtIso: null,
      defaults,
    },
  ];
}

function adaptClaudeExportAll(raw, sourceFacet) {
  const data = JSON.parse(raw);
  if (Array.isArray(data)) {
    return data
      .map((conv) => adaptClaudeExportConversation(conv, sourceFacet))
      .filter((p) => p.turns.length > 0);
  }
  return [adaptClaudeLegacy(data, sourceFacet)].filter((p) => p.turns.length > 0);
}

async function supabaseDeleteThreadsByNative(baseUrl, key, sourceProvider, sourceNativeId) {
  const sp = String(sourceProvider).trim();
  const nid = String(sourceNativeId).trim();
  if (!sp || !nid) return;
  const enc = encodeURIComponent;
  const url = `${baseUrl}/rest/v1/ao_threads?source_provider=eq.${enc(sp)}&source_native_id=eq.${enc(nid)}`;
  const r = await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=minimal",
    },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`ao_threads delete ${r.status}: ${t.slice(0, 400)}`);
  }
}

/**
 * ao_threads + ao_messages を投入。source_native_id と source_provider が両方あるときは
 * 同キーの既存 ao_threads を先に DELETE（ao_messages は CASCADE）してから挿入する。
 */
async function supabaseImportPack(
  baseUrl,
  key,
  {
    title,
    projectId,
    turns,
    provider,
    modelId,
    persona,
    sourceFacet,
    sourceProvider,
    sourceNativeId,
    threadUpdatedAtIso,
  },
) {
  const hdr = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  const native = sourceNativeId != null ? String(sourceNativeId).trim() : "";
  const sp = sourceProvider != null ? String(sourceProvider).trim() : "";
  if (native && sp) {
    await supabaseDeleteThreadsByNative(baseUrl, key, sp, native);
  }

  const threadBody = {
    title,
    project_id: projectId,
    source_facet: sourceFacet,
    source_provider: sourceProvider,
    source_native_id: native || null,
  };
  if (threadUpdatedAtIso) threadBody.updated_at = threadUpdatedAtIso;

  const tr = await fetch(`${baseUrl}/rest/v1/ao_threads`, {
    method: "POST",
    headers: hdr,
    body: JSON.stringify(threadBody),
  });
  const trText = await tr.text();
  if (!tr.ok) throw new Error(`ao_threads insert ${tr.status}: ${trText.slice(0, 400)}`);
  const [threadRow] = JSON.parse(trText);
  const threadId = threadRow.id;

  for (const row of turns) {
    const r = await fetch(`${baseUrl}/rest/v1/ao_messages`, {
      method: "POST",
      headers: hdr,
      body: JSON.stringify({
        thread_id: threadId,
        role: row.role,
        text: row.text,
        persona: row.role === "assistant" ? persona : null,
        provider,
        model_id: modelId,
        raw_response: row.raw != null ? row.raw : null,
      }),
    });
    const rt = await r.text();
    if (!r.ok) throw new Error(`ao_messages insert ${r.status}: ${rt.slice(0, 400)}`);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.provider) {
    args.provider = String(args.provider).trim().toLowerCase();
    if (args.provider === "notebooklm") args.provider = "nblm";
  }
  if (!args.provider || !args.file) {
    console.error(
      "Usage: node scripts/import-logs.mjs --provider chatgpt|claude|gemini|gemini-activity|nblm --file path [options]\n" +
        "  --project-id ラベル  --facet do|feel|think|chat|study  --persona 名前  --dry-run  --dry-run-limit N  --max-threads N",
    );
    process.exit(1);
  }

  const baseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!args.dryRun && (!baseUrl || !key)) {
    throw new Error("web/.env または web/.env.local に SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要です");
  }

  const raw = fs.readFileSync(path.resolve(args.file), "utf8");
  const projectId = resolveProjectId(args.projectIdLabel, args.provider);

  let facet = (args.facet || (args.provider === "nblm" ? "study" : "chat")).toLowerCase().trim();
  if (!FACETS.has(facet)) {
    throw new Error(`--facet は do|feel|think|chat|study のいずれかにしてください: ${args.facet}`);
  }

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
  const defNblm = {
    provider: "nblm",
    modelId: "notebooklm",
    persona: args.persona || "タタ・トゥンガ",
  };

  /** @type {Array<object>} */
  let packs;

  if (args.provider === "chatgpt") {
    packs = adaptChatGPTFromFileRaw(raw, defChatgpt, facet).map((p) => ({
      ...p,
      defaults: defChatgpt,
      persona: p.persona ?? defChatgpt.persona,
    }));
  } else if (args.provider === "claude") {
    packs = adaptClaudeExportAll(raw, facet).map((p) => ({
      ...p,
      defaults: defClaude,
      persona: p.persona ?? defClaude.persona,
    }));
  } else if (args.provider === "gemini-activity") {
    packs = adaptGeminiActivityAll(raw).map((p) => ({
      ...p,
      defaults: defGemini,
      persona: p.persona || defGemini.persona,
    }));
  } else if (args.provider === "gemini") {
    packs = adaptGeminiHtml(raw, defGemini).map((p) => ({
      ...p,
      defaults: defGemini,
      persona: p.persona || defGemini.persona,
    }));
  } else if (args.provider === "nblm") {
    packs = adaptNotebookLmAll(raw, facet).map((p) => ({
      ...p,
      defaults: defNblm,
      persona: p.persona ?? defNblm.persona,
    }));
  } else throw new Error(`Unknown provider: ${args.provider}`);

  for (const p of packs) {
    p.turns.forEach((t) => {
      t.text = String(t.text || "").trim();
    });
    p.turns = p.turns.filter((t) => t.text.length > 0);
  }
  const nonEmpty = packs.filter((p) => p.turns.length > 0);
  if (nonEmpty.length === 0) {
    throw new Error("取り込み対象のメッセージがありません（全スレッド空）");
  }
  packs = nonEmpty;

  if (args.maxThreads != null && args.maxThreads < packs.length) {
    console.log(
      `[import-logs] --max-threads ${args.maxThreads}: 先頭 ${args.maxThreads} スレッドのみ（全 ${packs.length} 中）。source_native_id がある場合は再実行で同キーを上書きします。`,
    );
    packs = packs.slice(0, args.maxThreads);
  }

  const absFile = path.resolve(args.file);
  console.log(
    `[import-logs] start provider=${args.provider} project_id=${projectId} threads=${packs.length} file=${absFile}`,
  );

  if (args.dryRun) {
    const lim = Math.max(1, args.dryRunLimit || 40);
    const shown = packs.slice(0, lim);
    const out = {
      projectId,
      totalThreads: packs.length,
      dryRunLimit: lim,
      shownThreads: shown.length,
      totalMessages: packs.reduce((a, p) => a + p.turns.length, 0),
      threads: shown.map((p) => ({
        title: p.title,
        source_facet: p.sourceFacet,
        source_provider: p.sourceProvider,
        source_native_id: p.sourceNativeId,
        messageCount: p.turns.length,
        assistantPersona: p.persona,
        sample: p.turns.slice(0, 2).map((t) => ({
          role: t.role,
          textPreview: t.text.slice(0, 240),
          hasRaw: t.raw != null,
        })),
      })),
    };
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  const total = packs.length;
  for (let i = 0; i < packs.length; i++) {
    const pack = packs[i];
    const n = i + 1;
    const titleShort = pack.title.length > 100 ? `${pack.title.slice(0, 100)}…` : pack.title;
    console.log(`[import-logs] (${n}/${total}) importing… ${titleShort}`);
    await supabaseImportPack(baseUrl, key, {
      title: pack.title,
      projectId,
      turns: pack.turns,
      provider: pack.defaults.provider,
      modelId: pack.defaults.modelId,
      persona: pack.persona,
      sourceFacet: pack.sourceFacet,
      sourceProvider: pack.sourceProvider,
      sourceNativeId: pack.sourceNativeId,
      threadUpdatedAtIso: pack.threadUpdatedAtIso ?? null,
    });
    console.log(`[import-logs] (${n}/${total}) Import OK messages=${pack.turns.length} | ${pack.title}`);
  }
  console.log(`[import-logs] done ${total} thread(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
