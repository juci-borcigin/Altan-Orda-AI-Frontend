/** Phase 6 仮 UI: 典籍論（Notebook）ソース取込（Preview / 将来メインオーバーレイへ移植） */

export const NOTEBOOK_SOURCE_MAX = 10;

export type NotebookThemeMode = "existing" | "new";

export type NotebookThemeOption = {
  id: string;
  label: string;
  slug: string;
  /** 将来: GDrive フォルダ ID */
  driveFolderHint?: string;
};

/** Preview 用の既存テーマ（将来 ao_notebook_themes 等） */
export const MOCK_NOTEBOOK_THEMES: NotebookThemeOption[] = [
  { id: "juchi-ulus", label: "ジュチ・ウルス", slug: "juchi-ulus", driveFolderHint: "AO/典籍論/juchi-ulus" },
  { id: "notebooklm", label: "NotebookLM 検討ログ", slug: "notebooklm-notes", driveFolderHint: "AO/典籍論/notebooklm-notes" },
  { id: "ao-arch", label: "AO アーキテクチャ", slug: "ao-architecture", driveFolderHint: "AO/典籍論/ao-architecture" },
];

export type PendingBookSource = {
  localId: string;
  file: File;
  display_name: string;
  mime_type: string;
  work_title: string;
  authors: string;
  published_year: number | null;
  published_month: number | null;
  publisher: string;
  parseStatus: "pending" | "parsed" | "error";
  parseNote: string;
};

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, "").trim();
}

/** 仮解析: ファイル名ヒューリスティクス（本番は PDF メタ + LLM 補完） */
export function mockParseBookMetadata(file: File): Pick<
  PendingBookSource,
  "work_title" | "authors" | "published_year" | "parseStatus" | "parseNote"
> {
  const base = stripExt(file.name);
  const yearMatch = base.match(/(19|20)\d{2}/);
  const year = yearMatch ? Number(yearMatch[0]) : null;

  let work_title = base;
  let authors = "";
  const sep = base.match(/\s[-–—]\s/);
  if (sep) {
    const idx = base.indexOf(sep[0]);
    authors = base.slice(0, idx).trim();
    work_title = base.slice(idx + sep[0].length).trim();
  }

  return {
    work_title: work_title || file.name,
    authors,
    published_year: year,
    parseStatus: "parsed",
    parseNote: "仮解析（ファイル名のみ）。本番は PDF メタデータ＋必要時 LLM。",
  };
}

export function pendingFromFiles(files: File[], existingCount: number): PendingBookSource[] {
  const room = Math.max(0, NOTEBOOK_SOURCE_MAX - existingCount);
  return files.slice(0, room).map((file) => {
    const parsed = mockParseBookMetadata(file);
    return {
      localId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      display_name: file.name,
      mime_type: file.type || "application/octet-stream",
      published_month: null,
      publisher: "",
      ...parsed,
    };
  });
}

export type UploadPlanStub = {
  themeSlug: string;
  themeLabel: string;
  drivePath: string;
  sources: Array<{
    display_name: string;
    work_title: string;
    authors: string;
    published_year: number | null;
  }>;
};

export function buildUploadPlanStub(
  theme: NotebookThemeOption,
  rows: PendingBookSource[],
): UploadPlanStub {
  return {
    themeSlug: theme.slug,
    themeLabel: theme.label,
    drivePath: theme.driveFolderHint ?? `AO/典籍論/${theme.slug}`,
    sources: rows.map((r) => ({
      display_name: r.display_name,
      work_title: r.work_title,
      authors: r.authors,
      published_year: r.published_year,
    })),
  };
}
