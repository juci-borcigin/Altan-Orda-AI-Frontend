"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ClipboardEvent as ReactClipboardEvent,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  AO_TOPICS,
  type TopicUiId,
  activeNokorNamesForTopic,
  threadsForTopicGiList,
  threadMatchesTopicProjectIds,
  focusStateOnTopic,
  focusStateOnGakkyuBlank,
  isGakkyuTopic,
  isAoNativeThread,
  projectIdsForTopic,
  topicUiIdForProjectId,
} from "@/lib/ao-topics";
import { uploadChatAttachment } from "@/components/ao-compose-attachments";
import { AO_ATTACHMENT_MAX_COUNT, type AoMsgAttachment } from "@/lib/ao-attachments";
import { latestClipboardFile } from "@/lib/ao-attachment-client";
import { type AoReijitsuOverlayHandle } from "@/components/AoReijitsuOverlay";
import { AoSettingsOverlay, type AoSettingsOverlayHandle, type AoSettingsSubpage } from "@/components/AoSettingsOverlay";
import {
  AO_POPUP_DELETE_LOG_FALLBACK,
  aoPopupMarkdownForBubble,
  substituteAoPopupTemplateMarkdown,
} from "@/lib/ao-popup";
import { buildAoPersonaCatalog, type AoPersonaCatalog } from "@/lib/ao-persona-display";
import { runTypewriter } from "@/lib/ao-typewriter";
import {
  type AppState,
  type Msg,
  type MsgChatCompletionMeta,
  type MsgRawPromptBundle,
  type MsgTurnUsage,
  type Thread,
  aoUid,
  makeDefaultAppState,
  pruneEphemeralEmptyThreads,
} from "@/lib/ao-state";
import type { DbThreadRow } from "@/lib/ao-supabase-thread-map";
import { msFromDb } from "@/lib/ao-supabase-thread-map";
import { historyCompressionFromDbJson, pinnedThreadIdsFromDbJson } from "@/lib/ao-history-compression-db";
import { mergeMsgsHydrateFromServer, mergeThreadSummariesIntoState } from "@/lib/ao-thread-list-merge";
import {
  applyReconciledThreadMessages,
  collectThreadsNeedingMessageRefetch,
  type ThreadMessageRefetchTarget,
} from "@/lib/ao-thread-reconcile";
import {
  aoClampStoredThreadTitle,
  aoThreadTitleForList,
  aoTitleSnippetFromFirstUserPost,
} from "@/lib/ao-thread-title";
import {
  normalizeChatUsageFromApi,
  normalizeCompletionMetaFromApi,
  normalizeRawPromptsFromApi,
} from "@/lib/ao-chat-usage-normalize";
import { AO_CHAT_CLIENT_SSE_TIMEOUT_MS, readChatSseDone } from "@/lib/ao-chat-sse";
import {
  appendAoChatClientLog,
  reportAoChatClientLog,
  type AoChatClientLogEntry,
} from "@/lib/ao-chat-client-log";
import { type AoFeatureId } from "@/components/ao-sidebar-settings-row";
import { type AoKnowledgeLayer } from "@/components/ao-knowledge-module";
import {
  AO_V2_PC_BODY_ROW_W_PX,
  AO_V2_PC_LEFT_COLUMN_W_PX,
  AO_V2_PC_MAIN_COLUMN_W_PX,
} from "@/lib/ao-v2-layout";
import {
  AoP5FaceFrameMid,
  AO_MAIN_CHAT_FACE_PORTRAIT_SCALE,
  AO_PC_NOKOR_TIGHT_PAD_X_PX,
} from "@/components/ao-phase5";
import { getPrimarySpeakerForProject } from "@/lib/ao-prompts";
import { previewAssistantStreamChunks } from "@/lib/phase5/phase5-chat-output";
import { AoKinAvatarStack, NOKOR } from "@/components/ao-left-kin-side-column";
import { AO_MAIN_TOOLBAR_ICON_SCALE, AO_THINKING_DOT_CYCLE } from "@/lib/template/ao-chrome";
import {
  AO_GIJI_TITLE_FONT_PX,
  AO_PC_HEADER_FRAME_BELOW_H_PX,
  CHAT_HISTORY_BUBBLE_MIN_H_PX,
  COMPACT_COMPOSE_INPUT_FS,
  COMPACT_COMPOSE_INPUT_VISUAL_SCALE,
  MAIN_BUBBLE_ROW_GAP_PX,
  MAIN_SPEECH_BUBBLE_H_PX,
  NOKOR_PORTRAIT_BOX_H_PX,
  NOKOR_PORTRAIT_W_PX,
  REISHI_CHRONICLE_BTN_MIN_H_PX,
  aoMainRonTabTopicFontPx,
} from "@/lib/ao-kin-layout";
import {
  getAoViewportCompactServerSnapshot,
  getAoViewportCompactSnapshot,
  subscribeAoViewportCompact,
  aoKinCenterSwipeClosesDrawer,
  aoKinCenterSwipeOpensDrawer,
  aoKinCompactKinSwipeContentTopPx,
  aoKinDrawerSwipeTargetDisallowsEdgeSwipe,
  aoCssZoomFromElement,
  aoKinTouchStartCanCloseDrawer,
  aoKinTouchStartCanOpenDrawer,
} from "@/lib/ao-viewport-compact";
import { isSyntheticAssistantNoiseForHistory, visibleMessages } from "@/lib/ao-chat-timeline";
import {
  AO_POPUP_REWIND_DELETE_FALLBACK,
  AO_POPUP_REWIND_EDIT_FALLBACK,
  aoChatErrorMessageForDisplay,
  aoSyntheticMsgTurnUsage,
  aoThinkingStatusForPhase,
  isPersistedAoMessageId,
  loadAoAppState,
  saveAoAppState,
} from "@/lib/ao-home-helpers";
import { RAW_POPOVER_W, aoCompactUserRawPanelRect, placeRawPromptPopover } from "@/lib/ao-raw-popover";
import { aoFrameAsContentPadXPx } from "@/lib/template/ao-frame-tokens";

const AGENDA_PAGE_SIZE = 15;

