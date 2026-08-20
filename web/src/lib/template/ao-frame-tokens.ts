/**
 * AO テンプレ枠トークン（border-image プリセット）。
 * 正本: docs/version-2-layout.md §10（台帳）に沿って拡張する。
 *
 * 色の意味の SSOT は `globals.css` の `@theme`（--color-ao-surface 等）。
 *
 * Frame_AL / Frame_AS（ラボ確定）:
 * - ソースは面色を抜いた PNG。金の角・辺だけ。
 * - 重ね順（上→下）: フレーム画像 → テキスト（パディング内側） → ベージュ内枠 → 外周。
 * - ベージュは金レールの内側（rail.inner）。テキストはそこからさらに pad。
 * - 大枠 pad=10px、中枠 pad=5px。
 */

/** = `--color-ao-surface`（枠・ラベル中央塗り。システム吹き出しは別色） */
export const AO_SURFACE_FILL = "#FFFAF2";
/** = `--color-ao-bubble-user` */
export const AO_BUBBLE_USER_FILL = "#FFFFFF";
/** = `--color-ao-bubble-system` */
export const AO_BUBBLE_SYSTEM_FILL = "#F1E9D9";

/** Frame_A ソース（大枠 AL・中枠 AS 共通）。面色キーアウト済み */
export const AO_FRAME_A_SOURCE = "/template/frames/frame_A_keyout.png";

/** Frame_A の slice（ソース px）。角＋装飾＋内側塗り境界まで含む採取 */
export const AO_FRAME_A_SLICE_PX = 52;

/**
 * Frame_A border-width（描画 px）。AL=slice 100% / AS=slice 50%。
 */
export const AO_FRAME_AL_BORDER_PX = AO_FRAME_A_SLICE_PX;
export const AO_FRAME_AS_BORDER_PX = AO_FRAME_A_SLICE_PX / 2;

/**
 * frame_A.png を辺の中央でスキャンした実測（ソース px）。
 * outerPad = 外側の透明〜金開始、inner = 金の内側（塗り #FFFAF2 開始）。
 * 金レールの太さ = inner − outerPad。上下左右で異なる。
 */
export const AO_FRAME_A_RAIL = {
  top: { outerPad: 5, inner: 14 },
  right: { outerPad: 9, inner: 21 },
  bottom: { outerPad: 8, inner: 16 },
  left: { outerPad: 9, inner: 20 },
} as const;

/** 旧一値。overlay 以前の pull 用。AL/AS では使わない */
export const AO_FRAME_A_ORNAMENT_INNER_PX = 20;
export const AO_FRAME_AS_ORNAMENT_INNER_PX = AO_FRAME_A_ORNAMENT_INNER_PX / 2;

/** 緑内枠（rail.inner）からテキスト枠まで。大枠 10 / 中枠・小枠・吹き出し 5 / 名札 2（描画 px） */
export const AO_FRAME_AL_TEXT_PAD_PX = 10;
export const AO_FRAME_AS_TEXT_PAD_PX = 5;
export const AO_FRAME_C_TEXT_PAD_PX = 5;
export const AO_BUBBLE_TEXT_PAD_PX = 5;
export const AO_LABEL_TEXT_PAD_PX = 2;

/**
 * 金レール内側（塗り開始）のソース px。台帳ガイド `guide.rail` 用。
 * 表示 px = source × (draw / slice)。吹き出しの尾側は本体の内縁。
 */
export const AO_FRAME_C_RAIL_SOURCE: AoFrameInsets = {
  top: 8,
  right: 9,
  bottom: 8,
  left: 9,
};
export const AO_LABEL_RAIL_SOURCE: AoFrameInsets = {
  top: 10,
  right: 18,
  bottom: 10,
  left: 18,
};
export const AO_BUBBLE_USER_RAIL_SOURCE: AoFrameInsets = {
  top: 10,
  right: 71,
  bottom: 10,
  left: 10,
};
export const AO_BUBBLE_SYSTEM_RAIL_SOURCE: AoFrameInsets = {
  top: 9,
  right: 8,
  bottom: 9,
  left: 67,
};

export type AoFrameInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export function aoScaleSideInsets(
  source: AoFrameInsets,
  slice: AoFrameInsets,
  draw: AoFrameInsets,
): AoFrameInsets {
  const s = (src: number, sl: number, d: number) =>
    sl <= 0 ? 0 : Math.max(1, Math.round((src * d) / sl));
  return {
    top: s(source.top, slice.top, draw.top),
    right: s(source.right, slice.right, draw.right),
    bottom: s(source.bottom, slice.bottom, draw.bottom),
    left: s(source.left, slice.left, draw.left),
  };
}

