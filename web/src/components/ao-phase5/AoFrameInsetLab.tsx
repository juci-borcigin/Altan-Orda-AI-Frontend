"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  AO_FRAME_A_RAIL,
  AO_FRAME_A_SLICE_PX,
  AO_FRAME_AL_BORDER_PX,
  AO_FRAME_AS_BORDER_PX,
  AO_FRAME_ASSET_VER,
  AO_FRAME_D_BORDER_PX,
  AO_FRAME_D_SLICE_PX,
  AO_FRAME_PRESETS,
  AO_SURFACE_FILL,
} from "@/lib/template/ao-frame-tokens";
import { AoBorderImageFrame } from "./AoBorderImageFrame";
import { AoP5FaceFrameMid } from "./AoP5FaceFrameMid";
import { AoP5NameplateSmFrame } from "./AoP5NameplateSmFrame";

const G = {
  outer: "#c026d3",
  slice: "#b45309",
  rail: "#15803d",
  text: "#1d4ed8",
} as const;

/** 緑の内枠 → 青テキスト枠。大枠 10px / 中枠 5px（描画 px。縮尺しない） */
const TEXT_PAD_AL_PX = 10;
const TEXT_PAD_AS_PX = 5;

const FRAME_A_KEYOUT = `/template/frames/frame_A_keyout.png?v=${AO_FRAME_ASSET_VER}k`;

const WALL =
  "いろはにほへとちりぬるをわかよたれそつねならむうゐのおくやまけふこえてあさきゆめみしゑひもせすん".repeat(12);

function px(n: number) {
  return `${n}px`;
}

function scaled(n: number, scale: number) {
  return Math.max(1, Math.round(n * scale));
}

type RailSrc = {
  top: { outerPad: number; inner: number };
  right: { outerPad: number; inner: number };
  bottom: { outerPad: number; inner: number };
  left: { outerPad: number; inner: number };
};

function railInner(rail: RailSrc, scale: number) {
  return {
    top: scaled(rail.top.inner, scale),
    right: scaled(rail.right.inner, scale),
    bottom: scaled(rail.bottom.inner, scale),
    left: scaled(rail.left.inner, scale),
  };
}

function AoNineSliceGuides({
  cornerPx,
  rail,
  scale = 1,
  textPadPx = 0,
}: {
  cornerPx: number;
  rail: RailSrc;
  scale?: number;
  textPadPx?: number;
}) {
  const c = scaled(cornerPx, 1);
  const top0 = scaled(rail.top.outerPad, scale);
  const top1 = scaled(rail.top.inner, scale);
  const right0 = scaled(rail.right.outerPad, scale);
  const right1 = scaled(rail.right.inner, scale);
  const bottom0 = scaled(rail.bottom.outerPad, scale);
  const bottom1 = scaled(rail.bottom.inner, scale);
  const left0 = scaled(rail.left.outerPad, scale);
  const left1 = scaled(rail.left.inner, scale);

  const dash = (color: string, z: number): CSSProperties => ({
    position: "absolute",
    boxSizing: "border-box",
    border: `1px dashed ${color}`,
    pointerEvents: "none",
    zIndex: z,
  });

  const cap: CSSProperties = {
    position: "absolute",
    zIndex: 51,
    pointerEvents: "none",
    fontSize: 9,
    lineHeight: 1,
    fontFamily: "ui-monospace, monospace",
    background: "rgba(255,255,255,0.85)",
    padding: "1px 3px",
  };

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {/* 下: マゼンタ外周 */}
      <div style={{ ...dash(G.outer, 0), inset: 0, borderStyle: "solid" }} />

      <div style={{ ...dash(G.slice, 0), top: 0, left: 0, width: px(c), height: px(c) }} />
      <div style={{ ...dash(G.slice, 0), top: 0, right: 0, width: px(c), height: px(c) }} />
      <div style={{ ...dash(G.slice, 0), bottom: 0, left: 0, width: px(c), height: px(c) }} />
      <div style={{ ...dash(G.slice, 0), bottom: 0, right: 0, width: px(c), height: px(c) }} />

      {/* 緑内枠（フレームより下。角金がこの線の上に乗る） */}
      <div
        style={{
          ...dash(G.rail, 1),
          top: px(top1),
          right: px(right1),
          bottom: px(bottom1),
          left: px(left1),
        }}
      />
      <span style={{ ...cap, color: G.rail, top: px(top1 + 2), left: px(left1 + 2) }}>
        内枠（緑）
      </span>

      {textPadPx > 0 ? (
        <>
          <div
            style={{
              ...dash(G.text, 2),
              top: px(top1 + textPadPx),
              right: px(right1 + textPadPx),
              bottom: px(bottom1 + textPadPx),
              left: px(left1 + textPadPx),
            }}
          />
          <span
            style={{
              ...cap,
              color: G.text,
              top: px(top1 + textPadPx + 2),
              left: px(left1 + textPadPx + 2),
            }}
          >
            テキスト枠 +{textPadPx}px
          </span>
        </>
      ) : null}

      <div
        style={{
          ...dash(G.rail, 1),
          top: px(top0),
          left: px(c),
          right: px(c),
          height: px(top1 - top0),
          opacity: 0.45,
        }}
      />
      <div
        style={{
          ...dash(G.rail, 1),
          bottom: px(bottom0),
          left: px(c),
          right: px(c),
          height: px(bottom1 - bottom0),
          opacity: 0.45,
        }}
      />
      <div
        style={{
          ...dash(G.rail, 1),
          left: px(left0),
          top: px(c),
          bottom: px(c),
          width: px(left1 - left0),
          opacity: 0.45,
        }}
      />
      <div
        style={{
          ...dash(G.rail, 1),
          right: px(right0),
          top: px(c),
          bottom: px(c),
          width: px(right1 - right0),
          opacity: 0.45,
        }}
      />
    </div>
  );
}

