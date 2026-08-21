"use client";

import { type RefObject } from "react";
import { AO_TOPICS, type TopicUiId } from "@/lib/ao-topics";
import { AoTemplateFrame } from "@/components/ao-phase5";
import { AoRubyGold } from "@/components/ao-ruby-gold";

export type AoProjectTabsPanelProps = {
  measureRef?: RefObject<HTMLDivElement | null>;
  kuriltaiLabelMeterRef?: RefObject<HTMLDivElement | null>;
  selectedTopic: TopicUiId | null;
  onTabClick: (topicId: TopicUiId) => void;
  viewportCompact: boolean;
  topicFontSizePx: number;
  /** メイン内の狭列幅。「大会盟」相当。未指定時も全幅にせず既定狭幅 */
  columnWidthPx?: number | null;
};

/** プロジェクト（論）タブ縦列 */
export function AoProjectTabsPanel({
  measureRef,
  kuriltaiLabelMeterRef,
  selectedTopic,
  onTabClick,
  viewportCompact,
  topicFontSizePx,
  columnWidthPx,
}: AoProjectTabsPanelProps) {
  const fallbackW = viewportCompact ? 62 : 72;
  const widthPx =
    typeof columnWidthPx === "number" && Number.isFinite(columnWidthPx) && columnWidthPx > 0
      ? columnWidthPx
      : fallbackW;
  return (
    <div
      ref={measureRef}
      className="isolate flex h-full shrink-0 grow-0 basis-auto flex-col self-stretch overflow-visible"
      style={{
        width: widthPx,
        minWidth: widthPx,
        maxWidth: widthPx,
      }}
    >
      <AoTemplateFrame
        preset="frame_AS"
        className="h-full max-h-full w-full shrink-0 overflow-hidden align-top"
        contentClassName="flex h-full min-h-0 w-full shrink-0 flex-col justify-start gap-0 overflow-y-auto overflow-x-hidden"
        contentStyle={{ padding: 0 }}
      >
        <div className="ao-p5-parchment-surface flex w-full flex-col justify-start divide-y divide-solid divide-[#3D1C08]/[0.14] px-0 py-0">
          {AO_TOPICS.map((tp) => {
            const on = selectedTopic === tp.id;
            const isKuriltai = tp.id === AO_TOPICS[0].id;
            const pressed = on
              ? "translate-x-px translate-y-px shadow-[inset_0_2px_8px_rgba(0,0,0,0.18)]"
              : "hover:bg-black/5";
            if (isKuriltai) {
              return (
                <button
                  key={tp.id}
                  type="button"
                  onClick={() => onTabClick(tp.id)}
                  aria-pressed={on}
                  className={`flex ${viewportCompact ? "min-h-[26px]" : "min-h-[30px]"} w-full items-center justify-center rounded-none border-0 bg-transparent py-0 text-[#3D1C08] transition-none ${viewportCompact ? "px-0" : "px-0.5"} ${pressed}`}
                >
                  <div
                    ref={kuriltaiLabelMeterRef}
                    className="inline-flex max-w-none shrink-0 whitespace-nowrap"
                  >
                    <AoRubyGold
                      main="大 会 盟"
                      rt="クリルタイ"
                      mainClassName={
                        viewportCompact
                          ? "text-[11px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]"
                          : "text-[14px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]"
                      }
                      rtClassName={
                        viewportCompact
                          ? "text-[7px] font-serif text-[#6A3F0A]/80"
                          : "text-[9px] font-serif text-[#6A3F0A]/80"
                      }
                    />
                  </div>
                </button>
              );
            }
            return (
              <button
                key={tp.id}
                type="button"
                onClick={() => onTabClick(tp.id)}
                aria-pressed={on}
                className={`min-h-0 w-full whitespace-nowrap rounded-none border-0 bg-transparent py-[2px] text-center font-semibold leading-[1.2] text-[#3D1C08] transition-none ${viewportCompact ? "px-0" : "px-1"} ${pressed}`}
                style={{ fontSize: topicFontSizePx }}
              >
                {tp.label}
              </button>
            );
          })}
        </div>
      </AoTemplateFrame>
    </div>
  );
}
