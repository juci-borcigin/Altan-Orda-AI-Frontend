"use client";

import type { CSSProperties, ReactNode } from "react";
import { AoTemplateFrame } from "./AoTemplateFrame";
import { AoBorderImageFrame } from "./AoBorderImageFrame";
import {
  AO_FRAME_ASSET_VER,
  AO_FRAME_B_RESERVE,
  AO_SURFACE_FILL,
} from "@/lib/template/ao-frame-tokens";

import { AO_TEMPLATE_BG_MAP } from "@/lib/template/ao-template-assets";

const MAP_BG = AO_TEMPLATE_BG_MAP;

/**
 * 新テンプレ枠を AO レイアウトに当てはめた静的サンプル（本番 page.tsx 非改変）。
 * PoC #2: Frame_AL（大） / Frame_AS（中＝Frame_A 50%）。
 */
export function AoTemplateLayoutSample() {
  return (
    <div
      className="relative overflow-hidden rounded border-2 border-[#c9922a]/50"
      style={{ width: 960, height: 640, flexShrink: 0 }}
    >
      {/* 背景 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url('${MAP_BG}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 bg-white/55" />

      {/* ヘッダ帯（簡略） */}
      <div
        className="relative z-10 flex h-[48px] items-center justify-center border-b-2 border-[#C9922A]"
        style={{ background: "#EDE3CE" }}
      >
        <span className="font-serif text-[16px] font-bold text-[#6a3f0a]">Altan Orda — テンプレ適用サンプル</span>
      </div>

      <div className="relative z-10 flex h-[calc(640px-48px)] min-h-0">
        {/* 左カラム: 大枠 AL + 中枠 AS ×3 */}
        <div className="flex w-[220px] shrink-0 flex-col p-2">
          <AoTemplateFrame
            preset="frame_AL"
            className="flex min-h-0 flex-1 flex-col"
            contentClassName="flex min-h-0 flex-1 flex-col gap-2 p-1"
          >
            {/* 邦主 */}
            <div className="flex flex-col gap-1">
              <div className="text-center font-serif text-[11px] font-semibold tracking-wider text-[#3D1C08]">
                邦　主
              </div>
              <AoTemplateFrame preset="frame_AS" contentClassName="p-2">
                <div className="flex items-center gap-2">
                  <AoTemplateFrame
                    preset="frame_D"
                    style={{ width: 48, height: 60, flexShrink: 0 }}
                  />
                  <AoTemplateFrame preset="label" style={{ flex: 1, minHeight: 24 }}>
                    <div className="grid h-full place-items-center font-serif text-[11px] font-bold text-[#3D1C08]">
                      ジュチ
                    </div>
                  </AoTemplateFrame>
                </div>
              </AoTemplateFrame>
            </div>

            {/* 機能メニュー */}
            <AoTemplateFrame preset="frame_AS" contentClassName="px-2 py-2">
              <div className="flex flex-col gap-1 font-serif text-[10px] text-[#3D1C08]">
                <div className="rounded bg-[#c9922a]/20 px-2 py-1 font-semibold">チャット</div>
                <div className="px-2 py-1 opacity-70">ナレッジ</div>
              </div>
            </AoTemplateFrame>

            {/* 僚友 */}
            <div className="flex min-h-0 flex-1 flex-col gap-1">
              <div className="text-center font-serif text-[11px] font-semibold tracking-wider text-[#3D1C08]">
                僚　友
              </div>
              <AoTemplateFrame preset="frame_AS" className="min-h-0 flex-1" contentClassName="p-2">
                <div className="flex flex-col gap-2">
                  {["フナン", "モンケウル", "エディグ"].map((name) => (
                    <div key={name} className="flex items-center gap-1.5">
                      <AoTemplateFrame preset="frame_D" style={{ width: 32, height: 40, flexShrink: 0 }} />
                      <AoTemplateFrame preset="label" style={{ flex: 1, minHeight: 22 }}>
                        <div className="grid h-full place-items-center font-serif text-[9px] font-bold text-[#3D1C08]">
                          {name}
                        </div>
                      </AoTemplateFrame>
                    </div>
                  ))}
                </div>
              </AoTemplateFrame>
            </div>
          </AoTemplateFrame>
        </div>

        {/* メインカラム: ビュー AL + ユーザー AL */}
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-2 pb-3">
          {/* ビューエリア */}
          <AoTemplateFrame preset="frame_AL" className="min-h-0 flex-[3]" contentClassName="flex flex-col gap-3 overflow-visible p-4">
            <div className="font-serif text-[12px] font-bold text-[#3D1C08]">ビューエリア（Frame_AL）</div>
            {/* 幅は % ではなく px。border-image + % 幅だと横二重に見えることがある */}
            <AoTemplateFrame
              preset="bubble_system"
              style={{ width: 420, maxWidth: "100%", minHeight: 120, alignSelf: "flex-start" }}
            >
              <div className="px-2 py-1 font-serif text-[11px] leading-relaxed text-[#1a0d04]">
                システム吹き出し（Bubble_B）。Frame_AL 内に配置。
              </div>
            </AoTemplateFrame>
            <AoTemplateFrame
              preset="bubble_user"
              style={{ width: 380, maxWidth: "100%", minHeight: 120, alignSelf: "flex-end" }}
            >
              <div className="px-2 py-1 font-serif text-[11px] leading-relaxed text-[#1a0d04]">
                ユーザー吹き出し（Bubble_A）。
              </div>
            </AoTemplateFrame>
          </AoTemplateFrame>

          {/* ユーザーエリア */}
          <AoTemplateFrame preset="frame_AL" className="shrink-0" contentClassName="p-3">
            <div className="mb-2 font-serif text-[11px] font-bold text-[#3D1C08]">ユーザーエリア（Frame_AL）</div>
            <div className="flex items-end gap-2">
              <AoTemplateFrame preset="frame_D" style={{ width: 36, height: 45, flexShrink: 0 }} />
              <div
                className="min-h-[40px] flex-1 rounded-sm border border-[#c9922a]/30 font-serif text-[11px] text-[#8a6018]"
                style={{ background: AO_SURFACE_FILL, padding: "8px 10px" }}
              >
                入力欄（プレースホルダ）
              </div>
            </div>
          </AoTemplateFrame>
        </div>
      </div>
    </div>
  );
}

