"use client";

import { createPortal } from "react-dom";
import { AO_BUBBLE_SYSTEM_FILL } from "@/lib/template/ao-frame-tokens";
import { AoP5NineSliceBubble } from "@/components/ao-phase5";
import { AoUsageChipPanel } from "@/components/ao-usage-chip";
import { AO_P5_BUBBLE_SHADOW_FILTER } from "@/lib/template/ao-chrome";
import { AO_Z_RAW_BACKDROP, AO_Z_RAW_PANEL } from "@/lib/ao-viewport-compact";
import { aoResolveUsdForOverlay } from "@/lib/ao-home-helpers";
import { openRawHtmlInNewTab } from "@/lib/ao-raw-overlay";
import {
  RAW_POPOVER_FS_CHIP_PX,
  RAW_POPOVER_MAX_H_OUTER,
  RAW_POPOVER_MAX_H_SCROLL,
} from "@/lib/ao-raw-popover";
import type { AoChatSession } from "@/components/use-ao-chat-session";
import { AoChatUserArea } from "@/components/ao-chat-user-area";
import { AoChatViewArea } from "@/components/ao-chat-view-area";

const AO_CHAT_AI_BUBBLE_BG = AO_BUBBLE_SYSTEM_FILL;

export function AoChatModule({ session }: { session: AoChatSession }) {
  const { rawPromptOverlay, setRawPromptOverlay } = session.raw;

  return (
    <>
      <AoChatUserArea session={session} />
      <AoChatViewArea session={session} />
      {rawPromptOverlay && typeof document !== "undefined"
        ? createPortal(
            <>
              <div
                role="presentation"
                className="fixed inset-0 bg-transparent"
                style={{ zIndex: AO_Z_RAW_BACKDROP }}
                aria-hidden
                onPointerDown={() => setRawPromptOverlay(null)}
              />
              <div
                className={
                  rawPromptOverlay.panelWidthPx != null && rawPromptOverlay.panelHeightPx != null
                    ? "fixed box-border flex min-h-0 flex-col overflow-hidden"
                    : "fixed box-border w-[min(92vw,320px)] max-w-[320px]"
                }
                style={{
                  top: rawPromptOverlay.top,
                  left: rawPromptOverlay.left,
                  zIndex: AO_Z_RAW_PANEL,
                  ...(rawPromptOverlay.panelWidthPx != null && rawPromptOverlay.panelHeightPx != null
                    ? { width: rawPromptOverlay.panelWidthPx, height: rawPromptOverlay.panelHeightPx }
                    : {}),
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <AoP5NineSliceBubble
                  variant={rawPromptOverlay.variant === "user" ? "user" : "ai"}
                  frameScale={0.25}
                  fillHeight={
                    rawPromptOverlay.panelWidthPx != null && rawPromptOverlay.panelHeightPx != null
                  }
                  bgColor={rawPromptOverlay.variant === "user" ? undefined : AO_CHAT_AI_BUBBLE_BG}
                  contentPadX={6}
                  contentPadY={6}
                  className={`leading-snug text-[#1a1208] ${rawPromptOverlay.panelWidthPx != null && rawPromptOverlay.panelHeightPx != null ? "min-h-0 flex-1" : ""}`}
                  style={{
                    width: "100%",
                    maxWidth: "100%",
                    ...(rawPromptOverlay.panelWidthPx != null && rawPromptOverlay.panelHeightPx != null
                      ? { height: "100%", maxHeight: "100%", minHeight: 0 }
                      : { maxHeight: RAW_POPOVER_MAX_H_OUTER }),
                    filter: AO_P5_BUBBLE_SHADOW_FILTER,
                  }}
                >
                  <div
                    className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden"
                    style={{
                      fontSize: RAW_POPOVER_FS_CHIP_PX,
                      lineHeight: 1.35,
                      maxHeight:
                        rawPromptOverlay.panelWidthPx != null && rawPromptOverlay.panelHeightPx != null
                          ? "100%"
                          : RAW_POPOVER_MAX_H_SCROLL,
                      minHeight: 0,
                    }}
                  >
                    <AoUsageChipPanel
                      usage={rawPromptOverlay.usage}
                      completionMeta={rawPromptOverlay.completionMeta}
                      rawPrompts={rawPromptOverlay.rawPrompts}
                      attachments={rawPromptOverlay.attachments}
                      resolveUsd={aoResolveUsdForOverlay}
                      onOpenSent={
                        rawPromptOverlay.rawPrompts
                          ? () =>
                              openRawHtmlInNewTab(
                                "AO Raw — 送信全文",
                                rawPromptOverlay.rawPrompts!.sent,
                              )
                          : undefined
                      }
                      onOpenReceived={
                        rawPromptOverlay.rawPrompts
                          ? () =>
                              openRawHtmlInNewTab(
                                "AO Raw — モデル応答全文",
                                rawPromptOverlay.rawPrompts!.received,
                              )
                          : undefined
                      }
                    />
                  </div>
                </AoP5NineSliceBubble>
              </div>
            </>,
            document.body,
          )
        : null}

    </>
  );
}
