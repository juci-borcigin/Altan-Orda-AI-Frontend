/**
 * Failed/ 内の PDF（OCR）・ EPUB（抽出）→ ingest → 成功時 Source 直下へ戻す
 *
 *   cd web
 *   npm run recover:failed-books
 *   npm run recover:failed-books -- --dry-run
 *   npm run recover:failed-books -- --max-pages 3   # OCR 試験
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { extractEpubText } from "../src/lib/extract-epub-text";
import { extractPdfText } from "../src/lib/pdf-extract-text";
import { ingestBookSource } from "../src/lib/ingest-book-source";
import {
  estimateOcrYen,
  isOcrOverBudget,
  OCR_MAX_YEN_PER_BOOK,
  OCR_YEN_PER_PAGE_ESTIMATE,
} from "../src/lib/ao-ocr-budget";
import {
  ocrPdfToStagingFile,
  readOcrProgress,
  stagingPathsForPdf,
} from "../src/lib/ocr-pdf-openai";
import {
  getRemainingOcrPages,
  stagingTxtPathForPdf,
} from "../src/lib/pdf-page-count";
import { loadQdrantConfig } from "../src/lib/qdrant-client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const DEFAULT_SOURCE = "/Users/juci/Downloads/NotebookLM/Source";
const FAILED_DIR_NAME = "Failed";
const MIN_CHARS = 500;

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean | number> = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--skip-ocr") out.skipOcr = true;
    else if (a === "--source-dir" && argv[i + 1]) out.sourceDir = argv[++i];
    else if (a === "--theme-slug" && argv[i + 1]) out.themeSlug = argv[++i];
    else if (a === "--max-pages" && argv[i + 1]) out.maxPages = Number(argv[++i]);
    else if (a === "--file" && argv[i + 1]) out.file = argv[++i];
    else if (a === "--page-delay-ms" && argv[i + 1]) {
      out.pageDelayMs = Number(argv[++i]);
    } else if (a === "--ignore-budget") out.ignoreBudget = true;
  }
  return out;
}

type BudgetSkipRow = {
  file: string;
  remainingPages: number;
  estimateYen: number;
};

async function writeBudgetSkipList(sourceDir: string, rows: BudgetSkipRow[]) {
  const listPath = path.join(sourceDir, "OCR-BUDGET-SKIPPED.txt");
  const lines = [
    "# AO OCR 予算超過 — 自動中止（冊あたり見通し > 上限）",
    `# 上限: ${OCR_MAX_YEN_PER_BOOK} 円/冊`,
    `# 見積: ${OCR_YEN_PER_PAGE_ESTIMATE} 円/ページ（保守的）`,
    `# updated: ${new Date().toISOString()}`,
    "#",
    "# 再開する場合: GCP Vision 等に切替、または",
    "#   npm run recover:failed-books -- --ignore-budget",
    "#",
    ...rows.map(
      (r) =>
        `skip_budget\tpages=${r.remainingPages}\tyen~${r.estimateYen}\t${r.file}`,
    ),
  ];
  if (rows.length === 0) lines.push("(none)");
  await fs.writeFile(listPath, lines.join("\n") + "\n", "utf8");
  return listPath;
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, "").trim();
}

function titleFromFilename(filePath: string): string {
  return stripExt(path.basename(filePath));
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function promoteFromFailed(filePath: string, sourceDir: string) {
  const dest = path.join(sourceDir, path.basename(filePath));
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
    if (code === "EEXIST") {
      await fs.unlink(filePath);
      return dest;
    }
    throw e;
  }
}

async function listFailed(sourceDir: string, onlyFile?: string): Promise<string[]> {
  const failedDir = path.join(sourceDir, FAILED_DIR_NAME);
  const names = await fs.readdir(failedDir);
  const out: string[] = [];
  for (const name of names.sort()) {
    if (name.startsWith(".")) continue;
    const full = path.join(failedDir, name);
    const st = await fs.stat(full);
    if (!st.isFile()) continue;
    if (onlyFile && name !== onlyFile && !full.endsWith(onlyFile)) continue;
    const ext = path.extname(name).toLowerCase();
    if ([".pdf", ".epub"].includes(ext)) out.push(full);
  }
  return out;
}

async function resolveText(
  filePath: string,
  sourceDir: string,
  openaiKey: string,
  opts: {
    skipOcr: boolean;
    maxPages?: number;
    pageDelayMs?: number;
    dryRun: boolean;
    ignoreBudget: boolean;
  },
): Promise<{ text: string; via: string }> {
  const ext = path.extname(filePath).toLowerCase();
  const stem = stripExt(path.basename(filePath));
  const stagingTxt = path.join(sourceDir, "staging", `${stem}.txt`);
  const progressPath = `${stagingTxt}.progress.json`;

  if (ext !== ".epub") {
    try {
      const progress = await readOcrProgress(progressPath);
      const staged = await fs.readFile(stagingTxt, "utf8");
      const stagedChars = staged.replace(/\s+/g, "").length;
      const ocrComplete =
        progress && progress.lastPage >= progress.totalPages && progress.totalPages > 0;
      if (ocrComplete && stagedChars >= MIN_CHARS) {
        return { text: staged, via: "staging-complete" };
      }
    } catch {
      /* continue to extract / OCR */
    }
  }

  if (ext === ".epub") {
    const text = await extractEpubText(filePath);
    return { text, via: "epub" };
  }

  if (ext === ".pdf") {
    const embedded = await extractPdfText(filePath);
    if (embedded.replace(/\s+/g, "").length >= MIN_CHARS) {
      return { text: embedded, via: "pdf-extract" };
    }
    if (opts.skipOcr || opts.dryRun) {
      return { text: embedded, via: "pdf-extract-empty" };
    }

    const stagingTxt = stagingTxtPathForPdf(sourceDir, filePath);
    const remainingPages = await getRemainingOcrPages(filePath, stagingTxt);
    if (!opts.ignoreBudget && isOcrOverBudget(remainingPages)) {
      throw new Error(
        `ocr_budget_exceeded: 残${remainingPages}p 見通し~${estimateOcrYen(remainingPages)}円 > ${OCR_MAX_YEN_PER_BOOK}円`,
      );
    }

    await ensureDir(path.join(sourceDir, "staging"));
    const { txtPath } = stagingPathsForPdf(sourceDir, filePath);
    console.log(`[ocr] ${path.basename(filePath)} → ${txtPath}`);
    const text = await ocrPdfToStagingFile({
      pdfPath: filePath,
      stagingTxtPath: txtPath,
      openaiKey,
      maxPages: opts.maxPages,
      pageDelayMs: opts.pageDelayMs,
      onPage: (p, t) => {
        if (p === 1 || p % 10 === 0 || p === t) {
          console.log(`[ocr]   page ${p}/${t}`);
        }
      },
    });
    return { text, via: "openai-ocr" };
  }

  throw new Error(`unsupported: ${ext}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = path.resolve(
    String(args.sourceDir ?? process.env.AO_BOOK_SOURCE_DIR ?? DEFAULT_SOURCE),
  );
  const themeSlug = String(args.themeSlug ?? "juchi-ulus");
  const dryRun = Boolean(args.dryRun);
  const skipOcr = Boolean(args.skipOcr);
  const maxPages = args.maxPages as number | undefined;
  const pageDelayMs = args.pageDelayMs as number | undefined;
  const onlyFile = args.file as string | undefined;
  const ignoreBudget = Boolean(args.ignoreBudget);

  const oai = process.env.OPENAI_API_KEY?.trim();
  const qcfg = loadQdrantConfig();
  const supaUrl = process.env.SUPABASE_URL?.trim();
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!dryRun && (!oai || !qcfg || !supaUrl || !supaKey)) {
    console.error("[recover] OPENAI / QDRANT / SUPABASE が必要です");
    process.exit(1);
  }

  let files = await listFailed(sourceDir, onlyFile);
  files = await Promise.all(
    files.map(async (f) => ({
      f,
      ext: path.extname(f).toLowerCase(),
      size: (await fs.stat(f)).size,
    })),
  ).then((rows) =>
    rows
      .sort((a, b) => {
        if (a.ext === ".epub" && b.ext !== ".epub") return -1;
        if (b.ext === ".epub" && a.ext !== ".epub") return 1;
        return a.size - b.size;
      })
      .map((r) => r.f),
  );
  console.log("[recover] Failed 内:", files.length, "件");
  console.log(
    `[recover] OCR 予算: 上限 ${OCR_MAX_YEN_PER_BOOK} 円/冊, 見積 ${OCR_YEN_PER_PAGE_ESTIMATE} 円/ページ`,
  );
  if (ignoreBudget) console.log("[recover] --ignore-budget: 予算チェック無効");

  const budgetSkipped: BudgetSkipRow[] = [];

  const supa =
    !dryRun && supaUrl && supaKey
      ? createClient(supaUrl, supaKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

  let ok = 0;
  let fail = 0;

  for (const filePath of files) {
    const basename = path.basename(filePath);
    console.log(`\n[recover] === ${basename} ===`);

    try {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === ".pdf" && !ignoreBudget && !skipOcr && !dryRun) {
        const stagingTxt = stagingTxtPathForPdf(sourceDir, filePath);
        const remainingPages = await getRemainingOcrPages(filePath, stagingTxt);
        if (isOcrOverBudget(remainingPages)) {
          const yen = estimateOcrYen(remainingPages);
          console.log(
            `[budget] 中止 — 残 ${remainingPages} ページ, 見通し ~${yen} 円 (上限 ${OCR_MAX_YEN_PER_BOOK} 円)`,
          );
          budgetSkipped.push({ file: filePath, remainingPages, estimateYen: yen });
          fail++;
          continue;
        }
      }

      const { text, via } = await resolveText(filePath, sourceDir, oai ?? "", {
        skipOcr,
        maxPages,
        pageDelayMs,
        dryRun,
        ignoreBudget,
      });
      const chars = text.replace(/\s+/g, "").length;
      console.log(`[recover] ${basename}: ${chars} chars (${via})`);

      if (chars < MIN_CHARS) {
        console.log(`[recover] skip — 文字不足 (${MIN_CHARS} 未満)`);
        fail++;
        continue;
      }

      if (dryRun) {
        ok++;
        continue;
      }

      const result = await ingestBookSource({
        supa: supa!,
        qcfg: qcfg!,
        openaiKey: oai!,
        input: {
          text,
          displayName: titleFromFilename(filePath),
          workTitle: titleFromFilename(filePath),
          authors: "",
          themeSlug,
          ingestKind: "upload",
          sourceFile: filePath,
        },
      });

      if (!result.ok) {
        console.log(`[recover] ingest error: ${result.error}`);
        fail++;
        continue;
      }

      const dest = await promoteFromFailed(filePath, sourceDir);
      console.log(`[recover] ok — ${result.chunks} chunks → 除外: ${dest}`);
      ok++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("ocr_budget_exceeded")) {
        const stagingTxt = stagingTxtPathForPdf(sourceDir, filePath);
        const remainingPages = await getRemainingOcrPages(filePath, stagingTxt).catch(
          () => 0,
        );
        budgetSkipped.push({
          file: filePath,
          remainingPages,
          estimateYen: estimateOcrYen(remainingPages),
        });
        console.log(`[budget] 中止 — ${msg}`);
      } else {
        console.log(`[recover] error: ${msg}`);
      }
      fail++;
    }
  }

  const skipPath = await writeBudgetSkipList(sourceDir, budgetSkipped);
  if (budgetSkipped.length > 0) {
    console.log(`[budget] 一覧: ${skipPath}`);
  }

  console.log(`\n[recover] done: ok=${ok} still_failed=${fail} budget_skipped=${budgetSkipped.length}`);
  if (fail > 0 && !dryRun) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
