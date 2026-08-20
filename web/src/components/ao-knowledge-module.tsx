"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IcoScroll, IcoGear, IcoArrowLeft } from "@/components/ao-action-icons";
import { CourseAdminView } from "@/components/course-maker/CourseAdminView";
import { CourseLearnView } from "@/components/course-maker/CourseLearnView";
import { AoMainColumnFrame } from "@/components/ao-phase5/AoMainColumnFrame";
import {
  AO_FRAME_AL_OVERLAY_SHADOW_EXTENT_PX,
  AO_NAV_BACK_BTN_CLASS,
  AO_PARCHMENT_ICON_BTN_CLASS,
} from "@/lib/template/ao-chrome";
import "@/app/courses/courses.css";

const AO_KM_DEFAULT_COURSE_KEY = "ao_km_default_course_id";

export type AoKnowledgeLayer = "use" | "settings";

type CourseListItem = {
  id: string;
  title: string;
  status: string;
  updated_at?: string;
  params?: { session_count?: number };
};

type AoKnowledgeModuleProps = {
  layer: AoKnowledgeLayer;
  onLayerChange: (layer: AoKnowledgeLayer) => void;
};

/**
 * AO シェル内ナレッジ（KM）モジュール。
 * 使用＝デフォルト講義の受講／設定＝一覧＋講義管理。
 */
export function AoKnowledgeModule({ layer, onLayerChange }: AoKnowledgeModuleProps) {
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/courses");
      const json = (await res.json()) as { courses?: CourseListItem[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const list = json.courses ?? [];
      setCourses(list);
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(AO_KM_DEFAULT_COURSE_KEY);
      } catch {
        stored = null;
      }
      const storedOk = stored && list.some((c) => c.id === stored) ? stored : null;
      const nextDefault = storedOk ?? list[0]?.id ?? null;
      setDefaultId(nextDefault);
      setSelectedId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return nextDefault;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (layer !== "use") setOutlineOpen(false);
  }, [layer]);

  const useCourseId = useMemo(() => defaultId ?? selectedId, [defaultId, selectedId]);

  function setAsDefault(id: string) {
    setDefaultId(id);
    setSelectedId(id);
    try {
      window.localStorage.setItem(AO_KM_DEFAULT_COURSE_KEY, id);
    } catch {
      /* ignore */
    }
  }

  function openSettings() {
    setOutlineOpen(false);
    onLayerChange("settings");
  }

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-visible">
      <div
        className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
        style={{
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 12,
          paddingBottom: Math.max(12, AO_FRAME_AL_OVERLAY_SHADOW_EXTENT_PX),
        }}
      >
        <AoMainColumnFrame
          className="relative box-border w-full max-w-full shrink-0"
          contentClassName="flex flex-col"
        >
          <div className="ao-p5-parchment-surface flex w-full flex-col gap-2 px-1 py-1 font-ao-serif">
            <div className="grid w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-x-1 px-0.5">
              <div className="min-w-0 text-ao-heading-2 font-semibold tracking-[0.12em]">
                {layer === "use" ? "ナレッジ" : "ナレッジ設定"}
              </div>
              <div className="flex items-center justify-center gap-1 text-ao-ruby opacity-80">
                {layer === "use" && useCourseId
                  ? (courses.find((c) => c.id === useCourseId)?.title ?? "")
                  : null}
              </div>
              <div className="flex min-w-0 items-center justify-end gap-0.5">
                {layer === "use" ? (
                  <button
                    type="button"
                    className={AO_PARCHMENT_ICON_BTN_CLASS}
                    aria-label={outlineOpen ? "全体構成を閉じる" : "全体構成"}
                    aria-pressed={outlineOpen}
                    disabled={!useCourseId}
                    onClick={() => setOutlineOpen((v) => !v)}
                  >
                    <IcoScroll size={16} />
                  </button>
                ) : null}
                {layer === "use" ? (
                  <button
                    type="button"
                    className={AO_PARCHMENT_ICON_BTN_CLASS}
                    aria-label="ナレッジ設定"
                    onClick={openSettings}
                  >
                    <IcoGear size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className={AO_NAV_BACK_BTN_CLASS}
                    aria-label="使用に戻る"
                    onClick={() => onLayerChange("use")}
                  >
                    <IcoArrowLeft size={14} className="shrink-0" />
                  </button>
                )}
              </div>
            </div>

            {loading ? <p className="cm-muted px-2 py-4">読み込み中…</p> : null}
            {error ? <div className="cm-error mx-2">{error}</div> : null}

            {!loading && !error && layer === "use" ? (
              useCourseId ? (
                <div className="cm-ao-km-embed min-w-0 w-full px-1 pb-2">
                  <CourseLearnView
                    courseId={useCourseId}
                    variant="admin"
                    showSessionChat={false}
                    ui="ao"
                    outlineOpen={outlineOpen}
                    onOutlineOpenChange={setOutlineOpen}
                  />
                </div>
              ) : (
                <p className="cm-muted px-2 py-4">
                  まだナレッジがありません。歯車から設定を開き、Generic の `/courses/new` で作成するか、一覧から選んでください。
                </p>
              )
            ) : null}

            {!loading && !error && layer === "settings" ? (
              <div className="flex min-w-0 w-full flex-col gap-3 px-1 pb-2">
                <section className="cm-card" style={{ margin: 0 }}>
                  <h2 style={{ marginTop: 0 }}>ナレッジ一覧</h2>
                  <p className="cm-muted" style={{ marginTop: 0 }}>
                    既定の受講対象を選べます。管理は下のパネルで行います。
                  </p>
                  {courses.length === 0 ? (
                    <p className="cm-muted">
                      講義がありません。{" "}
                      <a href="/courses/new" className="cm-btn cm-btn-primary" style={{ display: "inline-block" }}>
                        新規作成（Generic）
                      </a>
                    </p>
                  ) : (
                    <ul className="cm-list">
                      {courses.map((c) => {
                        const isSel = c.id === selectedId;
                        const isDef = c.id === defaultId;
                        return (
                          <li key={c.id}>
                            <div className="cm-list-row">
                              <button
                                type="button"
                                className="cm-list-row-main"
                                style={{
                                  textAlign: "left",
                                  border: 0,
                                  background: isSel ? "rgba(0,0,0,0.06)" : "transparent",
                                  cursor: "pointer",
                                  width: "100%",
                                }}
                                onClick={() => setSelectedId(c.id)}
                              >
                                <span>
                                  <strong>{c.title}</strong>
                                  {isDef ? (
                                    <span className="cm-muted"> · 既定</span>
                                  ) : null}
                                  <br />
                                  <span className="cm-muted">
                                    {c.params?.session_count ?? "?"}回 · {c.status}
                                  </span>
                                </span>
                                <span className={`cm-badge cm-badge-${c.status}`}>{c.status}</span>
                              </button>
                              {!isDef ? (
                                <button
                                  type="button"
                                  className="cm-btn"
                                  style={{ flexShrink: 0 }}
                                  onClick={() => setAsDefault(c.id)}
                                >
                                  既定にする
                                </button>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="cm-btn-row">
                    <a href="/courses/new" className="cm-btn">
                      新規作成（Generic）
                    </a>
                    <button type="button" className="cm-btn" onClick={() => void loadCourses()}>
                      再読込
                    </button>
                  </div>
                </section>

                {selectedId ? (
                  <section className="cm-ao-km-embed min-w-0 w-full">
                    <CourseAdminView courseId={selectedId} />
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>
        </AoMainColumnFrame>
      </div>
    </div>
  );
}
