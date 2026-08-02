# 講義メーカー — 配信フォーマット前提（v2・2026-07-20）

ステータス: **方針確定・実装反映済み**。サブモジュールとしては **2026-07-31 クローズ**（入口: `README.md`）。

旧紙芝居（1コマ≈400字・コマ数＝画像数）前提は **破棄**。  
フォーマットは **Web／ブログ型の連続記事**とする。

これまでのモデル調査（Luna／Terra／Image2 Low、Sonnet不採用）は **引き続き有効**。

正本の流れは **§0**。一覧表・骨格は §1 以降。クローズ後の再開・境界は **`README.md`**。

---

## 0. エンドツーエンド流れ（正本）

管理者の操作 → システムの処理 → モデルへの指示 → モデルからの受け取り → 次処理、の順。

```
[設定UI] → 講義レコード作成
    → ヒアリング・チャット（方針）→ ThemeBrief
    → 講義のアウトライン（回タイトル＋1行）→ OutlineSkeleton
    → （管理者／現行）詳細構成 CourseMaster 生成（Terra）
    → 機械検証 → 人の承認
    → 本文生成 (Luna[+Terra FB]) → 回ごとの Markdown
    → Wikimedia 付与（非LLM）
    → 回メイン画像 (Image2 Low)
    → 学習画面（記事＋講師チャット）
```

本番ユーザー導線（目標）: 「本文を作成」で詳細構成＋本文へ進む。  
現行の開発／管理者画面では、アウトライン確定後に管理画面へ入り **「講義構成を生成」** で詳細 `CourseMaster` を作る（下記 §0.1b）。

---

### 0.1 講義設定のユーザー体験

画面: `/courses/new`

| 入力 | 仕様 |
|------|------|
| タイトル * | 必須。大テーマを兼ねる |
| （チャット） | 方針ヒアリング。属性・回数・力点などは対話で決定（未回答は既定） |
| 回数 | **4〜10**（チャットで変更可。既定5） |

チャット操作: Enter＝改行、⌘Enter／Ctrl+Enter＝送信。「方針を決定」→確認ポップアップ→「講義のアウトライン」。

作成後の管理者画面は `/courses/{id}`。表示上の「1回あたり」は **約5000字（読了目安≈20分）**。

---

### 0.1b アウトラインと「講義構成を生成」の違い

ヒアリング後の **講義のアウトライン（OutlineSkeleton）** は、各回のタイトルと1行サマリーだけである。まだセクション割・字数配分・伏線・画像クエリなどの詳細はない。

管理画面の **「講義構成を生成」** は、この骨格を入力に **詳細な CourseMaster**（各回の Intro／中身／Outro、intent、target_chars、image_search_query、伏線など）を Terra で作る工程である。  
したがって「アウトラインができている＝講義構成が完成」ではない。現行フローではアウトライン確定後に管理画面で「講義構成を生成」→承認→本文生成、となる。

| 成果物 | 中身 | いつ |
|--------|------|------|
| ThemeBrief | 方針・ペルソナ・回数・Disclaimer | 方針を決定時 |
| OutlineSkeleton | 回タイトル＋1行 | ポップアップ OK 時 |
| CourseMaster | 詳細構成（セクション等） | 「講義構成を生成」 |
| 本文 Markdown | 各回記事 | 本文生成 |

本番向けの将来像: ユーザーの「本文を作成」が CourseMaster 生成＋本文生成をまとめて進める。開発モードでは管理画面で工程を分けて触れる。

---

### 0.2 受け取ってからの処理（作成直後）

1. `normalizeCourseParams` で v2 正規化（属性 coerce、数学固定、回数クランプ）
2. `ao_courses` に保存: `params`（JSON）、`status=draft`
3. まだ LLM は呼ばない

---

### 0.3（任意）知識ドラフト〜確定（Step 1〜3）

本番管理画面の必須導線ではなく、**構成フェーズ PoC／将来の前段**。題材の「中身の正本」を先に固める。

