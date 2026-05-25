"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AoP5Bubble, AoP5Corner, AoP5CornerMaster, AoP5DecorativeFrame, AoP5NineSliceBubble, AoP5ParchmentBubble, AoP5PortraitCard, AoP5PortraitFrame, AoP5PortraitFrameC, AoP5NameplateSm, AoP5FaceFrameMid, AoP5NameplateSmFrame } from "@/components/ao-phase5";
import { AO_PORTRAIT_LAYOUT_W_PX } from "@/lib/ao-portrait";

/** AO 本番と同じ顔グラ縦（4:5）・名前フォント（AoP5NameplateSm と同式） */
const AO_PREVIEW_PORTRAIT_H_PX = Math.ceil((AO_PORTRAIT_LAYOUT_W_PX * 5) / 4);
const AO_PREVIEW_NAME_FONT_PX = Math.max(10, Math.round((11 * AO_PORTRAIT_LAYOUT_W_PX) / 80));

/** 疑似ビューポートフレーム（実際のピクセル幅を視覚的に確認するためのラッパー） */
function ViewportFrame({
  label,
  widthPx,
  heightPx,
  mapSrc,
  mapSize,
}: {
  label: string;
  widthPx: number;
  heightPx: number;
  mapSrc: string;
  mapSize: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded bg-[#c9922a]/20 px-2 py-0.5 text-[11px] font-semibold text-[#6a3f0a]">
        {label} — {widthPx}×{heightPx}px
      </div>
      {/* 実寸ビューポート枠 */}
      <div
        className="relative overflow-hidden rounded border-2 border-[#c9922a]/60"
        style={{ width: widthPx, height: heightPx, flexShrink: 0 }}
      >
        {/* 地図背景 */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('${mapSrc}')`,
            backgroundSize: mapSize,
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
        {/* 半透明オーバーレイ（本番と同等） */}
        <div className="absolute inset-0 bg-white/60" />

        {/* ── ヘッダーモック ── */}
        <div
          className="relative z-10 flex items-center justify-between border-b-[3px] border-[#C9922A] px-3"
          style={{ height: 52, background: "#EDE3CE" }}
        >
          <div className="h-[7px] w-[90px] rounded bg-[#c9922a]/40" />
          <span
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 18,
              fontWeight: "bold",
              color: "#6a3f0a",
              letterSpacing: "0.05em",
            }}
          >
            Altan Orda
          </span>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center justify-center rounded-full border border-[#784b0f]/40 bg-[#784b0f]/10"
                style={{ width: 22, height: 22 }}
              >
                <div className="h-[6px] w-[6px] rounded-full bg-[#6a3f0a]/60" />
              </div>
            ))}
          </div>
        </div>

        {/* ── メインエリアモック ── */}
        <div className="relative z-10 flex" style={{ height: heightPx - 52 }}>
          {/* 左サイドバー（PC幅のみ） */}
          {widthPx >= 768 && (
            <div
              className="flex flex-col gap-1 overflow-hidden border-r border-[#c9922a]/30 p-1.5"
              style={{ width: 120, background: "rgba(237,227,206,0.7)", flexShrink: 0 }}
            >
              {/* ユーザーカード */}
              <div
                className="flex items-center gap-1.5 rounded p-1"
                style={{ background: "rgba(255,236,180,0.55)", border: "1px solid #a07018" }}
              >
                <div className="h-7 w-7 rounded-full bg-[#c9922a]/40" style={{ flexShrink: 0 }} />
                <div>
                  <div className="text-[8px] font-bold text-[#6a3f0a]">ジュチ</div>
                  <div className="text-[7px] text-[#8a6018]/80">邦主</div>
                </div>
              </div>
              {/* 他メンバー */}
              {["スブタイ", "ジェベ", "バトゥ"].map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-1.5 rounded p-1"
                  style={{
                    background: "rgba(255,253,248,0.55)",
                    border: "1px solid rgba(184,137,46,0.5)",
                  }}
                >
                  <div className="h-6 w-6 rounded-full bg-[#c9922a]/25" style={{ flexShrink: 0 }} />
                  <div className="text-[8px] font-bold text-[#3d1c08]">{name}</div>
                </div>
              ))}
            </div>
          )}

          {/* チャットエリア */}
          <div className="flex min-w-0 flex-1 flex-col justify-between p-2" style={{ gap: 6 }}>
            {/* 吹き出し群 */}
            <div className="flex flex-col gap-2">
              {/* AI吹き出し */}
              <div
                className="rounded-tr-lg rounded-br-lg rounded-bl-lg self-start"
                style={{
                  maxWidth: "80%",
                  padding: "6px 8px",
                  fontSize: 9,
                  background: "#faf6ee",
                  border: "1px solid #b8892e",
                  color: "#1a0d04",
                  fontFamily: "Georgia, serif",
                }}
              >
                スブタイより申し上げます。準備が整いました。
              </div>
              {/* User吹き出し */}
              <div
                className="rounded-tl-lg rounded-bl-lg rounded-br-lg self-end"
                style={{
                  maxWidth: "70%",
                  padding: "6px 8px",
                  fontSize: 9,
                  background: "#faf6ee",
                  border: "1px solid #b8892e",
                  color: "#1a0d04",
                  fontFamily: "Georgia, serif",
                }}
              >
                承知した、進めよ。
              </div>
            </div>
            {/* 入力欄 */}
            <div
              className="rounded-tl-lg rounded-br-lg rounded-bl-lg"
              style={{
                height: 32,
                background: "#faf6ee",
                border: "1px solid #b8892e",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Phase5PreviewPage() {
  // globals.css の `body { overflow: hidden }` をこのページだけ解除
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#ede3ce] p-6 text-[#1a0d04]">
      <div className="mx-auto max-w-[1200px] space-y-8">
        <header className="rounded border border-[#c9922a]/60 bg-[#f5edd6] px-4 py-3">
          <div className="text-[14px] font-semibold">Phase 5 パーツ確認</div>
          <div className="text-[11px] opacity-80">
            `web/src/components/ao-phase5/` の部品だけを表示します（AO本体の画面とは別ページ）。
          </div>
          <div className="mt-1 text-[11px] opacity-80">
            URL: <code className="rounded bg-black/10 px-1 py-0.5">/phase5-preview</code>
            {" · "}
            <Link href="/phase5-preview/notebook-sources" className="font-semibold underline">
              典籍論ソース取込（仮 UI）
            </Link>
          </div>
        </header>

        {/* =====================================================
            地図背景 × 3ビューポート
            ===================================================== */}
        <section>
          <div className="mb-3 rounded border border-[#c9922a]/60 bg-[#f5edd6] px-3 py-2">
            <div className="text-[13px] font-bold text-[#6a3f0a]">地図背景 × ビューポート確認</div>
            <div className="text-[11px] opacity-80">
              PC: map-bg-pc.png（横長）　モバイル: map-bg-mobile.png（縦長）を実サイズ枠で表示
            </div>
          </div>
          <div className="flex flex-wrap gap-8">
            {/* PC */}
            <ViewportFrame
              label="PC"
              widthPx={960}
              heightPx={580}
              mapSrc="/phase5/map-bg-mobile.png"
              mapSize="cover"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-start gap-8">
            {/* iPhone 16 Pro（CSS px: 393 × 852、zoom 0.82） */}
            <ViewportFrame
              label="iPhone 16 Pro（CSS 393px）"
              widthPx={393}
              heightPx={700}
              mapSrc="/phase5/map-bg-mobile.png"
              mapSize="cover"
            />
            {/* iPhone SE1（CSS px: 320 × 568、zoom 0.72） */}
            <ViewportFrame
              label="iPhone SE1（CSS 320px）"
              widthPx={320}
              heightPx={568}
              mapSrc="/phase5/map-bg-mobile.png"
              mapSize="cover"
            />
          </div>

          {/* 地図画像だけを横に並べて比較 */}
          <div className="mt-6 rounded border border-[#c9922a]/50 bg-white/70 p-4">
            <div className="mb-3 text-[12px] font-semibold">地図画像 素材確認（map-bg-mobile.png をPC/モバイル共通使用）</div>
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col items-start gap-1">
                <div className="text-[10px] text-[#6a3f0a]">map-bg-mobile.png（PC/モバイル共通）</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/phase5/map-bg-mobile.png"
                  alt="Map"
                  style={{ width: 480, height: "auto", borderRadius: 4, border: "1px solid #c9922a66" }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            ロゴ透過PNG × 3サイズ確認
            ===================================================== */}
        <section>
          <div className="mb-3 rounded border border-[#c9922a]/60 bg-[#f5edd6] px-3 py-2">
            <div className="text-[13px] font-bold text-[#6a3f0a]">ロゴ透過PNG × 3サイズ確認</div>
            <div className="text-[11px] opacity-80">
              各サイズを羊皮紙・白・濃色の背景で重ねて表示（透過の品質確認）
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {/* PC */}
            <div className="rounded border border-[#c9922a]/50 p-3">
              <div className="mb-1 text-[10px] font-semibold text-[#6a3f0a]">PC用 logo-pc.png（716×182）</div>
              {/* 羊皮紙背景 */}
              <div className="mb-2 flex items-center justify-center rounded p-3" style={{ background: "#EDE3CE" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/phase5/logo-pc.png" alt="Logo PC" style={{ maxWidth: "100%", height: "auto" }} />
              </div>
              {/* 白背景 */}
              <div className="mb-2 flex items-center justify-center rounded p-3" style={{ background: "#fff" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/phase5/logo-pc.png" alt="Logo PC white" style={{ maxWidth: "100%", height: "auto" }} />
              </div>
              {/* 濃色背景 */}
              <div className="flex items-center justify-center rounded p-3" style={{ background: "#2a1205" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/phase5/logo-pc.png" alt="Logo PC dark" style={{ maxWidth: "100%", height: "auto" }} />
              </div>
            </div>

            {/* iPhone 16 Pro */}
            <div className="rounded border border-[#c9922a]/50 p-3">
              <div className="mb-1 text-[10px] font-semibold text-[#6a3f0a]">16 Pro用 logo-16pro.png（360×92）</div>
              <div className="mb-2 flex items-center justify-center rounded p-3" style={{ background: "#EDE3CE" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/phase5/logo-16pro.png" alt="Logo 16 Pro" style={{ maxWidth: "100%", height: "auto" }} />
              </div>
              <div className="mb-2 flex items-center justify-center rounded p-3" style={{ background: "#fff" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/phase5/logo-16pro.png" alt="Logo 16 Pro white" style={{ maxWidth: "100%", height: "auto" }} />
              </div>
              <div className="flex items-center justify-center rounded p-3" style={{ background: "#2a1205" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/phase5/logo-16pro.png" alt="Logo 16 Pro dark" style={{ maxWidth: "100%", height: "auto" }} />
              </div>
            </div>

            {/* iPhone SE1 */}
            <div className="rounded border border-[#c9922a]/50 p-3">
              <div className="mb-1 text-[10px] font-semibold text-[#6a3f0a]">SE1用 logo-se1.png（280×71）</div>
              <div className="mb-2 flex items-center justify-center rounded p-3" style={{ background: "#EDE3CE" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/phase5/logo-se1.png" alt="Logo SE1" style={{ maxWidth: "100%", height: "auto" }} />
              </div>
              <div className="mb-2 flex items-center justify-center rounded p-3" style={{ background: "#fff" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/phase5/logo-se1.png" alt="Logo SE1 white" style={{ maxWidth: "100%", height: "auto" }} />
              </div>
              <div className="flex items-center justify-center rounded p-3" style={{ background: "#2a1205" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/phase5/logo-se1.png" alt="Logo SE1 dark" style={{ maxWidth: "100%", height: "auto" }} />
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            枠・角パーツ確認（6種）
            ===================================================== */}
        <section>
          <div className="mb-3 rounded border border-[#c9922a]/60 bg-[#f5edd6] px-3 py-2">
            <div className="text-[13px] font-bold text-[#6a3f0a]">枠・角パーツ × 大/中/小 確認</div>
            <div className="text-[11px] opacity-80">
              羊皮紙・白・濃色の3背景で透過品質を確認
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: "枠・大 frame-lg.png（300×250）",  src: "/phase5/frame-lg.png"  },
              { label: "枠・中 frame-md.png（112×64）",   src: "/phase5/frame-md.png"  },
              { label: "枠・小 frame-sm.png（67×38）",    src: "/phase5/frame-sm.png"  },
              { label: "角・大 corner-lg.png（115×95）",  src: "/phase5/corner-lg.png" },
              { label: "角・中 corner-md.png（32×64）",   src: "/phase5/corner-md.png" },
              { label: "角・小 corner-sm.png（19×38）",   src: "/phase5/corner-sm.png" },
            ].map(({ label, src }) => (
              <div key={src} className="rounded border border-[#c9922a]/50 p-3">
                <div className="mb-1 text-[10px] font-semibold text-[#6a3f0a]">{label}</div>
                {[
                  { bg: "#EDE3CE", name: "羊皮紙" },
                  { bg: "#ffffff", name: "白" },
                  { bg: "#2a1205", name: "濃色" },
                ].map(({ bg, name }) => (
                  <div
                    key={name}
                    className="mb-2 flex flex-col items-center justify-center gap-0.5 rounded p-3 last:mb-0"
                    style={{ background: bg, minHeight: 60 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`${label} ${name}`} style={{ maxWidth: "100%", maxHeight: 200, objectFit: "contain" }} />
                    <span className="text-[8px]" style={{ color: bg === "#2a1205" ? "#c9922a80" : "#6a3f0a66" }}>
                      {name}背景
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* =====================================================
            ロゴ2（彩色イニシャル版）透過PNG × 3サイズ確認
            ===================================================== */}
        <section>
          <div className="mb-3 rounded border border-[#c9922a]/60 bg-[#f5edd6] px-3 py-2">
            <div className="text-[13px] font-bold text-[#6a3f0a]">ロゴ2（彩色イニシャル版）透過PNG × 3サイズ確認</div>
            <div className="text-[11px] opacity-80">
              羊皮紙・白・濃色の3背景で透過品質を確認
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: "PC用 logo2-pc.png（728×186）", src: "/phase5/logo2-pc.png", alt: "Logo2 PC" },
              { label: "16 Pro用 logo2-16pro.png（360×92）", src: "/phase5/logo2-16pro.png", alt: "Logo2 16Pro" },
              { label: "SE1用 logo2-se1.png（280×72）", src: "/phase5/logo2-se1.png", alt: "Logo2 SE1" },
            ].map(({ label, src, alt }) => (
              <div key={src} className="rounded border border-[#c9922a]/50 p-3">
                <div className="mb-1 text-[10px] font-semibold text-[#6a3f0a]">{label}</div>
                {[
                  { bg: "#EDE3CE", name: "羊皮紙" },
                  { bg: "#ffffff", name: "白" },
                  { bg: "#2a1205", name: "濃色" },
                ].map(({ bg, name }) => (
                  <div
                    key={name}
                    className="mb-2 flex flex-col items-center justify-center gap-0.5 rounded p-3 last:mb-0"
                    style={{ background: bg }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`${alt} ${name}`} style={{ maxWidth: "100%", height: "auto" }} />
                    <span className="text-[8px]" style={{ color: bg === "#2a1205" ? "#c9922a80" : "#6a3f0a66" }}>
                      {name}背景
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* =====================================================
            コーナーパーツ確認（既存）
            ===================================================== */}
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded border border-[#c9922a]/50 bg-white/70 p-4">
            <div className="mb-2 text-[12px] font-semibold">AoP5Corner（仮SVG / 4方向）</div>
            <div className="flex flex-wrap items-center gap-3">
              {(["tl", "tr", "bl", "br"] as const).map((slot) => (
                <div key={slot} className="grid place-items-center rounded bg-white/70 p-2">
                  <AoP5Corner slot={slot} size={52} title={slot} />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded border border-[#c9922a]/50 bg-white/70 p-4">
            <div className="mb-2 text-[12px] font-semibold">マスター画像からのコーナー（切り出し無し）</div>
            <div className="text-[11px] opacity-80">
              `public/phase5/master.png` を背景にして、そのまま四隅を表示します。
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {(["tl", "tr", "bl", "br"] as const).map((slot) => (
                <div key={slot} className="rounded bg-white/70 p-2">
                  <AoP5CornerMaster slot={slot} size={80} className="rounded" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded border border-[#c9922a]/50 bg-white/70 p-4">
            <div className="mb-2 text-[12px] font-semibold">AoP5DecorativeFrame（corners）</div>
            <AoP5DecorativeFrame cornerSizePx={44} insetPx={4} className="rounded bg-white/70 p-6">
              <div className="ao-p5-parchment-surface ao-p5-gold-frame rounded px-4 py-3">
                <div className="text-[12px] font-semibold">中身は任意</div>
                <div className="text-[11px] opacity-80">コーナーSVGが上に重なるか確認できます。</div>
              </div>
            </AoP5DecorativeFrame>
          </div>
        </section>

        <section className="rounded border border-[#c9922a]/50 bg-white/70 p-4">
          <div className="mb-2 text-[12px] font-semibold">実サイズの確認（小さめ）</div>
          <div className="flex flex-wrap gap-3">
            <AoP5DecorativeFrame cornerSizePx={28} insetPx={2} className="rounded bg-white/70 p-4">
              <div className="ao-p5-parchment-surface ao-p5-gold-frame rounded px-3 py-2 text-[11px]">
                cornerSize 28
              </div>
            </AoP5DecorativeFrame>
            <AoP5DecorativeFrame cornerSizePx={20} insetPx={1} className="rounded bg-white/70 p-4">
              <div className="ao-p5-parchment-surface ao-p5-gold-frame rounded px-3 py-2 text-[11px]">
                cornerSize 20（モバイル想定）
              </div>
            </AoP5DecorativeFrame>
          </div>
        </section>

        {/* =====================================================
            AoP5Bubble 吹き出し確認
            ===================================================== */}
        <section>
          <div className="mb-3 rounded border border-[#c9922a]/60 bg-[#f5edd6] px-3 py-2">
            <div className="text-[13px] font-bold text-[#6a3f0a]">AoP5Bubble（羊皮紙吹き出し）確認</div>
            <div className="text-[11px] opacity-80">
              左向き=AI側 / 右向き=ユーザー側。外枠ウェービー・内枠二重・透過背景（bgColor で設定）
            </div>
          </div>

          {/* 地図背景の上でチャット風に確認 */}
          <div
            className="relative mb-4 overflow-hidden rounded"
            style={{
              backgroundImage: "url('/phase5/map-bg-mobile.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              padding: "20px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {/* AI 発言（左ポインタ・ベージュ背景） */}
            <div className="flex items-start gap-2">
              <div className="mt-1 h-[44px] w-[38px] shrink-0 rounded border border-[#c9922a]/50 bg-[#c9922a]/25" />
              <AoP5Bubble side="left" bgColor="#faf6ee" style={{ maxWidth: 280 }}>
                スブタイより申し上げます。これが古びた羊皮紙調の吹き出しでございます。
              </AoP5Bubble>
            </div>

            {/* ユーザー発言（右ポインタ・白背景） */}
            <div className="flex items-start justify-end gap-2">
              <AoP5Bubble side="right" bgColor="white" style={{ maxWidth: 220 }}>
                承知した。見目は良い。採用する。
              </AoP5Bubble>
              <div className="mt-1 h-[44px] w-[38px] shrink-0 rounded border border-[#c9922a]/50 bg-[#c9922a]/25" />
            </div>

            {/* AI 複数行 */}
            <div className="flex items-start gap-2">
              <div className="mt-1 h-[44px] w-[38px] shrink-0 rounded border border-[#c9922a]/50 bg-[#c9922a]/25" />
              <AoP5Bubble side="left" bgColor="#faf6ee" style={{ maxWidth: 300 }}>
                枠線はウェービーで「端が切れかかった」風合いを再現しております。
                左右辺にはポインタ（突き出し）がございます。
                内側の色は AI 側ベージュ・ユーザー側白で色分けが可能です。
              </AoP5Bubble>
            </div>
          </div>

          {/* サイズ確認（白背景） */}
          <div className="flex flex-wrap gap-6 rounded border border-[#c9922a]/40 bg-white/80 p-4">
            <div className="flex flex-col gap-1">
              <div className="text-[10px] text-[#6a3f0a]">left / bgColor=#faf6ee</div>
              <AoP5Bubble side="left" bgColor="#faf6ee" style={{ width: 200 }}>
                <span className="text-[11px]">短い文章の例</span>
              </AoP5Bubble>
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-[10px] text-[#6a3f0a]">right / bgColor=white</div>
              <AoP5Bubble side="right" bgColor="white" style={{ width: 200 }}>
                <span className="text-[11px]">ユーザー側の吹き出し</span>
              </AoP5Bubble>
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-[10px] text-[#6a3f0a]">left / bgColor なし（透過）</div>
              <div className="rounded bg-[#e8d5b0] p-2">
                <AoP5Bubble side="left" style={{ width: 180 }}>
                  <span className="text-[11px]">親要素の色が透ける</span>
                </AoP5Bubble>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            AoP5ParchmentBubble（画像パーツ組み立て）確認
            ===================================================== */}
        <section>
          <div className="mb-3 rounded border border-[#c9922a]/60 bg-[#f5edd6] px-3 py-2">
            <div className="text-[13px] font-bold text-[#6a3f0a]">
              AoP5ParchmentBubble（画像パーツ組み立て）
            </div>
            <div className="text-[11px] opacity-80">
              parchment_corner / parchment_bubble / parchment_bottom / parchment_right を使用
            </div>
          </div>

          {/* パーツ単体確認 */}
          <div className="mb-4 flex flex-wrap items-end gap-6 rounded border border-[#c9922a]/30 bg-white/70 p-4">
            <div className="flex flex-col items-center gap-1">
              <div className="text-[9px] text-[#6a3f0a]">parchment_corner（53×26）</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/phase5/parchment_corner.png" alt="" width={53} height={26} style={{ imageRendering: "pixelated" }} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="text-[9px] text-[#6a3f0a]">parchment_bubble（更新版）</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/phase5/parchment_bubble.png?v=20260506-2" alt="" width={53} height={50} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="text-[9px] text-[#6a3f0a]">parchment_bottom（53×26）</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/phase5/parchment_bottom.png" alt="" width={106} height={26} style={{ width: 106 }} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="text-[9px] text-[#6a3f0a]">parchment_right（49×34）</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/phase5/parchment_right.png" alt="" width={49} height={34} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="text-[9px] text-[#6a3f0a]">Bubble.png（参考完成図）</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/phase5/parchment_bubble_full.png" alt="" style={{ width: 280, height: "auto" }} />
            </div>
          </div>

          {/* チャット風レイアウト（地図背景） */}
          <div
            className="relative overflow-hidden rounded"
            style={{
              backgroundImage: "url('/phase5/map-bg-mobile.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              padding: "32px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            {/* ① AI 側（ポインタ左上） */}
            <div className="flex items-start gap-3">
              <div className="mt-2 h-[52px] w-[44px] shrink-0 rounded border border-[#c9922a]/50 bg-[#c9922a]/20" />
              <AoP5ParchmentBubble type="ai" style={{ maxWidth: 320 }}>
                スブタイより申し上げます。こちらが画像パーツを組み合わせた羊皮紙調の吹き出しでございます。
                左上に突き出しがあり、AI 側（濃いベージュ）でございます。
              </AoP5ParchmentBubble>
            </div>

            {/* ② ユーザー側（ポインタ右上） */}
            <div className="flex items-start justify-end gap-3">
              <AoP5ParchmentBubble type="user" style={{ maxWidth: 260 }}>
                承知した。右上に突き出しがある。見目は良い。
              </AoP5ParchmentBubble>
              <div className="mt-2 h-[52px] w-[44px] shrink-0 rounded border border-[#c9922a]/50 bg-[#c9922a]/20" />
            </div>

            {/* ③ AI 側（長文） */}
            <div className="flex items-start gap-3">
              <div className="mt-2 h-[52px] w-[44px] shrink-0 rounded border border-[#c9922a]/50 bg-[#c9922a]/20" />
              <AoP5ParchmentBubble type="ai" style={{ maxWidth: 360 }}>
                各角・枠線パーツの変換方向をご確認ください。
                通常角は左上・左下・右下の 3 箇所に配置。
                突き出し角は左上（scaleY -1）で上向き左ポインタになっております。
                ご修正があればお申し付けください。
              </AoP5ParchmentBubble>
            </div>
          </div>
        </section>

        {/* =====================================================
            AoP5NineSliceBubble（AI/ユーザー別9-slice）確認
            ===================================================== */}
        <section className="mt-10">
          <div className="mb-3 rounded border border-[#c9922a]/60 bg-[#f5edd6] px-3 py-2">
            <div className="text-[13px] font-bold text-[#6a3f0a]">
              AoP5NineSliceBubble（AI/ユーザー別パーツ）
            </div>
            <div className="text-[11px] opacity-80">
              `bubble_*` パーツを9-sliceで組み立て。mid は repeat（user:#fff / ai:#F1E8D8）
            </div>
          </div>

          <div
            className="relative overflow-hidden rounded"
            style={{
              backgroundImage: "url('/phase5/map-bg-mobile.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              padding: "32px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 22,
            }}
          >
            {/* AI（左側） */}
            <div className="flex items-start gap-3">
              <div className="mt-2 h-[52px] w-[44px] shrink-0 rounded border border-[#c9922a]/40 bg-[#c9922a]/15" />
              <div className="flex min-w-0 flex-col gap-3">
                <AoP5NineSliceBubble variant="ai" style={{ maxWidth: 420 }}>
                  AI側（影なし）。枠の外は透過、内側は `#F1E8D8`。mid パーツは縦横に繰り返して伸縮します。
                </AoP5NineSliceBubble>
                <AoP5NineSliceBubble
                  variant="ai"
                  style={{
                    maxWidth: 420,
                    // PNG輪郭に沿って左下へ影（x-, y+）
                    filter:
                      "drop-shadow(6px 8px 2px rgba(0,0,0,0.22)) drop-shadow(3px 4px 2px rgba(0,0,0,0.16))",
                  }}
                >
                  AI側（影あり）。地図背景上でどの程度“浮く”か確認用。
                </AoP5NineSliceBubble>
              </div>
            </div>

            {/* User（右側） */}
            <div className="flex items-start justify-end gap-3">
              <div className="flex min-w-0 flex-col items-end gap-3">
                <AoP5NineSliceBubble variant="user" style={{ maxWidth: 360 }}>
                  ユーザー側（影なし）。内側は `#FFFFFF`。
                </AoP5NineSliceBubble>
                <AoP5NineSliceBubble
                  variant="user"
                  style={{
                    maxWidth: 360,
                    // PNG輪郭に沿って左下へ影（x-, y+）
                    filter:
                      "drop-shadow(6px 8px 2px rgba(0,0,0,0.22)) drop-shadow(3px 4px 2px rgba(0,0,0,0.16))",
                  }}
                >
                  ユーザー側（影あり）。輪郭が黒く沈むか／読みやすくなるか確認用。
                </AoP5NineSliceBubble>
              </div>
              <div className="mt-2 h-[52px] w-[44px] shrink-0 rounded border border-[#c9922a]/40 bg-[#c9922a]/15" />
            </div>
          </div>
        </section>

        {/* =====================================================
            AoP5PortraitFrame（画像ベース額縁＋ネームプレート）
            ===================================================== */}
        <section className="mt-10">
          <div className="mb-3 rounded border border-[#c9922a]/60 bg-[#f5edd6] px-3 py-2">
            <div className="text-[13px] font-bold text-[#6a3f0a]">AoP5PortraitFrame（photoframe_sm + nameplate_sm）</div>
            <div className="text-[11px] opacity-80">
              コーナー右下基準 → 各方向回転。サイド上下反転／左-90°／右+90°。ネームプレート左右キャップ。
            </div>
          </div>

          {/* AO 実寸：顔グラ + tight ネームプレート（文字すぐ外に枠） */}
          <div className="mb-4 rounded border border-[#784b0f]/40 bg-[#fdfaf3] p-4">
            <div className="mb-2 text-[12px] font-bold text-[#6a3f0a]">
              AO 実寸プレビュー（顔 {AO_PORTRAIT_LAYOUT_W_PX}×{AO_PREVIEW_PORTRAIT_H_PX}px／名前 {AO_PREVIEW_NAME_FONT_PX}px・tight）
            </div>
            <div className="mb-3 text-[11px] text-[#6a3f0a]/85">
              `tight`: 文字列長（最大7文字）に合わせてプレート幅・高さを詰め、コーナー・四辺をそのすぐ外側に配置します。
            </div>
            <div className="flex flex-wrap items-end justify-around gap-10">
              <div className="flex flex-col items-center gap-1.5">
                <div className="rounded bg-black/20 px-2 py-0.5 text-[10px] text-[#3a1f05]">短い名前</div>
                <AoP5PortraitFrameC
                  src="/personas/juci.png"
                  name="ジュチ"
                  width={AO_PORTRAIT_LAYOUT_W_PX}
                  height={AO_PREVIEW_PORTRAIT_H_PX}
                />
                <AoP5NameplateSm
                  width={AO_PORTRAIT_LAYOUT_W_PX}
                  text="ジュチ"
                  tight
                  fontSizePx={AO_PREVIEW_NAME_FONT_PX}
                />
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <div className="rounded bg-black/20 px-2 py-0.5 text-[10px] text-[#3a1f05]">7文字相当</div>
                <AoP5PortraitFrameC
                  src="/personas/AO_Char_Mongkeur.png"
                  name="モンケウール"
                  width={AO_PORTRAIT_LAYOUT_W_PX}
                  height={AO_PREVIEW_PORTRAIT_H_PX}
                />
                <AoP5NameplateSm
                  width={AO_PORTRAIT_LAYOUT_W_PX}
                  text="モンケウール"
                  tight
                  fontSizePx={AO_PREVIEW_NAME_FONT_PX}
                />
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <div className="rounded bg-black/20 px-2 py-0.5 text-[10px] text-[#3a1f05]">比較（従来・余白多め）</div>
                <AoP5PortraitFrameC
                  src="/personas/AO_Char_Baiju.png"
                  name="バイジュ"
                  width={AO_PORTRAIT_LAYOUT_W_PX}
                  height={AO_PREVIEW_PORTRAIT_H_PX}
                />
                <AoP5NameplateSm width={AO_PORTRAIT_LAYOUT_W_PX} text="バイジュ" fontSizePx={AO_PREVIEW_NAME_FONT_PX} />
              </div>
            </div>
          </div>

          {/* パターンC（顔枠） + 既存ネームプレート（画像） */}
          <div className="mb-4 rounded border border-[#c9922a]/30 bg-white/70 p-4">
            <div className="mb-3 text-[11px] font-semibold text-[#6a3f0a]">
              追加プレビュー：顔枠=パターンC（濃い金） / 名前=画像ネームプレート（縦を高くして可読性UP）
            </div>
            <div className="flex flex-wrap items-end justify-around gap-10">
              <div className="flex flex-col items-center gap-2">
                <div className="rounded bg-black/30 px-2 py-0.5 text-[10px] text-white/90">40×50px（指定）</div>
                <AoP5PortraitFrameC src="/personas/AO_Char_Hunan.png" name="フナン" width={40} height={50} />
                <AoP5NameplateSm width={40} text="フナン" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="rounded bg-black/30 px-2 py-0.5 text-[10px] text-white/90">60×75px</div>
                <AoP5PortraitFrameC src="/personas/AO_Char_Qete.png" name="ケテ" width={60} height={75} />
                <AoP5NameplateSm width={60} text="ケテ" />
              </div>
            </div>
          </div>

          {/* Face_Mid + Name_SM（殿下指定の組み方） */}
          <div className="mb-4 rounded border border-[#784b0f]/40 bg-[#fdfaf3] p-4">
            <div className="mb-2 text-[12px] font-bold text-[#6a3f0a]">新プレビュー：Face_Mid + Name_SM（タタ・トゥンガ）</div>
            <div className="mb-3 text-[11px] text-[#6a3f0a]/85">
              顔= `face_mid_sm_*`（四隅+四辺タイル）／名前= `name_sm_*`（7文字相当）
            </div>
            <div className="flex flex-wrap items-end justify-around gap-10">
              <div className="flex flex-col items-center gap-2">
                <div className="rounded bg-black/20 px-2 py-0.5 text-[10px] text-[#3a1f05]">60×75px</div>
                <AoP5FaceFrameMid src="/personas/AO_Char_TataTunga.png" alt="タタ・トゥンガ" width={60} height={75} />
                <AoP5NameplateSmFrame width={60} text="タタ・トゥンガ" maxChars={7} fontSizePx={10} />
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="rounded bg-black/20 px-2 py-0.5 text-[10px] text-[#3a1f05]">40×50px</div>
                <AoP5FaceFrameMid src="/personas/AO_Char_TataTunga.png" alt="タタ・トゥンガ" width={40} height={50} />
                <AoP5NameplateSmFrame width={40} text="タタ・トゥンガ" maxChars={7} fontSizePx={10} />
              </div>
            </div>
          </div>

          {/* 地図背景の上で確認 */}
          <div
            className="mb-4 flex flex-wrap items-end justify-around gap-8 rounded p-8"
            style={{
              backgroundImage: "url('/phase5/map-bg-mobile.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {/* バイジュ（バイジュ）— 実寸に近い小サイズ */}
            <div className="flex flex-col items-center gap-1">
              <div className="mb-1 rounded bg-black/30 px-2 py-0.5 text-[10px] text-white/90">39×49px（実寸）</div>
              <AoP5PortraitFrame src="/personas/AO_Char_Baiju.png" name="バイジュ" width={39} height={49} />
            </div>

            {/* ケテ — 少し大きめ */}
            <div className="flex flex-col items-center gap-1">
              <div className="mb-1 rounded bg-black/30 px-2 py-0.5 text-[10px] text-white/90">60×75px</div>
              <AoP5PortraitFrame src="/personas/AO_Char_Qete.png" name="ケテ" width={60} height={75} />
            </div>

            {/* フナン — プレビュー用標準サイズ */}
            <div className="flex flex-col items-center gap-1">
              <div className="mb-1 rounded bg-black/30 px-2 py-0.5 text-[10px] text-white/90">80×100px</div>
              <AoP5PortraitFrame src="/personas/AO_Char_Hunan.png" name="フナン" width={80} height={100} />
            </div>

            {/* モンケウール — 大きめ */}
            <div className="flex flex-col items-center gap-1">
              <div className="mb-1 rounded bg-black/30 px-2 py-0.5 text-[10px] text-white/90">100×125px</div>
              <AoP5PortraitFrame src="/personas/AO_Char_Mongkeur.png" name="モンケウール" width={100} height={125} />
            </div>
          </div>

          {/* 白背景でも確認 */}
          <div className="flex flex-wrap items-end justify-around gap-6 rounded border border-[#c9922a]/30 bg-white/90 p-6">
            <div className="w-full text-[10px] text-[#6a3f0a]">白背景での見栄え確認</div>
            <AoP5PortraitFrame src="/personas/AO_Char_Baiju.png" name="バイジュ" width={39} height={49} />
            <AoP5PortraitFrame src="/personas/AO_Char_Qete.png" name="ケテ" width={60} height={75} />
            <AoP5PortraitFrame src="/personas/AO_Char_Hunan.png" name="フナン" width={80} height={100} />
            <AoP5PortraitFrame src="/personas/AO_Char_Mongkeur.png" name="モンケウール" width={100} height={125} />
          </div>
        </section>

        {/* =====================================================
            AoP5PortraitCard 額縁＋名前プレート 3パターン確認
            ===================================================== */}
        <section className="mt-10">
          <div className="mb-3 rounded border border-[#c9922a]/60 bg-[#f5edd6] px-3 py-2">
            <div className="text-[13px] font-bold text-[#6a3f0a]">AoP5PortraitCard（額縁＋名前プレート）3パターン</div>
            <div className="text-[11px] opacity-80">
              A=シンプル軍事（Lブラケット） / B=羊皮紙風（八角形） / C=重厚紋章（二重枠+大ダイアモンド）
            </div>
          </div>

          {/* 地図背景の上で確認 */}
          <div
            className="mb-4 flex flex-wrap items-end justify-around gap-10 rounded p-8"
            style={{
              backgroundImage: "url('/phase5/map-bg-mobile.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {(["A", "B", "C"] as const).map((v) => (
              <div key={v} className="flex flex-col items-center gap-3">
                <div className="rounded bg-black/30 px-2 py-0.5 text-[10px] text-white/90">
                  {v === "A" ? "A: シンプル軍事" : v === "B" ? "B: 羊皮紙風" : "C: 重厚紋章"}
                </div>
                <div className="flex flex-col items-center gap-4">
                  <AoP5PortraitCard
                    variant={v}
                    src="/personas/AO_Char_Hunan.png"
                    name="フナン"
                    width={70}
                    height={88}
                  />
                  <AoP5PortraitCard
                    variant={v}
                    src="/personas/AO_Char_Mongkeur.png"
                    name="モンケウール"
                    caption="第二の千戸長"
                    width={90}
                    height={112}
                  />
                  <AoP5PortraitCard
                    variant={v}
                    src="/personas/juci.png"
                    name="ジュチ"
                    caption="邦　主"
                    width={80}
                    height={100}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* 白背景でも確認 */}
          <div className="flex flex-wrap items-end justify-around gap-8 rounded border border-[#c9922a]/30 bg-white/80 p-6">
            <div className="w-full text-[10px] text-[#6a3f0a]">白背景での見栄え確認</div>
            {(["A", "B", "C"] as const).map((v) => (
              <AoP5PortraitCard
                key={v}
                variant={v}
                src="/personas/AO_Char_Baiju.png"
                name="バイジュ"
                caption="第四の千戸長"
                width={80}
                height={100}
              />
            ))}
          </div>
        </section>

        {/* =====================================================
            金属プレート刻印（CSSのみ）プレビュー
            ===================================================== */}
        <section className="mt-10">
          <div className="mb-3 rounded border border-[#c9922a]/60 bg-[#f5edd6] px-3 py-2">
            <div className="text-[13px] font-bold text-[#6a3f0a]">「大会盟」刻印テキスト（CSSのみ）プレビュー</div>
            <div className="text-[11px] opacity-80">凹（彫り込み）/ 凸（浮き出し）/ 深め刻印 / 反射グロー</div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              { label: "engraved（凹）", cls: "ao-p5-goldplate-text ao-p5-goldplate-engraved" },
              { label: "embossed（凸）", cls: "ao-p5-goldplate-text ao-p5-goldplate-embossed" },
              { label: "stamped（深め）", cls: "ao-p5-goldplate-text ao-p5-goldplate-stamped" },
              { label: "glint（反射）", cls: "ao-p5-goldplate-text ao-p5-goldplate-glint" },
              { label: "deboss dark（凹＋暗）", cls: "ao-p5-goldplate-text ao-p5-goldplate-deboss-dark" },
              { label: "deboss brown（焦げ茶）", cls: "ao-p5-goldplate-text ao-p5-goldplate-deboss-brown" },
              { label: "deboss blue-black（黒青）", cls: "ao-p5-goldplate-text ao-p5-goldplate-deboss-blueblack" },
              { label: "deboss verdigris（暗緑）", cls: "ao-p5-goldplate-text ao-p5-goldplate-deboss-verdigris" },
            ].map((v) => (
              <div key={v.label} className="rounded border border-[#c9922a]/50 bg-white/70 p-4">
                <div className="mb-2 text-[12px] font-semibold text-[#6a3f0a]">{v.label}</div>
                <div className="flex items-center gap-3">
                  <div
                    className="ao-p5-goldplate-dull-bg rounded-sm px-4 py-2"
                  >
                    <span className={v.cls} style={{ fontFamily: "Georgia, serif", fontWeight: 800, fontSize: 20 }}>
                      大会盟
                    </span>
                  </div>
                  <div className="text-[11px] text-[#6a3f0a]/80">背景は疑似の金属板（CSS）。</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* =====================================================
            Google案：多色ゴールド斜めグラデ板 + 掘り込み文字
            ===================================================== */}
        <section className="mt-10">
          <div className="mb-3 rounded border border-[#c9922a]/60 bg-[#f5edd6] px-3 py-2">
            <div className="text-[13px] font-bold text-[#6a3f0a]">Google案：ゴールド板＋掘り込み文字（CSSのみ）</div>
            <div className="text-[11px] opacity-80">linear-gradient(135deg) の多色ゴールド＋ text-shadow 上白／下黒</div>
          </div>

          <div className="rounded border border-[#c9922a]/50 bg-white/70 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="ao-p5-goldplate-google-bg flex h-[64px] w-[220px] items-center justify-center px-4">
                <span
                  className="ao-p5-goldplate-google-engraved"
                  style={{ fontFamily: "Georgia, serif", fontWeight: 900, fontSize: 22, letterSpacing: "0.12em" }}
                >
                  大会盟
                </span>
              </div>
              <div className="text-[11px] text-[#6a3f0a]/80">
                これを基準に、くすみ金属・暗色刻印へ寄せるのが筋です。
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            濃茶レザー「型抜き／焼き印」（CSSのみ）プレビュー
            ===================================================== */}
        <section className="mt-10">
          <div className="mb-3 rounded border border-[#c9922a]/60 bg-[#f5edd6] px-3 py-2">
            <div className="text-[13px] font-bold text-[#6a3f0a]">濃茶レザー「型抜き／焼き印」（CSSのみ）プレビュー</div>
            <div className="text-[11px] opacity-80">枠が金系でも“しつこくない”方向（濃茶ベース）</div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              { label: "cutout（型抜き）", cls: "ao-p5-leather-text ao-p5-leather-cutout" },
              { label: "deboss（焼き印）", cls: "ao-p5-leather-text ao-p5-leather-deboss" },
              { label: "deboss ivory（凹＋白寄り）", cls: "ao-p5-leather-text ao-p5-leather-deboss-ivory" },
              { label: "cutout strong（視認性）", cls: "ao-p5-leather-text ao-p5-leather-cutout-strong" },
            ].map((v) => (
              <div key={v.label} className="rounded border border-[#c9922a]/50 bg-white/70 p-4">
                <div className="mb-2 text-[12px] font-semibold text-[#6a3f0a]">{v.label}</div>
                <div className="flex items-center gap-3">
                  <div
                    className="rounded-sm border border-[#2a1207]/60 px-4 py-2"
                    style={{
                      background:
                        "radial-gradient(120% 90% at 30% 10%, rgba(255,255,255,0.10), transparent 55%)," +
                        "radial-gradient(90% 70% at 80% 90%, rgba(0,0,0,0.25), transparent 60%)," +
                        "repeating-linear-gradient(25deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 4px)," +
                        "linear-gradient(180deg, rgba(92,42,10,0.95) 0%, rgba(61,28,8,0.96) 55%, rgba(35,16,5,0.98) 100%)",
                      boxShadow:
                        "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.35), 0 6px 16px rgba(0,0,0,0.22)",
                    }}
                  >
                    <span className={v.cls} style={{ fontFamily: "Georgia, serif", fontWeight: 800, fontSize: 20 }}>
                      大会盟
                    </span>
                  </div>
                  <div className="text-[11px] text-[#6a3f0a]/80">背景は疑似レザー（CSS）。</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

