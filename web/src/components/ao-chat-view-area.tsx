"use client";

import { type CSSProperties } from "react";
import {
  AO_TOPICS,
  aoPostingProjectIdForTopic,
  isAoNativeThread,
  topicUiIdForProjectId,
} from "@/lib/ao-topics";
import {
  IcoAgendaPageFirst,
  IcoAgendaPageLast,
  IcoAgendaPageNext,
  IcoAgendaPagePrev,
  IcoArrowLeft,
  IcoCheck,
  IcoTrash,
  IcoPin,
} from "@/components/ao-action-icons";
import { AoMessageMarkdown } from "@/components/AoMessageMarkdown";
import { AoMessageAttachments } from "@/components/ao-compose-attachments";
import { AoDeleteConfirmPopup } from "@/components/AoDeleteConfirmPopup";
import { AoReijitsuOverlay } from "@/components/AoReijitsuOverlay";
import {
  AoSettingsOverlay,
  AoSettingsSubpageTabs,
} from "@/components/AoSettingsOverlay";
import { AoUsageOverlay } from "@/components/AoUsageOverlay";
import { aoThreadTitleForList } from "@/lib/ao-thread-title";
import {
  AoMainColumnFrame,
  AoP5NineSliceBubble,
  AoP5FaceFrameMid,
  AO_MAIN_CHAT_FACE_PORTRAIT_SCALE,
  AoP5NameplateSmFrame,
} from "@/components/ao-phase5";
import { AoChatAiAvatarStack } from "@/components/ao-chat-ai-avatar-stack";
import { AoRubyGold } from "@/components/ao-ruby-gold";
import {
  AO_AGENDA_NAV_BTN_CLASS,
  AO_CHAT_AVATAR_DROP_SHADOW_FILTER,
  AO_FRAME_AL_OVERLAY_SHADOW_EXTENT_PX,
  AO_P5_BUBBLE_SHADOW_FILTER,
} from "@/lib/template/ao-chrome";
import {
  CHAT_AREA_PAD_RIGHT_PX,
  CHAT_AREA_PAD_X_PX,
  CHAT_HISTORY_BUBBLE_MIN_H_PX,
  CHAT_NAMEPLATE_MIN_W_PX,
  MAIN_CHAT_NAMEPLATE_OPTS,
  MAIN_MIDDLE_SECTION_PAD_X_PX,
  NOKOR_PORTRAIT_BOX_H_PX,
  NOKOR_PORTRAIT_W_PX,
  mainComposeRowGridStyle,
} from "@/lib/ao-kin-layout";
import { AO_Z_COMPACT_CHAT } from "@/lib/ao-viewport-compact";
import { chatTimelineRowsForRender } from "@/lib/ao-chat-timeline";
import {
  aiSpeakerUi,
  aoThinkingSpeakerUi,
} from "@/lib/ao-chat-speaker-ui";
import {
  formatDateDay,
  msgTextForUi,
  threadSourceProviderUlusLabel,
} from "@/lib/ao-home-helpers";
import type { AoChatSession } from "@/components/use-ao-chat-session";

const AGENDA_EMPTY_FILLER_ROWS = 4;
const AO_CHAT_AI_BUBBLE_FG = "#1B0D04";

