"use client";

import {
  createAoThreadForTopic,
  isAoNativeThread,
} from "@/lib/ao-topics";
import {
  IcoAgendaPageFirst,
  IcoAgendaPageLast,
  IcoAgendaPageNext,
  IcoAgendaPagePrev,
  IcoArrowLeft,
  IcoCheck,
  IcoRoundedPlus,
  IcoTrash,
  IcoPin,
} from "@/components/ao-action-icons";
import { AoMessageMarkdown } from "@/components/AoMessageMarkdown";
import { AoComposeAttachments } from "@/components/ao-compose-attachments";
import { AO_ATTACHMENT_ACCEPT } from "@/lib/ao-attachments";
import { AoDeleteConfirmPopup } from "@/components/AoDeleteConfirmPopup";
import { AoReijitsuOverlay } from "@/components/AoReijitsuOverlay";
import {
  AoSettingsOverlay,
  AoSettingsSubpageTabs,
} from "@/components/AoSettingsOverlay";
import { AoUsageOverlay } from "@/components/AoUsageOverlay";
import {
  aoClampStoredThreadTitle,
  aoClampTitleDraftInput,
  aoThreadTitleChipLabel,
  aoThreadTitleForList,
} from "@/lib/ao-thread-title";
import { AoMainComposeToolbar } from "@/components/ao-main-compose-toolbar";
import { AoMainJuchiActions } from "@/components/ao-main-juchi-actions";
import { AoProjectTabsPanel } from "@/components/ao-project-tabs-panel";
import {
  AoTemplateFrame,
  AoP5NineSliceBubble,
  AoP5FaceFrameMid,
  AO_MAIN_CHAT_FACE_PORTRAIT_SCALE,
  AoP5NameplateSmFrame,
} from "@/components/ao-phase5";
import {
  AoMainComposeTextarea,
  AoMainTitleInput,
} from "@/components/ao-main-compose-fields";
import { AoRubyGold } from "@/components/ao-ruby-gold";
import {
  AO_AGENDA_NAV_BTN_CLASS,
  AO_BTN_CLASS,
  AO_MAIN_ICON_BTN_CLASS,
  AO_SUBPAGE_HDR_NEW_BTN_CLASS,
} from "@/lib/template/ao-chrome";
import {
  CHAT_AREA_PAD_RIGHT_PX,
  CHAT_AREA_PAD_X_PX,
  CHAT_NAMEPLATE_MIN_W_PX,
  GIJI_TITLE_CHIP_COMPACT_PARCHMENT_PAD_Y_PX,
  GIJI_TITLE_PARCHMENT_PAD_Y_PX,
  JUCHI_PORTRAIT_BOX_H_PX,
  MAIN_COLUMN_GUTTER_X_PX,
  MAIN_INNER_TOP_PAD_PX,
  MAIN_JUCHI_AVATAR_COL_W_PX,
  MAIN_JUCHI_RUBY_MAIN_CLASS,
  MAIN_CHAT_NAMEPLATE_OPTS,
  MAIN_SPEECH_BUBBLE_H_PX,
  NOKOR_PORTRAIT_W_PX,
  mainComposeTextareaMinHPx,
} from "@/lib/ao-kin-layout";
import { AO_Z_COMPACT_MAIN } from "@/lib/ao-viewport-compact";
import {
  formatDateDay,
  threadSourceProviderUlusLabel,
} from "@/lib/ao-home-helpers";
import type { AoChatSession } from "@/components/use-ao-chat-session";

const AO_MAIN_SEND_BTN_CLASS = AO_BTN_CLASS;

