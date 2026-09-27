import fs from "fs/promises";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AO_COURSE_VISUAL_BUCKET,
  COURSE_VISUAL_SIGNED_URL_TTL_SEC,
  courseVisualObjectPath,
  courseVisualStorageRef,
  extensionForImageMime,
  parseCourseVisualStorageRef,
  type CourseVisualExt,
} from "./course-visual-ref";

export {
  AO_COURSE_VISUAL_BUCKET,
  COURSE_VISUAL_SIGNED_URL_TTL_SEC,
  parseCourseVisualStorageRef,
} from "./course-visual-ref";

const DATA_IMAGE_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/;

export function parseDataImage(dataUrl: string): { mime: string; bytes: Buffer } {
  const match = DATA_IMAGE_RE.exec(dataUrl.trim());
  if (!match) throw new Error("not a base64 image data URL");
  const mime = match[1].toLowerCase();
  extensionForImageMime(mime);
  const bytes = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  if (bytes.length === 0) throw new Error("empty image payload");
  return { mime, bytes };
}

/** PNG / JPEG / WebP を非公開バケットへ upsert し、DB に入れる storage 参照を返す。 */
export async function uploadCourseVisualBytes(
  supa: SupabaseClient,
  opts: { courseId: string; slotId: string; bytes: Buffer; contentType: string },
): Promise<string> {
  const mime =
    opts.contentType.trim().toLowerCase() === "image/jpg"
      ? "image/jpeg"
      : opts.contentType.trim().toLowerCase();
  const ext: CourseVisualExt = extensionForImageMime(mime);
  const objectPath = courseVisualObjectPath(opts.courseId, opts.slotId, ext);
  const { error } = await supa.storage.from(AO_COURSE_VISUAL_BUCKET).upload(objectPath, opts.bytes, {
    contentType: mime,
    upsert: true,
  });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
  return courseVisualStorageRef(objectPath);
}

/**
 * ブラウザの img src に渡せる URL へ解決する。
 * storage 参照は署名 URL。data URL / `/courses/` / http(s) はそのまま。
 */
export async function resolveCourseVisualArtifactUrl(
  supa: SupabaseClient,
  artifactUrl: string | null | undefined,
): Promise<string | null> {
  if (!artifactUrl) return null;
  if (artifactUrl.startsWith("storage://")) {
    const objectPath = parseCourseVisualStorageRef(artifactUrl);
    if (!objectPath) return null;
    return signCourseVisualObject(supa, objectPath);
  }
  return artifactUrl;
}

async function signCourseVisualObject(supa: SupabaseClient, objectPath: string): Promise<string> {
  const { data, error } = await supa.storage
    .from(AO_COURSE_VISUAL_BUCKET)
    .createSignedUrl(objectPath, COURSE_VISUAL_SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) {
    throw new Error(`signed url failed: ${error?.message ?? objectPath}`);
  }
  return data.signedUrl;
}

async function blobToBuffer(data: Blob | ArrayBuffer | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return Buffer.from(await data.arrayBuffer());
}

/** ラボ用。data URL・storage 参照・`/courses/` ファイルからバイト列を読む。 */
export async function readCourseVisualBytes(
  supa: SupabaseClient | null,
  artifactUrl: string,
): Promise<Buffer | null> {
  if (artifactUrl.startsWith("data:image")) {
    return parseDataImage(artifactUrl).bytes;
  }
  const objectPath = parseCourseVisualStorageRef(artifactUrl);
  if (objectPath) {
    if (!supa) throw new Error("Supabase not configured");
    const { data, error } = await supa.storage.from(AO_COURSE_VISUAL_BUCKET).download(objectPath);
    if (error || !data) throw new Error(error?.message ?? "storage download failed");
    return blobToBuffer(data);
  }
  if (artifactUrl.startsWith("/courses/")) {
    return readLegacyPublicCourseFile(artifactUrl);
  }
  return null;
}

async function readLegacyPublicCourseFile(urlPath: string): Promise<Buffer | null> {
  const rel = urlPath.slice("/courses/".length);
  if (!rel || rel.includes("..") || rel.includes("\\") || path.isAbsolute(rel)) return null;
  const root = path.join(process.cwd(), "public", "courses");
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  try {
    return await fs.readFile(full);
  } catch {
    return null;
  }
}
