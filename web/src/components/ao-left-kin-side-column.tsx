"use client";

import type { ReactNode, RefObject } from "react";
import { AoRubyGold } from "@/components/ao-ruby-gold";
import {
  AoP5FaceFrameMid,
  AoP5NameplateSmFrame,
  AoTemplateFrame,
  AO_MAIN_CHAT_FACE_PORTRAIT_SCALE,
  AO_PC_NOKOR_TIGHT_PAD_X_PX,
} from "@/components/ao-phase5";
import { AO_DROP_SHADOW_MAIN_FRAME } from "@/lib/template/ao-chrome";
import {
  aoKinAvatarNameColWPx,
  aoKinSidebarLordCaptionMainClass,
  CHAT_NAMEPLATE_MIN_W_PX,
  KIN_NOKOR_LINE2_CLASS,
  KIN_SIDEBAR_CAPTION_COL_GAP_PX,
  kinSidebarRonLinePadStyle,
  NOKOR_PORTRAIT_BOX_H_PX,
  NOKOR_PORTRAIT_W_PX,
} from "@/lib/ao-kin-layout";

export function AoKinAvatarStack({
  face,
  name,
  nameplateFontSizePx,
  tightPadXPx,
  captionRightTop,
  captionRightBottom,
  centerRonLine,
  maxWidthPx,
}: {
  face: ReactNode;
  name: string;
  nameplateFontSizePx: number;
  tightPadXPx?: number;
  captionRightTop?: ReactNode;
  captionRightBottom?: ReactNode;
  centerRonLine?: boolean;
  maxWidthPx?: number;
}) {
  const avatarColW = aoKinAvatarNameColWPx({ nameplateFontSizePx, tightPadXPx });
  const hasRight = captionRightTop != null || captionRightBottom != null;
  return (
    <div
      className="grid w-fit max-w-full items-start"
      style={{
        gridTemplateColumns: hasRight ? `${avatarColW}px minmax(0, max-content)` : `${avatarColW}px`,
        columnGap: hasRight ? KIN_SIDEBAR_CAPTION_COL_GAP_PX : 0,
        maxWidth: maxWidthPx,
      }}
    >
      <div
        className="box-border flex shrink-0 flex-col items-center justify-start gap-0"
        style={{ width: avatarColW, minWidth: avatarColW }}
      >
        <div className="flex w-full justify-center">{face}</div>
        <div className="flex w-full justify-center">
          <AoP5NameplateSmFrame
            width={CHAT_NAMEPLATE_MIN_W_PX}
            text={name}
            maxChars={7}
            variant="tight"
            fontSizePx={nameplateFontSizePx}
            tightPadXPx={tightPadXPx}
          />
        </div>
      </div>
      {hasRight ? (
        <div className="flex min-w-0 w-full flex-col justify-start gap-0 self-start leading-none">
          {centerRonLine ? (
            <div className="w-full text-center">{captionRightTop ?? null}</div>
          ) : (
            captionRightTop ?? null
          )}
          <div className={centerRonLine ? "w-full text-left" : undefined}>{captionRightBottom ?? null}</div>
        </div>
      ) : null}
    </div>
  );
}

type NokorDef = {
  name: string;
  captionPrefix: string;
  captionRubyBase: string;
  captionRubyRt: string;
  line2: string;
  src: string;
};

export const NOKOR: readonly NokorDef[] = [
  { name: "フナン", captionPrefix: "第一の", captionRubyBase: "千戸長", captionRubyRt: "ミンガン", line2: "為政論", src: "/personas/AO_Char_Hunan.png" },
  { name: "モンケウール", captionPrefix: "第二の", captionRubyBase: "千戸長", captionRubyRt: "ミンガン", line2: "兵馬論", src: "/personas/AO_Char_Mongkeur.png" },
  { name: "ケテ", captionPrefix: "第三の", captionRubyBase: "千戸長", captionRubyRt: "ミンガン", line2: "兵馬論", src: "/personas/AO_Char_Qete.png" },
  { name: "バイジュ", captionPrefix: "第四の", captionRubyBase: "千戸長", captionRubyRt: "ミンガン", line2: "心気論", src: "/personas/AO_Char_Baiju.png" },
  { name: "クドゥカ", captionPrefix: "オイラト", captionRubyBase: "族長", captionRubyRt: "ノヤン", line2: "巷間論", src: "/personas/AO_Char_QudukaBeki.png" },
  { name: "タタ・トゥンガ", captionPrefix: "", captionRubyBase: "師傅", captionRubyRt: "アタベク", line2: "典籍論", src: "/personas/AO_Char_TataTunga.png" },
  { name: "チン・テムール", captionPrefix: "", captionRubyBase: "政商", captionRubyRt: "オルトク", line2: "遠交論", src: "/personas/AO_Char_ChinTemur.png" },
  { name: "コルグズ", captionPrefix: "", captionRubyBase: "書記", captionRubyRt: "ビチクチ", line2: "", src: "/personas/AO_Char_Qorguz.png" },
] as const;

