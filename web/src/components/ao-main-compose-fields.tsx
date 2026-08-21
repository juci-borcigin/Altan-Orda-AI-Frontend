"use client";

import {
  useCallback,
  useLayoutEffect,
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";

export function AoMainComposeTextarea({
  textareaRef,
  value,
  readOnly,
  composeLocked,
  onChange,
  onKeyDown,
  onPaste,
  placeholder,
  fontSizePx,
  visualScale,
  autoGrow = false,
  minHeightPx = 24,
  growDeps = 0,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  readOnly: boolean;
  composeLocked: boolean;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: ReactClipboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  fontSizePx: number;
  visualScale: number;
  autoGrow?: boolean;
  minHeightPx?: number;
  growDeps?: number;
}) {
  const syncAutoGrowHeight = useCallback(() => {
    if (!autoGrow) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.overflow = "hidden";
    el.style.height = "0px";
    const next = Math.max(minHeightPx, el.scrollHeight);
    el.style.height = `${next}px`;
  }, [autoGrow, minHeightPx, textareaRef]);

  useLayoutEffect(() => {
    syncAutoGrowHeight();
  }, [value, syncAutoGrowHeight, fontSizePx, visualScale, growDeps]);

  const textarea = (
    <textarea
      ref={textareaRef}
      suppressHydrationWarning
      value={value}
      readOnly={readOnly}
      onChange={(e) => {
        onChange(e);
        if (autoGrow) requestAnimationFrame(syncAutoGrowHeight);
      }}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      placeholder={placeholder}
      rows={autoGrow ? 1 : undefined}
      className={`box-border w-full resize-none rounded-none border-0 bg-transparent font-serif text-[#1a1208] outline-none ring-0 focus:ring-0 ${
        autoGrow ? "block overflow-hidden" : "min-h-0 flex-1 overflow-y-auto"
      } ${composeLocked ? "cursor-not-allowed opacity-60" : ""}`}
      style={{
        padding: "0px",
        fontSize: fontSizePx,
        ...(autoGrow ? { minHeight: minHeightPx } : {}),
      }}
    />
  );

  if (visualScale >= 1) {
    return textarea;
  }

  const invPct = 100 / visualScale;
  return (
    <div className={`w-full ${autoGrow ? "overflow-visible" : "h-full min-h-0 overflow-hidden"}`}>
      <div
        className={autoGrow ? "flex w-full flex-col" : "flex h-full min-h-0 w-full flex-col"}
        style={{
          transform: `scale(${visualScale})`,
          transformOrigin: "top left",
          width: `${invPct}%`,
          ...(autoGrow ? {} : { height: `${invPct}%` }),
        }}
      >
        {textarea}
      </div>
    </div>
  );
}

export function AoMainTitleInput({
  inputRef,
  value,
  onChange,
  onBlur,
  visualFs,
  useCompactNoZoom,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  visualFs: number;
  useCompactNoZoom: boolean;
}) {
  const fontSizePx = visualFs;
  return (
    <input
      ref={inputRef}
      suppressHydrationWarning
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      className={`min-h-0 w-full min-w-0 rounded-none border-0 bg-transparent py-0 text-center font-serif font-semibold leading-tight text-[#3D1C08] outline-none ring-0 placeholder:text-[#3D1C08]/45 focus:ring-0 ${useCompactNoZoom ? "px-0" : "px-2"}`}
      style={{ fontSize: fontSizePx }}
    />
  );
}