/** Frame_A のベージュ内枠・テキスト枠インセット（表示スケール後の px） */
export function aoFrameAOverlayInsets(
  displayScale: number,
  textPadPx: number,
): { beige: AoFrameInsets; content: AoFrameInsets } {
  const s = (n: number) => Math.max(1, Math.round(n * displayScale));
  const beige: AoFrameInsets = {
    top: s(AO_FRAME_A_RAIL.top.inner),
    right: s(AO_FRAME_A_RAIL.right.inner),
    bottom: s(AO_FRAME_A_RAIL.bottom.inner),
    left: s(AO_FRAME_A_RAIL.left.inner),
  };
  return {
    beige,
    content: {
      top: beige.top + textPadPx,
      right: beige.right + textPadPx,
      bottom: beige.bottom + textPadPx,
      left: beige.left + textPadPx,
    },
  };
}

/** Frame_D: slice=装飾内側端(12) / border=50%描画(6)。顔グラは pull 不要 */
export const AO_FRAME_D_SLICE_PX = 12;
export const AO_FRAME_D_BORDER_PX = 6;
export const AO_FRAME_D_ORNAMENT_INNER_PX = 12;
export const AO_FRAME_D_CONTENT_PULL_PX = 0;

/**
 * 吹き出し: 尾は y≈43–91。sliceTop を尾下端以上にして
 * Bubble_A（右尾）＝右上角、Bubble_B（左尾）＝左上角に尾全体を含める。
 */
export const AO_BUBBLE_TAIL_SLICE_TOP_PX = 96;
export const AO_BUBBLE_TAIL_SIDE_PX = 72;
export const AO_BUBBLE_CORNER_PX = 28;

export type AoFramePresetId =
  | "frame_AL"
  | "frame_AS"
  | "frame_C"
  | "frame_D"
  | "bubble_user"
  | "bubble_system"
  | "label";

export type AoFramePreset = {
  id: AoFramePresetId;
  label: string;
  source: string;
  sliceTopPx: number;
  sliceRightPx: number;
  sliceBottomPx: number;
  sliceLeftPx: number;
  topWidthPx: number;
  rightWidthPx: number;
  bottomWidthPx: number;
  leftWidthPx: number;
  /** CSS 塗り。吹き出しは画像中央塗りを使うため null */
  fillColor: string | null;
  /** border-image-slice の fill（画像中央を中身に） */
  sliceFill?: boolean;
  repeat: "round" | "repeat" | "stretch" | "space";
  /** AO 採用可否 */
  adopted: boolean;
  /** 表示スケール（参考。width = slice × scale が原則） */
  scale?: number;
  /** 中身を装飾内側へ寄せる negative margin（px）。overlay 時は未使用 */
  contentPullPx?: number;
  /**
   * true: 枠を中身の上に重ね、内枠をベージュ塗り、テキストは pad 内側。
   * Frame_AL / Frame_AS 用。
   */
  overlay?: boolean;
  /** overlay 時、ベージュ内枠からテキストまでの余白（px） */
  textPadPx?: number;
};

export function aoPresetSliceInsets(preset: AoFramePreset): AoFrameInsets {
  return {
    top: preset.topWidthPx,
    right: preset.rightWidthPx,
    bottom: preset.bottomWidthPx,
    left: preset.leftWidthPx,
  };
}

export function aoPresetSourceSliceInsets(preset: AoFramePreset): AoFrameInsets {
  return {
    top: preset.sliceTopPx,
    right: preset.sliceRightPx,
    bottom: preset.sliceBottomPx,
    left: preset.sliceLeftPx,
  };
}

/** 大枠 Frame_AL = Frame_A @ 100%。枠は中身の上、内枠ベージュ、テキスト +10px */
export const AO_FRAME_AL: AoFramePreset = {
  id: "frame_AL",
  label: "大枠 Frame_AL（Frame_A 100%）",
  source: AO_FRAME_A_SOURCE,
  sliceTopPx: AO_FRAME_A_SLICE_PX,
  sliceRightPx: AO_FRAME_A_SLICE_PX,
  sliceBottomPx: AO_FRAME_A_SLICE_PX,
  sliceLeftPx: AO_FRAME_A_SLICE_PX,
  topWidthPx: AO_FRAME_AL_BORDER_PX,
  rightWidthPx: AO_FRAME_AL_BORDER_PX,
  bottomWidthPx: AO_FRAME_AL_BORDER_PX,
  leftWidthPx: AO_FRAME_AL_BORDER_PX,
  fillColor: null,
  sliceFill: false,
  repeat: "stretch",
  adopted: true,
  scale: 1,
  overlay: true,
  textPadPx: AO_FRAME_AL_TEXT_PAD_PX,
};

