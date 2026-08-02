/**
 * Wikimedia Commons から再利用しやすい画像を1件取得する。
 * 取れなければ null（スキップ）。
 * PDF・動画などは除外し、ブラウザで表示できる画像のみ採用する。
 */

export type WikimediaImageHit = {
  url: string;
  attribution: string;
  title: string;
  source: "wikimedia";
  page_url?: string;
};

type CommonsSearchResponse = {
  query?: {
    search?: Array<{ title: string; pageid: number }>;
  };
};

type CommonsImageInfoResponse = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        imageinfo?: Array<{
          url?: string;
          thumburl?: string;
          descriptionurl?: string;
          mime?: string;
          extmetadata?: {
            Artist?: { value?: string };
            LicenseShortName?: { value?: string };
            Attribution?: { value?: string };
          };
        }>;
      }
    >;
  };
};

const UA = "AltanOrda-CourseMaker/1.0 (educational frontend; local-dev)";

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

function isProbablyNonImageTitle(title: string): boolean {
  return /\.(pdf|djvu|webm|ogv|mp4|stl|wav|oga|opus)(\]|\s|$)/i.test(title);
}

async function commonsGet(url: string): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    last = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(20_000),
    });
    if (last.status !== 429) return last;
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  return last!;
}

async function fetchFileInfo(title: string): Promise<WikimediaImageHit | null> {
  if (isProbablyNonImageTitle(title)) return null;

  const infoUrl = new URL("https://commons.wikimedia.org/w/api.php");
  infoUrl.searchParams.set("action", "query");
  infoUrl.searchParams.set("format", "json");
  infoUrl.searchParams.set("origin", "*");
  infoUrl.searchParams.set("titles", title);
  infoUrl.searchParams.set("prop", "imageinfo");
  infoUrl.searchParams.set("iiprop", "url|extmetadata|mime");
  infoUrl.searchParams.set("iiurlwidth", "400");

  const infoRes = await commonsGet(infoUrl.toString());
  if (!infoRes.ok) return null;
  const infoJson = (await infoRes.json()) as CommonsImageInfoResponse;
  const page = Object.values(infoJson.query?.pages ?? {})[0];
  const ii = page?.imageinfo?.[0];
  if (!ii) return null;

  const mime = (ii.mime ?? "").toLowerCase();
  if (!mime.startsWith("image/")) return null;

  const displayUrl = (ii.thumburl || ii.url || "").trim();
  if (!displayUrl) return null;

  const meta = ii.extmetadata ?? {};
  const artist = stripHtml(meta.Artist?.value ?? meta.Attribution?.value ?? "");
  const license = stripHtml(meta.LicenseShortName?.value ?? "");
  const pageLink = ii.descriptionurl ?? "https://commons.wikimedia.org/";
  const fileTitle = page?.title ?? title;
  const attribution = [fileTitle, artist, license].filter(Boolean).join(" · ");

  return {
    url: displayUrl,
    attribution,
    title: fileTitle,
    source: "wikimedia",
    page_url: pageLink,
  };
}

async function searchTitles(query: string): Promise<string[]> {
  const searchUrl = new URL("https://commons.wikimedia.org/w/api.php");
  searchUrl.searchParams.set("action", "query");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("origin", "*");
  searchUrl.searchParams.set("list", "search");
  searchUrl.searchParams.set("srnamespace", "6");
  searchUrl.searchParams.set("srlimit", "10");
  searchUrl.searchParams.set("srsearch", query);

  const searchRes = await commonsGet(searchUrl.toString());
  if (!searchRes.ok) return [];
  const searchJson = (await searchRes.json()) as CommonsSearchResponse;
  return (searchJson.query?.search ?? []).map((h) => h.title);
}

export async function fetchWikimediaSectionImage(
  query: string,
): Promise<WikimediaImageHit | null> {
  const q = query.trim();
  if (!q) return null;

  try {
    // 1) 通常検索 → 2) 英語寄りフォールバックは呼び出し側の query に任せる
    const titles = await searchTitles(q);
    for (const title of titles) {
      const info = await fetchFileInfo(title);
      if (info) return info;
      await new Promise((r) => setTimeout(r, 120));
    }
    return null;
  } catch {
    return null;
  }
}