/** PoC #1 用: 単体枠＋ラベル */
export function AoTemplateFrameShowcase({
  preset,
  caption,
  style,
  children,
}: {
  preset: Parameters<typeof AoTemplateFrame>[0]["preset"];
  caption: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <figure className="relative z-10 flex flex-col items-start gap-2">
      <figcaption
        className="relative z-20 px-2 py-0.5 text-[12px] font-semibold text-[#3D1C08]"
        style={{ backgroundColor: "#F5EDD6", border: "1px solid rgba(201,146,42,0.45)" }}
      >
        {caption}
      </figcaption>
      <div className="relative z-10">
        <AoTemplateFrame preset={preset} style={style}>
          {children}
        </AoTemplateFrame>
      </div>
    </figure>
  );
}

/** 非採用 Frame_B（参考） */
export function AoFrameBReservePreview() {
  const cfg = AO_FRAME_B_RESERVE;
  return (
    <figure className="relative z-10 flex flex-col items-start gap-2 opacity-70">
      <figcaption
        className="relative z-20 px-2 py-0.5 text-[12px] font-semibold text-neutral-800"
        style={{ backgroundColor: "#F5EDD6", border: "1px solid rgba(100,100,100,0.4)" }}
      >
        （非採用）Frame_B — リソース保留 / AO では不使用
      </figcaption>
      <div className="relative z-10">
        <AoBorderImageFrame
          source={`${cfg.source}?v=${AO_FRAME_ASSET_VER}`}
          sliceTopPx={cfg.sliceTopPx}
          sliceRightPx={cfg.sliceRightPx}
          sliceBottomPx={cfg.sliceBottomPx}
          sliceLeftPx={cfg.sliceLeftPx}
          topWidthPx={cfg.topWidthPx}
          rightWidthPx={cfg.rightWidthPx}
          bottomWidthPx={cfg.bottomWidthPx}
          leftWidthPx={cfg.leftWidthPx}
          repeat={cfg.repeat}
          fillColor={null}
          sliceFill
          style={{ width: 320, height: 120 }}
        />
      </div>
    </figure>
  );
}
