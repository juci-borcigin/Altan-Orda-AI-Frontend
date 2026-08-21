/**
 * 狭ビュー判定と邦主ドロワーのスワイプ。
 * `globals.css` の `.ao-mobile-stack-scale`（max-width:767px）と揃える。
 */

export const AO_MOBILE_MAX_CSS_PX = 767;

export const AO_COMPACT_KIN_HORIZONTAL_SWIPE_MIN_DX = 48;
export const AO_COMPACT_KIN_HORIZONTAL_DOMINANCE_RATIO = 1.12;
export const AO_COMPACT_KIN_H_SWIPE_EDGE_EXCLUDE_RATIO = 0.18;
export const AO_COMPACT_KIN_H_SWIPE_LEFT_OPEN_ZONE_RATIO = 0.28;

export const AO_Z_RAW_BACKDROP = 2_147_483_643;
export const AO_Z_RAW_PANEL = 2_147_483_644;

export const AO_Z_COMPACT_HEADER = 40;
export const AO_Z_COMPACT_KIN_DRAWER_HOST = 30;
export const AO_Z_COMPACT_KIN_DRAWER_OPEN = 45;
export const AO_Z_COMPACT_MAP_STACK = 25;
export const AO_Z_COMPACT_MAIN = 20;
export const AO_Z_COMPACT_CHAT = 10;

function aoIsProbablyMobileUa(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = (navigator.userAgent || "").toLowerCase();
  const isIpad = ua.includes("ipad");
  if (isIpad) return false;
  return (
    ua.includes("iphone") ||
    ua.includes("ipod") ||
    (ua.includes("android") && ua.includes("mobile")) ||
    ua.includes("windows phone")
  );
}

function aoIsProbablyPhoneLikeDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const touch = typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : 0;
  if (touch <= 0) return false;
  const sw = typeof window.screen?.width === "number" ? window.screen.width : window.innerWidth;
  const sh = typeof window.screen?.height === "number" ? window.screen.height : window.innerHeight;
  const short = Math.min(sw, sh);
  return short > 0 && short <= 520;
}

let aoViewportCompactClientReady = false;

function readAoViewportCompactFromWindow(): boolean {
  try {
    const byWidth = window.matchMedia(`(max-width: ${AO_MOBILE_MAX_CSS_PX}px)`).matches;
    if (byWidth) return true;
    if (aoIsProbablyMobileUa()) return true;
    return aoIsProbablyPhoneLikeDevice();
  } catch {
    if (window.innerWidth <= AO_MOBILE_MAX_CSS_PX) return true;
    if (aoIsProbablyMobileUa()) return true;
    return aoIsProbablyPhoneLikeDevice();
  }
}

/** 実画面の高さ（PWA の dvh 不足・ホーム画面余白対策）。未設定時は CSS の 100lvh。 */
export function syncAoAppViewportCssVar(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const vv = window.visualViewport;
  const h = Math.max(
    vv && typeof vv.height === "number" ? vv.height : 0,
    window.innerHeight || 0,
    document.documentElement?.clientHeight ?? 0,
  );
  if (h > 0) {
    document.documentElement.style.setProperty("--ao-app-h", `${Math.round(h)}px`);
  }
}