| Step | 誰 | 渡す指示（要約） | 受け取るもの | 次 |
|------|-----|------------------|--------------|-----|
| 1 ドラフト | **Luna** | テーマ・属性・回数・到達目標。回／画面セクションにはまだ割らない。知識の Markdown | `ContentDraft`（body_markdown, outcomes, claims…） | → 2 |
| 2 監査 | **Terra** + Tavily | ドラフトと要確認点。検索計画→検索→判定 | `AuditReport`（findings, urls） | → 3 |
| 3 確定 | **Terra** | ドラフト＋監査結果を反映し locked にする | `ContentDraft status=locked` | → 構成の入力として渡せる |

---

### 0.4 講義構成の生成（Step 4・必須）

操作: 「講義構成を生成」→ `POST .../outline/generate`  
モデル: **GPT-5.6 Terra**（伏線系の失敗時は最大2試行）

**システムへ渡す指示（要約）**

- 出力は CourseMaster JSON のみ（Web記事型）
- 回数 N（4〜10）。各回 = Intro + 中身≈5±1 + Outro（総セクション 6〜8）
- 1回目標 **5000字**（sections の target_chars 合計で満たす）
- 各回に `hero_image_prompt`（回メイン用・英語主体）
- content のみ `image_search_query`（Wikimedia 用）。intro/outro は画像なし
- `visual_slots` は空でよい（旧紙芝居用）
- 伏線 registry と foreshadow_ids / payoff_ids の整合
- （任意）locked 知識ドラフトがある場合は「見出し≠セクション。内容を回数と字数に再配分」

**ユーザープロンプトに載る設定**

テーマ、受講者ラベル、中学数学ガイド、達成目標、回数、5000字、セクション数レンジ

**モデルから受け取るもの**

`CourseMaster`（パース＋正規化後）:

- `meta`（theme, audience, math_level, session_count, target_chars_per_session=5000…）
- `common`（narrative_arc, tone, glossary…）
- `foreshadow_registry`
- `sessions[]`: title, objectives, continuity_*, sections[]（role/heading/intent/target_chars/image_search_query）, hero_image_prompt

**次の処理（非LLM）**

1. `parseCourseMaster` / `normalizeCourseMasterInput`
2. `verifyCourseMaster`（伏線・セクション数など）
3. DB: `course_master` 保存、`status=outline_draft`
4. セッション行・`hero_s{n}` ビジュアル行を確保
5. 人が「講義構成を承認」→ `outline_approved`（検証 error 時は承認ブロック）

---

### 0.5 本文生成（Step 5）

操作: 回単位 or 「全回を一括生成」→ `POST .../sessions/generate`  
既定 `output=text`（本文＋Wikimedia。課金画像はまだ）  
モデル: **Luna** → 構造失敗時 **Terra** フォールバック可  
字数ゲート: **soft**（±15% 外でも生成失敗にはしない。検証 C4 は warn）

**渡す指示（要約）**

- 1回分を Intro〜Outro まとめて JSON（各 section の markdown）
- 見出しは設計どおり `## {heading}` から
- 紙芝居ではない。セクションごとの生成画像プロンプト不要
- 挨拶は第1回 intro のみ短く1回
- 回全体 ≈5000字（soft）

**受け取るもの**

各回 `pages[]`: `{ section_no, markdown }`  
結合して `ao_course_sessions.markdown_body` に1本保存。`verifySessionBody`（C4 は soft warn）

**次の処理（非LLM・同じリクエスト内）**

1. content セクションごとに Wikimedia 検索（`image_search_query` または `テーマ+見出し`）
2. ヒット → `sections[].image_url` / `image_attribution` / `image_source=wikimedia`
3. ミス → 空スキップ（`image_source=none`）
4. 更新した `course_master` を DB に書き戻し

---

### 0.6 回メイン画像

操作: `output=image` または `both`（または将来の明示ボタン）  
モデル: **GPT Image 2 Low**（回あたり1枚・横長）

**渡すもの**

`hero_image_prompt`（無ければテーマ＋回タイトルからフォールバック文）

**受け取るもの**

PNG → `public/courses/{courseId}/hero_s{n}.png`  
DB: `ao_course_visuals`（`slot_id=hero_s{n}`, `artifact_url=/courses/...`）  
巨大 data URL は DB に積まない

---

### 0.7 学習画面・講師チャット