/** 中枠 Frame_AS = Frame_A @ 50%。枠は中身の上、内枠ベージュ、テキスト +5px */
export const AO_FRAME_AS: AoFramePreset = {
  id: "frame_AS",
  label: "中枠 Frame_AS（Frame_A 50%）",
  source: AO_FRAME_A_SOURCE,
  sliceTopPx: AO_FRAME_A_SLICE_PX,
  sliceRightPx: AO_FRAME_A_SLICE_PX,
  sliceBottomPx: AO_FRAME_A_SLICE_PX,
  sliceLeftPx: AO_FRAME_A_SLICE_PX,
  topWidthPx: AO_FRAME_AS_BORDER_PX,
  rightWidthPx: AO_FRAME_AS_BORDER_PX,
  bottomWidthPx: AO_FRAME_AS_BORDER_PX,
  leftWidthPx: AO_FRAME_AS_BORDER_PX,
  fillColor: null,
  sliceFill: false,
  repeat: "stretch",
  adopted: true,
  scale: 0.5,
  overlay: true,
  textPadPx: AO_FRAME_AS_TEXT_PAD_PX,
};

/** 小枠 Frame_C @ 50% */
export const AO_FRAME_C: AoFramePreset = {
  id: "frame_C",
  label: "小枠 Frame_C（50%）",
  source: "/template/frames/frame_C.png",
  sliceTopPx: 40,
  sliceRightPx: 40,
  sliceBottomPx: 40,
  sliceLeftPx: 40,
  topWidthPx: 20,
  rightWidthPx: 20,
  bottomWidthPx: 20,
  leftWidthPx: 20,
  fillColor: null,
  sliceFill: true,
  repeat: "stretch",
  adopted: true,
  scale: 0.5,
};

/** 顔グラ枠 Frame_D — 旧 Face_SM 外寸（border 6px） */
export const AO_FRAME_D: AoFramePreset = {
  id: "frame_D",
  label: "顔グラ枠 Frame_D",
  source: "/template/frames/frame_D.png",
  sliceTopPx: AO_FRAME_D_SLICE_PX,
  sliceRightPx: AO_FRAME_D_SLICE_PX,
  sliceBottomPx: AO_FRAME_D_SLICE_PX,
  sliceLeftPx: AO_FRAME_D_SLICE_PX,
  topWidthPx: AO_FRAME_D_BORDER_PX,
  rightWidthPx: AO_FRAME_D_BORDER_PX,
  bottomWidthPx: AO_FRAME_D_BORDER_PX,
  leftWidthPx: AO_FRAME_D_BORDER_PX,
  fillColor: null,
  sliceFill: true,
  repeat: "stretch",
  adopted: true,
  scale: 0.5,
  contentPullPx: AO_FRAME_D_CONTENT_PULL_PX,
};

/**
 * 吹き出しベンチマーク（PoC #1 成功例）。
 * - 中央・尾内側の塗りは画像側（キーアウトしない）
 * - sliceFill: true（CSS 塗りは使わない）
 * - 尾を角スライスに含める（A=右上 / B=左上、sliceTop=96）
 * - 表示スケール 50%（width = slice/2）
 * - repeat: stretch（round は横二重に見えやすい）
 */
export const AO_BUBBLE_BENCHMARK = {
  sliceTopPx: AO_BUBBLE_TAIL_SLICE_TOP_PX,
  tailSidePx: AO_BUBBLE_TAIL_SIDE_PX,
  cornerPx: AO_BUBBLE_CORNER_PX,
  scale: 0.5 as const,
  sliceFill: true as const,
  fillColor: null,
  repeat: "stretch" as const,
};

/**
 * Bubble_A（ユーザー）: 尾＝右上。ベンチマーク準拠。
 */