export function AoChatViewArea({ session }: { session: AoChatSession }) {
  const { viewportCompact } = session.shell;
  const {
    currentThread,
    selectedTopic,
    setCurrentThread,
    setSelectedTopic,
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
  } = session.thread;
  const {
    viewAreaFeaturePanel,
    onMainOverlayBackClick,
    settingsOverlayRef,
    settingsEmbeddedSubpage,
    setSettingsEmbeddedSubpage,
    contextOpen,
    isContextMode,
    overlayMode,
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
  } = session.overlay;
  const {
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
  } = session.history;

  return (
    <>
            {/* ②-3 ビューエリア: チャット履歴、または機能別パネル（令旨・年代記・使用量） */}
            <section
              className="relative z-[10] flex min-h-0 min-w-0 flex-1 flex-col overflow-visible border-0 bg-transparent font-serif"
              style={viewportCompact ? { zIndex: AO_Z_COMPACT_CHAT } : { zIndex: 10 }}
            >
            {viewAreaFeaturePanel ? (
              <div
                className="relative z-10 min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
                style={{
                  paddingLeft: CHAT_AREA_PAD_X_PX,
                  paddingRight: CHAT_AREA_PAD_RIGHT_PX,
                  paddingTop: 0,
                  paddingBottom: Math.max(
                    MAIN_MIDDLE_SECTION_PAD_X_PX,
                    AO_FRAME_AL_OVERLAY_SHADOW_EXTENT_PX,
                  ),
                }}
                role="dialog"
                aria-modal="true"
                aria-label={isContextMode ? "設定" : overlayMode === "chronicle" ? "年代記" : "使用量"}
              >
                {/* 令旨・年代記・使用量のみ大枠。チャット履歴には付けない。スクロールは枠の外側 */}
                <AoMainColumnFrame
                  className="relative box-border w-full max-w-full shrink-0"
                >
                  <div className="ao-p5-parchment-surface flex w-full flex-col gap-0.5">
                    <div className="grid w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-x-0.5 px-0.5 py-0">
                      <div className="flex min-w-0 justify-start">
                        {isContextMode ? (
                          <AoRubyGold
                            main="設　定"
                            rt="　"
                            mainClassName="text-[14px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]"
                            rtClassName="text-[9px] font-serif text-[#6A3F0A]/80"
                          />
                        ) : overlayMode === "chronicle" ? (
                          <AoRubyGold
                            main="年 代 記"
                            rt="トプチヤン"
                            mainClassName="text-[14px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]"
                            rtClassName="text-[9px] font-serif text-[#6A3F0A]/80"
                          />
                        ) : (
                          <AoRubyGold
                            main="使　用　量"
                            rt="　"
                            mainClassName="text-[14px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]"
                            rtClassName="text-[9px] font-serif text-[#6A3F0A]/80"
                          />
                        )}
                      </div>
                      <div className="flex min-w-0 w-full shrink-0 flex-col items-center justify-center gap-0.5">
                        {overlayMode === "chronicle" ? (
                          <div className="flex items-center justify-center gap-px">
                            <button
                              type="button"
                              className={AO_AGENDA_NAV_BTN_CLASS}
                              aria-label="先頭ページ"
                              disabled={overlayListPageIndex <= 0}
                              onClick={() => setOverlayListPageIndex(0)}
                            >
                              <IcoAgendaPageFirst size={16} />
                            </button>
                            <button
                              type="button"
                              className={AO_AGENDA_NAV_BTN_CLASS}
                              aria-label="前のページ"
                              disabled={overlayListPageIndex <= 0}
                              onClick={() => setOverlayListPageIndex((i) => Math.max(0, i - 1))}
                            >
                              <IcoAgendaPagePrev size={16} />
                            </button>
                            <button
                              type="button"
                              className={AO_AGENDA_NAV_BTN_CLASS}
                              aria-label="次のページ"
                              disabled={overlayListPageIndex >= overlayThreadsMaxPageIndex}
                              onClick={() =>
                                setOverlayListPageIndex((i) =>
                                  Math.min(overlayThreadsMaxPageIndex, i + 1),
                                )
                              }
                            >
                              <IcoAgendaPageNext size={16} />
                            </button>
                            <button
                              type="button"
                              className={AO_AGENDA_NAV_BTN_CLASS}
                              aria-label="末尾ページ"
                              disabled={overlayListPageIndex >= overlayThreadsMaxPageIndex}
                              onClick={() => setOverlayListPageIndex(overlayThreadsMaxPageIndex)}
                            >
                              <IcoAgendaPageLast size={16} />
                            </button>
                          </div>
                        ) : isContextMode ? (
                          <>
                            <AoSettingsSubpageTabs
                              active={settingsEmbeddedSubpage}
                              onChange={setSettingsEmbeddedSubpage}
                            />
                            {settingsEmbeddedSubpage === "reijitsu" ? (
                              <span className="px-1 text-[10px] font-semibold text-[#6A3F0A]/85">
                                {selectedTopic
                                  ? (AO_TOPICS.find((t) => t.id === selectedTopic)?.label ?? "")
                                  : "論を選択"}
                              </span>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                      <div className="flex min-w-0 shrink-0 items-center justify-end gap-0.5">
                        {isContextMode && settingsEmbeddedSubpage === "reijitsu" ? (
                          <button
                            type="button"
                            className={`${AO_AGENDA_NAV_BTN_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
                            aria-label={reijitsuSavePending ? "保存中" : "令旨を保存"}
                            disabled={reijitsuSavePending || !selectedTopic}
                            onClick={() => {
                              void (async () => {
                                if (!reijitsuOverlayRef.current) return;
                                setReijitsuSavePending(true);
                                try {
                                  await reijitsuOverlayRef.current.confirmSave();
                                } finally {
                                  setReijitsuSavePending(false);
                                }
                              })();
                            }}
                          >
                            {reijitsuSavePending ? (
                              <span className="whitespace-nowrap px-0.5 text-[9px] leading-none text-[#8D5400]">
                                保存中…
                              </span>
                            ) : (
                              <IcoCheck size={14} />
                            )}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={AO_AGENDA_NAV_BTN_CLASS}
                          aria-label="戻る"
                          onClick={onMainOverlayBackClick}
                        >
                          <IcoArrowLeft size={14} className="shrink-0" />
                        </button>
                      </div>
                    </div>
                    <div className="flex w-full min-w-0 flex-col px-0.5 pb-0.5">
                      {isContextMode ? (
                        <AoSettingsOverlay
                          ref={settingsOverlayRef}
                          open={contextOpen}
                          onClose={closeContextChronicleOverlay}
                          embedded
                          outerScroll
                          embeddedSubpage={settingsEmbeddedSubpage}
                          onEmbeddedSubpageChange={setSettingsEmbeddedSubpage}
                          reijitsuPanel={
                            selectedTopic ? (
                              <AoReijitsuOverlay
                                ref={reijitsuOverlayRef}
                                projectId={aoPostingProjectIdForTopic(selectedTopic)}
                                topicLabel={AO_TOPICS.find((t) => t.id === selectedTopic)?.label ?? ""}
                              />
                            ) : null
                          }
                        />
                      ) : null}
                      {usageOpen ? (
                        <AoUsageOverlay
                          embedded
                          outerScroll
                          open={usageOpen}
                          onClose={closeUsageViewPanel}
                        />
                      ) : null}
                      {overlayMode === "chronicle" ? (
                        <div className="w-full min-w-0">
                          {topicThreads.length === 0 ? (
                            <>
                              <div
                                className="grid w-full grid-cols-[28px_1fr_auto_auto] items-center gap-0 border-b px-2 py-0.5 text-[11px] text-[#3D1C08]"
                                style={{ borderColor: "#3D1C08" }}
                              >
                                <div />
                                <div className="min-w-0 text-left">該当する議事はありません。</div>
                                <div className="min-w-[52px] shrink-0 text-center text-[11px] leading-tight text-[#c2cad6]" />
                                <div className="min-w-[108px] shrink-0 pr-[20px] text-right" />
                              </div>
                              {Array.from({ length: AGENDA_EMPTY_FILLER_ROWS }).map((_, i) => (
                                <div
                                  key={`view-empty-row-${i}`}
                                  className="grid w-full grid-cols-[28px_1fr_auto_auto] items-center gap-0 border-b px-2 py-0.5"
                                  style={{ borderColor: "#3D1C08", minHeight: 18 }}
                                >
                                  <div />
                                  <div />
                                  <div className="min-w-[52px] shrink-0" />
                                  <div className="min-w-[108px] shrink-0 pr-[20px]" />
                                </div>
                              ))}
                            </>
                          ) : (
                            overlayThreadsSlice.map((t) => (
                              <div
                                key={t.id}
                                className="group/row grid w-full grid-cols-[28px_1fr_auto_auto] items-center gap-0 border-b px-2 py-0.5 text-left text-[11px] hover:bg-[#143d5e]/60"
                                style={{ borderColor: "#3D1C08" }}
                              >
                                <div className="flex items-center justify-center gap-0.5">
                                  {currentThread?.supabaseThreadId &&
                                  t.supabaseThreadId &&
                                  t.id !== currentThread.id ? (
                                    <button
                                      type="button"
                                      className={AO_AGENDA_NAV_BTN_CLASS}
                                      aria-label={`議事「${aoThreadTitleForList(t)}」を参照にピン`}
                                      aria-pressed={Boolean(
                                        currentThread.pinnedThreadIds?.includes(t.supabaseThreadId),
                                      )}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void togglePinnedThreadForCurrent(t);
                                      }}
                                    >
                                      <IcoPin
                                        size={12}
                                        className={
                                          currentThread.pinnedThreadIds?.includes(t.supabaseThreadId)
                                            ? "text-[#DBB961]"
                                            : undefined
                                        }
                                      />
                                    </button>
                                  ) : null}
                                  {isAoNativeThread(t) ? (
                                    <button
                                      type="button"
                                      className={AO_AGENDA_NAV_BTN_CLASS}
                                      aria-label={`議事「${aoThreadTitleForList(t)}」を削除`}
                                      disabled={deletingThreadId === t.id}
                                      onClick={() => requestDeleteAoThread(t.id)}
                                    >
                                      <IcoTrash size={12} />
                                    </button>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  className="min-w-0 truncate border-0 bg-transparent p-0 text-left text-[#3D1C08] outline-none group-hover/row:underline"
                                  onClick={() => {
                                    setCurrentThread(t.id);
                                    setComposeLocked(true);
                                    const topic = topicUiIdForProjectId(t.projectId);
                                    if (topic) setSelectedTopic(topic);
                                    topicBeforeTopicOverlayRef.current = null;
                                  }}
                                >
                                  {aoThreadTitleForList(t)}
                                </button>
                                <span className="min-w-[52px] shrink-0 whitespace-nowrap text-center text-[11px] leading-tight text-[#6A3F0A]/80">
                                  {threadSourceProviderUlusLabel(t.sourceProvider)}
                                </span>
                                <span className="min-w-[108px] shrink-0 pr-[20px] text-right tabular-nums text-[11px] text-[#6A3F0A]/80">
                                  {formatDateDay(t.updatedAt)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </AoMainColumnFrame>
                {showDeleteConfirmPopup && deleteConfirmPopupMarkdown && deleteConfirmKorguzKin ? (
                  <AoDeleteConfirmPopup
                    kinColumn={deleteConfirmKorguzKin}
                    messageMarkdown={deleteConfirmPopupMarkdown}
                    confirmDisabled={Boolean(deletingThreadId)}
                    onCancel={() => setDeleteConfirmThreadId(null)}
                    onConfirm={() => {
                      if (deleteConfirmThreadId) void deleteAoThread(deleteConfirmThreadId);
                    }}
                  />
                ) : null}
              </div>
            ) : (
            <>
            <div
              ref={messagesRef}
              className="relative z-10 min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
              style={{
                paddingLeft: CHAT_AREA_PAD_X_PX,
                paddingRight: CHAT_AREA_PAD_RIGHT_PX,
                paddingTop: 0,
                paddingBottom: MAIN_MIDDLE_SECTION_PAD_X_PX,
              }}
              onScroll={() => {
                const el = messagesRef.current;
                if (!el) return;
                if (chatScrollRafRef.current != null) cancelAnimationFrame(chatScrollRafRef.current);
                chatScrollRafRef.current = requestAnimationFrame(() => {
                  const nearBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 48;
                  chatAutoStickToBottomRef.current = nearBottom;
                });
              }}
            >
              <div className="flex min-h-full flex-col justify-start gap-3">
                {(chatError || syncNotice || chatClientLogs.length > 0) ? (
                  <div
                    role="alert"
                    className="rounded-sm border border-red-800/40 bg-red-950/10 px-3 py-2 text-[12px] leading-relaxed text-red-900"
                  >
                    {syncNotice ? (
                      <>
                        <div className="font-semibold">同期の注意</div>
                        <div className="mt-0.5 break-words">{syncNotice}</div>
                      </>
                    ) : null}
                    {chatError ? (
                      <>
                        <div className={`font-semibold${syncNotice ? " mt-2" : ""}`}>応答に失敗しました</div>
                        <div className="mt-0.5 break-words">{chatError}</div>
                      </>
                    ) : null}
                    {chatClientLogs.length > 0 ? (
                      <details className={chatError || syncNotice ? "mt-2" : ""} open={!chatError && !syncNotice}>
                        <summary className="cursor-pointer text-[11px] font-semibold text-red-900/90">
                          チャットログ（直近 {chatClientLogs.length} 件）
                        </summary>
                        <ul className="mt-1 max-h-32 list-none space-y-1 overflow-y-auto p-0 text-[10px] leading-snug text-red-950/90">
                          {chatClientLogs.map((row, i) => (
                            <li key={`${row.at}-${i}`} className="break-words border-t border-red-900/10 pt-1 first:border-0 first:pt-0">
                              <span className="tabular-nums opacity-70">
                                {new Date(row.at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                              </span>{" "}
                              [{row.level}] {row.message}
                              {row.detail ? ` — ${row.detail}` : ""}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                    <button
                      type="button"
                      className="mt-1 border-0 bg-transparent p-0 text-[11px] text-red-800 underline"
                      onClick={() => {
                        setChatError(null);
                        setSyncNotice(null);
                        setChatClientLogs([]);
                      }}
                    >
                      閉じる
                    </button>
                  </div>
                ) : null}
                {chatTimelineRowsForRender(
                  currentThread?.messages ?? [],
                  Boolean(isTyping || typingId),
                ).map((m) => {
                  const { label, avatarSrc } = aiSpeakerUi(currentThread, m, personaCatalog);

                  const chatBubblePadStyle: CSSProperties = {
                    boxSizing: "border-box",
                    maxWidth: chatBubbleMaxWidth,
                    width: "100%",
                    minWidth: 0,
                    minHeight: CHAT_HISTORY_BUBBLE_MIN_H_PX,
                    overflowWrap: "break-word",
                  };

                  if (m.side === "ai") {
                    const aiBubbleStyle: CSSProperties = {
                      ...chatBubblePadStyle,
                      color: AO_CHAT_AI_BUBBLE_FG,
                      filter: AO_P5_BUBBLE_SHADOW_FILTER,
                    };
                    const avatarBtn = (
                      <button
                        type="button"
                        className="cursor-pointer touch-manipulation rounded-none border-0 bg-transparent p-0 select-none"
                        style={{ filter: AO_CHAT_AVATAR_DROP_SHADOW_FILTER }}
                        aria-label="モデル情報と Raw プロンプト"
                        onClick={(e) => {
                          void hydrateRawFromServerIfNeeded(e, "ai", m);
                        }}
                      >
                        <AoP5FaceFrameMid
                          src={avatarSrc}
                          alt={label}
                          width={NOKOR_PORTRAIT_W_PX}
                          height={NOKOR_PORTRAIT_BOX_H_PX}
                          portraitScale={AO_MAIN_CHAT_FACE_PORTRAIT_SCALE}
                        />
                      </button>
                    );
                    return (
                      <div
                        key={m.id}
                        data-ao-chat-row
                        data-ao-chat-side="ai"
                        data-ao-msg-id={m.id}
                        className="flex w-full items-start"
                        style={{ gap: chatRowGap }}
                      >
                        <div className="flex shrink-0 flex-col items-stretch gap-0 font-serif">
                          <AoChatAiAvatarStack face={avatarBtn} label={label} />
                        </div>
                        <div
                          data-ao-chat-bubble
                          className="flex min-h-0 min-w-0 flex-1 flex-col items-start justify-start overflow-visible"
                        >
                          <AoP5NineSliceBubble
                            variant="ai"
                            frameScale={0.5}
                            className="max-w-full text-[13px] leading-relaxed"
                            style={aiBubbleStyle}
                          >
                            {typingId === m.id ? (
                              <span style={{ color: AO_CHAT_AI_BUBBLE_FG }}>{msgTextForUi(currentThread, m)}</span>
                            ) : (
                              <AoMessageMarkdown text={msgTextForUi(currentThread, m)} className="ao-chat-ai-bubble-md" />
                            )}
                          </AoP5NineSliceBubble>
                        </div>
                      </div>
                    );
                  }

                  const userBubbleStyle: CSSProperties = {
                    ...chatBubblePadStyle,
                    filter: AO_P5_BUBBLE_SHADOW_FILTER,
                  };
                  const userAvatarBtn = (
                    <button
                      type="button"
                      className="cursor-pointer touch-manipulation rounded-none border-0 bg-transparent p-0 select-none"
                      style={{ filter: AO_CHAT_AVATAR_DROP_SHADOW_FILTER }}
                      aria-label="モデル情報と Raw プロンプト（送信側）"
                      onClick={(e) => {
                        void hydrateRawFromServerIfNeeded(e, "user", m);
                      }}
                    >
                      <AoP5FaceFrameMid
                        src={avatarSrc}
                        alt={label}
                        width={NOKOR_PORTRAIT_W_PX}
                        height={NOKOR_PORTRAIT_BOX_H_PX}
                        portraitScale={AO_MAIN_CHAT_FACE_PORTRAIT_SCALE}
                      />
                    </button>
                  );
                  return (
                    <div
                      key={m.id}
                      data-ao-chat-row
                      data-ao-chat-side="user"
                      data-ao-msg-id={m.id}
                      className="grid w-full min-w-0 max-w-full items-start"
                      style={mainComposeRowGridStyle()}
                    >
                      <div
                        data-ao-chat-bubble
                        className="flex min-h-0 min-w-0 flex-col items-end justify-end overflow-visible"
                      >
                        <AoP5NineSliceBubble
                          variant="user"
                          frameScale={0.5}
                          className="max-w-full text-[13px] leading-relaxed text-[#1a1208]"
                          style={userBubbleStyle}
                        >
                          {editingUserMsgId === m.id ? (
                            <div className="flex w-full flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <textarea
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                                className="min-h-[72px] w-full resize-y rounded-sm border border-[#3D1C08]/25 bg-white/95 p-1.5 font-serif text-[13px] leading-relaxed text-[#1a1208] outline-none focus:ring-1 focus:ring-[#DBB961]/50"
                                aria-label="投稿を編集"
                              />
                              <div className="flex flex-wrap justify-end gap-2 text-[10px] text-[#6A3F0A]">
                                <button
                                  type="button"
                                  className="border-0 bg-transparent px-1 py-0.5 underline-offset-2 hover:underline"
                                  onClick={() => cancelEditUserMessage()}
                                >
                                  取消
                                </button>
                                <button
                                  type="button"
                                  className="border-0 bg-transparent px-1 py-0.5 text-red-900/90 underline-offset-2 hover:underline"
                                  onClick={() => requestRewindFromEdit(m.id, "", true)}
                                >
                                  削除
                                </button>
                                <button
                                  type="button"
                                  className="border-0 bg-transparent px-1 py-0.5 font-semibold text-[#3D1C08] underline-offset-2 hover:underline"
                                  onClick={() => {
                                    const t = editDraft.trim();
                                    if (!t) {
                                      requestRewindFromEdit(m.id, "", true);
                                      return;
                                    }
                                    requestRewindFromEdit(m.id, t, false);
                                  }}
                                >
                                  確定
                                </button>
                              </div>
                            </div>
                          ) : typingId === m.id ? (
                            <span>{msgTextForUi(currentThread, m)}</span>
                          ) : (
                            <div
                              className={
                                canEditUserMessage(m)
                                  ? "cursor-pointer rounded-sm hover:outline hover:outline-1 hover:outline-[#DBB961]/40"
                                  : undefined
                              }
                              role={canEditUserMessage(m) ? "button" : undefined}
                              tabIndex={canEditUserMessage(m) ? 0 : undefined}
                              onClick={() => startEditUserMessage(m)}
                              onKeyDown={(e) => {
                                if (!canEditUserMessage(m)) return;
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  startEditUserMessage(m);
                                }
                              }}
                            >
                              <AoMessageMarkdown text={msgTextForUi(currentThread, m)} />
                              {m.attachments?.length ? (
                                <AoMessageAttachments attachments={m.attachments} />
                              ) : null}
                            </div>
                          )}
                        </AoP5NineSliceBubble>
                      </div>
                      <div className="relative z-20 box-border flex min-w-0 flex-col items-center gap-0 font-serif">
                        <div className="flex w-full justify-center">{userAvatarBtn}</div>
                        <div className="flex w-full justify-center">
                          <AoP5NameplateSmFrame
                            width={CHAT_NAMEPLATE_MIN_W_PX}
                            text="ジュチ"
                            {...MAIN_CHAT_NAMEPLATE_OPTS}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {isThinking && currentThread ? (
                  <div
                    className="flex w-full items-start"
                    style={{ gap: chatRowGap }}
                    aria-live="polite"
                    aria-busy="true"
                  >
                    {(() => {
                      const thinkingUi = aoThinkingSpeakerUi(currentThread, personaCatalog);
                      return (
                        <>
                          <div className="flex shrink-0 flex-col items-stretch gap-0 font-serif">
                            <AoChatAiAvatarStack
                              face={
                                <AoP5FaceFrameMid
                                  src={thinkingUi.avatarSrc}
                                  alt={thinkingUi.label}
                                  width={NOKOR_PORTRAIT_W_PX}
                                  height={NOKOR_PORTRAIT_BOX_H_PX}
                                  portraitScale={AO_MAIN_CHAT_FACE_PORTRAIT_SCALE}
                                />
                              }
                              label={thinkingUi.label}
                            />
                          </div>
                          <div className="flex min-h-0 min-w-0 flex-1 flex-col items-start justify-start overflow-visible">
                            <AoP5NineSliceBubble
                              variant="ai"
                              frameScale={0.5}
                              className="max-w-full text-[13px] leading-relaxed"
                              style={{
                                boxSizing: "border-box",
                                maxWidth: chatBubbleMaxWidth,
                                width: "100%",
                                minWidth: 0,
                                minHeight: CHAT_HISTORY_BUBBLE_MIN_H_PX,
                                overflowWrap: "break-word",
                                color: AO_CHAT_AI_BUBBLE_FG,
                                filter: AO_P5_BUBBLE_SHADOW_FILTER,
                              }}
                            >
                              <span
                                className="ao-thinking-dots-text font-serif tabular-nums whitespace-pre-wrap"
                                style={{ color: AO_CHAT_AI_BUBBLE_FG, minHeight: "1.25em", minWidth: "2ch" }}
                              >
                                {thinkingStatusLabel ? (
                                  <>
                                    {thinkingStatusLabel}
                                    {"\n"}
                                    {thinkingUiPhase === 1 ? thinkingDotsText : (
                                      <>
                                        ....{"\n"}
                                        {thinkingDotsText}
                                      </>
                                    )}
                                  </>
                                ) : thinkingUiPhase === 1 ? (
                                  thinkingDotsText
                                ) : (
                                  <>
                                    ....{"\n"}
                                    {thinkingDotsText}
                                  </>
                                )}
                              </span>
                            </AoP5NineSliceBubble>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
            </div>
            {showRewindConfirmPopup && rewindConfirmPopupMarkdown && deleteConfirmKorguzKin ? (
              <AoDeleteConfirmPopup
                kinColumn={deleteConfirmKorguzKin}
                messageMarkdown={rewindConfirmPopupMarkdown}
                onCancel={() => setRewindConfirm(null)}
                onConfirm={() => void confirmRewindEdit()}
              />
            ) : null}
            </>
            )}
            </section>
    </>
  );
}
