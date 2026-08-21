# 引き継ぎ — Altan Orda 本体へ戻る（2026-08-02）

**現行の次スレッド正本は [AO_Handoff_2026-08-20.md](./AO_Handoff_2026-08-20.md)。** 本ファイルは講義メーカー・クローズ／Lab 公式化時点の記録。  
前スレッドで講義メーカーをクローズし、実験室（`/lab`）を公式化した。ここからの主戦場は **AO 本体（チャット UI・RAG・運用）**。

呼称: ユーザー＝ジュチ殿下。エージェント＝スブタイ。

---

## 1. いま何をするか

| やる | やらない（当面） |
|------|------------------|
| AO 本体の改良・整備 | 講義メーカーの機能追加（再開は別指示） |
| 必要なら `/lab` の AO アーカイブ参照 | バッチ課金生成の勝手実行 |

講義メーカー再開時の入口: `docs/course-maker/README.md`  
実験室の入口: `docs/lab/README.md` ・ UI `/lab`

---

## 2. 前スレッドで確定したこと（要約）

### 2.1 講義メーカー — クローズ

- Format v2（Web記事型）実装済み。ヒアリング → OutlineSkeleton → CourseMaster → 本文 → Wikimedia → ヒーロー画像 → 学習／講師チャット
- 公開受講: `/l/{courseId}`（認証なし・allowlist）。例: 美しく年を重ねる方法  
  `https://altan-orda-ai-frontend.vercel.app/l/c03de5c7-0153-45f9-9d62-d1c25a847dc1`
- AO 製品への埋め込みは **未着手**
- 「全回一括」の既定は本文のみ（`output=text`）。ヒーローは `output=image|both` が別ゲート
- 課金バッチは見積もり → 殿下の明示許可（`.cursor/rules/course-maker-batch-spend.mdc`）

### 2.2 実験室 — `/sample` → `/lab`

- 公式パス `/lab`。旧 `/sample`・`/api/sample` はローカルで 308 リダイレクト
- **運用（2026-08-02）**: ローカル専用。Git には残し、**Vercel 本番には載せない**（`.vercelignore`）。詳細は `docs/lab/README.md`
- env: `AO_LAB_*` 推奨、`AO_SAMPLE_*` デュアルリード互換（本番公開用 `AO_LAB_PUBLIC` は使わない）
- ハブに **AO 本体アーカイブ**（`/phase5-preview` 等）と講義メーカー比較ラボを掲載

### 2.3 AO 本体の試作画面（生存）

| パス | 内容 |
|------|------|
| `/lab/template-tokens` | テンプレ・トークン台帳（視覚 SSOT）。旧 `/phase5-preview` はリダイレクト |
| `/phase5-preview/notebook-sources` | 典籍ソース仮UI |
| `/ao-shin-icon-samples.html` | アイコン SVG 候補 |

本体チャット専用のモデル比較画面はコードに無い。`/lab` の比較は講義メーカー用。

---

## 3. リポジトリ状態（引き継ぎ時点）

- ブランチ: `sample-lab-preview`（origin 追従）
- 講義メーカー・Lab 改名まわりの変更が **未コミットで大量に残っている可能性が高い**
- 新スレッドで本体作業に入る前に、必要なら **コミット／PR 方針を殿下に確認**（勝手に commit しない）
- 本番: `https://altan-orda-ai-frontend.vercel.app`（公開受講・Lab 関連はデプロイ済みのこともあるが、最新の `/lab` 改名が本番に載っているかは要確認）

### 3.1 足場確認結果（2026-08-02・新スレッド）

| 項目 | 結果 |
|------|------|
| ブランチ | `sample-lab-preview` ＝ `origin/sample-lab-preview`（ahead/behind 0） |
| 作業ツリー | **未コミット大量**: おおよそ M 39 / D 56 / ?? 25（計 ~120 エントリ）。講義メーカー Format v2・`/lab` 改名・公開受講 `/l`・docs 等 |
| `.cursor/` | 未追跡（コミット対象にするかは要判断） |
| 本番 `/l/...` | **200**（公開受講は生存） |
| 本番 `/lab`・`/sample` | 未ログイン時 **307 → `/sign-in`**（`AO_LAB_PUBLIC` 未設定か、改名デプロイ前の可能性）。`/sample`→`/lab` の next.config リダイレクトは **ローカル未コミット側にあり、本番反映は未確認〜未反映と見るのが妥当** |
| コミット | **未実施**（殿下の方針待ち） |

本体バックログ・マルチユーザー構想の記録先: [AO_Core_Backlog.md](./AO_Core_Backlog.md)

---

## 4. 本体に戻るときのコード／docs 入口

| 領域 | 入口 |
|------|------|
| 本番チャット UI | `web/src/app/page.tsx`（巨大） |
| Phase5 部品 | `web/src/components/ao-phase5/`、`/phase5-preview` |
| 典籍／ノートブック | `web/src/components/notebook/`、`docs/phase6/` |
| レイアウト／Ver2 | `docs/version-2-layout.md`、`docs/operations/AO_Frontend_Ver2_Implementation_Spec.md` |
| Phase 計画 | `docs/phase7/AO_Phase7_Planning.md`、`docs/phase6/*` |
| 実験室 | `/lab`、`docs/lab/README.md` |

---

## 5. 新スレッドへの貼り付け用（短文）

次を新チャットの先頭に貼るか、本ファイルを `@` 参照する。

```
現行の引き継ぎ: docs/operations/AO_Handoff_2026-08-20.md を読んでから動くこと。
（本ファイルは 2026-08-02 の講義メーカー・クローズ記録。）
```

---

## 6. 前スレッドのチャット

長文の経緯はエージェント transcript に残るが、**正本は本ファイル＋ course-maker / lab README**。  
チャットログを漁るより、上記 docs を優先する。

---

**作成: 2026-08-02（スブタイ）**
