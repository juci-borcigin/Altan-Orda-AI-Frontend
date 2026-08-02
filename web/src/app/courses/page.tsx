import Link from "next/link";
import { listCourses } from "@/lib/course-maker/course-db";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

async function fetchCourses() {
  const supa = getSupabaseAdmin();
  if (!supa) return { courses: [] as Awaited<ReturnType<typeof listCourses>>, error: "Supabase not configured" };
  try {
    const courses = await listCourses(supa);
    return { courses };
  } catch (e) {
    return { courses: [] as Awaited<ReturnType<typeof listCourses>>, error: e instanceof Error ? e.message : String(e) };
  }
}

function statusBadge(status: string) {
  return <span className={`cm-badge cm-badge-${status}`}>{status}</span>;
}

export default async function CoursesListPage() {
  const { courses, error } = await fetchCourses();

  return (
    <>
      <h1 className="cm-page-title">講義一覧</h1>
      <p className="cm-page-sub">AO 本体とは独立した講義モジュール（機能検証用）</p>

      {error && <div className="cm-error">{error}</div>}

      <div className="cm-card">
        <div className="cm-btn-row" style={{ marginTop: 0 }}>
          <Link href="/courses/new" className="cm-btn cm-btn-primary">
            新規講義を作成
          </Link>
        </div>
      </div>

      <div className="cm-card">
        <h2>登録済み講義</h2>
        {courses.length === 0 ? (
          <p className="cm-muted">まだ講義がありません。</p>
        ) : (
          <ul className="cm-list">
            {courses.map((c) => (
              <li key={c.id}>
                <div className="cm-list-row">
                  <Link href={`/courses/${c.id}`} className="cm-list-row-main">
                    <span>
                      <strong>{c.title}</strong>
                      <br />
                      <span className="cm-muted">
                        {c.params?.session_count ?? "?"}回 · {new Date(c.updated_at).toLocaleString("ja-JP")}
                      </span>
                    </span>
                    {statusBadge(c.status)}
                  </Link>
                  {(c.status === "ready" || c.status === "generating") && (
                    <Link href={`/courses/${c.id}/learn`} className="cm-btn" style={{ flexShrink: 0 }}>
                      受講
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
