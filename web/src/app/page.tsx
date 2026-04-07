"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ProjectId } from "@/lib/ao-types";
import { AoMessageMarkdown } from "@/components/AoMessageMarkdown";
import { runTypewriter } from "@/lib/ao-typewriter";
import {
  type AppState,
  type Msg,
  type Thread,
  buildDriveThreadFileName,
  buildThreadBackupPayload,
  downloadBackupFile,
  parseAppStateJson,
  parseThreadBackupJson,
} from "@/lib/ao-state";

function visibleMessages(messages: Msg[]) {
  return messages.filter((m) => !m.hiddenFromUi);
}

/** CR #69：YYYY.M.D（先頭ゼロなし） */
function formatAoDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

/** 吹き出し左の顔・名前。claude/gemini スレッドでは AI 側を常に耶律楚材／ソルコクタニで表示（本文内の幕僚名と混同しない） */
function messageFaceMeta(
  m: Msg,
  threadProjectId: ProjectId,
): { avatarKey: string; label: string } {
  if (m.side === "user") {
    return { avatarKey: "ジュチ", label: "ジュチ" };
  }
  if (threadProjectId === "claude") {
    return { avatarKey: "耶律楚材", label: "耶律楚材" };
  }
  if (threadProjectId === "gemini") {
    return { avatarKey: "ソルコクタニ", label: "ソルコクタニ" };
  }
  return { avatarKey: m.speaker, label: m.speaker };
}

type RailPane = "member" | "gel" | "recent" | "library" | "jam";

type DriveLibItem = {
  id: string;
  name: string;
  modifiedTime: string | null;
  threadTitle: string | null;
  projectId: string | null;
  parseError?: boolean;
};

const ICON = {
  member: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1 13c0-3 2.2-5 5-5s5 2 5 5" />
      <circle cx="12" cy="4" r="2" />
      <path d="M13.5 12c0-2-1.3-3.5-3-4" />
    </svg>
  ),
  gel: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M8 2L1 8h2v6h4v-4h2v4h4V8h2L8 2z" />
    </svg>
  ),
  recent: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3l2 2" />
    </svg>
  ),
  library: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M3 2.5h4.5v11H2.8a1.3 1.3 0 01-1.3-1.3V3.8a1.3 1.3 0 011.3-1.3H3z" />
      <path d="M8.5 2.5H13a1.3 1.3 0 011.3 1.3v8.4a1.3 1.3 0 01-1.3 1.3H8.5v-11z" />
      <path d="M5 5h.01M5 7.5h2M5 10h2" strokeLinecap="round" />
    </svg>
  ),
  jam: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <circle cx="8" cy="8" r="5" />
      <path
        d="M8 8l2.5-2.5M8 8l-2.5 2.5"
        strokeLinecap="round"
      />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
    </svg>
  ),
  gear: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="7" cy="7" r="4" />
      <path d="M11 11l3 3" strokeLinecap="round" />
    </svg>
  ),
  send: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8L14 2L8 14L7 9L2 8Z" />
    </svg>
  ),
  logo: (
    <svg className="ao-h-logo-icon" viewBox="0 0 22 22">
      <circle cx="11" cy="11" r="9" fill="none" stroke="#C9922A" strokeWidth="1" />
      <path d="M11 3v16M3 11h16" stroke="#C9922A" strokeWidth=".5" opacity=".4" />
      <circle cx="11" cy="11" r="2.2" fill="#C9922A" opacity=".9" />
      <circle cx="11" cy="11" r=".9" fill="#E8C060" />
    </svg>
  ),
  driveOk: (
    <svg className="ao-drive-ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25">
      <path d="M4 10.5a3.5 3.5 0 017.3.9 2.5 2.5 0 00-4.6-.9A3.5 3.5 0 014 10.5z" strokeLinejoin="round" />
      <path d="M6.2 8.3l1.4 1.4 3.2-3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  driveIdle: (
    <svg className="ao-drive-ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25">
      <path d="M4 10.5a3.5 3.5 0 017.3.9 2.5 2.5 0 00-4.6-.9A3.5 3.5 0 014 10.5z" strokeLinejoin="round" />
    </svg>
  ),
  driveUnset: (
    <svg className="ao-drive-ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.15">
      <path d="M3.5 12.5L12.5 3.5M4 10.5a3.5 3.5 0 017.3.9 2.5 2.5 0 00-4.6-.9A3.5 3.5 0 014 10.5z" strokeLinejoin="round" />
    </svg>
  ),
  jumpDown: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3v8M4.5 8.5L8 12l3.5-3.5" />
    </svg>
  ),
  /** 幕僚パネル見出し：ジュチ・ウルス（遊牧のゲル） */
  secJuchiUlus: (
    <svg className="ao-panel-sec-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 2.8c-2.8 0-4.8 1.4-4.8 3.2V13h9.6V6c0-1.8-2-3.2-4.8-3.2z" />
      <path d="M3.2 6c1.2 1.1 3 1.8 4.8 1.8s3.6-.7 4.8-1.8M6.2 9.2h3.6" />
    </svg>
  ),
  /** オゴデイ・ウルス（他ウルス・文書／朝儀） */
  secOgodeiUlus: (
    <svg className="ao-panel-sec-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 2.5h7.5a1.5 1.5 0 011.5 1.5v9a1 1 0 01-1 1H4a1 1 0 01-1-1V5.5l2-3z" />
      <path d="M6.2 6.8h4.8M6.2 9h3.6M6.2 11.2h4" />
    </svg>
  ),
  /** トゥルイ・ウルス（双星＝双子座の連想） */
  secToluiUlus: (
    <svg className="ao-panel-sec-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4.8 4.2l.35 1.05 1.1.3-.85.75.25 1.1-.95-.55-.95.55.25-1.1-.85-.75 1.1-.3.35-1.05zM11.2 8.5l.3.9.95.28-.72.63.22.98-.82-.48-.82.48.22-.98-.72-.63.95-.28.3-.9z" />
      <path d="M9.2 3.5l.25.75M6.8 12.2l.2.6" opacity="0.55" />
    </svg>
  ),
};

