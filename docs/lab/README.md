# Altan Orda 実験室（Lab）

**パス:** `/lab`（旧 `/sample`。ローカルでは 308 でリダイレクト）  
**役割:** AO 本体・講義メーカー共通の **開発・比較・PoC エリア**（高度な隔離は不要）

本番プロダクト導線（`/` のチャット、`/courses` 管理、`/l` 公開受講）とは分離する。ここは試作とアーカイブの置き場である。

関連: [AO_Core_Backlog.md](../operations/AO_Core_Backlog.md) ・ [course-maker/README.md](../course-maker/README.md)

---

## 運用方針（2026-08-02 確定）

原則は **安く・簡単・安全**。実験室にリスクとコストをかけない。

| 項目 | 方針 |
|------|------|
| 誰向けか | 主に AO 開発用。ついでにちょっとしたモデル／UI 比較にも使ってよい |
| どこで見るか | **この開発 Mac のローカル**（`npm run dev` 等）。クラウド URL は不要 |
| GitHub | **残す**（バックアップ・履歴・幕僚共有）。旧 `/sample` は削除し `/lab` に寄せる |
| Vercel 本番 | **載せない**。`.vercelignore` で `/lab`・`/api/lab`・`public/lab`（および旧 sample）を除外 |
| 別 Vercel／別リポ | 当面やらない（過コスト） |
| `AO_LAB_PUBLIC=1` | **本番では立てない**（そもそもルートが無い）。ローカルでも通常は不要 |

### 日々の使い方

1. リポジトリをこの Mac で開く  
2. `web/` で開発サーバを起動する  
3. ブラウザで `http://localhost:3000/lab` を開く  
4. 課金を伴う POST は、必要なら `AO_LAB_API_SECRET` とガードを確認してから（バッチ課金ルールに従う）

### 本番デプロイ時の注意

- 製品（チャット・講義メーカー・公開受講）は通常どおりデプロイしてよい  
- Lab は ignore により **アップロードされない**前提。デプロイ後に `https://…/lab` や `…/sample` が **404 等で死んでいる**ことを確認すると安心  
- 巨大な生成物（`session1-visual-lab`・`image-lab` の画像、offline zip）は **`.gitignore` で Git からも除外**し、この Mac のローカルに置く。小さな `manifest.json` やハブ HTML だけをリポに残す  

### やらないこと

- 本番で Lab を一般公開する  
- Lab のためだけに Vercel プロジェクトや課金プランを増やす  
- 講義メーカーのバッチ生成を、許可なく Lab から回す  

---

## 入口（ローカル）

- ハブ: [`/lab`](../../web/src/app/lab/page.tsx) — セクション分けした一覧  
- 静的ミラー: `web/public/lab/index.html`  
- API: `/api/lab/*`（POST はガードあり）

---

## 収録ラボ（クローズ時点）

### AO 本体アーカイブ

旧 `/sample` ではなく、本体開発時から別パスで残っている試作。**これらは Lab 配下ではない**ため、本番ビルドに残りうる（製品 UI の部品確認用）。

| パス | 内容 | 状態 |
|------|------|------|
| `/phase5-preview` | 吹き出し・肖像・名札・ビューポート等の UI 部品ギャラリー | **生存**（Next ルート） |
| `/phase5-preview/notebook-sources` | 典籍ソース仮UI | **生存** |
| `/ao-shin-icon-samples.html` | アイコン SVG 候補の静的プレビュー | **生存**（`public/`） |

関連アセット（本番でも使用）: `web/public/phase5/`、`web/public/personas/`  
SP 用プロンプト文例（画面ではない）: `docs/phase5/sp-samples/`

### 運用・プレビュー（`/lab` 配下・ローカル専用）

| パス | 内容 |
|------|------|
| `/lab/course-run-tracker` | 講義生成の進行・料金追跡たたき台 |
| `/lab/learn-preview` | Format v2 受講 UI の静的プレビュー |

### 講義メーカー実験（ローカル専用）

| パス | 内容 |
|------|------|
| `/lab/course-foundation-poc` | 知識ドラフト→監査→確定 PoC |

### モデル比較アーカイブ（講義メーカー・ローカル専用）

| パス | 内容 |
|------|------|
| `/lab/session1-visual-lab` | 第1回・文章＋画像比較 |
| `/lab/gpt-5-6-lab` | GPT-5.6 講義生成テスト |
| `/lab/text-lab` | 本文・構成モデル比較 |
| `/lab/image-lab` | 画像プロンプト比較 |

講義メーカーとしての結論・クローズは `docs/course-maker/README.md`。

**補足:** いま `/lab` にあるモデル比較は **講義メーカー選定用**。AO 本体チャットのモデル比較専用画面はコードベースに見当たらない（本番 UI 内のモデル情報表示は別）。

---

## 環境変数（ローカル開発用）

推奨名（新）と互換名（旧）を **デュアルリード**する。

| 推奨 | 互換 | 意味 |
|------|------|------|
| `AO_LAB_PUBLIC=1` | `AO_SAMPLE_PUBLIC` | `/lab`（と旧 `/sample`）および GET `/api/lab/*` を認証外公開（**本番では使わない**） |
| `AO_LAB_API_SECRET` | `AO_SAMPLE_API_SECRET` | POST にヘッダ必須 |
| `AO_LAB_API_DISABLED=1` | `AO_SAMPLE_API_DISABLED` | POST 全面拒否 |

ヘッダ: `x-ao-lab-secret` または `x-ao-sample-secret`

Vercel 上は秘密未設定だと POST を拒否（fail closed）だが、**Lab ルート自体を本番に載せない**のが本方針。ローカルは秘密未設定でも開発便宜で許可しうる。

実装: `web/src/lib/course-maker/lab-api-guard.ts`、`web/src/auth.ts`

---

## コード地図

```
web/src/app/lab/           … UI（本番 ignore）
web/src/app/api/lab/       … 生成・マニフェスト API（本番 ignore）
web/public/lab/            … 成果物・静的ハブ（本番 ignore）
web/src/lib/course-maker/  … 各ラボ実装・lab-api-guard（製品と共有しうる lib は残る）
web/scripts/lab-phone-view.sh
```

旧パス互換（ローカル）: `next.config.ts` の redirects（`/sample` → `/lab`、`/api/sample` → `/api/lab`）。

本番除外の正本: **`web/.vercelignore`**（Vercel Root Directory = `web`）。リポジトリ直下の `.vercelignore` は CLI 用の補助。

---

## 新しい実験を足すとき

1. `web/src/app/lab/…`（と必要なら `api/lab`）に追加する  
2. ハブ（`/lab`）のセクションに 1 行追加する  
3. 本 README の表を更新する  
4. **本番に載せたくなったら**、そのときは方針を殿下と再確認する（既定は載せない）

---

**正式化日: 2026-07-31**（`/sample` → `/lab`）  
**運用方針更新: 2026-08-02**（ローカル専用・本番非搭載）
