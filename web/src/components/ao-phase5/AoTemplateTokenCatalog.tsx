"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  AO_BUBBLE_SYSTEM_RAIL_SOURCE,
  AO_BUBBLE_TEXT_PAD_PX,
  AO_BUBBLE_USER_RAIL_SOURCE,
  AO_FRAME_A_RAIL,
  AO_FRAME_A_SLICE_PX,
  AO_FRAME_AL_BORDER_PX,
  AO_FRAME_AL_TEXT_PAD_PX,
  AO_FRAME_AS_BORDER_PX,
  AO_FRAME_AS_TEXT_PAD_PX,
  AO_FRAME_ASSET_VER,
  AO_FRAME_C_RAIL_SOURCE,
  AO_FRAME_C_TEXT_PAD_PX,
  AO_FRAME_D_BORDER_PX,
  AO_FRAME_PRESETS,
  AO_LABEL_RAIL_SOURCE,
  AO_LABEL_SIDE_WIDTH_PX,
  AO_LABEL_SLICE_PX,
  AO_LABEL_TB_WIDTH_PX,
  AO_LABEL_TEXT_PAD_PX,
  aoPresetSliceInsets,
  aoPresetSourceSliceInsets,
  aoScaleSideInsets,
  type AoFrameInsets,
  type AoFramePreset,
  type AoFramePresetId,
} from "@/lib/template/ao-frame-tokens";
import { AoTemplateFrame } from "./AoTemplateFrame";
import { AoP5FaceFrameMid } from "./AoP5FaceFrameMid";
import { AoP5NameplateSmFrame } from "./AoP5NameplateSmFrame";

/**
 * 視覚 SSOT（表示専用）。数値の正本は ao-frame-tokens.ts。
 * 構成は W3C Design Tokens（primitive）+ CSS border-image / 9-slice 解剖に準拠。
 */

const GUIDE = {
  outer: "#c026d3",
  slice: "#b45309",
  rail: "#15803d",
  text: "#1d4ed8",
} as const;

const CHECKER: CSSProperties = {
  backgroundColor: "#e7e5e4",
  backgroundImage:
    "linear-gradient(45deg, #d6d3d1 25%, transparent 25%), linear-gradient(-45deg, #d6d3d1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d6d3d1 75%), linear-gradient(-45deg, transparent 75%, #d6d3d1 75%)",
  backgroundSize: "8px 8px",
  backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
};

const WALL =
  "いろはにほへとちりぬるをわかよたれそつねならむうゐのおくやまけふこえてあさきゆめみしゑひもせすん".repeat(8);

const PRIMITIVE_IDS: AoFramePresetId[] = [
  "frame_AL",
  "frame_C",
  "frame_D",
  "bubble_user",
  "bubble_system",
  "label",
];

function px(n: number) {
  return `${n}px`;
}

function src(path: string) {
  return `${path}?v=${AO_FRAME_ASSET_VER}`;
}

