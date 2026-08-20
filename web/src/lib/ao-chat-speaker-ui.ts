import {
  primaryPersonaForProject,
  resolveSpeakerDisplay,
  type AoPersonaCatalog,
} from "@/lib/ao-persona-display";
import { detectNamedSpeaker, getPrimarySpeakerForProject } from "@/lib/ao-prompts";
import type { Msg, Thread } from "@/lib/ao-state";
import type { ProjectId } from "@/lib/ao-types";
import { visibleMessages } from "@/lib/ao-chat-timeline";

export const AVATAR_SRC: Record<string, string> = {
  ジュチ: "/personas/juci.png",
  耶律楚材: "/personas/yeruchusai.png",
  ソルコクタニ: "/personas/sorqaqtani.png",
  フナン: "/personas/AO_Char_Hunan.png",
  モンケウール: "/personas/AO_Char_Mongkeur.png",
  ケテ: "/personas/AO_Char_Qete.png",
  バイジュ: "/personas/AO_Char_Baiju.png",
  "クドゥカ・ベキ": "/personas/AO_Char_QudukaBeki.png",
  "タタ・トゥンガ": "/personas/AO_Char_TataTunga.png",
  "チン・テムール": "/personas/AO_Char_ChinTemur.png",
  コルグズ: "/personas/AO_Char_Qorguz.png",
  不明: "/personas/AO_Char_Hunan.png",
};

export const CHAT_UI_UNKNOWN_AVATAR = "/personas/AO_Char_Hunan.png";

export function aiSpeakerUi(
  thread: Thread | null,
  m: Msg,
  catalog: AoPersonaCatalog | null,
): { label: string; avatarSrc: string } {
  if (m.side === "user") {
    return { label: "ジュチ", avatarSrc: AVATAR_SRC["ジュチ"] ?? CHAT_UI_UNKNOWN_AVATAR };
  }
  const pid = thread?.projectId;
  if (pid === "claude" || pid === "chatgpt") {
    return { label: "耶律楚材", avatarSrc: AVATAR_SRC["耶律楚材"] ?? CHAT_UI_UNKNOWN_AVATAR };
  }
  if (pid === "gemini") {
    return { label: "ソルコクタニ", avatarSrc: AVATAR_SRC["ソルコクタニ"] ?? CHAT_UI_UNKNOWN_AVATAR };
  }
  return resolveSpeakerDisplay({
    speaker: m.speaker,
    catalog,
    fallbackAvatarByLabel: AVATAR_SRC,
    unknownAvatarSrc: CHAT_UI_UNKNOWN_AVATAR,
  });
}

export function aoThinkingSpeakerUi(
  thread: Thread | null,
  catalog: AoPersonaCatalog | null,
): { label: string; avatarSrc: string } {
  const pid = thread?.projectId as ProjectId | undefined;
  if (pid === "claude" || pid === "chatgpt") {
    return { label: "耶律楚材", avatarSrc: AVATAR_SRC["耶律楚材"] ?? CHAT_UI_UNKNOWN_AVATAR };
  }
  if (pid === "gemini") {
    return { label: "ソルコクタニ", avatarSrc: AVATAR_SRC["ソルコクタニ"] ?? CHAT_UI_UNKNOWN_AVATAR };
  }

  const msgs = visibleMessages(thread?.messages ?? []);
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.side === "user") {
      const designated = detectNamedSpeaker(m.text ?? "");
      if (designated) {
        return resolveSpeakerDisplay({
          speaker: designated,
          catalog,
          fallbackAvatarByLabel: AVATAR_SRC,
          unknownAvatarSrc: CHAT_UI_UNKNOWN_AVATAR,
        });
      }
      break;
    }
  }

  const primary = pid ? primaryPersonaForProject(catalog, pid) : null;
  if (primary?.name.trim()) {
    return resolveSpeakerDisplay({
      speaker: primary.name,
      catalog,
      fallbackAvatarByLabel: AVATAR_SRC,
      unknownAvatarSrc: CHAT_UI_UNKNOWN_AVATAR,
    });
  }

  return resolveSpeakerDisplay({
    speaker: getPrimarySpeakerForProject(pid ?? "debate"),
    catalog,
    fallbackAvatarByLabel: AVATAR_SRC,
    unknownAvatarSrc: CHAT_UI_UNKNOWN_AVATAR,
  });
}
