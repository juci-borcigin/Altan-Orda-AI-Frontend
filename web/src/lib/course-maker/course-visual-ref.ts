/** 講習画像の Storage 参照。ブラウザ向け URL ではない。 */

export const AO_COURSE_VISUAL_BUCKET = "ao-course-visuals";

/** `storage://ao-course-visuals/<course_id>/<slot>.<ext>` */
export const COURSE_VISUAL_STORAGE_PREFIX = `storage://${AO_COURSE_VISUAL_BUCKET}/`;

/** 署名 URL の寿命。受講画面は取得のたびに引き直す。 */
export const COURSE_VISUAL_SIGNED_URL_TTL_SEC = 12 * 60 * 60;

const COURSE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OBJECT_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-zA-Z0-9_-]{1,120}\.(png|jpe?g|webp)$/i;

export type CourseVisualExt = "png" | "jpg" | "webp";

export function extensionForImageMime(mime: string): CourseVisualExt {
  switch (mime.trim().toLowerCase()) {
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      throw new Error(`unsupported image type: ${mime}`);
  }
}

export function courseVisualObjectPath(
  courseId: string,
  slotId: string,
  ext: CourseVisualExt = "png",
): string {
  const course = courseId.trim();
  if (!COURSE_ID_RE.test(course)) {
    throw new Error("invalid courseId for course visual storage");
  }
  const safeSlot = slotId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  if (!safeSlot) throw new Error("invalid slotId for course visual storage");
  return `${course}/${safeSlot}.${ext}`;
}

export function courseVisualStorageRef(objectPath: string): string {
  if (!OBJECT_PATH_RE.test(objectPath)) {
    throw new Error("invalid course visual object path");
  }
  return `${COURSE_VISUAL_STORAGE_PREFIX}${objectPath}`;
}

/** 保存参照ならオブジェクトパス。レガシー URL やそれ以外は null。 */
export function parseCourseVisualStorageRef(artifactUrl: string | null | undefined): string | null {
  if (!artifactUrl?.startsWith(COURSE_VISUAL_STORAGE_PREFIX)) return null;
  const objectPath = artifactUrl.slice(COURSE_VISUAL_STORAGE_PREFIX.length);
  if (!OBJECT_PATH_RE.test(objectPath)) return null;
  return objectPath;
}

export function artifactUrlHasImage(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.startsWith("data:image") ||
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("/") ||
    parseCourseVisualStorageRef(url) != null
  );
}

/**
 * トレース本文へ data URL を書かない。
 * 文中の「data:image」という言及だけは残す。
 */
export function omitInlineDataImage(text: string | null | undefined): string | null {
  if (text == null) return null;
  if (!text.includes("data:image")) return text;
  const next = text.replace(
    /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+/g,
    "(image)",
  );
  if (next.startsWith("data:image") && next.length > 256) return "(image omitted)";
  return next;
}
