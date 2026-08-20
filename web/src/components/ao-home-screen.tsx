"use client";

import { createPortal } from "react-dom";
import { AO_TOPICS } from "@/lib/ao-topics";
import { IcoLogin, IcoLogout } from "@/components/ao-action-icons";
import { AoSidebarSettingsRow } from "@/components/ao-sidebar-settings-row";
import { AoKnowledgeModule } from "@/components/ao-knowledge-module";
import {
  AO_TEMPLATE_BG_MAP,
  AO_TEMPLATE_LOGO_16PRO,
  AO_TEMPLATE_LOGO_PC,
  AO_TEMPLATE_LOGO_SE1,
  AO_TEMPLATE_ORNAMENT_BAR,
} from "@/lib/template/ao-template-assets";
import { AoLeftKinSideColumn } from "@/components/ao-left-kin-side-column";
import { AO_P5_PARCHMENT } from "@/lib/template/ao-chrome";
import { MAIN_COLUMN_STACK_GAP_PX, MAIN_OUTER_TOP_GAP_PX } from "@/lib/ao-kin-layout";
import {
  AO_Z_COMPACT_HEADER,
  AO_Z_COMPACT_KIN_DRAWER_HOST,
  AO_Z_COMPACT_KIN_DRAWER_OPEN,
  AO_Z_COMPACT_MAP_STACK,
} from "@/lib/ao-viewport-compact";
import { useAoChatSession } from "@/components/use-ao-chat-session";
import { AoChatModule } from "@/components/ao-chat-module";

