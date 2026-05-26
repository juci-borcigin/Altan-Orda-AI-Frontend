import { readFile } from "node:fs/promises";
import pdfParse from "pdf-parse";

/** PDF テキスト層の抽出（OCR 前の高速パス）。空に近いときは呼び出し側で OCR へ回す。 */
export async function extractPdfText(filePath: string): Promise<string> {
  const buf = await readFile(filePath);
  const parsed = await pdfParse(buf);
  return typeof parsed.text === "string" ? parsed.text.trim() : "";
}