画面:

- 管理側プレビュー: `/courses/{id}/learn`
- **公開受講（身内共有）**: `/l/{id}` — 認証なし。`AO_COURSE_PUBLIC_LEARN_IDS` allowlist のみ。管理・一覧・生成 API は出さない。講師チャット可

表示順（1回＝1記事）:

1. 講義名／回タイトル／読了目安  
2. 回メイン画像  
3. sticky 目次（ジャンプ）＋前回／次回  
4. 「はじめに」本文（画像なし）  
5. 中身: 見出し → 小画像（あれば＋帰属）→ 本文  
6. 「まとめ」本文  
7. ナビ  
8. **講師チャット（Outro の下）** — 機能は従来どおり AI 講師への質問

---

### 0.8 モデル役割の早見

| 段階 | モデル | 備考 |
|------|--------|------|
| 知識ドラフト | Luna | 任意前段 |
| 監査指示 | Terra + Tavily | 任意前段 |
| 確定 | Terra | 任意前段 |
| 構成 CourseMaster | **Terra** | 必須 |
| 本文 | **Luna**（FB Terra） | 必須 |
| 回メイン画像 | **Image2 Low** | 回1枚 |
| セクション画像 | Wikimedia API | 非LLM |

Sonnet は本文パスでは不採用。

---

## 実装確定事項（一覧）

| 項目 | 決定 |
|------|------|
| セクション画像 | **Wikimedia 優先** → 取れなければ **空（スキップ）** |
| 旧 `session_duration_min` | **削除**（生成に使わない） |
| 属性 | **キッズ／学生／社会人**のみ。当面社会人のみ選択可 |
| 数学 | 常に **中学数学**固定（UI非表示） |
| 1回字数 | **5000字固定**。検証は当面 **soft** |
| 回数 | **4〜10**のみ指定可 |
| DB | 生成パスは v2。ファイル＋URL参照優先 |
| ナビ | sticky 目次＋前回／次回。チャットは Outro 下 |
| 権利表示 | Wikimedia 簡易キャプション。セーフサーチ厳密化は後続 |

### 実装メモ

- 回メイン: `hero_s{n}`、PNG は `public/courses/{id}/`
- セクション画像は `course_master.sessions[].sections[]` に URL／帰属
- 旧 params は outline 時に `normalizeCourseParams` で v2 化
- 学習UIは縦スクロール記事（1セクション＝1ページではない）

---

## 1. 採用モデル（再確認）

| 役割 | モデル |
|------|--------|
| 構成・固い指示 | GPT-5.6 **Terra** |
| 本文 | GPT-5.6 **Luna**（FB Terra 可） |
| 回メイン画像 | GPT Image 2 **Low** |
| セクション画像 | Wikimedia（非生成）・≈200px |

---

## 2. 1記事（＝1回）の骨格

```
講義タイトル
回タイトル
回メイン画像（生成・横長）
回のセクションリスト・ジャンプリンク
操作（この回先頭 / 前回 / 次回）

「はじめに」+ Intro 本文（画像なし）

セクション見出し
セクション小画像（検索・任意）
セクション本文
…

「まとめ」+ Outro 本文（画像なし）
操作
講師チャット
```

- 中身セクション目安 **5±1**（総 6〜8）。中身8は多すぎ。

---

## 3. 画像の役割分担

| 種類 | 用途 | 作り方 | 枚数 |
|------|------|--------|------|
| 回メイン | 回を代表 | Image2 Low | **1回1枚** |
| セクション | 補足 | Wikimedia・≈200px | content ごと（欠落可） |

---

## 4. 属性・分量

- 属性3値（当面社会人）。数学は中学固定
- 1回＝**5000字固定**。読了目安は表示用のみ（÷250字/分）
- ユーザー指定は **回数 4〜10** のみ（分数・目標字数は UI 外）

---

## 5. 旧前提からの破棄

- 紙芝居／400字コマ
- セクション数＝生成画像枚数
- `min × 200` を本文目標にすること
- セクション単位の Image2（通常パス）

調査ラボ（`/lab`、旧 `/sample`）は比較アーカイブとして残してよい。正本: `docs/lab/README.md`。
