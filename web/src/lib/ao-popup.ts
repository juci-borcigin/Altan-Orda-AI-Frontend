import { AO_PORTRAIT_LAYOUT_W_PX } from "@/lib/ao-portrait";
import {
  AO_MAIN_CHAT_FACE_PORTRAIT_SCALE,
  AO_PC_NOKOR_TIGHT_PAD_X_PX,
  aoP5FaceFrameMidOuterSizePx,
  aoP5NameplateSmOuterWidthPx,
} from "@/components/ao-phase5";
import {
  AO_FRAME_A_SLICE_PX,
  AO_FRAME_AS_BORDER_PX,
  AO_FRAME_AS_TEXT_PAD_PX,
  aoFrameAOverlayInsets,
} from "@/lib/template/ao-frame-tokens";

/** 削除確認ポップアップ：吹き出し内側（AI 9-slice 既定色） */
/** = `--color-ao-bubble-system` */
export const AO_POPUP_AI_BUBBLE_BG = "#F1E9D9";

/** ao_popup.template_text のプレースホルダ */
export type AoPopupVars = {
  論?: string;
  議題?: string;
};

const PLACEHOLDER_RE = /\{\{([^\}]+)\}\}/g;

function aoPopupVarForKey(key: string, vars: AoPopupVars): string {
  const k = key.trim();
  if (k === "論") return vars.論 ?? "";
  if (k === "議題" || k === "議事") return vars.議題 ?? "";
  return "";
}

/** Markdown 内で * が壊れないようエスケープ */
function escapeAoPopupMarkdownBold(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\*/g, "\\*");
}

export function substituteAoPopupTemplate(template: string, vars: AoPopupVars): string {
  return template.replace(PLACEHOLDER_RE, (_m, key: string) => aoPopupVarForKey(key, vars));
}

/** 置換値を **太字** にした Markdown 本文（吹き出し用） */
export function substituteAoPopupTemplateMarkdown(template: string, vars: AoPopupVars): string {
  return template.replace(PLACEHOLDER_RE, (_m, key: string) => {
    const val = aoPopupVarForKey(key, vars);
    if (!val) return "";
    return `**${escapeAoPopupMarkdownBold(val)}**`;
  });
}

/** 単一改行を GFM の改行（行末2スペース）にそろえる */
export function aoPopupMarkdownForBubble(text: string): string {
  return text.replace(/\n(?!\n)/g, "  \n");
}

/** 吹き出し2行表示用（DB の改行優先、なければ最初の 。で分割） */
export function aoPopupTextToTwoLines(text: string): [string, string] {
  const t = text.trim();
  const nl = t.indexOf("\n");
  if (nl >= 0) {
    const a = t.slice(0, nl).trim();
    const b = t.slice(nl + 1).trim();
    return [a || t, b || ""];
  }
  const m = t.match(/^(.+?[。！？])\s*([\s\S]+)$/);
  if (m) return [m[1]!.trim(), m[2]!.trim()];
  if (t.length <= 28) return [t, ""];
  const mid = Math.ceil(t.length / 2);
  return [t.slice(0, mid).trim(), t.slice(mid).trim()];
}

export const AO_POPUP_DELETE_LOG_FALLBACK =
  "{{論}}の議事{{議題}}を捨てます。\nよろしいですか、殿下？";

/** 左サイドコルグズと同じ【顔グラ＋名札】の内容高さ（px） */
export function aoPopupKorguzKinStackHPx(): number {
  const portraitW = AO_PORTRAIT_LAYOUT_W_PX;
  const portraitBoxH = Math.ceil((portraitW * 5) / 4);
  const { outerW, outerH: faceOuterH } = aoP5FaceFrameMidOuterSizePx(
    portraitW,
    portraitBoxH,
    AO_MAIN_CHAT_FACE_PORTRAIT_SCALE,
  );
  const plateW = aoP5NameplateSmOuterWidthPx({
    text: "コルグズ",
    minWidthPx: outerW,
    maxChars: 7,
    fontSizePx: 8,
    variant: "tight",
    tightPadXPx: AO_PC_NOKOR_TIGHT_PAD_X_PX,
  });
  const scale = (plateW / 60) * 0.5;
  const geomScale = scale * 0.55;
  const fontSize = Math.max(7, 8 - 3);
  const tbH = Math.max(3, Math.round(5 * geomScale));
  const innerH = Math.max(fontSize + 2, Math.round(5 * geomScale * 3));
  const plateH = tbH * 2 + innerH;
  /** page.tsx ポップアップ用 kin ラッパー paddingTop */
  const kinWrapperPadTopPx = 3;
  return faceOuterH + plateH + kinWrapperPadTopPx;
}

/** 帯高さの最終倍率（顔グラ列算出はそのまま、枠込みの外寸だけ抑える） */
export const AO_POPUP_BAND_HEIGHT_FACTOR = 0.8;

/** ポップアップ帯の外寸高さ（行＝顔グラ列基準＋ frame_AS 上下 inset＋10% のあと AO_POPUP_BAND_HEIGHT_FACTOR） */
export function aoPopupDeleteConfirmBandHPx(speechBlockHPx: number): number {
  const kinH = aoPopupKorguzKinStackHPx();
  const rowH = Math.max(speechBlockHPx, kinH);
  const innerPadPx = 4;
  const displayScale = AO_FRAME_AS_BORDER_PX / AO_FRAME_A_SLICE_PX;
  const { content } = aoFrameAOverlayInsets(displayScale, AO_FRAME_AS_TEXT_PAD_PX);
  const frameChromePx = content.top + content.bottom;
  const raw = (rowH + innerPadPx + frameChromePx) * 1.1;
  return Math.max(
    Math.round(raw * AO_POPUP_BAND_HEIGHT_FACTOR),
    rowH + innerPadPx,
  );
}
