#!/usr/bin/env node
/**
 * Claude エクスポート JSON（convId + messages[{role,text}]）を
 * altan-orda-thread-backup-v1 形式へ変換する。
 *
 * 使い方:
 *   node scripts/convert-claude-logs-to-ao-thread.mjs <入力ディレクトリ> [出力ディレクトリ]
 *
 * オプション:
 *   --provider=claude|gemini   projectId と AI 側 speaker（既定: claude）
 *
 * 例:
 *   node scripts/convert-claude-logs-to-ao-thread.mjs "../../Resorces/Temp Logs" "../../Resorces/Temp Logs/ao-thread-backups"
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { provider: "claude", dirs: [] };
  for (const a of argv) {
    if (a.startsWith("--provider=")) {
      const v = a.slice("--provider=".length).toLowerCase();
      if (v === "gemini" || v === "claude") out.provider = v;
      else {
        console.error(`不明な --provider: ${v}（claude または gemini）`);
        process.exit(1);
      }
    } else if (!a.startsWith("-")) {
      out.dirs.push(a);
    }
  }
  return out;
}

function uid(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}_${Date.now().toString(16)}`;
}

function safeFileTitle(title) {
  const s = String(title || "")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .trim()
    .slice(0, 100);
  return s || "untitled";
}

function readAppVersion() {
  try {
    const pkgPath = path.join(__dirname, "..", "package.json");
    const j = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return typeof j.version === "string" ? j.version : "0.1.0";
  } catch {
    return "0.1.0";
  }
}

function convertFile(filePath, provider) {
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);
  const messagesIn = Array.isArray(data.messages) ? data.messages : [];
  const title =
    typeof data.title === "string" && data.title.trim()
      ? data.title.trim()
      : path.basename(filePath, ".json");

  const projectId = provider;
  const aiSpeaker = provider === "gemini" ? "ソルコクタニ" : "耶律楚材";

  const baseTime = Date.now() - messagesIn.length * 1000;
  const messages = [];
  let t = baseTime;

  for (const m of messagesIn) {
    const role = m && m.role;
    const text = m && typeof m.text === "string" ? m.text : "";
    if (role !== "human" && role !== "assistant") continue;
    messages.push({
      id: uid("m"),
      side: role === "human" ? "user" : "ai",
      speaker: role === "human" ? "ジュチ" : aiSpeaker,
      text,
      createdAt: t,
    });
    t += 1000;
  }

  const thread = {
    id: uid("th"),
    projectId,
    title,
    createdAt: baseTime,
    updatedAt: t,
    messages,
  };

  const envelope = {
    schema: "altan-orda-thread-backup-v1",
    exportedAt: new Date().toISOString(),
    app: "Altan Orda AI",
    version: 1,
    appVersion: readAppVersion(),
    syncSource: "manual",
    thread,
  };

  const outName = `${thread.id}_${safeFileTitle(title)}.json`;
  return { outName, json: JSON.stringify(envelope, null, 2) };
}

function main() {
  const { provider, dirs } = parseArgs(process.argv.slice(2));
  const inputDir = dirs[0];
  const outputDir =
    dirs[1] ||
    path.join(inputDir || ".", "ao-thread-backups");

  if (!inputDir) {
    console.error(
      "使い方: node scripts/convert-claude-logs-to-ao-thread.mjs <入力ディレクトリ> [出力ディレクトリ] [--provider=claude|gemini]",
    );
    process.exit(1);
  }

  const absIn = path.resolve(process.cwd(), inputDir);
  const absOut = path.resolve(process.cwd(), outputDir);

  if (!fs.existsSync(absIn) || !fs.statSync(absIn).isDirectory()) {
    console.error(`入力がディレクトリではありません: ${absIn}`);
    process.exit(1);
  }

  fs.mkdirSync(absOut, { recursive: true });

  const files = fs
    .readdirSync(absIn)
    .filter((n) => n.endsWith(".json") && !n.startsWith("."));

  let n = 0;
  for (const name of files) {
    const fp = path.join(absIn, name);
    if (!fs.statSync(fp).isFile()) continue;
    try {
      const { outName, json } = convertFile(fp, provider);
      const dest = path.join(absOut, outName);
      fs.writeFileSync(dest, json, "utf8");
      console.log(`${name} → ${outName}`);
      n++;
    } catch (e) {
      console.error(`スキップ: ${name} — ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`完了: ${n} 件 → ${absOut}`);
}

main();