const STORAGE_KEY = "ao_state_v1";

const PROJECTS: Array<{ id: ProjectId; label: string; defaultThreadTitle: string }> =
  [
    { id: "shitsumu", label: "執務ゲル", defaultThreadTitle: "新規議事（執務）" },
    { id: "gungi", label: "軍議ゲル", defaultThreadTitle: "新規議事（軍議）" },
    { id: "nesho", label: "寝所ゲル", defaultThreadTitle: "新規議事（寝所）" },
    { id: "kurultai", label: "クリルタイ", defaultThreadTitle: "新規議事（クリルタイ）" },
    {
      id: "gemini",
      label: "トゥルイ・ウルス",
      defaultThreadTitle: "新規議事（トゥルイ・ウルス）",
    },
    {
      id: "claude",
      label: "オゴデイ・ウルス",
      defaultThreadTitle: "新規議事（オゴデイ・ウルス）",
    },
  ];

const INTERNAL_PERSONAS = [
  { name: "フナン", sub: "第一の千戸長・宰相\n執務ゲル" },
  { name: "モンケウール", sub: "第二の千戸長・将軍\n軍議ゲル" },
  { name: "ケテ", sub: "第三の千戸長・軍監\n軍議ゲル" },
  { name: "バイジュ", sub: "第四の千戸長・侍衛長\n寝所ゲル" },
];

const EXTERNAL_OGODEI = { name: "耶律楚材", sub: "オゴディ家 丞相" };
const EXTERNAL_TOLUI = { name: "ソルコクタニ", sub: "トゥルイ家 王妃" };

const AVATAR_SRC: Record<string, string> = {
  フナン: "/personas/hunan.png",
  モンケウール: "/personas/mongleur.png",
  ケテ: "/personas/qete.png",
  バイジュ: "/personas/baiju.png",
  耶律楚材: "/personas/yeruchusai.png",
  ソルコクタニ: "/personas/sorqaqtani.png",
  ジュチ: "/personas/juci.png",
};

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function now() {
  return Date.now();
}

function defaultNewThreadTitle(projectLabel: string) {
  const d = new Date();
  const dt = d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `新規議事（${projectLabel}）ー ${dt}`;
}

function makeInitialState(): AppState {
  const t0: Thread = {
    id: uid("th"),
    projectId: "gungi",
    title: "作戦AO — Phase 1 MVP",
    createdAt: now(),
    updatedAt: now(),
    messages: [
      {
        id: uid("m"),
        side: "ai",
        speaker: "モンケウール",
        text: "モンケウールです、殿下。まずはPhase 1として、UIの骨組みをNext.jsへ移植しました。次はゲル／議事の状態管理とOpenAI接続です。",
        createdAt: now(),
      },
      {
        id: uid("m"),
        side: "user",
        speaker: "ジュチ",
        text: "よし。続けよう。",
        createdAt: now(),
      },
    ],
  };

  return {
    version: 1,
    currentProjectId: "gungi",
    currentThreadId: t0.id,
    threads: [t0],
  };
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return makeInitialState();
    const parsed = parseAppStateJson(raw);
    if (!parsed) return makeInitialState();
    return parsed;
  } catch {
    return makeInitialState();
  }
}