function aoNokorCellClasses(_active: boolean) {
  return "rounded-none box-border flex w-full flex-col transition-none bg-transparent font-serif border border-transparent";
}

function AoNokorStripArea({
  activeNames,
  nameplateFontSizePx = 8,
  mobileDrawer = false,
}: {
  activeNames: ReadonlySet<string>;
  nameplateFontSizePx?: number;
  mobileDrawer?: boolean;
  viewportCompact?: boolean;
}) {
  const drawerStrip = mobileDrawer;
  const nokorTightPadXPx = drawerStrip ? undefined : AO_PC_NOKOR_TIGHT_PAD_X_PX;
  const nokorLine2PadStyle = kinSidebarRonLinePadStyle();
  const rowPadBase = 3;
  const rowPadRight = rowPadBase + (drawerStrip ? 2 : 5);

  const rowInner = (p: (typeof NOKOR)[number], active: boolean) => (
    <div
      className={aoNokorCellClasses(active)}
      style={{
        width: drawerStrip ? "fit-content" : "100%",
        maxWidth: drawerStrip ? "100%" : undefined,
        paddingLeft: 0,
        paddingRight: 0,
      }}
    >
      <div
        className={`flex min-w-0 flex-col items-stretch transition-none ${drawerStrip ? "w-fit" : "w-full"}`}
        style={{
          paddingTop: rowPadBase,
          paddingBottom: rowPadBase,
          paddingLeft: rowPadBase,
          paddingRight: rowPadRight,
          maxWidth: drawerStrip ? "100%" : undefined,
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
          nameplateFontSizePx={nameplateFontSizePx}
          tightPadXPx={nokorTightPadXPx}
          centerRonLine
          captionRightTop={
            <div className={`min-w-0 ${KIN_NOKOR_LINE2_CLASS}`} style={nokorLine2PadStyle}>
              {p.line2 || "\u00a0"}
            </div>
          }
          captionRightBottom={
            <div className="min-w-0 text-left text-[7px] font-semibold leading-[1.15] text-[#3D1C08]">
              {p.captionPrefix ? <span>{p.captionPrefix}</span> : null}
              <ruby className="font-serif">
                {p.captionRubyBase}
                <rt className="font-serif text-[4px] text-[#6A3F0A]/80">{p.captionRubyRt}</rt>
              </ruby>
            </div>
          }
        />
      </div>
    </div>
  );

  return (
    <div
      className={`flex w-full flex-col justify-start overflow-visible pt-0 ${drawerStrip ? "min-w-0" : "min-w-0"}`}
      style={{
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
      }}
    >
      <div className="w-full min-w-0">
        <div className="flex w-full min-w-0 flex-col gap-[2px]">
          {NOKOR.map((p) => {
            const active = activeNames.has(p.name);
            return (
              <div key={p.name}>
                {rowInner(p, active)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AoLeftKinSideColumn({
  measureRef,
  activeNames,
  nameplateFontSizePx = 8,
  mobileDrawerNokorLayout = false,
  viewportCompact = false,
  v2Sidebar = false,
  settingsArea,
}: {
  measureRef?: RefObject<HTMLDivElement | null>;
  activeNames: ReadonlySet<string>;
  nameplateFontSizePx?: number;
  mobileDrawerNokorLayout?: boolean;
  viewportCompact?: boolean;
  v2Sidebar?: boolean;
  settingsArea?: ReactNode;
}) {
  const drawerKin = mobileDrawerNokorLayout;
  const lordCaptionPadStyle = kinSidebarRonLinePadStyle();
  const lordCaptionMainClass = aoKinSidebarLordCaptionMainClass(viewportCompact);
  const lordCaptionRtClass = viewportCompact
    ? "font-serif text-[7px] text-[#6A3F0A]/80"
    : "font-serif text-[9px] text-[#6A3F0A]/80";
  const kinOrnamentFrameClass = drawerKin
    ? "min-w-0 w-full overflow-visible"
    : "w-full max-w-full shrink-0 overflow-visible";

  const kinColumnInner = (
    <div className="flex max-h-max w-full min-w-0 flex-col items-stretch gap-[6px]">
          <div className="flex w-full shrink-0 min-w-0 flex-col" style={{ gap: 0 }}>
            <div className="flex h-[32px] w-full min-w-0 items-center justify-center px-1 text-[#3D1C08]" aria-hidden>
              <AoRubyGold
                main="邦　主"
                rt="ウルス・ハン"
                mainClassName="text-[14px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]"
                rtClassName="text-[9px] font-serif text-[#6A3F0A]/80"
              />
            </div>

            <div className="h-0" aria-hidden />

            <AoTemplateFrame
              preset="frame_AS"
              className={kinOrnamentFrameClass}
              contentClassName="overflow-visible"
              contentStyle={{ padding: 0 }}
            >
              <div className="flex min-h-0 w-full flex-col py-0 ao-p5-parchment-surface">
                <div
                  className={aoNokorCellClasses(false)}
                  style={{
                    width: "100%",
                    maxWidth: drawerKin ? "100%" : undefined,
                    paddingLeft: 0,
                    paddingRight: 0,
                  }}
                >
                  <div
                    className="flex w-full min-w-0 flex-col items-stretch transition-none translate-x-0 translate-y-0"
                    style={{
                      padding: 0,
                      maxWidth: drawerKin ? "100%" : undefined,
                    }}
                  >
                    <AoKinAvatarStack
                      face={
                        <AoP5FaceFrameMid
                          src="/personas/juci.png"
                          alt="ジュチ"
                          width={NOKOR_PORTRAIT_W_PX}
                          height={NOKOR_PORTRAIT_BOX_H_PX}
                          portraitScale={AO_MAIN_CHAT_FACE_PORTRAIT_SCALE}
                        />
                      }
                      name="ジュチ"
                      nameplateFontSizePx={nameplateFontSizePx}
                      tightPadXPx={mobileDrawerNokorLayout ? undefined : AO_PC_NOKOR_TIGHT_PAD_X_PX}
                      captionRightTop={
                        <div className="min-w-0 text-left" style={lordCaptionPadStyle}>
                          <ruby className={lordCaptionMainClass}>
                            邦　主
                            <rt className={lordCaptionRtClass}>ウルス・ハン</rt>
                          </ruby>
                        </div>
                      }
                    />
                  </div>
                </div>
              </div>
            </AoTemplateFrame>
          </div>

          {v2Sidebar && settingsArea ? (
            <div className="flex w-full min-w-0 flex-col" style={{ gap: 0 }}>
              <AoTemplateFrame
                preset="frame_AS"
                className={kinOrnamentFrameClass}
                contentClassName="overflow-visible"
                contentStyle={{ padding: 0 }}
              >
                <div className="ao-p5-parchment-surface w-full">{settingsArea}</div>
              </AoTemplateFrame>
            </div>
          ) : null}

          <div className="flex w-full min-w-0 flex-col" style={{ gap: 0 }}>
            <div className="flex h-[32px] w-full min-w-0 items-center justify-center px-1 text-[#3D1C08]" aria-hidden>
              <AoRubyGold
                main="僚　友"
                rt="ノ　コ　ル"
                mainClassName="text-[14px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]"
                rtClassName="text-[9px] font-serif text-[#6A3F0A]/80"
              />
            </div>

            <div className="h-0" aria-hidden />

            <AoTemplateFrame
              preset="frame_AS"
              className={kinOrnamentFrameClass}
              contentClassName="overflow-visible"
              contentStyle={{ padding: 0 }}
            >
              <div className="ao-p5-parchment-surface w-full">
                <AoNokorStripArea
                  activeNames={activeNames}
                  nameplateFontSizePx={nameplateFontSizePx}
                  mobileDrawer={mobileDrawerNokorLayout}
                  viewportCompact={viewportCompact}
                />
              </div>
            </AoTemplateFrame>
          </div>
        </div>
  );

  return (
    <div ref={measureRef} className="min-w-0 w-full max-w-full self-start">
      {drawerKin ? (
        <AoTemplateFrame
          preset="frame_AL"
          className="relative flex max-h-max min-h-0 w-full max-w-full min-w-0 flex-col"
          style={{ boxSizing: "border-box", boxShadow: AO_DROP_SHADOW_MAIN_FRAME }}
          contentClassName="flex max-h-max min-w-0 w-full flex-col items-stretch"
        >
          {kinColumnInner}
        </AoTemplateFrame>
      ) : (
        <AoTemplateFrame
          preset="frame_AL"
          className="relative flex max-h-max min-h-0 w-full max-w-full shrink-0 flex-col"
          style={{
            boxSizing: "border-box",
            boxShadow: AO_DROP_SHADOW_MAIN_FRAME,
          }}
          contentClassName="flex max-h-max min-w-0 w-full flex-col items-stretch"
        >
          {kinColumnInner}
        </AoTemplateFrame>
      )}
    </div>
  );
}
