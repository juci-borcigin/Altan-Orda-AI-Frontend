"use client";

import type { ReactNode } from "react";
import { AoP5NameplateSmFrame } from "@/components/ao-phase5";
import {
  aoMainChatNameplateOuterWidthPx,
  CHAT_NAMEPLATE_MIN_W_PX,
  MAIN_CHAT_NAMEPLATE_OPTS,
} from "@/lib/ao-kin-layout";

export function AoChatAiAvatarStack({ face, label }: { face: ReactNode; label: string }) {
  const stackW = aoMainChatNameplateOuterWidthPx(label);
  return (
    <div className="flex flex-col items-stretch gap-0" style={{ width: stackW }}>
      <div className="flex w-full justify-center">{face}</div>
      <AoP5NameplateSmFrame
        width={CHAT_NAMEPLATE_MIN_W_PX}
        text={label}
        {...MAIN_CHAT_NAMEPLATE_OPTS}
      />
    </div>
  );
}
