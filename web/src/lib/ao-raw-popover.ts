/** Raw プロンプトチップの位置計算（チャット履歴 DOM） */
/** Raw ポップオーバー：以前の上限の約 50％（Y のみ） */
export const RAW_POPOVER_MAX_H_OUTER = "min(37vh,250px)";
export const RAW_POPOVER_MAX_H_SCROLL = "min(34vh,230px)";
export const RAW_POPOVER_W = 320;
export const RAW_POPOVER_FS_CHIP_PX = 8;

/** スマホ・ユーザー Raw：上端はユーザー吹き出しに合わせ、幅は AI 吹き出し幅・右端はユーザー吹き出し右端。高さは AI 側チップ同様に固定。 */
export function aoCompactUserRawPanelRect(messagesRoot: HTMLElement, msgId: string): {
  top: number;
  left: number;
  width: number;
  height: number;
} | null {
  const esc = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(msgId) : msgId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const row = messagesRoot.querySelector(`[data-ao-msg-id="${esc}"]`);
  if (!(row instanceof HTMLElement)) return null;
  const userBubble = row.querySelector("[data-ao-chat-bubble]");
  if (!(userBubble instanceof HTMLElement)) return null;
  let aiBubbleEl: Element | null = null;
  let cand: Element | null = row.nextElementSibling;
  while (cand) {
    if (cand instanceof HTMLElement && cand.matches("[data-ao-chat-row]")) {
      // ユーザー行は data-ao-chat-side=user。直後のユーザー連続はスキップする。
      if (cand.getAttribute("data-ao-chat-side") !== "user") {
        aiBubbleEl = cand.querySelector("[data-ao-chat-bubble]");
        break;
      }
    }
    cand = cand.nextElementSibling;
  }
  const ub = userBubble.getBoundingClientRect();
  const gap = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  if (!(aiBubbleEl instanceof HTMLElement)) {
    const w = Math.min(RAW_POPOVER_W, vw - 16);
    const h = Math.min(vh * 0.37, 250);
    return {
      top: Math.max(gap, ub.top),
      left: Math.max(gap, Math.min(ub.right - w, vw - w - gap)),
      width: w,
      height: Math.min(h, vh - Math.max(gap, ub.top) - gap),
    };
  }
  const ab = aiBubbleEl.getBoundingClientRect();
  const width = Math.max(120, Math.round(ab.width));
  const fixedPanelH = Math.min(Math.round(vh * 0.37), 250);
  let left = Math.round(ub.right - width);
  left = Math.max(gap, Math.min(left, vw - width - gap));
  let top = Math.round(ub.top);
  top = Math.max(gap, Math.min(top, vh - fixedPanelH - gap));
  const height = Math.min(fixedPanelH, vh - top - gap);
  return {
    top,
    left,
    width,
    height: Math.max(120, height),
  };
}

export function placeRawPromptPopover(opts: {
  anchorRect: DOMRect;
  /** 狭ビュー：横の基準は anchorRect（顔グラ）、縦はこの矩形の中央（チャット吹き出しの実測） */
  verticalAnchorRect?: DOMRect;
  /** 狭ビュー・AI 側：右に置けないとき左へ逃がす下限（顔グラ右端＋余白）。無いとき従来どおり吹き出し左基準で逃がす */
  compactAvatarRect?: DOMRect;
  side: "ai" | "user";
  popoverWidth: number;
  popoverHeight: number;
  /** verticalAnchorRect が無い狭ビュー向けフォールバック */
  compactAlignBubbleMid?: boolean;
  bubbleMinHeightPx?: number;
}): { top: number; left: number } {
  const gap = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  let left =
    opts.side === "ai" ? opts.anchorRect.right + gap : opts.anchorRect.left - opts.popoverWidth - gap;

  if (opts.side === "ai" && left + opts.popoverWidth > vw - gap) {
    const minLeftFromAvatar = opts.compactAvatarRect ? opts.compactAvatarRect.right + gap : gap;
    const flushRight = vw - opts.popoverWidth - gap;
    if (flushRight >= minLeftFromAvatar) {
      left = flushRight;
    } else {
      left = clamp(minLeftFromAvatar, gap, vw - opts.popoverWidth - gap);
    }
  }
  if (opts.side === "user" && left < gap) {
    left = clamp(opts.anchorRect.right + gap, gap, vw - opts.popoverWidth - gap);
  }
  left = clamp(left, gap, vw - opts.popoverWidth - gap);

  let top: number;
  if (opts.verticalAnchorRect) {
    const vr = opts.verticalAnchorRect;
    const midY = vr.top + vr.height / 2;
    top = clamp(midY - opts.popoverHeight / 2, gap, vh - opts.popoverHeight - gap);
  } else if (opts.compactAlignBubbleMid && opts.bubbleMinHeightPx != null && opts.bubbleMinHeightPx > 0) {
    const midY = opts.anchorRect.top + opts.bubbleMinHeightPx / 2;
    top = clamp(midY - opts.popoverHeight / 2, gap, vh - opts.popoverHeight - gap);
  } else {
    top = clamp(opts.anchorRect.top, gap, vh - opts.popoverHeight - gap);
  }
  return { left, top };
}
