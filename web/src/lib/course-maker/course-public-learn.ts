/**
 * 公開受講 URL（/l/{courseId}）用。
 * URL を知っていれば閲覧可。allowlist 外は 404。
 */

export function publicLearnAllowlist(): string[] {
  const raw = process.env.AO_COURSE_PUBLIC_LEARN_IDS?.trim() ?? "";
  if (!raw) return [];
  return raw
    .split(/[,:\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isPublicLearnCourse(courseId: string): boolean {
  const id = courseId.trim();
  if (!id) return false;
  return publicLearnAllowlist().includes(id);
}

export function publicLearnPath(courseId: string): string {
  return `/l/${courseId.trim()}`;
}

/**
 * 公開受講で必要な静的ヒーロー画像。
 * `/courses/{allowlistedId}/hero_s{n}.png` のみ許可（管理画面本体は不可）。
 */
export function isPublicLearnHeroAssetPath(pathname: string): boolean {
  const m = /^\/courses\/([^/]+)\/hero_s\d+\.png$/i.exec(pathname);
  if (!m) return false;
  return isPublicLearnCourse(m[1]);
}

/** 共有用オリジン（末尾スラッシュなし）。未設定なら null */
export function publicLearnOrigin(): string | null {
  const explicit = process.env.AO_COURSE_PUBLIC_LEARN_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const auth = process.env.AUTH_URL?.trim();
  if (auth && !auth.includes("localhost") && !auth.includes("127.0.0.1")) {
    return auth.replace(/\/$/, "");
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }
  return null;
}

export function publicLearnAbsoluteUrl(courseId: string): string | null {
  const id = courseId.trim();
  if (!id || !isPublicLearnCourse(id)) return null;
  const origin = publicLearnOrigin();
  if (!origin) return null;
  return `${origin}${publicLearnPath(id)}`;
}

export type PublicLearnInfo = {
  allowlisted: boolean;
  path: string;
  /** 共有用の絶対 URL。オリジン未設定時は null（相対 path のみ） */
  url: string | null;
};

export function publicLearnInfo(courseId: string): PublicLearnInfo {
  const path = publicLearnPath(courseId);
  const allowlisted = isPublicLearnCourse(courseId);
  return {
    allowlisted,
    path,
    url: allowlisted ? publicLearnAbsoluteUrl(courseId) : null,
  };
}
