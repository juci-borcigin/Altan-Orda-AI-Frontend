import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pdf } from "pdf-to-img";

const OCR_PROMPT =
  "この画像は書籍の1ページです。日本語の縦書き・横書きを問わず、読み順どおりに全文をプレーンテキストで抽出してください。要約・説明・Markdownは不要。本文のみ出力。";

export type OcrPdfProgress = {
  lastPage: number;
  totalPages: number;
};

export async function readOcrProgress(progressPath: string): Promise<OcrPdfProgress | null> {
  try {
    const raw = await readFile(progressPath, "utf8");
    return JSON.parse(raw) as OcrPdfProgress;
  } catch {
    return null;
  }
}

async function writeOcrProgress(progressPath: string, progress: OcrPdfProgress) {
  await writeFile(progressPath, JSON.stringify(progress, null, 2), "utf8");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ocrPngPage(png: Buffer, openaiKey: string): Promise<string> {
  const b64 = png.toString("base64");
  const maxAttempts = 10;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: OCR_PROMPT },
              {
                type: "image_url",
                image_url: { url: `data:image/png;base64,${b64}`, detail: "low" },
              },
            ],
          },
        ],
      }),
    });

    if (res.status === 429) {
      const waitMs = Math.min(90_000, 2_000 * 2 ** (attempt - 1));
      console.warn(`[ocr] rate limit — wait ${Math.round(waitMs / 1000)}s (${attempt}/${maxAttempts})`);
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`OpenAI OCR ${res.status}: ${errBody.slice(0, 400)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  }

  throw new Error("OpenAI OCR: rate limit retries exhausted");
}

export type OcrPdfOptions = {
  pdfPath: string;
  stagingTxtPath: string;
  openaiKey: string;
  scale?: number;
  maxPages?: number;
  pageDelayMs?: number;
  onPage?: (page: number, total: number) => void;
};

/**
 * PDF をページ画像化 → OpenAI Vision OCR → staging txt（ページごと追記・再開可）
 */
export async function ocrPdfToStagingFile(opts: OcrPdfOptions): Promise<string> {
  const scale = opts.scale ?? 2;
  const pageDelayMs = opts.pageDelayMs ?? 4_000;
  const progressPath = `${opts.stagingTxtPath}.progress.json`;

  const doc = await pdf(opts.pdfPath, { scale });
  const totalPages = opts.maxPages
    ? Math.min(doc.length, opts.maxPages)
    : doc.length;

  const prior = await readOcrProgress(progressPath);
  let startPage = 1;
  if (prior && prior.totalPages === totalPages && prior.lastPage > 0) {
    startPage = prior.lastPage + 1;
    if (startPage > totalPages) {
      return readFile(opts.stagingTxtPath, "utf8");
    }
  } else {
    await writeFile(opts.stagingTxtPath, "", "utf8");
    await writeOcrProgress(progressPath, { lastPage: 0, totalPages });
  }

  for (let page = startPage; page <= totalPages; page++) {
    opts.onPage?.(page, totalPages);
    const png = await doc.getPage(page);
    const text = await ocrPngPage(png, opts.openaiKey);
    const block = `\n\n--- ページ ${page} ---\n\n${text}`;
    await appendFile(opts.stagingTxtPath, block, "utf8");
    await writeOcrProgress(progressPath, { lastPage: page, totalPages });
    if (page < totalPages && pageDelayMs > 0) {
      await new Promise((r) => setTimeout(r, pageDelayMs));
    }
  }

  await doc.destroy();
  return readFile(opts.stagingTxtPath, "utf8");
}

export function stagingPathsForPdf(sourceDir: string, pdfPath: string) {
  const stem = path.basename(pdfPath).replace(/\.[^.]+$/, "");
  const stagingDir = path.join(sourceDir, "staging");
  return {
    stagingDir,
    txtPath: path.join(stagingDir, `${stem}.txt`),
    progressPath: path.join(stagingDir, `${stem}.txt.progress.json`),
  };
}