function Checker({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      className="relative inline-block"
      style={{
        backgroundColor: "#e7e5e4",
        backgroundImage:
          "linear-gradient(45deg, #d6d3d1 25%, transparent 25%), linear-gradient(-45deg, #d6d3d1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d6d3d1 75%), linear-gradient(-45deg, transparent 75%, #d6d3d1 75%)",
        backgroundSize: "12px 12px",
        backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function cornerCrop(source: string, size: number, label: string) {
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="font-mono text-[10px] text-[#6a3f0a]">{label}</figcaption>
      <div
        className="relative box-border shrink-0"
        style={{
          width: px(size),
          height: px(size),
          border: `1px dashed ${G.slice}`,
          backgroundColor: "#e7e5e4",
          backgroundImage:
            "linear-gradient(45deg, #d6d3d1 25%, transparent 25%), linear-gradient(-45deg, #d6d3d1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d6d3d1 75%), linear-gradient(-45deg, transparent 75%, #d6d3d1 75%)",
          backgroundSize: "8px 8px",
          backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('${source}')`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "left top",
            backgroundSize: "auto",
          }}
        />
      </div>
    </figure>
  );
}

/**
 * 重ね順（上→下）:
 * フレーム画像 → 青テキスト枠（透過＋文字） → 緑内枠（ベージュ塗り） → マゼンタ外周
 */
function FlushTextFrame({
  width,
  height,
  borderPx,
  scale,
  textPadPx,
  caption,
}: {
  width: number;
  height: number;
  borderPx: number;
  scale: number;
  textPadPx: number;
  caption: string;
}) {
  const inset = railInner(AO_FRAME_A_RAIL, scale);
  const textInset = {
    top: inset.top + textPadPx,
    right: inset.right + textPadPx,
    bottom: inset.bottom + textPadPx,
    left: inset.left + textPadPx,
  };
  return (
    <figure className="flex flex-col items-start gap-2">
      <figcaption className="max-w-[520px] space-y-1 rounded border border-[#c9922a]/40 bg-[#f5edd6] px-2 py-1.5 font-serif text-[11px] leading-snug text-[#3d1c08]">
        <div className="font-bold">{caption}</div>
        <div className="font-mono text-[10px] text-[#6a3f0a]">
          緑内枠をベージュ塗り。青テキスト枠は緑から内側 {textPadPx}px・背景透過。
        </div>
      </figcaption>
      <Checker style={{ width, height }}>
        <div
          style={{
            position: "absolute",
            top: inset.top,
            right: inset.right,
            bottom: inset.bottom,
            left: inset.left,
            zIndex: 1,
            background: AO_SURFACE_FILL,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: textInset.top,
            right: textInset.right,
            bottom: textInset.bottom,
            left: textInset.left,
            zIndex: 2,
            overflow: "hidden",
            margin: 0,
            padding: 0,
            background: "transparent",
            color: "#3d1c08",
            fontFamily: "Georgia, 'Noto Serif JP', serif",
            fontSize: 12,
            lineHeight: 1.2,
            letterSpacing: 0,
            wordBreak: "break-all",
          }}
        >
          {WALL}
        </div>
        <AoBorderImageFrame
          source={FRAME_A_KEYOUT}
          sliceTopPx={AO_FRAME_A_SLICE_PX}
          sliceRightPx={AO_FRAME_A_SLICE_PX}
          sliceBottomPx={AO_FRAME_A_SLICE_PX}
          sliceLeftPx={AO_FRAME_A_SLICE_PX}
          topWidthPx={borderPx}
          rightWidthPx={borderPx}
          bottomWidthPx={borderPx}
          leftWidthPx={borderPx}
          repeat="stretch"
          fillColor={null}
          sliceFill={false}
          className="pointer-events-none"
          style={{ position: "absolute", inset: 0, zIndex: 3 }}
          contentStyle={{ padding: 0, height: "100%" }}
        />
        <AoNineSliceGuides
          cornerPx={borderPx}
          rail={AO_FRAME_A_RAIL}
          scale={scale}
          textPadPx={textPadPx}
        />
      </Checker>
    </figure>
  );
}

const FACE_SRC = "/personas/juci.png";

const FACE_RAIL: RailSrc = {
  top: { outerPad: 0, inner: 12 },
  right: { outerPad: 0, inner: 12 },
  bottom: { outerPad: 0, inner: 12 },
  left: { outerPad: 0, inner: 12 },
};

export function AoFrameInsetLab() {
  const frameA = `/template/frames/frame_A.png?v=${AO_FRAME_ASSET_VER}`;
  const frameD = `${AO_FRAME_PRESETS.frame_D.source}?v=${AO_FRAME_ASSET_VER}`;

  return (
    <div className="mx-auto max-w-[1100px] space-y-10 px-4 py-8 font-serif text-[#3d1c08]">
      <header className="space-y-3 border-b border-[#c9922a]/40 pb-5">
        <h1 className="text-xl font-bold tracking-wide">枠インセット診断ラボ</h1>
        <p className="text-[12px] leading-relaxed text-[#6a3f0a]">
          重ね順は上から、フレーム画像 → 青テキスト枠 → 緑内枠（ベージュ） → マゼンタ外周です。緑と青のあいだは文字なしのベージュです。
        </p>
      </header>

      <section className="space-y-2 rounded border border-[#c9922a]/35 bg-[#fffaf2] p-4 text-[12px] leading-relaxed">
        <h2 className="text-[14px] font-bold">この実験</h2>
        <ul className="list-disc space-y-1 pl-5 text-[#6a3f0a]">
          <li>
            角（と辺の内側）のベージュ <code className="font-mono text-[11px]">#FFFAF2</code> を透過にしました。金の飾りは残しています。
          </li>
          <li>
            枠画像を文字の<strong>上</strong>に重ねています（通常の CSS だと子が枠より手前になり、Frame_D 成功例と逆になるため）。
          </li>
          <li>
            <span className="font-semibold" style={{ color: G.rail }}>緑点線</span>
            の内側をベージュで塗る（文字なし）。角画像はその線の上。
          </li>
          <li>
            <span className="font-semibold" style={{ color: G.text }}>青点線</span>
            がテキスト枠（背景透過）。大枠は緑から内側 {TEXT_PAD_AL_PX}px、中枠は {TEXT_PAD_AS_PX}px。
          </li>
          <li>チェッカーは透過の確認用です。本番の frame_A にはまだ適用していません。</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-[15px] font-bold">角 PNG（チェッカー＝透過）</h2>
        <div className="flex flex-wrap gap-6">
          {cornerCrop(frameA, 52, "元 frame_A 52px（面が不透明）")}
          {cornerCrop(FRAME_A_KEYOUT, 52, "keyout 52px（面が透過）")}
          {cornerCrop(frameD, 12, "frame_D（成功例）")}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <FlushTextFrame
          caption="大枠 Frame_AL（緑＋10px → 青テキスト）"
          width={320}
          height={220}
          borderPx={AO_FRAME_AL_BORDER_PX}
          scale={1}
          textPadPx={TEXT_PAD_AL_PX}
        />
        <FlushTextFrame
          caption="中枠 Frame_AS（緑＋5px → 青テキスト）"
          width={280}
          height={180}
          borderPx={AO_FRAME_AS_BORDER_PX}
          scale={0.5}
          textPadPx={TEXT_PAD_AS_PX}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-[15px] font-bold">成功例（変更なし）</h2>
        <div className="flex flex-wrap items-end gap-6">
          <div className="relative inline-block">
            <AoP5FaceFrameMid src={FACE_SRC} alt="ジュチ" width={60} height={75} />
            <AoNineSliceGuides cornerPx={AO_FRAME_D_BORDER_PX} rail={FACE_RAIL} scale={0.5} />
          </div>
          <AoP5NameplateSmFrame text="ジュチ" width={72} variant="tight" />
          <span className="text-[11px] text-[#6a3f0a]">
            Frame_D / Plate_A … slice={AO_FRAME_D_SLICE_PX} border={AO_FRAME_D_BORDER_PX}
          </span>
        </div>
      </section>
    </div>
  );
}
