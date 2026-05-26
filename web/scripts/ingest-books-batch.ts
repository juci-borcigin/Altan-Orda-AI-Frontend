/**
 * 典籍ソース一括 ingest（PDF テキスト層 / .md / .txt）。
 * 失敗時: ソース直下に一覧テキスト → Failed/ へ移動。
 *
 *   cd web
 *   npm run ingest:books-batch
 *   npm run ingest:books-batch -- --dry-run
 *   npm run ingest:books-batch -- --source-dir "/path/to/Source"
 *   npm run ingest:books-batch -- --retry-failed   # Failed/ 内 + staging/*.txt
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { ingestBookSource } from "../src/lib/ingest-book-source";
import { extractEpubText } from "../src/lib/extract-epub-text";
import { extractPdfText } from "../src/lib/pdf-extract-text";
import { loadQdrantConfig } from "../src/lib/qdrant-client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const DEFAULT_SOURCE =
  "/Users/juci/Downloads/NotebookLM/Source";
const FAILED_DIR_NAME = "Failed";
const STAGING_DIR_NAME = "staging";
const MIN_CHARS_DEFAULT = 500;

type FailReason =
  | "skip_empty"
  | "skip_epub"
  | "skip_unsupported"
  | "error";

type BatchRow = {
  file: string;
  basename: string;
  status: "ok" | FailReason;
  chars?: number;
  chunks?: number;
  sourceId?: string;
  message?: string;
};

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {
    dryRun: false,
    noMove: false,
    retryFailed: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--no-move") out.noMove = true;
    else if (a === "--retry-failed") out.retryFailed = true;
    else if (a === "--source-dir" && argv[i + 1]) {
      out.sourceDir = argv[++i];
    } else if (a === "--theme-slug" && argv[i + 1]) {
      out.themeSlug = argv[++i];
    } else if (a === "--min-chars" && argv[i + 1]) {
      out.minChars = argv[++i];
    }
  }
  return out;
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, "").trim();
}

function titleFromFilename(filePath: string): string {
  return stripExt(path.basename(filePath));
}

async function readTextFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

async function resolveTextForFile(
  filePath: string,
  sourceDir: string,
  stagingDir: string,
): Promise<{ text: string; via: string }> {
  const base = path.basename(filePath);
  const stem = stripExt(base);
  const staged = path.join(stagingDir, `${stem}.txt`);
  try {
    const stagedText = await readTextFile(staged);
    if (stagedText.trim()) {
      return { text: stagedText, via: `staging:${path.basename(staged)}` };
    }
  } catch {
    /* no staging */
  }

  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    const text = await extractPdfText(filePath);
    return { text, via: "pdf-extract" };
  }
  if (ext === ".epub") {
    const text = await extractEpubText(filePath);
    return { text, via: "epub" };
  }
  if (ext === ".md" || ext === ".markdown" || ext === ".txt") {
    const text = await readTextFile(filePath);
    return { text, via: "plain" };
  }
  throw new Error(`unsupported extension: ${ext}`);
}

async function listIngestTargets(
  sourceDir: string,
  retryFailed: boolean,
): Promise<string[]> {
  const failedDir = path.join(sourceDir, FAILED_DIR_NAME);
  const scanDir = retryFailed ? failedDir : sourceDir;
  let names: string[];
  try {
    names = await fs.readdir(scanDir);
  } catch (e) {
    if (retryFailed) {
      console.warn(`[batch] ${failedDir} が無いか読めません`);
      return [];
    }
    throw e;
  }

  const out: string[] = [];
  for (const name of names.sort()) {
    if (name.startsWith(".")) continue;
    if (name === FAILED_DIR_NAME || name === STAGING_DIR_NAME) continue;
    if (name.startsWith("ingest-failed-") && name.endsWith(".txt")) continue;
    const full = path.join(scanDir, name);
    const st = await fs.stat(full);
    if (!st.isFile()) continue;
    const ext = path.extname(name).toLowerCase();
    if ([".pdf", ".md", ".markdown", ".txt", ".epub"].includes(ext)) {
      out.push(full);
    }
  }
  return out;
}

async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") throw e;
    const st = await fs.stat(dir);
    if (!st.isDirectory()) {
      throw new Error(`${dir} exists but is not a directory`);
    }
  }
}

async function moveToFailed(filePath: string, failedDir: string) {
  await ensureDir(failedDir);
  const dest = path.join(failedDir, path.basename(filePath));
  try {
    await fs.rename(filePath, dest);
    return dest;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "EXDEV") {
      await fs.copyFile(filePath, dest);
      await fs.unlink(filePath);
      return dest;
    }
    throw e;
  }
}