export const AO_BUBBLE_USER: AoFramePreset = {
  id: "bubble_user",
  label: "ユーザー吹き出し Bubble_A（50%・右尾）※ベンチマーク",
  source: "/template/bubbles/bubble_user.png",
  sliceTopPx: AO_BUBBLE_BENCHMARK.sliceTopPx,
  sliceRightPx: AO_BUBBLE_BENCHMARK.tailSidePx,
  sliceBottomPx: AO_BUBBLE_BENCHMARK.cornerPx,
  sliceLeftPx: AO_BUBBLE_BENCHMARK.cornerPx,
  topWidthPx: AO_BUBBLE_BENCHMARK.sliceTopPx * AO_BUBBLE_BENCHMARK.scale,
  rightWidthPx: AO_BUBBLE_BENCHMARK.tailSidePx * AO_BUBBLE_BENCHMARK.scale,
  bottomWidthPx: AO_BUBBLE_BENCHMARK.cornerPx * AO_BUBBLE_BENCHMARK.scale,
  leftWidthPx: AO_BUBBLE_BENCHMARK.cornerPx * AO_BUBBLE_BENCHMARK.scale,
  fillColor: null,
  sliceFill: true,
  repeat: "stretch",
  adopted: true,
  scale: 0.5,
};

/**
 * Bubble_B（システム）: 尾＝左上。ベンチマーク準拠。
 */
export const AO_BUBBLE_SYSTEM: AoFramePreset = {
  id: "bubble_system",
  label: "システム吹き出し Bubble_B（50%・左尾）※ベンチマーク",
  source: "/template/bubbles/bubble_system.png",
  sliceTopPx: AO_BUBBLE_BENCHMARK.sliceTopPx,
  sliceRightPx: AO_BUBBLE_BENCHMARK.cornerPx,
  sliceBottomPx: AO_BUBBLE_BENCHMARK.cornerPx,
  sliceLeftPx: AO_BUBBLE_BENCHMARK.tailSidePx,
  topWidthPx: AO_BUBBLE_BENCHMARK.sliceTopPx * AO_BUBBLE_BENCHMARK.scale,
  rightWidthPx: AO_BUBBLE_BENCHMARK.cornerPx * AO_BUBBLE_BENCHMARK.scale,
  bottomWidthPx: AO_BUBBLE_BENCHMARK.cornerPx * AO_BUBBLE_BENCHMARK.scale,
  leftWidthPx: AO_BUBBLE_BENCHMARK.tailSidePx * AO_BUBBLE_BENCHMARK.scale,
  fillColor: null,
  sliceFill: true,
  repeat: "stretch",
  adopted: true,
  scale: 0.5,
};

/** 名前ラベル Plate_A @ 25% — 上下 border は左右の半分（内側余白） */
export const AO_LABEL_SLICE_PX = 22;
export const AO_LABEL_SIDE_WIDTH_PX = Math.max(4, Math.round(AO_LABEL_SLICE_PX * 0.25));
/** 100% 表示で、枠の内側から文字まで上下 2px */
export const AO_LABEL_TB_WIDTH_PX = 2;

export const AO_LABEL: AoFramePreset = {
  id: "label",
  label: "名前ラベル Plate_A（25%）",
  source: "/template/labels/label.png",
  sliceTopPx: AO_LABEL_SLICE_PX,
  sliceRightPx: AO_LABEL_SLICE_PX,
  sliceBottomPx: AO_LABEL_SLICE_PX,
  sliceLeftPx: AO_LABEL_SLICE_PX,
  topWidthPx: AO_LABEL_TB_WIDTH_PX,
  rightWidthPx: AO_LABEL_SIDE_WIDTH_PX,
  bottomWidthPx: AO_LABEL_TB_WIDTH_PX,
  leftWidthPx: AO_LABEL_SIDE_WIDTH_PX,
  fillColor: null,
  sliceFill: true,
  repeat: "stretch",
  adopted: true,
  scale: 0.25,
};

/** リソースのみ（AO 非採用） */
export const AO_FRAME_B_RESERVE: AoFramePreset = {
  id: "frame_AL",
  label: "Frame_B（非採用・リソース保留）",
  source: "/template/frames/frame_B.png",
  sliceTopPx: 96,
  sliceRightPx: 96,
  sliceBottomPx: 96,
  sliceLeftPx: 96,
  topWidthPx: 48,
  rightWidthPx: 48,
  bottomWidthPx: 48,
  leftWidthPx: 48,
  fillColor: null,
  sliceFill: true,
  repeat: "stretch",
  adopted: false,
};

export const AO_FRAME_PRESETS: Record<AoFramePresetId, AoFramePreset> = {
  frame_AL: AO_FRAME_AL,
  frame_AS: AO_FRAME_AS,
  frame_C: AO_FRAME_C,
  frame_D: AO_FRAME_D,
  bubble_user: AO_BUBBLE_USER,
  bubble_system: AO_BUBBLE_SYSTEM,
  label: AO_LABEL,
};

export { AO_TEMPLATE_ASSET_VER as AO_FRAME_ASSET_VER } from "./ao-template-assets";
