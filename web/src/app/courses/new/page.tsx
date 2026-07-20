"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CourseParams } from "@/lib/course-maker/course-master-schema";
import { AUDIENCE_OPTIONS, MATH_LEVEL_OPTIONS } from "@/lib/course-maker/course-master-schema";

const DEFAULT: CourseParams = {
  theme: "",
  learner_level: "beginner",
  audience: "working_adult",
  math_level: "high_school",
  language_level: "undergrad",
  target_outcome: "",
  session_count: 3,
  session_duration_min: 30,
};

export default function NewCoursePage() {
  const router = useRouter();
  const [params, setParams] = useState<CourseParams>(DEFAULT);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params, title: title || undefined }),
      });
      const json = (await res.json()) as { course?: { id: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      router.push(`/courses/${json.course!.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function set<K extends keyof CourseParams>(key: K, value: CourseParams[K]) {
    setParams((p) => ({ ...p, [key]: value }));
  }

  return (
    <>
      <h1 className="cm-page-title">新規講習</h1>
      <p className="cm-page-sub">パラメータを入力して講座を作成します</p>

      {error && <div className="cm-error">{error}</div>}

      <form className="cm-card cm-form" onSubmit={handleSubmit}>
        <label>タイトル（任意）</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="未入力時はテーマを使用"
        />

        <label>テーマ *</label>
        <input
          required
          value={params.theme}
          onChange={(e) => set("theme", e.target.value)}
          placeholder="例: 量子力学入門"
        />

        <label>達成目標</label>
        <textarea
          value={params.target_outcome}
          onChange={(e) => set("target_outcome", e.target.value)}
          placeholder="受講後にできること"
        />

        <div className="cm-grid-2">
          <div>
            <label>受講者</label>
            <select
              value={params.audience}
              onChange={(e) => set("audience", e.target.value as CourseParams["audience"])}
            >
              {AUDIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} disabled={!o.enabled}>
                  {o.label}
                  {!o.enabled ? "（準備中）" : ""}
                </option>
              ))}
            </select>
            <p className="cm-muted" style={{ marginTop: "-0.5rem", marginBottom: "0.85rem" }}>
              {AUDIENCE_OPTIONS.find((o) => o.value === params.audience)?.note}
            </p>
          </div>
          <div>
            <label>現在のレベル</label>
            <select
              value={params.learner_level}
              onChange={(e) => set("learner_level", e.target.value as CourseParams["learner_level"])}
            >
              <option value="zero">ゼロから</option>
              <option value="beginner">初級</option>
              <option value="intermediate">中級</option>
            </select>
            <p className="cm-muted" style={{ marginTop: "-0.5rem", marginBottom: "0.85rem" }}>
              このトピックについて、いまどの程度知っているか
            </p>
          </div>
        </div>

        <div className="cm-grid-2">
          <div>
            <label>数学レベル</label>
            <select
              value={params.math_level}
              onChange={(e) => set("math_level", e.target.value as CourseParams["math_level"])}
            >
              {MATH_LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="cm-muted" style={{ marginTop: "-0.5rem", marginBottom: "0.85rem" }}>
              {MATH_LEVEL_OPTIONS.find((o) => o.value === params.math_level)?.guide}
            </p>
          </div>
          <div />
        </div>

        <div className="cm-grid-2">
          <div>
            <label>回数</label>
            <input
              type="number"
              min={1}
              max={30}
              value={params.session_count}
              onChange={(e) => set("session_count", Number(e.target.value))}
            />
          </div>
          <div>
            <label>1回あたり（分）</label>
            <select
              value={params.session_duration_min}
              onChange={(e) =>
                set("session_duration_min", Number(e.target.value) as CourseParams["session_duration_min"])
              }
            >
              {[15, 30, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {m}分
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="cm-btn-row">
          <button type="submit" className="cm-btn cm-btn-primary" disabled={loading}>
            {loading ? "作成中…" : "作成"}
          </button>
        </div>
      </form>
    </>
  );
}
