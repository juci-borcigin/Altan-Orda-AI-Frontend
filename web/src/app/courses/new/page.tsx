"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import {
  clampSessionCount,
  DEFAULT_DISCLAIMER,
  type CourseSetupState,
  type HearingTurn,
  type ThemeBrief,
} from "@/lib/course-maker/course-theme-brief";

type Phase = "entry" | "hearing" | "skeleton" | "locked";

const THINKING_DOT_CYCLE = [".", "..", "...", "...."] as const;

function renderChatText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = /^\*\*([^*]+)\*\*$/.exec(part);
    if (m) return <strong key={i}>{m[1]}</strong>;
    return <span key={i}>{part}</span>;
  });
}

function formatClientError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/fetch failed/i.test(msg) || /Failed to fetch/i.test(msg)) {
    return "通信に失敗しました。もう一度送信してください。";
  }
  return msg;
}

function PolicyBriefBlock({ title, brief }: { title: string; brief: ThemeBrief }) {
  const age = brief.persona.age_band ? `・${brief.persona.age_band}` : "";
  const sessions = clampSessionCount(brief.scale.recommended_sessions);
  const primary = brief.emphasis.filter((e) => e.weight === "primary");
  const secondary = brief.emphasis.filter((e) => e.weight === "secondary");
  const mention = brief.emphasis.filter((e) => e.weight === "mention");
  const rawNote = brief.disclaimer.statements[0] ?? DEFAULT_DISCLAIMER;
  const note =
    rawNote.includes("教養・情報提供を目的とし") || rawNote.length > 80
      ? DEFAULT_DISCLAIMER
      : rawNote;

  return (
    <div className="cm-setup-modal-policy">
      <div className="cm-setup-policy-title">『{title}』</div>
      <div className="cm-setup-policy-row">
        <span className="cm-setup-policy-label">対象:</span> {brief.persona.label}
        {age}
      </div>
      <div className="cm-setup-policy-row">
        <span className="cm-setup-policy-label">目標:</span>{" "}
        {brief.learning_outcomes[0] ?? "—"}
      </div>
      <div className="cm-setup-policy-row">
        <span className="cm-setup-policy-label">回数:</span> {sessions}回
      </div>
      <div className="cm-setup-policy-row">
        <span className="cm-setup-policy-label">力点:</span>{" "}
        {brief.emphasis.length === 0 ? (
          "均等（仮）"
        ) : (
          <>
            {primary.map((e, i) => (
              <span key={`p-${e.domain}`}>
                {i > 0 ? "、" : null}
                <span className="cm-setup-policy-primary">{e.domain}</span>
              </span>
            ))}
            {primary.length > 0 && secondary.length > 0 ? "、" : null}
            {secondary.map((e, i) => (
              <span key={`s-${e.domain}`}>
                {i > 0 ? "、" : null}
                {e.domain}
              </span>
            ))}
            {mention.length > 0 ? (
              <>
                {primary.length > 0 || secondary.length > 0 ? " " : null}
                （{mention.map((e) => e.domain).join("、")}）
              </>
            ) : null}
          </>
        )}
      </div>
      <div className="cm-setup-policy-row">
        <span className="cm-setup-policy-label">注意:</span> {note}
      </div>
      {brief.user_freeform.trim() ? (
        <div className="cm-setup-policy-row">
          <span className="cm-setup-policy-label">その他:</span> {brief.user_freeform.trim()}
        </div>
      ) : null}
    </div>
  );
}

function NewCourseSetupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("id");

  const [phase, setPhase] = useState<Phase>("entry");
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<string | null>(null);
  const [setup, setSetup] = useState<CourseSetupState | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [revision, setRevision] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [thinkingDotsPhase, setThinkingDotsPhase] = useState(0);
  const [booting, setBooting] = useState(Boolean(resumeId));
  const [error, setError] = useState<string | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);

  const messages: HearingTurn[] = setup?.messages ?? [];
  const displayTitle = setup?.brief?.title || title;

  const visibleMessages = useMemo(() => {
    if (!pendingUser) return messages;
    const last = messages[messages.length - 1];
    if (last?.role === "user" && last.content === pendingUser) return messages;
    return [...messages, { role: "user" as const, content: pendingUser }];
  }, [messages, pendingUser]);

  useEffect(() => {
    if (!chatBusy) {
      setThinkingDotsPhase(0);
      return;
    }
    const id = window.setInterval(() => {
      setThinkingDotsPhase((p) => (p + 1) % THINKING_DOT_CYCLE.length);
    }, 520);
    return () => window.clearInterval(id);
  }, [chatBusy]);

  const loadCourse = useCallback(
    async (id: string) => {
      setBooting(true);
      setError(null);
      try {
        const res = await fetch(`/api/courses/${id}`);
        const json = (await res.json()) as {
          course?: {
            id: string;
            title: string;
            admin_memo?: string | null;
          };
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        const course = json.course!;
        setCourseId(course.id);
        setTitle(course.title);

        let parsed: CourseSetupState | null = null;
        if (course.admin_memo) {
          try {
            const raw = JSON.parse(course.admin_memo) as CourseSetupState;
            if (raw?.kind === "course_setup") parsed = raw;
          } catch {
            parsed = null;
          }
        }
        if (!parsed) {
          throw new Error("この講義にヒアリング状態がありません");
        }
        setSetup(parsed);
        if (parsed.phase === "locked") {
          router.replace(`/courses/${course.id}`);
          return;
        }
        if (parsed.phase === "skeleton" && parsed.skeleton) {
          setPhase("skeleton");
        } else if (parsed.phase === "confirm" && parsed.brief) {
          setPhase("hearing");
          setPolicyOpen(true);
        } else {
          setPhase("hearing");
        }
      } catch (e) {
        setError(formatClientError(e));
        setPhase("entry");
      } finally {
        setBooting(false);
      }
    },
    [router],
  );

  useEffect(() => {
    if (resumeId) void loadCourse(resumeId);
  }, [resumeId, loadCourse]);

  useEffect(() => {
    if (visibleMessages.length === 0 && !chatBusy) return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages, chatBusy, thinkingDotsPhase]);

  useEffect(() => {
    if (phase !== "hearing" || policyOpen || chatBusy || loading || booting) return;
    const t = window.setTimeout(() => chatInputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [phase, policyOpen, chatBusy, loading, booting, courseId]);

  async function startChat(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      const json = (await res.json()) as {
        course?: { id: string; title: string };
        setup?: CourseSetupState;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setCourseId(json.course!.id);
      setSetup(json.setup ?? null);
      setPhase("hearing");
      router.replace(`/courses/new?id=${json.course!.id}`);
    } catch (err) {
      setError(formatClientError(err));
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(raw: string) {
    const q = raw.trim();
    if (!q || !courseId || chatBusy || loading) return;
    setChatInput("");
    setPendingUser(q);
    setChatBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/setup/hear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });
      const json = (await res.json()) as {
        setup?: CourseSetupState;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setSetup(json.setup ?? null);
      setPendingUser(null);
      setPhase("hearing");
    } catch (err) {
      setError(formatClientError(err));
      setPendingUser(null);
      setChatInput(q);
    } finally {
      setChatBusy(false);
    }
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    await sendMessage(chatInput);
  }

  async function decidePolicy() {
    if (!courseId || loading || chatBusy) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/setup/summarize`, {
        method: "POST",
      });
      const json = (await res.json()) as {
        setup?: CourseSetupState;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setSetup(json.setup ?? null);
      setPhase("hearing");
      setPolicyOpen(true);
    } catch (err) {
      setError(formatClientError(err));
    } finally {
      setLoading(false);
    }
  }

  async function confirmPolicyAndGenerate() {
    if (!courseId || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/setup/skeleton`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as {
        setup?: CourseSetupState;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setSetup(json.setup ?? null);
      setPolicyOpen(false);
      setPhase("skeleton");
    } catch (err) {
      setError(formatClientError(err));
    } finally {
      setLoading(false);
    }
  }

  async function reviseSkeleton(e: React.FormEvent) {
    e.preventDefault();
    if (!courseId || loading) return;
    const note = revision.trim();
    if (!note) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/setup/skeleton`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: note }),
      });
      const json = (await res.json()) as {
        setup?: CourseSetupState;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setSetup(json.setup ?? null);
      setRevision("");
      setPhase("skeleton");
    } catch (err) {
      setError(formatClientError(err));
    } finally {
      setLoading(false);
    }
  }

  async function lockSkeleton() {
    if (!courseId || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/setup/lock`, {
        method: "POST",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      router.push(`/courses/${courseId}`);
    } catch (err) {
      setError(formatClientError(err));
      setLoading(false);
    }
  }

  if (booting) {
    return <p className="cm-muted">読み込み中…</p>;
  }

  if (phase === "entry") {
    return (
      <>
        <h1 className="cm-page-title">新規講義</h1>
        <p className="cm-page-sub">タイトルから始めて、対話で方針を固めます</p>
        {error && <div className="cm-error">{error}</div>}
        <form className="cm-card cm-form cm-setup-entry" onSubmit={startChat}>
          <label>タイトル *</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 美しく歳をとる方法"
            autoFocus
          />
          <p className="cm-muted">このタイトルが大テーマになります。属性はチャットで聞きます。</p>
          <div className="cm-btn-row">
            <button type="submit" className="cm-btn cm-btn-primary" disabled={loading}>
              {loading ? "作成中…" : "この講義を作成する"}
            </button>
            <Link href="/courses" className="cm-btn">
              講義一覧に戻る
            </Link>
          </div>
        </form>
      </>
    );
  }

  if (phase === "skeleton" && setup?.skeleton) {
    const sk = setup.skeleton;
    return (
      <>
        <h1 className="cm-page-title">{displayTitle}</h1>
        <p className="cm-page-sub">
          講義のアウトライン · 全{sk.session_count}回 · 約{sk.estimated_total_minutes}分
        </p>
        {error && <div className="cm-error">{error}</div>}
        <div className="cm-card cm-setup-skeleton">
          <ol className="cm-setup-session-list">
            {sk.sessions.map((s) => (
              <li key={s.session_no}>
                <strong>
                  {s.session_no}. {s.title}
                </strong>
                <div className="cm-muted">{s.one_liner}</div>
              </li>
            ))}
          </ol>
          {sk.change_log.length > 0 ? (
            <p className="cm-muted">修正履歴: {sk.change_log.join(" / ")}</p>
          ) : null}
          <form className="cm-form" onSubmit={reviseSkeleton}>
            <label>修正の指示（任意）</label>
            <textarea
              value={revision}
              onChange={(e) => setRevision(e.target.value)}
              placeholder="例: 第3回を睡眠に寄せて、美容は薄く"
              rows={3}
            />
            <div className="cm-btn-row">
              <button type="submit" className="cm-btn" disabled={loading || !revision.trim()}>
                {loading ? "反映中…" : "修正を反映"}
              </button>
              <button
                type="button"
                className="cm-btn"
                disabled={loading}
                onClick={() => {
                  setPolicyOpen(false);
                  setPhase("hearing");
                }}
              >
                チャットに戻る
              </button>
              <button
                type="button"
                className="cm-btn cm-btn-primary"
                disabled={loading}
                onClick={() => void lockSkeleton()}
              >
                {loading ? "作成中…" : "本文を作成"}
              </button>
            </div>
          </form>
        </div>
      </>
    );
  }

  return (
    <div className="cm-setup-bot">
      <header className="cm-setup-bot-top">
        <div>
          <h1 className="cm-setup-bot-title">{displayTitle || "新規講義"}</h1>
        </div>
        <Link href="/courses" className="cm-btn">
          講義一覧に戻る
        </Link>
      </header>

      {error && <div className="cm-error">{error}</div>}

      <div className="cm-setup-bot-shell">
        <div className="cm-setup-bot-log" ref={chatLogRef}>
          {visibleMessages.map((m, i) => (
            <div
              key={`${m.role}-${i}-${m.content.slice(0, 12)}`}
              className={`cm-setup-bot-row ${m.role === "user" ? "is-user" : "is-ai"}`}
            >
              <div className="cm-setup-bot-avatar" aria-hidden>
                {m.role === "user" ? "あなた" : "AI"}
              </div>
              <div className="cm-setup-bot-msg">{renderChatText(m.content)}</div>
            </div>
          ))}
          {chatBusy ? (
            <div className="cm-setup-bot-row is-ai">
              <div className="cm-setup-bot-avatar" aria-hidden>
                AI
              </div>
              <div className="cm-setup-bot-msg cm-setup-bot-thinking" aria-live="polite">
                {THINKING_DOT_CYCLE[thinkingDotsPhase]}
              </div>
            </div>
          ) : null}
          <div ref={chatEndRef} />
        </div>

        <div className="cm-setup-bot-composer">
          <div className="cm-setup-bot-chips">
            <button
              type="button"
              className="cm-setup-chip is-primary"
              disabled={loading || chatBusy}
              onClick={() => void decidePolicy()}
            >
              {loading && !policyOpen ? "準備中…" : "方針を決定"}
            </button>
          </div>
          <form className="cm-setup-bot-form" onSubmit={sendChat}>
            <textarea
              ref={chatInputRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="メッセージを入力…（送信は ⌘↩ / Ctrl+Enter）"
              disabled={chatBusy || loading}
              rows={2}
              onCompositionStart={() => {
                composingRef.current = true;
              }}
              onCompositionEnd={() => {
                composingRef.current = false;
              }}
              onKeyDown={(e) => {
                // Enter 単独は改行。⌘/Ctrl+Enter のみ送信
                if (e.key !== "Enter") return;
                if (!(e.metaKey || e.ctrlKey)) return;
                if (e.nativeEvent.isComposing || composingRef.current) return;
                e.preventDefault();
                void sendMessage(chatInput);
              }}
            />
            <button
              type="submit"
              className="cm-btn cm-btn-primary"
              disabled={chatBusy || loading || !chatInput.trim()}
            >
              送信
            </button>
          </form>
        </div>
      </div>

      {policyOpen && setup?.brief ? (
        <div
          className="cm-setup-modal-backdrop"
          role="presentation"
          onClick={() => !loading && setPolicyOpen(false)}
        >
          <div
            className="cm-setup-modal"
            role="dialog"
            aria-modal="true"
            aria-label="方針の確認"
            onClick={(e) => e.stopPropagation()}
          >
            <p>承知しました。それでは次の方針で講義の構成を作りますね。</p>
            <PolicyBriefBlock title={displayTitle} brief={setup.brief} />
            {loading ? (
              <p className="cm-muted">講義のアウトラインを作成しています…</p>
            ) : (
              <p>よろしければ OK をクリックしてください。</p>
            )}
            <div className="cm-btn-row">
              <button
                type="button"
                className="cm-btn"
                disabled={loading}
                onClick={() => setPolicyOpen(false)}
              >
                戻る
              </button>
              <button
                type="button"
                className="cm-btn cm-btn-primary"
                disabled={loading}
                onClick={() => void confirmPolicyAndGenerate()}
              >
                {loading ? "作成中…" : "OK"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function NewCoursePage() {
  return (
    <Suspense fallback={<p className="cm-muted">読み込み中…</p>}>
      <NewCourseSetupInner />
    </Suspense>
  );
}
