import type { ProjectId } from "./ao-types";
import { aoUid, type Thread } from "./ao-state";

/** メイン「論」タブの識別子（UI 用。DB の project_id とは別名） */
export type TopicUiId = "kurultai" | "koukan" | "shisei" | "heiba" | "shinki" | "gakkyu" | "enkou";

export const AO_TOPICS: Array<{
  id: TopicUiId;
  label: string;
  /** この論タブで一覧に出す project_id（巷間論は gemini を含めない＝別途除外しない） */
  projectIds: readonly ProjectId[];
}> = [
  { id: "kurultai", label: "大会盟", projectIds: ["debate"] },
  /** 巷間論（chat）は Supabase 永続化なし・ローカルのみ */
  { id: "koukan", label: "巷間論", projectIds: ["chat"] },
  { id: "shisei", label: "為政論", projectIds: ["plan"] },
  { id: "heiba", label: "兵馬論", projectIds: ["work"] },
  { id: "shinki", label: "心気論", projectIds: ["mental"] },
  { id: "gakkyu", label: "学究論", projectIds: ["notebook"] },
  { id: "enkou", label: "遠交論", projectIds: ["foreign"] },
];

/** 巷間論の議事タイトル表示（自動スニペット・DB 保存なし） */
export const AO_KOUKAN_THREAD_DISPLAY_TITLE = "巷　間　論";

/** 選択中の論に属する project_id の集合（空＝タブ未選択時は呼び出し側で扱う） */
export function projectIdsForTopic(topicId: TopicUiId | null): readonly ProjectId[] | null {
  if (!topicId) return null;
  return AO_TOPICS.find((t) => t.id === topicId)?.projectIds ?? null;
}

/** updated_at 降順、同値なら title 降順（文字列比較は ja） */
export function compareThreadsForGiList(a: Thread, b: Thread): number {
  if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
  return b.title.localeCompare(a.title, "ja");
}

/** AO ネイティブ議事（Supabase へ投稿可）。未設定はローカル専用として ao とみなす */
export function isAoNativeThread(t: { sourceProvider?: string }): boolean {
  const s = t.sourceProvider?.trim().toLowerCase();
  if (s === undefined || s === "") return true;
  return s === "ao";
}

/**
 * 論タブに応じた僚友ハイライト（主担当＋副担当。クリックでは切り替えない）。
 * メイン投稿時の project_id は `aoPostingProjectIdForTopic` を参照（巷間論 chat は DB 永続化なし）。
 */
export function activeNokorNamesForTopic(topicId: TopicUiId | null): Set<string> {
  if (!topicId) return new Set();
  switch (topicId) {
    case "kurultai":
      return new Set([
        "フナン",
        "モンケウール",
        "ケテ",
        "バイジュ",
        "クドゥカ・ベキ",
        "タタ・トゥンガ",
        "チン・テムール",
        "コルグズ",
      ]);
    case "koukan":
      return new Set(["クドゥカ・ベキ"]);
    case "shisei":
      return new Set(["フナン"]);
    case "heiba":
      return new Set(["モンケウール", "ケテ"]);
    case "shinki":
      return new Set(["バイジュ"]);
    case "gakkyu":
      return new Set(["タタ・トゥンガ"]);
    case "enkou":
      return new Set(["チン・テムール"]);
    default:
      return new Set();
  }
}

export function aoPostingProjectIdForTopic(topicId: TopicUiId): ProjectId {
  switch (topicId) {
    case "kurultai":
      return "debate";
    case "koukan":
      return "chat";
    case "shisei":
      return "plan";
    case "heiba":
      return "work";
    case "shinki":
      return "mental";
    case "gakkyu":
      return "notebook";
    case "enkou":
      return "foreign";
  }
}

/** 投稿メニュー：AO ネイティブ議事かつ当該論の project_id（巷間論 chat は ephemeral 空も含む）。UI ページング用に十分な件数まで */
export function aoThreadsForPostMenu(threads: Thread[], topicId: TopicUiId): Thread[] {
  const pid = aoPostingProjectIdForTopic(topicId);
  return threads
    .filter((t) => {
      if (!isAoNativeThread(t) || t.projectId !== pid) return false;
      if (pid === "chat") return true;
      return !t.ephemeral;
    })
    .sort(compareThreadsForGiList)
    .slice(0, 120);
}

/** 選択中の論用・空の AO 下書き（初回送信まで ephemeral。DB 行は送信時のみ） */
export function createAoThreadForTopic(topicId: TopicUiId): Thread {
  const now = Date.now();
  const projectId = aoPostingProjectIdForTopic(topicId);
  return {
    id: aoUid("th"),
    projectId,
    title: projectId === "chat" ? AO_KOUKAN_THREAD_DISPLAY_TITLE : "",
    createdAt: now,
    updatedAt: now,
    messages: [],
    sourceProvider: "ao",
    ephemeral: true,
  };
}
