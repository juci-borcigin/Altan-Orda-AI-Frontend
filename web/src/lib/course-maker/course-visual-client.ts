/** クライアント側: 1スロット分の画像だけ取得してキャッシュする */

const artifactCache = new Map<string, string>();

function cacheKey(courseId: string, sessionNo: number, sectionNo: number) {
  return `${courseId}:${sessionNo}:${sectionNo}`;
}

export function peekVisualArtifact(
  courseId: string,
  sessionNo: number,
  sectionNo: number,
): string | null {
  return artifactCache.get(cacheKey(courseId, sessionNo, sectionNo)) ?? null;
}

export function putVisualArtifact(
  courseId: string,
  sessionNo: number,
  sectionNo: number,
  url: string,
) {
  artifactCache.set(cacheKey(courseId, sessionNo, sectionNo), url);
}

export function clearVisualArtifactCache(courseId?: string) {
  if (!courseId) {
    artifactCache.clear();
    return;
  }
  for (const key of artifactCache.keys()) {
    if (key.startsWith(`${courseId}:`)) artifactCache.delete(key);
  }
}

export async function fetchVisualArtifact(
  courseId: string,
  sessionNo: number,
  sectionNo: number,
): Promise<string | null> {
  const key = cacheKey(courseId, sessionNo, sectionNo);
  const hit = artifactCache.get(key);
  if (hit) return hit;

  const qs = new URLSearchParams({
    session_no: String(sessionNo),
    section_no: String(sectionNo),
  });
  const res = await fetch(`/api/courses/${courseId}/visuals?${qs}`);
  const json = (await res.json()) as {
    visual?: { artifact_url?: string | null; status?: string };
    error?: string;
  };
  if (!res.ok) throw new Error(json.error ?? res.statusText);
  const url = json.visual?.artifact_url ?? null;
  if (url) artifactCache.set(key, url);
  return url;
}
