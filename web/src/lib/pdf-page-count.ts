import { readOcrProgress } from "./ocr-pdf-openai";
import { pdf } from "pdf-to-img";
import path from "node:path";

export async function getPdfPageCount(pdfPath: string): Promise<number> {
  const doc = await pdf(pdfPath, { scale: 1 });
  const n = doc.length;
  await doc.destroy();
  return n;
}

/** OCR 残ページ（progress があれば差し引き） */
export async function getRemainingOcrPages(
  pdfPath: string,
  stagingTxtPath: string,
): Promise<number> {
  const total = await getPdfPageCount(pdfPath);
  const progressPath = `${stagingTxtPath}.progress.json`;
  const progress = await readOcrProgress(progressPath);
  const done = progress?.totalPages === total ? (progress.lastPage ?? 0) : 0;
  return Math.max(0, total - done);
}

export function stagingTxtPathForPdf(sourceDir: string, pdfPath: string): string {
  const stem = path.basename(pdfPath).replace(/\.[^.]+$/, "");
  return path.join(sourceDir, "staging", `${stem}.txt`);
}