export function AoChatUserArea({ session }: { session: AoChatSession }) {
  const { viewportCompact, compactGijiChipIconPxBig } = session.shell;
  const {
    currentThread,
    selectedTopic,
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
  } = session.thread;
  const {
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
  } = session.compose;
  const {
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
  } = session.ron;
  const {
    anyMainOverlay,
    onMainOverlayBackClick,
    settingsOpen,
    settingsOverlayRef,
    settingsEmbeddedSubpage,
    setSettingsEmbeddedSubpage,
    settingsSavePending,
    setSettingsSavePending,
    closeSettingsUsageOverlay,
    openChronicleOverlay,
    openContextOverlay,
  } = session.overlay;

  return (
            <div
              className="relative z-[20] w-full max-w-full shrink-0 min-w-0 box-border overflow-visible"
              style={{
                paddingLeft: CHAT_AREA_PAD_X_PX,
                paddingRight: CHAT_AREA_PAD_RIGHT_PX,
                ...(viewportCompact ? { zIndex: AO_Z_COMPACT_MAIN } : { zIndex: 20 }),
              }}
            >
            <AoTemplateFrame
              preset="frame_AL"
              className="relative z-[20] flex min-h-0 w-full max-w-full shrink-0 flex-col min-w-0"
              style={{
                ...mainColumnWidthStyle,
              }}
              contentClassName="flex shrink-0 flex-col min-w-0"
            >
            <main
              className={`ao-p5-parchment-surface relative box-border flex min-h-0 w-full shrink-0 flex-col min-w-0 ${viewportCompact ? "min-h-0 shrink-0 overflow-x-visible overflow-y-auto" : "overflow-visible"}`}
              style={{
                /* メイン部：固定高だと余りが空白として残るため、基本は内容高に追従させる */
                paddingLeft: `${MAIN_COLUMN_GUTTER_X_PX}px`,
                paddingRight: `${MAIN_COLUMN_GUTTER_X_PX}px`,
                paddingBottom: "0px",
                paddingTop: `${viewportCompact ? Math.max(0, Math.round(MAIN_INNER_TOP_PAD_PX * 0.45)) : MAIN_INNER_TOP_PAD_PX}px`,
              }}
            >
              <section
                className={`relative flex min-h-0 min-w-0 flex-col overflow-y-auto ${
                  viewportCompact ? "min-w-0 flex-1 overflow-x-visible" : "min-w-0 flex-1 overflow-x-visible"
                }`}
              >
          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          {/* ③ 論（縦）：左列 */}
          <div
            className="flex min-h-0 flex-1 flex-col px-0"
            style={{
              paddingTop: 0,
              paddingBottom: 0,
            }}
          >
            <div
              className="flex min-h-0 flex-1 min-w-0 self-stretch flex-row items-stretch"
              style={{ gap: 6 }}
            >
              <AoProjectTabsPanel
                {...projectTabsPanelProps}
                measureRef={ronListMeasureRef}
                columnWidthPx={ronColWidthPx}
              />
              {/* タイトル＋吹き出し */}
              <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col self-stretch">
                {!anyMainOverlay ? (
                <>
                {/* タイトル行（右上：年代記／使用量／設定）＋吹き出し（右にユーザー） */}
                <div
                  className={`mt-0 flex h-full min-h-0 min-w-0 flex-1 flex-col ${viewportCompact ? "overflow-x-visible overflow-y-visible" : "overflow-visible"}`}
                  style={{
                    paddingTop: 0,
                    gap: viewportCompact ? 4 : 6,
                    paddingBottom: 0,
                  }}
                >
                  {/* ユーザーエリア中央＋右：タイトル＋吹き出し | アイコン・顔・送信 */}
                  <div
                    className="flex w-full min-w-0 flex-1 flex-row items-start"
                    style={{ gap: viewportCompact ? 4 : 6 }}
                  >
                    <div className="flex min-w-0 flex-1 flex-col" style={{ gap: viewportCompact ? 4 : 6 }}>
                      <div className="min-w-0 w-full shrink-0">
                        <AoTemplateFrame
                          preset="frame_AS"
                          className="w-full max-w-full overflow-visible"
                          contentClassName="overflow-visible"
                          contentStyle={{
                            padding: 0,
                          }}
                        >
                          <div
                            ref={titleChipParchmentRef}
                            className="ao-p5-parchment-surface box-border flex w-full min-h-0 items-center justify-center px-0"
                            style={{
                              minHeight: viewportCompact ? compactRonTitleChipH : 0,
                              height: "auto",
                              paddingTop: viewportCompact
                                ? GIJI_TITLE_CHIP_COMPACT_PARCHMENT_PAD_Y_PX
                                : GIJI_TITLE_PARCHMENT_PAD_Y_PX,
                              paddingBottom: viewportCompact
                                ? GIJI_TITLE_CHIP_COMPACT_PARCHMENT_PAD_Y_PX
                                : GIJI_TITLE_PARCHMENT_PAD_Y_PX,
                            }}
                          >
                            {titleEditing && currentThread ? (
                              <AoMainTitleInput
                                inputRef={titleInputRef}
                                value={titleDraft}
                                onChange={(e) => {
                                  setTitleDraft(aoClampTitleDraftInput(e.target.value));
                                }}
                                onBlur={() => {
                                  setTitleEditing(false);
                                  if (!currentThread) return;
                                  if (!isAoNativeThread(currentThread)) {
                                    setTitleDraft(currentThread.title);
                                    return;
                                  }
                                  const trimmed = aoClampStoredThreadTitle(titleDraft);
                                  setState((prev) => {
                                    const ti = prev.threads.findIndex((t) => t.id === currentThread.id);
                                    if (ti < 0) return prev;
                                    const arr = [...prev.threads];
                                    arr[ti] = { ...arr[ti], title: trimmed };
                                    return { ...prev, threads: arr };
                                  });
                                }}
                                visualFs={compactGijiTitleFs}
                                useCompactNoZoom={viewportCompact}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setTitleDraft(currentThread?.title ?? "");
                                  setTitleEditing(true);
                                }}
                                style={{ fontSize: compactGijiTitleFs }}
                                className={`flex min-h-0 w-full min-w-0 items-center justify-center rounded-none border-0 bg-transparent py-0 text-center font-serif font-semibold leading-tight text-[#3D1C08] ${
                                  viewportCompact ? "px-0" : "px-2"
                                }`}
                              >
                                『{aoThreadTitleChipLabel(currentThread)}』
                              </button>
                            )}
                          </div>
                        </AoTemplateFrame>
                      </div>
                      <div className="isolate flex min-w-0 w-full flex-col overflow-visible">
                        <AoP5NineSliceBubble
                          variant="user"
                          frameScale={0.5}
                          fillHeight={false}
                          className="block w-full overflow-visible"
                          contentPadX={8}
                          contentPadY={6}
                          minHeightPx={viewportCompact ? compactSpeechBubbleH : MAIN_SPEECH_BUBBLE_H_PX}
                          style={{
                            filter: "none",
                            minHeight: viewportCompact ? compactSpeechBubbleH : MAIN_SPEECH_BUBBLE_H_PX,
                          }}
                        >
                          <AoComposeAttachments
                            pending={pendingAttachments}
                            onRemove={(path) =>
                              setPendingAttachments((prev) => prev.filter((a) => a.storagePath !== path))
                            }
                            className="mb-1 px-1"
                          />
                          <AoMainComposeTextarea
                            textareaRef={promptTextareaRef}
                            value={draft}
                            readOnly={composeLocked}
                            composeLocked={composeLocked}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (composeLocked) return;
                              if (e.nativeEvent.isComposing) return;
                              if (e.key === "Enter" && e.metaKey) {
                                e.preventDefault();
                                void sendUserMessage();
                              }
                            }}
                            onPaste={(e) => void onComposePaste(e)}
                            placeholder={
                              composeLocked ? "過去ログ（年代記）表示中は入力できません" : undefined
                            }
                            fontSizePx={compactMainTextareaFs}
                            visualScale={compactMainTextareaVisualScale}
                            autoGrow
                            minHeightPx={mainComposeTextareaMinHPx(
                              viewportCompact ? compactSpeechBubbleH : MAIN_SPEECH_BUBBLE_H_PX,
                            )}
                            growDeps={pendingAttachments.length}
                          />
                        </AoP5NineSliceBubble>
                      </div>
                    </div>
                    <div
                      className="relative z-20 box-border flex shrink-0 flex-col items-center gap-0.5 self-start overflow-visible font-serif"
                      style={{ width: MAIN_JUCHI_AVATAR_COL_W_PX }}
                    >
                      <AoMainComposeToolbar
                        attachInputRef={attachInputRef}
                        composeLocked={composeLocked}
                        pendingAttachmentCount={pendingAttachments.length}
                        onAttachSelected={(files) => void onAttachFilesSelected(files)}
                        onOpenContext={() => openContextOverlay()}
                        onOpenChronicle={() => openChronicleOverlay()}
                        iconSize={compactGijiChipIconPxBig}
                        iconBtnClass={AO_MAIN_ICON_BTN_CLASS}
                        compactPadding={viewportCompact}
                        accept={AO_ATTACHMENT_ACCEPT}
                      />
                      <div className="flex w-full justify-center">
                        <AoP5FaceFrameMid
                          src="/personas/juci.png"
                          alt="ジュチ"
                          width={NOKOR_PORTRAIT_W_PX}
                          height={JUCHI_PORTRAIT_BOX_H_PX}
                          portraitScale={AO_MAIN_CHAT_FACE_PORTRAIT_SCALE}
                        />
                      </div>
                      <AoP5NameplateSmFrame
                        width={CHAT_NAMEPLATE_MIN_W_PX}
                        text="ジュチ"
                        {...MAIN_CHAT_NAMEPLATE_OPTS}
                      />
                      <div className="w-full text-center leading-tight">
                        <AoRubyGold
                          main="邦　主"
                          rt="ウルス・ハン"
                          mainClassName={MAIN_JUCHI_RUBY_MAIN_CLASS}
                          rtClassName="text-[8px] font-serif text-[#6A3F0A]/80"
                        />
                      </div>
                      <AoMainJuchiActions
                        composeLocked={composeLocked}
                        onSend={() => void sendUserMessage()}
                        iconSize={compactGijiChipIconPxBig}
                        sendBtnClass={AO_MAIN_SEND_BTN_CLASS}
                        compactPadding={viewportCompact}
                      />
                    </div>
                  </div>
                </div>
                </>
                ) : (
                <>
                  <div className="shrink-0 w-full" style={{ height: ronSubpageBandPx }} aria-hidden />
                  <div
                    className={`pointer-events-auto absolute inset-x-0 top-0 z-[50] box-border flex min-h-0 flex-col ${showDeleteConfirmPopup ? "overflow-visible" : "overflow-hidden"}`}
                    style={{ height: ronSubpageBandPx }}
                    role="dialog"
                    aria-modal="true"
                    aria-label={
                      showRonAgendaPanel ? "議事一覧" : "設定"
                    }
                  >
                    <AoTemplateFrame
                      preset="frame_AS"
                      className="box-border flex h-full min-h-0 w-full flex-col overflow-hidden"
                      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
                    >
                      <div className="ao-p5-parchment-surface flex h-full min-h-0 flex-col gap-0.5 overflow-hidden">
                        {showRonAgendaPanel && selectedTopic ? (
                          <div className="grid w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-x-0.5 px-0.5 py-0">
                              <div className="flex min-w-0 justify-start">
                                <button
                                  type="button"
                                  className={AO_SUBPAGE_HDR_NEW_BTN_CLASS}
                                  aria-label="新規議事を作成"
                                  onClick={() => {
                                    const nt = createAoThreadForTopic(selectedTopic);
                                    setComposeLocked(false);
                                    topicBeforeTopicOverlayRef.current = null;
                                    setRonListOverlayOpen(false);
                                    setState((prev) => {
                                      const withoutGhost = prev.threads.filter(
                                        (t) =>
                                          !(t.ephemeral && t.messages.length === 0 && t.projectId === nt.projectId),
                                      );
                                      return {
                                        ...prev,
                                        threads: [nt, ...withoutGhost],
                                        currentThreadId: nt.id,
                                        currentProjectId: nt.projectId,
                                      };
                                    });
                                    setDraft("");
                                    scheduleFocusMainPrompt();
                                  }}
                                >
                                  <IcoRoundedPlus size={14} className="shrink-0" />
                                  新規
                                </button>
                              </div>
                              <div className="flex shrink-0 items-center justify-center gap-px">
                                <button
                                  type="button"
                                  className={AO_AGENDA_NAV_BTN_CLASS}
                                  aria-label="先頭ページ"
                                  disabled={agendaPageIndex <= 0}
                                  onClick={() => setAgendaPageIndex(0)}
                                >
                                  <IcoAgendaPageFirst size={16} />
                                </button>
                                <button
                                  type="button"
                                  className={AO_AGENDA_NAV_BTN_CLASS}
                                  aria-label="前のページ"
                                  disabled={agendaPageIndex <= 0}
                                  onClick={() => setAgendaPageIndex((i) => Math.max(0, i - 1))}
                                >
                                  <IcoAgendaPagePrev size={16} />
                                </button>
                                <button
                                  type="button"
                                  className={AO_AGENDA_NAV_BTN_CLASS}
                                  aria-label="次のページ"
                                  disabled={agendaPageIndex >= agendaMaxPageIndex}
                                  onClick={() =>
                                    setAgendaPageIndex((i) => Math.min(agendaMaxPageIndex, i + 1))
                                  }
                                >
                                  <IcoAgendaPageNext size={16} />
                                </button>
                                <button
                                  type="button"
                                  className={AO_AGENDA_NAV_BTN_CLASS}
                                  aria-label="末尾ページ"
                                  disabled={agendaPageIndex >= agendaMaxPageIndex}
                                  onClick={() => setAgendaPageIndex(agendaMaxPageIndex)}
                                >
                                  <IcoAgendaPageLast size={16} />
                                </button>
                              </div>
                              <div className="flex min-w-0 justify-end">
                                <button
                                  type="button"
                                  className={AO_AGENDA_NAV_BTN_CLASS}
                                  aria-label="戻る"
                                  onClick={closeRonAgendaOverlay}
                                >
                                  <IcoArrowLeft size={14} className="shrink-0" />
                                </button>
                              </div>
                            </div>
                        ) : (
                        <div className="grid w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-x-0.5 px-0.5 py-0">
                          <div className="flex min-w-0 justify-start">
                            {settingsOpen ? (
                              <div className="min-w-0 shrink-0" aria-hidden />
                            ) : (
                              <AoRubyGold
                                main="使　用　量"
                                rt="　"
                                mainClassName="text-[14px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]"
                                rtClassName="text-[9px] font-serif text-[#6A3F0A]/80"
                              />
                            )}
                          </div>
                          <div className="flex min-w-0 w-full shrink-0 items-center justify-center gap-px">
                            {settingsOpen ? (
                              <div className="flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-0.5 px-0.5">
                                <AoRubyGold
                                  main="設　定"
                                  rt="　"
                                  mainClassName="text-[14px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]"
                                  rtClassName="text-[9px] font-serif text-[#6A3F0A]/80"
                                />
                                <AoSettingsSubpageTabs
                                  active={settingsEmbeddedSubpage}
                                  onChange={setSettingsEmbeddedSubpage}
                                />
                              </div>
                            ) : (
                              <span className="inline-block w-0 max-w-0 shrink-0 overflow-hidden" aria-hidden />
                            )}
                          </div>
                          <div className="flex min-w-0 shrink-0 items-center justify-end gap-0.5">
                            {settingsOpen ? (
                              <button
                                type="button"
                                className={`${AO_AGENDA_NAV_BTN_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
                                aria-label={settingsSavePending ? "保存中" : "確定"}
                                disabled={settingsSavePending}
                                onClick={() => {
                                  void (async () => {
                                    if (!settingsOverlayRef.current) return;
                                    setSettingsSavePending(true);
                                    try {
                                      await settingsOverlayRef.current.confirmSave();
                                    } finally {
                                      setSettingsSavePending(false);
                                    }
                                  })();
                                }}
                              >
                                {settingsSavePending ? (
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
                        )}
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-0.5 pb-0.5">
                          {showRonAgendaPanel && selectedTopic ? (
                            <div
                              className={`min-h-0 flex-1 overflow-y-auto border border-solid [scrollbar-gutter:stable] ${viewportCompact ? "text-[10px]" : "text-[11px]"}`}
                              style={{ borderColor: "#3D1C08", borderWidth: 1, backgroundColor: "rgba(255,250,240,0.35)" }}
                            >
                              <table className="w-full border-collapse text-[#3D1C08]">
                                <tbody>
                                  {agendaRowsSlice.map((t) => (
                                    <tr
                                      key={t.id}
                                      className="cursor-pointer border-b border-[#3D1C08] last:border-b-0 hover:bg-[#143d5e]/15"
                                      onClick={() => {
                                        selectRonAgendaThread(t);
                                      }}
                                    >
                                      <td className="w-[28px] px-0.5 py-0.5">
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
                                          <button
                                          type="button"
                                          className={AO_AGENDA_NAV_BTN_CLASS}
                                          aria-label={`議事「${aoThreadTitleForList(t)}」を削除`}
                                          disabled={deletingThreadId === t.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            requestDeleteAoThread(t.id);
                                          }}
                                        >
                                          <IcoTrash size={12} />
                                        </button>
                                        </div>
                                      </td>
                                      <td className="max-w-0 px-1.5 py-0.5">
                                        <span className="block truncate">{aoThreadTitleForList(t)}</span>
                                      </td>
                                      <td className="w-[52px] whitespace-nowrap px-1 py-0.5 text-center text-[#6A3F0A]/90">
                                        {threadSourceProviderUlusLabel(t.sourceProvider)}
                                      </td>
                                      <td className="w-[76px] whitespace-nowrap px-1.5 py-0.5 text-right tabular-nums text-[#6A3F0A]/90">
                                        {formatDateDay(t.updatedAt)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : null}
                          {settingsOpen ? (
                            <AoSettingsOverlay
                              ref={settingsOverlayRef}
                              embedded
                              open={settingsOpen}
                              embeddedSubpage={settingsEmbeddedSubpage}
                              onEmbeddedSubpageChange={setSettingsEmbeddedSubpage}
                              onClose={closeSettingsUsageOverlay}
                            />
                          ) : null}
                        </div>
                      </div>
                    </AoTemplateFrame>
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
                </>
                )}
              </div>
            </div>
          </div>

          {/* 中段は「論エリア右側」へ統合（上で描画） */}
          </div>
              </section>
            </main>
            </AoTemplateFrame>
            </div>
  );
}