function formatFailedList(rows: BatchRow[], sourceDir: string): string {
  const lines = [
    "# AO ingest failed — OCR / 再 ingest 候補",
    `# generated: ${new Date().toISOString()}`,
    `# source: ${sourceDir}`,
    "#",
    "# 次の手順:",
    "#  1. 下記ファイルを OCR → staging/<stem>.txt に保存",
    "#  2. npm run ingest:books-batch -- --retry-failed",
    "#",
  ];
  const failed = rows.filter((r) => r.status !== "ok");
  for (const r of failed) {
    lines.push(
      `${r.status}\tchars=${r.chars ?? 0}\t${r.file}${r.message ? `\t# ${r.message}` : ""}`,
    );
  }
  if (failed.length === 0) {
    lines.push("(none)");
  }
  return lines.join("\n") + "\n";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = path.resolve(
    String(args.sourceDir ?? process.env.AO_BOOK_SOURCE_DIR ?? DEFAULT_SOURCE),
  );
  const themeSlug = String(args.themeSlug ?? "juchi-ulus");
  const minChars = Number(args.minChars ?? MIN_CHARS_DEFAULT);
  const dryRun = Boolean(args.dryRun);
  const noMove = Boolean(args.noMove);
  const retryFailed = Boolean(args.retryFailed);

  const failedDir = path.join(sourceDir, FAILED_DIR_NAME);
  const stagingDir = path.join(sourceDir, STAGING_DIR_NAME);

  console.log("[batch] source:", sourceDir);
  console.log("[batch] theme_slug:", themeSlug);
  console.log("[batch] min_chars:", minChars);
  if (dryRun) console.log("[batch] DRY RUN — DB/Qdrant/移動なし");
  if (retryFailed) console.log("[batch] retry-failed: Failed/ + staging/*.txt");

  const oai = process.env.OPENAI_API_KEY?.trim();
  const qcfg = loadQdrantConfig();
  const supaUrl = process.env.SUPABASE_URL?.trim();
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!dryRun && (!oai || !qcfg || !supaUrl || !supaKey)) {
    console.error(
      "[batch] OPENAI_API_KEY, QDRANT_*, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY が必要です（--dry-run で抽出のみ可）",
    );
    process.exit(1);
  }

  const supa =
    !dryRun && supaUrl && supaKey
      ? createClient(supaUrl, supaKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

  const files = await listIngestTargets(sourceDir, retryFailed);
  console.log("[batch] files:", files.length);

  const rows: BatchRow[] = [];
  const toMove: string[] = [];

  for (const filePath of files) {
    const basename = path.basename(filePath);
    const displayName = titleFromFilename(filePath);
    const row: BatchRow = { file: filePath, basename, status: "ok" };

    const ext = path.extname(filePath).toLowerCase();
    if (![".pdf", ".epub", ".md", ".markdown", ".txt"].includes(ext)) {
      row.status = "skip_unsupported";
      row.message = ext;
      rows.push(row);
      toMove.push(filePath);
      continue;
    }

    try {
      const { text, via } = await resolveTextForFile(filePath, sourceDir, stagingDir);
      const chars = text.replace(/\s+/g, "").length;
      row.chars = chars;

      if (chars < minChars) {
        row.status = "skip_empty";
        row.message = `extracted via ${via}; need OCR or staging txt`;
        rows.push(row);
        toMove.push(filePath);
        console.log(`[empty] ${basename} — ${chars} chars (${via})`);
        continue;
      }

      if (dryRun) {
        let chunkCount = 0;
        const { chunkTextForKind } = await import("../src/lib/ao-chunk-profiles");
        chunkCount = chunkTextForKind(text, "books").length;
        row.chunks = chunkCount;
        rows.push(row);
        console.log(`[dry] ${basename} — ${chars} chars, ~${chunkCount} chunks (${via})`);
        continue;
      }

      const result = await ingestBookSource({
        supa: supa!,
        qcfg: qcfg!,
        openaiKey: oai!,
        input: {
          text,
          displayName,
          workTitle: displayName,
          authors: "",
          themeSlug,
          ingestKind: "upload",
          sourceFile: filePath,
        },
      });

      if (!result.ok) {
        row.status = "error";
        row.message = result.error;
        rows.push(row);
        toMove.push(filePath);
        console.log(`[err] ${basename} — ${result.error}`);
        continue;
      }

      row.chunks = result.chunks;
      row.sourceId = result.sourceId;
      rows.push(row);
      console.log(`[ok] ${basename} — ${result.chunks} chunks, id=${result.sourceId}`);

      if (retryFailed) {
        try {
          await fs.rename(filePath, path.join(sourceDir, basename));
          console.log(`[batch] 成功 → 親フォルダへ戻した: ${basename}`);
        } catch {
          /* 既に親にある等 */
        }
      }
    } catch (e) {
      row.status = "error";
      row.message = e instanceof Error ? e.message : String(e);
      rows.push(row);
      toMove.push(filePath);
      console.log(`[err] ${basename} — ${row.message}`);
    }
  }

  const failedRows = rows.filter((r) => r.status !== "ok");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const listPath = path.join(sourceDir, `ingest-failed-${stamp}.txt`);
  const listBody = formatFailedList(rows, sourceDir);

  await fs.writeFile(listPath, listBody, "utf8");
  console.log("[batch] failed list:", listPath);

  if (!dryRun && !noMove && toMove.length > 0) {
    await ensureDir(failedDir);
    for (const fp of [...toMove]) {
      try {
        const dest = await moveToFailed(fp, failedDir);
        console.log("[batch] moved →", dest);
      } catch (e) {
        console.error("[batch] move failed:", fp, e);
      }
    }
  } else if (toMove.length > 0 && (dryRun || noMove)) {
    console.log("[batch] would move to Failed/:", toMove.length, "files");
  }

  const ok = rows.filter((r) => r.status === "ok").length;
  console.log(
    `[batch] done: ok=${ok} failed=${failedRows.length} total=${rows.length}`,
  );

  if (failedRows.length > 0 && !dryRun) {
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
