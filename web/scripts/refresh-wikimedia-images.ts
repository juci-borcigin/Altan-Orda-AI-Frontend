/**
 * 既存講義の Wikimedia セクション画像を再付与（課金なし）。
 * 使い方: npx tsx scripts/refresh-wikimedia-images.ts <courseId>
 */
import { config } from "dotenv";
import path from "path";

config({ path: path.join(process.cwd(), ".env") });
config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const courseId = process.argv[2]?.trim();
  if (!courseId) {
    console.error("usage: npx tsx scripts/refresh-wikimedia-images.ts <courseId>");
    process.exit(1);
  }

  const { getSupabaseAdmin } = await import("../src/lib/supabase-admin");
  const { getCourse, updateCourse } = await import("../src/lib/course-maker/course-db");
  const { attachWikimediaSectionImages } = await import(
    "../src/lib/course-maker/course-session-media"
  );
  type CourseMaster = import("../src/lib/course-maker/course-master-schema").CourseMaster;

  const supa = getSupabaseAdmin();
  if (!supa) throw new Error("Supabase not configured");
  const course = await getCourse(supa, courseId);
  if (!course?.course_master) throw new Error("course_master missing");

  let master = course.course_master as CourseMaster;
  for (const session of master.sessions) {
    process.stdout.write(`session ${session.session_no}... `);
    master = await attachWikimediaSectionImages(master, session.session_no);
    const s = master.sessions.find((x) => x.session_no === session.session_no)!;
    const withImg = s.sections.filter((sec) => sec.image_url).length;
    const content = s.sections.filter((sec) => sec.role === "content").length;
    console.log(`${withImg}/${content} images`);
    await updateCourse(supa, courseId, { course_master: master });
  }
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
