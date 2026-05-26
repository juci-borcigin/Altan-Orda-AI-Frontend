"use client";

import { useCallback, useMemo, useState } from "react";
import {
  buildUploadPlanStub,
  MOCK_NOTEBOOK_THEMES,
  NOTEBOOK_SOURCE_MAX,
  pendingFromFiles,
  type NotebookThemeMode,
  type NotebookThemeOption,
  type PendingBookSource,
} from "@/lib/notebook-source-lab";

const INK = "#3D1C08";
const PARCHMENT = "#f5edd6";
const BORDER = "#c9922a";

type UploadPhase = "idle" | "gdrive_stub" | "done";

export function AoNotebookSourcesLab() {
  const [themeMode, setThemeMode] = useState<NotebookThemeMode>("existing");
  const [themeId, setThemeId] = useState(MOCK_NOTEBOOK_THEMES[0]!.id);
  const [newThemeLabel, setNewThemeLabel] = useState("");
  const [newThemeSlug, setNewThemeSlug] = useState("");
  const [rows, setRows] = useState<PendingBookSource[]>([]);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [lastPlanJson, setLastPlanJson] = useState("");

  const activeTheme: NotebookThemeOption = useMemo(() => {
    if (themeMode === "new") {
      const label = newThemeLabel.trim() || "（新規テーマ）";
      const slug =
        newThemeSlug.trim() ||
        label
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "") ||
        "new-theme";
      return {
        id: "__new__",
        label,
        slug,
        driveFolderHint: `AO/典籍論/${slug}`,
      };
    }
    return MOCK_NOTEBOOK_THEMES.find((t) => t.id === themeId) ?? MOCK_NOTEBOOK_THEMES[0]!;
  }, [themeMode, themeId, newThemeLabel, newThemeSlug]);

  const onPickFiles = useCallback(
    (list: FileList | null) => {
      if (!list?.length) return;
      const added = pendingFromFiles(Array.from(list), rows.length);
      if (added.length < list.length) {
        window.alert(`最大 ${NOTEBOOK_SOURCE_MAX} 件までです。${added.length} 件だけ追加しました。`);
      }
      setRows((prev) => [...prev, ...added]);
      setUploadPhase("idle");
    },
    [rows.length],
  );

  const updateRow = useCallback((localId: string, patch: Partial<PendingBookSource>) => {
    setRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));
  }, []);

  const removeRow = useCallback((localId: string) => {
    setRows((prev) => prev.filter((r) => r.localId !== localId));
    setUploadPhase("idle");
  }, []);

  const onUploadStub = useCallback(() => {
    if (rows.length === 0) {
      window.alert("ソースを1件以上追加してください。");
      return;
    }
    const plan = buildUploadPlanStub(activeTheme, rows);
    setUploadPhase("gdrive_stub");
    setLastPlanJson(JSON.stringify(plan, null, 2));
    console.info("[notebook-sources-lab] upload plan (stub)", plan);
    window.setTimeout(() => setUploadPhase("done"), 600);
  }, [activeTheme, rows]);

  return (
    <div className="mx-auto max-w-4xl font-serif text-[13px]" style={{ color: INK }}>
      <header
        className="mb-4 rounded border px-3 py-2"
        style={{ borderColor: `${BORDER}99`, background: PARCHMENT }}
      >
        <h1 className="text-[15px] font-bold">典籍論（Notebook）— ソース取込（仮 UI）</h1>
        <p className="mt-1 text-[11px] leading-snug opacity-85">
          Phase 6 Preview。ファイルはブラウザ内のみ保持。アップロードは GDrive / DB / RAG のスタブ。
          将来メインエリアオーバーレイへ移植予定。
        </p>
      </header>

      {/* テーマ（議事 / Notebook テーマ） */}
      <section
        className="mb-4 rounded border px-3 py-3"
        style={{ borderColor: `${BORDER}66`, background: "rgba(255,255,255,0.55)" }}
      >
        <div className="mb-2 text-[12px] font-bold">議事テーマ（論に相当）</div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1 text-[11px]">
            <input
              type="radio"
              checked={themeMode === "existing"}
              onChange={() => setThemeMode("existing")}
            />
            既存
          </label>
          <label className="flex items-center gap-1 text-[11px]">
            <input
              type="radio"
              checked={themeMode === "new"}
              onChange={() => setThemeMode("new")}
            />
            新規
          </label>
        </div>
        {themeMode === "existing" ? (
          <select
            className="mt-2 w-full max-w-md rounded border px-2 py-1 text-[12px]"
            style={{ borderColor: `${INK}33` }}
            value={themeId}
            onChange={(e) => setThemeId(e.target.value)}
          >
            {MOCK_NOTEBOOK_THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}（{t.slug}）
              </option>
            ))}
          </select>
        ) : (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-0.5 text-[10px]">
              表示名
              <input
                className="rounded border px-2 py-1 text-[12px]"
                style={{ borderColor: `${INK}33` }}
                value={newThemeLabel}
                onChange={(e) => setNewThemeLabel(e.target.value)}
                placeholder="例: ジュチ・ウルス"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[10px]">
              slug（フォルダ名）
              <input
                className="rounded border px-2 py-1 text-[12px]"
                style={{ borderColor: `${INK}33` }}
                value={newThemeSlug}
                onChange={(e) => setNewThemeSlug(e.target.value)}
                placeholder="例: juchi-ulus"
              />
            </label>
          </div>
        )}
        <p className="mt-2 text-[10px] opacity-75">
          GDrive 保存先（予定）: <code className="text-[10px]">{activeTheme.driveFolderHint}</code>
        </p>
      </section>

      {/* ファイル選択 */}
      <section
        className="mb-4 rounded border px-3 py-3"
        style={{ borderColor: `${BORDER}66`, background: "rgba(255,255,255,0.55)" }}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] font-bold">
            ソース追加（{rows.length}/{NOTEBOOK_SOURCE_MAX}）
          </span>
          <label className="cursor-pointer rounded border px-3 py-1 text-[11px] font-semibold hover:opacity-90"
            style={{ borderColor: BORDER, background: PARCHMENT }}>
            ファイルを選ぶ
            <input
              type="file"
              multiple
              accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
              className="hidden"
              disabled={rows.length >= NOTEBOOK_SOURCE_MAX}
              onChange={(e) => {
                onPickFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <p className="text-[10px] opacity-75">
          複数選択可。フォルダ選択はブラウザ次第（webkitdirectory は将来）。選定直後に仮メタ解析。
        </p>
      </section>

      {/* メタデータ一覧 */}
      <section
        className="mb-4 overflow-x-auto rounded border"
        style={{ borderColor: `${BORDER}66`, background: "rgba(255,255,255,0.7)" }}
      >
        <table className="w-full min-w-[720px] border-collapse text-[11px]">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: `${INK}22`, background: PARCHMENT }}>
              <th className="px-2 py-1.5 font-semibold">タイトル</th>
              <th className="px-2 py-1.5 font-semibold">著者</th>
              <th className="px-2 py-1.5 font-semibold w-16">年</th>
              <th className="px-2 py-1.5 font-semibold w-14">月</th>
              <th className="px-2 py-1.5 font-semibold">ファイル名</th>
              <th className="px-2 py-1.5 font-semibold w-14" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-6 text-center opacity-60">
                  ソースがありません
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.localId} className="border-b align-top" style={{ borderColor: `${INK}15` }}>
                  <td className="px-1 py-1">
                    <input
                      className="w-full rounded border px-1 py-0.5"
                      style={{ borderColor: `${INK}25` }}
                      value={r.work_title}
                      onChange={(e) => updateRow(r.localId, { work_title: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      className="w-full rounded border px-1 py-0.5"
                      style={{ borderColor: `${INK}25` }}
                      value={r.authors}
                      onChange={(e) => updateRow(r.localId, { authors: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      className="w-full rounded border px-1 py-0.5"
                      style={{ borderColor: `${INK}25` }}
                      value={r.published_year ?? ""}
                      onChange={(e) =>
                        updateRow(r.localId, {
                          published_year: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      min={1}
                      max={12}
                      className="w-full rounded border px-1 py-0.5"
                      style={{ borderColor: `${INK}25` }}
                      value={r.published_month ?? ""}
                      onChange={(e) =>
                        updateRow(r.localId, {
                          published_month: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5 opacity-80">{r.display_name}</td>
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      className="rounded border px-2 py-0.5 text-[10px]"
                      style={{ borderColor: `${INK}44` }}
                      onClick={() => removeRow(r.localId)}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {rows.map((r) =>
          r.parseNote ? (
            <p key={`${r.localId}-note`} className="border-t px-2 py-1 text-[9px] opacity-65" style={{ borderColor: `${INK}15` }}>
              {r.display_name}: {r.parseNote}
            </p>
          ) : null,
        )}
      </section>

      {/* アップロード */}
      <section className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded border px-4 py-2 text-[12px] font-bold disabled:opacity-40"
          style={{ borderColor: BORDER, background: PARCHMENT }}
          disabled={rows.length === 0 || uploadPhase === "gdrive_stub"}
          onClick={onUploadStub}
        >
          GDrive へアップロード（スタブ）
        </button>
        <span className="text-[10px] opacity-75">
          {uploadPhase === "idle" && "未送信"}
          {uploadPhase === "gdrive_stub" && "処理中…"}
          {uploadPhase === "done" && "スタブ完了（下記ログ参照）"}
        </span>
      </section>

      {uploadPhase === "done" && lastPlanJson ? (
        <pre
          className="mt-4 max-h-48 overflow-auto rounded border p-2 text-[10px] leading-snug"
          style={{ borderColor: `${BORDER}55`, background: "#fffef8" }}
        >
          {lastPlanJson}
        </pre>
      ) : null}

      <footer className="mt-6 rounded border px-3 py-2 text-[10px] leading-relaxed opacity-85"
        style={{ borderColor: `${BORDER}44`, background: PARCHMENT }}>
        <strong>本番で必要になるもの（アップロード実装時）</strong>
        <ul className="mt-1 list-inside list-disc">
          <li>Google Drive API（OAuth スコープ `drive.file` またはフォルダ単位）</li>
          <li>テーマごとのフォルダ ID マップ（新規テーマは Drive 上でフォルダ作成）</li>
          <li>サーバ: 一時保存 → Drive upload → テキスト抽出 → ao_book_sources → Qdrant embed (kind=books)</li>
        </ul>
        <p className="mt-2">
          <strong>今の仮 UI 段階では GDrive 準備は必須ではない。</strong>
          メタデータ UX の調整までブラウザ内で完結できます。
        </p>
      </footer>
    </div>
  );
}
