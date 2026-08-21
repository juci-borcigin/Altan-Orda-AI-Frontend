"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { IcoPopupNo, IcoPopupOk } from "@/components/ao-action-icons";
import { AoMessageMarkdown } from "@/components/AoMessageMarkdown";
import { AoP5NineSliceBubble, AoTemplateFrame } from "@/components/ao-phase5";
import {
  AO_POPUP_AI_BUBBLE_BG,
  aoPopupDeleteConfirmBandHPx,
  aoPopupKorguzKinStackHPx,
} from "@/lib/ao-popup";
import { runTypewriter } from "@/lib/ao-typewriter";

const POPUP_AI_BUBBLE_FG = "#1B0D04";

const POPUP_SPEECH_FS_PX = 11;
const POPUP_SPEECH_LINE_H_PX = Math.round(POPUP_SPEECH_FS_PX * 1.35);
const POPUP_SPEECH_BLOCK_H_PX = POPUP_SPEECH_LINE_H_PX * 2 + 8;
const POPUP_ACTION_COL_W_PX = 26;
const POPUP_BUBBLE_ACTION_GAP_PX = 2;
const POPUP_KIN_BUBBLE_GAP_PX = 0;
const POPUP_INNER_PAD_PX = 2;
/** 吹き出し〜ポップアップ枠（上下）の余白（吹き出し列のみ） */
const POPUP_BUBBLE_FRAME_PAD_Y_RATIO = 0.02;
/** 吹き出し本体：下へ・コルグズ側へ（行高基準） */
const POPUP_BUBBLE_SHIFT_Y_RATIO = 0.02;
const POPUP_BUBBLE_SHIFT_X_RATIO = -0.05;

const POPUP_BUBBLE_SHADOW = "drop-shadow(4px 5px 2px rgba(0,0,0,0.18))";

const POPUP_ACTION_BTN_CLASS =
  "flex items-center justify-center rounded-sm border-0 bg-transparent p-0.5 text-[#8D5400] outline-none transition-[transform,opacity,filter] hover:brightness-110 active:scale-[0.88] active:opacity-90 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:brightness-100";

const POPUP_ACTION_ICON_PX = 18;

function aoPopupPlainForTypewriter(markdown: string): string {
  return markdown.replace(/\*\*/g, "");
}

export type AoDeleteConfirmPopupProps = {
  kinColumn: ReactNode;
  messageMarkdown: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
};

/**
 * 年代記・論議事オーバーレイ下揃えの確認ポップアップ
 * 帯の高さ＝コルグズ顔グラ＋名札（＋約10%）、吹き出し内側 #F1E9D9（ao-bubble-system）
 */
