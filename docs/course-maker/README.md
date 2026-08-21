# 講義メーカー — サブモジュール・クローズ（2026-07-31）

**ステータス: クローズ（Altan Orda の独立サブモジュールとして一旦完了）**

本モジュールは AO 本体チャットとは分離した **講義の作成・配信・身内共有** 一式である。  
AO 製品画面への埋め込み（パターン1）は **未着手・後日**。当面の共有は公開受講 URL（パターン2）で足りる。

次の主戦場は **Altan Orda 本体の整備**。講義メーカーを再開するときの入口は本 README。  
本体スレッドへの引き継ぎ正本: **`docs/operations/AO_Handoff_to_Core_2026-08-02.md`**

---

## 1. 位置づけ

| 項目 | 内容 |
|------|------|
| リポジトリ内の置き場 | 同一 Next.js アプリ（`web/`）内のルート群。別リポジトリではない |
| 管理 UI | `/courses`（OAuth／Basic 保護） |
| 作成導線 | `/courses/new`（ヒアリング → ThemeBrief → OutlineSkeleton） |
| 受講（管理者） | `/courses/{id}/learn` |
| 受講（身内共有） | `/l/{id}`（認証なし・allowlist） |
| Lab（実験室） | `/lab/*`（旧 `/sample`。モデル比較・PoC。講義本番導線とは別） |

「サブモジュール」＝製品機能として独立した境界を持つ、という意味。モノレポ分離や npm パッケージ化はしていない。

---

## 2. 達成したもの（クローズ時点）

### 2.1 作成パイプライン（Format v2）

1. タイトル → ヒアリングチャット → ThemeBrief  
2. OutlineSkeleton（回タイトル＋1行）  
3. 管理画面で CourseMaster（Terra）→ 検証 → 承認  
4. 本文（Luna、必要時 Terra FB）＋ Wikimedia セクション画像  
5. 回メイン画像（Image2 Low）※一括本文生成の既定は `output=text`（ヒーローは別途 `image`／`both`）  
6. 学習画面＋講師チャット（Terra）

正本フロー・スキーマ: **`AO_Course_Format_v2.md`**

### 2.2 公開受講（スマホ前提）

- パス: `/l/{courseId}`
- 認証なし。`AO_COURSE_PUBLIC_LEARN_IDS` allowlist のみ
- 講師チャット可。生成・管理 API は出さない
- ヒーロー静的 PNG は allowlist 講義のみ middleware 免除
- 管理画面に共有 URL（コピー）を表示

本番例（クローズ時点）:

- 講義: **美しく年を重ねる方法**
- ID: `c03de5c7-0153-45f9-9d62-d1c25a847dc1`
- URL: `https://altan-orda-ai-frontend.vercel.app/l/c03de5c7-0153-45f9-9d62-d1c25a847dc1`

### 2.3 モデル結論（維持）

| 役割 | 採用 |
|------|------|
| 構成・ヒアリング・講師チャット | GPT-5.6 Terra |
| 本文 | GPT-5.6 Luna（FB Terra） |
| 回メイン画像 | GPT Image 2 Low |
| セクション画像 | Wikimedia（非生成） |
| Sonnet 本文 | 不採用 |

経緯: **`AO_Course_Maker_Decisions.md`**

### 2.4 課金ゲート（運用）

バッチ生成（全回本文・全画像・`pipeline` 等）は **見積もり → 殿下の明示許可** のあとだけ実行。  
Cursor ルール: `.cursor/rules/course-maker-batch-spend.mdc`

---

## 3. 意図的に残した／見送ったもの

再開時のバックログ。クローズ＝捨てた、ではない。

| 項目 | 状態 | メモ |
|------|------|------|
| AO 本体への講義埋め込み | 未着手 | パターン1。共有 URL で代替中 |
| 「全回一括生成」でヒーローも出す | 未修正 | 既定 `output=text`。後で UI／既定を直す |
| 「本文を作成」＝構成＋本文の一気通貫 | 未完成 | 現状は管理画面で工程分割 |
| 構成フェーズ知識ドラフト〜監査（Foundation） | PoC／設計止まり | `AO_Course_Foundation_*.md` |
| 出典インライン | ドロップ | 講義末尾リストから再開可 |
| Wikimedia 権利・セーフサーチ厳密化 | 簡易のまま | Format v2 に注記あり |
| Lab の巨大成果物整理 | 一部あり | `.vercelignore` で除外。入口は `docs/lab/README.md` |
| 別リポジトリ／別デプロイへの切り出し | 不要と判断 | 同一 `web` で境界を維持 |

---

## 4. ドキュメント地図

| ファイル | 役割 |
|----------|------|
| **`README.md`（本ファイル）** | クローズ正本・再開入口 |
| `AO_Course_Format_v2.md` | 配信フォーマット・E2E 流れの正本 |
| `AO_Course_Maker_Decisions.md` | モデル結論・Lab Preview・出典方針 |
| `AO_Course_Foundation_PoC.md` | 知識ドラフト〜監査の設計（アーカイブ寄り） |
| `AO_Course_Foundation_Evaluation.md` | Foundation 評価メモ |

読順（再開時）: **本 README → Format v2 → Decisions**。Foundation は必要になったときだけ。

---

## 5. コード地図（境界）

```
web/src/app/courses/          … 管理・作成・学習（プレビュー）
web/src/app/l/                … 公開受講 UI
web/src/app/api/courses/      … 管理・生成 API
web/src/app/api/l/            … 公開 read＋chat＋progress
web/src/app/lab/              … 実験室 UI（講義本番と分離）。正本 docs/lab/README.md
web/src/app/api/lab/          … 実験室 API
web/public/lab/               … 実験室成果物
web/src/lib/course-maker/     … ドメイン・LLM・画像・公開 allowlist
web/src/components/course-maker/CourseLearnView.tsx
web/public/courses/{id}/      … ヒーロー PNG 等
```

認証免除: `web/src/auth.ts` の `/l/*`・`/api/l/*`・allowlist ヒーロー PNG。Lab は `AO_LAB_PUBLIC`（互換 `AO_SAMPLE_PUBLIC`）。

環境変数（`.env.example`）:

- `AO_COURSE_*`（モデル・画像・Dev）
- `AO_COURSE_PUBLIC_LEARN_IDS` / `AO_COURSE_PUBLIC_LEARN_ORIGIN`
- Lab 用 `AO_LAB_*`（互換 `AO_SAMPLE_*`）。正本: `docs/lab/README.md`

---

## 6. 再開チェックリスト（短く）

1. Format v2 と本 README の「残したもの」を確認  
2. 課金範囲を殿下に確認（バッチ禁止ゲート遵守）  
3. allowlist／Vercel env／ヒーロー静的ファイルの有無を確認  
4. 変更が入ったら Format v2 か Decisions を更新し、本 README の日付を進める  

---

## 7. Altan Orda 本体への引き渡し

- 講義メーカーは **動くサブシステムとして本番に載っている**（作成・共有 URL・講師チャット）。  
- AO 本体整備では、本モジュールを触らない限り干渉は小さい（ルート・lib が分離）。  
- 本体側で「講義を AO 内表示」が必要になった時点で本 README §3 の埋め込み項目から再開する。

**クローズ日: 2026-07-31**