export function useAoChatSession() {
  const viewportCompact = useSyncExternalStore(
    subscribeAoViewportCompact,
    getAoViewportCompactSnapshot,
    getAoViewportCompactServerSnapshot,
  );
  /** SSR と初回クライアント描画を一致させるため既定のみ。復元はマウント後の effect で行う */
  const [state, setState] = useState<AppState>(() => makeDefaultAppState());
  /** localStorage 復元より先に既定 state で saveState が走ると上書き事故になるため 1 回スキップ */
  const persistReadyRef = useRef(false);
  /** 初期議事が兵馬論（work）に合わせる */
  const [selectedTopic, setSelectedTopic] = useState<TopicUiId | null>("heiba");
  /** 年代記オーバーレイから議事を開いたあとはメイン入力をロックする（投稿メニュー等で解除） */
  const [composeLocked, setComposeLocked] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [chronicleOpen, setChronicleOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** 設定ページ内サブ（帯タブと AoSettingsOverlay を同期） */
  const [settingsEmbeddedSubpage, setSettingsEmbeddedSubpage] = useState<AoSettingsSubpage>("reijitsu");
  const [usageOpen, setUsageOpen] = useState(false);
  /** AO シェル機能切替（チャット／ナレッジ） */
  const [activeFeatureId, setActiveFeatureId] = useState<AoFeatureId>("chat");
  const [knowledgeLayer, setKnowledgeLayer] = useState<AoKnowledgeLayer>("use");
  /** 新規／過去ログ一覧を、令旨・年代記と同じメイン帯オーバーレイ内に表示 */
  const [ronListOverlayOpen, setRonListOverlayOpen] = useState(false);
  /** 年代記・論議事一覧：削除確認ポップアップ対象（ローカル thread id） */
  const [deleteConfirmThreadId, setDeleteConfirmThreadId] = useState<string | null>(null);
  const [rewindConfirm, setRewindConfirm] = useState<{
    messageId: string;
    newText: string;
    deleteOnly: boolean;
  } | null>(null);
  const [editingUserMsgId, setEditingUserMsgId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [chatClientLogs, setChatClientLogs] = useState<AoChatClientLogEntry[]>([]);
  const [thinkingStatusLabel, setThinkingStatusLabel] = useState<string | null>(null);
  const [deleteLogPopupTemplate, setDeleteLogPopupTemplate] = useState(AO_POPUP_DELETE_LOG_FALLBACK);
  const [draft, setDraft] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<AoMsgAttachment[]>([]);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingDotsPhase, setThinkingDotsPhase] = useState(0);
  /** 考え中: 1=現行ドット1行 / 2=1行目固定＋2行目ドット（最終 completion 想定） */
  const [thinkingUiPhase, setThinkingUiPhase] = useState<1 | 2>(1);
  const [isTyping, setIsTyping] = useState(false);
  const [typingId, setTypingId] = useState<string | null>(null);
  const [rawPromptOverlay, setRawPromptOverlay] = useState<null | {
    variant: "ai" | "user";
    usage: MsgTurnUsage;
    completionMeta?: MsgChatCompletionMeta;
    rawPrompts?: MsgRawPromptBundle;
    attachments?: AoMsgAttachment[];
    top: number;
    left: number;
    /** スマホ・ユーザー Raw の固定矩形（未指定時は従来の max 幅・max 高さ） */
    panelWidthPx?: number;
    panelHeightPx?: number;
  }>(null);
  /** 狭ビューポート：邦主・僚友ドロワー */
  const [leftKinDrawerOpen, setLeftKinDrawerOpen] = useState(false);
  /** `.ao-mobile-stack-scale` の zoom 外へ描画する（fixed が壊れるのを避ける） */
  const [kinDrawerPortalReady, setKinDrawerPortalReady] = useState(false);

  const lastSavedRef = useRef(0);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const chatAutoStickToBottomRef = useRef(true);
  const chatScrollRafRef = useRef<number | null>(null);
  const leftColumnMeasureRef = useRef<HTMLDivElement | null>(null);
  const [leftColumnPx, setLeftColumnPx] = useState<number | null>(null);
  const ronListMeasureRef = useRef<HTMLDivElement | null>(null);
  const [ronListPx, setRonListPx] = useState<number | null>(null);
  /** 論列の横幅（「大 会 盟」実測＋枠内余白・他論ラベルとの最大） */
  const [ronColWidthPx, setRonColWidthPx] = useState<number | null>(null);
  const kuriltaiLabelMeterRef = useRef<HTMLDivElement | null>(null);
  const ronTopicLabelsProbeRef = useRef<HTMLDivElement | null>(null);
  /** 議事タイトル羊皮紙セルの実測高（右上・右下アイコン行と共通） */
  const titleChipParchmentRef = useRef<HTMLDivElement | null>(null);
  /** 狭ビュー：入力吹き出しラッパー高（論列下端に合わせる） */
  const mapBgHostRef = useRef<HTMLDivElement | null>(null);
  const [mapBgTileCount, setMapBgTileCount] = useState(1);
  const [viewportH, setViewportH] = useState<number>(0);
  const currentThreadIdRef = useRef<string | null>(null);
  const selectedTopicRef = useRef<TopicUiId | null>(selectedTopic);
  /** 論タブごとに bust 済みか（A1: 初回のみ bust=1、以降はサーバキャッシュ） */
  const threadListBustedTopicsRef = useRef<Set<string>>(new Set());
  /** 典籍論：一覧から議事を選んだときだけ ao_messages を取得する */
  const gakkyuMessagesLoadThreadIdRef = useRef<string | null>(null);
  /** 議事一覧・令旨・年代記で別論を押した直前の論（戻るで復元） */
  const topicBeforeTopicOverlayRef = useRef<TopicUiId | null>(null);
  /** 設定・使用量を開く直前の論（戻るで復元。開中は論押下なし） */
  const topicBeforeSettingsUsageRef = useRef<TopicUiId | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const composeLockedRef = useRef(composeLocked);
  const isThinkingRef = useRef(isThinking);
  const isTypingRef = useRef(isTyping);
  const reconcileAbortRef = useRef<AbortController | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  /** ヘッダ＋Frame 帯下端までの px（ドロワーをその下から縦スライドさせる） */
  const compactKinHeaderMeasureRef = useRef<HTMLElement | null>(null);
  const compactKinFrameStripMeasureRef = useRef<HTMLDivElement | null>(null);
  const [kinDrawerAnchorBottomPx, setKinDrawerAnchorBottomPx] = useState(96);
  /** シェルが visualViewport より短いとき、ドロワー host を下へ伸ばす layout px */
  const [kinDrawerHostExtendBottomPx, setKinDrawerHostExtendBottomPx] = useState(0);
  /** body ではなくページ内に載せ、ヘッダ z-10 より確実に奥に描画する */
  const [compactKinPortalHost, setCompactKinPortalHost] = useState<HTMLDivElement | null>(null);
  const [threadListAfterChatNonce, setThreadListAfterChatNonce] = useState(0);
  const settingsOverlayRef = useRef<AoSettingsOverlayHandle>(null);
  const reijitsuOverlayRef = useRef<AoReijitsuOverlayHandle>(null);
  const [settingsSavePending, setSettingsSavePending] = useState(false);
  const [reijitsuSavePending, setReijitsuSavePending] = useState(false);
  const [personaCatalog, setPersonaCatalog] = useState<AoPersonaCatalog | null>(null);
  /** 議事オーバーレイ内テーブルのページ（0 始まり） */
  const [agendaPageIndex, setAgendaPageIndex] = useState(0);
  /** 令旨／年代記オーバーレイ内一覧のページ（0 始まり） */
  const [overlayListPageIndex, setOverlayListPageIndex] = useState(0);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);

  /** A2: 起動直後のクリティカルパスを避け、idle 後にペルソナ／削除確認テンプレを取得 */
  useEffect(() => {
    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const loadPersonas = () => {
      void (async () => {
        try {
          const res = await fetch("/api/settings/ao-personas");
          const data = (await res.json()) as {
            personas?: Array<{
              persona_key: string;
              name: string;
              alias: string;
              default_project_id: string;
              avatar_path: string;
            }>;
          };
          if (!res.ok || cancelled) return;
          setPersonaCatalog(buildAoPersonaCatalog(data.personas ?? []));
        } catch {
          if (!cancelled) setPersonaCatalog(null);
        }
      })();
    };

    const schedule = () => {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(loadPersonas, { timeout: 3000 });
      } else {
        timeoutId = setTimeout(loadPersonas, 1500);
      }
    };

    schedule();
    return () => {
      cancelled = true;
      if (idleId != null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const loadDeleteLog = () => {
      void (async () => {
        try {
          const res = await fetch("/api/popup/delete_log");
          if (!res.ok || cancelled) return;
          const data = (await res.json()) as { template_text?: string };
          if (data.template_text?.trim()) setDeleteLogPopupTemplate(data.template_text);
        } catch {
          /* fallback template */
        }
      })();
    };

    const schedule = () => {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(loadDeleteLog, { timeout: 4000 });
      } else {
        timeoutId = setTimeout(loadDeleteLog, 2000);
      }
    };

    schedule();
    return () => {
      cancelled = true;
      if (idleId != null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, []);

  const reconcileThreadMessages = useCallback(
    async (
      targets: ThreadMessageRefetchTarget[],
      signal?: AbortSignal,
      opts?: { force?: boolean },
    ) => {
      if (!targets.length) return;
      const curId = currentThreadIdRef.current;
      const filtered = targets.filter((t) => {
        if (opts?.force) return true;
        if (t.clientId !== curId) return true;
        return !isThinkingRef.current && !isTypingRef.current;
      });
      if (!filtered.length) return;

      for (const target of filtered) {
        if (signal?.aborted) return;
        try {
          const r = await fetch(`/api/threads/${encodeURIComponent(target.supabaseThreadId)}/messages`, {
            signal,
          });
          if (!r.ok) continue;
          const data = (await r.json()) as {
            messages?: Msg[];
            updatedAt?: string;
            historyCompression?: { fromMessageId: string; summary: string } | null;
            pinnedThreadIds?: string[];
          };
          const msgs = Array.isArray(data.messages) ? data.messages : [];
          const updatedAt = data.updatedAt ? msFromDb(data.updatedAt) : undefined;
          const hc =
            data.historyCompression === null
              ? null
              : historyCompressionFromDbJson(data.historyCompression) ??
                (data.historyCompression?.fromMessageId && data.historyCompression?.summary
                  ? data.historyCompression
                  : undefined);
          const pinnedThreadIds = Array.isArray(data.pinnedThreadIds)
            ? pinnedThreadIdsFromDbJson(data.pinnedThreadIds)
            : undefined;

          setState((prev) => {
            const live = prev.threads.find((t) => t.id === target.clientId);
            if (!live) return prev;
            if (live.ephemeral) return prev;
            if (
              !opts?.force &&
              live.id === currentThreadIdRef.current &&
              (isThinkingRef.current || isTypingRef.current)
            ) {
              return prev;
            }
            return applyReconciledThreadMessages(prev, target.clientId, msgs, {
              ...(hc !== undefined ? { historyCompression: hc } : {}),
              ...(pinnedThreadIds !== undefined ? { pinnedThreadIds } : {}),
              ...(updatedAt !== undefined ? { updatedAt } : {}),
            });
          });
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          console.error("[ao] thread messages reconcile", e);
        }
      }
    },
    [],
  );

  const fetchThreadListWithTopic = useCallback(
    async (bust: boolean, topic: TopicUiId | null, signal?: AbortSignal) => {
      const pids = projectIdsForTopic(topic);
      if (!pids?.length) return;
      try {
        /** /api/threads/list は limit 最大 50。年代記に載るメタはここ経由のみのため、既定は上限に寄せる */
        const q = new URLSearchParams({ projects: pids.join(","), limit: "50", offset: "0" });
        if (bust) q.set("bust", "1");
        const r = await fetch(`/api/threads/list?${q}`, { signal });
        if (!r.ok) {
          setSyncNotice(`議事一覧の同期に失敗しました（HTTP ${r.status}）。しばらくしてから論タブを開き直してください。`);
          return;
        }
        const data = (await r.json()) as { threads?: DbThreadRow[]; error?: string };
        if (data.error) {
          console.error("[ao] /api/threads/list:", data.error);
          setSyncNotice(`議事一覧の同期に失敗しました: ${data.error}`);
          return;
        }
        if (!Array.isArray(data.threads)) return;

        let refetchTargets: ThreadMessageRefetchTarget[] = [];
        setState((prev) => {
          refetchTargets = collectThreadsNeedingMessageRefetch(prev, data.threads ?? []);
          return mergeThreadSummariesIntoState(prev, data.threads ?? [], pids);
        });
        if (refetchTargets.length > 0) {
          void reconcileThreadMessages(refetchTargets, signal);
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        console.error("[ao] thread list fetch", e);
        setSyncNotice("議事一覧の同期に失敗しました。ネットワークを確認してください。");
      }
    },
    [reconcileThreadMessages],
  );

  useEffect(() => {
    if (!contextOpen) setSettingsEmbeddedSubpage("reijitsu");
  }, [contextOpen]);

  useEffect(() => {
    const loaded = loadAoAppState();
    setState(focusStateOnTopic(loaded, selectedTopic ?? "heiba"));
  }, []);

  /** 論タブ変更時：表示中議事が論とずれていれば最新（またはブランク）へ合わせる */
  useEffect(() => {
    if (!selectedTopic) return;
    if (isGakkyuTopic(selectedTopic)) {
      setState((prev) => {
        const pids = projectIdsForTopic("gakkyu");
        if (!pids?.length) return prev;
        const cur = prev.threads.find((t) => t.id === prev.currentThreadId);
        if (cur && threadMatchesTopicProjectIds(cur, pids)) return prev;
        return focusStateOnGakkyuBlank(prev);
      });
      return;
    }
    setState((prev) => {
      const pids = projectIdsForTopic(selectedTopic);
      if (!pids?.length) return prev;
      const cur = prev.threads.find((t) => t.id === prev.currentThreadId);
      if (cur && threadMatchesTopicProjectIds(cur, pids)) return prev;
      return focusStateOnTopic(prev, selectedTopic);
    });
  }, [selectedTopic]);

  useEffect(() => {
    if (!isGakkyuTopic(selectedTopic)) {
      gakkyuMessagesLoadThreadIdRef.current = null;
    }
  }, [selectedTopic]);

  useEffect(() => {
    if (!persistReadyRef.current) {
      persistReadyRef.current = true;
      return;
    }
    const t = Date.now();
    if (t - lastSavedRef.current < 400) return;
    lastSavedRef.current = t;
    if (!saveAoAppState(state)) {
      setSyncNotice("この端末への保存に失敗しました（容量不足やプライベートモードの可能性があります）。画面上の内容は残っていますが、再読み込みで消えることがあります。");
    }
  }, [state]);

  const currentThread = useMemo(() => {
    return state.threads.find((t) => t.id === state.currentThreadId) ?? null;
  }, [state]);

  /** 年代記など：Supabase 同期済みメタのみで messages が空のとき、遅延取得 */
  useEffect(() => {
    const th = currentThread;
    if (!th?.supabaseThreadId || th.ephemeral || th.messages.length > 0 || th.serverMessagesLoaded === true) {
      return;
    }
    /** 典籍論は一覧から選んだ議事だけ DB（ao_messages）を読む */
    if (th.projectId === "notebook" && gakkyuMessagesLoadThreadIdRef.current !== th.id) {
      return;
    }
    const sid = th.supabaseThreadId;
    const clientId = th.id;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`/api/threads/${encodeURIComponent(sid)}/messages`);
        if (cancelled) return;
        if (!r.ok) {
          if (r.status === 404) {
            setState((p) =>
              applyRemoveThreadFromState(p, clientId, selectedTopicRef.current),
            );
            return;
          }
          setState((p) => ({
            ...p,
            threads: p.threads.map((t) => {
              if (t.id !== clientId) return t;
              if (t.messages.length > 0) return { ...t, serverMessagesLoaded: true };
              return { ...t, messages: [], serverMessagesLoaded: true };
            }),
          }));
          return;
        }
        const data = (await r.json()) as {
          messages?: Msg[];
          updatedAt?: string;
          historyCompression?: { fromMessageId: string; summary: string } | null;
          pinnedThreadIds?: string[];
        };
        const msgs = Array.isArray(data.messages) ? data.messages : [];
        if (cancelled) return;
        const updatedAt = data.updatedAt ? msFromDb(data.updatedAt) : undefined;
        const hc =
          data.historyCompression === null
            ? null
            : historyCompressionFromDbJson(data.historyCompression) ??
              (data.historyCompression?.fromMessageId && data.historyCompression?.summary
                ? data.historyCompression
                : undefined);
        const pinnedThreadIds = Array.isArray(data.pinnedThreadIds)
          ? pinnedThreadIdsFromDbJson(data.pinnedThreadIds)
          : undefined;
        setState((p) => {
          const live = p.threads.find((t) => t.id === clientId);
          if (!live || live.messages.length > 0) {
            return {
              ...p,
              threads: p.threads.map((t) => {
                if (t.id !== clientId) return t;
                if (t.messages.length > 0) return { ...t, serverMessagesLoaded: true };
                return { ...t, messages: [], serverMessagesLoaded: true };
              }),
            };
          }
          return applyReconciledThreadMessages(p, clientId, msgs, {
            ...(hc !== undefined ? { historyCompression: hc } : {}),
            ...(pinnedThreadIds !== undefined ? { pinnedThreadIds } : {}),
            ...(updatedAt !== undefined ? { updatedAt } : {}),
          });
        });
      } catch {
        if (!cancelled) {
          setState((p) => ({
            ...p,
            threads: p.threads.map((t) => {
              if (t.id !== clientId) return t;
              if (t.messages.length > 0) return { ...t, serverMessagesLoaded: true };
              return { ...t, messages: [], serverMessagesLoaded: true };
            }),
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    currentThread?.id,
    currentThread?.supabaseThreadId,
    currentThread?.messages.length,
    currentThread?.ephemeral,
    currentThread?.serverMessagesLoaded,
  ]);

  const activeNokorNames = useMemo(() => activeNokorNamesForTopic(selectedTopic), [selectedTopic]);

  const topicThreads = useMemo(() => {
    if (!selectedTopic) return [];
    return threadsForTopicGiList(state.threads, selectedTopic);
  }, [state.threads, selectedTopic]);

  /** メイン右列：選択論の議事一覧（新規／過去ログテーブル用） */
  const ronSidebarThreads = useMemo(() => {
    if (!selectedTopic) return [];
    return threadsForTopicGiList(state.threads, selectedTopic);
  }, [state.threads, selectedTopic]);

  const agendaMaxPageIndex = useMemo(() => {
    const n = ronSidebarThreads.length;
    return Math.max(0, Math.ceil(n / AGENDA_PAGE_SIZE) - 1);
  }, [ronSidebarThreads]);

  const agendaRowsSlice = useMemo(() => {
    const start = agendaPageIndex * AGENDA_PAGE_SIZE;
    return ronSidebarThreads.slice(start, start + AGENDA_PAGE_SIZE);
  }, [ronSidebarThreads, agendaPageIndex]);

  useEffect(() => {
    setAgendaPageIndex(0);
  }, [selectedTopic]);

  useEffect(() => {
    setAgendaPageIndex((i) => Math.min(i, agendaMaxPageIndex));
  }, [agendaMaxPageIndex]);

  /** メッセージ追記・タイプライター・応答待ちのたびに末尾スクロール用シグネチャ */
  const chatScrollSignature = useMemo(() => {
    if (!currentThread) return "";
    const msgs = visibleMessages(currentThread.messages);
    const tail = msgs.map((m) => `${m.id}:${m.text.length}`).join(";");
    return `${currentThread.id}:${tail}:${isThinking ? "1" : "0"}:${typingId ?? ""}`;
  }, [currentThread, isThinking, typingId]);

  function scrollChatPaneToBottom() {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  useEffect(() => {
    if (chatAutoStickToBottomRef.current) scrollChatPaneToBottom();
  }, [chatScrollSignature]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const pane = messagesRef.current;
      if (pane && chatAutoStickToBottomRef.current) pane.scrollTop = pane.scrollHeight;
    });
    ro.observe(el);
    const onWinResize = () => scrollChatPaneToBottom();
    window.addEventListener("resize", onWinResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWinResize);
    };
  }, []);

  useEffect(() => {
    if (viewportCompact) return;
    const el = leftColumnMeasureRef.current;
    if (!el) return;
    // getBoundingClientRect は「見えている高さ」になり得るため、内容高（scrollHeight）を優先する
    const sync = () => setLeftColumnPx(el.scrollHeight);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [viewportCompact]);

  useEffect(() => {
    const el = ronListMeasureRef.current;
    if (!el) return;
    const sync = () =>
      setRonListPx(Math.max(1, el.offsetHeight || Math.ceil(el.getBoundingClientRect().height)));
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [viewportCompact, selectedTopic]);

  useEffect(() => {
    const sync = () => setViewportH(typeof window !== "undefined" ? window.innerHeight : 0);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    if (!isThinking) {
      setThinkingDotsPhase(0);
      return;
    }
    const id = window.setInterval(() => setThinkingDotsPhase((p) => (p + 1) % AO_THINKING_DOT_CYCLE.length), 520);
    return () => clearInterval(id);
  }, [isThinking]);

  useEffect(() => {
    if (!isThinking) return;
    const el = messagesRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [isThinking]);

  useEffect(() => {
    if (!rawPromptOverlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRawPromptOverlay(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rawPromptOverlay]);

  useEffect(() => {
    if (!leftKinDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLeftKinDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leftKinDrawerOpen]);

  useEffect(() => {
    setKinDrawerPortalReady(true);
  }, []);

  useEffect(() => {
    if (!viewportCompact) {
      return;
    }
    const hdr = compactKinHeaderMeasureRef.current;
    const frm = compactKinFrameStripMeasureRef.current;
    const sync = () => {
      const scaleEl = hdr?.closest(".ao-mobile-stack-scale");
      const scaleHtml = scaleEl instanceof HTMLElement ? scaleEl : null;
      const zoom = aoCssZoomFromElement(scaleHtml);
      const hb = hdr?.getBoundingClientRect().bottom ?? 0;
      const fb = frm?.getBoundingClientRect().bottom ?? 0;
      const headerBottomVisual = Math.max(hb, fb);
      if (scaleHtml && headerBottomVisual > 0) {
        const scaleTop = scaleHtml.getBoundingClientRect().top;
        setKinDrawerAnchorBottomPx(Math.round((headerBottomVisual - scaleTop) / zoom));
        const vvH =
          window.visualViewport && typeof window.visualViewport.height === "number"
            ? window.visualViewport.height
            : window.innerHeight;
        const gapVisual = vvH - scaleHtml.getBoundingClientRect().bottom;
        setKinDrawerHostExtendBottomPx(gapVisual > 0.5 ? Math.ceil(gapVisual / zoom) : 0);
      } else if (headerBottomVisual > 0) {
        setKinDrawerAnchorBottomPx(Math.round(headerBottomVisual));
        setKinDrawerHostExtendBottomPx(0);
      }
    };
    sync();
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    const ro = new ResizeObserver(sync);
    if (hdr) ro.observe(hdr);
    if (frm) ro.observe(frm);
    return () => {
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      ro.disconnect();
    };
  }, [viewportCompact]);

  useEffect(() => {
    if (!viewportCompact) return;
    if (
      contextOpen ||
      chronicleOpen ||
      settingsOpen ||
      usageOpen ||
      ronListOverlayOpen ||
      rawPromptOverlay
    ) {
      setLeftKinDrawerOpen(false);
    }
  }, [
    viewportCompact,
    contextOpen,
    chronicleOpen,
    settingsOpen,
    usageOpen,
    ronListOverlayOpen,
    rawPromptOverlay,
  ]);

  useEffect(() => {
    const host = mapBgHostRef.current;
    if (!host) return;

    const TILE_H = 1024; // map-bg1.png の高さ（現状採用画像）
    // kinDrawerAnchorBottomPx を依存に含め、ヘッダ計測確定後にも再実行する（初期フレームのタイル不足防止）
    const recompute = () => {
      // 下端の白抜けは「見えている高さ」を参照してタイル枚数が足りないのが原因。
      const winH =
        typeof window !== "undefined"
          ? Math.max(
              window.visualViewport?.height ?? 0,
              window.innerHeight,
              document.documentElement?.clientHeight ?? 0,
            )
          : viewportH;
      const topCompact = viewportCompact
        ? aoKinCompactKinSwipeContentTopPx(compactKinHeaderMeasureRef.current, compactKinFrameStripMeasureRef.current)
        : 0;
      const viewportMainH = viewportCompact
        ? Math.max(0, winH - (topCompact > 0 ? topCompact : AO_PC_HEADER_FRAME_BELOW_H_PX))
        : Math.max(0, viewportH - AO_PC_HEADER_FRAME_BELOW_H_PX);
      let rectH = 0;
      try {
        rectH = host.getBoundingClientRect().height;
      } catch {
        /* ignore */
      }
      const h = Math.max(leftColumnPx ?? 0, viewportMainH, rectH, host.scrollHeight, host.clientHeight);
      if (!h) return;
      const slack = viewportCompact ? 5 : 2;
      setMapBgTileCount(Math.max(1, Math.ceil(h / TILE_H) + slack));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(host);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [leftColumnPx, viewportH, viewportCompact, kinDrawerAnchorBottomPx]);

  useEffect(() => {
    currentThreadIdRef.current = state.currentThreadId ?? null;
  }, [state.currentThreadId]);

  useEffect(() => {
    selectedTopicRef.current = selectedTopic;
  }, [selectedTopic]);

  useEffect(() => {
    const ac = new AbortController();
    const topic = selectedTopic;
    if (isGakkyuTopic(topic)) return () => ac.abort();
    const topicKey = topic ?? "__none__";
    const pids = projectIdsForTopic(topic);
    const needBust = Boolean(topic && pids?.length && !threadListBustedTopicsRef.current.has(topicKey));
    if (needBust) threadListBustedTopicsRef.current.add(topicKey);
    void fetchThreadListWithTopic(needBust, topic, ac.signal);
    return () => ac.abort();
  }, [selectedTopic, fetchThreadListWithTopic]);

  useEffect(() => {
    if (threadListAfterChatNonce === 0) return;
    if (isGakkyuTopic(selectedTopicRef.current)) return;
    const ac = new AbortController();
    void fetchThreadListWithTopic(true, selectedTopicRef.current, ac.signal);
    return () => ac.abort();
  }, [threadListAfterChatNonce, fetchThreadListWithTopic]);

  useEffect(() => {
    composeLockedRef.current = composeLocked;
  }, [composeLocked]);

  useEffect(() => {
    isThinkingRef.current = isThinking;
  }, [isThinking]);

  useEffect(() => {
    isTypingRef.current = isTyping;
  }, [isTyping]);

  /** タブ復帰時に議事一覧を再取得し、B案リコンシリエーションを走らせる */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (isGakkyuTopic(selectedTopicRef.current)) return;
      reconcileAbortRef.current?.abort();
      const ac = new AbortController();
      reconcileAbortRef.current = ac;
      void fetchThreadListWithTopic(true, selectedTopicRef.current, ac.signal);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      reconcileAbortRef.current?.abort();
    };
  }, [fetchThreadListWithTopic]);

  function scheduleFocusMainPrompt() {
    if (composeLockedRef.current) return;
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        promptTextareaRef.current?.focus({ preventScroll: true });
      });
    });
  }

  function selectRonAgendaThread(t: Thread) {
    if (t.projectId === "notebook") {
      gakkyuMessagesLoadThreadIdRef.current = t.id;
    }
    setComposeLocked(false);
    setCurrentThread(t.id);
    const topic = topicUiIdForProjectId(t.projectId);
    if (topic) setSelectedTopic(topic);
    topicBeforeTopicOverlayRef.current = null;
    setRonListOverlayOpen(false);
    scheduleFocusMainPrompt();
  }

  function setCurrentThread(threadId: string) {
    setState((prev) => {
      const pruned = pruneEphemeralEmptyThreads(prev);
      const th = pruned.threads.find((t) => t.id === threadId);
      if (!th) return pruned;
      return { ...pruned, currentThreadId: th.id, currentProjectId: th.projectId };
    });
  }

  useEffect(() => {
    if (!titleEditing) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [titleEditing]);

  useEffect(() => {
    if (titleEditing) return;
    setTitleDraft(currentThread?.title ?? "");
  }, [currentThread?.id, currentThread?.title, titleEditing]);

  function closeMainSubOverlaysExceptRon() {
    setContextOpen(false);
    setChronicleOpen(false);
    setSettingsOpen(false);
    setUsageOpen(false);
  }

  function restoreTopicFromBeforeTopicOverlay() {
    const restore = topicBeforeTopicOverlayRef.current;
    if (restore != null) {
      setSelectedTopic(restore);
      topicBeforeTopicOverlayRef.current = null;
    } else if (currentThread) {
      const fromThread = topicUiIdForProjectId(currentThread.projectId);
      if (fromThread) setSelectedTopic(fromThread);
    }
  }

  function restoreTopicFromBeforeSettingsUsage() {
    const restore = topicBeforeSettingsUsageRef.current;
    if (restore != null) {
      setSelectedTopic(restore);
      topicBeforeSettingsUsageRef.current = null;
    } else if (currentThread) {
      const fromThread = topicUiIdForProjectId(currentThread.projectId);
      if (fromThread) setSelectedTopic(fromThread);
    }
  }

  /** 設定・使用量を閉じ、開く前に選んでいた論を押下状態に戻す */
  function closeSettingsUsageOverlay() {
    setSettingsOpen(false);
    setUsageOpen(false);
    restoreTopicFromBeforeSettingsUsage();
    scheduleFocusMainPrompt();
  }


  function openUsageOverlay() {
    setRonListOverlayOpen(false);
    setContextOpen(false);
    setChronicleOpen(false);
    setSettingsOpen(false);
    setUsageOpen(true);
  }

  function closeUsageViewPanel() {
    setUsageOpen(false);
    scheduleFocusMainPrompt();
  }

  function openChronicleOverlay() {
    setRonListOverlayOpen(false);
    setContextOpen(false);
    setUsageOpen(false);
    setSettingsOpen(false);
    topicBeforeTopicOverlayRef.current = null;
    setChronicleOpen(true);
    void fetchThreadListWithTopic(false, selectedTopicRef.current);
  }

  function openContextOverlay() {
    setRonListOverlayOpen(false);
    setChronicleOpen(false);
    setUsageOpen(false);
    setSettingsOpen(false);
    topicBeforeTopicOverlayRef.current = null;
    let topicForOpen = selectedTopicRef.current;
    if (!topicForOpen && currentThread) {
      topicForOpen = topicUiIdForProjectId(currentThread.projectId);
      if (topicForOpen) {
        selectedTopicRef.current = topicForOpen;
        setSelectedTopic(topicForOpen);
      }
    }
    setSettingsEmbeddedSubpage("reijitsu");
    setContextOpen(true);
    void fetchThreadListWithTopic(false, topicForOpen);
  }

  /** 令旨・年代記オーバーレイを閉じ、未確定の論切替を戻す */
  function closeContextChronicleOverlay() {
    setContextOpen(false);
    setChronicleOpen(false);
    setRonListOverlayOpen(false);
    restoreTopicFromBeforeTopicOverlay();
    scheduleFocusMainPrompt();
  }

  /** 議事一覧オーバーレイを閉じ、新規／過去ログ未選択なら表示中議事の論タブへ戻す */
  function closeRonAgendaOverlay() {
    setContextOpen(false);
    setChronicleOpen(false);
    setSettingsOpen(false);
    setUsageOpen(false);
    setRonListOverlayOpen(false);
    restoreTopicFromBeforeTopicOverlay();
    scheduleFocusMainPrompt();
  }

  /** メイン帯オーバーレイ共通「戻る」 */
  function onMainOverlayBackClick() {
    if (showRonAgendaPanel) {
      closeRonAgendaOverlay();
      return;
    }
    if (usageOpen) {
      closeUsageViewPanel();
      return;
    }
    if (settingsOpen) {
      closeSettingsUsageOverlay();
      return;
    }
    if (overlayMode) {
      closeContextChronicleOverlay();
      return;
    }
    setContextOpen(false);
    setChronicleOpen(false);
    setSettingsOpen(false);
    setUsageOpen(false);
    setRonListOverlayOpen(false);
    scheduleFocusMainPrompt();
  }

  function dismissSettingsUsageBeforeTopicNav() {
    if (!settingsOpen && !usageOpen) return;
    setSettingsOpen(false);
    setUsageOpen(false);
    restoreTopicFromBeforeSettingsUsage();
  }

  function topicRonLabelForThread(th: Thread, topic: TopicUiId | null): string {
    const tid = topicUiIdForProjectId(th.projectId);
    const id = tid ?? topic;
    if (!id) return "";
    return AO_TOPICS.find((t) => t.id === id)?.label ?? "";
  }

  /** DELETE /api/threads：404 は他端末等で既に消えている＝ローカル削除を続行 */
  function aoDeleteThreadApiSucceeded(res: Response): boolean {
    return res.ok || res.status === 404;
  }

  function applyRemoveThreadFromState(
    prev: AppState,
    threadId: string,
    topicForRefresh: TopicUiId | null,
  ): AppState {
    const removed = prev.threads.find((t) => t.id === threadId);
    const rest = prev.threads.filter((t) => t.id !== threadId);
    if (prev.currentThreadId !== threadId) {
      return { ...prev, threads: rest };
    }
    const deletedProjectId = removed?.projectId;
    const sameProject = rest.find((t) => t.projectId === deletedProjectId && !t.ephemeral);
    const fallback = sameProject ?? rest.find((t) => t.projectId === deletedProjectId) ?? rest[0];
    if (fallback) {
      return {
        ...prev,
        threads: rest,
        currentThreadId: fallback.id,
        currentProjectId: fallback.projectId,
      };
    }
    if (topicForRefresh) {
      return focusStateOnTopic({ ...prev, threads: rest }, topicForRefresh);
    }
    return {
      ...prev,
      threads: rest.length > 0 ? rest : prev.threads,
      currentThreadId: rest[0]?.id ?? prev.currentThreadId,
      currentProjectId: rest[0]?.projectId ?? prev.currentProjectId,
    };
  }

  function requestDeleteAoThread(threadId: string) {
    const th = state.threads.find((t) => t.id === threadId);
    if (!th || deletingThreadId) return;
    if (!isAoNativeThread(th)) {
      window.alert("取り込み済みの議事はここから削除できません。");
      return;
    }
    setDeleteConfirmThreadId(threadId);
  }

  async function deleteAoThread(threadId: string) {
    const th = state.threads.find((t) => t.id === threadId);
    if (!th || deletingThreadId) return;
    if (!isAoNativeThread(th)) {
      window.alert("取り込み済みの議事はここから削除できません。");
      return;
    }

    setDeleteConfirmThreadId(null);
    setDeletingThreadId(threadId);
    try {
      if (th.supabaseThreadId) {
        const res = await fetch(`/api/threads/${encodeURIComponent(th.supabaseThreadId)}`, {
          method: "DELETE",
        });
        if (!aoDeleteThreadApiSucceeded(res)) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          window.alert(data.error ?? `削除に失敗しました（${res.status}）`);
          return;
        }
      }

      const topicForRefresh = selectedTopicRef.current;
      const wasCurrent = state.currentThreadId === threadId;

      setState((prev) => applyRemoveThreadFromState(prev, threadId, topicForRefresh));

      if (wasCurrent) {
        setComposeLocked(false);
        clearComposeInput();
      }

      if (topicForRefresh) {
        void fetchThreadListWithTopic(false, topicForRefresh);
      }
    } finally {
      setDeletingThreadId(null);
    }
  }

  function onMainRonTabClick(topicId: TopicUiId) {
    const inChronicleOrReijitsu = Boolean(chronicleOpen || contextOpen);

    dismissSettingsUsageBeforeTopicNav();

    if (!inChronicleOrReijitsu) {
      setComposeLocked(false);
    }

    const prevSel = selectedTopicRef.current;
    if (prevSel === topicId) {
      if (inChronicleOrReijitsu) {
        return;
      }
      setRonListOverlayOpen((o) => {
        if (!o) closeMainSubOverlaysExceptRon();
        return !o;
      });
      topicBeforeTopicOverlayRef.current = null;
      return;
    }

    if (inChronicleOrReijitsu) {
      if (prevSel !== topicId) {
        topicBeforeTopicOverlayRef.current = prevSel;
      }
      setSelectedTopic(topicId);
      if (isGakkyuTopic(topicId)) {
        gakkyuMessagesLoadThreadIdRef.current = null;
        setState((prev) => focusStateOnGakkyuBlank(prev));
        setComposeLocked(true);
        setRonListOverlayOpen(true);
      } else {
        setState((prev) => focusStateOnTopic(prev, topicId));
      }
      clearComposeInput();
      return;
    }

    closeMainSubOverlaysExceptRon();
    topicBeforeTopicOverlayRef.current = prevSel;
    if (isGakkyuTopic(topicId)) {
      gakkyuMessagesLoadThreadIdRef.current = null;
      setSelectedTopic(topicId);
      setState((prev) => focusStateOnGakkyuBlank(prev));
      clearComposeInput();
      setComposeLocked(true);
      setRonListOverlayOpen(true);
      return;
    }
    setSelectedTopic(topicId);
    setState((prev) => focusStateOnTopic(prev, topicId));
    clearComposeInput();
    setRonListOverlayOpen(false);
    scheduleFocusMainPrompt();
  }

  function clearComposeInput() {
    setDraft("");
    setPendingAttachments([]);
  }

  async function onComposePaste(e: ReactClipboardEvent<HTMLTextAreaElement>) {
    if (composeLocked || !currentThread || isThinking || isTyping) return;
    if (pendingAttachments.length >= AO_ATTACHMENT_MAX_COUNT) return;
    const items = e.clipboardData?.items;
    if (!items?.length) return;
    const raw = latestClipboardFile(items);
    if (!raw) return;
    try {
      const att = await uploadChatAttachment(raw, currentThread.id);
      setPendingAttachments((prev) => {
        if (prev.length >= AO_ATTACHMENT_MAX_COUNT) return prev;
        return [...prev, att];
      });
    } catch (err) {
      console.error("[attach paste]", err);
    }
  }

  async function onAttachFilesSelected(files: FileList | null) {
    if (!files?.length || !currentThread || composeLocked) return;
    const room = AO_ATTACHMENT_MAX_COUNT - pendingAttachments.length;
    if (room <= 0) return;
    const slice = Array.from(files).slice(0, room);
    const added: AoMsgAttachment[] = [];
    for (const file of slice) {
      try {
        added.push(await uploadChatAttachment(file, currentThread.id));
      } catch (e) {
        console.error("[attach]", e);
      }
    }
    if (added.length) setPendingAttachments((prev) => [...prev, ...added]);
    if (attachInputRef.current) attachInputRef.current.value = "";
  }

  function reportChatFailure(message: string, cause?: unknown, detail?: string) {
    reportAoChatClientLog("error", message, detail, cause);
    setChatClientLogs((prev) => appendAoChatClientLog(prev, "error", message, detail));
    setChatError(message);
  }

  async function togglePinnedThreadForCurrent(refThread: Thread) {
    const cur = state.threads.find((t) => t.id === state.currentThreadId);
    if (!cur?.supabaseThreadId || !refThread.supabaseThreadId) return;
    if (cur.id === refThread.id) return;
    const sid = refThread.supabaseThreadId;
    const prevPins = cur.pinnedThreadIds ?? [];
    const nextPins = prevPins.includes(sid) ? prevPins.filter((x) => x !== sid) : [...prevPins, sid];
    setState((p) => ({
      ...p,
      threads: p.threads.map((t) =>
        t.id === cur.id ? { ...t, pinnedThreadIds: nextPins } : t,
      ),
    }));
    try {
      const res = await fetch(`/api/threads/${encodeURIComponent(cur.supabaseThreadId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinnedThreadIds: nextPins }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `pin failed ${res.status}`);
      }
      const data = (await res.json()) as { pinnedThreadIds?: string[]; updatedAt?: string };
      const saved = Array.isArray(data.pinnedThreadIds)
        ? pinnedThreadIdsFromDbJson(data.pinnedThreadIds)
        : nextPins;
      const updatedAt = data.updatedAt ? msFromDb(data.updatedAt) : Date.now();
      setState((p) => ({
        ...p,
        threads: p.threads.map((t) =>
          t.id === cur.id ? { ...t, pinnedThreadIds: saved, updatedAt } : t,
        ),
      }));
    } catch (e) {
      console.error("[ao] pin thread", e);
      setState((p) => ({
        ...p,
        threads: p.threads.map((t) =>
          t.id === cur.id ? { ...t, pinnedThreadIds: prevPins } : t,
        ),
      }));
    }
  }

  function abortActiveChat() {
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    setIsThinking(false);
    setIsTyping(false);
    setTypingId(null);
    setThinkingUiPhase(1);
  }

  function canEditUserMessage(m: Msg): boolean {
    if (m.side !== "user") return false;
    if (composeLocked || isThinking || isTyping) return false;
    if (m.attachments?.length) return false;
    if (m.text === "(画像)") return false;
    return true;
  }

  function startEditUserMessage(m: Msg) {
    if (!canEditUserMessage(m)) return;
    setEditingUserMsgId(m.id);
    setEditDraft(m.text);
  }

  function cancelEditUserMessage() {
    setEditingUserMsgId(null);
    setEditDraft("");
  }

  function requestRewindFromEdit(messageId: string, newText: string, deleteOnly: boolean) {
    setRewindConfirm({ messageId, newText, deleteOnly });
  }

  async function confirmRewindEdit() {
    const conf = rewindConfirm;
    if (!conf) return;
    setRewindConfirm(null);
    abortActiveChat();

    const th = state.threads.find((t) => t.id === state.currentThreadId);
    if (!th) return;
    const msgIdx = th.messages.findIndex((m) => m.id === conf.messageId);
    if (msgIdx < 0) return;

    const pivotId = conf.messageId.split("#")[0]!;
    let updatedAt = Date.now();

    if (th.supabaseThreadId && isPersistedAoMessageId(conf.messageId)) {
      try {
        const res = await fetch(
          `/api/threads/${encodeURIComponent(th.supabaseThreadId)}/messages/edit`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId: pivotId, newText: conf.newText }),
          },
        );
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `edit failed ${res.status}`);
        }
        const data = (await res.json()) as { updatedAt?: string };
        if (data.updatedAt) updatedAt = msFromDb(data.updatedAt);
      } catch (e) {
        const msg = aoChatErrorMessageForDisplay(e);
        reportChatFailure(msg, e);
        return;
      }
    }

    const nextMessages = conf.deleteOnly
      ? th.messages.slice(0, msgIdx)
      : th.messages.slice(0, msgIdx + 1).map((m, i) =>
          i === msgIdx ? { ...m, text: conf.newText } : m,
        );

    setState((p) => {
      const ti = p.threads.findIndex((t) => t.id === th.id);
      if (ti < 0) return p;
      const aa = [...p.threads];
      aa[ti] = {
        ...aa[ti]!,
        messages: nextMessages,
        historyCompression: undefined,
        updatedAt,
        serverMessagesLoaded: true,
      };
      return { ...p, threads: aa };
    });

    const updatedThread: Thread = {
      ...th,
      messages: nextMessages,
      historyCompression: undefined,
      updatedAt,
      serverMessagesLoaded: true,
    };

    setEditingUserMsgId(null);
    setEditDraft("");
    setComposeLocked(false);
    setChatError(null);
    void fetchThreadListWithTopic(true, selectedTopicRef.current);

    if (!conf.deleteOnly && conf.newText.trim()) {
      queueMicrotask(() => {
        void sendUserMessage({ resendOnly: true, threadSnapshot: updatedThread });
      });
    } else {
      scheduleFocusMainPrompt();
    }
  }

  async function sendUserMessage(opts?: { resendOnly?: boolean; threadSnapshot?: Thread }) {
    const resendOnly = opts?.resendOnly === true;
    const text = resendOnly ? "" : draft.trim();
    const attachments = resendOnly ? undefined : pendingAttachments.length > 0 ? [...pendingAttachments] : undefined;
    if (!resendOnly && (!text && !attachments?.length)) return;
    if (isThinking || isTyping || composeLocked) return;

    const baseThread =
      opts?.threadSnapshot ??
      state.threads.find((t) => t.id === state.currentThreadId) ??
      currentThread;
    if (!baseThread) return;

    if (!resendOnly) {
      setDraft("");
      setPendingAttachments([]);
    }
    setChatError(null);
    setThinkingStatusLabel(null);

    const idx = state.threads.findIndex((t) => t.id === baseThread.id);
    if (idx < 0) return;

    const th = baseThread;
    let userMsg: Msg | null = null;
    let nextThread: Thread;

    if (resendOnly) {
      const msgs = visibleMessages(th.messages);
      const last = msgs[msgs.length - 1];
      if (!last || last.side !== "user") return;
      userMsg = last;
      nextThread = { ...th, updatedAt: Date.now() };
    } else {
      userMsg = {
        id: aoUid("m"),
        side: "user",
        speaker: "ジュチ",
        text: text || "(画像)",
        attachments,
        createdAt: Date.now(),
      };
      const snippet = aoTitleSnippetFromFirstUserPost(text);
      const resolvedTitle = aoClampStoredThreadTitle(th.title.trim() || snippet || "議事");
      const { ephemeral: _dropEphemeral, ...thPersist } = th;
      nextThread = {
        ...thPersist,
        title: th.title.trim() ? aoClampStoredThreadTitle(th.title.trim()) : resolvedTitle,
        messages: [...th.messages, userMsg],
        updatedAt: Date.now(),
      };
      const arr = [...state.threads];
      arr[idx] = nextThread;
      setState({ ...state, threads: arr });
    }

    let postChatSyncSid: string | undefined;
    const resolvedTitle = aoClampStoredThreadTitle(nextThread.title.trim() || "議事");
    setThinkingUiPhase(1);
    setIsThinking(true);
    chatAbortRef.current?.abort();
    const chatAbort = new AbortController();
    chatAbortRef.current = chatAbort;
    const streamSpeakerDefault = getPrimarySpeakerForProject(nextThread.projectId);
    let streamMsgIds: string[] = [];
    let sawStreamDelta = false;
    try {
      const history: Array<{
        role: "user" | "assistant";
        content: string;
        id?: string;
        speaker?: string;
        attachments?: AoMsgAttachment[];
      }> = [];
      for (const m of visibleMessages(nextThread.messages)) {
        if (m.side === "user") {
          history.push({ role: "user", content: m.text, id: m.id, attachments: m.attachments });
          continue;
        }
        // B: 表示用のメタ文言は次回リクエスト履歴に混ぜない
        if (isSyntheticAssistantNoiseForHistory(m.text)) continue;
        history.push({
          role: "assistant",
          content: m.text,
          id: m.id,
          speaker: m.speaker,
        });
      }
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        signal: chatAbort.signal,
        body: JSON.stringify({
          projectId: nextThread.projectId,
          messages: history,
          clientThreadId: nextThread.id,
          threadTitle: resolvedTitle,
          supabaseThreadId: nextThread.supabaseThreadId ?? null,
          historyCompression: nextThread.historyCompression ?? null,
        }),
      });
      const data = await readChatSseDone(res, {
        timeoutMs: AO_CHAT_CLIENT_SSE_TIMEOUT_MS,
        signal: chatAbort.signal,
        onPhase: (phase) => {
          if (currentThreadIdRef.current !== nextThread.id) return;
          const status = aoThinkingStatusForPhase(phase);
          if (status) setThinkingStatusLabel(status);
          if (phase === "final_completion") setThinkingUiPhase(2);
        },
        onDelta: ({ content }) => {
          if (currentThreadIdRef.current !== nextThread.id) return;
          sawStreamDelta = true;
          setIsThinking(false);
          setIsTyping(true);
          const preview = previewAssistantStreamChunks(content, streamSpeakerDefault);
          const prevStreamIds = streamMsgIds;
          const nextIds: string[] = [];
          const streamMsgs: Msg[] = [];
          for (let i = 0; i < preview.length; i++) {
            const c = preview[i]!;
            const id = prevStreamIds[i] ?? aoUid("m");
            nextIds.push(id);
            streamMsgs.push({
              id,
              side: "ai",
              speaker: c.speaker || "不明",
              text: c.text,
              createdAt: Date.now(),
            });
          }
          streamMsgIds = nextIds;
          setTypingId(nextIds[nextIds.length - 1] ?? null);
          setState((prev) => {
            const ti = prev.threads.findIndex((t) => t.id === nextThread.id);
            if (ti < 0) return prev;
            const kept = prev.threads[ti].messages.filter((m) => !prevStreamIds.includes(m.id));
            const nt = {
              ...prev.threads[ti],
              messages: [...kept, ...streamMsgs],
              updatedAt: Date.now(),
            };
            const aa = [...prev.threads];
            aa[ti] = nt;
            return { ...prev, threads: aa };
          });
        },
      });
      const chunks = data.chunks as Array<{ speaker: string; text: string }> | undefined;
      if (!chunks?.length) {
        const parts = [data.detail, data.error].filter((x): x is string => typeof x === "string" && x.trim().length > 0);
        throw new Error(parts.join(" — ").trim() || "chat error");
      }
      const supabaseThreadId =
        typeof data.supabaseThreadId === "string" ? data.supabaseThreadId : undefined;
      postChatSyncSid = supabaseThreadId ?? nextThread.supabaseThreadId;
      const historyCompressionRaw = data.historyCompression as
        | { fromMessageId?: string; summary?: string }
        | undefined;
      const historyCompression =
        typeof historyCompressionRaw?.fromMessageId === "string" &&
        typeof historyCompressionRaw?.summary === "string"
          ? {
              fromMessageId: historyCompressionRaw.fromMessageId,
              summary: historyCompressionRaw.summary,
            }
          : undefined;
      if (supabaseThreadId || historyCompression) {
        setState((prev) => {
          const ti = prev.threads.findIndex((t) => t.id === nextThread.id);
          if (ti < 0) return prev;
          const aa = [...prev.threads];
          aa[ti] = {
            ...aa[ti],
            ...(supabaseThreadId ? { supabaseThreadId } : {}),
            ...(historyCompression ? { historyCompression } : {}),
          };
          return { ...prev, threads: aa };
        });
      }
      if (data.persistOk === false) {
        const pe = typeof data.persistError === "string" ? data.persistError : "";
        setSyncNotice(
          pe
            ? `クラウドへの保存に失敗しました（未同期）: ${pe.slice(0, 200)}`
            : "クラウドへの保存に失敗しました。画面上には応答がありますが、再読み込みで消えることがあります。",
        );
      } else if (data.persistOk === true) {
        setSyncNotice(null);
      }
      setIsThinking(false);
      setThinkingUiPhase(1);
      const batchAiIds: string[] = [];
      const turnRaw = normalizeRawPromptsFromApi(data.rawPrompts);
      const turnCompletionMeta = normalizeCompletionMetaFromApi(data.completionMeta);

      if (sawStreamDelta) {
        const finalIds: string[] = [];
        const finalMsgs: Msg[] = [];
        for (let i = 0; i < chunks.length; i++) {
          const c = chunks[i]!;
          const id = streamMsgIds[i] ?? aoUid("m");
          finalIds.push(id);
          batchAiIds.push(id);
          finalMsgs.push({
            id,
            side: "ai",
            speaker: c.speaker || "不明",
            text: c.text || "",
            createdAt: Date.now(),
            rawPrompts: turnRaw,
          });
        }
        const prevStreamIds = streamMsgIds;
        streamMsgIds = finalIds;
        setState((prev) => {
          const ti = prev.threads.findIndex((t) => t.id === nextThread.id);
          if (ti < 0) return prev;
          const kept = prev.threads[ti].messages.filter((m) => !prevStreamIds.includes(m.id));
          const aa = [...prev.threads];
          aa[ti] = {
            ...aa[ti],
            messages: [...kept, ...finalMsgs],
            updatedAt: Date.now(),
          };
          return { ...prev, threads: aa };
        });
        setIsTyping(false);
        setTypingId(null);
      } else {
        setIsTyping(true);
        for (const c of chunks) {
          const msgId = aoUid("m");
          batchAiIds.push(msgId);
          const shell: Msg = {
            id: msgId,
            side: "ai",
            speaker: c.speaker || "不明",
            text: "",
            createdAt: Date.now(),
            rawPrompts: turnRaw,
          };
          setState((prev) => {
            const ti = prev.threads.findIndex((t) => t.id === nextThread.id);
            if (ti < 0) return prev;
            const nt = { ...prev.threads[ti], messages: [...prev.threads[ti].messages, shell], updatedAt: Date.now() };
            const aa = [...prev.threads];
            aa[ti] = nt;
            return { ...prev, threads: aa };
          });
          setTypingId(msgId);
          await runTypewriter(c.text || "", (visible) => {
            if (currentThreadIdRef.current !== nextThread.id) return;
            setState((prev) => {
              const ti = prev.threads.findIndex((t) => t.id === nextThread.id);
              if (ti < 0) return prev;
              const mi = prev.threads[ti].messages.findIndex((m) => m.id === msgId);
              if (mi < 0) return prev;
              const msgs = [...prev.threads[ti].messages];
              msgs[mi] = { ...msgs[mi], text: visible };
              const aa = [...prev.threads];
              aa[ti] = { ...aa[ti], messages: msgs, updatedAt: Date.now() };
              return { ...prev, threads: aa };
            });
          });
        }
      }
      const turnUsage = normalizeChatUsageFromApi(data.usage);
      if ((turnUsage && batchAiIds.length > 0) || turnRaw || turnUsage || turnCompletionMeta) {
        setState((prev) => {
          const ti = prev.threads.findIndex((t) => t.id === nextThread.id);
          if (ti < 0) return prev;
          const msgs = [...prev.threads[ti].messages];
          const ui = msgs.findIndex((x) => x.id === userMsg.id);
          if (ui >= 0 && (turnRaw || turnUsage || turnCompletionMeta)) {
            msgs[ui] = {
              ...msgs[ui],
              ...(turnRaw ? { rawPrompts: turnRaw } : {}),
              ...(turnUsage ? { usage: turnUsage } : {}),
              ...(turnCompletionMeta ? { completionMeta: turnCompletionMeta } : {}),
            };
          }
          if (turnUsage && batchAiIds.length > 0) {
            for (const id of batchAiIds) {
              const mi = msgs.findIndex((x) => x.id === id);
              if (mi >= 0)
                msgs[mi] = {
                  ...msgs[mi],
                  usage: turnUsage,
                  ...(turnCompletionMeta ? { completionMeta: turnCompletionMeta } : {}),
                };
            }
          }
          const aa = [...prev.threads];
          aa[ti] = { ...aa[ti], messages: msgs, updatedAt: Date.now() };
          return { ...prev, threads: aa };
        });
      }
      setThreadListAfterChatNonce((n) => n + 1);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const msg = aoChatErrorMessageForDisplay(e);
      reportChatFailure(msg, e);
      if (!resendOnly && userMsg) {
        setState((prev) => {
          const ti = prev.threads.findIndex((t) => t.id === nextThread.id);
          if (ti < 0) return prev;
          const msgs = prev.threads[ti]!.messages.filter((m) => m.id !== userMsg!.id);
          const aa = [...prev.threads];
          aa[ti] = { ...aa[ti]!, messages: msgs };
          return { ...prev, threads: aa };
        });
      }
    } finally {
      if (chatAbortRef.current === chatAbort) {
        chatAbortRef.current = null;
      }
      setTypingId(null);
      setIsThinking(false);
      setThinkingUiPhase(1);
      setThinkingStatusLabel(null);
      setIsTyping(false);
      if (postChatSyncSid) {
        queueMicrotask(() => {
          void reconcileThreadMessages(
            [{ clientId: nextThread.id, supabaseThreadId: postChatSyncSid! }],
            undefined,
            { force: true },
          );
        });
      }
      scheduleFocusMainPrompt();
    }
  }

  const overlayMode = contextOpen ? "context" : chronicleOpen ? "chronicle" : null;
  const isContextMode = overlayMode === "context";
  /** ユーザーエリアを差し替えるシェル系（全体設定・議事一覧） */
  const userAreaShellOverlay = Boolean(settingsOpen || ronListOverlayOpen);
  /** ビューエリアに出す機能別パネル（令旨・年代記・使用量） */
  const viewAreaFeaturePanel = Boolean(overlayMode || usageOpen);
  const anyMainOverlay = userAreaShellOverlay;
  const showRonAgendaPanel = Boolean(ronListOverlayOpen && !overlayMode && !settingsOpen && !usageOpen);

  const deleteConfirmThread = useMemo(() => {
    if (!deleteConfirmThreadId) return null;
    return state.threads.find((t) => t.id === deleteConfirmThreadId) ?? null;
  }, [deleteConfirmThreadId, state.threads]);

  const deleteConfirmPopupMarkdown = useMemo(() => {
    if (!deleteConfirmThread) return null;
    const ron = topicRonLabelForThread(deleteConfirmThread, selectedTopic);
    const title = aoThreadTitleForList(deleteConfirmThread);
    const body = substituteAoPopupTemplateMarkdown(deleteLogPopupTemplate, {
      論: ron,
      議題: title,
    });
    return aoPopupMarkdownForBubble(body);
  }, [deleteConfirmThread, deleteLogPopupTemplate, selectedTopic]);

  const rewindConfirmPopupMarkdown = useMemo(() => {
    if (!rewindConfirm) return null;
    const body = rewindConfirm.deleteOnly
      ? AO_POPUP_REWIND_DELETE_FALLBACK
      : AO_POPUP_REWIND_EDIT_FALLBACK;
    return aoPopupMarkdownForBubble(body);
  }, [rewindConfirm]);

  const deleteConfirmKorguzKin = useMemo(() => {
    const p = NOKOR.find((n) => n.name === "コルグズ");
    if (!p) return null;
    return (
      <div
        className="flex w-fit min-w-0 flex-col items-stretch transition-none translate-x-0 translate-y-0"
        style={{
          paddingTop: 3,
          paddingBottom: 0,
          paddingLeft: 3,
          paddingRight: 0,
        }}
      >
        <AoKinAvatarStack
          face={
            <AoP5FaceFrameMid
              src={p.src}
              alt={p.name}
              width={NOKOR_PORTRAIT_W_PX}
              height={NOKOR_PORTRAIT_BOX_H_PX}
              portraitScale={AO_MAIN_CHAT_FACE_PORTRAIT_SCALE}
            />
          }
          name={p.name}
          nameplateFontSizePx={8}
          tightPadXPx={AO_PC_NOKOR_TIGHT_PAD_X_PX}
        />
      </div>
    );
  }, []);

  const showRewindConfirmPopup = Boolean(
    rewindConfirm && rewindConfirmPopupMarkdown && deleteConfirmKorguzKin,
  );

  const showDeleteConfirmPopup = Boolean(
    deleteConfirmThread &&
    deleteConfirmPopupMarkdown &&
    deleteConfirmKorguzKin &&
    (overlayMode === "chronicle" || showRonAgendaPanel),
  );

  const overlayThreadsMaxPageIndex = useMemo(() => {
    if (!overlayMode) return 0;
    const n = topicThreads.length;
    return Math.max(0, Math.ceil(n / AGENDA_PAGE_SIZE) - 1);
  }, [overlayMode, topicThreads]);

  const overlayListPageIndexClamped = useMemo(() => {
    if (!overlayMode) return 0;
    return Math.min(overlayListPageIndex, overlayThreadsMaxPageIndex);
  }, [overlayMode, overlayListPageIndex, overlayThreadsMaxPageIndex]);

  const overlayThreadsSlice = useMemo(() => {
    if (!overlayMode) return [];
    const start = overlayListPageIndexClamped * AGENDA_PAGE_SIZE;
    return topicThreads.slice(start, start + AGENDA_PAGE_SIZE);
  }, [overlayMode, topicThreads, overlayListPageIndexClamped]);

  useEffect(() => {
    if (!overlayMode) return;
    setOverlayListPageIndex(0);
  }, [overlayMode, selectedTopic]);

  useEffect(() => {
    if (!overlayMode) return;
    setOverlayListPageIndex((i) => Math.min(i, overlayThreadsMaxPageIndex));
  }, [overlayMode, overlayThreadsMaxPageIndex]);

  useEffect(() => {
    if (overlayMode || settingsOpen || usageOpen) setRonListOverlayOpen(false);
  }, [overlayMode, settingsOpen, usageOpen]);

  useEffect(() => {
    if (!overlayMode && !showRonAgendaPanel) setDeleteConfirmThreadId(null);
  }, [overlayMode, showRonAgendaPanel]);

  /** スマホのヘッダ帯ジェスチャを無効にする（オーバーレイ・議事メニュー・Raw 時は誤操作防止） */
  const blockCompactKinHeaderSwipe = anyMainOverlay || viewAreaFeaturePanel || Boolean(rawPromptOverlay);

  /**
   * ヘッダ下かつ画面中央帯の横スワイプのみ（document capture）。
   * 閉→開：右スワイプ／開→閉：左スワイプ（開始がボタン等のときは開く操作のみ無視）。
   */
  useEffect(() => {
    if (!viewportCompact || !kinDrawerPortalReady || blockCompactKinHeaderSwipe) return;

    let start: { x: number; y: number; disallowed: boolean } | null = null;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const vw = typeof window !== "undefined" ? window.innerWidth : 0;
      const canStart = leftKinDrawerOpen
        ? aoKinTouchStartCanCloseDrawer(t.clientX, vw)
        : aoKinTouchStartCanOpenDrawer(t.clientX, vw);
      if (!vw || !canStart) return;
      const top = aoKinCompactKinSwipeContentTopPx(compactKinHeaderMeasureRef.current, compactKinFrameStripMeasureRef.current);
      if (top <= 0 || t.clientY <= top) return;
      start = {
        x: t.clientX,
        y: t.clientY,
        disallowed: aoKinDrawerSwipeTargetDisallowsEdgeSwipe(e.target),
      };
    };

    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      if (!t) {
        start = null;
        return;
      }
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const disallowed = start.disallowed;
      start = null;

      if (!leftKinDrawerOpen) {
        if (!disallowed && aoKinCenterSwipeOpensDrawer(dx, dy)) setLeftKinDrawerOpen(true);
        return;
      }

      if (aoKinCenterSwipeClosesDrawer(dx, dy)) setLeftKinDrawerOpen(false);
    };

    const onCancel = () => {
      start = null;
    };

    document.addEventListener("touchstart", onStart, { passive: true, capture: true });
    document.addEventListener("touchend", onEnd, { passive: true, capture: true });
    document.addEventListener("touchcancel", onCancel, { passive: true, capture: true });
    return () => {
      document.removeEventListener("touchstart", onStart, true);
      document.removeEventListener("touchend", onEnd, true);
      document.removeEventListener("touchcancel", onCancel, true);
    };
  }, [viewportCompact, kinDrawerPortalReady, leftKinDrawerOpen, blockCompactKinHeaderSwipe]);

  const mainColumnWidthStyle: CSSProperties = viewportCompact
    ? { width: "100%", maxWidth: "100%", boxSizing: "border-box" }
    : { width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" };

  /** 議事チップ内（年代記・使用量・設定・令旨） */
  const compactGijiChipIconPx = Math.round(
    (viewportCompact ? 10 : 14) * AO_MAIN_TOOLBAR_ICON_SCALE,
  );
  /** スマホ：メインエリアの主要ボタンを約 25% 大きく */
  const compactGijiChipIconPxBig = viewportCompact ? Math.round(compactGijiChipIconPx * 1.25) : compactGijiChipIconPx;
  const compactReishiBtnMinH = viewportCompact
    ? Math.max(28, Math.round(REISHI_CHRONICLE_BTN_MIN_H_PX * 0.82))
    : REISHI_CHRONICLE_BTN_MIN_H_PX;
  const compactSpeechBubbleH = viewportCompact
    ? Math.round(MAIN_SPEECH_BUBBLE_H_PX * 0.88)
    : MAIN_SPEECH_BUBBLE_H_PX;
  const compactRonTabTopicFs = aoMainRonTabTopicFontPx(viewportCompact);
  const compactGijiTitleFs = viewportCompact ? Math.max(9, AO_GIJI_TITLE_FONT_PX - 3) : AO_GIJI_TITLE_FONT_PX;
  const compactMainTextareaFs = viewportCompact ? COMPACT_COMPOSE_INPUT_FS : 13;
  const compactMainTextareaVisualScale = viewportCompact ? COMPACT_COMPOSE_INPUT_VISUAL_SCALE : 1;
  /** 左・論タブ枠：装飾の内側パディングを詰め、flex 継承で縦伸びしないよう別値 */
  const ronListFrameInsetPx = viewportCompact ? 6 : 7;
  const compactRonTitleChipH = viewportCompact ? 26 : 32;
  /** 令旨／年代記／設定／使用量サブページ帯の縦（論リストの実測に合わせる） */
  const ronSubpageBandPx = Math.max(28, Math.round(ronListPx ?? (viewportCompact ? 96 : 140)));

  const chatRowGap = MAIN_BUBBLE_ROW_GAP_PX;
  /** 履歴吹き出しは列 flex で親幅いっぱいまで広げる（実効幅は顔グラ列＋ gap で決まる） */
  const chatBubbleMaxWidth: CSSProperties["maxWidth"] = "100%";

  /** V2 PC：左サイドバー 4 エリア + メイン幅維持（スマホは V1 のまま） */
  const aoV2PcSidebar = !viewportCompact;
  const v2MainColWPx = AO_V2_PC_MAIN_COLUMN_W_PX;
  const v2LeftColWPx = AO_V2_PC_LEFT_COLUMN_W_PX;
  const v2BodyRowWPx = AO_V2_PC_BODY_ROW_W_PX;
  const v2PcContainerStyle: CSSProperties | undefined = aoV2PcSidebar
    ? { width: v2BodyRowWPx, maxWidth: v2BodyRowWPx }
    : undefined;
  const v2LeftColStyle: CSSProperties | undefined = aoV2PcSidebar
    ? { width: v2LeftColWPx, minWidth: v2LeftColWPx, maxWidth: v2LeftColWPx, flex: "0 0 auto" }
    : undefined;
  const v2MainColStyle: CSSProperties | undefined = aoV2PcSidebar
    ? { width: v2MainColWPx, minWidth: v2MainColWPx, maxWidth: v2MainColWPx, flex: "0 0 auto" }
    : undefined;

  const projectTabsPanelProps = {
    kuriltaiLabelMeterRef,
    selectedTopic,
    onTabClick: onMainRonTabClick,
    viewportCompact,
    topicFontSizePx: compactRonTabTopicFs,
  } as const;

  useLayoutEffect(() => {
    const labelEl = kuriltaiLabelMeterRef.current;
    const probe = ronTopicLabelsProbeRef.current;
    if (!labelEl) return;
    const framePadX = aoFrameAsContentPadXPx();
    const btnPadX = viewportCompact ? 0 : 8;
    const syncRonW = () => {
      const lw = Math.ceil(labelEl.offsetWidth || labelEl.getBoundingClientRect().width);
      let maxOther = 0;
      if (probe) {
        probe.querySelectorAll("[data-ao-ron-probe-label]").forEach((node) => {
          if (node instanceof HTMLElement) {
            maxOther = Math.max(maxOther, Math.ceil(node.offsetWidth || node.getBoundingClientRect().width));
          }
        });
      }
      const inner = Math.max(lw, maxOther);
      const chrome = framePadX + btnPadX;
      setRonColWidthPx(Math.max(viewportCompact ? 52 : 72, inner + chrome));
    };
    syncRonW();
    const ro = new ResizeObserver(syncRonW);
    ro.observe(labelEl);
    if (probe) ro.observe(probe);
    window.addEventListener("resize", syncRonW);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncRonW);
    };
  }, [viewportCompact, compactRonTabTopicFs]);


  const thinkingDotsText = AO_THINKING_DOT_CYCLE[thinkingDotsPhase];

  function attachmentsForUsageChip(side: "ai" | "user", m: Msg, thread: Thread | undefined): AoMsgAttachment[] | undefined {
    if (side === "user") return m.attachments;
    if (!thread) return undefined;
    const msgs = thread.messages;
    const idx = msgs.findIndex((x) => x.id === m.id);
    if (idx < 0) return undefined;
    for (let i = idx - 1; i >= 0; i--) {
      const row = msgs[i];
      if (row?.side === "user") return row.attachments;
    }
    return undefined;
  }

  function openRawPromptPopover(
    anchorBtn: HTMLElement,
    side: "ai" | "user",
    usage: MsgTurnUsage,
    rawPrompts?: MsgRawPromptBundle,
    anchorMsgId?: string,
    completionMeta?: MsgChatCompletionMeta,
    attachments?: AoMsgAttachment[],
  ) {
    const avatarRect = anchorBtn.getBoundingClientRect();
    let anchorRect = avatarRect;
    let verticalAnchorRect: DOMRect | undefined;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
    const vh = typeof window !== "undefined" ? window.innerHeight : 768;
    const popoverWidth = Math.min(RAW_POPOVER_W, vw - 16);
    const popoverHeight = Math.min(vh * 0.37, 250);

    if (viewportCompact && side === "user" && anchorMsgId && messagesRef.current) {
      const box = aoCompactUserRawPanelRect(messagesRef.current, anchorMsgId);
      if (box) {
        setRawPromptOverlay({
          variant: side,
          usage,
          completionMeta,
          rawPrompts,
          attachments,
          left: box.left,
          top: box.top,
          panelWidthPx: box.width,
          panelHeightPx: box.height,
        });
        return;
      }
    }

    if (viewportCompact) {
      const row = anchorBtn.closest("[data-ao-chat-row]");
      const bubbleEl = row?.querySelector("[data-ao-chat-bubble]");
      if (bubbleEl instanceof HTMLElement) {
        const br = bubbleEl.getBoundingClientRect();
        anchorRect = br;
        verticalAnchorRect = br;
      }
    }
    const { left, top } = placeRawPromptPopover({
      anchorRect,
      verticalAnchorRect,
      compactAvatarRect: viewportCompact ? avatarRect : undefined,
      side,
      popoverWidth,
      popoverHeight,
      compactAlignBubbleMid: viewportCompact && verticalAnchorRect == null,
      bubbleMinHeightPx:
        viewportCompact && verticalAnchorRect == null ? CHAT_HISTORY_BUBBLE_MIN_H_PX : undefined,
    });
    setRawPromptOverlay({ variant: side, usage, completionMeta, rawPrompts, attachments, left, top });
  }

  const hydrateRawFromServerIfNeeded = useCallback(
    async (e: ReactMouseEvent<HTMLButtonElement>, side: "ai" | "user", m: Msg) => {
      /** await 後は SyntheticEvent の currentTarget が null になるため、同期で要素を保持 */
      const anchorBtn = e.currentTarget;
      let rawPrompts = m.rawPrompts;
      let usage = m.usage ?? aoSyntheticMsgTurnUsage();
      let completionMeta = m.completionMeta;
      const th = state.threads.find((t) => t.id === state.currentThreadId);
      const sid = th?.supabaseThreadId;
      if (!rawPrompts && sid && !th?.ephemeral) {
        try {
          const r = await fetch(`/api/threads/${encodeURIComponent(sid)}/messages?raw=1`);
          if (r.ok) {
            const data = (await r.json()) as { messages?: Msg[] };
            const list = Array.isArray(data.messages) ? data.messages : [];
            const found = list.find((x) => x.id === m.id);
            if (found?.rawPrompts) rawPrompts = found.rawPrompts;
            if (found?.usage) usage = found.usage;
            if (found?.completionMeta) completionMeta = found.completionMeta;
            setState((p) => {
              const ti = p.threads.findIndex((t) => t.id === p.currentThreadId);
              if (ti < 0) return p;
              const merged = mergeMsgsHydrateFromServer(p.threads[ti]!.messages, list);
              const aa = [...p.threads];
              aa[ti] = { ...aa[ti]!, messages: merged };
              return { ...p, threads: aa };
            });
          }
        } catch {
          /* Raw 未取得でもオーバーレイは開く */
        }
      }
      const attachments = attachmentsForUsageChip(side, m, th);
      openRawPromptPopover(anchorBtn, side, usage, rawPrompts, m.id, completionMeta, attachments);
    },
    [state.threads, state.currentThreadId],
  );


  return {
    shell: {
      viewportCompact,
      compactGijiChipIconPx,
      compactGijiChipIconPxBig,
      compactKinHeaderMeasureRef,
      compactKinFrameStripMeasureRef,
      setCompactKinPortalHost,
      kinDrawerAnchorBottomPx,
      kinDrawerHostExtendBottomPx,
      compactKinPortalHost,
      kinDrawerPortalReady,
      leftKinDrawerOpen,
      setLeftKinDrawerOpen,
      activeNokorNames,
      openUsageOverlay,
      activeFeatureId,
      setActiveFeatureId,
      setKnowledgeLayer,
      knowledgeLayer,
      aoV2PcSidebar,
      v2PcContainerStyle,
      v2LeftColStyle,
      v2MainColStyle,
      leftColumnMeasureRef,
      mapBgHostRef,
      mapBgTileCount,
      compactRonTabTopicFs,
      ronTopicLabelsProbeRef,
    },
    thread: {
      currentThread,
      selectedTopic,
      setCurrentThread,
      setSelectedTopic,
      setState,
      composeLocked,
      setComposeLocked,
      topicBeforeTopicOverlayRef,
      togglePinnedThreadForCurrent,
      requestDeleteAoThread,
      deleteAoThread,
      deleteConfirmThreadId,
      setDeleteConfirmThreadId,
      deletingThreadId,
      showDeleteConfirmPopup,
      deleteConfirmPopupMarkdown,
      deleteConfirmKorguzKin,
    },
    compose: {
      draft,
      setDraft,
      pendingAttachments,
      setPendingAttachments,
      onAttachFilesSelected,
      onComposePaste,
      sendUserMessage,
      attachInputRef,
      promptTextareaRef,
      titleEditing,
      titleDraft,
      setTitleEditing,
      setTitleDraft,
      titleInputRef,
      titleChipParchmentRef,
      scheduleFocusMainPrompt,
      compactGijiTitleFs,
      compactMainTextareaFs,
      compactMainTextareaVisualScale,
      compactSpeechBubbleH,
      compactRonTitleChipH,
      mainColumnWidthStyle,
    },
    ron: {
      projectTabsPanelProps,
      showRonAgendaPanel,
      agendaPageIndex,
      setAgendaPageIndex,
      agendaMaxPageIndex,
      agendaRowsSlice,
      ronColWidthPx,
      ronListMeasureRef,
      ronSubpageBandPx,
      closeRonAgendaOverlay,
      setRonListOverlayOpen,
      selectRonAgendaThread,
    },
    overlay: {
      anyMainOverlay,
      viewAreaFeaturePanel,
      onMainOverlayBackClick,
      settingsOpen,
      settingsOverlayRef,
      settingsEmbeddedSubpage,
      setSettingsEmbeddedSubpage,
      settingsSavePending,
      setSettingsSavePending,
      closeSettingsUsageOverlay,
      contextOpen,
      isContextMode,
      overlayMode,
      openChronicleOverlay,
      openContextOverlay,
      closeContextChronicleOverlay,
      usageOpen,
      closeUsageViewPanel,
      reijitsuOverlayRef,
      reijitsuSavePending,
      setReijitsuSavePending,
      overlayListPageIndex,
      setOverlayListPageIndex,
      overlayThreadsMaxPageIndex,
      overlayThreadsSlice,
      topicThreads,
    },
    history: {
      messagesRef,
      chatAutoStickToBottomRef,
      chatScrollRafRef,
      chatBubbleMaxWidth,
      chatRowGap,
      chatError,
      setChatError,
      chatClientLogs,
      setChatClientLogs,
      syncNotice,
      setSyncNotice,
      personaCatalog,
      isThinking,
      isTyping,
      typingId,
      thinkingDotsText,
      thinkingStatusLabel,
      thinkingUiPhase,
      editingUserMsgId,
      editDraft,
      setEditDraft,
      canEditUserMessage,
      startEditUserMessage,
      cancelEditUserMessage,
      requestRewindFromEdit,
      confirmRewindEdit,
      showRewindConfirmPopup,
      rewindConfirmPopupMarkdown,
      setRewindConfirm,
      hydrateRawFromServerIfNeeded,
    },
    raw: {
      rawPromptOverlay,
      setRawPromptOverlay,
    },
  };
}

export type AoChatSession = ReturnType<typeof useAoChatSession>;