function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [pane, setPane] = useState<RailPane>("member");
  const [gelDetailProjectId, setGelDetailProjectId] = useState<ProjectId | null>(null);
  const [draft, setDraft] = useState("");
  const [threadTitleEditing, setThreadTitleEditing] = useState(false);
  const [threadTitleDraft, setThreadTitleDraft] = useState("");
  const threadTitleInputRef = useRef<HTMLInputElement | null>(null);
  const threadTitleCommitEnterRef = useRef(false);
  const [state, setState] = useState<AppState | null>(null);
  const lastSavedRef = useRef<number>(0);
  const [isThinking, setIsThinking] = useState(false);
  const [isTypingReply, setIsTypingReply] = useState(false);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const currentThreadIdRef = useRef<string | null>(null);
  /** /api/chat 待ち開始時刻（「...」を最低限見せる） */
  const thinkingStartedAtRef = useRef(0);
  /** 待機ドット「.」「..」「...」「.」の位相（テキストループ） */
  const [thinkingDotPhase, setThinkingDotPhase] = useState(0);
  const gelPrimaryRef = useRef<HTMLElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [driveStatus, setDriveStatus] = useState<{
    connected: boolean;
    oauthConfigured: boolean;
  } | null>(null);
  const [driveUploading, setDriveUploading] = useState(false);
  const [driveFlash, setDriveFlash] = useState<string | null>(null);
  const [libraryView, setLibraryView] = useState<{
    thread: Thread;
    driveFileId: string;
  } | null>(null);
  const [driveLibList, setDriveLibList] = useState<DriveLibItem[]>([]);
  const [driveListLoading, setDriveListLoading] = useState(false);
  const [driveListError, setDriveListError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setState(loadState());
  }, []);

  /** 待機表示：「.」「..」「...」「.」をテキストでループ */
  useEffect(() => {
    if (!isThinking) {
      setThinkingDotPhase(0);
      return;
    }
    const id = window.setInterval(() => {
      setThinkingDotPhase((p) => (p + 1) % 4);
    }, 400);
    return () => clearInterval(id);
  }, [isThinking]);

  useEffect(() => {
    if (!mounted) return;
    (async () => {
      try {
        const r = await fetch("/api/drive/status");
        const d = (await r.json()) as {
          connected: boolean;
          oauthConfigured: boolean;
        };
        setDriveStatus({
          connected: d.connected,
          oauthConfigured: d.oauthConfigured,
        });
      } catch {
        setDriveStatus({ connected: false, oauthConfigured: false });
      }
    })();
  }, [mounted]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const drive = params.get("drive");
    if (drive === "connected") {
      setDriveFlash("Google Drive に接続しました");
      void (async () => {
        try {
          const r = await fetch("/api/drive/status");
          const d = (await r.json()) as {
            connected: boolean;
            oauthConfigured: boolean;
          };
          setDriveStatus({
            connected: d.connected,
            oauthConfigured: d.oauthConfigured,
          });
        } catch {
          /* ignore */
        }
      })();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (drive === "error") {
      const reason = params.get("reason") || "unknown";
      setDriveFlash(`Drive 接続エラー: ${reason}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted || pane !== "library" || !driveStatus?.connected) return;
    let cancelled = false;
    setDriveListLoading(true);
    setDriveListError(null);
    fetch("/api/drive/list")
      .then(async (r) => {
        const d = (await r.json()) as {
          files?: unknown;
          error?: string;
        };
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
        if (!Array.isArray(d.files)) throw new Error("一覧の形式が不正です");
        if (!cancelled) setDriveLibList(d.files as DriveLibItem[]);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setDriveListError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setDriveListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mounted, pane, driveStatus?.connected]);

  /* ゲル：アコーディオン開閉中、クリック／フォーカスがゲルパネル外へ出たら閉じる。Escape でも閉じる */
  useEffect(() => {
    if (pane !== "gel" || gelDetailProjectId === null) return;

    function isInsideGelSide(target: Node) {
      return !!gelPrimaryRef.current?.contains(target);
    }

    function onPointerDown(e: PointerEvent) {
      if (isInsideGelSide(e.target as Node)) return;
      setGelDetailProjectId(null);
    }

    function onFocusIn(e: FocusEvent) {
      if (isInsideGelSide(e.target as Node)) return;
      setGelDetailProjectId(null);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setGelDetailProjectId(null);
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [pane, gelDetailProjectId]);

  useEffect(() => {
    if (pane !== "gel") setGelDetailProjectId(null);
  }, [pane]);

  useEffect(() => {
    if (!state) return;
    const t = now();
    // throttle saves to avoid spamming localStorage while typing
    if (t - lastSavedRef.current < 400) return;
    lastSavedRef.current = t;
    saveState(state);
  }, [state]);

  const currentThread = useMemo(() => {
    if (!state) return null;
    return state.threads.find((t) => t.id === state.currentThreadId) ?? null;
  }, [state]);

  const displayThread = useMemo(() => {
    if (libraryView) return libraryView.thread;
    return currentThread;
  }, [libraryView, currentThread]);

  const displayProject = useMemo(() => {
    const pid = libraryView
      ? libraryView.thread.projectId
      : (state?.currentProjectId ?? "gungi");
    return PROJECTS.find((p) => p.id === pid) ?? PROJECTS[1];
  }, [libraryView, state?.currentProjectId]);

  useEffect(() => {
    currentThreadIdRef.current = state?.currentThreadId ?? null;
  }, [state?.currentThreadId]);

  function updateScrollStickFromUser() {
    const el = messagesScrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const distFromBottom = scrollHeight - clientHeight - scrollTop;
    const nearBottom = distFromBottom < 72;
    stickToBottomRef.current = nearBottom;
    setShowJumpToBottom(!nearBottom && scrollHeight > clientHeight + 8);
  }

  function scrollMessagesToBottom(behavior: ScrollBehavior) {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    stickToBottomRef.current = true;
    setShowJumpToBottom(false);
  }

  /** 応答待ちオーバーレイを最低 ms 見せる（高速 API でも一瞬は表示） */
  async function ensureMinThinkingVisible(ms = 420) {
    const started = thinkingStartedAtRef.current;
    if (!started) return;
    const elapsed = Date.now() - started;
    if (elapsed < ms) {
      await new Promise<void>((r) => setTimeout(r, ms - elapsed));
    }
  }

  useLayoutEffect(() => {
    if (!stickToBottomRef.current) return;
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => updateScrollStickFromUser());
  }, [displayThread?.messages, displayThread?.id, isThinking]);

  useLayoutEffect(() => {
    stickToBottomRef.current = true;
    setShowJumpToBottom(false);
    const el = messagesScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => updateScrollStickFromUser());
  }, [displayThread?.id]);

  useEffect(() => {
    if (threadTitleEditing) return;
    setThreadTitleDraft(currentThread?.title ?? "");
  }, [currentThread?.id, currentThread?.title, threadTitleEditing]);

  useEffect(() => {
    if (!threadTitleEditing) return;
    const id = requestAnimationFrame(() => {
      const el = threadTitleInputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    });
    return () => cancelAnimationFrame(id);
  }, [threadTitleEditing]);

  function commitThreadTitleEdit() {
    if (!state || !currentThread || libraryView) {
      setThreadTitleEditing(false);
      return;
    }
    const trimmed = threadTitleDraft.trim();
    if (!trimmed) {
      setThreadTitleDraft(currentThread.title);
      setThreadTitleEditing(false);
      return;
    }
    const tid = currentThread.id;
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        threads: prev.threads.map((t) =>
          t.id === tid ? { ...t, title: trimmed, updatedAt: now() } : t,
        ),
      };
    });
    setThreadTitleEditing(false);
  }

  const recentThreads = useMemo(() => {
    if (!state) return [];
    return [...state.threads].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20);
  }, [state]);

  const librarySortedFlat = useMemo(() => {
    const sortFn = (a: DriveLibItem, b: DriveLibItem) => {
      const ta = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0;
      const tb = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0;
      return tb - ta;
    };
    return [...driveLibList].sort(sortFn);
  }, [driveLibList]);

  function setCurrentThread(threadId: string) {
    setLibraryView(null);
    setGelDetailProjectId(null);
    setState((prev) => {
      if (!prev) return prev;
      const th = prev.threads.find((t) => t.id === threadId);
      if (!th) return { ...prev, currentThreadId: threadId };
      return {
        ...prev,
        currentProjectId: th.projectId,
        currentThreadId: threadId,
      };
    });
  }

  function importBackupFromFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseAppStateJson(text);
      if (!parsed) {
        window.alert(
          "バックアップファイルを読み取れませんでした。JSON形式（altan-orda-backup-v1 または version:1 の状態）を確認してください。",
        );
        return;
      }
      if (
        !window.confirm(
          "現在の議事データを、このバックアップの内容で置き換えます。よろしいですか？",
        )
      ) {
        return;
      }
      setState(parsed);
      saveState(parsed);
      setSettingsOpen(false);
    };
    reader.readAsText(file, "UTF-8");
  }

  function createThread(projectId: ProjectId) {
    setLibraryView(null);
    const project = PROJECTS.find((p) => p.id === projectId) ?? PROJECTS[0];
    const title = defaultNewThreadTitle(project.label);

    const t: Thread = {
      id: uid("th"),
      projectId,
      title,
      createdAt: now(),
      updatedAt: now(),
      messages: [],
    };

    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        currentProjectId: projectId,
        currentThreadId: t.id,
        threads: [t, ...prev.threads],
      };
    });
    setGelDetailProjectId(null);
  }

  useEffect(() => {
    if (!driveFlash) return;
    const t = setTimeout(() => setDriveFlash(null), 6000);
    return () => clearTimeout(t);
  }, [driveFlash]);

  async function saveThreadToDrive(
    th: Thread,
    opts?: { manual?: boolean },
  ) {
    const manual = opts?.manual ?? false;
    if (libraryView) return;
    if (!driveStatus?.connected) return;
    if (manual) setDriveUploading(true);
    try {
      const backupJson = buildThreadBackupPayload(th, { syncSource: "drive" });
      const fileName = buildDriveThreadFileName(th);
      const res = await fetch("/api/drive/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupJson, fileName }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; webViewLink?: string | null }
        | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      if (manual) {
        setDriveFlash(
          data.webViewLink
            ? "Drive に保存しました（リンクを発行済み）"
            : `Drive に保存しました（${fileName}）`,
        );
      }
    } catch (e) {
      if (manual) {
        window.alert(e instanceof Error ? e.message : String(e));
      } else {
        console.warn("Drive 自動保存に失敗:", e);
      }
    } finally {
      if (manual) setDriveUploading(false);
    }
  }

  async function saveToDrive() {
    if (!state || libraryView) return;
    const th = state.threads.find((t) => t.id === state.currentThreadId);
    if (!th) return;
    await saveThreadToDrive(th, { manual: true });
  }

  function handleDriveSaveClick() {
    if (!driveStatus?.oauthConfigured) return;
    if (!driveStatus.connected) {
      window.location.href = "/api/auth/google";
      return;
    }
    void saveToDrive();
  }

  async function disconnectDrive(): Promise<boolean> {
    if (!window.confirm("Google Drive との接続を解除しますか？")) return false;
    await fetch("/api/auth/google/logout", { method: "POST" });
    try {
      const r = await fetch("/api/drive/status");
      const d = (await r.json()) as {
        connected: boolean;
        oauthConfigured: boolean;
      };
      setDriveStatus({
        connected: d.connected,
        oauthConfigured: d.oauthConfigured,
      });
    } catch {
      setDriveStatus({ connected: false, oauthConfigured: false });
    }
    setDriveFlash("Drive 接続を解除しました");
    setLibraryView(null);
    setDriveLibList([]);
    setDriveListError(null);
    return true;
  }

  async function openLibraryFile(fileId: string) {
    setDriveListError(null);
    try {
      const res = await fetch(
        `/api/drive/file?fileId=${encodeURIComponent(fileId)}`,
      );
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const thread = parseThreadBackupJson(data.text ?? "");
      if (!thread) {
        window.alert(
          "JSON が altan-orda-thread-backup-v1 形式ではありません。",
        );
        return;
      }
      setLibraryView({ thread, driveFileId: fileId });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  }

  function startContinuedFromLibrary() {
    if (!libraryView || !state) return;
    const baseTitle = libraryView.thread.title;
    const newTitle = `${baseTitle}（続）`;
    const projectId = libraryView.thread.projectId;
    const t: Thread = {
      id: uid("th"),
      projectId,
      title: newTitle,
      createdAt: now(),
      updatedAt: now(),
      messages: [],
    };
    setLibraryView(null);
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        currentProjectId: projectId,
        currentThreadId: t.id,
        threads: [t, ...prev.threads],
      };
    });
    setPane("gel");
    setGelDetailProjectId(projectId);
  }

  async function sendUserMessage() {
    const text = draft.trim();
    if (!text) return;
    if (!state) return;
    if (isThinking || isTypingReply) return;
    if (libraryView) return;
    setDraft("");

    const snapshot = (() => {
      const idx = state.threads.findIndex((t) => t.id === state.currentThreadId);
      if (idx < 0) return null;
      const th = state.threads[idx];
      const nextMsg: Msg = {
        id: uid("m"),
        side: "user",
        speaker: "ジュチ",
        text,
        createdAt: now(),
      };
      const nextThread: Thread = {
        ...th,
        updatedAt: now(),
        messages: [...th.messages, nextMsg],
      };
      const nextThreads = [...state.threads];
      nextThreads[idx] = nextThread;
      const nextState: AppState = { ...state, threads: nextThreads };
      return { nextState, nextThread };
    })();

    if (!snapshot) return;
    stickToBottomRef.current = true;
    setState(snapshot.nextState);
    void saveThreadToDrive(snapshot.nextThread);
    thinkingStartedAtRef.current = Date.now();
    setIsThinking(true);

    try {
      const history = visibleMessages(snapshot.nextThread.messages).map((m) => ({
        role: m.side === "user" ? ("user" as const) : ("assistant" as const),
        content: m.text,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: snapshot.nextThread.projectId,
          messages: history,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | {
            chunks?: Array<{ speaker: string; text: string }>;
            rawContent?: string;
            error?: string;
            detail?: string;
          }
        | null;

      if (!res.ok || !data || !Array.isArray(data.chunks)) {
        await ensureMinThinkingVisible();
        const errText = data?.detail || data?.error || `HTTP ${res.status}`;
        const errMsg: Msg = {
          id: uid("m"),
          side: "ai",
          speaker: "不明",
          text: `（エラー）${errText}`,
          createdAt: now(),
        };
        const errThread: Thread = {
          ...snapshot.nextThread,
          updatedAt: now(),
          messages: [...snapshot.nextThread.messages, errMsg],
        };
        setState((prev) => {
          if (!prev) return prev;
          const idx = prev.threads.findIndex((t) => t.id === prev.currentThreadId);
          if (idx < 0) return prev;
          const nextThreads = [...prev.threads];
          nextThreads[idx] = errThread;
          return { ...prev, threads: nextThreads };
        });
        void saveThreadToDrive(errThread);
        return;
      }

      const threadId = snapshot.nextThread.id;
      await ensureMinThinkingVisible();
      setIsThinking(false);
      setIsTypingReply(true);

      try {
        const raw = typeof data.rawContent === "string" ? data.rawContent : "";
        const rawMsg: Msg | null =
          raw.trim().length > 0
            ? {
                id: uid("m"),
                side: "ai",
                speaker: "AO内部",
                text: raw,
                createdAt: now(),
                hiddenFromUi: true,
                metaKind: "openai_assistant_raw",
              }
            : null;

        for (const c of data.chunks) {
          if (currentThreadIdRef.current !== threadId) break;
          const full = c.text || "";
          const speaker = c.speaker || "不明";
          const msgId = uid("m");
          const shell: Msg = {
            id: msgId,
            side: "ai",
            speaker,
            text: "",
            createdAt: now(),
          };
          setState((prev) => {
            if (!prev || prev.currentThreadId !== threadId) return prev;
            const ti = prev.threads.findIndex((t) => t.id === threadId);
            if (ti < 0) return prev;
            const th = prev.threads[ti];
            const nt = {
              ...th,
              messages: [...th.messages, shell],
              updatedAt: now(),
            };
            const arr = [...prev.threads];
            arr[ti] = nt;
            return { ...prev, threads: arr };
          });

          setTypingMessageId(msgId);
          await runTypewriter(
            full,
            (visible) => {
              if (currentThreadIdRef.current !== threadId) return;
              setState((prev) => {
                if (!prev || prev.currentThreadId !== threadId) return prev;
                const ti = prev.threads.findIndex((t) => t.id === threadId);
                if (ti < 0) return prev;
                const th = prev.threads[ti];
                const mi = th.messages.findIndex((m) => m.id === msgId);
                if (mi < 0) return prev;
                const nm = [...th.messages];
                nm[mi] = { ...nm[mi], text: visible };
                const nt = { ...th, messages: nm, updatedAt: now() };
                const arr = [...prev.threads];
                arr[ti] = nt;
                return { ...prev, threads: arr };
              });
            },
            { isAlive: () => currentThreadIdRef.current === threadId },
          );
          setTypingMessageId(null);
        }

        if (currentThreadIdRef.current === threadId && rawMsg) {
          setState((prev) => {
            if (!prev || prev.currentThreadId !== threadId) return prev;
            const ti = prev.threads.findIndex((t) => t.id === threadId);
            if (ti < 0) return prev;
            const th = prev.threads[ti];
            const nt = {
              ...th,
              messages: [...th.messages, rawMsg],
              updatedAt: now(),
            };
            const arr = [...prev.threads];
            arr[ti] = nt;
            return { ...prev, threads: arr };
          });
        }

        if (currentThreadIdRef.current === threadId) {
          setState((prev) => {
            if (!prev || prev.currentThreadId !== threadId) return prev;
            const ti = prev.threads.findIndex((t) => t.id === threadId);
            if (ti < 0) return prev;
            const toSave = prev.threads[ti];
            queueMicrotask(() => void saveThreadToDrive(toSave));
            return prev;
          });
        }
      } finally {
        setIsTypingReply(false);
        setTypingMessageId(null);
      }
    } finally {
      thinkingStartedAtRef.current = 0;
      setIsThinking(false);
    }
  }

  const chatSection = (
    <section className="ao-chat-wrap">
      <div className="ao-gelbar">
        <div className="ao-gelinfo ao-gelinfo--stack">
          {libraryView ? (
            <>
              <div className="ao-gellbl">書庫（閲覧のみ）</div>
              <div className="ao-gelbar-gel-only">{displayProject.label}</div>
              <div className="ao-gelbar-title-row">
                <span className="ao-gelbar-title-static">
                  「{displayThread?.title ?? "—"}」
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="ao-gelbar-gel-only">{displayProject.label}</div>
              <div className="ao-gelbar-title-row">
                {threadTitleEditing ? (
                  <input
                    ref={threadTitleInputRef}
                    className="ao-gelbar-title-input"
                    value={threadTitleDraft}
                    onChange={(e) => setThreadTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        threadTitleCommitEnterRef.current = true;
                        commitThreadTitleEdit();
                        setTimeout(() => {
                          threadTitleCommitEnterRef.current = false;
                        }, 0);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setThreadTitleDraft(currentThread?.title ?? "");
                        setThreadTitleEditing(false);
                      }
                    }}
                    onBlur={() => {
                      if (threadTitleCommitEnterRef.current) return;
                      setThreadTitleDraft(currentThread?.title ?? "");
                      setThreadTitleEditing(false);
                    }}
                    aria-label="議事タイトル"
                  />
                ) : (
                  <button
                    type="button"
                    className="ao-gelbar-title-btn"
                    onClick={() => {
                      if (!currentThread) return;
                      setThreadTitleDraft(currentThread.title);
                      setThreadTitleEditing(true);
                    }}
                  >
                    「{displayThread?.title ?? "—"}」
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        <div className="ao-gelbar-actions">
          <div
            className={`ao-drive-status ${
              !driveStatus?.oauthConfigured
                ? "ao-drive-status--unset"
                : driveStatus.connected
                  ? "ao-drive-status--ok"
                  : "ao-drive-status--idle"
            }`}
            title={
              !driveStatus?.oauthConfigured
                ? "GOOGLE_CLIENT_ID 等の環境変数を設定してください"
                : driveStatus.connected
                  ? "Google Drive に接続済み"
                  : "未接続 — 「Drive に保存」で接続できます"
            }
            aria-live="polite"
          >
            {!driveStatus?.oauthConfigured ? (
              <>
                {ICON.driveUnset}
                <span>Drive 未設定</span>
              </>
            ) : driveStatus.connected ? (
              <>
                {ICON.driveOk}
                <span>Drive 接続中</span>
              </>
            ) : (
              <>
                {ICON.driveIdle}
                <span>Drive 未接続</span>
              </>
            )}
          </div>
          {!libraryView && driveStatus?.oauthConfigured ? (
            <button
              className="ao-savebtn"
              type="button"
              disabled={driveUploading || !state}
              onClick={handleDriveSaveClick}
            >
              {driveUploading ? "Drive 保存中…" : "Drive に保存"}
            </button>
          ) : null}
        </div>
      </div>
      {driveFlash ? (
        <div className="px-3 py-1.5 text-[11px] text-[var(--ao-gold-l)] border-b border-[var(--ao-gold-dim)] bg-[rgba(0,0,0,0.12)]">
          {driveFlash}
        </div>
      ) : null}

      <div className="ao-chat-messages-col">
        <div
          ref={messagesScrollRef}
          className="ao-messages"
          onScroll={updateScrollStickFromUser}
        >
          {visibleMessages(displayThread?.messages ?? []).map((m) => {
            const face = messageFaceMeta(
              m,
              displayThread?.projectId ?? state?.currentProjectId ?? "gungi",
            );
            return (
              <div
                key={m.id}
                className={`ao-msg ${m.side === "user" ? "ao-user" : "ao-ai"}`}
              >
                <div className="ao-face">
                  <div className="ao-face-img">
                    {AVATAR_SRC[face.avatarKey] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={AVATAR_SRC[face.avatarKey]} alt={face.label} />
                    ) : (
                      <span>{m.side === "user" ? "👑" : "⚔️"}</span>
                    )}
                  </div>
                  <div className="ao-face-name">{face.label}</div>
                </div>
                <div className="ao-bubble">
                  <div
                    className={`ao-spk ${m.side === "ai" && m.speaker === "ケテ" ? "ao-k" : ""}`}
                  >
                    {face.label}
                  </div>
                  {typingMessageId === m.id ? (
                    <span className="ao-typewriter-plain">{m.text}</span>
                  ) : (
                    <AoMessageMarkdown text={m.text} />
                  )}
                </div>
              </div>
            );
          })}
          {!state ? (
            <div className="text-[10px] text-[var(--ao-muted)]">読み込み中…</div>
          ) : null}
          {isThinking ? (
            <div className="ao-thinking-inline-row" role="status" aria-live="off">
              <div className="ao-thinking-bubble" aria-label="応答を生成中">
                <span className="ao-thinking-dots-text" aria-hidden>
                  {([".", "..", "...", "."] as const)[thinkingDotPhase % 4]}
                </span>
              </div>
            </div>
          ) : null}
        </div>
        {showJumpToBottom ? (
          <div className="ao-jump-bottom-strip">
            <button
              type="button"
              className="ao-jump-bottom-btn"
              onClick={() => scrollMessagesToBottom("smooth")}
              aria-label="最新の発言へスクロール"
            >
              <span className="ao-jump-bottom-btn-inner">{ICON.jumpDown}</span>
            </button>
          </div>
        ) : null}
      </div>

      {libraryView ? (
        <div className="ao-input-area ao-library-footer flex flex-col gap-2 px-3 py-3 border-t border-[var(--ao-gold-dim)] bg-[rgba(0,0,0,.15)]">
          <button
            className="ao-savebtn w-full justify-center py-2.5 text-[12px]"
            type="button"
            onClick={startContinuedFromLibrary}
          >
            新規議事を開始
          </button>
          <div className="text-[10px] text-[var(--ao-muted)] text-center leading-snug">
            タイトル: 「{libraryView.thread.title}（続）」で空の議事を開きます
          </div>
        </div>
      ) : (
        <div className="ao-input-area">
          <textarea
            placeholder="殿下の御下命を…"
            rows={2}
            value={draft}
            disabled={isThinking || isTypingReply}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                sendUserMessage();
              }
            }}
          />
          <button
            className="ao-send-btn"
            type="button"
            aria-label="送信"
            onClick={sendUserMessage}
            disabled={isThinking || isTypingReply}
            style={
              isThinking || isTypingReply
                ? { opacity: 0.6, cursor: "not-allowed" }
                : undefined
            }
          >
            {ICON.send}
          </button>
        </div>
      )}
    </section>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="ao-header">
        <div className="ao-h-logo">
          {ICON.logo}
          <div>
            <div className="ao-h-logo-text">ALTAN ORDA</div>
            <div className="ao-h-logo-sub">ジュチ・ウルス</div>
          </div>
        </div>
        <div className="ao-h-spacer" />
        <div className="ao-h-search">
          {ICON.search}
          <input type="text" placeholder="検索…" />
        </div>
      </header>

      {!mounted ? (
        <main className="ao-main flex flex-1 min-h-0">
          <div className="flex flex-1 items-center justify-center text-[var(--ao-muted)] text-[13px]">
            読み込み中…
          </div>
        </main>
      ) : (
      <main className="ao-main">
        <div className="ao-rail">
          <button
            className={`ao-r-btn ${pane === "member" ? "ao-active" : ""}`}
            onClick={() => setPane("member")}
            type="button"
          >
            {ICON.member}
            <span className="ao-r-tip">幕僚</span>
          </button>
          <button
            className={`ao-r-btn ${pane === "gel" ? "ao-active" : ""}`}
            onClick={() => setPane("gel")}
            type="button"
          >
            {ICON.gel}
            <span className="ao-r-tip">ゲル</span>
          </button>
          <button
            className={`ao-r-btn ${pane === "recent" ? "ao-active" : ""}`}
            onClick={() => setPane("recent")}
            type="button"
          >
            {ICON.recent}
            <span className="ao-r-tip">最近の項目</span>
          </button>
          <button
            className={`ao-r-btn ${pane === "library" ? "ao-active" : ""}`}
            onClick={() => setPane("library")}
            type="button"
          >
            {ICON.library}
            <span className="ao-r-tip">書庫</span>
          </button>

          <div className="ao-r-div" />

          <button
            className={`ao-r-btn ${pane === "jam" ? "ao-active" : ""}`}
            onClick={() => setPane("jam")}
            type="button"
          >
            {ICON.jam}
            <span className="ao-r-tip">ジャム（外部接続）</span>
          </button>

          <div className="ao-r-spacer" />
          <div className="ao-r-div" />

          <button
            className="ao-r-btn"
            type="button"
            onClick={() => setSettingsOpen(true)}
          >
            {ICON.gear}
            <span className="ao-r-tip">設定</span>
          </button>
        </div>

        {pane === "gel" ? (
          <div className="ao-gel-layout">
            <aside
              ref={gelPrimaryRef}
              className="ao-panel ao-panel-gel-primary ao-side-panel"
            >
              <div className="ao-panel-hdr">ゲル</div>
              <div className="ao-panel-body">
                {PROJECTS.map((p) => {
                  const threads = (state?.threads ?? []).filter((t) => t.projectId === p.id);
                  const detailOpen = gelDetailProjectId === p.id;
                  return (
                    <div
                      key={p.id}
                      className="mb-3 rounded border border-[var(--ao-gold-dim)] bg-[rgba(0,0,0,.06)] p-2"
                    >
                      <button
                        type="button"
                        className="w-full text-left px-0 py-1 rounded border border-transparent"
                        onClick={() =>
                          setGelDetailProjectId((prev) => (prev === p.id ? null : p.id))
                        }
                        aria-expanded={detailOpen}
                      >
                        <div className="text-[12px] font-bold text-[var(--ao-white)]">{p.label}</div>
                      </button>
                      <div className="mt-2 ao-panel-caption px-0.5">
                        {threads.length ? `${threads.length}件の議事` : "（議事なし）"}
                      </div>
                      <div
                        className={`ao-gel-accordion-shell ${detailOpen ? "ao-gel-accordion-shell--open" : ""}`}
                        aria-hidden={!detailOpen}
                      >
                        <div className="ao-gel-accordion-inner">
                          <div className="ao-gel-accordion mt-2 pt-2 border-t border-[var(--ao-gold-dim)]">
                            <button
                              type="button"
                              className="ao-gel-new-thread w-full px-2 py-2 rounded border border-[var(--ao-gold-dim)] hover:border-[var(--ao-gold-d)] flex items-center gap-2 mb-2"
                              onClick={() => createThread(p.id)}
                            >
                              <span className="text-[12px] leading-none font-bold text-[inherit]">
                                ＋
                              </span>{" "}
                              新規議事
                            </button>
                            {threads.length === 0 ? (
                              <div className="ao-panel-caption px-2 py-2 border border-[var(--ao-gold-dim)] rounded">
                                （議事なし）
                              </div>
                            ) : null}
                            {threads
                              .slice()
                              .sort((a, b) => b.updatedAt - a.updatedAt)
                              .slice(0, 20)
                              .map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  className={`w-full text-left px-2 py-2 rounded border mb-1 ${
                                    state?.currentThreadId === t.id
                                      ? "border-[var(--ao-gold-d)] bg-[rgba(201,146,42,.12)]"
                                      : "border-transparent hover:border-[var(--ao-gold-dim)] hover:bg-[rgba(201,146,42,.08)]"
                                  }`}
                                  onClick={() => setCurrentThread(t.id)}
                                >
                                  <div className="ao-side-thread-title">{t.title}</div>
                                  <div className="ao-panel-caption ao-side-thread-meta mt-0.5">
                                    {formatAoDate(t.updatedAt)}
                                  </div>
                                </button>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>

            <div className="ao-chat-stack">{chatSection}</div>
          </div>
        ) : pane === "library" ? (
          <div className="ao-gel-layout">
            <aside className="ao-panel ao-side-panel">
              <div className="ao-panel-hdr">書庫</div>
              <div className="ao-panel-body">
                {!driveStatus?.connected ? (
                  <div className="text-[11px] text-[var(--ao-muted)] px-2 py-2 border border-[var(--ao-gold-dim)] rounded">
                    サブヘッダーの「Drive に保存」で Google に接続すると、一覧が表示されます。
                  </div>
                ) : driveListLoading ? (
                  <div className="text-[11px] text-[var(--ao-muted)] px-2 py-2">
                    読み込み中…
                  </div>
                ) : driveListError ? (
                  <div className="text-[11px] text-red-300 px-2 py-2 border border-red-900/30 rounded">
                    {driveListError}
                  </div>
                ) : driveLibList.length === 0 ? (
                  <div className="text-[11px] text-[var(--ao-muted)] px-2 py-2 border border-[var(--ao-gold-dim)] rounded">
                    （保存済みスレッドがありません）
                  </div>
                ) : (
                  librarySortedFlat.map((f) => {
                    const title = f.threadTitle?.trim()
                      ? f.threadTitle
                      : f.name.replace(/\.json$/i, "");
                    const gelLabel = f.projectId
                      ? (PROJECTS.find((p) => p.id === f.projectId)?.label ?? "その他")
                      : "その他";
                    const dateStr = f.modifiedTime
                      ? formatAoDate(new Date(f.modifiedTime).getTime())
                      : "—";
                    return (
                      <button
                        key={f.id}
                        type="button"
                        className={`w-full text-left px-2 py-2 rounded border mb-1 ${
                          libraryView?.driveFileId === f.id
                            ? "border-[var(--ao-gold-d)] bg-[rgba(201,146,42,.12)]"
                            : "border-transparent hover:border-[var(--ao-gold-dim)] hover:bg-[rgba(201,146,42,.08)]"
                        }`}
                        onClick={() => void openLibraryFile(f.id)}
                      >
                        <div className="ao-side-thread-title">{title}</div>
                        <div className="ao-panel-caption ao-side-thread-meta mt-0.5">
                          {gelLabel} ／ {dateStr}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>
            <div className="ao-chat-stack">{chatSection}</div>
          </div>
        ) : (
          <aside className="ao-panel ao-side-panel">
          {pane === "member" ? (
            <>
              <div className="ao-panel-hdr">幕僚</div>
              <div className="ao-panel-body">
                <div className="ao-panel-sec ao-panel-sec-slg ao-panel-sec--mark px-1 pt-2 pb-1">
                  <span className="ao-panel-sec-mark" aria-hidden>
                    {ICON.secJuchiUlus}
                  </span>
                  <span>ジュチ・ウルス</span>
                </div>
                {INTERNAL_PERSONAS.map((p) => (
                  <div
                    key={p.name}
                    className="flex gap-2 items-center px-2 py-2 rounded border border-transparent"
                  >
                    <div className="ao-face-img shrink-0">
                      {AVATAR_SRC[p.name] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={AVATAR_SRC[p.name]}
                          alt=""
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <span className="text-[19px]">⚔️</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold text-[var(--ao-white)] truncate">{p.name}</div>
                      <div className="ao-panel-caption whitespace-pre-line">{p.sub}</div>
                    </div>
                  </div>
                ))}
                <div className="ao-panel-sec ao-panel-sec-slg ao-panel-sec-external ao-panel-sec--mark ao-panel-sec--mark-top px-1 pt-3 pb-1">
                  <span className="ao-panel-sec-mark" aria-hidden>
                    {ICON.secOgodeiUlus}
                  </span>
                  <div className="min-w-0">
                    <span>オゴデイ・ウルス</span>
                    <span className="ao-panel-sec-sub">（俗称 Claude）</span>
                  </div>
                </div>
                <div className="flex gap-2 items-center px-2 py-2 rounded border border-transparent opacity-70">
                  <div className="ao-face-img shrink-0">
                    {AVATAR_SRC[EXTERNAL_OGODEI.name] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={AVATAR_SRC[EXTERNAL_OGODEI.name]}
                        alt=""
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <span className="text-[19px]">🌙</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold text-[var(--ao-white)] truncate">
                      {EXTERNAL_OGODEI.name}
                    </div>
                    <div className="ao-panel-caption">{EXTERNAL_OGODEI.sub}</div>
                  </div>
                </div>
                <div className="ao-panel-sec ao-panel-sec-slg ao-panel-sec-external ao-panel-sec--mark ao-panel-sec--mark-top px-1 pt-3 pb-1">
                  <span className="ao-panel-sec-mark" aria-hidden>
                    {ICON.secToluiUlus}
                  </span>
                  <div className="min-w-0">
                    <span>トゥルイ・ウルス</span>
                    <span className="ao-panel-sec-sub">（俗称 Gemini）</span>
                  </div>
                </div>
                <div className="flex gap-2 items-center px-2 py-2 rounded border border-transparent opacity-70">
                  <div className="ao-face-img shrink-0">
                    {AVATAR_SRC[EXTERNAL_TOLUI.name] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={AVATAR_SRC[EXTERNAL_TOLUI.name]}
                        alt=""
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <span className="text-[19px]">🌙</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold text-[var(--ao-white)] truncate">
                      {EXTERNAL_TOLUI.name}
                    </div>
                    <div className="ao-panel-caption">{EXTERNAL_TOLUI.sub}</div>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {pane === "recent" ? (
            <>
              <div className="ao-panel-hdr">最近の項目</div>
              <div className="ao-panel-body">
                {recentThreads.length === 0 ? (
                  <div className="text-[11px] text-[var(--ao-muted)] px-2 py-2 border border-[var(--ao-gold-dim)] rounded">
                    （履歴なし）
                  </div>
                ) : (
                  recentThreads.slice(0, 12).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`w-full text-left px-2 py-2 rounded border mb-1 ${
                        state?.currentThreadId === t.id
                          ? "border-[var(--ao-gold-d)] bg-[rgba(201,146,42,.12)]"
                          : "border-transparent hover:border-[var(--ao-gold-dim)] hover:bg-[rgba(201,146,42,.08)]"
                      }`}
                      onClick={() => {
                        setLibraryView(null);
                        setState((prev) => {
                          if (!prev) return prev;
                          return { ...prev, currentProjectId: t.projectId, currentThreadId: t.id };
                        });
                      }}
                    >
                      <div className="ao-side-thread-title">{t.title}</div>
                      <div className="ao-panel-caption ao-side-thread-meta mt-0.5">
                        {PROJECTS.find((p) => p.id === t.projectId)?.label ?? "—"} ／{" "}
                        {formatAoDate(t.updatedAt)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : null}

          {pane === "jam" ? (
            <>
              <div className="ao-panel-hdr">ジャム — 外部接続</div>
              <div className="ao-panel-body">
                <div className="ao-panel-sec px-1 pt-2 pb-1">外部顧問（Phase 2）</div>
                <div className="text-[11px] text-[var(--ao-muted)] px-2 py-2 border border-[var(--ao-gold-dim)] rounded">
                  Phase 2でAnthropic/Gemini接続を追加します
                </div>
              </div>
            </>
          ) : null}
          </aside>
        )}

        {pane !== "gel" && pane !== "library" ? chatSection : null}
      </main>
      )}

      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importBackupFromFile(f);
          e.target.value = "";
        }}
      />

      {settingsOpen ? (
        <div
          className="ao-modal-backdrop"
          role="presentation"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="ao-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ao-settings-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="ao-modal-hdr" id="ao-settings-title">
              保存・バックアップ（Phase 2）
            </div>
            <div className="ao-modal-body">
              <p className="ao-modal-p">
                会話ログはブラウザ内（localStorage）に自動保存されます。ここから JSON
                ファイルへの書き出し・読み込みができます（手動バックアップ）。
              </p>
              <button
                type="button"
                className="ao-modal-btn"
                onClick={() => {
                  if (!state) return;
                  downloadBackupFile(state);
                }}
              >
                バックアップをダウンロード
              </button>
              <button
                type="button"
                className="ao-modal-btn ao-modal-btn-secondary"
                onClick={() => importInputRef.current?.click()}
              >
                バックアップから復元…
              </button>
              {driveStatus?.connected ? (
                <button
                  type="button"
                  className="ao-modal-btn ao-modal-btn-secondary"
                  onClick={() => {
                    void (async () => {
                      const ok = await disconnectDrive();
                      if (ok) setSettingsOpen(false);
                    })();
                  }}
                >
                  Google Drive との連携を解除…
                </button>
              ) : null}
              <button
                type="button"
                className="ao-modal-close"
                onClick={() => setSettingsOpen(false)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
