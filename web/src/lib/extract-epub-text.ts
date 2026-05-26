import EPub from "epub2";

function htmlToPlain(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

/** EPUB 本文をプレーンテキストに連結（章順） */
export async function extractEpubText(filePath: string): Promise<string> {
  const epub = await EPub.createAsync(filePath);
  const parts: string[] = [];

  for (const item of epub.flow) {
    const html = await epub.getChapterAsync(item.id);
    const plain = htmlToPlain(html);
    if (plain) parts.push(plain);
  }

  return parts.join("\n\n");
}