export function AoHomeScreen() {
  const session = useAoChatSession();
  const {
    viewportCompact,
    compactGijiChipIconPx,
    compactGijiChipIconPxBig,
    compactKinHeaderMeasureRef,
    compactKinFrameStripMeasureRef,
    setCompactKinPortalHost,
    kinDrawerAnchorBottomPx,
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
  } = session.shell;

  const kinDrawerPortalEl =
    viewportCompact && kinDrawerPortalReady && compactKinPortalHost ? (
      createPortal(
        <>
          <div
            role="presentation"
            className={`absolute inset-0 z-[1] bg-black/40 transition-opacity duration-200 ${
              leftKinDrawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden={!leftKinDrawerOpen}
            onClick={() => setLeftKinDrawerOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal={leftKinDrawerOpen}
            aria-hidden={!leftKinDrawerOpen}
            aria-label="邦主と僚友"
            className={`absolute left-0 top-0 z-[2] flex min-h-0 w-[min(92vw,400px)] flex-col overflow-hidden border-0 bg-transparent shadow-none will-change-transform ${
              leftKinDrawerOpen ? "pointer-events-auto" : "pointer-events-none"
            }`}
            style={{
              bottom: 0,
              paddingBottom: "max(8px, env(safe-area-inset-bottom, 0px))",
              transform: leftKinDrawerOpen ? "translate3d(0,0,0)" : "translate3d(-100%,0,0)",
              transition: "transform 280ms cubic-bezier(0.33, 1, 0.68, 1)",
            }}
          >
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-1 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <AoLeftKinSideColumn
                mobileDrawerNokorLayout
                nameplateFontSizePx={7}
                activeNames={activeNokorNames}
                viewportCompact
                v2Sidebar
                settingsArea={
                  <AoSidebarSettingsRow
                    iconSize={compactGijiChipIconPxBig}
                    onOpenUsage={() => {
                      setLeftKinDrawerOpen(false);
                      openUsageOverlay();
                    }}
                    activeFeatureId={activeFeatureId}
                    onSelectFeature={(id) => {
                      setActiveFeatureId(id);
                      if (id === "knowledge") setKnowledgeLayer("use");
                      setLeftKinDrawerOpen(false);
                    }}
                  />
                }
              />
            </div>
          </aside>
        </>,
        compactKinPortalHost,
      )
    ) : null;

  return (
    <div
      className={`relative flex min-h-0 flex-col overflow-hidden bg-white text-[var(--ao-white)] ao-mobile-stack-scale ${
        viewportCompact ? "" : "h-[100dvh] max-h-[100dvh]"
      }`}
    >
      <header
        ref={compactKinHeaderMeasureRef}
        className={`ao-header-safe-x ao-header-safe-top relative shrink-0 grid grid-cols-[1fr_auto_1fr] items-center ${
          viewportCompact ? "min-h-0 gap-x-1.5 px-2 py-0.5" : "z-10 h-[58px] gap-3 px-4"
        }`}
        style={{
          background: AO_P5_PARCHMENT,
          ...(viewportCompact ? { zIndex: AO_Z_COMPACT_HEADER } : {}),
        }}
      >
        {/* 左: 消費銀バー（スマホは左上端） */}
        <div
          className={`flex min-w-0 items-center justify-self-start ${viewportCompact ? "gap-1" : "gap-1.5"}`}
        >
          <span className={`shrink-0 text-[#6A3F0A] ${viewportCompact ? "text-[9px]" : "text-[10px]"}`}>
            消費銀
          </span>
          <div
            className={`h-[7px] rounded border border-[#C9922A]/40 bg-[#F5EDD6] ${viewportCompact ? "min-w-[56px] max-w-[120px] flex-1" : "min-w-[120px] max-w-[220px] flex-1"}`}
          >
            <div className="h-full w-[72%] rounded bg-[#C9922A]" />
          </div>
        </div>
        {/* 中: ロゴ 3 種。360〜767 で min-[360]:block と md:hidden が競合しうるため、16 Pro は block + max-[359]:hidden + md:hidden で表す */}
        <div className="flex justify-center justify-self-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={AO_TEMPLATE_LOGO_SE1}
            alt="Altan Orda"
            className="hidden max-[359px]:block h-[18px] w-auto max-w-[78vw] md:hidden"
            draggable={false}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={AO_TEMPLATE_LOGO_16PRO}
            alt="Altan Orda"
            className="block max-[359px]:hidden h-[18px] w-auto max-w-[78vw] md:hidden"
            draggable={false}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={AO_TEMPLATE_LOGO_PC}
            alt="Altan Orda"
            className="hidden h-[22px] w-auto max-w-[78vw] sm:h-[26px] md:block md:h-[34px]"
            draggable={false}
          />
        </div>
        {/* 右: 焼き印スタイルアイコンボタン（スマホは右上端） */}
        <div className={`flex items-center justify-self-end ${viewportCompact ? "gap-1" : "gap-1.5"}`}>
          <a
            className={`ao-seal-btn-p5 inline-flex items-center justify-center ${viewportCompact ? "ao-seal-btn-p5--compact" : ""}`}
            aria-label="ログイン"
            href="/api/ao-login"
          >
            <IcoLogin size={viewportCompact ? compactGijiChipIconPx : 15} />
          </a>
          <form action="/api/ao-logout" method="post" className="inline-flex" suppressHydrationWarning>
            <button
              type="submit"
              className={`ao-seal-btn-p5 ${viewportCompact ? "ao-seal-btn-p5--compact" : ""}`}
              aria-label="ログアウト"
            >
              <IcoLogout size={viewportCompact ? compactGijiChipIconPx : 15} />
            </button>
          </form>
        </div>
      </header>

      {/* ヘッダ直下: Frame.png を横方向タイル（狭ビューではヘッダ帯ジェスチャのヒット領域に含めるためタッチ可能に） */}
      <div
        ref={compactKinFrameStripMeasureRef}
        className={`relative h-[14px] w-full shrink-0 overflow-hidden ${viewportCompact ? "" : "pointer-events-none z-10"}`}
        style={viewportCompact ? { zIndex: AO_Z_COMPACT_HEADER } : undefined}
        aria-hidden
      >
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `url('${AO_TEMPLATE_ORNAMENT_BAR}')`,
            backgroundRepeat: "repeat-x",
            backgroundSize: "44px 14px",
          }}
        />
      </div>

      {/* 邦主・僚友ポータル（ヘッダより z が低く、メイン map/chat より手前） */}
      {viewportCompact ? (
        <div
          ref={setCompactKinPortalHost}
          className="pointer-events-none absolute inset-x-0 bottom-0"
          style={{
            top: kinDrawerAnchorBottomPx,
            zIndex: leftKinDrawerOpen ? AO_Z_COMPACT_KIN_DRAWER_OPEN : AO_Z_COMPACT_KIN_DRAWER_HOST,
          }}
        />
      ) : null}

      {/* 左カラムが画面高を超えてもOK（外枠が内容高で伸びる） */}
      <div
        ref={mapBgHostRef}
        className={
          viewportCompact
            ? "relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            : "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-auto overflow-y-hidden"
        }
        style={{
          ...(viewportCompact ? { zIndex: AO_Z_COMPACT_MAP_STACK } : {}),
        }}
      >
        {/* ①-2 ヘッダより下全体: 白地 + 地図 */}
        <div className="pointer-events-none absolute inset-0 z-0 bg-white" aria-hidden />
        {/* モバイルでは高さ指定なしの absolute ラッパーだと子が全て absolute で高さ 0 になり地図が消える。常に親いっぱいに敷く */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
          {Array.from({ length: mapBgTileCount }).map((_, i) => (
            <div
              key={i}
              className="absolute left-0 w-full opacity-60"
              style={{
                top: i * 1024,
                height: 1024,
                backgroundImage: `url('${AO_TEMPLATE_BG_MAP}')`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center top",
                backgroundSize: "1536px 1024px",
                transform: i % 2 === 1 ? "scaleY(-1)" : undefined,
                transformOrigin: "50% 50%",
              }}
            />
          ))}
        </div>

        {/* ②-1 左僚友 1 : 中央メイン＋チャット 3 : 右空白 2 */}
        <div
          className={`relative flex min-h-0 ${viewportCompact ? "z-0 min-h-0 flex-1 flex-col overflow-hidden" : "z-10 min-h-0 flex-1 flex-col overflow-hidden"}`}
        >
          <div
            className={`min-h-0 box-border flex flex-col ${
              viewportCompact
                ? "h-full min-h-0 w-full max-w-full flex-1 px-1"
                : "mx-auto flex h-full min-h-0 flex-1 flex-col"
            }`}
            style={{ paddingTop: MAIN_OUTER_TOP_GAP_PX, ...v2PcContainerStyle }}
          >
            <div
              className={`w-full min-h-0 ${
                viewportCompact
                  ? "flex min-h-0 flex-1 flex-col gap-3"
                  : `flex min-h-0 flex-1 flex-row items-stretch ${aoV2PcSidebar ? "gap-0" : "gap-3"} overflow-x-auto overflow-y-visible`
              }`}
            >
            {/* 左カラム：メイン部と同等の角／枠で囲う（狭ビューポートではスワイプドロワーでも表示） */}
            {!viewportCompact ? (
              <div
                className="min-h-0 shrink-0 overflow-y-auto overflow-x-visible"
                style={v2LeftColStyle}
              >
                <AoLeftKinSideColumn
                  measureRef={leftColumnMeasureRef}
                  activeNames={activeNokorNames}
                  viewportCompact={viewportCompact}
                  v2Sidebar={aoV2PcSidebar}
                  settingsArea={
                    <AoSidebarSettingsRow
                      iconSize={compactGijiChipIconPxBig}
                      onOpenUsage={openUsageOverlay}
                      activeFeatureId={activeFeatureId}
                      onSelectFeature={(id) => {
                        setActiveFeatureId(id);
                        if (id === "knowledge") setKnowledgeLayer("use");
                      }}
                    />
                  }
                />
              </div>
            ) : null}
            {/* ユーザー前・ビュー後ろ。大枠ドロップシャドウは付けない。吹き出しは枠の直下から */}
            <div
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-visible"
              style={{
                gap: MAIN_COLUMN_STACK_GAP_PX,
                minWidth: 0,
                isolation: "isolate",
                ...v2MainColStyle,
              }}
            >
            {activeFeatureId === "knowledge" ? (
              <AoKnowledgeModule layer={knowledgeLayer} onLayerChange={setKnowledgeLayer} />
            ) : (
              <AoChatModule session={session} />
            )}
            </div>
            </div>

          </div>

        </div>
      </div>

      <div
        ref={ronTopicLabelsProbeRef}
        className="pointer-events-none fixed left-[-9999px] top-0 z-[-1] flex flex-col whitespace-nowrap opacity-0"
        aria-hidden
      >
        {AO_TOPICS.filter((tp) => tp.id !== "kurultai").map((tp) => (
          <span
            key={tp.id}
            data-ao-ron-probe-label
            className="font-semibold text-[#3D1C08]"
            style={{ fontSize: compactRonTabTopicFs }}
          >
            {tp.label}
          </span>
        ))}
      </div>

      {kinDrawerPortalEl}

    </div>
  );
}
