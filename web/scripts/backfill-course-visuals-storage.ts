/**
 * ao_course_visuals.artifact_url の data URL を Supabase Storage へ移し、
 * 列の値を storage://ao-course-visuals/... に書き換える。
 *
 * このスクリプトは DB へ書き込む。リポジトリ上の作業では実行しない。
 *
 * 前提:
 *   supabase/migrations/032_ao_course_visuals_storage.sql を
 *   Supabase SQL Editor で適用済みであること（バケット ao-course-visuals）。
 *   環境変数 SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY
 *   （web/.env または web/.env.local）。
 *
 * web ディレクトリで:
 *   npx tsx scripts/backfill-course-visuals-storage.ts
 *   npx tsx scripts/backfill-course-visuals-storage.ts --apply
 *
 * 引数なしは件数だけの dry-run（画像本体は読まない）。
 * --apply で 1 行ずつ upload し、成功した行だけ artifact_url を更新する。
 * data URL 以外（/courses/... と NULL）は触らない。再実行しても data URL が
 * 残っている行だけが対象になる。
 *
 * 移動後も Postgres は死んだ TOAST をファイルに残す。空きを 500MB 枠へ
 * 戻すには、トランザクションの外で（VACUUM はトランザクション内では失敗する）:
 *
 *   VACUUM FULL public.ao_course_visuals;
 *
 * SQL Editor がトランザクションで包む場合は、DB の接続文字列で:
 *
 *   psql "$SUPABASE_DB_URL" -c "VACUUM FULL public.ao_course_visuals;"
 *
 * VACUUM FULL は ao_course_visuals を排他ロックする。
 *
 * 任意: 既存トレースに残った data URL を捨ててから、その表も回収する。
 * 新規書き込みはアプリ側で data URL を落としている。
 *
 *   UPDATE public.ao_course_trace_events
 *   SET response_text = '(image omitted)'
 *   WHERE response_text LIKE 'data:image%';
 *
 *   VACUUM FULL public.ao_course_trace_events;
 *
 * 事前に列サイズだけ見る SQL（本体は転送しない）:
 *
 *   select count(*) as rows,
 *          pg_size_pretty(sum(octet_length(artifact_url))::bigint) as data_url_text
 *   from public.ao_course_visuals
 *   where artifact_url like 'data:image%';
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { uploadCourseVisualBytes, parseDataImage } from "../src/lib/course-maker/course-visual-storage";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config({ path: path.join(__dirname, "../.env.local") });

type VisualTarget = {
  id: string;
  course_id: string;
  session_no: number;
  slot_id: string;
  artifact_url: string;
};

async function countLike(supa: SupabaseClient, pattern: string): Promise<number> {
  const { count, error } = await supa
    .from("ao_course_visuals")
    .select("id", { count: "exact", head: true })
    .like("artifact_url", pattern);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function nextRow(supa: SupabaseClient, afterId: string): Promise<VisualTarget | null> {
  let query = supa
    .from("ao_course_visuals")
    .select("id, course_id, session_no, slot_id, artifact_url")
    .like("artifact_url", "data:image%")
    .order("id", { ascending: true })
    .limit(1);
  if (afterId) query = query.gt("id", afterId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0] as VisualTarget | undefined;
  if (!row?.artifact_url?.startsWith("data:image")) return null;
  return row;
}

async function migrateOne(supa: SupabaseClient, row: VisualTarget): Promise<number> {
  const parsed = parseDataImage(row.artifact_url);
  const storageRef = await uploadCourseVisualBytes(supa, {
    courseId: row.course_id,
    slotId: row.slot_id,
    bytes: parsed.bytes,
    contentType: parsed.mime,
  });
  const { data, error } = await supa
    .from("ao_course_visuals")
    .update({
      artifact_url: storageRef,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .like("artifact_url", "data:image%")
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) {
    console.log(`skip ${row.id} (row changed before update)`);
    return 0;
  }
  console.log(
    `moved ${row.id} session=${row.session_no} slot=${row.slot_id} text_bytes=${row.artifact_url.length} png_bytes=${parsed.bytes.length} -> ${storageRef}`,
  );
  return parsed.bytes.length;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const supa = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const dataUrls = await countLike(supa, "data:image%");
  const legacyPaths = await countLike(supa, "/courses/%");
  const stored = await countLike(supa, "storage://ao-course-visuals/%");
  console.log(
    `dry-run counts: data_url=${dataUrls} legacy_path=${legacyPaths} storage_ref=${stored}`,
  );
  console.log("legacy /courses/ paths and NULL rows are left unchanged");

  if (!apply) {
    console.log("no writes. re-run with --apply after migration 032 is applied.");
    console.log("then reclaim disk with: VACUUM FULL public.ao_course_visuals;");
    return;
  }

  if (dataUrls === 0) {
    console.log("nothing to move");
    return;
  }

  let moved = 0;
  let failed = 0;
  let pngBytes = 0;
  let afterId = "";
  for (;;) {
    const row = await nextRow(supa, afterId);
    if (!row) break;
    afterId = row.id;
    try {
      const n = await migrateOne(supa, row);
      if (n > 0) {
        moved += 1;
        pngBytes += n;
      }
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      const hint = /bucket not found/i.test(msg)
        ? " — apply supabase/migrations/032_ao_course_visuals_storage.sql first"
        : "";
      console.error(`failed ${row.id}: ${msg}${hint}`);
    }
  }

  console.log(`done moved=${moved} failed=${failed} png_bytes=${pngBytes}`);
  console.log("reclaim DB disk (exclusive lock): VACUUM FULL public.ao_course_visuals;");
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
