import type { CSSProperties } from "react";
import { AO_PORTRAIT_LAYOUT_W_PX } from "@/lib/ao-portrait";
import {
  AO_MAIN_CHAT_FACE_PORTRAIT_SCALE,
  aoP5FaceFrameMidOuterSizePx,
  aoP5NameplateSmOuterWidthPx,
  aoP5NameplateSmTightPlateOuterWidthPx,
} from "@/components/ao-phase5";

export const NOKOR_PORTRAIT_W_PX = AO_PORTRAIT_LAYOUT_W_PX;
export const NOKOR_PORTRAIT_BOX_H_PX = Math.ceil((NOKOR_PORTRAIT_W_PX * 5) / 4);

const { outerW: CHAT_FACE_STACK_W_PX } = aoP5FaceFrameMidOuterSizePx(
  NOKOR_PORTRAIT_W_PX,
  NOKOR_PORTRAIT_BOX_H_PX,
  AO_MAIN_CHAT_FACE_PORTRAIT_SCALE,
);
export const CHAT_NAMEPLATE_MIN_W_PX = CHAT_FACE_STACK_W_PX;

export const MAIN_CHAT_NAMEPLATE_OPTS = {
  maxChars: 7 as const,
  fontSizePx: 7,
  variant: "tight" as const,
};

export function aoMainChatNameplateOuterWidthPx(text: string): number {
  return aoP5NameplateSmOuterWidthPx({
    text,
    minWidthPx: CHAT_NAMEPLATE_MIN_W_PX,
    ...MAIN_CHAT_NAMEPLATE_OPTS,
  });
}

export function aoKinAvatarNameColWPx(opts: {
  nameplateFontSizePx: number;
  tightPadXPx?: number;
}): number {
  return Math.max(
    CHAT_FACE_STACK_W_PX,
    aoP5NameplateSmTightPlateOuterWidthPx({
      bandWidthPx: CHAT_NAMEPLATE_MIN_W_PX,
      nameplateFontSizePx: opts.nameplateFontSizePx,
      layoutCharCount: 7,
      tightPadXPx: opts.tightPadXPx,
    }),
  );
}

export const MAIN_JUCHI_AVATAR_COL_MIN_W_PX = 58;
export const MAIN_JUCHI_AVATAR_COL_W_PX = Math.max(
  aoMainChatNameplateOuterWidthPx("ジュチ"),
  MAIN_JUCHI_AVATAR_COL_MIN_W_PX,
);

export const KIN_SIDEBAR_CAPTION_COL_GAP_PX = 4;

export const MAIN_COLUMN_PAD_PX = 5;
export const MAIN_COLUMN_GUTTER_X_PX = 0;
export const MAIN_MIDDLE_SECTION_PAD_X_PX = 12;
export const MAIN_BUBBLE_ROW_GAP_PX = 10;
export const AO_AVATAR_BUBBLE_GAP_TIGHT_PX = Math.round(MAIN_BUBBLE_ROW_GAP_PX / 2);
export const MAIN_COMPOSE_AVATAR_GAP_PX = Math.max(2, Math.round(AO_AVATAR_BUBBLE_GAP_TIGHT_PX / 2));
export const CHAT_AREA_PAD_X_PX = MAIN_COLUMN_GUTTER_X_PX + MAIN_MIDDLE_SECTION_PAD_X_PX;
export const CHAT_AREA_PAD_RIGHT_PX = CHAT_AREA_PAD_X_PX;

export function mainComposeRowGridStyle(avatarColWPx: number = MAIN_JUCHI_AVATAR_COL_W_PX): CSSProperties {
  return {
    display: "grid",
    width: "100%",
    minWidth: 0,
    alignItems: "start",
    gridTemplateColumns: `minmax(0, 1fr) ${avatarColWPx}px`,
    columnGap: MAIN_COMPOSE_AVATAR_GAP_PX,
  };
}

export const MAIN_JUCHI_RUBY_MAIN_CLASS =
  "text-[10px] font-semibold font-serif text-[#3D1C08]";
export const KIN_NOKOR_LINE2_CLASS = MAIN_JUCHI_RUBY_MAIN_CLASS;

export function aoKinSidebarLordCaptionMainClass(viewportCompact: boolean): string {
  return viewportCompact
    ? "text-[10px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]"
    : "text-[14px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]";
}

const KIN_SIDEBAR_RON_LINE_PAD_TOP_BEFORE_PX = 4;
const KIN_SIDEBAR_RON_LINE_PAD_TOP_PX = Math.round(KIN_SIDEBAR_RON_LINE_PAD_TOP_BEFORE_PX * 1.5);
export function kinSidebarRonLinePadStyle(): CSSProperties {
  return { paddingTop: KIN_SIDEBAR_RON_LINE_PAD_TOP_PX, lineHeight: 1.15 };
}

export const REISHI_CHRONICLE_BTN_MIN_H_PX = Math.round(52 * 0.66);
export const JUCHI_SEND_BTN_MIN_H_PX = Math.round(52 * 0.33);

