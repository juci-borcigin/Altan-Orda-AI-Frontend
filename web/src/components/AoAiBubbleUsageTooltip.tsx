"use client";

import type { ReactNode } from "react";
import type { MsgTurnUsage } from "@/lib/ao-state";
import { estimateUsdFromTokensClient } from "@/lib/ao-usage-estimate-client";

function resolveUsd(u: MsgTurnUsage): number | null {
  return u.estimatedUsd ?? estimateUsdFromTokensClient(u.promptTokens, u.completionTokens);
}

/** AI 吹き出し用ホバー（ネイティブ title の代わり・1行目太字） */
export function AoAiBubbleUsageTooltip({ usage, children }: { usage?: MsgTurnUsage; children: ReactNode }) {
  if (!usage) return <>{children}</>;
  const usd = resolveUsd(usage);
  const usdStr = usd != null ? `$${usd.toFixed(6)}` : "—";

  return (
    <div className="group relative max-w-full">
      {children}
      <div
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-0 z-[60] mb-1 min-w-[14rem] max-w-[min(90vw,22rem)] rounded border border-[#DBB961]/45 bg-[#142c42]/96 px-2 py-1.5 font-serif text-[11px] leading-snug text-[#FAF3E6] opacity-0 shadow-lg backdrop-blur-[2px] transition-opacity duration-100 group-hover:visible group-hover:opacity-100"
      >
        <div className="font-bold text-[#FAF3E6]">モデル: {usage.modelId}</div>
        <div>
          概算USD: <span className="tabular-nums">{usdStr}</span>
        </div>
        <div className="tabular-nums">
          トークン: 入力 {usage.promptTokens}/出力 {usage.completionTokens}/計 {usage.totalTokens}
        </div>
      </div>
    </div>
  );
}
