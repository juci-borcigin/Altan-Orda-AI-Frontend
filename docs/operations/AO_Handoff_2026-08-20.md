# 引き継ぎ — シェル分割・テンプレ掃除の区切り（2026-08-20）

**次スレッドの最初に読む正本。**  
前スレッドで `page.tsx` 分割とテンプレ掃除を閉じ、左カラム compact も殿下判定で済。ここからの主戦場は **第二テンプレ A/B**（コンプからの皮起こしは Side track）。

呼称: ユーザー＝ジュチ殿下。エージェント＝スブタイ。

講義メーカー・Lab 公式化時点の記録: [AO_Handoff_to_Core_2026-08-02.md](./AO_Handoff_to_Core_2026-08-02.md)  
レイアウト正本: [version-2-layout.md](../version-2-layout.md)  
掃除ログ: [AO_Cleanup_Ledger.md](./AO_Cleanup_Ledger.md)

---

## 1. いま何をするか

| やる（次） | やらない（この直後） |
|------------|----------------------|
| 第二テンプレ A/B（殿下がテンプレ B を用意。切替検証） | コンプからの皮起こし（Side track。A/B のあと） |
| 必要なら任意掃除（下記 §5） | `lib/phase5/*` リネーム、Prod Push、無断 commit |
| | 左歯車の有効化（モジュール設定は後続） |
| | `map-bg-mobile` 配線（見た目が変わる・別判断） |

確認 URL: `http://localhost:3000/` ・台帳 `http://localhost:3000/lab/template-tokens`

---

## 2. 前スレッドで閉じたこと

### 2.1 モジュール境界

ルート `page.tsx` は `AoHomeScreen` を載せるだけ。チャット state は `useAoChatSession` が 1 回。戻り値は束:

`shell` / `thread` / `compose` / `ron` / `overlay` / `history` / `raw`

| 役割 | ファイル |
|------|----------|
| シェル | `web/src/components/ao-home-screen.tsx` |
| session | `web/src/components/use-ao-chat-session.tsx` |
| チャット組み立て | `web/src/components/ao-chat-module.tsx` |
| ユーザー／ビュー | `ao-chat-user-area.tsx` / `ao-chat-view-area.tsx` |
| 左カラム | `ao-left-kin-side-column.tsx` |
| KM | `ao-knowledge-module.tsx` |

### 2.2 テンプレ

- 静的資産は `web/public/template/` のみ。`public/phase5/` は削除済み
- 本番枠は `AoTemplateFrame`。大枠 `frame_AL`、中枠 `frame_AS`（論タブ・左の区画・議事一覧／設定重ね・削除確認まで）
- `AoOrnamentalFrame` は削除（退避 `_archive/cleanup-2026-08-20/chunk-02-ornamental-to-template/`）
- 視覚 SSOT: `/lab/template-tokens`（旧 `/phase5-preview` はリダイレクト）

### 2.3 掃除

- 未使用 import、Next 雛形 SVG、`ao-ron-tab-chrome.ts`、`GIKUJI_*` 別名、論タブ内 `AoRubyGold` コピー
- 未使用試作: `AoP5Bubble` / `Corner` / `DecorativeFrame` / `PortraitCard` / `PortraitFrameC`
- `AoTemplateLayoutSample` は A/B の種として残置
- 戻し: Git `a99ba95` ＋ `_archive/cleanup-2026-08-20/`（Git 非追跡）

### 2.4 殿下判定

- PC／Lab／スマホ: **整理由来の問題は見当たらない**
- 表示の細かいずれは AO チャット側の調整（掃除のブロッカーにしない）
- 左歯車グレーアウトは既定
- 左カラムの挙動のおかしいところは **前からのシェル問題** → 整理の外で直す

---

## 3. リポジトリ状態（この引継ぎ作成時点）

| 項目 | 状態 |
|------|------|
| ブランチ | `sample-lab-preview` |
| チェックポイント | `a99ba95` `feat: split AO shell from chat and finish template cleanup` |
| origin | **未 push**（1 commit 先行） |
| Prod | **載せていない**（既定は localhost。`vercel --prod` は明示時のみ） |
| 作業ツリー | 本引継ぎ・典籍追記が **未コミットの可能性あり**（新スレッドで docs commit してよい） |

勝手に push / prod しない。

---

## 4. コード／docs 入口

| 領域 | 入口 |
|------|------|
| ルート | `web/src/app/page.tsx` |
| シェル〜チャット | §2.1 の表 |
| 枠トークン | `web/src/lib/template/ao-frame-tokens.ts` |
| 資産パス | `web/src/lib/template/ao-template-assets.ts` |
| クロム | `web/src/lib/template/ao-chrome.ts` |
| 左カラム修正の当たり | `ao-left-kin-side-column.tsx` ＋ `ao-home-screen.tsx` ＋ `ao-viewport-compact.ts` |
| 削除確認 | `AoDeleteConfirmPopup.tsx`（`frame_AS`） |
| レイアウト正本 | `docs/version-2-layout.md` |
| バックログ | `docs/operations/AO_Core_Backlog.md` |

---

## 5. 任意残り（左カラムより優先しない）

| ID | 内容 | 注意 |
|----|------|------|
| M-03 | `AO_P5_*` 定数・`.ao-p5-*` クラスのリネーム | 大規模置換。HMR 残骸に注意 |
| — | `globals.css` の goldplate／leather（tsx 参照なし） | 削除前に Lab 文字列を再確認 |
| — | `/phase5-preview` の page redirect と `next.config` redirect の二重 | 典籍プレビュー `/phase5-preview/notebook-sources` は残す |
| M-04 | `map-bg-mobile` を compact に配線 | **見た目変更**。左カラムとは別判断 |
| — | `lib/phase5/*` リネーム | **しない**（当面） |

---

## 6. その先（左カラム済）

1. 第二テンプレを用意し、本体または Lab で **A/B 切替試験**（殿下がテンプレ B＝AO Ver2 見た目を用意。マルチユーザーは前提ではない）
2. KM 第2弾（文末チャット等）は A/B のあとで可
3. Phase 7 独立モジュール（情報 Push・巷間移設・画像生成論）はテンプレが落ち着いてから
4. **Side track（A/B のあと）**: コンプ 1 枚から皮スロットを起こす。公開時のユーザー機能にするかは切替が固まってから再判断

---

## 7. 新スレッドへの貼り付け用

```
引き継ぎ: docs/operations/AO_Handoff_2026-08-20.md を読んでから動くこと。
チェックポイント a99ba95（シェル分割）。左カラム compact は済。次は第二テンプレ A/B（殿下が B を用意）。コンプからの皮起こしは Side track。
レイアウト正本 docs/version-2-layout.md。掃除ログ docs/operations/AO_Cleanup_Ledger.md。
勝手にバッチ課金・force push・Prod・無断 commit しない。
```

---

**作成: 2026-08-20（スブタイ）**
