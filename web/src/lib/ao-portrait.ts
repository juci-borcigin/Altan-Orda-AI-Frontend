/**
 * 顔グラのレイアウト計算・next/image `sizes` 用の参照幅（CSS px 相当）。
 * 実際の描画幅は `globals.css` の `--ao-portrait-w`（rem）と同期すること。
 * rem にすることでページ zoom（⌘±）やルートフォントとの整合を取りやすくする。
 */
export const AO_PORTRAIT_LAYOUT_W_PX = Math.round(52 * 0.75);