export function subscribeAoViewportCompact(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    syncAoAppViewportCssVar();
    onStoreChange();
  };
  const timers: number[] = [];
  const rafs: number[] = [];
  syncAoAppViewportCssVar();

  const enableClientSnapshot = () => {
    if (aoViewportCompactClientReady) return;
    aoViewportCompactClientReady = true;
    handler();
  };

  rafs.push(
    window.requestAnimationFrame(() => {
      rafs.push(window.requestAnimationFrame(enableClientSnapshot));
    }),
  );
  timers.push(window.setTimeout(enableClientSnapshot, 0));
  timers.push(window.setTimeout(handler, 60));
  timers.push(window.setTimeout(handler, 240));

  window.addEventListener("resize", handler);
  window.addEventListener("orientationchange", handler);
  window.addEventListener("pageshow", handler);
  const vv = window.visualViewport;
  if (vv && typeof vv.addEventListener === "function") {
    vv.addEventListener("resize", handler);
    vv.addEventListener("scroll", handler);
  }

  let mq: MediaQueryList | null = null;
  let mqCleanup: (() => void) | null = null;
  try {
    mq = window.matchMedia(`(max-width: ${AO_MOBILE_MAX_CSS_PX}px)`);
    const legacyMq = mq as MediaQueryList & {
      addListener?: (listener: (ev: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (ev: MediaQueryListEvent) => void) => void;
    };
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", handler);
      mqCleanup = () => mq?.removeEventListener("change", handler);
    } else if (typeof legacyMq.addListener === "function" && typeof legacyMq.removeListener === "function") {
      legacyMq.addListener(handler);
      mqCleanup = () => legacyMq.removeListener?.(handler);
    }
  } catch {
    mqCleanup = null;
  }

  return () => {
    for (const id of timers) window.clearTimeout(id);
    for (const id of rafs) window.cancelAnimationFrame(id);
    window.removeEventListener("resize", handler);
    window.removeEventListener("orientationchange", handler);
    window.removeEventListener("pageshow", handler);
    if (vv && typeof vv.removeEventListener === "function") {
      vv.removeEventListener("resize", handler);
      vv.removeEventListener("scroll", handler);
    }
    mqCleanup?.();
  };
}

export function getAoViewportCompactSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  if (!aoViewportCompactClientReady) return getAoViewportCompactServerSnapshot();
  return readAoViewportCompactFromWindow();
}

export function getAoViewportCompactServerSnapshot(): boolean {
  return false;
}

export function aoKinDrawerSwipeTargetDisallowsEdgeSwipe(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("button,a,input,textarea,select,label,[role='button'],[contenteditable='true']"),
  );
}

function aoKinTouchStartXInCenterSwipeBand(clientX: number, vw: number): boolean {
  const edge = vw * AO_COMPACT_KIN_H_SWIPE_EDGE_EXCLUDE_RATIO;
  return clientX >= edge && clientX <= vw - edge;
}

export function aoKinTouchStartCanOpenDrawer(clientX: number, vw: number): boolean {
  if (clientX <= vw * AO_COMPACT_KIN_H_SWIPE_LEFT_OPEN_ZONE_RATIO) return true;
  return aoKinTouchStartXInCenterSwipeBand(clientX, vw);
}

export function aoKinTouchStartCanCloseDrawer(clientX: number, vw: number): boolean {
  const rightEdge = vw * AO_COMPACT_KIN_H_SWIPE_EDGE_EXCLUDE_RATIO;
  return clientX <= vw - rightEdge;
}

export function aoKinCenterSwipeOpensDrawer(dx: number, dy: number): boolean {
  const minAbs = AO_COMPACT_KIN_HORIZONTAL_SWIPE_MIN_DX;
  if (Math.abs(dx) < minAbs) return false;
  if (Math.abs(dx) < Math.abs(dy) * AO_COMPACT_KIN_HORIZONTAL_DOMINANCE_RATIO) return false;
  return dx > 0;
}

export function aoKinCenterSwipeClosesDrawer(dx: number, dy: number): boolean {
  const minAbs = AO_COMPACT_KIN_HORIZONTAL_SWIPE_MIN_DX;
  if (Math.abs(dx) < minAbs) return false;
  if (Math.abs(dx) < Math.abs(dy) * AO_COMPACT_KIN_HORIZONTAL_DOMINANCE_RATIO) return false;
  return dx < 0;
}

/** CSS zoom 実効値。getBoundingClientRect を layout px に戻すときに使う。 */
export function aoCssZoomFromElement(el: HTMLElement | null): number {
  if (!el) return 1;
  const layoutW = el.offsetWidth;
  const visualW = el.getBoundingClientRect().width;
  if (layoutW <= 0 || visualW <= 0) return 1;
  const z = visualW / layoutW;
  return z > 0.2 && z < 2.5 ? z : 1;
}

export function aoKinCompactKinSwipeContentTopPx(
  headerEl: HTMLElement | null,
  frameStripEl: HTMLElement | null,
): number {
  const hb = headerEl?.getBoundingClientRect().bottom ?? 0;
  const fb = frameStripEl?.getBoundingClientRect().bottom ?? 0;
  return Math.max(hb, fb);
}