export const AO_RON_TAB_FONT_PX = 14;
export const AO_GIJI_TITLE_FONT_PX = AO_RON_TAB_FONT_PX - 1;
export const AO_RON_TAB_PAD_X_PX = 7;
export const AO_RON_TAB_PAD_Y_PX = 4;
export const AO_RON_TAB_PAD_X_OVERLAY_PX = Math.max(0, Math.round(AO_RON_TAB_PAD_X_PX * 0.5));
export const AO_RON_TAB_PAD_Y_OVERLAY_PX = Math.max(0, Math.round(AO_RON_TAB_PAD_Y_PX * 0.5));

export const AO_PC_HEADER_FRAME_BELOW_H_PX = 58 + 14;
export const AO_PC_ZOOM_COMP_SCALE = 1.2;

export function aoMainRonTabTopicFontPx(viewportCompact: boolean): number {
  return viewportCompact ? 10 : Math.round(12 * AO_PC_ZOOM_COMP_SCALE);
}

export const MAIN_COLUMN_STACK_GAP_PX = 0;
export const MAIN_INNER_TOP_PAD_PX = Math.round(MAIN_COLUMN_PAD_PX * 0.3);
export const MAIN_OUTER_TOP_GAP_PX = Math.round(3 * 0.3);

export const CHAT_HISTORY_BUBBLE_MIN_H_PX = Math.ceil(13 * 1.42) + 8;
export const GIJI_CHIP_ORNAMENT_INSET_PX = 5;
export const GIJI_CHIP_ORNAMENT_CONTENT_PAD = "2px 6px";
export const GIJI_TITLE_PARCHMENT_PAD_Y_PX = 4;
export const GIJI_TITLE_CHIP_COMPACT_ORNAMENT_CONTENT_PAD = "2px 0";
export const GIJI_TITLE_CHIP_COMPACT_PARCHMENT_PAD_Y_PX = 2;

const AO_TAILWIND_GAP_05_PX = 2;
export const JUCHI_PORTRAIT_BOX_H_PX = NOKOR_PORTRAIT_BOX_H_PX;
export const JUCHI_PORTRAIT_RAISE_ABOVE_BUBBLE_PX = 15;
const JUCHI_LINE_NAME_H_PX = Math.ceil(10 * 1.25);
const JUCHI_LINE_RUBY_CAPTION_H_PX = 24;
const JUCHI_SEND_ROW_H_PX = AO_TAILWIND_GAP_05_PX + JUCHI_SEND_BTN_MIN_H_PX;
const JUCHI_COL_GAP_SUM_PX = AO_TAILWIND_GAP_05_PX * 3;
export const JUCHI_COLUMN_CONTENT_H_PX =
  NOKOR_PORTRAIT_BOX_H_PX +
  JUCHI_LINE_NAME_H_PX +
  JUCHI_LINE_RUBY_CAPTION_H_PX +
  JUCHI_SEND_ROW_H_PX +
  JUCHI_COL_GAP_SUM_PX;
export const MAIN_SPEECH_BUBBLE_H_PX = JUCHI_COLUMN_CONTENT_H_PX;
const MAIN_COMPOSE_BUBBLE_PAD_Y_TOTAL_PX = 12;
export function mainComposeTextareaMinHPx(bubbleMinHPx: number): number {
  return Math.max(18, bubbleMinHPx - MAIN_COMPOSE_BUBBLE_PAD_Y_TOTAL_PX);
}

export const COMPACT_COMPOSE_VISUAL_FS = 12;
export const COMPACT_COMPOSE_INPUT_FS = 16;
export const COMPACT_COMPOSE_INPUT_VISUAL_SCALE = COMPACT_COMPOSE_VISUAL_FS / COMPACT_COMPOSE_INPUT_FS;

export const MAIN_TOP_FIXED_H_PX = 360;
export const MAIN_TOP_FIXED_H_COMPACT_PX = Math.round(MAIN_TOP_FIXED_H_PX * 0.68);

export const GIJI_MID_BLOCK_PAD_BOTTOM_PX = 0;
export const GIJI_TITLE_PAD_TOP_PX = Math.max(0, Math.round(Math.round(8 * 0.5) * 0.7) - 2);
export const GIJI_TITLE_GAP_AFTER_PX = Math.max(0, Math.round(Math.round(4 * 0.5) * 0.7) - 2);
export const RON_AREA_PAD_TOP_PX = Math.max(0, Math.round(12 * 0.3) - 1);

export const AO_PUSH_INSET_RON_TAB_KURULTAI =
  "shadow-[inset_0_2px_4px_rgba(0,0,0,0.42),inset_0_1px_2px_rgba(0,0,0,0.32)]";
export const AO_PUSH_INSET_RON_TAB_OTHER =
  "shadow-[inset_0_3px_6px_rgba(0,0,0,0.52),inset_0_1px_3px_rgba(0,0,0,0.38)]";
