import type { CSSProperties } from "react";
import type { TopicUiId } from "@/lib/ao-topics";
import {
  AO_PUSH_INSET_RON_TAB_KURULTAI,
  AO_PUSH_INSET_RON_TAB_OTHER,
  AO_RON_TAB_FONT_PX,
  AO_RON_TAB_PAD_X_OVERLAY_PX,
  AO_RON_TAB_PAD_X_PX,
  AO_RON_TAB_PAD_Y_OVERLAY_PX,
  AO_RON_TAB_PAD_Y_PX,
} from "@/lib/ao-kin-layout";

export function aoRonTabInlineStyle(_tpId: TopicUiId, _on: boolean): CSSProperties {
  return {
    fontSize: AO_RON_TAB_FONT_PX,
    paddingLeft: AO_RON_TAB_PAD_X_PX,
    paddingRight: AO_RON_TAB_PAD_X_PX,
    paddingTop: AO_RON_TAB_PAD_Y_PX,
    paddingBottom: AO_RON_TAB_PAD_Y_PX,
  };
}

export function aoRonTabInlineStyleOverlay(_tpId: TopicUiId, _on: boolean): CSSProperties {
  return {
    fontSize: AO_RON_TAB_FONT_PX,
    paddingLeft: AO_RON_TAB_PAD_X_OVERLAY_PX,
    paddingRight: AO_RON_TAB_PAD_X_OVERLAY_PX,
    paddingTop: AO_RON_TAB_PAD_Y_OVERLAY_PX,
    paddingBottom: AO_RON_TAB_PAD_Y_OVERLAY_PX,
  };
}

export function aoRonTabLabelOffsetClass(on: boolean): string {
  return `inline-block transition-none ${on ? "translate-x-px translate-y-px" : "translate-x-0 translate-y-0"}`;
}

export function aoRonTabClasses(tpId: TopicUiId, on: boolean) {
  const core = "rounded-none font-semibold font-serif box-border transition-none border border-transparent";
  if (tpId === "kurultai") {
    return `${core} bg-[#DBB961] text-[#133D5C] ${on ? AO_PUSH_INSET_RON_TAB_KURULTAI : ""}`;
  }
  if (on) return `${core} bg-transparent text-[#DBB961] ${AO_PUSH_INSET_RON_TAB_OTHER}`;
  return `${core} bg-transparent text-[#DBB961]`;
}