export function AoDeleteConfirmPopup({
  kinColumn,
  messageMarkdown,
  onConfirm,
  onCancel,
  confirmDisabled,
}: AoDeleteConfirmPopupProps) {
  const [typedVisible, setTypedVisible] = useState("");
  const [typingDone, setTypingDone] = useState(false);
  const typewriterAliveRef = useRef(true);

  useEffect(() => {
    typewriterAliveRef.current = true;
    setTypingDone(false);
    setTypedVisible("");
    const plain = aoPopupPlainForTypewriter(messageMarkdown);
    void (async () => {
      await runTypewriter(
        plain,
        (visible) => {
          if (!typewriterAliveRef.current) return;
          setTypedVisible(visible);
        },
        { isAlive: () => typewriterAliveRef.current },
      );
      if (!typewriterAliveRef.current) return;
      setTypingDone(true);
    })();
    return () => {
      typewriterAliveRef.current = false;
    };
  }, [messageMarkdown]);

  const kinStackH = aoPopupKorguzKinStackHPx();
  const rowH = Math.max(POPUP_SPEECH_BLOCK_H_PX, kinStackH);
  const bandH = aoPopupDeleteConfirmBandHPx(POPUP_SPEECH_BLOCK_H_PX);
  const bubbleFramePadYPx = Math.max(2, Math.round(rowH * POPUP_BUBBLE_FRAME_PAD_Y_RATIO));
  const bubbleShiftYPx = Math.max(1, Math.round(rowH * POPUP_BUBBLE_SHIFT_Y_RATIO));
  const bubbleShiftXPx = -Math.max(4, Math.round(rowH * Math.abs(POPUP_BUBBLE_SHIFT_X_RATIO)));

  const bubbleWrapStyle: CSSProperties = {
    color: POPUP_AI_BUBBLE_FG,
    fontSize: POPUP_SPEECH_FS_PX,
    filter: POPUP_BUBBLE_SHADOW,
    transform: `translate(${bubbleShiftXPx}px, ${bubbleShiftYPx}px)`,
  };

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-[55] box-border flex min-h-0 flex-col justify-end overflow-visible"
      style={{ height: bandH }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ao-delete-popup-msg"
    >
      <AoTemplateFrame
        preset="frame_AS"
        className="box-border flex h-full min-h-0 w-full flex-col overflow-visible"
        contentClassName="flex min-h-0 flex-1 flex-col overflow-visible"
      >
        <div
          className="ao-p5-parchment-surface flex h-full min-h-0 flex-col justify-end gap-0 overflow-visible"
          style={{ padding: POPUP_INNER_PAD_PX }}
        >
          <div
            className="grid w-full items-start overflow-visible"
            style={{
              gridTemplateColumns: `auto minmax(0, 1fr) ${POPUP_ACTION_COL_W_PX}px`,
              columnGap: POPUP_BUBBLE_ACTION_GAP_PX,
              minHeight: rowH,
            }}
          >
            <div className="shrink-0 overflow-visible">{kinColumn}</div>

            <div
              className="flex min-h-0 min-w-0 max-w-full flex-col items-start justify-start overflow-visible"
              style={{
                paddingTop: bubbleFramePadYPx,
                paddingBottom: bubbleFramePadYPx,
              }}
            >
              <AoP5NineSliceBubble
                variant="ai"
                frameScale={0.5}
                bgColor={AO_POPUP_AI_BUBBLE_BG}
                minHeightPx={Math.min(POPUP_SPEECH_BLOCK_H_PX, rowH)}
                contentPadX={6}
                contentPadY={4}
                className="box-border max-w-full w-full min-w-0 self-start font-serif leading-[1.35]"
                style={bubbleWrapStyle}
              >
                <div
                  id="ao-delete-popup-msg"
                  className="ao-popup-bubble-content w-full min-w-0 text-left"
                >
                  {typingDone ? (
                    <AoMessageMarkdown
                      text={messageMarkdown}
                      className="ao-chat-ai-bubble-md ao-popup-confirm-md"
                    />
                  ) : (
                    <p
                      className="m-0 w-full text-left font-serif leading-[1.35] whitespace-pre-wrap"
                      style={{ color: POPUP_AI_BUBBLE_FG, fontSize: POPUP_SPEECH_FS_PX }}
                    >
                      {typedVisible || "\u00a0"}
                    </p>
                  )}
                </div>
              </AoP5NineSliceBubble>
            </div>

            <div
              className="flex shrink-0 flex-col items-center justify-start gap-0 leading-none"
              style={{
                width: POPUP_ACTION_COL_W_PX,
                minHeight: rowH,
              }}
            >
              <button
                type="button"
                className={POPUP_ACTION_BTN_CLASS}
                aria-label="いいえ"
                onClick={onCancel}
              >
                <span className="ao-p5-kurultai-ink-icon">
                  <IcoPopupNo size={POPUP_ACTION_ICON_PX} />
                </span>
              </button>
              <button
                type="button"
                className={POPUP_ACTION_BTN_CLASS}
                aria-label="はい、削除する"
                disabled={confirmDisabled}
                onClick={onConfirm}
              >
                <span className="ao-p5-kurultai-ink-icon">
                  <IcoPopupOk size={POPUP_ACTION_ICON_PX} />
                </span>
              </button>
            </div>
          </div>
        </div>
      </AoTemplateFrame>
    </div>
  );
}
