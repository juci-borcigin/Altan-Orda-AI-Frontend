/**
 * テンプレ静的資産パスの SSOT。
 * 画像は `web/public/template/` のみ。`public/phase5/` は置かない。
 * 色・字の正本は `globals.css` の `@theme`。枠幾何は `ao-frame-tokens.ts`。
 */

export const AO_TEMPLATE_ASSET_VER = "20260819a";

export function aoTemplateAssetUrl(path: string): string {
  return `${path}?v=${AO_TEMPLATE_ASSET_VER}`;
}

export const AO_TEMPLATE_BG_MAP = "/template/bg/map-bg1.png";
export const AO_TEMPLATE_BG_MAP_MOBILE = "/template/bg/map-bg-mobile.png";

export const AO_TEMPLATE_LOGO_PC = "/template/logo/logo-pc.png";
export const AO_TEMPLATE_LOGO_16PRO = "/template/logo/logo-16pro.png";
export const AO_TEMPLATE_LOGO_SE1 = "/template/logo/logo-se1.png";

/** ヘッダ下タイル／旧 ornamental 中枠（論一覧など未移行箇所） */
export const AO_TEMPLATE_ORNAMENT_BAR = "/template/frames/ornament/bar.png";
export const AO_TEMPLATE_ORNAMENT_SIDE = "/template/frames/ornament/side.png";
export const AO_TEMPLATE_ORNAMENT_CORNER = "/template/frames/ornament/corner.png";

/** 本番チャット吹き出し（九分割タイル）。マスター1枚は `ao-frame-tokens` の bubble_* */
export const AO_TEMPLATE_BUBBLE_NINE_SLICE = {
  user: {
    lt: "/template/bubbles/nine-slice/bubble_user_left_top.png",
    lm: "/template/bubbles/nine-slice/bubble_user_left_mid.png",
    lb: "/template/bubbles/nine-slice/bubble_user_left_btm.png",
    rt: "/template/bubbles/nine-slice/bubble_user_right_top.png",
    rm: "/template/bubbles/nine-slice/bubble_user_right_mid.png",
    rb: "/template/bubbles/nine-slice/bubble_user_right_btm.png",
    tm: "/template/bubbles/nine-slice/bubble_user_top_mid.png",
    bm: "/template/bubbles/nine-slice/bubble_user_btm_mid.png",
  },
  system: {
    lt: "/template/bubbles/nine-slice/bubble_ai_left_top.png",
    lm: "/template/bubbles/nine-slice/bubble_ai_left_mid.png",
    lb: "/template/bubbles/nine-slice/bubble_ai_left_btm.png",
    rt: "/template/bubbles/nine-slice/bubble_ai_right_top.png",
    rm: "/template/bubbles/nine-slice/bubble_ai_right_mid.png",
    rb: "/template/bubbles/nine-slice/bubble_ai_right_btm.png",
    tm: "/template/bubbles/nine-slice/bubble_ai_top_mid.png",
    bm: "/template/bubbles/nine-slice/bubble_ai_btm_mid.png",
  },
} as const;
