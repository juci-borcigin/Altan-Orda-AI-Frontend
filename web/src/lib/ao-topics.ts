import type { ProjectId } from "./ao-types";
import { normalizeProjectId } from "./ao-types";
import { aoUid, pruneEphemeralEmptyThreads, type AppState, type Thread } from "./ao-state";

/** メイン「論」タブの識別子（UI 用。DB の project_id とは別名） */
export type TopicUiId = "kurultai" | "koukan" | "shisei" | "heiba" | "shinki" | "gakkyu" | "enkou";

export const AO_TOPICS: Array<{
  id: TopicUiId;
  label: string;
  /** この論タブで一覧に出す project_id（巷間論は gemini を含めない＝別途除外しない） */
  projectIds: readonly ProjectId[];
}> = [
  { id: "kurultai", label: "大会盟", projectIds: ["debate"] },
  /** 巷間論（chat） */
  { id: "koukan", label: "巷間論", projectIds: ["chat"] },
  { id: "shisei", label: "為政論", projectIds: ["plan"] },
  { id: "heiba", label: "兵馬論", projectIds: ["work"] },
  { id: "shinki", label: "心気論", projectIds: ["mental"] },
  { id: "gakkyu", label: "典籍論", projectIds: ["notebook"] },
  { id: "enkou", label: "遠交論", projectIds: ["foreign"] },
];

/** 選択中の論に属する project_id の集合（空＝タブ未選択時は呼び出し側で扱う） */
export function projectIdsForTopic(topicId: TopicUiId | null): readonly ProjectId[] | null {
  if (!topicId) return null;
  return AO_TOPICS.find((t) => t.id === topicId)?.projectIds ?? null;
}

/** 議事の project_id → メイン「論」タブ ID（表示中チャットと論ハイライトの同期用） */
export function topicUiIdForProjectId(projectId: ProjectId): TopicUiId | null {
  for (const t of AO_TOPICS) {
    if (t.projectIds.includes(projectId)) return t.id;
  }
  return null;
}

/** 議事の project_id（DB レガシー `study` → `notebook` 等）が論タブの対象に含まれるか */
export function threadMatchesTopicProjectIds(t: Thread, topicProjectIds: readonly ProjectId[]): boolean {
  const pid = normalizeProjectId(String(t.projectId));
  if (!pid) return false;
  return topicProjectIds.includes(pid);
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
      return new Set(["クドゥカ", "ベキ"]);
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

/**
 * 年代記・議事一覧：当該論の議事（Supabase 同期済みは取り込み nblm 等も含む。巷間論 chat は ephemeral 空も可）
 */
export function threadsForTopicGiList(threads: Thread[], topicId: TopicUiId): Thread[] {
  const pids = projectIdsForTopic(topicId);
  if (!pids?.length) return [];
  return threads
    .filter((t) => {
      if (!threadMatchesTopicProjectIds(t, pids)) return false;
      if (t.supabaseThreadId) return true;
      return isAoNativeThread(t) && !t.ephemeral;
    })
    .sort(compareThreadsForGiList)
    .slice(0, 120);
}

/** @deprecated 名称互換。`threadsForTopicGiList` と同一 */
export function aoThreadsForPostMenu(threads: Thread[], topicId: TopicUiId): Thread[] {
  return threadsForTopicGiList(threads, topicId);
}

/** 選択中の論用・空の AO 下書き（初回送信まで ephemeral。DB 行は送信時のみ） */
export function createAoThreadForTopic(topicId: TopicUiId): Thread {
  const now = Date.now();
  const projectId = aoPostingProjectIdForTopic(topicId);
  return {
    id: aoUid("th"),
    projectId,
    title: "",
    createdAt: now,
    updatedAt: now,
    messages: [],
    sourceProvider: "ao",
    ephemeral: true,
  };
}

/** 空プレースホルダー以外（メッセージあり／Supabase 同期済み／サーバー読込済み） */
export function isTopicThreadDisplayCandidate(t: Thread): boolean {
  if (t.ephemeral && t.messages.length === 0) return false;
  return t.messages.length > 0 || Boolean(t.supabaseThreadId) || t.serverMessagesLoaded === true;
}

/** インメモリ議事から、当該論の最新 1 件（updated_at 降順） */
export function latestThreadForTopicInMemory(threads: Thread[], topicId: TopicUiId): Thread | null {
  const pids = projectIdsForTopic(topicId);
  if (!pids?.length) return null;
  const candidates = threads.filter(
    (t) => threadMatchesTopicProjectIds(t, pids) && isTopicThreadDisplayCandidate(t),
  );
  if (candidates.length === 0) return null;
  return [...candidates].sort(compareThreadsForGiList)[0] ?? null;
}

/**
 * 論切替時：当該論の最新議事を current に合わせる。
 * 無ければ ephemeral 新規（メモリのみ。DB の ao_threads 行は初回送信まで作らない）。
 */
export function focusStateOnTopic(
  state: AppState,
  topicId: TopicUiId,
  opts?: { preferLatest?: boolean },
): AppState {
  const pids = projectIdsForTopic(topicId);
  if (!pids?.length) return state;

  const pruned = pruneEphemeralEmptyThreads(state);
  const threads = pruned.threads.filter((t) => {
    if (!threadMatchesTopicProjectIds(t, pids)) return true;
    return isTopicThreadDisplayCandidate(t);
  });

  const preferLatest = opts?.preferLatest !== false;
  const latest = preferLatest ? latestThreadForTopicInMemory(threads, topicId) : null;
  if (latest) {
    return {
      ...pruned,
      threads,
      currentThreadId: latest.id,
      currentProjectId: latest.projectId,
    };
  }

  const nt = createAoThreadForTopic(topicId);
  return {
    ...pruned,
    threads: [nt, ...threads],
    currentThreadId: nt.id,
    currentProjectId: nt.projectId,
  };
}

export function isGakkyuTopic(topicId: TopicUiId | null): boolean {
  return topicId === "gakkyu";
}

/**
 * 典籍論タブ切替用：最新議事を自動選択せずブランク（ephemeral）のみ。
 * threads/list も messages も触らず、一覧オーバーレイからの選択待ち。
 */
export function focusStateOnGakkyuBlank(state: AppState): AppState {
  return focusStateOnTopic(state, "gakkyu", { preferLatest: false });
}
