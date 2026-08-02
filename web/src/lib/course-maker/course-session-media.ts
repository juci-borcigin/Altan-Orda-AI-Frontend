import type { CourseMaster } from "./course-master-schema";
import { fetchWikimediaSectionImage } from "./wikimedia-image";

/**
 * 指定回の content セクションへ Wikimedia 画像を付与。
 * 取れなければ空（スキップ）。intro/outro は常に none。
 */
export async function attachWikimediaSectionImages(
  master: CourseMaster,
  sessionNo: number,
): Promise<CourseMaster> {
  const sessions = await Promise.all(
    master.sessions.map(async (session) => {
      if (session.session_no !== sessionNo) return session;
      const sections = [];
      for (const sec of session.sections) {
        if (sec.role !== "content") {
          sections.push({
            ...sec,
            image_url: null,
            image_attribution: null,
            image_page_url: null,
            image_source: "none" as const,
          });
          continue;
        }
        const query =
          sec.image_search_query?.trim() ||
          `${master.meta.theme} ${sec.heading}`.trim();
        // 連続アクセスの 429 を避ける
        await new Promise((r) => setTimeout(r, 250));
        const hit = await fetchWikimediaSectionImage(query);
        if (hit) {
          sections.push({
            ...sec,
            image_url: hit.url,
            image_attribution: hit.attribution,
            image_page_url: hit.page_url ?? null,
            image_source: "wikimedia" as const,
          });
        } else {
          sections.push({
            ...sec,
            image_url: null,
            image_attribution: null,
            image_page_url: null,
            image_source: "none" as const,
          });
        }
      }
      return { ...session, sections };
    }),
  );
  return { ...master, sessions };
}

export function resolveHeroImagePrompt(
  master: CourseMaster,
  sessionNo: number,
): string {
  const session = master.sessions.find((s) => s.session_no === sessionNo);
  const custom = session?.hero_image_prompt?.trim();
  if (custom) return custom;
  const title = session?.title ?? `第${sessionNo}回`;
  return [
    `Educational 16:9 wide hero image for a blog-style lecture titled "${title}"`,
    `about ${master.meta.theme}.`,
    "Single clear focal subject, cinematic educational B-roll still,",
    "soft volumetric light, cool steel-blue with warm amber accents,",
    "short bilingual or Japanese label allowed, not clipart.",
  ].join(" ");
}