function SliceTile({
  source,
  width,
  height,
  position,
  caption,
}: {
  source: string;
  width: number;
  height: number;
  position: string;
  caption: string;
}) {
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="font-mono text-[10px] leading-snug text-[#6a3f0a]">{caption}</figcaption>
      <div
        className="relative box-border shrink-0"
        style={{
          ...CHECKER,
          width: px(width),
          height: px(height),
          border: `1px dashed ${GUIDE.slice}`,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('${src(source)}')`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: position,
            backgroundSize: "auto",
          }}
        />
      </div>
    </figure>
  );
}

function NineSliceAtoms({ preset }: { preset: AoFramePreset }) {
  const st = preset.sliceTopPx;
  const sr = preset.sliceRightPx;
  const sb = preset.sliceBottomPx;
  const sl = preset.sliceLeftPx;
  const edgeW = Math.min(96, Math.max(40, sl + sr));
  return (
    <section className="space-y-3 rounded border border-[#c9922a]/35 bg-[#fffaf2] p-3">
      <header className="space-y-0.5">
        <h3 className="text-[13px] font-bold">{preset.label}</h3>
        {preset.id === "frame_AL" ? (
          <p className="text-[10px] text-[#6a3f0a]">中枠 Frame_AS は同一ソースを 50% で描画。</p>
        ) : null}
        <p className="font-mono text-[10px] text-[#6a3f0a]">
          source {preset.source} · slice T{st} R{sr} B{sb} L{sl} · draw T{preset.topWidthPx} R
          {preset.rightWidthPx} B{preset.bottomWidthPx} L{preset.leftWidthPx}
          {preset.scale != null ? ` · scale ${preset.scale}` : ""}
          {preset.overlay ? ` · overlay pad ${preset.textPadPx}px` : ""}
        </p>
      </header>
      <div className="flex flex-wrap gap-4">
        <SliceTile
          source={preset.source}
          width={sl}
          height={st}
          position="left top"
          caption={`Corner TL ${sl}×${st}px`}
        />
        <SliceTile
          source={preset.source}
          width={sr}
          height={st}
          position="right top"
          caption={`Corner TR ${sr}×${st}px`}
        />
        <SliceTile
          source={preset.source}
          width={sl}
          height={sb}
          position="left bottom"
          caption={`Corner BL ${sl}×${sb}px`}
        />
        <SliceTile
          source={preset.source}
          width={sr}
          height={sb}
          position="right bottom"
          caption={`Corner BR ${sr}×${sb}px`}
        />
        <SliceTile
          source={preset.source}
          width={edgeW}
          height={st}
          position="center top"
          caption={`Edge Top ${edgeW}×${st}px`}
        />
        <SliceTile
          source={preset.source}
          width={sr}
          height={Math.min(80, st + sb)}
          position="right center"
          caption={`Edge Right ${sr}×${Math.min(80, st + sb)}px`}
        />
        <SliceTile
          source={preset.source}
          width={edgeW}
          height={sb}
          position="center bottom"
          caption={`Edge Bottom ${edgeW}×${sb}px`}
        />
        <SliceTile
          source={preset.source}
          width={sl}
          height={Math.min(80, st + sb)}
          position="left center"
          caption={`Edge Left ${sl}×${Math.min(80, st + sb)}px`}
        />
      </div>
    </section>
  );
}

function SliceBoxGuides({
  size,
  sizeTop,
  sizeRight,
  sizeBottom,
  sizeLeft,
}: {
  size?: number;
  sizeTop?: number;
  sizeRight?: number;
  sizeBottom?: number;
  sizeLeft?: number;
}) {
  const t = sizeTop ?? size ?? 0;
  const r = sizeRight ?? size ?? 0;
  const b = sizeBottom ?? size ?? 0;
  const l = sizeLeft ?? size ?? 0;
  const dash = (color: string): CSSProperties => ({
    position: "absolute",
    boxSizing: "border-box",
    border: `1px dashed ${color}`,
    pointerEvents: "none",
  });
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div style={{ ...dash(GUIDE.outer), inset: 0, borderStyle: "solid" }} />
      <div style={{ ...dash(GUIDE.slice), top: 0, left: 0, width: px(l), height: px(t) }} />
      <div style={{ ...dash(GUIDE.slice), top: 0, right: 0, width: px(r), height: px(t) }} />
      <div style={{ ...dash(GUIDE.slice), bottom: 0, left: 0, width: px(l), height: px(b) }} />
      <div style={{ ...dash(GUIDE.slice), bottom: 0, right: 0, width: px(r), height: px(b) }} />
    </div>
  );
}

function RecipeGuides({
  slice,
  rail,
  textPadPx,
}: {
  slice: AoFrameInsets;
  rail: AoFrameInsets;
  textPadPx: number;
}) {
  const dash = (color: string): CSSProperties => ({
    position: "absolute",
    boxSizing: "border-box",
    border: `1px dashed ${color}`,
    pointerEvents: "none",
  });
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div style={{ ...dash(GUIDE.outer), inset: 0, borderStyle: "solid" }} />
      <div style={{ ...dash(GUIDE.slice), top: 0, left: 0, width: px(slice.left), height: px(slice.top) }} />
      <div style={{ ...dash(GUIDE.slice), top: 0, right: 0, width: px(slice.right), height: px(slice.top) }} />
      <div style={{ ...dash(GUIDE.slice), bottom: 0, left: 0, width: px(slice.left), height: px(slice.bottom) }} />
      <div style={{ ...dash(GUIDE.slice), bottom: 0, right: 0, width: px(slice.right), height: px(slice.bottom) }} />
      <div
        style={{
          ...dash(GUIDE.rail),
          top: rail.top,
          right: rail.right,
          bottom: rail.bottom,
          left: rail.left,
        }}
      />
      <div
        style={{
          ...dash(GUIDE.text),
          top: rail.top + textPadPx,
          right: rail.right + textPadPx,
          bottom: rail.bottom + textPadPx,
          left: rail.left + textPadPx,
        }}
      />
    </div>
  );
}

function recipeRailInsets(id: "frame_C" | "bubble_user" | "bubble_system" | "label"): AoFrameInsets {
  const preset = AO_FRAME_PRESETS[id];
  const source =
    id === "frame_C"
      ? AO_FRAME_C_RAIL_SOURCE
      : id === "label"
        ? AO_LABEL_RAIL_SOURCE
        : id === "bubble_user"
          ? AO_BUBBLE_USER_RAIL_SOURCE
          : AO_BUBBLE_SYSTEM_RAIL_SOURCE;
  return aoScaleSideInsets(source, aoPresetSourceSliceInsets(preset), aoPresetSliceInsets(preset));
}

function presetRecipeGuides(id: "frame_C" | "bubble_user" | "bubble_system" | "label", textPadPx: number) {
  return (
    <RecipeGuides
      slice={aoPresetSliceInsets(AO_FRAME_PRESETS[id])}
      rail={recipeRailInsets(id)}
      textPadPx={textPadPx}
    />
  );
}

/** AL/AS と同じ定義: 青線＝テキスト枠。本文は青のすぐ内側（content-box や追加 padding は使わない） */
function RecipeTextAtBlue({
  id,
  textPadPx,
  width,
  height,
  textClassName,
  children,
}: {
  id: "frame_C" | "bubble_user" | "bubble_system";
  textPadPx: number;
  width: number;
  height: number;
  textClassName?: string;
  children: ReactNode;
}) {
  const rail = recipeRailInsets(id);
  const blue = {
    top: rail.top + textPadPx,
    right: rail.right + textPadPx,
    bottom: rail.bottom + textPadPx,
    left: rail.left + textPadPx,
  };
  return (
    <div className="relative inline-block" style={{ width: px(width), height: px(height) }}>
      <AoTemplateFrame preset={id} className="h-full w-full" style={{ width: "100%", height: "100%" }}>
        <div className="h-full w-full" />
      </AoTemplateFrame>
      <div
        className={`absolute overflow-hidden font-serif text-[12px] leading-snug ${
          textClassName ?? "text-[#3d1c08]"
        }`}
        style={{
          top: blue.top,
          right: blue.right,
          bottom: blue.bottom,
          left: blue.left,
          wordBreak: "break-all",
        }}
      >
        {children}
      </div>
      {presetRecipeGuides(id, textPadPx)}
    </div>
  );
}

function ComboGuides({
  cornerPx,
  railScale,
  textPadPx,
}: {
  cornerPx: number;
  railScale: number;
  textPadPx: number;
}) {
  const s = (n: number) => Math.max(1, Math.round(n * railScale));
  const top = s(AO_FRAME_A_RAIL.top.inner);
  const right = s(AO_FRAME_A_RAIL.right.inner);
  const bottom = s(AO_FRAME_A_RAIL.bottom.inner);
  const left = s(AO_FRAME_A_RAIL.left.inner);
  const dash = (color: string): CSSProperties => ({
    position: "absolute",
    boxSizing: "border-box",
    border: `1px dashed ${color}`,
    pointerEvents: "none",
  });
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div style={{ ...dash(GUIDE.outer), inset: 0, borderStyle: "solid" }} />
      <div style={{ ...dash(GUIDE.slice), top: 0, left: 0, width: px(cornerPx), height: px(cornerPx) }} />
      <div style={{ ...dash(GUIDE.slice), top: 0, right: 0, width: px(cornerPx), height: px(cornerPx) }} />
      <div style={{ ...dash(GUIDE.slice), bottom: 0, left: 0, width: px(cornerPx), height: px(cornerPx) }} />
      <div style={{ ...dash(GUIDE.slice), bottom: 0, right: 0, width: px(cornerPx), height: px(cornerPx) }} />
      <div style={{ ...dash(GUIDE.rail), top, right, bottom, left }} />
      <div
        style={{
          ...dash(GUIDE.text),
          top: top + textPadPx,
          right: right + textPadPx,
          bottom: bottom + textPadPx,
          left: left + textPadPx,
        }}
      />
    </div>
  );
}

export function AoTemplateTokenCatalog() {
  return (
    <div className="mx-auto max-w-[1100px] space-y-12 px-4 py-8 font-serif text-[#3d1c08]">
      <header className="space-y-2 border-b border-[#c9922a]/40 pb-5">
        <h1 className="text-xl font-bold tracking-wide">テンプレ・トークン台帳</h1>
        <p className="text-[12px] leading-relaxed text-[#6a3f0a]">
          表示専用の視覚 SSOT です。数値の正本は{" "}
          <code className="font-mono text-[11px]">web/src/lib/template/ao-frame-tokens.ts</code>。
          分類は W3C Design Tokens の primitive と、CSS{" "}
          <code className="font-mono text-[11px]">border-image</code>（9-slice）の解剖に合わせています。
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-[15px] font-bold">1. ガイド線（Guide tokens）</h2>
        <p className="text-[12px] text-[#6a3f0a]">
          診断・台帳用。本番 AO には描画しません。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#c9922a]/40">
                <th className="py-1 pr-3 font-semibold">トークン</th>
                <th className="py-1 pr-3 font-semibold">色</th>
                <th className="py-1 pr-3 font-semibold">線</th>
                <th className="py-1 font-semibold">意味</th>
              </tr>
            </thead>
            <tbody className="text-[#6a3f0a]">
              <tr className="border-b border-[#c9922a]/20">
                <td className="py-1.5 pr-3 font-mono text-[11px]">guide.outer</td>
                <td className="py-1.5 pr-3" style={{ color: GUIDE.outer }}>
                  {GUIDE.outer}
                </td>
                <td className="py-1.5 pr-3">マゼンタ実線 1px</td>
                <td className="py-1.5">コンポーネント外周（border-box）</td>
              </tr>
              <tr className="border-b border-[#c9922a]/20">
                <td className="py-1.5 pr-3 font-mono text-[11px]">guide.slice</td>
                <td className="py-1.5 pr-3" style={{ color: GUIDE.slice }}>
                  {GUIDE.slice}
                </td>
                <td className="py-1.5 pr-3">茶点線 1px</td>
                <td className="py-1.5">
                  角スライス矩形（一辺 = border-width）
                </td>
              </tr>
              <tr className="border-b border-[#c9922a]/20">
                <td className="py-1.5 pr-3 font-mono text-[11px]">guide.rail</td>
                <td className="py-1.5 pr-3" style={{ color: GUIDE.rail }}>
                  {GUIDE.rail}
                </td>
                <td className="py-1.5 pr-3">緑点線 1px</td>
                <td className="py-1.5">内枠。金レールのすぐ内側。内側はベージュ</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 font-mono text-[11px]">guide.text</td>
                <td className="py-1.5 pr-3" style={{ color: GUIDE.text }}>
                  {GUIDE.text}
                </td>
                <td className="py-1.5 pr-3">青点線 1px</td>
                <td className="py-1.5">
                  テキスト枠。AL は緑から {AO_FRAME_AL_TEXT_PAD_PX}px、AS・C・吹き出しは{" "}
                  {AO_FRAME_AS_TEXT_PAD_PX}px、Plate は {AO_LABEL_TEXT_PAD_PX}px
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-[#6a3f0a]">
          重ね順（前→後）: フレーム画像 → 青テキスト枠 → 緑内枠（ベージュ） → マゼンタ外周。地図背景はその後ろ。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-[15px] font-bold">2. 部品トークン（9-slice primitives）</h2>
        <p className="text-[12px] text-[#6a3f0a]">
          各プリセットの四隅と四辺。点線がソース上の slice（px）。チェッカーは透過。
        </p>
        <div className="flex flex-wrap gap-4">
          <SliceTile
            source="/template/frames/frame_A.png"
            width={AO_FRAME_A_SLICE_PX}
            height={AO_FRAME_A_SLICE_PX}
            position="left top"
            caption={`元 frame_A ${AO_FRAME_A_SLICE_PX}px（面が不透明）`}
          />
          <SliceTile
            source="/template/frames/frame_A_keyout.png"
            width={AO_FRAME_A_SLICE_PX}
            height={AO_FRAME_A_SLICE_PX}
            position="left top"
            caption={`frame_A keyout ${AO_FRAME_A_SLICE_PX}px（面が透過・本番）`}
          />
        </div>
        <div className="space-y-6">
          {PRIMITIVE_IDS.map((id) => (
            <NineSliceAtoms key={id} preset={AO_FRAME_PRESETS[id]} />
          ))}
        </div>
        <p className="font-mono text-[10px] text-[#6a3f0a]">
          Plate_A draw: 上下 {AO_LABEL_TB_WIDTH_PX}px / 左右 {AO_LABEL_SIDE_WIDTH_PX}px（slice {AO_LABEL_SLICE_PX}
          ）。Frame_A slice {AO_FRAME_A_SLICE_PX}px。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-[15px] font-bold">3. 組み合わせ（Recipes）</h2>
        <p className="text-[12px] text-[#6a3f0a]">
          本番と同じ <code className="font-mono text-[11px]">AoTemplateFrame</code> / Face / Plate。ガイドは台帳用です。
        </p>
        <div className="grid gap-8 lg:grid-cols-2">
          <figure className="space-y-2">
            <figcaption className="rounded border border-[#c9922a]/40 bg-[#f5edd6] px-2 py-1.5 text-[11px]">
              <div className="font-bold">大枠 Frame_AL</div>
              <div className="font-mono text-[10px] text-[#6a3f0a]">
                overlay · border {AO_FRAME_AL_BORDER_PX}px · textPad {AO_FRAME_AL_TEXT_PAD_PX}px
              </div>
            </figcaption>
            <div className="relative inline-block">
              <AoTemplateFrame preset="frame_AL" style={{ width: 320, height: 220 }}>
                <div
                  className="h-full overflow-hidden font-serif text-[12px] leading-snug text-[#3d1c08]"
                  style={{ wordBreak: "break-all" }}
                >
                  {WALL}
                </div>
              </AoTemplateFrame>
              <ComboGuides cornerPx={AO_FRAME_AL_BORDER_PX} railScale={1} textPadPx={AO_FRAME_AL_TEXT_PAD_PX} />
            </div>
          </figure>

          <figure className="space-y-2">
            <figcaption className="rounded border border-[#c9922a]/40 bg-[#f5edd6] px-2 py-1.5 text-[11px]">
              <div className="font-bold">中枠 Frame_AS</div>
              <div className="font-mono text-[10px] text-[#6a3f0a]">
                overlay · border {AO_FRAME_AS_BORDER_PX}px · textPad {AO_FRAME_AS_TEXT_PAD_PX}px
              </div>
            </figcaption>
            <div className="relative inline-block">
              <AoTemplateFrame preset="frame_AS" style={{ width: 280, height: 180 }}>
                <div
                  className="h-full overflow-hidden font-serif text-[12px] leading-snug text-[#3d1c08]"
                  style={{ wordBreak: "break-all" }}
                >
                  {WALL}
                </div>
              </AoTemplateFrame>
              <ComboGuides cornerPx={AO_FRAME_AS_BORDER_PX} railScale={0.5} textPadPx={AO_FRAME_AS_TEXT_PAD_PX} />
            </div>
          </figure>

          <figure className="space-y-2">
            <figcaption className="rounded border border-[#c9922a]/40 bg-[#f5edd6] px-2 py-1.5 text-[11px]">
              <div className="font-bold">小枠 Frame_C</div>
              <div className="font-mono text-[10px] text-[#6a3f0a]">
                slice 40 · draw {AO_FRAME_PRESETS.frame_C.topWidthPx}px · 4線 · textPad {AO_FRAME_C_TEXT_PAD_PX}px
              </div>
            </figcaption>
            <div className="relative inline-block">
              <RecipeTextAtBlue
                id="frame_C"
                textPadPx={AO_FRAME_C_TEXT_PAD_PX}
                width={280}
                height={160}
              >
                {WALL}
              </RecipeTextAtBlue>
            </div>
          </figure>

          <figure className="space-y-2">
            <figcaption className="rounded border border-[#c9922a]/40 bg-[#f5edd6] px-2 py-1.5 text-[11px]">
              <div className="font-bold">顔グラ Frame_D</div>
              <div className="font-mono text-[10px] text-[#6a3f0a]">
                border {AO_FRAME_D_BORDER_PX}px · padding 0
              </div>
            </figcaption>
            <div className="relative inline-block">
              <AoP5FaceFrameMid src="/personas/juci.png" alt="ジュチ" width={60} height={75} />
              <SliceBoxGuides size={AO_FRAME_D_BORDER_PX} />
            </div>
          </figure>

          <figure className="space-y-2">
            <figcaption className="rounded border border-[#c9922a]/40 bg-[#f5edd6] px-2 py-1.5 text-[11px]">
              <div className="font-bold">名前ラベル Plate_A</div>
              <div className="font-mono text-[10px] text-[#6a3f0a]">
                上下 {AO_LABEL_TB_WIDTH_PX}px / 左右 {AO_LABEL_SIDE_WIDTH_PX}px · 4線 · textPad {AO_LABEL_TEXT_PAD_PX}px
              </div>
            </figcaption>
            <div className="relative inline-block">
              <AoP5NameplateSmFrame text="ジュチ" width={96} />
              {presetRecipeGuides("label", AO_LABEL_TEXT_PAD_PX)}
            </div>
          </figure>

          <figure className="space-y-2">
            <figcaption className="rounded border border-[#c9922a]/40 bg-[#f5edd6] px-2 py-1.5 text-[11px]">
              <div className="font-bold">ユーザー吹き出し Bubble_A</div>
              <div className="font-mono text-[10px] text-[#6a3f0a]">
                50% · 右尾 · 4線 · textPad {AO_BUBBLE_TEXT_PAD_PX}px
              </div>
            </figcaption>
            <div className="relative inline-block">
              <RecipeTextAtBlue
                id="bubble_user"
                textPadPx={AO_BUBBLE_TEXT_PAD_PX}
                width={360}
                height={120}
                textClassName="text-[#1a0d04] leading-relaxed"
              >
                {WALL.slice(0, 80)}
              </RecipeTextAtBlue>
            </div>
          </figure>

          <figure className="space-y-2">
            <figcaption className="rounded border border-[#c9922a]/40 bg-[#f5edd6] px-2 py-1.5 text-[11px]">
              <div className="font-bold">システム吹き出し Bubble_B</div>
              <div className="font-mono text-[10px] text-[#6a3f0a]">
                50% · 左尾 · 4線 · textPad {AO_BUBBLE_TEXT_PAD_PX}px
              </div>
            </figcaption>
            <div className="relative inline-block">
              <RecipeTextAtBlue
                id="bubble_system"
                textPadPx={AO_BUBBLE_TEXT_PAD_PX}
                width={360}
                height={120}
                textClassName="text-[#1a0d04] leading-relaxed"
              >
                {WALL.slice(0, 80)}
              </RecipeTextAtBlue>
            </div>
          </figure>
        </div>
      </section>
    </div>
  );
}
