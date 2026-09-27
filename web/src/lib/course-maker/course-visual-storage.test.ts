import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { visualHasArtifact } from "./course-admin-view";
import {
  AO_COURSE_VISUAL_BUCKET,
  COURSE_VISUAL_SIGNED_URL_TTL_SEC,
  artifactUrlHasImage,
  courseVisualObjectPath,
  courseVisualStorageRef,
  omitInlineDataImage,
  parseCourseVisualStorageRef,
} from "./course-visual-ref";
import {
  parseDataImage,
  readCourseVisualBytes,
  resolveCourseVisualArtifactUrl,
  uploadCourseVisualBytes,
} from "./course-visual-storage";

const COURSE_ID = "bfea8c94-40d9-4c39-8f68-627a4927a648";

test("object path is a storage ref and never a data URL", () => {
  const objectPath = courseVisualObjectPath(COURSE_ID, "hero/s1");
  assert.equal(objectPath, `${COURSE_ID}/hero_s1.png`);
  const ref = courseVisualStorageRef(objectPath);
  assert.equal(ref, `storage://${AO_COURSE_VISUAL_BUCKET}/${objectPath}`);
  assert.equal(parseCourseVisualStorageRef(ref), objectPath);
  assert.equal(ref.includes("data:"), false);
});

test("path builder rejects traversal and non-uuid course ids", () => {
  assert.throws(() => courseVisualObjectPath("../etc", "hero_s1"));
  assert.throws(() => courseVisualObjectPath(COURSE_ID, ""));
  assert.equal(parseCourseVisualStorageRef(`storage://${AO_COURSE_VISUAL_BUCKET}/../../etc/passwd`), null);
  assert.equal(
    parseCourseVisualStorageRef("data:image/png;base64,aaaa"),
    null,
  );
});

test("artifact presence accepts storage refs and legacy forms", () => {
  const ref = courseVisualStorageRef(courseVisualObjectPath(COURSE_ID, "hero_s1"));
  assert.equal(artifactUrlHasImage(ref), true);
  assert.equal(artifactUrlHasImage("data:image/png;base64,aaaa"), true);
  assert.equal(artifactUrlHasImage(`/courses/${COURSE_ID}/hero_s1.png`), true);
  assert.equal(artifactUrlHasImage("https://example.test/hero.png"), true);
  assert.equal(artifactUrlHasImage(null), false);
  assert.equal(
    visualHasArtifact({
      slot_id: "hero_s1",
      session_no: 1,
      status: "ready",
      artifact_url: ref,
      prompt: null,
      image_model_id: null,
    }),
    true,
  );
});

test("trace text drops inline image payloads", () => {
  const payload = `data:image/png;base64,${Buffer.from("png-bytes").toString("base64")}`;
  assert.equal(omitInlineDataImage(null), null);
  assert.equal(omitInlineDataImage("see data:image in the docs"), "see data:image in the docs");
  assert.equal(omitInlineDataImage(payload), "(image)");
  assert.equal(omitInlineDataImage(`before ${payload} after`), "before (image) after");
  assert.equal(omitInlineDataImage(`data:image/png;not-base64 ${"x".repeat(300)}`), "(image omitted)");
});

test("upload stores bytes in the private bucket and returns a storage ref", async () => {
  const calls: Array<{ bucket: string; objectPath: string; bytes: Buffer; options: { contentType?: string; upsert?: boolean } }> = [];
  const supa = {
    storage: {
      from(bucket: string) {
        return {
          async upload(objectPath: string, bytes: Buffer, options: { contentType?: string; upsert?: boolean }) {
            calls.push({ bucket, objectPath, bytes, options });
            return { data: { path: objectPath }, error: null };
          },
        };
      },
    },
  } as unknown as SupabaseClient;

  const png = Buffer.from([137, 80, 78, 71]);
  const ref = await uploadCourseVisualBytes(supa, {
    courseId: COURSE_ID,
    slotId: "vis_1_2",
    bytes: png,
    contentType: "image/png",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.bucket, AO_COURSE_VISUAL_BUCKET);
  assert.equal(calls[0]?.objectPath, `${COURSE_ID}/vis_1_2.png`);
  assert.equal(calls[0]?.options.upsert, true);
  assert.equal(calls[0]?.options.contentType, "image/png");
  assert.deepEqual(calls[0]?.bytes, png);
  assert.equal(ref.startsWith("data:"), false);
  assert.equal(parseCourseVisualStorageRef(ref), `${COURSE_ID}/vis_1_2.png`);
});

test("readers sign storage refs and keep legacy URLs", async () => {
  const supa = {
    storage: {
      from(bucket: string) {
        assert.equal(bucket, AO_COURSE_VISUAL_BUCKET);
        return {
          async createSignedUrl(objectPath: string, expires: number) {
            assert.equal(expires, COURSE_VISUAL_SIGNED_URL_TTL_SEC);
            return {
              data: { signedUrl: `https://example.test/object/${objectPath}?exp=${expires}` },
              error: null,
            };
          },
        };
      },
    },
  } as unknown as SupabaseClient;

  const ref = courseVisualStorageRef(courseVisualObjectPath(COURSE_ID, "hero_s2", "jpg"));
  const signed = await resolveCourseVisualArtifactUrl(supa, ref);
  assert.equal(signed, `https://example.test/object/${COURSE_ID}/hero_s2.jpg?exp=${COURSE_VISUAL_SIGNED_URL_TTL_SEC}`);

  const dataUrl = "data:image/png;base64,aaaa";
  assert.equal(await resolveCourseVisualArtifactUrl(supa, dataUrl), dataUrl);
  assert.equal(
    await resolveCourseVisualArtifactUrl(supa, `/courses/${COURSE_ID}/hero_s2.png`),
    `/courses/${COURSE_ID}/hero_s2.png`,
  );
  assert.equal(await resolveCourseVisualArtifactUrl(supa, "storage://ao-course-visuals/../secret.png"), null);
  assert.equal(await resolveCourseVisualArtifactUrl(supa, null), null);
});

test("bytes can be read from a data URL and not from a traversed public path", async () => {
  const png = Buffer.from("hello-png");
  const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
  const decoded = parseDataImage(dataUrl);
  assert.equal(decoded.mime, "image/png");
  assert.deepEqual(decoded.bytes, png);
  assert.deepEqual(await readCourseVisualBytes(null, dataUrl), png);
  assert.equal(await readCourseVisualBytes(null, "/courses/../../etc/passwd"), null);
  assert.equal(await readCourseVisualBytes(null, "https://example.test/secret.png"), null);
});

test("migration creates a private course-visuals bucket and does not open it", () => {
  const sqlPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../supabase/migrations/032_ao_course_visuals_storage.sql",
  );
  const sql = fs.readFileSync(sqlPath, "utf8");
  assert.match(sql, /'ao-course-visuals',\s*'ao-course-visuals',\s*false,/);
  assert.match(sql, /20971520/);
  assert.equal(sql.includes("create policy"), false);
  assert.equal(/insert\s+into\s+public\.ao_course_visuals/i.test(sql), false);
  const script = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../scripts/backfill-course-visuals-storage.ts"),
    "utf8",
  );
  assert.match(script, /VACUUM FULL public\.ao_course_visuals/);
  assert.match(script, /--apply/);
  assert.equal(script.includes("apply_migration"), false);
});
