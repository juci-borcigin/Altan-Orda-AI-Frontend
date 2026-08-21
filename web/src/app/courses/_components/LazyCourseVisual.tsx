"use client";

import { useEffect, useRef, useState } from "react";
import { fetchVisualArtifact } from "@/lib/course-maker/course-visual-client";

type Props = {
  courseId: string;
  sessionNo: number;
  sectionNo: number;
  /** メタだけあるとき true。false なら取得しない */
  hasArtifact: boolean;
  alt?: string;
  className?: string;
  /** ビューポート外でも即取得（受講画面の現在ページ向け） */
  eager?: boolean;
  emptyLabel?: string;
};

/** 画像本体を別 API から遅延取得。一覧 GET に base64 を載せないための表示部品 */
export function LazyCourseVisual({
  courseId,
  sessionNo,
  sectionNo,
  hasArtifact,
  alt = "セクション画",
  className,
  eager = false,
  emptyLabel = "セクション画はまだありません",
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(eager);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (eager || !hasArtifact) return;
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eager, hasArtifact, sessionNo, sectionNo]);

  useEffect(() => {
    if (!hasArtifact || !inView) {
      setUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchVisualArtifact(courseId, sessionNo, sectionNo)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, sessionNo, sectionNo, hasArtifact, inView]);

  if (!hasArtifact) {
    return (
      <div ref={rootRef} className={className}>
        <div className="cm-learn-visual-empty">{emptyLabel}</div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={className}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} />
      ) : loading || (!inView && !eager) ? (
        <div className="cm-learn-visual-empty">画像を読み込み中…</div>
      ) : error ? (
        <div className="cm-learn-visual-empty">画像読み込み失敗: {error}</div>
      ) : (
        <div className="cm-learn-visual-empty">{emptyLabel}</div>
      )}
    </div>
  );
}
